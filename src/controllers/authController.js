const db = require("../config/database");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");


// ==========================================
// LOGIN
// POST /api/auth/login
// ==========================================

const login = async (req, res) => {

    try {

        const {
            username,
            password
        } = req.body;


        // ======================================
        // VALIDASI INPUT
        // ======================================

        if (
            !username ||
            !password
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Username dan password wajib diisi"

            });

        }


        // ======================================
        // CARI USER + STATUS TENANT
        // ======================================
        //
        // User penghuni bisa:
        //
        // 1. Belum memiliki tenant
        //    tenant_id = NULL
        //
        // 2. Memiliki tenant dengan status:
        //    calon
        //    aktif
        //    nonaktif
        //
        // ======================================

        const [users] =
            await db.query(`

                SELECT

                    u.id,

                    u.name,

                    u.username,

                    u.password,

                    u.role,

                    u.tenant_id,

                    t.status AS tenant_status

                FROM users u

                LEFT JOIN tenants t
                    ON u.tenant_id = t.id

                WHERE u.username = ?

                LIMIT 1

            `, [

                username

            ]);


        // ======================================
        // USER TIDAK DITEMUKAN
        // ======================================

        if (
            users.length === 0
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "Username atau password salah"

            });

        }


        const user =
            users[0];

        console.log("========== LOGIN DEBUG ==========");
        console.log("USER DARI DATABASE:", user);
        console.log("TENANT ID:", user.tenant_id);
        console.log("TENANT STATUS:", user.tenant_status);
        console.log("=================================");


        // ======================================
        // CEK PASSWORD
        // ======================================

        const passwordMatch =
            await bcrypt.compare(

                password,

                user.password

            );


        if (!passwordMatch) {

            return res.status(401).json({

                success: false,

                message:
                    "Username atau password salah"

            });

        }


        // ======================================
        // TENANT STATUS
        // ======================================

        const tenantStatus =
            user.tenant_status || null;


        // ======================================
        // BUAT JWT
        // ======================================

        const token =
            jwt.sign(

                {

                    id:
                        user.id,

                    username:
                        user.username,

                    role:
                        user.role,

                    tenant_id:
                        user.tenant_id || null,

                    tenant_status:
                        tenantStatus

                },

                process.env.JWT_SECRET,

                {

                    expiresIn:
                        "1d"

                }

            );


        // ======================================
        // RESPONSE
        // ======================================

        return res.json({

            success: true,

            message:
                "Login berhasil",

            data: {

                user: {

                    id:
                        user.id,

                    name:
                        user.name,

                    username:
                        user.username,

                    role:
                        user.role,

                    tenant_id:
                        user.tenant_id || null,

                    tenant_status:
                        tenantStatus

                },

                token

            }

        });


    } catch (error) {

        console.error(
            "Login Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Gagal melakukan login",

            error:
                error.message

        });

    }

};



// ==========================================
// REGISTER PENGHUNI
// POST /api/auth/register
// ==========================================
//
// ALUR BARU:
//
// Register hanya membuat:
//
// - username
// - password
// - role
//
// Belum membuat tenant.
//
// tenant_id = NULL
//
// Setelah login:
//
// user diarahkan ke halaman
// Lengkapi Biodata.
//
// ==========================================

const register = async (req, res) => {

    let connection = null;

    try {

        // ======================================
        // AMBIL DATA FORM
        // ======================================

        const {

            username,

            password,

            confirmPassword

        } = req.body;


        // ======================================
        // VALIDASI DATA WAJIB
        // ======================================

        if (
            !username ||
            !password ||
            !confirmPassword
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Username dan password wajib diisi"

            });

        }


        // ======================================
        // BERSIHKAN USERNAME
        // ======================================

        const cleanUsername =
            String(username).trim();


        // ======================================
        // VALIDASI USERNAME
        // ======================================

        if (!cleanUsername) {

            return res.status(400).json({

                success: false,

                message:
                    "Username wajib diisi"

            });

        }


        if (
            cleanUsername.length < 4
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Username minimal 4 karakter"

            });

        }


        if (
            cleanUsername.length > 50
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Username maksimal 50 karakter"

            });

        }


        // ======================================
        // VALIDASI USERNAME
        // ======================================
        //
        // Hanya boleh menggunakan:
        //
        // huruf
        // angka
        // underscore
        // titik
        //
        // ======================================

        if (
            !/^[a-zA-Z0-9_.]+$/.test(
                cleanUsername
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Username hanya boleh menggunakan huruf, angka, underscore, atau titik"

            });

        }


        // ======================================
        // VALIDASI PASSWORD
        // ======================================

        if (
            password.length < 6
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Password minimal 6 karakter"

            });

        }


        // ======================================
        // KONFIRMASI PASSWORD
        // ======================================

        if (
            password !== confirmPassword
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Konfirmasi password tidak sama"

            });

        }


        // ======================================
        // CEK USERNAME
        // ======================================

        const [existingUsers] =
            await db.query(`

                SELECT

                    id

                FROM users

                WHERE username = ?

                LIMIT 1

            `, [

                cleanUsername

            ]);


        if (
            existingUsers.length > 0
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "Username sudah digunakan"

            });

        }


        // ======================================
        // HASH PASSWORD
        // ======================================

        const hashedPassword =
            await bcrypt.hash(

                password,

                10

            );


        // ======================================
        // AMBIL CONNECTION
        // ======================================

        connection =
            await db.getConnection();


        // ======================================
        // MULAI TRANSACTION
        // ======================================

        await connection.beginTransaction();


        // ======================================
        // SIMPAN USER
        // ======================================
        //
        // PENTING:
        //
        // tenant_id = NULL
        //
        // Karena biodata belum diisi.
        //
        // name sementara menggunakan username
        // agar aman apabila kolom users.name
        // memiliki NOT NULL.
        //
        // Nanti setelah biodata lengkap,
        // users.name akan diperbarui
        // menjadi nama asli penghuni.
        //
        // ======================================

        const [userResult] =
            await connection.query(`

                INSERT INTO users
                (
                    name,
                    username,
                    password,
                    role,
                    tenant_id
                )

                VALUES
                (
                    ?,
                    ?,
                    ?,
                    'penghuni',
                    NULL
                )

            `, [

                cleanUsername,

                cleanUsername,

                hashedPassword

            ]);


        // ======================================
        // COMMIT TRANSACTION
        // ======================================

        await connection.commit();


        // ======================================
        // RESPONSE
        // ======================================

        return res.status(201).json({

            success: true,

            message:
                "Akun berhasil dibuat. Silakan login untuk melengkapi biodata.",

            data: {

                user: {

                    id:
                        userResult.insertId,

                    name:
                        cleanUsername,

                    username:
                        cleanUsername,

                    role:
                        "penghuni",

                    tenant_id:
                        null,

                    tenant_status:
                        null

                }

            }

        });


    } catch (error) {

        // ======================================
        // LOG ERROR
        // ======================================

        console.error(
            "Register Error:",
            error
        );


        // ======================================
        // ROLLBACK
        // ======================================

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


        // ======================================
        // DUPLICATE DATA
        // ======================================

        if (
            error.code === "ER_DUP_ENTRY"
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "Username sudah digunakan"

            });

        }


        // ======================================
        // SERVER ERROR
        // ======================================

        return res.status(500).json({

            success: false,

            message:
                "Gagal membuat akun",

            error:
                error.message

        });

    } finally {

        // ======================================
        // RELEASE CONNECTION
        // ======================================

        if (connection) {

            connection.release();

        }

    }

};



// ==========================================
// GET ME
// GET /api/auth/me
// ==========================================

const getMe = async (req, res) => {

    try {

        // ======================================
        // AMBIL USER + STATUS TENANT
        // ======================================

        const [users] =
            await db.query(`

                SELECT

                    u.id,

                    u.name,

                    u.username,

                    u.role,

                    u.tenant_id,

                    t.status AS tenant_status,

                    u.created_at

                FROM users u

                LEFT JOIN tenants t
                    ON u.tenant_id = t.id

                WHERE u.id = ?

                LIMIT 1

            `, [

                req.user.id

            ]);


        // ======================================
        // USER TIDAK DITEMUKAN
        // ======================================

        if (
            users.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "User tidak ditemukan"

            });

        }


        // ======================================
        // RESPONSE
        // ======================================

        return res.json({

            success: true,

            data: {

                user: {

                    id:
                        users[0].id,

                    name:
                        users[0].name,

                    username:
                        users[0].username,

                    role:
                        users[0].role,

                    tenant_id:
                        users[0].tenant_id || null,

                    tenant_status:
                        users[0].tenant_status || null,

                    created_at:
                        users[0].created_at

                }

            }

        });


    } catch (error) {

        console.error(
            "Get Me Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Gagal mengambil data user",

            error:
                error.message

        });

    }

};



// ==========================================
// EXPORT
// ==========================================

module.exports = {

    login,

    register,

    getMe

};