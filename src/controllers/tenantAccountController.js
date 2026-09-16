const db = require("../config/database");
const bcrypt = require("bcrypt");


// ============================================================
// CREATE TENANT ACCOUNT
// POST /api/tenant-accounts
//
// Membuat akun login untuk penghuni yang sudah ada.
//
// Relasi:
// users.tenant_id -> tenants.id
//
// role:
// penghuni
// ============================================================

const createTenantAccount = async (req, res) => {

    const connection = await db.getConnection();

    try {

        const {
            tenant_id,
            username,
            password
        } = req.body;


        // ====================================================
        // VALIDASI TENANT
        // ====================================================

        if (!tenant_id) {

            return res.status(400).json({

                success: false,

                message:
                    "Tenant wajib dipilih"

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
                    "Username wajib diisi"

            });

        }


        if (
            username.trim().length < 4
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
            !password ||
            !password.trim()
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Password wajib diisi"

            });

        }


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
        // NORMALISASI USERNAME
        // ====================================================

        const tenantUsername =
            username.trim();


        // ====================================================
        // CEK TENANT
        // ====================================================

        const [tenants] =
            await connection.query(`
                SELECT
                    id,
                    name,
                    status
                FROM tenants
                WHERE id = ?
                LIMIT 1
            `, [
                tenant_id
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
        // CEK APAKAH TENANT SUDAH MEMILIKI AKUN
        // ====================================================

        const [existingTenantAccount] =
            await connection.query(`
                SELECT
                    id,
                    username
                FROM users
                WHERE tenant_id = ?
                AND role = 'penghuni'
                LIMIT 1
            `, [
                tenant_id
            ]);


        if (
            existingTenantAccount.length > 0
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "Penghuni ini sudah memiliki akun login"

            });

        }


        // ====================================================
        // CEK USERNAME
        // ====================================================

        const [existingUsername] =
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
            existingUsername.length > 0
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "Username sudah digunakan"

            });

        }


        // ====================================================
        // HASH PASSWORD
        // ====================================================

        const hashedPassword =
            await bcrypt.hash(
                password,
                10
            );


        // ====================================================
        // MULAI TRANSACTION
        // ====================================================

        await connection.beginTransaction();


        // ====================================================
        // INSERT USER
        // ====================================================

        const [result] =
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

                tenant.name,

                tenantUsername,

                hashedPassword,

                tenant_id

            ]);


        // ====================================================
        // COMMIT
        // ====================================================

        await connection.commit();


        // ====================================================
        // RESPONSE
        // ====================================================

        return res.status(201).json({

            success: true,

            message:
                "Akun login penghuni berhasil dibuat",

            data: {

                id:
                    result.insertId,

                tenant_id:
                    tenant.id,

                tenant_name:
                    tenant.name,

                tenant_status:
                    tenant.status,

                username:
                    tenantUsername,

                role:
                    "penghuni"

            }

        });


    } catch (error) {

        // ====================================================
        // ROLLBACK
        // ====================================================

        try {

            await connection.rollback();

        } catch (rollbackError) {

            console.error(
                "Rollback Error:",
                rollbackError
            );

        }


        console.error(
            "Create Tenant Account Error:",
            error
        );


        // ====================================================
        // DUPLICATE ERROR
        // ====================================================

        if (
            error.code === "ER_DUP_ENTRY"
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "Username sudah digunakan"

            });

        }


        // ====================================================
        // SERVER ERROR
        // ====================================================

        return res.status(500).json({

            success: false,

            message:
                "Gagal membuat akun penghuni",

            error:
                error.message

        });


    } finally {

        connection.release();

    }

};



// ============================================================
// GET TENANT ACCOUNT
// GET /api/tenant-accounts/:tenantId
//
// Hanya ADMIN.
//
// Digunakan admin untuk mengecek apakah penghuni
// sudah memiliki akun login.
//
// PASSWORD TIDAK PERNAH DIKIRIM.
// ============================================================

const getTenantAccount = async (req, res) => {

    try {

        const {
            tenantId
        } = req.params;


        // ====================================================
        // VALIDASI ID
        // ====================================================

        if (
            !tenantId ||
            Number.isNaN(Number(tenantId))
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "ID penghuni tidak valid"

            });

        }


        // ====================================================
        // AMBIL AKUN
        // ====================================================

        const [users] =
            await db.query(`
                SELECT
                    id,
                    name,
                    username,
                    role,
                    tenant_id,
                    created_at
                FROM users
                WHERE tenant_id = ?
                AND role = 'penghuni'
                LIMIT 1
            `, [
                tenantId
            ]);


        // ====================================================
        // BELUM MEMILIKI AKUN
        // ====================================================

        if (
            users.length === 0
        ) {

            return res.json({

                success: true,

                data: null

            });

        }


        // ====================================================
        // RESPONSE
        // ====================================================

        return res.json({

            success: true,

            data:
                users[0]

        });


    } catch (error) {

        console.error(
            "Get Tenant Account Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Gagal mengambil akun penghuni",

            error:
                error.message

        });

    }

};



// ============================================================
// GET MY TENANT ACCOUNT
// GET /api/tenant-accounts/me
//
// Hanya PENGHUNI.
//
// Fungsi:
//
// 1. Calon penghuni:
//    tenant_id = NULL
//
//    -> tetap boleh masuk
//    -> tenant = null
//    -> contract = null
//
// 2. Penghuni yang sudah terhubung:
//    tenant_id memiliki nilai
//
//    -> ambil data tenant
//    -> ambil status tenant
//    -> ambil kontrak aktif
//    -> ambil kamar
//
// PASSWORD TIDAK PERNAH DIKIRIM.
// ============================================================

const getMyTenantAccount = async (req, res) => {

    try {

        // ====================================================
        // CEK AUTHENTICATION
        // ====================================================

        if (!req.user) {

            return res.status(401).json({

                success: false,

                message:
                    "User belum terautentikasi"

            });

        }


        // ====================================================
        // AMBIL USER ID
        // ====================================================

        const userId =
            req.user.id;


        // ====================================================
        // VALIDASI USER ID
        // ====================================================

        if (
            !userId ||
            Number.isNaN(Number(userId))
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "Identitas pengguna tidak valid"

            });

        }


        // ====================================================
        // AMBIL TENANT ID DARI JWT
        // ====================================================

        const tenantId =
            req.user.tenant_id;


        // ====================================================
        // ====================================================
        // CALON PENGHUNI
        // ====================================================
        //
        // tenant_id NULL berarti akun belum terhubung
        // dengan data tenant.
        //
        // Ini bukan error.
        //
        // Akun tetap bisa login sebagai:
        //
        // CALON PENGHUNI
        // ====================================================
        // ====================================================

        if (
            tenantId === null ||
            tenantId === undefined ||
            tenantId === ""
        ) {

            return res.json({

                success: true,

                data: {

                    // ========================================
                    // USER ACCOUNT
                    // ========================================

                    user: {

                        id:
                            req.user.id,

                        username:
                            req.user.username || "",

                        email:
                            req.user.email || "",

                        role:
                            req.user.role

                    },


                    // ========================================
                    // TENANT
                    // ========================================

                    tenant: null,


                    // ========================================
                    // CONTRACT
                    // ========================================

                    contract: null

                }

            });

        }


        // ====================================================
        // VALIDASI TENANT ID
        // ====================================================

        if (
            Number.isNaN(Number(tenantId))
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "Tenant ID tidak valid"

            });

        }


        // ====================================================
        // AMBIL DATA TENANT
        // + USER
        // + EMAIL USER
        // + STATUS TENANT
        // + KONTRAK AKTIF
        // + KAMAR
        // ====================================================

        const [rows] =
            await db.query(`

                SELECT

                    -- ========================================
                    -- TENANT
                    -- ========================================

                    t.id AS tenant_id,

                    t.name AS tenant_name,

                    t.phone,

                    t.address,

                    t.identity_number,

                    t.profile_photo,

                    t.status AS tenant_status,

                    t.created_at AS tenant_created_at,


                    -- ========================================
                    -- USER
                    -- ========================================

                    u.id AS user_id,

                    u.username,

                    u.email,

                    u.role,


                    -- ========================================
                    -- CONTRACT
                    -- ========================================

                    c.id AS contract_id,

                    c.room_id,

                    c.start_date,

                    c.end_date,

                    c.monthly_price,

                    c.status AS contract_status,


                    -- ========================================
                    -- ROOM
                    -- ========================================

                    r.room_number


                FROM tenants t


                INNER JOIN users u

                    ON u.tenant_id = t.id

                    AND u.id = ?

                    AND u.role = 'penghuni'


                LEFT JOIN contracts c

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


                WHERE
                    t.id = ?

                LIMIT 1

            `, [

                userId,

                tenantId

            ]);


        // ====================================================
        // DATA TIDAK DITEMUKAN
        // ====================================================

        if (
            rows.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Data penghuni tidak ditemukan"

            });

        }


        // ====================================================
        // DATA HASIL QUERY
        // ====================================================

        const tenant =
            rows[0];


        // ====================================================
        // RESPONSE
        // ====================================================

        return res.json({

            success: true,

            data: {

                // ============================================
                // USER ACCOUNT
                // ============================================

                user: {

                    id:
                        tenant.user_id,

                    username:
                        tenant.username,

                    email:
                        tenant.email,

                    role:
                        tenant.role

                },


                // ============================================
                // DATA TENANT
                // ============================================

                tenant: {

                    id:
                        tenant.tenant_id,

                    name:
                        tenant.tenant_name,

                    phone:
                        tenant.phone,

                    address:
                        tenant.address,

                    identity_number:
                        tenant.identity_number,

                    profile_photo:
                        tenant.profile_photo,

                    status:
                        tenant.tenant_status,

                    created_at:
                        tenant.tenant_created_at

                },


                // ============================================
                // CONTRACT
                // ============================================

                contract:

                    tenant.contract_id

                        ? {

                            id:
                                tenant.contract_id,

                            room_id:
                                tenant.room_id,

                            room_number:
                                tenant.room_number,

                            start_date:
                                tenant.start_date,

                            end_date:
                                tenant.end_date,

                            monthly_price:
                                tenant.monthly_price,

                            status:
                                tenant.contract_status

                        }

                        : null

            }

        });


    } catch (error) {

        console.error(
            "Get My Tenant Account Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Gagal mengambil data akun penghuni",

            error:
                error.message

        });

    }

};



// ============================================================
// CHANGE TENANT PASSWORD
// POST /api/tenant-accounts/change-password
//
// Hanya PENGHUNI.
//
// Penghuni hanya dapat mengganti password akun sendiri.
//
// User ditentukan berdasarkan:
//
// req.user.id
//
// Password lama diverifikasi menggunakan bcrypt.
//
// Password baru disimpan dalam bentuk hash.
//
// Password tidak pernah dikirim dalam response.
// ============================================================

const changeTenantPassword = async (req, res) => {

    try {

        // ====================================================
        // CEK AUTHENTICATION
        // ====================================================

        if (!req.user) {

            return res.status(401).json({

                success: false,

                message:
                    "User belum terautentikasi"

            });

        }


        // ====================================================
        // AMBIL USER ID DARI JWT
        // ====================================================

        const userId =
            req.user.id;


        // ====================================================
        // VALIDASI USER ID
        // ====================================================

        if (
            !userId ||
            Number.isNaN(Number(userId))
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "Identitas pengguna tidak valid"

            });

        }


        // ====================================================
        // AMBIL DATA PASSWORD
        // ====================================================

        const {
            current_password,
            new_password,
            confirm_password
        } = req.body;


        // ====================================================
        // VALIDASI PASSWORD LAMA
        // ====================================================

        if (
            !current_password ||
            !current_password.trim()
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Password lama wajib diisi"

            });

        }


        // ====================================================
        // VALIDASI PASSWORD BARU
        // ====================================================

        if (
            !new_password ||
            !new_password.trim()
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Password baru wajib diisi"

            });

        }


        if (
            new_password.length < 6
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Password baru minimal 6 karakter"

            });

        }


        // ====================================================
        // VALIDASI KONFIRMASI PASSWORD
        // ====================================================

        if (
            !confirm_password ||
            !confirm_password.trim()
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Konfirmasi password wajib diisi"

            });

        }


        if (
            new_password !==
            confirm_password
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Konfirmasi password tidak cocok"

            });

        }


        // ====================================================
        // CARI USER
        // ====================================================

        const [users] =
            await db.query(`
                SELECT

                    id,

                    name,

                    username,

                    password,

                    role,

                    tenant_id

                FROM users

                WHERE id = ?

                LIMIT 1
            `, [
                userId
            ]);


        // ====================================================
        // USER TIDAK DITEMUKAN
        // ====================================================

        if (
            users.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Akun pengguna tidak ditemukan"

            });

        }


        const user =
            users[0];


        // ====================================================
        // PASTIKAN ROLE PENGHUNI
        // ====================================================

        if (
            user.role !== "penghuni"
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "Fitur ini hanya tersedia untuk penghuni"

            });

        }


        // ====================================================
        // CEK PASSWORD LAMA
        // ====================================================

        const passwordMatch =
            await bcrypt.compare(
                current_password,
                user.password
            );


        if (!passwordMatch) {

            return res.status(401).json({

                success: false,

                message:
                    "Password lama salah"

            });

        }


        // ====================================================
        // PASSWORD BARU HARUS BERBEDA
        // ====================================================

        const samePassword =
            await bcrypt.compare(
                new_password,
                user.password
            );


        if (
            samePassword
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Password baru harus berbeda dari password lama"

            });

        }


        // ====================================================
        // HASH PASSWORD BARU
        // ====================================================

        const hashedPassword =
            await bcrypt.hash(
                new_password,
                10
            );


        // ====================================================
        // UPDATE PASSWORD
        // ====================================================

        await db.query(`
            UPDATE users

            SET password = ?

            WHERE id = ?
        `, [
            hashedPassword,
            userId
        ]);


        // ====================================================
        // RESPONSE
        // ====================================================

        return res.json({

            success: true,

            message:
                "Password berhasil diubah"

        });


    } catch (error) {

        console.error(
            "Change Tenant Password Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Gagal mengubah password",

            error:
                error.message

        });

    }

};



// ============================================================
// EXPORT
// ============================================================

module.exports = {

    createTenantAccount,

    getTenantAccount,

    getMyTenantAccount,

    changeTenantPassword

};