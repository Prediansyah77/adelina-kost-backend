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
    createBankAccount,
    updateBankAccount,
    deleteBankAccount
};