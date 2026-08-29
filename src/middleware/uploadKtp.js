const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join(
    __dirname,
    "..",
    "uploads",
    "ktp"
);

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, {
        recursive: true
    });
}

const storage = multer.diskStorage({

    destination: (req, file, cb) => {

        cb(null, uploadDir);

    },

    filename: (req, file, cb) => {

        const tenantId =
            req.params.tenantId;

        const extension =
            path.extname(
                file.originalname
            ).toLowerCase();

        const uniqueName =
            `tenant-${tenantId}-ktp-${Date.now()}${extension}`;

        cb(
            null,
            uniqueName
        );

    }

});

const fileFilter = (
    req,
    file,
    cb
) => {

    const allowedMimeTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (
        allowedMimeTypes.includes(
            file.mimetype
        )
    ) {

        cb(null, true);

    } else {

        cb(
            new Error(
                "Format file KTP harus JPG, PNG, atau WEBP"
            )
        );

    }

};

const uploadKtp =
    multer({

        storage,

        fileFilter,

        limits: {

            fileSize:
                5 * 1024 * 1024

        }

    });

module.exports =
    uploadKtp;