const db = require("../config/database");

// ======================================================
// GET ALL RECONCILIATIONS
// ======================================================
const getAllReconciliations = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                r.id,
                r.payment_id,
                r.bank_account_id,
                r.expected_amount,
                r.actual_amount,
                r.difference,
                r.reconciliation_date,
                r.status,
                r.notes,
                r.created_at,
                r.updated_at,

                p.bill_id,
                p.payment_date,
                p.amount AS payment_amount,
                p.payment_method,

                ba.bank_name,
                ba.account_name,
                ba.account_number

            FROM reconciliations r

            LEFT JOIN payments p
                ON r.payment_id = p.id

            LEFT JOIN bank_accounts ba
                ON r.bank_account_id = ba.id

            ORDER BY r.reconciliation_date DESC,
                     r.id DESC
        `);

        res.json({
            success: true,
            data: rows
        });

    } catch (error) {
        console.error(
            "Get All Reconciliations Error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Gagal mengambil data rekonsiliasi",
            error: error.message
        });
    }
};


// ======================================================
// GET RECONCILIATION BY ID
// ======================================================
const getReconciliationById = async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await db.query(`
            SELECT
                r.id,
                r.payment_id,
                r.bank_account_id,
                r.expected_amount,
                r.actual_amount,
                r.difference,
                r.reconciliation_date,
                r.status,
                r.notes,
                r.created_at,
                r.updated_at,

                p.bill_id,
                p.payment_date,
                p.amount AS payment_amount,
                p.payment_method,

                ba.bank_name,
                ba.account_name,
                ba.account_number

            FROM reconciliations r

            LEFT JOIN payments p
                ON r.payment_id = p.id

            LEFT JOIN bank_accounts ba
                ON r.bank_account_id = ba.id

            WHERE r.id = ?
        `, [id]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Data rekonsiliasi tidak ditemukan"
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });

    } catch (error) {
        console.error(
            "Get Reconciliation By ID Error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Gagal mengambil data rekonsiliasi",
            error: error.message
        });
    }
};


// ======================================================
// CREATE RECONCILIATION
// ======================================================
const createReconciliation = async (req, res) => {
    try {
        const {
            payment_id,
            bank_account_id,
            expected_amount,
            actual_amount,
            reconciliation_date,
            notes
        } = req.body;

        // ==================================================
        // VALIDASI INPUT WAJIB
        // ==================================================
        if (
            !payment_id ||
            !bank_account_id ||
            expected_amount === undefined ||
            actual_amount === undefined ||
            !reconciliation_date
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "payment_id, bank_account_id, expected_amount, actual_amount, dan reconciliation_date wajib diisi"
            });
        }

        // ==================================================
        // VALIDASI PAYMENT
        // ==================================================
        const [paymentRows] = await db.query(`
            SELECT
                id,
                amount,
                payment_date
            FROM payments
            WHERE id = ?
        `, [payment_id]);

        if (paymentRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Payment tidak ditemukan"
            });
        }

        // ==================================================
        // VALIDASI BANK ACCOUNT
        // ==================================================
        const [bankRows] = await db.query(`
            SELECT
                id,
                bank_name,
                account_name,
                account_number,
                is_active
            FROM bank_accounts
            WHERE id = ?
        `, [bank_account_id]);

        if (bankRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Bank account tidak ditemukan"
            });
        }

        // ==================================================
        // VALIDASI NOMINAL
        // ==================================================
        const expected = Number(expected_amount);
        const actual = Number(actual_amount);

        if (
            !Number.isFinite(expected) ||
            !Number.isFinite(actual) ||
            expected < 0 ||
            actual < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "expected_amount dan actual_amount harus berupa angka >= 0"
            });
        }

        // ==================================================
        // HITUNG SELISIH
        // ==================================================
        const difference = actual - expected;

        // ==================================================
        // TENTUKAN STATUS
        // ==================================================
        let status;

        if (difference === 0) {
            status = "matched";
        } else if (actual === 0) {
            status = "unmatched";
        } else {
            status = "partial";
        }

        // ==================================================
        // INSERT RECONCILIATION
        // ==================================================
        const [result] = await db.query(`
            INSERT INTO reconciliations (
                payment_id,
                bank_account_id,
                expected_amount,
                actual_amount,
                difference,
                reconciliation_date,
                status,
                notes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            payment_id,
            bank_account_id,
            expected,
            actual,
            difference,
            reconciliation_date,
            status,
            notes || null
        ]);

        // ==================================================
        // RESPONSE
        // ==================================================
        res.status(201).json({
            success: true,
            message: "Rekonsiliasi berhasil dibuat",
            data: {
                id: result.insertId,
                payment_id,
                bank_account_id,
                expected_amount: expected,
                actual_amount: actual,
                difference,
                reconciliation_date,
                status,
                notes: notes || null
            }
        });

    } catch (error) {
        console.error(
            "Create Reconciliation Error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Gagal membuat rekonsiliasi",
            error: error.message
        });
    }
};


// ======================================================
// UPDATE RECONCILIATION
// ======================================================
const updateReconciliation = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            payment_id,
            bank_account_id,
            expected_amount,
            actual_amount,
            reconciliation_date,
            notes
        } = req.body;

        // ==================================================
        // CEK DATA REKONSILIASI
        // ==================================================
        const [existingRows] = await db.query(`
            SELECT id
            FROM reconciliations
            WHERE id = ?
        `, [id]);

        if (existingRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Data rekonsiliasi tidak ditemukan"
            });
        }

        // ==================================================
        // VALIDASI INPUT
        // ==================================================
        if (
            !payment_id ||
            !bank_account_id ||
            expected_amount === undefined ||
            actual_amount === undefined ||
            !reconciliation_date
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "payment_id, bank_account_id, expected_amount, actual_amount, dan reconciliation_date wajib diisi"
            });
        }

        // ==================================================
        // CEK PAYMENT
        // ==================================================
        const [paymentRows] = await db.query(`
            SELECT id
            FROM payments
            WHERE id = ?
        `, [payment_id]);

        if (paymentRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Payment tidak ditemukan"
            });
        }

        // ==================================================
        // CEK BANK ACCOUNT
        // ==================================================
        const [bankRows] = await db.query(`
            SELECT id
            FROM bank_accounts
            WHERE id = ?
        `, [bank_account_id]);

        if (bankRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Bank account tidak ditemukan"
            });
        }

        // ==================================================
        // VALIDASI NOMINAL
        // ==================================================
        const expected = Number(expected_amount);
        const actual = Number(actual_amount);

        if (
            !Number.isFinite(expected) ||
            !Number.isFinite(actual) ||
            expected < 0 ||
            actual < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Nominal tidak valid"
            });
        }

        // ==================================================
        // HITUNG SELISIH
        // ==================================================
        const difference = actual - expected;

        // ==================================================
        // TENTUKAN STATUS
        // ==================================================
        let status;

        if (difference === 0) {
            status = "matched";
        } else if (actual === 0) {
            status = "unmatched";
        } else {
            status = "partial";
        }

        // ==================================================
        // UPDATE
        // ==================================================
        await db.query(`
            UPDATE reconciliations
            SET
                payment_id = ?,
                bank_account_id = ?,
                expected_amount = ?,
                actual_amount = ?,
                difference = ?,
                reconciliation_date = ?,
                status = ?,
                notes = ?
            WHERE id = ?
        `, [
            payment_id,
            bank_account_id,
            expected,
            actual,
            difference,
            reconciliation_date,
            status,
            notes || null,
            id
        ]);

        // ==================================================
        // RESPONSE
        // ==================================================
        res.json({
            success: true,
            message: "Rekonsiliasi berhasil diperbarui",
            data: {
                id: Number(id),
                payment_id,
                bank_account_id,
                expected_amount: expected,
                actual_amount: actual,
                difference,
                reconciliation_date,
                status,
                notes: notes || null
            }
        });

    } catch (error) {
        console.error(
            "Update Reconciliation Error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Gagal memperbarui rekonsiliasi",
            error: error.message
        });
    }
};


// ======================================================
// DELETE RECONCILIATION
// ======================================================
const deleteReconciliation = async (req, res) => {
    try {
        const { id } = req.params;

        // ==================================================
        // CEK DATA
        // ==================================================
        const [rows] = await db.query(`
            SELECT id
            FROM reconciliations
            WHERE id = ?
        `, [id]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Data rekonsiliasi tidak ditemukan"
            });
        }

        // ==================================================
        // DELETE
        // ==================================================
        await db.query(`
            DELETE FROM reconciliations
            WHERE id = ?
        `, [id]);

        // ==================================================
        // RESPONSE
        // ==================================================
        res.json({
            success: true,
            message: "Rekonsiliasi berhasil dihapus"
        });

    } catch (error) {
        console.error(
            "Delete Reconciliation Error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Gagal menghapus rekonsiliasi",
            error: error.message
        });
    }
};


// ======================================================
// EXPORT CONTROLLER
// ======================================================
module.exports = {
    getAllReconciliations,
    getReconciliationById,
    createReconciliation,
    updateReconciliation,
    deleteReconciliation
};