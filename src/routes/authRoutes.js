const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const {
    login,
    register
} = require("../controllers/authController");

const authenticateToken =
    require("../middleware/authMiddleware");

const authorizeRole =
    require("../middleware/roleMiddleware");

const router = express.Router();


// =====================================================
// FOLDER UPLOAD KTP
// =====================================================

const uploadDir =
    path.join(
        process.cwd(),
        "uploads",
        "ktp"
    );


// =====================================================
// BUAT FOLDER JIKA BELUM ADA
// =====================================================

if (!fs.existsSync(uploadDir)) {

    fs.mkdirSync(
        uploadDir,
        {
            recursive: true
        }
    );

}


// =====================================================
// MULTER STORAGE
// =====================================================

const storage =
    multer.diskStorage({

        destination: (
            req,
            file,
            cb
        ) => {

            cb(
                null,
                uploadDir
            );

        },


        filename: (
            req,
            file,
            cb
        ) => {

            const extension =
                path
                    .extname(
                        file.originalname
                    )
                    .toLowerCase();


            const filename =
                `ktp-${Date.now()}-${Math.round(
                    Math.random() * 1E9
                )}${extension}`;


            cb(
                null,
                filename
            );

        }

    });


// =====================================================
// FILTER FILE KTP
// =====================================================

const fileFilter =
    (
        req,
        file,
        cb
    ) => {

        const allowedTypes = [

            "image/jpeg",

            "image/jpg",

            "image/png",

            "image/webp"

        ];


        if (
            allowedTypes.includes(
                file.mimetype
            )
        ) {

            cb(
                null,
                true
            );

        } else {

            cb(
                new Error(
                    "Foto KTP harus berupa JPG, JPEG, PNG, atau WEBP"
                ),
                false
            );

        }

    };


// =====================================================
// MULTER UPLOAD
// =====================================================

const upload =
    multer({

        storage,

        fileFilter,

        limits: {

            fileSize:
                5 * 1024 * 1024

        }

    });


// =====================================================
// LOGIN
// POST /api/auth/login
// =====================================================

router.post(

    "/login",

    login

);


// =====================================================
// REGISTER PENGHUNI
// POST /api/auth/register
//
// Content-Type:
// multipart/form-data
//
// Nama field file:
// ktp
// =====================================================

router.post(

    "/register",

    upload.single("ktp"),

    register

);


// =====================================================
// ADMIN TEST
// GET /api/auth/admin-test
// =====================================================

router.get(

    "/admin-test",

    authenticateToken,

    authorizeRole("admin"),

    (req, res) => {

        res.json({

            success: true,

            message:
                "Akses admin berhasil",

            data: {

                user:
                    req.user

            }

        });

    }

);


// =====================================================
// ERROR HANDLER MULTER
// =====================================================

router.use(

    (
        error,
        req,
        res,
        next
    ) => {


        // ==========================================
        // ERROR DARI MULTER
        // ==========================================

        if (
            error instanceof multer.MulterError
        ) {


            // ======================================
            // FILE TERLALU BESAR
            // ======================================

            if (
                error.code ===
                "LIMIT_FILE_SIZE"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Ukuran foto KTP maksimal 5 MB"

                });

            }


            // ======================================
            // ERROR MULTER LAINNYA
            // ======================================

            return res.status(400).json({

                success: false,

                message:
                    `Upload KTP gagal: ${error.message}`

            });

        }


        // ==========================================
        // ERROR FORMAT FILE
        // ==========================================

        if (

            error &&

            error.message &&

            error.message.includes(
                "Foto KTP harus"
            )

        ) {

            return res.status(400).json({

                success: false,

                message:
                    error.message

            });

        }


        // ==========================================
        // LANJUTKAN ERROR LAIN
        // ==========================================

        next(error);

    }

);


// =====================================================
// EXPORT ROUTER
// =====================================================

module.exports = router;