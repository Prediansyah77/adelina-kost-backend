const db = require("../config/database");


// ======================================================
// HELPER:
// HITUNG TOTAL PEMBAYARAN SEBUAH TAGIHAN
// ======================================================
const getTotalPaid = async (billId, connection = db) => {

    const [rows] = await connection.query(`
        SELECT
            COALESCE(SUM(amount), 0) AS total_paid
        FROM payments
        WHERE bill_id = ?
    `, [billId]);

    return Number(rows[0].total_paid || 0);
};


// ======================================================
// HELPER:
// UPDATE STATUS TAGIHAN
// ======================================================
const updateBillStatus = async (
    billId,
    connection = db
) => {

    const [billRows] = await connection.query(`
        SELECT
            id,
            amount,
            status
        FROM bills
        WHERE id = ?
    `, [billId]);

    if (billRows.length === 0) {

        return {
            exists: false,
            isPaid: false,
            previousStatus: null,
            newStatus: null
        };

    }

    const bill = billRows[0];

    const totalPaid = await getTotalPaid(
        billId,
        connection
    );

    const previousStatus = bill.status;

    let newStatus = "unpaid";

    if (
        totalPaid >= Number(bill.amount)
    ) {

        newStatus = "paid";

    }

    await connection.query(`
        UPDATE bills
        SET status = ?
        WHERE id = ?
    `, [
        newStatus,
        billId
    ]);

    return {

        exists: true,

        isPaid:
            newStatus === "paid",

        previousStatus,

        newStatus,

        totalPaid,

        billAmount:
            Number(bill.amount)

    };

};


// ======================================================
// HELPER:
// NORMALISASI METODE PEMBAYARAN
// ======================================================
const normalizePaymentMethod = (
    paymentMethod
) => {

    if (!paymentMethod) {

        return "cash";

    }

    return String(paymentMethod)
        .trim()
        .toLowerCase();

};


// ======================================================
// HELPER:
// VALIDASI REKENING BANK
//
// STRUKTUR BANK_ACCOUNTS YANG DIGUNAKAN:
//
// current_balance
// is_active
// ======================================================
const validateBankAccount = async (
    connection,
    bankAccountId
) => {

    if (!bankAccountId) {

        return null;

    }

    const [rows] = await connection.query(`
        SELECT
            id,
            bank_name,
            account_number,
            account_name,
            current_balance,
            account_type,
            is_active
        FROM bank_accounts
        WHERE id = ?
        FOR UPDATE
    `, [
        bankAccountId
    ]);

    if (rows.length === 0) {

        return null;

    }

    return rows[0];

};


// ======================================================
// HELPER:
// BUAT TAGIHAN BULAN BERIKUTNYA
// ======================================================
const createNextBill = async (
    billId,
    connection = db
) => {

    const [billRows] = await connection.query(`
        SELECT
            b.id,
            b.contract_id,
            b.billing_month,
            b.billing_year,
            b.amount,
            b.due_date,

            c.tenant_id,
            c.room_id,
            c.monthly_price,
            c.status AS contract_status

        FROM bills b

        JOIN contracts c
            ON b.contract_id = c.id

        WHERE b.id = ?
    `, [
        billId
    ]);


    if (billRows.length === 0) {

        return null;

    }


    const bill = billRows[0];


    // ==================================================
    // HANYA KONTRAK AKTIF
    // ==================================================

    if (
        bill.contract_status &&
        bill.contract_status !== "active"
    ) {

        return null;

    }


    // ==================================================
    // HITUNG BULAN BERIKUTNYA
    // ==================================================

    let nextMonth =
        Number(bill.billing_month) + 1;

    let nextYear =
        Number(bill.billing_year);


    // Desember -> Januari tahun berikutnya
    if (nextMonth > 12) {

        nextMonth = 1;

        nextYear += 1;

    }


    // ==================================================
    // CEK TAGIHAN SUDAH ADA
    // ==================================================

    const [existingRows] = await connection.query(`
        SELECT
            id
        FROM bills
        WHERE contract_id = ?
        AND billing_month = ?
        AND billing_year = ?
        LIMIT 1
    `, [
        bill.contract_id,
        nextMonth,
        nextYear
    ]);


    if (existingRows.length > 0) {

        return {

            created: false,

            id:
                existingRows[0].id

        };

    }


    // ==================================================
    // JUMLAH TAGIHAN BERIKUTNYA
    // ==================================================

    const nextAmount =
        Number(bill.monthly_price) > 0
            ? Number(bill.monthly_price)
            : Number(bill.amount);


    // ==================================================
    // JATUH TEMPO
    // ==================================================

    let nextDueDate = null;


    if (bill.due_date) {

        const dueDate =
            new Date(bill.due_date);

        const dueDay =
            dueDate.getDate();


        const nextDue =
            new Date(
                nextYear,
                nextMonth - 1,
                dueDay
            );


        // Jika tanggal tidak valid karena
        // bulan berikutnya lebih pendek
        if (
            nextDue.getMonth() !==
            nextMonth - 1
        ) {

            nextDueDate =
                new Date(
                    nextYear,
                    nextMonth,
                    0
                );

        } else {

            nextDueDate =
                nextDue;

        }

    }


    // ==================================================
    // FORMAT DATE YYYY-MM-DD
    // ==================================================

    let formattedDueDate = null;


    if (nextDueDate) {

        const year =
            nextDueDate.getFullYear();

        const month =
            String(
                nextDueDate.getMonth() + 1
            ).padStart(
                2,
                "0"
            );

        const day =
            String(
                nextDueDate.getDate()
            ).padStart(
                2,
                "0"
            );


        formattedDueDate =
            `${year}-${month}-${day}`;

    }


    // ==================================================
    // INSERT TAGIHAN BULAN BERIKUTNYA
    // ==================================================

    const [result] = await connection.query(`
        INSERT INTO bills
        (
            contract_id,
            billing_month,
            billing_year,
            amount,
            due_date,
            status
        )
        VALUES
        (?, ?, ?, ?, ?, 'unpaid')
    `, [
        bill.contract_id,
        nextMonth,
        nextYear,
        nextAmount,
        formattedDueDate
    ]);


    console.log(
        "Tagihan otomatis berhasil dibuat:",
        `contract_id=${bill.contract_id},`,
        `${nextMonth}/${nextYear}`
    );


    return {

        created: true,

        id:
            result.insertId,

        billing_month:
            nextMonth,

        billing_year:
            nextYear,

        amount:
            nextAmount,

        due_date:
            formattedDueDate

    };

};


// ======================================================
// QUERY PAYMENT
// ======================================================
const paymentSelect = `
    SELECT
        p.*,

        b.billing_month,
        b.billing_year,
        b.amount AS bill_amount,
        b.status AS bill_status,

        t.name AS tenant_name,
        t.phone,

        r.room_number,

        ba.bank_name,
        ba.account_number,
        ba.account_name

    FROM payments p

    JOIN bills b
        ON p.bill_id = b.id

    JOIN contracts c
        ON b.contract_id = c.id

    JOIN tenants t
        ON c.tenant_id = t.id

    JOIN rooms r
        ON c.room_id = r.id

    LEFT JOIN bank_accounts ba
        ON p.bank_account_id = ba.id
`;


// ======================================================
// GET SEMUA PEMBAYARAN
// GET /api/payments
// ======================================================
const getPayments = async (
    req,
    res
) => {

    try {

        const [rows] = await db.query(`
            ${paymentSelect}

            ORDER BY
                p.payment_date DESC,
                p.id DESC
        `);


        res.status(200).json({

            success: true,

            data: rows

        });


    } catch (error) {

        console.error(
            "Get Payments Error:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Gagal mengambil data pembayaran",

            error:
                error.message

        });

    }

};


// ======================================================
// GET PEMBAYARAN BERDASARKAN ID
// GET /api/payments/:id
// ======================================================
const getPaymentById = async (
    req,
    res
) => {

    try {

        const { id } = req.params;


        const [rows] = await db.query(`
            ${paymentSelect}

            WHERE p.id = ?
        `, [
            id
        ]);


        if (rows.length === 0) {

            return res.status(404).json({

                success: false,

                message:
                    "Pembayaran tidak ditemukan"

            });

        }


        res.status(200).json({

            success: true,

            data:
                rows[0]

        });


    } catch (error) {

        console.error(
            "Get Payment Error:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Gagal mengambil pembayaran",

            error:
                error.message

        });

    }

};


// ======================================================
// CREATE PAYMENT
// POST /api/payments
// ======================================================
const createPayment = async (
    req,
    res
) => {

    let connection = null;


    try {

        const {

            bill_id,

            payment_date,

            amount,

            payment_method,

            bank_account_id,

            notes

        } = req.body;


        // ==================================================
        // NORMALISASI
        // ==================================================

        const normalizedMethod =
            normalizePaymentMethod(
                payment_method
            );


        // ==================================================
        // VALIDASI
        // ==================================================

        if (
            !bill_id ||
            !payment_date ||
            !amount
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "bill_id, payment_date, dan amount wajib diisi"

            });

        }


        const amountNumber =
            Number(amount);


        if (
            !Number.isFinite(amountNumber) ||
            amountNumber <= 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Jumlah pembayaran harus lebih besar dari 0"

            });

        }


        // ==================================================
        // TRANSFER HARUS MEMILIKI REKENING
        // ==================================================

        if (
            normalizedMethod === "transfer" &&
            !bank_account_id
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Rekening bank wajib dipilih untuk pembayaran transfer"

            });

        }


        // ==================================================
        // CASH TIDAK MENGUBAH SALDO REKENING BANK
        // ==================================================

        const finalBankAccountId =
            normalizedMethod === "transfer"
                ? Number(bank_account_id)
                : null;


        // ==================================================
        // CONNECTION
        // ==================================================

        connection =
            await db.getConnection();


        await connection.beginTransaction();


        // ==================================================
        // LOCK BILL
        // ==================================================

        const [billRows] =
            await connection.query(`
                SELECT
                    *
                FROM bills
                WHERE id = ?
                FOR UPDATE
            `, [
                bill_id
            ]);


        if (billRows.length === 0) {

            await connection.rollback();

            return res.status(404).json({

                success: false,

                message:
                    "Tagihan tidak ditemukan"

            });

        }


        const bill =
            billRows[0];


        // ==================================================
        // HITUNG SISA TAGIHAN
        // ==================================================

        const currentTotalPaid =
            await getTotalPaid(
                bill_id,
                connection
            );


        const remainingAmount =
            Number(bill.amount) -
            currentTotalPaid;


        if (
            amountNumber >
            remainingAmount
        ) {

            await connection.rollback();

            return res.status(400).json({

                success: false,

                message:
                    `Pembayaran melebihi sisa tagihan. Sisa tagihan: ${remainingAmount}`

            });

        }


        // ==================================================
        // VALIDASI REKENING BANK
        // ==================================================

        let bankAccount = null;


        if (
            normalizedMethod === "transfer"
        ) {

            bankAccount =
                await validateBankAccount(
                    connection,
                    finalBankAccountId
                );


            if (!bankAccount) {

                await connection.rollback();

                return res.status(404).json({

                    success: false,

                    message:
                        "Rekening bank tidak ditemukan"

                });

            }


            // ==================================================
            // CEK REKENING AKTIF
            // DATABASE MENGGUNAKAN is_active
            // ==================================================

            if (
                Number(bankAccount.is_active) !== 1
            ) {

                await connection.rollback();

                return res.status(400).json({

                    success: false,

                    message:
                        "Rekening bank tersebut tidak aktif"

                });

            }

        }


        // ==================================================
        // INSERT PAYMENT
        // ==================================================

        const [result] =
            await connection.query(`
                INSERT INTO payments
                (
                    bill_id,
                    payment_date,
                    amount,
                    payment_method,
                    bank_account_id,
                    notes
                )
                VALUES
                (?, ?, ?, ?, ?, ?)
            `, [

                bill_id,

                payment_date,

                amountNumber,

                normalizedMethod,

                finalBankAccountId,

                notes || null

            ]);


        // ==================================================
        // ⭐ TAMBAHKAN SALDO BANK
        //
        // PENTING:
        // KOLOM YANG BENAR = current_balance
        // BUKAN balance
        // ==================================================

        if (
            normalizedMethod === "transfer"
        ) {

            const [balanceResult] =
                await connection.query(`
                    UPDATE bank_accounts
                    SET
                        current_balance =
                            COALESCE(current_balance, 0) + ?
                    WHERE id = ?
                `, [

                    amountNumber,

                    finalBankAccountId

                ]);


            if (
                balanceResult.affectedRows !== 1
            ) {

                throw new Error(
                    "Saldo rekening bank gagal diperbarui"
                );

            }

        }


        // ==================================================
        // UPDATE STATUS BILL
        // ==================================================

        const statusResult =
            await updateBillStatus(
                bill_id,
                connection
            );


        // ==================================================
        // BUAT TAGIHAN BULAN BERIKUTNYA
        // ==================================================

        let nextBill = null;


        if (
            statusResult.isPaid
        ) {

            nextBill =
                await createNextBill(
                    bill_id,
                    connection
                );

        }


        // ==================================================
        // COMMIT
        // ==================================================

        await connection.commit();


        // ==================================================
        // AMBIL PAYMENT TERBARU
        // ==================================================

        const [rows] =
            await db.query(`
                ${paymentSelect}

                WHERE p.id = ?
            `, [
                result.insertId
            ]);


        res.status(201).json({

            success: true,

            message:
                statusResult.isPaid

                    ? "Pembayaran berhasil dicatat, saldo bank bertambah, dan tagihan berikutnya otomatis dibuat."

                    : "Pembayaran berhasil dicatat dan saldo bank bertambah.",

            data:
                rows[0],

            next_bill:
                nextBill

        });


    } catch (error) {

        if (connection) {

            try {

                await connection.rollback();

            } catch (rollbackError) {

                console.error(
                    "Rollback Error:",
                    rollbackError
                );

            }

        }


        console.error(
            "Create Payment Error:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Gagal mencatat pembayaran",

            error:
                error.message

        });


    } finally {

        if (connection) {

            connection.release();

        }

    }

};


// ======================================================
// UPDATE PAYMENT
// PUT /api/payments/:id
// ======================================================
const updatePayment = async (
    req,
    res
) => {

    let connection = null;


    try {

        const { id } = req.params;


        const {

            bill_id,

            payment_date,

            amount,

            payment_method,

            bank_account_id,

            notes

        } = req.body;


        const normalizedMethod =
            normalizePaymentMethod(
                payment_method
            );


        // ==================================================
        // VALIDASI
        // ==================================================

        if (
            !bill_id ||
            !payment_date ||
            !amount
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "bill_id, payment_date, dan amount wajib diisi"

            });

        }


        const amountNumber =
            Number(amount);


        if (
            !Number.isFinite(amountNumber) ||
            amountNumber <= 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Jumlah pembayaran harus lebih besar dari 0"

            });

        }


        if (
            normalizedMethod === "transfer" &&
            !bank_account_id
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Rekening bank wajib dipilih untuk pembayaran transfer"

            });

        }


        const newBankAccountId =
            normalizedMethod === "transfer"
                ? Number(bank_account_id)
                : null;


        // ==================================================
        // CONNECTION
        // ==================================================

        connection =
            await db.getConnection();


        await connection.beginTransaction();


        // ==================================================
        // LOCK PAYMENT LAMA
        // ==================================================

        const [paymentRows] =
            await connection.query(`
                SELECT
                    *
                FROM payments
                WHERE id = ?
                FOR UPDATE
            `, [
                id
            ]);


        if (paymentRows.length === 0) {

            await connection.rollback();

            return res.status(404).json({

                success: false,

                message:
                    "Pembayaran tidak ditemukan"

            });

        }


        const oldPayment =
            paymentRows[0];


        const oldBillId =
            oldPayment.bill_id;


        const oldAmount =
            Number(oldPayment.amount);


        const oldMethod =
            normalizePaymentMethod(
                oldPayment.payment_method
            );


        const oldBankAccountId =
            oldPayment.bank_account_id
                ? Number(oldPayment.bank_account_id)
                : null;


        // ==================================================
        // LOCK BILL BARU
        // ==================================================

        const [newBillRows] =
            await connection.query(`
                SELECT
                    *
                FROM bills
                WHERE id = ?
                FOR UPDATE
            `, [
                bill_id
            ]);


        if (newBillRows.length === 0) {

            await connection.rollback();

            return res.status(404).json({

                success: false,

                message:
                    "Tagihan tidak ditemukan"

            });

        }


        const newBill =
            newBillRows[0];


        // ==================================================
        // HITUNG TOTAL BILL BARU
        // PAYMENT YANG SEDANG DIEDIT DIKECUALIKAN
        // ==================================================

        const [totalRows] =
            await connection.query(`
                SELECT
                    COALESCE(
                        SUM(amount),
                        0
                    ) AS total_paid
                FROM payments
                WHERE bill_id = ?
                AND id != ?
            `, [
                bill_id,
                id
            ]);


        const existingNewTotal =
            Number(
                totalRows[0].total_paid || 0
            );


        const remainingNewAmount =
            Number(newBill.amount) -
            existingNewTotal;


        if (
            amountNumber >
            remainingNewAmount
        ) {

            await connection.rollback();

            return res.status(400).json({

                success: false,

                message:
                    `Pembayaran melebihi sisa tagihan. Sisa tagihan: ${remainingNewAmount}`

            });

        }


        // ==================================================
        // VALIDASI REKENING LAMA
        // ==================================================

        if (
            oldMethod === "transfer" &&
            oldBankAccountId
        ) {

            const oldBank =
                await validateBankAccount(
                    connection,
                    oldBankAccountId
                );


            if (!oldBank) {

                await connection.rollback();

                return res.status(404).json({

                    success: false,

                    message:
                        "Rekening bank pembayaran lama tidak ditemukan"

                });

            }

        }


        // ==================================================
        // VALIDASI REKENING BARU
        // ==================================================

        if (
            normalizedMethod === "transfer"
        ) {

            const newBank =
                await validateBankAccount(
                    connection,
                    newBankAccountId
                );


            if (!newBank) {

                await connection.rollback();

                return res.status(404).json({

                    success: false,

                    message:
                        "Rekening bank baru tidak ditemukan"

                });

            }


            if (
                Number(newBank.is_active) !== 1
            ) {

                await connection.rollback();

                return res.status(400).json({

                    success: false,

                    message:
                        "Rekening bank tersebut tidak aktif"

                });

            }

        }


        // ==================================================
        // KEMBALIKAN SALDO PAYMENT LAMA
        //
        // current_balance - amount lama
        // ==================================================

        if (
            oldMethod === "transfer" &&
            oldBankAccountId
        ) {

            await connection.query(`
                UPDATE bank_accounts
                SET
                    current_balance =
                        COALESCE(current_balance, 0) - ?
                WHERE id = ?
            `, [

                oldAmount,

                oldBankAccountId

            ]);

        }


        // ==================================================
        // UPDATE PAYMENT
        // ==================================================

        await connection.query(`
            UPDATE payments
            SET
                bill_id = ?,
                payment_date = ?,
                amount = ?,
                payment_method = ?,
                bank_account_id = ?,
                notes = ?
            WHERE id = ?
        `, [

            bill_id,

            payment_date,

            amountNumber,

            normalizedMethod,

            newBankAccountId,

            notes || null,

            id

        ]);


        // ==================================================
        // TAMBAHKAN SALDO PAYMENT BARU
        //
        // current_balance + amount baru
        // ==================================================

        if (
            normalizedMethod === "transfer"
        ) {

            await connection.query(`
                UPDATE bank_accounts
                SET
                    current_balance =
                        COALESCE(current_balance, 0) + ?
                WHERE id = ?
            `, [

                amountNumber,

                newBankAccountId

            ]);

        }


        // ==================================================
        // UPDATE STATUS BILL LAMA
        // ==================================================

        await updateBillStatus(
            oldBillId,
            connection
        );


        // ==================================================
        // UPDATE STATUS BILL BARU
        // ==================================================

        const newBillStatus =
            await updateBillStatus(
                bill_id,
                connection
            );


        // ==================================================
        // BUAT NEXT BILL
        // ==================================================

        let nextBill = null;


        if (
            newBillStatus.isPaid
        ) {

            nextBill =
                await createNextBill(
                    bill_id,
                    connection
                );

        }


        // ==================================================
        // COMMIT
        // ==================================================

        await connection.commit();


        // ==================================================
        // AMBIL DATA TERBARU
        // ==================================================

        const [rows] =
            await db.query(`
                ${paymentSelect}

                WHERE p.id = ?
            `, [
                id
            ]);


        res.status(200).json({

            success: true,

            message:
                "Pembayaran berhasil diperbarui dan saldo bank disesuaikan.",

            data:
                rows[0],

            next_bill:
                nextBill

        });


    } catch (error) {

        if (connection) {

            try {

                await connection.rollback();

            } catch (rollbackError) {

                console.error(
                    "Rollback Error:",
                    rollbackError
                );

            }

        }


        console.error(
            "Update Payment Error:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Gagal memperbarui pembayaran",

            error:
                error.message

        });


    } finally {

        if (connection) {

            connection.release();

        }

    }

};


// ======================================================
// GET PAYMENT SUMMARY
// GET /api/payments/summary
// ======================================================
const getPaymentSummary = async (
    req,
    res
) => {

    try {

        const {
            month,
            year
        } = req.query;


        // ==================================================
        // VALIDASI
        // ==================================================

        if (
            !month ||
            !year
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "month dan year wajib diisi"

            });

        }


        const monthNumber =
            Number(month);

        const yearNumber =
            Number(year);


        if (
            !Number.isInteger(monthNumber) ||
            monthNumber < 1 ||
            monthNumber > 12
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "month harus berupa angka 1 sampai 12"

            });

        }


        if (
            !Number.isInteger(yearNumber) ||
            yearNumber < 2000
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "year tidak valid"

            });

        }


        // ==================================================
        // TOTAL PEMBAYARAN
        // ==================================================

        const [summaryRows] =
            await db.query(`
                SELECT
                    COUNT(*) AS total_transactions,

                    COALESCE(
                        SUM(amount),
                        0
                    ) AS total_amount

                FROM payments

                WHERE MONTH(payment_date) = ?

                AND YEAR(payment_date) = ?
            `, [
                monthNumber,
                yearNumber
            ]);


        // ==================================================
        // REKAP METODE PEMBAYARAN
        // ==================================================

        const [methodRows] =
            await db.query(`
                SELECT
                    payment_method,

                    COUNT(*) AS transaction_count,

                    COALESCE(
                        SUM(amount),
                        0
                    ) AS total_amount

                FROM payments

                WHERE MONTH(payment_date) = ?

                AND YEAR(payment_date) = ?

                GROUP BY payment_method

                ORDER BY total_amount DESC
            `, [
                monthNumber,
                yearNumber
            ]);


        // ==================================================
        // RESPONSE
        // ==================================================

        res.status(200).json({

            success: true,

            data: {

                period: {

                    month:
                        monthNumber,

                    year:
                        yearNumber

                },

                summary: {

                    total_transactions:
                        Number(
                            summaryRows[0]
                                .total_transactions
                        ) || 0,

                    total_amount:
                        Number(
                            summaryRows[0]
                                .total_amount
                        ) || 0

                },

                payment_methods:
                    methodRows.map(
                        (item) => ({

                            payment_method:
                                item.payment_method,

                            transaction_count:
                                Number(
                                    item.transaction_count
                                ) || 0,

                            total_amount:
                                Number(
                                    item.total_amount
                                ) || 0

                        })
                    )

            }

        });


    } catch (error) {

        console.error(
            "Payment Summary Error:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Gagal mengambil rekap pembayaran",

            error:
                error.message

        });

    }

};


// ======================================================
// DELETE PAYMENT
// DELETE /api/payments/:id
// ======================================================
const deletePayment = async (
    req,
    res
) => {

    let connection = null;


    try {

        const {
            id
        } = req.params;


        connection =
            await db.getConnection();


        await connection.beginTransaction();


        // ==================================================
        // LOCK PAYMENT
        // ==================================================

        const [paymentRows] =
            await connection.query(`
                SELECT
                    *
                FROM payments
                WHERE id = ?
                FOR UPDATE
            `, [
                id
            ]);


        if (paymentRows.length === 0) {

            await connection.rollback();

            return res.status(404).json({

                success: false,

                message:
                    "Pembayaran tidak ditemukan"

            });

        }


        const payment =
            paymentRows[0];


        const billId =
            payment.bill_id;


        const paymentAmount =
            Number(payment.amount);


        const paymentMethod =
            normalizePaymentMethod(
                payment.payment_method
            );


        const bankAccountId =
            payment.bank_account_id
                ? Number(
                    payment.bank_account_id
                )
                : null;


        // ==================================================
        // JIKA TRANSFER
        // KURANGI SALDO BANK
        // ==================================================

        if (
            paymentMethod === "transfer" &&
            bankAccountId
        ) {

            const bankAccount =
                await validateBankAccount(
                    connection,
                    bankAccountId
                );


            if (!bankAccount) {

                await connection.rollback();

                return res.status(404).json({

                    success: false,

                    message:
                        "Rekening bank pembayaran tidak ditemukan"

                });

            }


            await connection.query(`
                UPDATE bank_accounts
                SET
                    current_balance =
                        COALESCE(current_balance, 0) - ?
                WHERE id = ?
            `, [

                paymentAmount,

                bankAccountId

            ]);

        }


        // ==================================================
        // HAPUS PAYMENT
        // ==================================================

        await connection.query(`
            DELETE FROM payments
            WHERE id = ?
        `, [
            id
        ]);


        // ==================================================
        // UPDATE STATUS BILL
        // ==================================================

        const statusResult =
            await updateBillStatus(
                billId,
                connection
            );


        // ==================================================
        // COMMIT
        // ==================================================

        await connection.commit();


        res.status(200).json({

            success: true,

            message:
                "Pembayaran berhasil dihapus dan saldo bank disesuaikan.",

            data: {

                bill_status:
                    statusResult.newStatus

            }

        });


    } catch (error) {

        if (connection) {

            try {

                await connection.rollback();

            } catch (rollbackError) {

                console.error(
                    "Rollback Error:",
                    rollbackError
                );

            }

        }


        console.error(
            "Delete Payment Error:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Gagal menghapus pembayaran",

            error:
                error.message

        });


    } finally {

        if (connection) {

            connection.release();

        }

    }

};


// ======================================================
// EXPORT
// ======================================================

module.exports = {

    getPayments,

    getPaymentById,

    createPayment,

    updatePayment,

    deletePayment,

    getPaymentSummary

};