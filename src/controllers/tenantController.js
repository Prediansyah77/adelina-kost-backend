const db = require("../config/database");
const bcrypt = require("bcrypt");


// ============================================================
// GET ACTIVE TENANTS
// GET /api/tenants
//
// Menampilkan HANYA penghuni yang memiliki kontrak ACTIVE.
// ============================================================

const getTenants = async (req, res) => {

    try {

        const [tenants] = await db.query(`
            SELECT

                t.*,

                c.id AS contract_id,

                c.room_id,

                r.room_number,

                DATE_FORMAT(
                    c.start_date,
                    '%Y-%m-%d'
                ) AS start_date,

                DATE_FORMAT(
                    c.end_date,
                    '%Y-%m-%d'
                ) AS end_date,

                c.monthly_price,

                c.status AS contract_status

            FROM tenants t

            INNER JOIN contracts c
                ON c.id = (

                    SELECT
                        c2.id

                    FROM contracts c2

                    WHERE
                        c2.tenant_id = t.id

                        AND c2.status = 'active'

                    ORDER BY
                        c2.id DESC

                    LIMIT 1
                )

            LEFT JOIN rooms r
                ON c.room_id = r.id

            ORDER BY
                t.id ASC
        `);


        return res.json({

            success: true,

            data: tenants

        });


    } catch (error) {

        console.error(
            "Get Tenants Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Gagal mengambil data penghuni",

            error:
                error.message

        });

    }

};


// ============================================================
// GET ALL TENANTS
// GET /api/tenants/all
//
// Menampilkan seluruh penghuni.
//
// Termasuk:
// - penghuni aktif
// - penghuni selesai kontrak
// - penghuni kontrak dibatalkan
// - penghuni tanpa kontrak
// ============================================================

const getAllTenants = async (req, res) => {

    try {

        const [tenants] = await db.query(`
            SELECT

                t.*,

                c.id AS contract_id,

                c.room_id,

                r.room_number,

                DATE_FORMAT(
                    c.start_date,
                    '%Y-%m-%d'
                ) AS start_date,

                DATE_FORMAT(
                    c.end_date,
                    '%Y-%m-%d'
                ) AS end_date,

                c.monthly_price,

                c.status AS contract_status

            FROM tenants t

            LEFT JOIN contracts c
                ON c.id = (

                    SELECT
                        c2.id

                    FROM contracts c2

                    WHERE
                        c2.tenant_id = t.id

                    ORDER BY

                        CASE

                            WHEN c2.status = 'active'
                                THEN 1

                            ELSE 2

                        END,

                        c2.id DESC

                    LIMIT 1
                )

            LEFT JOIN rooms r
                ON c.room_id = r.id

            ORDER BY
                t.id ASC
        `);


        return res.json({

            success: true,

            data: tenants

        });


    } catch (error) {

        console.error(
            "Get All Tenants Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Gagal mengambil seluruh data penghuni",

            error:
                error.message

        });

    }

};


// ============================================================
// GET TENANT HISTORY
// GET /api/tenants/history
//
// Menampilkan penghuni yang:
//
// 1. Pernah memiliki kontrak
// 2. Tidak memiliki kontrak ACTIVE
//
// Yang ditampilkan adalah kontrak terakhir.
// ============================================================

const getTenantHistory = async (req, res) => {

    try {

        const [tenants] = await db.query(`
            SELECT

                t.id,

                t.name,

                t.phone,

                t.address,

                t.identity_number,

                t.created_at,

                latest_contract.id AS contract_id,

                latest_contract.room_id,

                latest_contract.room_number,

                latest_contract.start_date,

                latest_contract.end_date,

                latest_contract.monthly_price,

                latest_contract.contract_status

            FROM tenants t

            INNER JOIN (

                SELECT

                    c1.id,

                    c1.tenant_id,

                    c1.room_id,

                    r.room_number,

                    DATE_FORMAT(
                        c1.start_date,
                        '%Y-%m-%d'
                    ) AS start_date,

                    DATE_FORMAT(
                        c1.end_date,
                        '%Y-%m-%d'
                    ) AS end_date,

                    c1.monthly_price,

                    c1.status AS contract_status

                FROM contracts c1

                INNER JOIN rooms r
                    ON c1.room_id = r.id

                INNER JOIN (

                    SELECT

                        tenant_id,

                        MAX(id) AS latest_contract_id

                    FROM contracts

                    GROUP BY tenant_id

                ) latest

                    ON latest.latest_contract_id = c1.id

            ) latest_contract

                ON latest_contract.tenant_id = t.id

            WHERE NOT EXISTS (

                SELECT 1

                FROM contracts active_contract

                WHERE
                    active_contract.tenant_id = t.id

                    AND active_contract.status = 'active'

            )

            ORDER BY
                latest_contract.id DESC
        `);


        return res.json({

            success: true,

            data: tenants

        });


    } catch (error) {

        console.error(
            "Get Tenant History Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Gagal mengambil riwayat penghuni",

            error:
                error.message

        });

    }

};


// ============================================================
// GET TENANT BY ID
// GET /api/tenants/:id
//
// Menampilkan:
// - data tenant
// - kontrak aktif jika ada
// - kamar jika ada
//
// Tidak menampilkan password user.
// ============================================================

const getTenantById = async (req, res) => {

    try {

        const { id } = req.params;


        // ====================================================
        // VALIDASI ID
        // ====================================================

        if (
            !id ||
            Number.isNaN(Number(id))
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "ID penghuni tidak valid"

            });

        }


        const [tenants] = await db.query(`
            SELECT

                t.*,

                c.id AS contract_id,

                c.room_id,

                r.room_number,

                DATE_FORMAT(
                    c.start_date,
                    '%Y-%m-%d'
                ) AS start_date,

                DATE_FORMAT(
                    c.end_date,
                    '%Y-%m-%d'
                ) AS end_date,

                c.monthly_price,

                c.status AS contract_status

            FROM tenants t

            LEFT JOIN contracts c
                ON c.tenant_id = t.id

                AND c.status = 'active'

            LEFT JOIN rooms r
                ON c.room_id = r.id

            WHERE t.id = ?

            LIMIT 1
        `, [
            id
        ]);


        if (
            tenants.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Penghuni tidak ditemukan"

            });

        }


        return res.json({

            success: true,

            data:
                tenants[0]

        });


    } catch (error) {

        console.error(
            "Get Tenant By ID Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Gagal mengambil data penghuni",

            error:
                error.message

        });

    }

};


// ============================================================
// GET CALON TENANTS
// GET /api/tenants/calon
//
// Menampilkan calon penghuni.
//
// Data:
// - nama
// - HP
// - alamat
// - nomor KTP
// - gender
// - pekerjaan
// - tujuan ngekos
// - status
// - tanggal daftar
// - username
//
// Password TIDAK ditampilkan.
// ============================================================

const getCalonTenants = async (req, res) => {

    try {

        const [tenants] = await db.query(`
            SELECT

                t.id,

                t.name,

                t.phone,

                t.address,

                t.identity_number,

                t.gender,

                t.occupation,

                t.boarding_purpose,

                t.status,

                t.created_at,

                u.username

            FROM tenants t

            LEFT JOIN users u
                ON u.tenant_id = t.id

            WHERE t.status = 'calon'

            ORDER BY
                t.id DESC
        `);


        return res.json({

            success: true,

            data: tenants

        });


    } catch (error) {

        console.error(
            "Get Calon Tenants Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Gagal mengambil data calon penghuni",

            error:
                error.message

        });

    }

};


// ============================================================
// GET DETAIL CALON TENANT
// GET /api/tenants/calon/:id
//
// Menampilkan:
//
// DATA DIRI
// - nama
// - HP
// - alamat
// - nomor KTP
// - gender
// - pekerjaan
// - tujuan ngekos
//
// AKUN
// - username
//
// DOKUMEN
// - foto KTP
//
// BOOKING
// - kamar
// - status
// - lama booking
// - nominal booking
//
// PEMBAYARAN BOOKING
//
// PEMBAYARAN FULL
//
// Password TIDAK PERNAH dikirim.
// ============================================================

const getCalonTenantById = async (req, res) => {

    try {

        const { id } = req.params;


        // ====================================================
        // VALIDASI ID
        // ====================================================

        if (
            !id ||
            Number.isNaN(Number(id))
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "ID calon penghuni tidak valid"

            });

        }


        // ====================================================
        // DATA TENANT + USER
        // ====================================================

        const [tenantRows] =
            await db.query(`
                SELECT

                    t.id,

                    t.name,

                    t.phone,

                    t.address,

                    t.identity_number,

                    t.gender,

                    t.occupation,

                    t.boarding_purpose,

                    t.status,

                    t.created_at,

                    u.username

                FROM tenants t

                LEFT JOIN users u
                    ON u.tenant_id = t.id

                WHERE t.id = ?

                AND t.status = 'calon'

                LIMIT 1
            `, [
                id
            ]);


        if (
            tenantRows.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Calon penghuni tidak ditemukan"

            });

        }


        const tenant =
            tenantRows[0];


        // ====================================================
        // DOKUMEN KTP
        // ====================================================

        const [documentRows] =
            await db.query(`
                SELECT

                    id,

                    document_type,

                    file_path,

                    created_at

                FROM tenant_documents

                WHERE tenant_id = ?

                AND document_type = 'ktp'

                ORDER BY id DESC

                LIMIT 1
            `, [
                id
            ]);


        // ====================================================
        // BOOKING TERAKHIR
        // ====================================================

        const [bookingRows] =
            await db.query(`
                SELECT

                    rb.id AS booking_id,

                    rb.room_id,

                    r.room_number,

                    r.price AS room_price,

                    rb.booking_days,

                    rb.booking_amount,

                    rb.requested_start_date,

                    rb.booking_expired_at,

                    rb.status AS booking_status,

                    rb.created_at AS booking_created_at

                FROM room_bookings rb

                LEFT JOIN rooms r
                    ON rb.room_id = r.id

                WHERE rb.tenant_id = ?

                ORDER BY rb.id DESC

                LIMIT 1
            `, [
                id
            ]);


        // ====================================================
        // PEMBAYARAN BOOKING
        // ====================================================

        let bookingPayment = null;


        if (
            bookingRows.length > 0
        ) {

            const [paymentRows] =
                await db.query(`
                    SELECT

                        p.id AS payment_id,

                        p.amount,

                        p.payment_method,

                        p.status,

                        p.payment_date,

                        p.proof_file,

                        p.notes,

                        p.created_at,

                        p.bank_account_id,

                        ba.bank_name,

                        ba.account_number,

                        ba.account_name

                    FROM payments p

                    LEFT JOIN bank_accounts ba
                        ON p.bank_account_id = ba.id

                    WHERE p.booking_id = ?

                    ORDER BY p.id DESC

                    LIMIT 1
                `, [
                    bookingRows[0].booking_id
                ]);


            if (
                paymentRows.length > 0
            ) {

                bookingPayment =
                    paymentRows[0];

            }

        }


        // ====================================================
        // PEMBAYARAN FULL
        //
        // Pembayaran full menggunakan bill_id.
        // ====================================================

        const [fullPaymentRows] =
            await db.query(`
                SELECT

                    p.id AS payment_id,

                    p.bill_id,

                    p.amount,

                    p.payment_method,

                    p.status,

                    p.payment_date,

                    p.proof_file,

                    p.notes,

                    p.created_at,

                    p.bank_account_id,

                    ba.bank_name,

                    ba.account_number,

                    ba.account_name

                FROM payments p

                LEFT JOIN bank_accounts ba
                    ON p.bank_account_id = ba.id

                INNER JOIN bills b
                    ON p.bill_id = b.id

                INNER JOIN contracts c
                    ON b.contract_id = c.id

                WHERE c.tenant_id = ?

                ORDER BY p.id DESC
            `, [
                id
            ]);


        // ====================================================
        // RESPONSE
        // ====================================================

        return res.json({

            success: true,

            data: {

                tenant,

                document:
                    documentRows.length > 0
                        ? documentRows[0]
                        : null,

                booking:
                    bookingRows.length > 0
                        ? bookingRows[0]
                        : null,

                booking_payment:
                    bookingPayment,

                full_payments:
                    fullPaymentRows

            }

        });


    } catch (error) {

        console.error(
            "Get Calon Tenant By ID Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Gagal mengambil detail calon penghuni",

            error:
                error.message

        });

    }

};


// ============================================================
// CREATE TENANT + USER ACCOUNT
// POST /api/tenants
//
// Membuat:
//
// 1. Data penghuni → tenants
// 2. Akun login → users
//
// User:
// role = penghuni
//
// Password:
// HASH bcrypt
// ============================================================

const createTenant = async (req, res) => {

    const connection =
        await db.getConnection();


    try {

        const {
            name,
            phone,
            address,
            identity_number,
            username,
            password
        } = req.body;


        // ====================================================
        // VALIDASI NAMA
        // ====================================================

        if (
            !name ||
            !name.trim()
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Nama penghuni wajib diisi"

            });

        }


        // ====================================================
        // VALIDASI USERNAME
        // ====================================================

        if (
            !username ||
            !username.trim()
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Username penghuni wajib diisi"

            });

        }


        // ====================================================
        // VALIDASI PASSWORD
        // ====================================================

        if (
            !password ||
            !password.trim()
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Password penghuni wajib diisi"

            });

        }


        // ====================================================
        // NORMALISASI
        // ====================================================

        const tenantName =
            name.trim();

        const tenantPhone =
            phone
                ? phone.trim()
                : null;

        const tenantAddress =
            address
                ? address.trim()
                : null;

        const identityNumber =
            identity_number
                ? identity_number.trim()
                : null;

        const tenantUsername =
            username.trim();


        // ====================================================
        // VALIDASI USERNAME
        // ====================================================

        if (
            tenantUsername.length < 4
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Username minimal 4 karakter"

            });

        }


        // ====================================================
        // VALIDASI PASSWORD
        // ====================================================

        if (
            password.length < 6
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Password minimal 6 karakter"

            });

        }


        // ====================================================
        // CEK USERNAME
        // ====================================================

        const [existingUser] =
            await connection.query(`
                SELECT
                    id,
                    username

                FROM users

                WHERE username = ?

                LIMIT 1
            `, [
                tenantUsername
            ]);


        if (
            existingUser.length > 0
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "Username sudah digunakan. Silakan gunakan username lain."

            });

        }


        // ====================================================
        // MULAI TRANSACTION
        // ====================================================

        await connection.beginTransaction();


        // ====================================================
        // INSERT TENANT
        // ====================================================

        const [tenantResult] =
            await connection.query(`
                INSERT INTO tenants
                (
                    name,
                    phone,
                    address,
                    identity_number
                )

                VALUES (?, ?, ?, ?)
            `, [
                tenantName,
                tenantPhone,
                tenantAddress,
                identityNumber
            ]);


        const tenantId =
            tenantResult.insertId;


        // ====================================================
        // HASH PASSWORD
        // ====================================================

        const hashedPassword =
            await bcrypt.hash(
                password,
                10
            );


        // ====================================================
        // INSERT USER
        // ====================================================

        await connection.query(`
            INSERT INTO users
            (
                name,
                username,
                password,
                role,
                tenant_id
            )

            VALUES (?, ?, ?, 'penghuni', ?)
        `, [
            tenantName,
            tenantUsername,
            hashedPassword,
            tenantId
        ]);


        // ====================================================
        // COMMIT
        // ====================================================

        await connection.commit();


        // ====================================================
        // AMBIL DATA TENANT TERBARU
        // ====================================================

        const [tenant] =
            await connection.query(`
                SELECT *

                FROM tenants

                WHERE id = ?

                LIMIT 1
            `, [
                tenantId
            ]);


        return res.status(201).json({

            success: true,

            message:
                "Penghuni dan akun login berhasil dibuat",

            data: {

                tenant:
                    tenant[0],

                username:
                    tenantUsername

            }

        });


    } catch (error) {

        try {

            await connection.rollback();

        } catch (rollbackError) {

            console.error(
                "Rollback Error:",
                rollbackError
            );

        }


        console.error(
            "Create Tenant Error:",
            error
        );


        if (
            error.code ===
            "ER_DUP_ENTRY"
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "Username atau nomor identitas sudah digunakan"

            });

        }


        return res.status(500).json({

            success: false,

            message:
                "Gagal menambahkan penghuni dan akun login",

            error:
                error.message

        });

    } finally {

        connection.release();

    }

};


// ============================================================
// UPDATE TENANT
// PUT /api/tenants/:id
// ============================================================

const updateTenant = async (req, res) => {

    try {

        const { id } =
            req.params;


        const {
            name,
            phone,
            address,
            identity_number
        } = req.body;


        // ====================================================
        // VALIDASI ID
        // ====================================================

        if (
            !id ||
            Number.isNaN(Number(id))
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "ID penghuni tidak valid"

            });

        }


        // ====================================================
        // VALIDASI NAMA
        // ====================================================

        if (
            !name ||
            !name.trim()
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Nama penghuni wajib diisi"

            });

        }


        // ====================================================
        // CEK TENANT
        // ====================================================

        const [existingTenant] =
            await db.query(`
                SELECT
                    id,
                    name

                FROM tenants

                WHERE id = ?

                LIMIT 1
            `, [
                id
            ]);


        if (
            existingTenant.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Penghuni tidak ditemukan"

            });

        }


        // ====================================================
        // NORMALISASI
        // ====================================================

        const tenantName =
            name.trim();

        const tenantPhone =
            phone
                ? phone.trim()
                : null;

        const tenantAddress =
            address
                ? address.trim()
                : null;

        const identityNumber =
            identity_number
                ? identity_number.trim()
                : null;


        // ====================================================
        // UPDATE TENANT
        // ====================================================

        await db.query(`
            UPDATE tenants

            SET

                name = ?,

                phone = ?,

                address = ?,

                identity_number = ?

            WHERE id = ?
        `, [
            tenantName,
            tenantPhone,
            tenantAddress,
            identityNumber,
            id
        ]);


        // ====================================================
        // SINKRONISASI NAMA USER
        // ====================================================

        await db.query(`
            UPDATE users

            SET name = ?

            WHERE tenant_id = ?
        `, [
            tenantName,
            id
        ]);


        // ====================================================
        // AMBIL DATA TERBARU
        // ====================================================

        const [tenant] =
            await db.query(`
                SELECT *

                FROM tenants

                WHERE id = ?

                LIMIT 1
            `, [
                id
            ]);


        return res.json({

            success: true,

            message:
                "Data penghuni berhasil diperbarui",

            data:
                tenant[0]

        });


    } catch (error) {

        console.error(
            "Update Tenant Error:",
            error
        );


        if (
            error.code ===
            "ER_DUP_ENTRY"
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "Nomor identitas sudah digunakan"

            });

        }


        return res.status(500).json({

            success: false,

            message:
                "Gagal memperbarui data penghuni",

            error:
                error.message

        });

    }

};


// ============================================================
// DELETE TENANT
// DELETE /api/tenants/:id
// ============================================================

const deleteTenant = async (req, res) => {

    const connection =
        await db.getConnection();


    try {

        const { id } =
            req.params;


        // ====================================================
        // VALIDASI ID
        // ====================================================

        if (
            !id ||
            Number.isNaN(Number(id))
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "ID penghuni tidak valid"

            });

        }


        // ====================================================
        // CEK TENANT
        // ====================================================

        const [tenants] =
            await connection.query(`
                SELECT
                    id,
                    name

                FROM tenants

                WHERE id = ?

                LIMIT 1
            `, [
                id
            ]);


        if (
            tenants.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Penghuni tidak ditemukan"

            });

        }


        const tenant =
            tenants[0];


        // ====================================================
        // CEK KONTRAK ACTIVE
        // ====================================================

        const [activeContracts] =
            await connection.query(`
                SELECT
                    id,
                    room_id,
                    status

                FROM contracts

                WHERE tenant_id = ?

                AND status = 'active'

                LIMIT 1
            `, [
                id
            ]);


        if (
            activeContracts.length > 0
        ) {

            return res.status(409).json({

                success: false,

                message:
                    `Penghuni ${tenant.name} masih memiliki kontrak aktif. Selesaikan kontrak terlebih dahulu sebelum menghapus penghuni.`

            });

        }


        // ====================================================
        // CEK RIWAYAT KONTRAK
        // ====================================================

        const [oldContracts] =
            await connection.query(`
                SELECT
                    id,
                    status

                FROM contracts

                WHERE tenant_id = ?

                LIMIT 1
            `, [
                id
            ]);


        if (
            oldContracts.length > 0
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "Penghuni sudah memiliki riwayat kontrak. Data tidak boleh dihapus agar riwayat kontrak dan tagihan tetap aman. Gunakan fitur Riwayat Penghuni."

            });

        }


        // ====================================================
        // MULAI TRANSACTION
        // ====================================================

        await connection.beginTransaction();


        // ====================================================
        // HAPUS USER PENGHUNI
        // ====================================================

        await connection.query(`
            DELETE FROM users

            WHERE tenant_id = ?
        `, [
            id
        ]);


        // ====================================================
        // DELETE TENANT
        // ====================================================

        const [result] =
            await connection.query(`
                DELETE FROM tenants

                WHERE id = ?
            `, [
                id
            ]);


        // ====================================================
        // VALIDASI HASIL DELETE
        // ====================================================

        if (
            result.affectedRows === 0
        ) {

            await connection.rollback();

            return res.status(404).json({

                success: false,

                message:
                    "Penghuni tidak ditemukan"

            });

        }


        // ====================================================
        // COMMIT
        // ====================================================

        await connection.commit();


        return res.json({

            success: true,

            message:
                `Penghuni ${tenant.name} dan akun loginnya berhasil dihapus`

        });


    } catch (error) {

        try {

            await connection.rollback();

        } catch (rollbackError) {

            console.error(
                "Rollback Error:",
                rollbackError
            );

        }


        console.error(
            "Delete Tenant Error:",
            error
        );


        if (
            error.code ===
            "ER_ROW_IS_REFERENCED_2"
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "Penghuni tidak dapat dihapus karena masih digunakan oleh data lain."

            });

        }


        return res.status(500).json({

            success: false,

            message:
                "Gagal menghapus penghuni",

            error:
                error.message

        });

    } finally {

        connection.release();

    }

};


// ============================================================
// EXPORT
// ============================================================
//
// PENTING:
// getCalonTenants dan getCalonTenantById
// HARUS diexport agar bisa dipakai tenantRoutes.js.
//
// ============================================================

module.exports = {

    getTenants,

    getAllTenants,

    getTenantById,

    getTenantHistory,

    getCalonTenants,

    getCalonTenantById,

    createTenant,

    updateTenant,

    deleteTenant

};