const db = require("../config/database");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");


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
        // PENTING:
        //
        // User penghuni bisa memiliki tenant
        // dengan status:
        //
        // calon
        // aktif
        // nonaktif
        //
        // Jadi kita harus mengambil
        // tenants.status saat login.
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
        //
        // Kalau user adalah penghuni tetapi
        // belum memiliki tenant, nilainya null.
        //
        // Kalau sudah terhubung:
        //
        // calon
        // aktif
        // nonaktif
        //
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

const register = async (req, res) => {

    let connection = null;

    try {

        // ======================================
        // AMBIL DATA FORM
        // ======================================

        const {

            name,

            phone,

            gender,

            occupation,

            address,

            identityNumber,

            boardingPurpose,

            username,

            password,

            confirmPassword

        } = req.body;


        // ======================================
        // FILE KTP
        // ======================================

        const ktpFile =
            req.file || null;


        // ======================================
        // VALIDASI FIELD WAJIB
        // ======================================

        if (
            !name ||
            !phone ||
            !gender ||
            !occupation ||
            !address ||
            !identityNumber ||
            !boardingPurpose ||
            !username ||
            !password ||
            !confirmPassword
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Semua data registrasi wajib diisi"

            });

        }


        // ======================================
        // VALIDASI FOTO KTP
        // ======================================

        if (!ktpFile) {

            return res.status(400).json({

                success: false,

                message:
                    "Foto KTP wajib diupload"

            });

        }


        // ======================================
        // BERSIHKAN INPUT
        // ======================================

        const cleanName =
            String(name).trim();

        const cleanPhone =
            String(phone).trim();

        const cleanGender =
            String(gender).trim();

        const cleanOccupation =
            String(occupation).trim();

        const cleanAddress =
            String(address).trim();

        const cleanIdentityNumber =
            String(identityNumber).trim();

        const cleanBoardingPurpose =
            String(boardingPurpose).trim();

        const cleanUsername =
            String(username).trim();


        // ======================================
        // VALIDASI NAMA
        // ======================================

        if (!cleanName) {

            return res.status(400).json({

                success: false,

                message:
                    "Nama lengkap wajib diisi"

            });

        }


        // ======================================
        // VALIDASI NOMOR HP
        // ======================================

        if (!cleanPhone) {

            return res.status(400).json({

                success: false,

                message:
                    "Nomor HP wajib diisi"

            });

        }


        if (
            !/^[0-9+\-\s]{10,20}$/.test(
                cleanPhone
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Format nomor HP tidak valid"

            });

        }


        // ======================================
        // VALIDASI GENDER
        // ======================================

        if (
            cleanGender !== "laki-laki"
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Pendaftaran ADELINA KOST hanya untuk laki-laki"

            });

        }


        // ======================================
        // VALIDASI PEKERJAAN
        // ======================================

        if (!cleanOccupation) {

            return res.status(400).json({

                success: false,

                message:
                    "Pekerjaan wajib diisi"

            });

        }


        if (
            cleanOccupation.length > 100
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Pekerjaan maksimal 100 karakter"

            });

        }


        // ======================================
        // VALIDASI ALAMAT
        // ======================================

        if (!cleanAddress) {

            return res.status(400).json({

                success: false,

                message:
                    "Alamat wajib diisi"

            });

        }


        // ======================================
        // VALIDASI NOMOR KTP
        // ======================================

        if (
            !/^[0-9]{16}$/.test(
                cleanIdentityNumber
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Nomor KTP harus terdiri dari 16 digit"

            });

        }


        // ======================================
        // VALIDASI TUJUAN NGEKOS
        // ======================================

        if (!cleanBoardingPurpose) {

            return res.status(400).json({

                success: false,

                message:
                    "Tujuan atau alasan ngekos wajib diisi"

            });

        }


        // ======================================
        // VALIDASI USERNAME
        // ======================================

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
        // CEK NOMOR KTP
        // ======================================

        const [existingTenants] =
            await db.query(`

                SELECT
                    id

                FROM tenants

                WHERE identity_number = ?

                LIMIT 1

            `, [

                cleanIdentityNumber

            ]);


        if (
            existingTenants.length > 0
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "Nomor KTP sudah terdaftar"

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
        // SIMPAN TENANT
        // ======================================
        //
        // STATUS AWAL = CALON
        //
        // ======================================

        const [tenantResult] =
            await connection.query(`

                INSERT INTO tenants
                (
                    name,
                    phone,
                    address,
                    identity_number,
                    gender,
                    boarding_purpose,
                    occupation,
                    status
                )

                VALUES
                (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    'calon'
                )

            `, [

                cleanName,

                cleanPhone,

                cleanAddress,

                cleanIdentityNumber,

                cleanGender,

                cleanBoardingPurpose,

                cleanOccupation

            ]);


        const tenantId =
            tenantResult.insertId;


        // ======================================
        // SIMPAN USER
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
                    ?
                )

            `, [

                cleanName,

                cleanUsername,

                hashedPassword,

                tenantId

            ]);


        // ======================================
        // SIMPAN DOKUMEN KTP
        // ======================================

        const filePath =
            path
                .join(
                    "uploads",
                    "ktp",
                    ktpFile.filename
                )
                .replace(
                    /\\/g,
                    "/"
                );


        await connection.query(`

            INSERT INTO tenant_documents
            (
                tenant_id,
                document_type,
                file_path
            )

            VALUES
            (
                ?,
                'ktp',
                ?
            )

        `, [

            tenantId,

            filePath

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
                "Akun berhasil dibuat. Anda terdaftar sebagai calon penghuni.",

            data: {

                user: {

                    id:
                        userResult.insertId,

                    name:
                        cleanName,

                    username:
                        cleanUsername,

                    role:
                        "penghuni",

                    tenant_id:
                        tenantId,

                    tenant_status:
                        "calon"

                },

                tenant: {

                    id:
                        tenantId,

                    name:
                        cleanName,

                    phone:
                        cleanPhone,

                    address:
                        cleanAddress,

                    identity_number:
                        cleanIdentityNumber,

                    gender:
                        cleanGender,

                    occupation:
                        cleanOccupation,

                    boarding_purpose:
                        cleanBoardingPurpose,

                    status:
                        "calon"

                },

                document: {

                    document_type:
                        "ktp",

                    file_path:
                        filePath

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
        // HAPUS FILE KTP
        // ======================================

        if (
            req.file &&
            req.file.path
        ) {

            try {

                if (
                    fs.existsSync(
                        req.file.path
                    )
                ) {

                    fs.unlinkSync(
                        req.file.path
                    );

                }

            } catch (fileError) {

                console.error(
                    "Delete Uploaded File Error:",
                    fileError
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
                    "Data sudah terdaftar"

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