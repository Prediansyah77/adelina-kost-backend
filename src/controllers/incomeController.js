const db = require("../config/database");

// ======================================================
// GET ALL INCOMES
// GET /api/incomes
// ======================================================
const getIncomes = async (req, res) => {
    try {
        const [incomes] = await db.query(`
            SELECT
                i.id,
                i.income_date,
                i.category,
                i.description,
                i.amount,
                i.payment_method,
                i.reference_number,
                i.notes,
                i.bank_account_id,

                ba.bank_name,
                ba.account_name,
                ba.account_number,

                i.created_at,
                i.updated_at

            FROM incomes i

            LEFT JOIN bank_accounts ba
                ON i.bank_account_id = ba.id

            ORDER BY
                i.income_date DESC,
                i.id DESC
        `);

        res.json({
            success: true,
            data: incomes
        });

    } catch (error) {
        console.error("Get Incomes Error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil data pemasukan",
            error: error.message
        });
    }
};


// ======================================================
// GET INCOME BY ID
// GET /api/incomes/:id
// ======================================================
const getIncomeById = async (req, res) => {
    try {
        const { id } = req.params;

        const [incomes] = await db.query(`
            SELECT
                i.id,
                i.income_date,
                i.category,
                i.description,
                i.amount,
                i.payment_method,
                i.reference_number,
                i.notes,
                i.bank_account_id,

                ba.bank_name,
                ba.account_name,
                ba.account_number,

                i.created_at,
                i.updated_at

            FROM incomes i

            LEFT JOIN bank_accounts ba
                ON i.bank_account_id = ba.id

            WHERE i.id = ?
        `, [id]);

        if (incomes.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Data pemasukan tidak ditemukan"
            });
        }

        res.json({
            success: true,
            data: incomes[0]
        });

    } catch (error) {
        console.error("Get Income By ID Error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil data pemasukan",
            error: error.message
        });
    }
};


// ======================================================
// CREATE INCOME
// POST /api/incomes
// ======================================================
const createIncome = async (req, res) => {
    const connection = await db.getConnection();

    try {
        const {
            income_date,
            category,
            description,
            amount,
            payment_method,
            reference_number,
            notes,
            bank_account_id
        } = req.body;


        // ==================================================
        // VALIDASI WAJIB
        // ==================================================

        if (
            !income_date ||
            !category ||
            !amount ||
            !bank_account_id
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Tanggal, kategori, jumlah pemasukan, dan rekening wajib diisi"
            });
        }


        // ==================================================
        // VALIDASI AMOUNT
        // ==================================================

        const amountNumber = Number(amount);

        if (
            Number.isNaN(amountNumber) ||
            amountNumber <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Jumlah pemasukan harus berupa angka lebih dari 0"
            });
        }


        // ==================================================
        // CEK REKENING
        // ==================================================

        const [bankRows] = await connection.query(`
            SELECT
                id,
                bank_name,
                account_name,
                account_number,
                current_balance,
                is_active

            FROM bank_accounts

            WHERE id = ?

            LIMIT 1
        `, [bank_account_id]);


        if (bankRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Rekening bank tidak ditemukan"
            });
        }


        const bankAccount = bankRows[0];


        // ==================================================
        // CEK REKENING AKTIF
        // ==================================================

        if (Number(bankAccount.is_active) !== 1) {
            return res.status(400).json({
                success: false,
                message:
                    "Rekening bank yang dipilih sudah tidak aktif"
            });
        }


        // ==================================================
        // MULAI TRANSACTION
        // ==================================================

        await connection.beginTransaction();


        // ==================================================
        // INSERT INCOME
        // ==================================================

        const [result] = await connection.query(`
            INSERT INTO incomes
            (
                income_date,
                category,
                description,
                amount,
                payment_method,
                reference_number,
                notes,
                bank_account_id
            )

            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            income_date,
            category,
            description || null,
            amountNumber,
            payment_method || null,
            reference_number || null,
            notes || null,
            bank_account_id
        ]);


        // ==================================================
        // TAMBAH SALDO REKENING
        // ==================================================

        await connection.query(`
            UPDATE bank_accounts

            SET
                current_balance =
                    current_balance + ?

            WHERE id = ?
        `, [
            amountNumber,
            bank_account_id
        ]);


        // ==================================================
        // COMMIT
        // ==================================================

        await connection.commit();


        // ==================================================
        // AMBIL DATA BARU
        // ==================================================

        const [income] = await db.query(`
            SELECT
                i.id,
                i.income_date,
                i.category,
                i.description,
                i.amount,
                i.payment_method,
                i.reference_number,
                i.notes,
                i.bank_account_id,

                ba.bank_name,
                ba.account_name,
                ba.account_number,

                i.created_at,
                i.updated_at

            FROM incomes i

            LEFT JOIN bank_accounts ba
                ON i.bank_account_id = ba.id

            WHERE i.id = ?
        `, [result.insertId]);


        res.status(201).json({
            success: true,
            message:
                "Pemasukan berhasil ditambahkan dan saldo rekening diperbarui",
            data: income[0]
        });


    } catch (error) {

        await connection.rollback();

        console.error(
            "Create Income Error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Gagal menambahkan pemasukan",
            error:
                error.message
        });

    } finally {

        connection.release();

    }
};


// ======================================================
// UPDATE INCOME
// PUT /api/incomes/:id
// ======================================================
const updateIncome = async (req, res) => {

    const connection = await db.getConnection();

    try {

        const { id } = req.params;

        const {
            income_date,
            category,
            description,
            amount,
            payment_method,
            reference_number,
            notes,
            bank_account_id
        } = req.body;


        // ==================================================
        // CEK DATA LAMA
        // ==================================================

        const [existing] = await connection.query(`
            SELECT *
            FROM incomes
            WHERE id = ?
            LIMIT 1
        `, [id]);


        if (existing.length === 0) {

            return res.status(404).json({
                success: false,
                message:
                    "Data pemasukan tidak ditemukan"
            });

        }


        const oldIncome = existing[0];


        // ==================================================
        // VALIDASI
        // ==================================================

        if (
            !income_date ||
            !category ||
            !amount ||
            !bank_account_id
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Tanggal, kategori, jumlah pemasukan, dan rekening wajib diisi"
            });

        }


        const amountNumber =
            Number(amount);


        if (
            Number.isNaN(amountNumber) ||
            amountNumber <= 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Jumlah pemasukan harus berupa angka lebih dari 0"
            });

        }


        // ==================================================
        // CEK REKENING BARU
        // ==================================================

        const [bankRows] = await connection.query(`
            SELECT
                id,
                current_balance,
                is_active

            FROM bank_accounts

            WHERE id = ?

            LIMIT 1
        `, [bank_account_id]);


        if (bankRows.length === 0) {

            return res.status(404).json({
                success: false,
                message:
                    "Rekening bank tidak ditemukan"
            });

        }


        if (Number(bankRows[0].is_active) !== 1) {

            return res.status(400).json({
                success: false,
                message:
                    "Rekening bank yang dipilih sudah tidak aktif"
            });

        }


        // ==================================================
        // MULAI TRANSACTION
        // ==================================================

        await connection.beginTransaction();


        // ==================================================
        // KEMBALIKAN SALDO REKENING LAMA
        // ==================================================

        await connection.query(`
            UPDATE bank_accounts

            SET
                current_balance =
                    current_balance - ?

            WHERE id = ?
        `, [
            Number(oldIncome.amount),
            oldIncome.bank_account_id
        ]);


        // ==================================================
        // TAMBAHKAN KE REKENING BARU
        // ==================================================

        await connection.query(`
            UPDATE bank_accounts

            SET
                current_balance =
                    current_balance + ?

            WHERE id = ?
        `, [
            amountNumber,
            bank_account_id
        ]);


        // ==================================================
        // UPDATE INCOME
        // ==================================================

        await connection.query(`
            UPDATE incomes

            SET
                income_date = ?,
                category = ?,
                description = ?,
                amount = ?,
                payment_method = ?,
                reference_number = ?,
                notes = ?,
                bank_account_id = ?

            WHERE id = ?
        `, [
            income_date,
            category,
            description || null,
            amountNumber,
            payment_method || null,
            reference_number || null,
            notes || null,
            bank_account_id,
            id
        ]);


        // ==================================================
        // COMMIT
        // ==================================================

        await connection.commit();


        // ==================================================
        // AMBIL DATA TERBARU
        // ==================================================

        const [income] = await db.query(`
            SELECT
                i.id,
                i.income_date,
                i.category,
                i.description,
                i.amount,
                i.payment_method,
                i.reference_number,
                i.notes,
                i.bank_account_id,

                ba.bank_name,
                ba.account_name,
                ba.account_number,

                i.created_at,
                i.updated_at

            FROM incomes i

            LEFT JOIN bank_accounts ba
                ON i.bank_account_id = ba.id

            WHERE i.id = ?
        `, [id]);


        res.json({
            success: true,
            message:
                "Pemasukan berhasil diperbarui dan saldo rekening disesuaikan",
            data: income[0]
        });


    } catch (error) {

        await connection.rollback();

        console.error(
            "Update Income Error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Gagal memperbarui pemasukan",
            error:
                error.message
        });

    } finally {

        connection.release();

    }
};


// ======================================================
// GET INCOME SUMMARY
// GET /api/incomes/summary?month=8&year=2026
// ======================================================
const getIncomeSummary = async (req, res) => {

    try {

        const {
            month,
            year
        } = req.query;


        // ==================================================
        // VALIDASI PARAMETER
        // ==================================================

        if (!month || !year) {

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


        // ==================================================
        // VALIDASI BULAN
        // ==================================================

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


        // ==================================================
        // VALIDASI TAHUN
        // ==================================================

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
        // SUMMARY
        // ==================================================

        const [summary] = await db.query(`
            SELECT

                COUNT(*) AS total_transactions,

                COALESCE(
                    SUM(amount),
                    0
                ) AS total_amount,

                COALESCE(
                    SUM(
                        CASE
                            WHEN category = 'Sewa Kamar'
                            THEN amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS room_rent_amount

            FROM incomes

            WHERE MONTH(income_date) = ?
            AND YEAR(income_date) = ?
        `, [
            monthNumber,
            yearNumber
        ]);


        // ==================================================
        // SUMMARY PER KATEGORI
        // ==================================================

        const [categories] = await db.query(`
            SELECT
                category,

                COUNT(*) AS transaction_count,

                COALESCE(
                    SUM(amount),
                    0
                ) AS total_amount

            FROM incomes

            WHERE MONTH(income_date) = ?
            AND YEAR(income_date) = ?

            GROUP BY category

            ORDER BY total_amount DESC
        `, [
            monthNumber,
            yearNumber
        ]);


        // ==================================================
        // RESPONSE
        // ==================================================

        res.json({
            success: true,

            data: {

                period: {
                    month: monthNumber,
                    year: yearNumber
                },

                summary: {

                    total_transactions:
                        Number(
                            summary[0]
                                .total_transactions
                        ) || 0,

                    total_amount:
                        Number(
                            summary[0]
                                .total_amount
                        ) || 0,

                    room_rent_amount:
                        Number(
                            summary[0]
                                .room_rent_amount
                        ) || 0

                },

                categories:
                    categories.map((item) => ({

                        category:
                            item.category,

                        transaction_count:
                            Number(
                                item.transaction_count
                            ) || 0,

                        total_amount:
                            Number(
                                item.total_amount
                            ) || 0

                    }))

            }
        });


    } catch (error) {

        console.error(
            "Income Summary Error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Gagal mengambil summary pemasukan",
            error:
                error.message
        });

    }
};


// ======================================================
// DELETE INCOME
// DELETE /api/incomes/:id
// ======================================================
const deleteIncome = async (req, res) => {

    const connection = await db.getConnection();

    try {

        const { id } = req.params;


        // ==================================================
        // CEK DATA
        // ==================================================

        const [existing] = await connection.query(`
            SELECT
                id,
                amount,
                bank_account_id

            FROM incomes

            WHERE id = ?

            LIMIT 1
        `, [id]);


        if (existing.length === 0) {

            return res.status(404).json({
                success: false,
                message:
                    "Data pemasukan tidak ditemukan"
            });

        }


        const income =
            existing[0];


        // ==================================================
        // MULAI TRANSACTION
        // ==================================================

        await connection.beginTransaction();


        // ==================================================
        // KURANGI KEMBALI SALDO REKENING
        // ==================================================

        await connection.query(`
            UPDATE bank_accounts

            SET
                current_balance =
                    current_balance - ?

            WHERE id = ?
        `, [
            Number(income.amount),
            income.bank_account_id
        ]);


        // ==================================================
        // DELETE INCOME
        // ==================================================

        await connection.query(`
            DELETE FROM incomes

            WHERE id = ?
        `, [id]);


        // ==================================================
        // COMMIT
        // ==================================================

        await connection.commit();


        res.json({
            success: true,
            message:
                "Pemasukan berhasil dihapus dan saldo rekening diperbarui"
        });


    } catch (error) {

        await connection.rollback();

        console.error(
            "Delete Income Error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Gagal menghapus pemasukan",
            error:
                error.message
        });

    } finally {

        connection.release();

    }
};


// ======================================================
// EXPORT
// ======================================================
module.exports = {

    getIncomes,

    getIncomeById,

    createIncome,

    updateIncome,

    deleteIncome,

    getIncomeSummary

};