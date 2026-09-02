const db = require("../config/database");

// =====================================================
// GET ALL BANK ACCOUNTS
// GET /api/bank-accounts
// =====================================================
const getBankAccounts = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                id,
                bank_name,
                account_name,
                account_number,
                current_balance,
                account_type,
                is_active,
                notes,
                created_at,
                updated_at
            FROM bank_accounts
            ORDER BY is_active DESC, id DESC
        `);

        res.json({
            success: true,
            data: rows
        });

    } catch (error) {
        console.error("Get Bank Accounts Error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil data rekening bank",
            error: error.message
        });
    }
};


// =====================================================
// GET BANK ACCOUNT BY ID
// GET /api/bank-accounts/:id
// =====================================================
const getBankAccountById = async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await db.query(`
            SELECT
                id,
                bank_name,
                account_name,
                account_number,
                current_balance,
                account_type,
                is_active,
                notes,
                created_at,
                updated_at
            FROM bank_accounts
            WHERE id = ?
        `, [id]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Rekening bank tidak ditemukan"
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });

    } catch (error) {
        console.error("Get Bank Account Error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil data rekening bank",
            error: error.message
        });
    }
};


// =====================================================
// GET BANK ACCOUNT MUTATIONS
// GET /api/bank-accounts/:id/mutations
//
// PAYMENT VERIFIED  = UANG MASUK
// EXPENSES           = UANG KELUAR
// =====================================================
const getBankAccountMutations = async (req, res) => {
    try {
        const { id } = req.params;

        // =================================================
        // CEK REKENING
        // =================================================

        const [accountRows] = await db.query(`
            SELECT
                id,
                bank_name,
                account_name,
                account_number,
                current_balance,
                account_type,
                is_active
            FROM bank_accounts
            WHERE id = ?
            LIMIT 1
        `, [id]);

        if (accountRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Rekening bank tidak ditemukan"
            });
        }

        const account = accountRows[0];


        // =================================================
        // AMBIL UANG MASUK DARI PAYMENT VERIFIED
        // =================================================

        const [paymentRows] = await db.query(`
            SELECT
                p.id,
                p.payment_date AS transaction_date,
                'income' AS transaction_type,
                p.amount AS amount,
                'Pembayaran Penghuni' AS category,
                COALESCE(
                    NULLIF(p.notes, ''),
                    'Pembayaran penghuni'
                ) AS description,
                p.payment_method,
                p.status,
                p.bill_id,
                p.booking_id
            FROM payments p
            WHERE
                p.bank_account_id = ?
                AND p.status = 'verified'
        `, [id]);


        // =================================================
        // AMBIL UANG KELUAR DARI EXPENSES
        // =================================================

        const [expenseRows] = await db.query(`
            SELECT
                e.id,
                e.expense_date AS transaction_date,
                'expense' AS transaction_type,
                e.amount AS amount,
                e.category AS category,
                e.description AS description,
                NULL AS payment_method,
                'verified' AS status,
                NULL AS bill_id,
                NULL AS booking_id
            FROM expenses e
            WHERE
                e.bank_account_id = ?
        `, [id]);


        // =================================================
        // GABUNG TRANSAKSI
        // =================================================

        const mutations = [
            ...paymentRows,
            ...expenseRows
        ];


        // =================================================
        // URUTKAN TERBARU
        // =================================================

        mutations.sort((a, b) => {

            const dateA =
                new Date(a.transaction_date).getTime();

            const dateB =
                new Date(b.transaction_date).getTime();

            if (dateB !== dateA) {
                return dateB - dateA;
            }

            return Number(b.id) - Number(a.id);
        });


        // =================================================
        // NORMALISASI DATA
        // =================================================

        const formattedMutations = mutations.map(
            (mutation) => {

                const isIncome =
                    mutation.transaction_type === "income";

                return {
                    id: mutation.id,

                    transaction_date:
                        mutation.transaction_date,

                    transaction_type:
                        mutation.transaction_type,

                    category:
                        mutation.category,

                    description:
                        mutation.description ||
                        "-",

                    payment_method:
                        mutation.payment_method ||
                        null,

                    status:
                        mutation.status,

                    bill_id:
                        mutation.bill_id || null,

                    booking_id:
                        mutation.booking_id || null,

                    amount:
                        Number(mutation.amount || 0),

                    masuk:
                        isIncome
                            ? Number(mutation.amount || 0)
                            : 0,

                    keluar:
                        !isIncome
                            ? Number(mutation.amount || 0)
                            : 0,
                };
            }
        );


        // =================================================
        // TOTAL MUTASI
        // =================================================

        const totalMasuk =
            formattedMutations.reduce(
                (total, item) =>
                    total + Number(item.masuk || 0),
                0
            );

        const totalKeluar =
            formattedMutations.reduce(
                (total, item) =>
                    total + Number(item.keluar || 0),
                0
            );


        // =================================================
        // RESPONSE
        // =================================================

        res.json({
            success: true,

            data: {
                account: {
                    id: account.id,
                    bank_name: account.bank_name,
                    account_name: account.account_name,
                    account_number: account.account_number,
                    account_type: account.account_type,
                    current_balance:
                        Number(
                            account.current_balance || 0
                        ),
                    is_active:
                        account.is_active === 1 ||
                        account.is_active === true
                },

                summary: {
                    total_transactions:
                        formattedMutations.length,

                    total_masuk:
                        totalMasuk,

                    total_keluar:
                        totalKeluar
                },

                mutations:
                    formattedMutations
            }
        });

    } catch (error) {
        console.error(
            "Get Bank Account Mutations Error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Gagal mengambil mutasi rekening",
            error: error.message
        });
    }
};


// =====================================================
// CREATE BANK ACCOUNT
// POST /api/bank-accounts
// =====================================================
const createBankAccount = async (req, res) => {
    try {
        const {
            bank_name,
            account_name,
            account_number,
            current_balance,
            account_type,
            is_active,
            notes
        } = req.body;


        // =================================================
        // VALIDASI DATA WAJIB
        // =================================================

        if (
            !bank_name ||
            !account_name ||
            !account_number
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Nama bank, nama pemilik rekening, dan nomor rekening wajib diisi"
            });
        }


        // =================================================
        // NORMALISASI SALDO
        // =================================================

        const balance = Number(current_balance || 0);

        if (Number.isNaN(balance) || balance < 0) {
            return res.status(400).json({
                success: false,
                message: "Saldo rekening tidak valid"
            });
        }


        // =================================================
        // CEK NOMOR REKENING
        // =================================================

        const [existing] = await db.query(`
            SELECT id
            FROM bank_accounts
            WHERE account_number = ?
            LIMIT 1
        `, [account_number.trim()]);


        if (existing.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Nomor rekening sudah terdaftar"
            });
        }


        // =================================================
        // INSERT REKENING
        // =================================================

        const [result] = await db.query(`
            INSERT INTO bank_accounts
            (
                bank_name,
                account_name,
                account_number,
                current_balance,
                account_type,
                is_active,
                notes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            bank_name.trim(),
            account_name.trim(),
            account_number.trim(),
            balance,
            account_type || "bank",
            is_active === undefined
                ? 1
                : (is_active ? 1 : 0),
            notes || null
        ]);


        // =================================================
        // AMBIL DATA REKENING BARU
        // =================================================

        const [rows] = await db.query(`
            SELECT
                id,
                bank_name,
                account_name,
                account_number,
                current_balance,
                account_type,
                is_active,
                notes,
                created_at,
                updated_at
            FROM bank_accounts
            WHERE id = ?
        `, [result.insertId]);


        res.status(201).json({
            success: true,
            message: "Rekening bank berhasil ditambahkan",
            data: rows[0]
        });

    } catch (error) {
        console.error("Create Bank Account Error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal menambahkan rekening bank",
            error: error.message
        });
    }
};


// =====================================================
// UPDATE BANK ACCOUNT
// PUT /api/bank-accounts/:id
// =====================================================
const updateBankAccount = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            bank_name,
            account_name,
            account_number,
            current_balance,
            account_type,
            is_active,
            notes
        } = req.body;


        // =================================================
        // VALIDASI DATA WAJIB
        // =================================================

        if (
            !bank_name ||
            !account_name ||
            !account_number
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Nama bank, nama pemilik rekening, dan nomor rekening wajib diisi"
            });
        }


        // =================================================
        // NORMALISASI SALDO
        // =================================================

        const balance = Number(current_balance || 0);

        if (Number.isNaN(balance) || balance < 0) {
            return res.status(400).json({
                success: false,
                message: "Saldo rekening tidak valid"
            });
        }


        // =================================================
        // CEK REKENING
        // =================================================

        const [existing] = await db.query(`
            SELECT
                id,
                current_balance
            FROM bank_accounts
            WHERE id = ?
            LIMIT 1
        `, [id]);


        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Rekening bank tidak ditemukan"
            });
        }


        // =================================================
        // CEK NOMOR REKENING DUPLIKAT
        // =================================================

        const [duplicate] = await db.query(`
            SELECT id
            FROM bank_accounts
            WHERE account_number = ?
            AND id != ?
            LIMIT 1
        `, [
            account_number.trim(),
            id
        ]);


        if (duplicate.length > 0) {
            return res.status(400).json({
                success: false,
                message:
                    "Nomor rekening sudah digunakan rekening lain"
            });
        }


        // =================================================
        // UPDATE REKENING
        // =================================================

        await db.query(`
            UPDATE bank_accounts
            SET
                bank_name = ?,
                account_name = ?,
                account_number = ?,
                current_balance = ?,
                account_type = ?,
                is_active = ?,
                notes = ?
            WHERE id = ?
        `, [
            bank_name.trim(),
            account_name.trim(),
            account_number.trim(),
            balance,
            account_type || "bank",
            is_active === undefined
                ? 1
                : (is_active ? 1 : 0),
            notes || null,
            id
        ]);


        // =================================================
        // AMBIL DATA TERBARU
        // =================================================

        const [rows] = await db.query(`
            SELECT
                id,
                bank_name,
                account_name,
                account_number,
                current_balance,
                account_type,
                is_active,
                notes,
                created_at,
                updated_at
            FROM bank_accounts
            WHERE id = ?
        `, [id]);


        res.json({
            success: true,
            message: "Rekening bank berhasil diperbarui",
            data: rows[0]
        });

    } catch (error) {
        console.error("Update Bank Account Error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal memperbarui rekening bank",
            error: error.message
        });
    }
};


// =====================================================
// DELETE / NONAKTIFKAN BANK ACCOUNT
// DELETE /api/bank-accounts/:id
// =====================================================
const deleteBankAccount = async (req, res) => {
    try {
        const { id } = req.params;


        // =================================================
        // CEK REKENING
        // =================================================

        const [existing] = await db.query(`
            SELECT
                id,
                is_active
            FROM bank_accounts
            WHERE id = ?
            LIMIT 1
        `, [id]);


        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Rekening bank tidak ditemukan"
            });
        }


        // =================================================
        // CEK SUDAH NONAKTIF
        // =================================================

        if (existing[0].is_active === 0) {
            return res.status(400).json({
                success: false,
                message: "Rekening bank sudah nonaktif"
            });
        }


        // =================================================
        // NONAKTIFKAN
        //
        // TIDAK DIHAPUS PERMANEN
        // Supaya histori transaksi tetap aman.
        // =================================================

        await db.query(`
            UPDATE bank_accounts
            SET
                is_active = 0
            WHERE id = ?
        `, [id]);


        res.json({
            success: true,
            message: "Rekening bank berhasil dinonaktifkan"
        });

    } catch (error) {
        console.error(
            "Deactivate Bank Account Error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Gagal menonaktifkan rekening bank",
            error: error.message
        });
    }
};


// =====================================================
// EXPORT
// =====================================================

module.exports = {
    getBankAccounts,
    getBankAccountById,
    getBankAccountMutations,
    createBankAccount,
    updateBankAccount,
    deleteBankAccount
};