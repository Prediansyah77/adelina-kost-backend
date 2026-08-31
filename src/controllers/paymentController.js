const db = require("../config/database");


// ======================================================
// HELPER:
// HITUNG TOTAL PEMBAYARAN SEBUAH TAGIHAN
// ======================================================

// ======================================================
// HELPER:
// HITUNG TOTAL PEMBAYARAN YANG SUDAH VERIFIED
//
// pending  = belum dianggap membayar
// rejected = tidak dianggap membayar
// verified = dianggap membayar
// ======================================================
const getTotalPaid = async (
    billId,
    connection = db
) => {

    const [rows] = await connection.query(`
        SELECT
            COALESCE(SUM(amount), 0) AS total_paid

        FROM payments

        WHERE bill_id = ?

        AND status = 'verified'
    `, [
        billId
    ]);

    return Number(
        rows[0].total_paid || 0
    );
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
// ======================================================
// HELPER:
// BUAT TAGIHAN BULAN BERIKUTNYA
//
// ATURAN:
// 1. Kontrak harus active
// 2. Kalau ada end_date, bulan berikutnya harus masih
//    berada dalam masa kontrak
// 3. Kalau kontrak sudah berakhir sebelum bulan berikutnya,
//    jangan membuat tagihan baru
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
            c.status AS contract_status,

            DATE_FORMAT(
                c.start_date,
                '%Y-%m-%d'
            ) AS contract_start_date,

            DATE_FORMAT(
                c.end_date,
                '%Y-%m-%d'
            ) AS contract_end_date

        FROM bills b

        JOIN contracts c
            ON b.contract_id = c.id

        WHERE b.id = ?

        LIMIT 1
    `, [
        billId
    ]);


    // ==================================================
    // TAGIHAN TIDAK DITEMUKAN
    // ==================================================

    if (billRows.length === 0) {

        return null;

    }


    const bill = billRows[0];


    // ==================================================
    // KONTRAK HARUS ACTIVE
    // ==================================================

    if (
        bill.contract_status !== "active"
    ) {

        console.log(
            `[NEXT BILL] Tidak dibuat. ` +
            `Kontrak ${bill.contract_id} sudah tidak active.`
        );

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
    if (
        nextMonth > 12
    ) {

        nextMonth = 1;

        nextYear += 1;

    }


    // ==================================================
    // CEK END DATE KONTRAK
    //
    // Kalau kontrak sudah selesai sebelum bulan
    // berikutnya dimulai, JANGAN buat tagihan.
    // ==================================================

    if (
        bill.contract_end_date
    ) {

        const nextPeriodStart =
            buildDate(
                nextYear,
                nextMonth,
                1
            );


        const contractEndDate =
            normalizeDateOnly(
                bill.contract_end_date
            );


        if (
            contractEndDate &&
            contractEndDate < nextPeriodStart
        ) {

            console.log(
                `[NEXT BILL] Tidak dibuat. ` +
                `Kontrak ${bill.contract_id} ` +
                `berakhir ${contractEndDate}. ` +
                `Tidak masuk periode ${nextMonth}/${nextYear}.`
            );

            return {

                created: false,

                reason:
                    "Kontrak sudah berakhir sebelum periode berikutnya",

                contract_id:
                    bill.contract_id,

                billing_month:
                    nextMonth,

                billing_year:
                    nextYear

            };

        }

    }


    // ==================================================
    // CEK TAGIHAN SUDAH ADA
    // ==================================================

    const [existingRows] =
        await connection.query(`
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


    if (
        existingRows.length > 0
    ) {

        return {

            created: false,

            id:
                existingRows[0].id,

            reason:
                "Tagihan bulan berikutnya sudah ada"

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


    if (
        bill.due_date
    ) {

        const dueDate =
            new Date(
                bill.due_date
            );


        const dueDay =
            dueDate.getDate();


        const nextDue =
            new Date(
                nextYear,
                nextMonth - 1,
                dueDay
            );


        // ==================================================
        // JIKA BULAN BERIKUTNYA LEBIH PENDEK
        // CONTOH:
        // 31 AGUSTUS -> SEPTEMBER
        // ==================================================

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


    if (
        nextDueDate
    ) {

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

    const [result] =
        await connection.query(`
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
        "[NEXT BILL] Tagihan otomatis berhasil dibuat:",
        `contract_id=${bill.contract_id},`,
        `${nextMonth}/${nextYear}`
    );


    return {

        created: true,

        id:
            result.insertId,

        contract_id:
            bill.contract_id,

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

        /* ==========================================
           DATA BILL
           ========================================== */

   COALESCE(
    b.billing_month,
    MONTH(p.payment_date)
) AS billing_month,

COALESCE(
    b.billing_year,
    YEAR(p.payment_date)
) AS billing_year,
        /* ==========================================
           DATA BOOKING
           ========================================== */

        rb.booking_days,
        rb.booking_amount,
        rb.requested_start_date,
        rb.booking_expired_at,
        rb.status AS booking_status,

        /* ==========================================
           TENANT
           ========================================== */

        COALESCE(
            t_bill.name,
            t_booking.name
        ) AS tenant_name,

        COALESCE(
            t_bill.phone,
            t_booking.phone
        ) AS phone,

        /* ==========================================
           ROOM
           ========================================== */

        COALESCE(
            r_bill.room_number,
            r_booking.room_number
        ) AS room_number,

        /* ==========================================
           BANK
           ========================================== */

        ba.bank_name,
        ba.account_number,
        ba.account_name

    FROM payments p


    /* ==============================================
       PEMBAYARAN TAGIHAN
       ============================================== */

    LEFT JOIN bills b
        ON p.bill_id = b.id

    LEFT JOIN contracts c
        ON b.contract_id = c.id

    LEFT JOIN tenants t_bill
        ON c.tenant_id = t_bill.id

    LEFT JOIN rooms r_bill
        ON c.room_id = r_bill.id


    /* ==============================================
       PEMBAYARAN BOOKING
       ============================================== */

    LEFT JOIN room_bookings rb
        ON p.booking_id = rb.id

    LEFT JOIN tenants t_booking
        ON rb.tenant_id = t_booking.id

    LEFT JOIN rooms r_booking
        ON rb.room_id = r_booking.id


    /* ==============================================
       REKENING BANK
       ============================================== */

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
// ======================================================
// GET PEMBAYARAN MILIK PENGHUNI
// GET /api/payments/my-payments
//
// KHUSUS PENGHUNI
// ======================================================

const getMyPayments = async (
    req,
    res
) => {

    try {

        // ==================================================
        // CEK USER
        // ==================================================

        if (!req.user) {

            return res.status(401).json({

                success: false,

                message:
                    "User belum terautentikasi"

            });

        }


        // ==================================================
        // AMBIL TENANT ID DARI JWT
        // ==================================================

        const tenantId =
            Number(
                req.user.tenant_id
            );


        if (
            !Number.isInteger(tenantId) ||
            tenantId <= 0
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "tenant_id tidak valid"

            });

        }


        // ==================================================
        // AMBIL PEMBAYARAN TAGIHAN
        //
        // payments
        //    ↓
        // bills
        //    ↓
        // contracts
        //    ↓
        // tenants
        //
        // Hanya pembayaran milik tenant login.
        // ==================================================

        const [rows] =
            await db.query(`

                SELECT

                    p.id,

                    p.bill_id,

                    p.booking_id,

                    p.payment_date,

                    p.amount,

                    p.payment_method,

                    p.bank_account_id,

                    p.status,

                    p.notes,

                    p.proof_file,

                    b.billing_month,

                    b.billing_year,

                    b.due_date,

                    b.status AS bill_status,

                    c.tenant_id,

                    c.room_id,

                    r.room_number

                FROM payments p

                LEFT JOIN bills b
                    ON p.bill_id = b.id

                LEFT JOIN contracts c
                    ON b.contract_id = c.id

                LEFT JOIN rooms r
                    ON c.room_id = r.id

                WHERE c.tenant_id = ?

                ORDER BY
                    p.payment_date DESC,
                    p.id DESC

            `, [
                tenantId
            ]);


        // ==================================================
        // RESPONSE
        // ==================================================

        return res.status(200).json({

            success: true,

            data: rows

        });


    } catch (error) {

        console.error(
            "Get My Payments Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Gagal mengambil pembayaran penghuni",

            error:
                error.message

        });

    }

};

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
// CREATE PAYMENT BY TENANT
// POST /api/payments/tenant
//
// KHUSUS PENGHUNI
//
// Alur:
// penghuni submit pembayaran
// -> status = pending
// -> saldo bank BELUM berubah
// -> bill BELUM menjadi paid
// -> admin yang menentukan verified/rejected
// ======================================================
const createTenantPayment = async (
    req,
    res
) => {
    console.log("========== PAYMENT UPLOAD DEBUG ==========");
    console.log("REQ.FILE:", req.file);
    console.log("REQ.BODY:", req.body);
    console.log("==========================================");

    let connection = null;

    let uploadedFile = null;


    try {

        // ==================================================
        // CEK AUTHENTICATION
        // ==================================================

        if (!req.user) {

            return res.status(401).json({

                success: false,

                message:
                    "User belum terautentikasi"

            });

        }


        // ==================================================
        // AMBIL TENANT ID DARI JWT
        // ==================================================

        const tenantId =
            Number(req.user.tenant_id);


        if (
            !tenantId ||
            !Number.isInteger(tenantId)
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "Akun penghuni tidak memiliki tenant_id yang valid"

            });

        }


        // ==================================================
        // DATA FILE UPLOAD
        // ==================================================

        uploadedFile =
            req.file || null;


        const proofFile =
            req.file
                ? req.file.filename
                : null;


        // ==================================================
        // DATA REQUEST
        // ==================================================

        const {

            bill_id,

            payment_date,

            amount,

            payment_method,

            bank_account_id,

            notes

        } = req.body;


        // ==================================================
        // NORMALISASI PAYMENT METHOD
        // ==================================================

        const normalizedMethod =
            normalizePaymentMethod(
                payment_method
            );


        // ==================================================
        // VALIDASI INPUT WAJIB
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


        // ==================================================
        // VALIDASI BILL ID
        // ==================================================

        const billId =
            Number(bill_id);


        if (
            !Number.isInteger(billId) ||
            billId <= 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "bill_id tidak valid"

            });

        }


        // ==================================================
        // VALIDASI AMOUNT
        // ==================================================

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
        // VALIDASI PAYMENT METHOD
        // ==================================================

        if (
            ![
                "cash",
                "transfer",
                "other"
            ].includes(normalizedMethod)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Metode pembayaran tidak valid"

            });

        }


        // ==================================================
        // TRANSFER HARUS MEMILIKI BUKTI
        // ==================================================

        if (
            normalizedMethod === "transfer" &&
            !proofFile
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Bukti pembayaran wajib diupload untuk pembayaran transfer"

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
        // NORMALISASI BANK ACCOUNT ID
        // ==================================================

        let finalBankAccountId = null;


        if (
            normalizedMethod === "transfer"
        ) {

            finalBankAccountId =
                Number(bank_account_id);


            if (
                !Number.isInteger(
                    finalBankAccountId
                ) ||
                finalBankAccountId <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Rekening bank tidak valid"

                });

            }

        }


        // ==================================================
        // CONNECTION DATABASE
        // ==================================================

        connection =
            await db.getConnection();


        await connection.beginTransaction();


        // ==================================================
        // AMBIL BILL + LOCK
        //
        // SEKALIGUS MEMASTIKAN:
        //
        // BILL TERSEBUT MEMANG MILIK TENANT
        //
        // FOR UPDATE:
        // Mencegah race condition ketika ada request
        // pembayaran bersamaan.
        // ==================================================

        const [billRows] =
            await connection.query(`
                SELECT

                    b.id,
                    b.contract_id,

                    b.billing_month,
                    b.billing_year,

                    b.amount,

                    b.due_date,

                    b.status AS bill_status,

                    c.tenant_id,
                    c.status AS contract_status

                FROM bills b

                INNER JOIN contracts c
                    ON b.contract_id = c.id

                WHERE b.id = ?

                AND c.tenant_id = ?

                FOR UPDATE
            `, [

                billId,

                tenantId

            ]);


        // ==================================================
        // BILL TIDAK DITEMUKAN
        // ==================================================

        if (
            billRows.length === 0
        ) {

            await connection.rollback();


            return res.status(404).json({

                success: false,

                message:
                    "Tagihan tidak ditemukan atau bukan milik Anda"

            });

        }


        const bill =
            billRows[0];


        // ==================================================
        // KONTRAK HARUS AKTIF
        // ==================================================

        if (
            bill.contract_status !== "active"
        ) {

            await connection.rollback();


            return res.status(400).json({

                success: false,

                message:
                    "Kontrak Anda sudah tidak aktif"

            });

        }


        // ==================================================
        // BILL SUDAH LUNAS
        // ==================================================

        if (
            bill.bill_status === "paid"
        ) {

            await connection.rollback();


            return res.status(400).json({

                success: false,

                message:
                    "Tagihan ini sudah lunas"

            });

        }


        // ==================================================
        // CEK PEMBAYARAN PENDING
        //
        // Tenant tidak boleh mengirim pembayaran kedua
        // sebelum pembayaran sebelumnya diverifikasi.
        // ==================================================

        const [pendingRows] =
            await connection.query(`
                SELECT

                    id,
                    amount,
                    payment_date,
                    payment_method,
                    status

                FROM payments

                WHERE bill_id = ?

                AND status = 'pending'

                LIMIT 1
            `, [

                billId

            ]);


        if (
            pendingRows.length > 0
        ) {

            await connection.rollback();


            return res.status(409).json({

                success: false,

                message:
                    "Tagihan ini masih memiliki pembayaran yang menunggu verifikasi admin",

                data: {

                    payment_id:
                        pendingRows[0].id,

                    amount:
                        Number(
                            pendingRows[0].amount
                        ),

                    payment_date:
                        pendingRows[0].payment_date,

                    payment_method:
                        pendingRows[0].payment_method,

                    status:
                        pendingRows[0].status

                }

            });

        }


        // ==================================================
        // HITUNG TOTAL PEMBAYARAN YANG SUDAH VERIFIED
        // ==================================================

        const totalVerifiedPaid =
            await getTotalPaid(
                billId,
                connection
            );


        // ==================================================
        // HITUNG SISA TAGIHAN
        // ==================================================

        const remainingAmount =
            Number(bill.amount) -
            Number(totalVerifiedPaid);


        // ==================================================
        // SISA TAGIHAN SUDAH 0
        // ==================================================

        if (
            remainingAmount <= 0
        ) {

            await connection.rollback();


            return res.status(400).json({

                success: false,

                message:
                    "Tagihan ini sudah memiliki pembayaran yang mencukupi"

            });

        }


        // ==================================================
        // PEMBAYARAN TIDAK BOLEH MELEBIHI SISA TAGIHAN
        // ==================================================

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
        //
        // HANYA VALIDASI.
        //
        // BELUM MENAMBAH SALDO BANK.
        //
        // Saldo baru berubah setelah ADMIN VERIFY.
        // ==================================================

        if (
            normalizedMethod === "transfer"
        ) {

            const bankAccount =
                await validateBankAccount(
                    connection,
                    finalBankAccountId
                );


            // ==================================================
            // REKENING TIDAK DITEMUKAN
            // ==================================================

            if (
                !bankAccount
            ) {

                await connection.rollback();


                return res.status(404).json({

                    success: false,

                    message:
                        "Rekening bank tidak ditemukan"

                });

            }


            // ==================================================
            // REKENING TIDAK AKTIF
            // ==================================================

            if (
                Number(
                    bankAccount.is_active
                ) !== 1
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
        //
        // STATUS SELALU:
        //
        // pending
        //
        // Tenant TIDAK BOLEH menentukan status.
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
                    status,
                    notes,
                    proof_file
                )

                VALUES
                (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    'pending',
                    ?,
                    ?
                )
            `, [

                billId,

                payment_date,

                amountNumber,

                normalizedMethod,

                finalBankAccountId,

                notes
                    ? notes.trim()
                    : null,

                proofFile

            ]);


        // ==================================================
        // JANGAN UPDATE DI SINI
        //
        // JANGAN:
        //
        // UPDATE bank_accounts
        //
        // UPDATE bills SET status = 'paid'
        //
        // CREATE NEXT BILL
        //
        // Semua dilakukan setelah ADMIN VERIFY.
        // ==================================================


        // ==================================================
        // COMMIT
        // ==================================================

        await connection.commit();


        // ==================================================
        // AMBIL DATA PAYMENT YANG BARU DIBUAT
        //
        // paymentSelect harus sudah tersedia di
        // paymentController.js
        // ==================================================

        const [rows] =
            await db.query(`
                ${paymentSelect}

                WHERE p.id = ?
            `, [

                result.insertId

            ]);


        // ==================================================
        // RESPONSE
        // ==================================================

        return res.status(201).json({

            success: true,

            message:
                "Pembayaran berhasil dikirim dan menunggu verifikasi admin",

            data:
                rows[0] || {

                    id:
                        result.insertId,

                    bill_id:
                        billId,

                    amount:
                        amountNumber,

                    payment_method:
                        normalizedMethod,

                    bank_account_id:
                        finalBankAccountId,

                    status:
                        "pending",

                    proof_file:
                        proofFile

                }

        });


    } catch (error) {

        // ==================================================
        // ROLLBACK DATABASE
        // ==================================================

        if (
            connection
        ) {

            try {

                await connection.rollback();

            } catch (rollbackError) {

                console.error(
                    "Rollback Error:",
                    rollbackError
                );

            }

        }


        // ==================================================
        // HAPUS FILE JIKA DATABASE GAGAL
        //
        // Supaya tidak ada file bukti pembayaran
        // yang nyangkut di folder uploads tetapi
        // payment gagal masuk database.
        // ==================================================

        if (
            uploadedFile
        ) {

            try {

                const fs =
                    require("fs");

                const path =
                    require("path");

                const filePath =
                    path.join(
                        __dirname,
                        "../../uploads/payment-proofs",
                        uploadedFile.filename
                    );


                if (
                    fs.existsSync(filePath)
                ) {

                    fs.unlinkSync(
                        filePath
                    );

                }

            } catch (fileError) {

                console.error(
                    "Delete Uploaded Payment Proof Error:",
                    fileError
                );

            }

        }


        // ==================================================
        // LOG ERROR
        // ==================================================

        console.error(
            "Create Tenant Payment Error:",
            error
        );


        // ==================================================
        // RESPONSE ERROR
        // ==================================================

        return res.status(500).json({

            success: false,

            message:
                "Gagal mengirim pembayaran",

            error:
                error.message

        });


    } finally {

        // ==================================================
        // RELEASE CONNECTION
        // ==================================================

        if (
            connection
        ) {

            connection.release();

        }

    }

};


// ======================================================
// VERIFY PAYMENT
// PATCH /api/payments/:id/verify
//
// KHUSUS ADMIN
//
// ALUR:
//
// pending
//    ↓
// verified
//    ↓
// saldo bank bertambah
//    ↓
// bill diperbarui
//    ↓
// jika lunas → next bill dibuat
// ======================================================
// ======================================================
// CREATE BOOKING PAYMENT
// POST /api/payments/booking
// ======================================================
//
// Alur:
//
// Penghuni
//    ↓
// Upload bukti pembayaran
//    ↓
// payments
// booking_id = booking yang dipilih
// status = pending
//    ↓
// rooms.status = booked
//    ↓
// booking_expired_at = sekarang + booking_days
//
// SALDO BANK:
// Belum bertambah.
// Saldo bank hanya bertambah setelah admin
// melakukan verifikasi pembayaran.
//
// ======================================================


// ======================================================
// CREATE BOOKING PAYMENT
// POST /api/payments/booking
//
// KHUSUS PENGHUNI
//
// Alur:
//
// PENGHUNI
//     ↓
// pilih lama booking 1 - 7 hari
//     ↓
// backend hitung total
//     ↓
// upload bukti pembayaran
//     ↓
// payment = pending
//     ↓
// kamar = booked
//     ↓
// booking_expired_at ditentukan
//     ↓
// ADMIN VERIFY / REJECT
//
// RUMUS:
//
// harga kamar / 30 × booking_days
//
// ======================================================

// ======================================================
// CREATE BOOKING PAYMENT
// POST /api/payments/booking
//
// KHUSUS PENGHUNI
//
// Alur:
//
// PENGHUNI
//     ↓
// pilih lama booking 1 - 7 hari
//     ↓
// backend hitung total
//     ↓
// upload bukti pembayaran
//     ↓
// payment = pending
//     ↓
// kamar = booked
//     ↓
// booking_expired_at ditentukan
//     ↓
// ADMIN VERIFY / REJECT
//
// RUMUS:
//
// harga kamar / 30 × booking_days
//
// ======================================================

const createBookingPayment = async (
    req,
    res
) => {

    let connection = null;

    let uploadedFile = null;


    try {

        // ==================================================
        // AUTHENTICATION
        // ==================================================

        if (!req.user) {

            return res.status(401).json({

                success: false,

                message:
                    "User belum terautentikasi"

            });

        }


        // ==================================================
        // TENANT ID
        // ==================================================

        const tenantId =
            Number(
                req.user.tenant_id
            );


        if (
            !Number.isInteger(tenantId) ||
            tenantId <= 0
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "Akun penghuni tidak memiliki tenant_id yang valid"

            });

        }


        // ==================================================
        // FILE BUKTI PEMBAYARAN
        // ==================================================

        uploadedFile =
            req.file || null;


        const proofFile =
            req.file
                ? req.file.filename
                : null;


        if (!proofFile) {

            return res.status(400).json({

                success: false,

                message:
                    "Bukti pembayaran wajib diupload"

            });

        }


        // ==================================================
        // REQUEST DATA
        // ==================================================

        const {
            booking_id,
            booking_days
        } = req.body;


        // ==================================================
        // VALIDASI BOOKING ID
        // ==================================================

        const bookingId =
            Number(
                booking_id
            );


        if (
            !Number.isInteger(bookingId) ||
            bookingId <= 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Booking ID tidak valid"

            });

        }


        // ==================================================
        // VALIDASI BOOKING DAYS
        // ==================================================

        const bookingDays =
            Number(
                booking_days
            );


        if (
            !Number.isInteger(bookingDays) ||
            bookingDays < 1 ||
            bookingDays > 7
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Lama booking harus antara 1 sampai 7 hari"

            });

        }


        // ==================================================
        // DATABASE CONNECTION
        // ==================================================

        connection =
            await db.getConnection();


        await connection.beginTransaction();


        // ==================================================
        // LOCK BOOKING
        //
        // Booking harus milik tenant yang sedang login.
        // ==================================================

        const [bookingRows] =
            await connection.query(`
                SELECT

                    rb.id,
                    rb.tenant_id,
                    rb.room_id,
                    rb.booking_days,
                    rb.booking_amount,
                    rb.requested_start_date,
                    rb.booking_expired_at,
                    rb.status

                FROM room_bookings rb

                WHERE rb.id = ?

                AND rb.tenant_id = ?

                LIMIT 1

                FOR UPDATE
            `, [

                bookingId,

                tenantId

            ]);


        // ==================================================
        // BOOKING TIDAK DITEMUKAN
        // ==================================================

        if (
            bookingRows.length === 0
        ) {

            await connection.rollback();

            return res.status(404).json({

                success: false,

                message:
                    "Booking tidak ditemukan atau bukan milik Anda"

            });

        }


        const booking =
            bookingRows[0];


        // ==================================================
        // BOOKING HARUS PENDING
        // ==================================================

        if (
            booking.status !== "pending"
        ) {

            await connection.rollback();

            return res.status(400).json({

                success: false,

                message:
                    `Booking tidak dapat dibayar karena status saat ini adalah ${booking.status}`

            });

        }


        // ==================================================
        // CEK APAKAH SUDAH ADA PAYMENT PENDING
        // ==================================================

        const [existingPaymentRows] =
            await connection.query(`
                SELECT

                    id,
                    status

                FROM payments

                WHERE booking_id = ?

                AND status = 'pending'

                LIMIT 1

                FOR UPDATE
            `, [

                bookingId

            ]);


        if (
            existingPaymentRows.length > 0
        ) {

            await connection.rollback();

            return res.status(409).json({

                success: false,

                message:
                    "Booking ini sudah memiliki pembayaran yang sedang menunggu verifikasi"

            });

        }


        // ==================================================
        // LOCK ROOM
        // ==================================================

        const [roomRows] =
            await connection.query(`
                SELECT

                    id,
                    room_number,
                    price,
                    status

                FROM rooms

                WHERE id = ?

                LIMIT 1

                FOR UPDATE
            `, [

                booking.room_id

            ]);


        if (
            roomRows.length === 0
        ) {

            await connection.rollback();

            return res.status(404).json({

                success: false,

                message:
                    "Kamar booking tidak ditemukan"

            });

        }


        const room =
            roomRows[0];


        // ==================================================
        // CEK STATUS KAMAR
        //
        // Kamar harus available.
        // ==================================================

        if (
            room.status !== "available"
        ) {

            await connection.rollback();

            return res.status(409).json({

                success: false,

                message:
                    "Kamar sudah tidak tersedia"

            });

        }


        // ==================================================
        // CEK BOOKING LAIN PADA KAMAR
        //
        // Mencegah dua calon penghuni mengambil
        // kamar yang sama.
        // ==================================================

        const [otherBookingRows] =
            await connection.query(`
                SELECT

                    id,
                    tenant_id,
                    status

                FROM room_bookings

                WHERE room_id = ?

                AND id <> ?

                AND status IN (
                    'pending',
                    'approved'
                )

                LIMIT 1

                FOR UPDATE
            `, [

                booking.room_id,

                bookingId

            ]);


        if (
            otherBookingRows.length > 0
        ) {

            await connection.rollback();

            return res.status(409).json({

                success: false,

                message:
                    "Kamar sedang dalam proses booking oleh calon penghuni lain"

            });

        }


        // ==================================================
        // HITUNG HARGA BOOKING
        //
        // harga kamar / 30 × jumlah hari
        // ==================================================

        const roomPrice =
            Number(
                room.price
            );


        if (
            !Number.isFinite(roomPrice) ||
            roomPrice <= 0
        ) {

            await connection.rollback();

            return res.status(400).json({

                success: false,

                message:
                    "Harga kamar tidak valid"

            });

        }


        const dailyPrice =
            roomPrice / 30;


        const bookingAmount =
            Math.round(
                dailyPrice *
                bookingDays
            );


        // ==================================================
        // TENTUKAN WAKTU EXPIRED
        //
        // Booking mulai saat pembayaran dikirim.
        //
        // Contoh:
        //
        // 1 hari → expired 24 jam kemudian
        // 5 hari → expired 5 hari kemudian
        // 7 hari → expired 7 hari kemudian
        // ==================================================

        const bookingExpiredAt =
            new Date(
                Date.now() +
                (
                    bookingDays *
                    24 *
                    60 *
                    60 *
                    1000
                )
            );


        // ==================================================
        // CARI REKENING BCA ADELINA KOST
        //
        // Rekening:
        //
        // BCA
        // 2200940604
        // Prediansyah Pasaribu
        // ==================================================

        const [bankRows] =
            await connection.query(`
                SELECT

                    id,
                    bank_name,
                    account_number,
                    account_name,
                    is_active

                FROM bank_accounts

                WHERE bank_name = 'BCA'

                AND account_number = '2200940604'

                LIMIT 1

                FOR UPDATE
            `);


        if (
            bankRows.length === 0
        ) {

            await connection.rollback();

            return res.status(404).json({

                success: false,

                message:
                    "Rekening pembayaran BCA ADELINA KOST belum terdaftar di sistem"

            });

        }


        const bankAccount =
            bankRows[0];


        // ==================================================
        // CEK REKENING AKTIF
        // ==================================================

        if (
            Number(
                bankAccount.is_active
            ) !== 1
        ) {

            await connection.rollback();

            return res.status(400).json({

                success: false,

                message:
                    "Rekening pembayaran BCA sedang tidak aktif"

            });

        }


        // ==================================================
        // UPDATE BOOKING
        //
        // Simpan:
        //
        // booking_days
        // booking_amount
        // booking_expired_at
        // ==================================================

        await connection.query(`
            UPDATE room_bookings

            SET

                booking_days = ?,

                booking_amount = ?,

                booking_expired_at = ?

            WHERE id = ?

        `, [

            bookingDays,

            bookingAmount,

            bookingExpiredAt,

            bookingId

        ]);


        // ==================================================
        // UPDATE STATUS ROOM
        //
        // available → booked
        // ==================================================

        const [roomUpdateResult] =
            await connection.query(`
                UPDATE rooms

                SET
                    status = 'booked'

                WHERE id = ?

                AND status = 'available'

            `, [

                booking.room_id

            ]);


        if (
            roomUpdateResult.affectedRows !== 1
        ) {

            throw new Error(
                "Status kamar gagal diubah menjadi booked"
            );

        }


        // ==================================================
        // INSERT PAYMENT
        //
        // STATUS HARUS PENDING
        //
        // SALDO BANK BELUM BERTAMBAH.
        // ==================================================

        const [paymentResult] =
            await connection.query(`
                INSERT INTO payments
                (
                    bill_id,
                    booking_id,
                    bank_account_id,
                    payment_date,
                    amount,
                    payment_method,
                    status,
                    notes,
                    proof_file
                )

                VALUES
                (
                    NULL,
                    ?,
                    ?,
                    CURDATE(),
                    ?,
                    'transfer',
                    'pending',
                    ?,
                    ?
                )

            `, [

                bookingId,

                bankAccount.id,

                bookingAmount,

                `Pembayaran booking kamar ${room.room_number} selama ${bookingDays} hari`,

                proofFile

            ]);


        // ==================================================
        // COMMIT
        // ==================================================

        await connection.commit();


        // ==================================================
        // RESPONSE
        // ==================================================

        return res.status(201).json({

            success: true,

            message:
                "Pembayaran booking berhasil dikirim dan menunggu verifikasi admin",

            data: {

                payment_id:
                    paymentResult.insertId,

                booking_id:
                    bookingId,

                room_id:
                    booking.room_id,

                room_number:
                    room.room_number,

                booking_days:
                    bookingDays,

                booking_amount:
                    bookingAmount,

                booking_expired_at:
                    bookingExpiredAt,

                payment_method:
                    "transfer",

                bank_account: {

                    bank_name:
                        bankAccount.bank_name,

                    account_number:
                        bankAccount.account_number,

                    account_name:
                        bankAccount.account_name

                },

                status:
                    "pending",

                proof_file:
                    proofFile

            }

        });


    } catch (error) {

        // ==================================================
        // ROLLBACK
        // ==================================================

        if (
            connection
        ) {

            try {

                await connection.rollback();

            } catch (rollbackError) {

                console.error(
                    "Rollback Booking Payment Error:",
                    rollbackError
                );

            }

        }


        // ==================================================
        // HAPUS FILE JIKA DATABASE GAGAL
        // ==================================================

        if (
            uploadedFile
        ) {

            try {

                const fs =
                    require("fs");

                const path =
                    require("path");


                const filePath =
                    path.join(
                        __dirname,
                        "../../uploads/payment-proofs",
                        uploadedFile.filename
                    );


                if (
                    fs.existsSync(filePath)
                ) {

                    fs.unlinkSync(
                        filePath
                    );

                }

            } catch (fileError) {

                console.error(
                    "Delete Booking Payment Proof Error:",
                    fileError
                );

            }

        }


        console.error(
            "Create Booking Payment Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Gagal mengirim pembayaran booking",

            error:
                error.message

        });

    } finally {

        if (
            connection
        ) {

            connection.release();

        }

    }

};

// =====================================================
// VERIFY BOOKING PAYMENT
// PATCH /api/payments/booking/:id/verify
// =====================================================
//
// Khusus pembayaran booking kamar.
//
// Berbeda dengan verifyPayment() yang digunakan
// untuk pembayaran tagihan bulanan.
//
// Alur:
//
// payment pending
//      ↓
// payment verified
//      ↓
// booking approved
//      ↓
// saldo bank bertambah
//
// =====================================================

const verifyBookingPayment = async (
    req,
    res
) => {

    let connection = null;

    try {

        // =================================================
        // PAYMENT ID
        // =================================================

        const {
            id
        } = req.params;


        const paymentId =
            Number(id);


        if (
            !Number.isInteger(paymentId) ||
            paymentId <= 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "ID pembayaran booking tidak valid"

            });

        }


        // =================================================
        // CONNECTION
        // =================================================

        connection =
            await db.getConnection();


        await connection.beginTransaction();


        // =================================================
        // LOCK PAYMENT
        // =================================================

        const [paymentRows] =
            await connection.query(`
                SELECT

                    p.id,
                    p.booking_id,
                    p.bank_account_id,
                    p.amount,
                    p.payment_method,
                    p.status,
                    p.proof_file,

                    rb.tenant_id,
                    rb.room_id,
                    rb.booking_days,
                    rb.booking_amount,
                    rb.booking_expired_at,
                    rb.status AS booking_status

                FROM payments p

                INNER JOIN room_bookings rb
                    ON p.booking_id = rb.id

                WHERE p.id = ?

                AND p.booking_id IS NOT NULL

                LIMIT 1

                FOR UPDATE
            `, [

                paymentId

            ]);


        // =================================================
        // PAYMENT TIDAK DITEMUKAN
        // =================================================

        if (
            paymentRows.length === 0
        ) {

            await connection.rollback();

            return res.status(404).json({

                success: false,

                message:
                    "Pembayaran booking tidak ditemukan"

            });

        }


        const payment =
            paymentRows[0];


        // =================================================
        // PAYMENT HARUS PENDING
        // =================================================

        if (
            payment.status !== "pending"
        ) {

            await connection.rollback();

            return res.status(400).json({

                success: false,

                message:
                    `Pembayaran booking tidak dapat diverifikasi karena status saat ini adalah ${payment.status}`

            });

        }


        // =================================================
        // BOOKING HARUS PENDING
        // =================================================

        if (
            payment.booking_status !== "pending"
        ) {

            await connection.rollback();

            return res.status(400).json({

                success: false,

                message:
                    `Booking tidak dapat diverifikasi karena status saat ini adalah ${payment.booking_status}`

            });

        }


        // =================================================
        // VALIDASI PAYMENT
        // =================================================

        const paymentAmount =
            Number(
                payment.amount
            );


        if (
            !Number.isFinite(paymentAmount) ||
            paymentAmount <= 0
        ) {

            await connection.rollback();

            return res.status(400).json({

                success: false,

                message:
                    "Nominal pembayaran booking tidak valid"

            });

        }


        // =================================================
        // VALIDASI BOOKING AMOUNT
        // =================================================

        const bookingAmount =
            Number(
                payment.booking_amount
            );


        if (
            !Number.isFinite(bookingAmount) ||
            bookingAmount <= 0
        ) {

            await connection.rollback();

            return res.status(400).json({

                success: false,

                message:
                    "Nominal booking tidak valid"

            });

        }


        // =================================================
        // NOMINAL HARUS SESUAI
        // =================================================

        if (
            paymentAmount !==
            bookingAmount
        ) {

            await connection.rollback();

            return res.status(400).json({

                success: false,

                message:
                    "Nominal pembayaran tidak sesuai dengan nominal booking"

            });

        }


        // =================================================
        // VALIDASI TRANSFER
        // =================================================

        if (
            payment.payment_method !==
            "transfer"
        ) {

            await connection.rollback();

            return res.status(400).json({

                success: false,

                message:
                    "Pembayaran booking harus menggunakan metode transfer"

            });

        }


        // =================================================
        // BANK ACCOUNT WAJIB
        // =================================================

        const bankAccountId =
            Number(
                payment.bank_account_id
            );


        if (
            !Number.isInteger(bankAccountId) ||
            bankAccountId <= 0
        ) {

            await connection.rollback();

            return res.status(400).json({

                success: false,

                message:
                    "Rekening bank pembayaran tidak valid"

            });

        }


        // =================================================
        // LOCK BANK ACCOUNT
        // =================================================

        const bankAccount =
            await validateBankAccount(
                connection,
                bankAccountId
            );


        if (
            !bankAccount
        ) {

            await connection.rollback();

            return res.status(404).json({

                success: false,

                message:
                    "Rekening bank pembayaran tidak ditemukan"

            });

        }


        // =================================================
        // REKENING HARUS AKTIF
        // =================================================

        if (
            Number(
                bankAccount.is_active
            ) !== 1
        ) {

            await connection.rollback();

            return res.status(400).json({

                success: false,

                message:
                    "Rekening bank pembayaran tidak aktif"

            });

        }


        // =================================================
        // LOCK ROOM
        // =================================================

        const [roomRows] =
            await connection.query(`
                SELECT

                    id,
                    room_number,
                    price,
                    status

                FROM rooms

                WHERE id = ?

                LIMIT 1

                FOR UPDATE
            `, [

                payment.room_id

            ]);


        // =================================================
        // ROOM TIDAK DITEMUKAN
        // =================================================

        if (
            roomRows.length === 0
        ) {

            await connection.rollback();

            return res.status(404).json({

                success: false,

                message:
                    "Kamar booking tidak ditemukan"

            });

        }


        const room =
            roomRows[0];


        // =================================================
        // ROOM HARUS BOOKED
        //
        // createBookingPayment()
        // seharusnya sudah:
        //
        // available → booked
        //
        // Jadi ketika admin melakukan verifikasi,
        // status kamar WAJIB booked.
        // =================================================

        if (
            room.status !== "booked"
        ) {

            await connection.rollback();

            return res.status(409).json({

                success: false,

                message:
                    `Status kamar tidak sesuai. Status kamar saat ini: ${room.status}`

            });

        }


        // =================================================
        // UPDATE PAYMENT
        //
        // pending → verified
        // =================================================

        const [paymentUpdateResult] =
            await connection.query(`
                UPDATE payments

                SET
                    status = 'verified'

                WHERE id = ?

                AND status = 'pending'

            `, [

                paymentId

            ]);


        if (
            paymentUpdateResult.affectedRows !== 1
        ) {

            throw new Error(
                "Status pembayaran gagal diubah menjadi verified"
            );

        }


        // =================================================
        // TAMBAH SALDO BANK
        //
        // Pembayaran sudah diverifikasi admin.
        // =================================================

        const [balanceResult] =
            await connection.query(`
                UPDATE bank_accounts

                SET
                    current_balance =
                        COALESCE(
                            current_balance,
                            0
                        ) + ?

                WHERE id = ?

            `, [

                paymentAmount,

                bankAccountId

            ]);


        if (
            balanceResult.affectedRows !== 1
        ) {

            throw new Error(
                "Saldo rekening bank gagal diperbarui"
            );

        }


        // =================================================
        // UPDATE BOOKING
        //
        // pending → approved
        // =================================================

        const [bookingUpdateResult] =
            await connection.query(`
                UPDATE room_bookings

                SET
                    status = 'approved'

                WHERE id = ?

                AND status = 'pending'

            `, [

                payment.booking_id

            ]);


        if (
            bookingUpdateResult.affectedRows !== 1
        ) {

            throw new Error(
                "Status booking gagal diubah menjadi approved"
            );

        }


        // =================================================
        // UPDATE ROOM
        //
        // booked → occupied
        //
        // Pembayaran booking sudah diverifikasi
        // sehingga kamar resmi menjadi terisi.
        // =================================================

        const [roomUpdateResult] =
            await connection.query(`
        UPDATE rooms

        SET
            status = 'booked'

        WHERE id = ?

    `, [

                payment.room_id

            ]);


        if (
            roomUpdateResult.affectedRows !== 1
        ) {

            throw new Error(
                "Status kamar gagal diperbarui menjadi booked"
            );

        }


        // =================================================
        // COMMIT
        // =================================================

        await connection.commit();


        // =================================================
        // RESPONSE
        // =================================================

        return res.status(200).json({

            success: true,

            message:
                "Pembayaran booking berhasil diverifikasi, booking disetujui, kamar menjadi terisi, dan saldo bank bertambah.",

            data: {

                payment_id:
                    paymentId,

                booking_id:
                    payment.booking_id,

                room_id:
                    payment.room_id,

                room_number:
                    room.room_number,

                amount:
                    paymentAmount,

                payment_status:
                    "verified",

                booking_status:
                    "approved",

                room_status:
                    "occupied",

                bank_account: {

                    bank_name:
                        bankAccount.bank_name,

                    account_number:
                        bankAccount.account_number,

                    account_name:
                        bankAccount.account_name

                }

            }

        });


    } catch (error) {

        // =================================================
        // ROLLBACK
        // =================================================

        if (
            connection
        ) {

            try {

                await connection.rollback();

            } catch (rollbackError) {

                console.error(
                    "Rollback Booking Verification Error:",
                    rollbackError
                );

            }

        }


        // =================================================
        // LOG ERROR
        // =================================================

        console.error(
            "Verify Booking Payment Error:",
            error
        );


        // =================================================
        // RESPONSE ERROR
        // =================================================

        return res.status(500).json({

            success: false,

            message:
                "Gagal memverifikasi pembayaran booking",

            error:
                error.message

        });


    } finally {

        // =================================================
        // RELEASE CONNECTION
        // =================================================

        if (
            connection
        ) {

            connection.release();

        }

    }

};

const verifyPayment = async (
    req,
    res
) => {

    let connection = null;


    try {

        const {
            id
        } = req.params;


        const paymentId =
            Number(id);


        // ==================================================
        // VALIDASI ID
        // ==================================================

        if (
            !Number.isInteger(paymentId) ||
            paymentId <= 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "ID pembayaran tidak valid"

            });

        }


        // ==================================================
        // CONNECTION
        // ==================================================

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

                LIMIT 1

                FOR UPDATE
            `, [
                paymentId
            ]);


        if (
            paymentRows.length === 0
        ) {

            await connection.rollback();

            return res.status(404).json({

                success: false,

                message:
                    "Pembayaran tidak ditemukan"

            });

        }


        const payment =
            paymentRows[0];


        // ==================================================
        // PAYMENT HARUS PENDING
        // ==================================================

        if (
            payment.status !== "pending"
        ) {

            await connection.rollback();

            return res.status(400).json({

                success: false,

                message:
                    `Pembayaran tidak dapat diverifikasi karena status saat ini adalah ${payment.status}`

            });

        }


        const billId =
            Number(
                payment.bill_id
            );


        const paymentAmount =
            Number(
                payment.amount
            );


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
        // LOCK BILL
        // ==================================================

        const [billRows] =
            await connection.query(`
                SELECT
                    *
                FROM bills

                WHERE id = ?

                LIMIT 1

                FOR UPDATE
            `, [
                billId
            ]);


        if (
            billRows.length === 0
        ) {

            await connection.rollback();

            return res.status(404).json({

                success: false,

                message:
                    "Tagihan pembayaran tidak ditemukan"

            });

        }


        const bill =
            billRows[0];


        // ==================================================
        // HITUNG PAYMENT VERIFIED LAIN
        //
        // PAYMENT YANG SEDANG DIVERIFIKASI
        // MASIH PENDING, JADI BELUM DIHITUNG.
        // ==================================================

        const [paidRows] =
            await connection.query(`
                SELECT

                    COALESCE(
                        SUM(amount),
                        0
                    ) AS total_paid

                FROM payments

                WHERE bill_id = ?

                AND status = 'verified'
            `, [
                billId
            ]);


        const totalVerified =
            Number(
                paidRows[0].total_paid || 0
            );


        const remainingAmount =
            Number(bill.amount) -
            totalVerified;


        // ==================================================
        // PAYMENT TIDAK BOLEH MELEBIHI SISA BILL
        // ==================================================

        if (
            paymentAmount >
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
        // VALIDASI TRANSFER
        // ==================================================

        if (
            paymentMethod === "transfer"
        ) {

            if (
                !bankAccountId
            ) {

                await connection.rollback();

                return res.status(400).json({

                    success: false,

                    message:
                        "Pembayaran transfer tidak memiliki rekening bank"

                });

            }


            // ==================================================
            // LOCK BANK ACCOUNT
            // ==================================================

            const bankAccount =
                await validateBankAccount(
                    connection,
                    bankAccountId
                );


            if (
                !bankAccount
            ) {

                await connection.rollback();

                return res.status(404).json({

                    success: false,

                    message:
                        "Rekening bank pembayaran tidak ditemukan"

                });

            }


            if (
                Number(
                    bankAccount.is_active
                ) !== 1
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
        // UPDATE PAYMENT
        //
        // pending → verified
        // ==================================================

        await connection.query(`
            UPDATE payments

            SET
                status = 'verified'

            WHERE id = ?
        `, [
            paymentId
        ]);


        // ==================================================
        // TAMBAHKAN SALDO BANK
        //
        // HANYA TRANSFER
        //
        // CASH TIDAK MASUK SALDO BANK
        // ==================================================

        if (
            paymentMethod === "transfer"
        ) {

            const [balanceResult] =
                await connection.query(`
                    UPDATE bank_accounts

                    SET
                        current_balance =
                            COALESCE(
                                current_balance,
                                0
                            ) + ?

                    WHERE id = ?
                `, [
                    paymentAmount,
                    bankAccountId
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
                billId,
                connection
            );


        // ==================================================
        // BUAT NEXT BILL
        //
        // HANYA JIKA BILL SUDAH LUNAS
        // ==================================================

        let nextBill = null;


        if (
            statusResult.isPaid
        ) {

            nextBill =
                await createNextBill(
                    billId,
                    connection
                );

        }


        // ==================================================
        // COMMIT
        // ==================================================

        await connection.commit();


        // ==================================================
        // AMBIL DATA PAYMENT TERBARU
        // ==================================================

        const [rows] =
            await db.query(`
                ${paymentSelect}

                WHERE p.id = ?
            `, [
                paymentId
            ]);


        // ==================================================
        // RESPONSE
        // ==================================================

        return res.status(200).json({

            success: true,

            message:
                statusResult.isPaid

                    ? "Pembayaran berhasil diverifikasi, saldo bank bertambah, tagihan lunas, dan tagihan berikutnya dibuat."

                    : "Pembayaran berhasil diverifikasi dan saldo bank disesuaikan.",

            data:
                rows[0],

            bill_status:
                statusResult.newStatus,

            next_bill:
                nextBill

        });


    } catch (error) {

        if (
            connection
        ) {

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
            "Verify Payment Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Gagal memverifikasi pembayaran",

            error:
                error.message

        });


    } finally {

        if (
            connection
        ) {

            connection.release();

        }

    }

};
// ======================================================
// REJECT PAYMENT
//
// PATCH /api/payments/:id/reject
//
// ADMIN
//
// Alur:
//
// pending
//    ↓
// rejected
//
// PENTING:
//
// - Saldo bank TIDAK berubah
// - Bill TIDAK menjadi paid
// - Tidak membuat next bill
// - Tenant bisa melakukan pembayaran ulang
// ======================================================

const rejectPayment = async (
    req,
    res
) => {

    let connection = null;


    try {

        const {
            id
        } = req.params;


        const paymentId =
            Number(id);


        // ==================================================
        // VALIDASI ID
        // ==================================================

        if (
            !Number.isInteger(paymentId) ||
            paymentId <= 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "ID pembayaran tidak valid"

            });

        }


        // ==================================================
        // CONNECTION
        // ==================================================

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

                LIMIT 1

                FOR UPDATE
            `, [
                paymentId
            ]);


        // ==================================================
        // PAYMENT TIDAK DITEMUKAN
        // ==================================================

        if (
            paymentRows.length === 0
        ) {

            await connection.rollback();

            return res.status(404).json({

                success: false,

                message:
                    "Pembayaran tidak ditemukan"

            });

        }


        const payment =
            paymentRows[0];


        // ==================================================
        // PAYMENT HARUS PENDING
        // ==================================================

        if (
            payment.status !== "pending"
        ) {

            await connection.rollback();

            return res.status(400).json({

                success: false,

                message:
                    `Pembayaran tidak dapat ditolak karena status saat ini adalah ${payment.status}`

            });

        }


        // ==================================================
        // BILL HARUS ADA
        // ==================================================

        const billId =
            Number(
                payment.bill_id
            );


        const [billRows] =
            await connection.query(`
                SELECT
                    *
                FROM bills

                WHERE id = ?

                LIMIT 1

                FOR UPDATE
            `, [
                billId
            ]);


        if (
            billRows.length === 0
        ) {

            await connection.rollback();

            return res.status(404).json({

                success: false,

                message:
                    "Tagihan pembayaran tidak ditemukan"

            });

        }


        // ==================================================
        // CATAT ALASAN PENOLAKAN
        //
        // notes lama tetap dipertahankan jika
        // admin tidak mengirim alasan.
        // ==================================================

        const {
            notes
        } = req.body;


        const rejectionNotes =
            notes !== undefined &&
                notes !== null &&
                String(notes).trim() !== ""

                ? String(notes).trim()

                : payment.notes;


        // ==================================================
        // UPDATE PAYMENT
        //
        // pending → rejected
        // ==================================================

        await connection.query(`
            UPDATE payments

            SET
                status = 'rejected',
                notes = ?

            WHERE id = ?
        `, [

            rejectionNotes,

            paymentId

        ]);

        // =================================================
        // UPDATE STATUS ROOM
        // =================================================
        //
        // Setelah pembayaran booking diverifikasi,
        // kamar dipastikan berstatus booked.
        //

        if (
            room.status !== "booked"
        ) {

            const [roomUpdateResult] =
                await connection.query(`
            UPDATE rooms

            SET
                status = 'booked'

            WHERE id = ?

        `, [

                    payment.room_id

                ]);


            if (
                roomUpdateResult.affectedRows !== 1
            ) {

                throw new Error(
                    "Status kamar gagal diubah menjadi booked"
                );

            }

        }


        // ==================================================
        // JANGAN UPDATE SALDO BANK
        //
        // JANGAN:
        //
        // UPDATE bank_accounts
        //
        // Karena pembayaran ditolak.
        // ==================================================


        // ==================================================
        // JANGAN UPDATE BILL KE PAID
        //
        // Bill tetap unpaid.
        // ==================================================


        // ==================================================
        // COMMIT
        // ==================================================

        await connection.commit();


        // ==================================================
        // AMBIL DATA PAYMENT TERBARU
        // ==================================================

        const [rows] =
            await db.query(`
                ${paymentSelect}

                WHERE p.id = ?
            `, [
                paymentId
            ]);


        // ==================================================
        // RESPONSE
        // ==================================================

        return res.status(200).json({

            success: true,

            message:
                "Pembayaran berhasil ditolak",

            data:
                rows[0],

            bill_status:
                "unpaid"

        });


    } catch (error) {


        // ==================================================
        // ROLLBACK
        // ==================================================

        if (
            connection
        ) {

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
            "Reject Payment Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Gagal menolak pembayaran",

            error:
                error.message

        });


    } finally {


        if (
            connection
        ) {

            connection.release();

        }

    }

};


// ======================================================
// EXPORT
// ======================================================

// ======================================================
// EXPORT
// ======================================================

module.exports = {

    getPayments,

    getPaymentById,

    getMyPayments,

    createPayment,

    createTenantPayment,

    verifyPayment,

    rejectPayment,

    updatePayment,

    deletePayment,

    getPaymentSummary,

    createBookingPayment,

    verifyBookingPayment

};