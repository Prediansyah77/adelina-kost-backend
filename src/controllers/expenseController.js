const db = require("../config/database");

// =====================================================
// GET ALL EXPENSES
// GET /api/expenses
// =====================================================
const getExpenses = async (req, res) => {
    try {
        const [expenses] = await db.query(`
            SELECT
                e.id,
                e.expense_date,
                e.category,
                e.description,
                e.amount,
                e.bank_account_id,
                ba.bank_name,
                ba.account_name,
                ba.account_number,
                e.created_at
            FROM expenses e

            LEFT JOIN bank_accounts ba
                ON e.bank_account_id = ba.id

            ORDER BY
                e.expense_date DESC,
                e.id DESC
        `);

        res.json({
            success: true,
            data: expenses
        });

    } catch (error) {
        console.error("Get Expenses Error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil data pengeluaran",
            error: error.message
        });
    }
};


// =====================================================
// GET EXPENSE BY ID
// GET /api/expenses/:id
// =====================================================
const getExpenseById = async (req, res) => {
    try {
        const { id } = req.params;

        const [expenses] = await db.query(`
            SELECT
                e.id,
                e.expense_date,
                e.category,
                e.description,
                e.amount,
                e.bank_account_id,
                ba.bank_name,
                ba.account_name,
                ba.account_number,
                e.created_at
            FROM expenses e

            LEFT JOIN bank_accounts ba
                ON e.bank_account_id = ba.id

            WHERE e.id = ?
        `, [id]);

        if (expenses.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Pengeluaran tidak ditemukan"
            });
        }

        res.json({
            success: true,
            data: expenses[0]
        });

    } catch (error) {
        console.error("Get Expense Error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil data pengeluaran",
            error: error.message
        });
    }
};


// =====================================================
// CREATE EXPENSE
// POST /api/expenses
//
// Saat pengeluaran dibuat:
// saldo rekening otomatis BERKURANG
// =====================================================
const createExpense = async (req, res) => {

    const connection = await db.getConnection();

    try {

        const {
            expense_date,
            category,
            description,
            amount,
            bank_account_id
        } = req.body;


        // =================================================
        // VALIDASI DATA
        // =================================================

        if (
            !expense_date ||
            !category ||
            !amount ||
            !bank_account_id
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Tanggal, kategori, jumlah pengeluaran, dan rekening wajib diisi"
            });
        }


        // =================================================
        // VALIDASI AMOUNT
        // =================================================

        const expenseAmount = Number(amount);

        if (
            Number.isNaN(expenseAmount) ||
            expenseAmount <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Jumlah pengeluaran harus lebih dari 0"
            });
        }


        // =================================================
        // MULAI TRANSACTION
        // =================================================

        await connection.beginTransaction();


        // =================================================
        // CEK REKENING
        // =================================================

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
            FOR UPDATE
        `, [bank_account_id]);


        if (bankRows.length === 0) {

            await connection.rollback();

            return res.status(404).json({
                success: false,
                message:
                    "Rekening bank tidak ditemukan"
            });

        }


        const bankAccount = bankRows[0];


        // =================================================
        // CEK REKENING AKTIF
        // =================================================

        if (Number(bankAccount.is_active) !== 1) {

            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "Rekening bank sudah tidak aktif"
            });

        }


        // =================================================
        // CEK SALDO
        // =================================================

        const currentBalance =
            Number(bankAccount.current_balance || 0);


        if (expenseAmount > currentBalance) {

            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    `Saldo rekening tidak mencukupi. Saldo saat ini: ${currentBalance}`
            });

        }


        // =================================================
        // INSERT EXPENSE
        // =================================================

        const [result] = await connection.query(`
            INSERT INTO expenses
            (
                expense_date,
                category,
                description,
                amount,
                bank_account_id
            )
            VALUES (?, ?, ?, ?, ?)
        `, [
            expense_date,
            category,
            description || null,
            expenseAmount,
            bank_account_id
        ]);


        // =================================================
        // KURANGI SALDO REKENING
        // =================================================

        await connection.query(`
            UPDATE bank_accounts
            SET
                current_balance =
                    current_balance - ?
            WHERE id = ?
        `, [
            expenseAmount,
            bank_account_id
        ]);


        // =================================================
        // AMBIL DATA EXPENSE TERBARU
        // =================================================

        const [expenseRows] = await connection.query(`
            SELECT
                e.id,
                e.expense_date,
                e.category,
                e.description,
                e.amount,
                e.bank_account_id,
                ba.bank_name,
                ba.account_name,
                ba.account_number,
                e.created_at
            FROM expenses e

            LEFT JOIN bank_accounts ba
                ON e.bank_account_id = ba.id

            WHERE e.id = ?
        `, [result.insertId]);


        // =================================================
        // COMMIT
        // =================================================

        await connection.commit();


        res.status(201).json({
            success: true,
            message:
                "Pengeluaran berhasil ditambahkan dan saldo rekening diperbarui",
            data: expenseRows[0]
        });


    } catch (error) {

        await connection.rollback();

        console.error(
            "Create Expense Error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Gagal menambahkan pengeluaran",
            error:
                error.message
        });

    } finally {

        connection.release();

    }
};


// =====================================================
// UPDATE EXPENSE
// PUT /api/expenses/:id
//
// Saat edit:
//
// Saldo rekening lama dikembalikan
// +
// Saldo rekening baru dikurangi
//
// Contoh:
//
// Pengeluaran lama:
// BCA - Rp500.000
//
// Diubah menjadi:
// BCA - Rp700.000
//
// Sistem:
// + Rp500.000
// - Rp700.000
//
// Hasil:
// saldo berkurang Rp200.000
// =====================================================
const updateExpense = async (req, res) => {

    const connection = await db.getConnection();

    try {

        const { id } = req.params;

        const {
            expense_date,
            category,
            description,
            amount,
            bank_account_id
        } = req.body;


        // =================================================
        // VALIDASI
        // =================================================

        if (
            !expense_date ||
            !category ||
            !amount ||
            !bank_account_id
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Tanggal, kategori, jumlah pengeluaran, dan rekening wajib diisi"
            });
        }


        // =================================================
        // VALIDASI AMOUNT
        // =================================================

        const newAmount = Number(amount);

        if (
            Number.isNaN(newAmount) ||
            newAmount <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Jumlah pengeluaran harus lebih dari 0"
            });
        }


        // =================================================
        // MULAI TRANSACTION
        // =================================================

        await connection.beginTransaction();


        // =================================================
        // AMBIL EXPENSE LAMA
        // =================================================

        const [expenseRows] = await connection.query(`
            SELECT
                id,
                amount,
                bank_account_id
            FROM expenses
            WHERE id = ?
            FOR UPDATE
        `, [id]);


        if (expenseRows.length === 0) {

            await connection.rollback();

            return res.status(404).json({
                success: false,
                message:
                    "Pengeluaran tidak ditemukan"
            });

        }


        const oldExpense =
            expenseRows[0];


        const oldAmount =
            Number(oldExpense.amount || 0);


        const oldBankAccountId =
            oldExpense.bank_account_id;


        // =================================================
        // AMBIL REKENING LAMA
        // =================================================

        const [oldBankRows] = await connection.query(`
            SELECT
                id,
                current_balance,
                is_active
            FROM bank_accounts
            WHERE id = ?
            FOR UPDATE
        `, [oldBankAccountId]);


        if (oldBankRows.length === 0) {

            await connection.rollback();

            return res.status(404).json({
                success: false,
                message:
                    "Rekening lama pada pengeluaran tidak ditemukan"
            });

        }


        // =================================================
        // KEMBALIKAN SALDO REKENING LAMA
        // =================================================

        await connection.query(`
            UPDATE bank_accounts
            SET
                current_balance =
                    current_balance + ?
            WHERE id = ?
        `, [
            oldAmount,
            oldBankAccountId
        ]);


        // =================================================
        // CEK REKENING BARU
        // =================================================

        const [newBankRows] = await connection.query(`
            SELECT
                id,
                bank_name,
                account_name,
                account_number,
                current_balance,
                is_active
            FROM bank_accounts
            WHERE id = ?
            FOR UPDATE
        `, [bank_account_id]);


        if (newBankRows.length === 0) {

            await connection.rollback();

            return res.status(404).json({
                success: false,
                message:
                    "Rekening baru tidak ditemukan"
            });

        }


        const newBankAccount =
            newBankRows[0];


        // =================================================
        // CEK REKENING BARU AKTIF
        // =================================================

        if (
            Number(newBankAccount.is_active) !== 1
        ) {

            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "Rekening baru sudah tidak aktif"
            });

        }


        // =================================================
        // CEK SALDO REKENING BARU
        // =================================================

        const newCurrentBalance =
            Number(
                newBankAccount.current_balance || 0
            );


        if (newAmount > newCurrentBalance) {

            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    `Saldo rekening tidak mencukupi. Saldo saat ini: ${newCurrentBalance}`
            });

        }


        // =================================================
        // UPDATE EXPENSE
        // =================================================

        await connection.query(`
            UPDATE expenses
            SET
                expense_date = ?,
                category = ?,
                description = ?,
                amount = ?,
                bank_account_id = ?
            WHERE id = ?
        `, [
            expense_date,
            category,
            description || null,
            newAmount,
            bank_account_id,
            id
        ]);


        // =================================================
        // KURANGI SALDO REKENING BARU
        // =================================================

        await connection.query(`
            UPDATE bank_accounts
            SET
                current_balance =
                    current_balance - ?
            WHERE id = ?
        `, [
            newAmount,
            bank_account_id
        ]);


        // =================================================
        // AMBIL DATA TERBARU
        // =================================================

        const [updatedExpense] =
            await connection.query(`
                SELECT
                    e.id,
                    e.expense_date,
                    e.category,
                    e.description,
                    e.amount,
                    e.bank_account_id,
                    ba.bank_name,
                    ba.account_name,
                    ba.account_number,
                    e.created_at
                FROM expenses e

                LEFT JOIN bank_accounts ba
                    ON e.bank_account_id = ba.id

                WHERE e.id = ?
            `, [id]);


        // =================================================
        // COMMIT
        // =================================================

        await connection.commit();


        res.json({
            success: true,
            message:
                "Pengeluaran berhasil diperbarui dan saldo rekening disesuaikan",
            data: updatedExpense[0]
        });


    } catch (error) {

        await connection.rollback();

        console.error(
            "Update Expense Error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Gagal memperbarui pengeluaran",
            error:
                error.message
        });

    } finally {

        connection.release();

    }
};


// =====================================================
// GET EXPENSE SUMMARY
// GET /api/expenses/summary?month=8&year=2026
// =====================================================
const getExpenseSummary = async (req, res) => {

    try {

        const {
            month,
            year
        } = req.query;


        // =================================================
        // VALIDASI PARAMETER
        // =================================================

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


        // =================================================
        // VALIDASI BULAN
        // =================================================

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


        // =================================================
        // VALIDASI TAHUN
        // =================================================

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


        // =================================================
        // SUMMARY TOTAL
        // =================================================

        const [summary] =
            await db.query(`
                SELECT
                    COUNT(*) AS total_transactions,

                    COALESCE(
                        SUM(amount),
                        0
                    ) AS total_amount

                FROM expenses

                WHERE MONTH(expense_date) = ?
                AND YEAR(expense_date) = ?
            `, [
                monthNumber,
                yearNumber
            ]);


        // =================================================
        // SUMMARY PER KATEGORI
        // =================================================

        const [categories] =
            await db.query(`
                SELECT
                    category,

                    COUNT(*) AS transaction_count,

                    COALESCE(
                        SUM(amount),
                        0
                    ) AS total_amount

                FROM expenses

                WHERE MONTH(expense_date) = ?
                AND YEAR(expense_date) = ?

                GROUP BY category

                ORDER BY total_amount DESC
            `, [
                monthNumber,
                yearNumber
            ]);


        // =================================================
        // RESPONSE
        // =================================================

        res.json({

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
                            summary[0]
                                .total_transactions
                        ) || 0,

                    total_amount:
                        Number(
                            summary[0]
                                .total_amount
                        ) || 0

                },


                categories:
                    categories.map(
                        (item) => ({

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

                        })
                    )

            }

        });


    } catch (error) {

        console.error(
            "Expense Summary Error:",
            error
        );

        res.status(500).json({

            success: false,

            message:
                "Gagal mengambil summary pengeluaran",

            error:
                error.message

        });

    }

};


// =====================================================
// DELETE EXPENSE
// DELETE /api/expenses/:id
//
// Saat pengeluaran dihapus:
// saldo rekening otomatis DIKEMBALIKAN
// =====================================================
const deleteExpense = async (req, res) => {

    const connection = await db.getConnection();

    try {

        const { id } = req.params;


        // =================================================
        // MULAI TRANSACTION
        // =================================================

        await connection.beginTransaction();


        // =================================================
        // AMBIL DATA EXPENSE
        // =================================================

        const [expenseRows] =
            await connection.query(`
                SELECT
                    id,
                    amount,
                    bank_account_id
                FROM expenses
                WHERE id = ?
                FOR UPDATE
            `, [id]);


        if (expenseRows.length === 0) {

            await connection.rollback();

            return res.status(404).json({
                success: false,
                message:
                    "Pengeluaran tidak ditemukan"
            });

        }


        const expense =
            expenseRows[0];


        const expenseAmount =
            Number(expense.amount || 0);


        const bankAccountId =
            expense.bank_account_id;


        // =================================================
        // CEK REKENING
        // =================================================

        if (!bankAccountId) {

            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "Pengeluaran ini tidak memiliki rekening terkait"
            });

        }


        const [bankRows] =
            await connection.query(`
                SELECT
                    id,
                    current_balance
                FROM bank_accounts
                WHERE id = ?
                FOR UPDATE
            `, [bankAccountId]);


        if (bankRows.length === 0) {

            await connection.rollback();

            return res.status(404).json({
                success: false,
                message:
                    "Rekening bank tidak ditemukan"
            });

        }


        // =================================================
        // HAPUS EXPENSE
        // =================================================

        await connection.query(`
            DELETE FROM expenses
            WHERE id = ?
        `, [id]);


        // =================================================
        // KEMBALIKAN SALDO
        // =================================================

        await connection.query(`
            UPDATE bank_accounts
            SET
                current_balance =
                    current_balance + ?
            WHERE id = ?
        `, [
            expenseAmount,
            bankAccountId
        ]);


        // =================================================
        // COMMIT
        // =================================================

        await connection.commit();


        res.json({
            success: true,
            message:
                "Pengeluaran berhasil dihapus dan saldo rekening dikembalikan"
        });


    } catch (error) {

        await connection.rollback();

        console.error(
            "Delete Expense Error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Gagal menghapus pengeluaran",
            error:
                error.message
        });

    } finally {

        connection.release();

    }

};


// =====================================================
// EXPORT CONTROLLER
// =====================================================

module.exports = {

    getExpenses,

    getExpenseById,

    createExpense,

    updateExpense,

    deleteExpense,

    getExpenseSummary

};