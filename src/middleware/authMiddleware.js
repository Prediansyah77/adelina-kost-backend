const jwt = require("jsonwebtoken");


// ==========================================
// JWT AUTHENTICATION MIDDLEWARE
// ==========================================
//
// Tugas middleware:
//
// 1. Mengambil token dari Authorization header
// 2. Memastikan format Bearer TOKEN
// 3. Memverifikasi JWT
// 4. Menyimpan data JWT ke req.user
//
// Data seperti:
// - id
// - username
// - role
// - tenant_id
//
// akan otomatis tersedia di req.user
// jika memang dimasukkan saat login.
//
// ==========================================


const authenticateToken = (req, res, next) => {

    try {

        // ======================================
        // AMBIL HEADER AUTHORIZATION
        // ======================================

        const authHeader =
            req.headers.authorization;


        // ======================================
        // CEK TOKEN
        // ======================================

        if (!authHeader) {

            return res.status(401).json({

                success: false,

                message:
                    "Token tidak ditemukan"

            });

        }


        // ======================================
        // FORMAT TOKEN
        // ======================================
        //
        // Format yang benar:
        //
        // Authorization: Bearer TOKEN
        //
        // ======================================

        const parts =
            authHeader.split(" ");


        if (
            parts.length !== 2 ||
            parts[0] !== "Bearer" ||
            !parts[1]
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "Format token tidak valid"

            });

        }


        const token =
            parts[1];


        // ======================================
        // VERIFIKASI JWT
        // ======================================

        const decoded =
            jwt.verify(
                token,
                process.env.JWT_SECRET
            );


        // ======================================
        // SIMPAN DATA USER
        // ======================================
        //
        // Contoh req.user:
        //
        // {
        //     id: 5,
        //     username: "satrio",
        //     role: "penghuni",
        //     tenant_id: 6
        // }
        //
        // Untuk ADMIN:
        //
        // {
        //     id: 1,
        //     username: "admin",
        //     role: "admin",
        //     tenant_id: null
        // }
        //
        // ======================================

        req.user =
            decoded;


        // ======================================
        // LANJUT KE ROUTE / CONTROLLER
        // ======================================

        next();


    } catch (error) {

        console.error(
            "JWT Middleware Error:",
            error.message
        );


        return res.status(401).json({

            success: false,

            message:
                "Token tidak valid atau sudah kedaluwarsa"

        });

    }

};


module.exports =
    authenticateToken;