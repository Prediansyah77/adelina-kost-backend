const multer = require("multer");
const path = require("path");
const fs = require("fs");


// ============================================================
// FOLDER UPLOAD FOTO PROFIL
// ============================================================

const uploadProfileDir = path.join(
    __dirname,
    "../../uploads/profile"
);


// ============================================================
// FOLDER UPLOAD KTP
// ============================================================

const uploadKtpDir = path.join(
    __dirname,
    "../../uploads/ktp"
);


// ============================================================
// BUAT FOLDER JIKA BELUM ADA
// ============================================================

if (!fs.existsSync(uploadProfileDir)) {

    fs.mkdirSync(uploadProfileDir, {
        recursive: true
    });

}


if (!fs.existsSync(uploadKtpDir)) {

    fs.mkdirSync(uploadKtpDir, {
        recursive: true
    });

}


// ============================================================
// STORAGE FOTO PROFIL
// ============================================================

const profileStorage = multer.diskStorage({

    destination: (req, file, cb) => {

        cb(null, uploadProfileDir);

    },

    filename: (req, file, cb) => {

        const extension =
            path.extname(file.originalname)
                .toLowerCase();

        const filename =
            `profile-${req.params.id}-${Date.now()}${extension}`;

        cb(null, filename);

    }

});


// ============================================================
// STORAGE KTP
// ============================================================

const ktpStorage = multer.diskStorage({

    destination: (req, file, cb) => {

        cb(null, uploadKtpDir);

    },

    filename: (req, file, cb) => {

        const extension =
            path.extname(file.originalname)
                .toLowerCase();

        const filename =
            `ktp-${Date.now()}${extension}`;

        cb(null, filename);

    }

});


// ============================================================
// FILTER FILE
// ============================================================

const fileFilter = (req, file, cb) => {

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

        cb(null, true);

    } else {

        cb(
            new Error(
                "Format foto harus JPG, JPEG, PNG, atau WEBP"
            ),
            false
        );

    }

};


// ============================================================
// UPLOAD FOTO PROFIL
// ============================================================

const uploadProfile = multer({

    storage: profileStorage,

    fileFilter,

    limits: {

        fileSize: 2 * 1024 * 1024

    }

});


// ============================================================
// UPLOAD KTP
// ============================================================

const uploadKtp = multer({

    storage: ktpStorage,

    fileFilter,

    limits: {

        fileSize: 2 * 1024 * 1024

    }

});


// ============================================================
// EXPORT
// ============================================================

module.exports = {

    uploadProfile,

    uploadKtp

};