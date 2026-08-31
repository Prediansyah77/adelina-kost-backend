const multer = require("multer");
const path = require("path");
const fs = require("fs");


// =====================================================
// FOLDER UPLOAD
// =====================================================

const uploadDir =
    path.join(
        __dirname,
        "../../uploads/payment-proofs"
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
// STORAGE
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
                path.extname(
                    file.originalname
                ).toLowerCase();


            const uniqueName =
                `payment-${Date.now()}-${Math.round(
                    Math.random() * 1E9
                )}${extension}`;


            cb(
                null,
                uniqueName
            );

        }

    });


// =====================================================
// FILTER FILE
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
                    "Bukti pembayaran harus berupa JPG, JPEG, PNG, atau WEBP"
                ),
                false
            );

        }

    };


// =====================================================
// MULTER
// =====================================================

const uploadPaymentProof =
    multer({

        storage,

        fileFilter,

        limits: {

            fileSize:
                5 * 1024 * 1024

        }

    });


module.exports =
    uploadPaymentProof;