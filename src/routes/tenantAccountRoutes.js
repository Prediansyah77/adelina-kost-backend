const express = require("express");

const {

    createTenantAccount,

    getTenantAccount,

    getMyTenantAccount,

    changeTenantPassword

} = require("../controllers/tenantAccountController");


const authenticateToken =
    require("../middleware/authMiddleware");


const authorizeRole =
    require("../middleware/roleMiddleware");


const router = express.Router();


// ============================================================
// CREATE TENANT ACCOUNT
// POST /api/tenant-accounts
//
// Hanya ADMIN yang boleh membuat akun penghuni.
// ============================================================

router.post(

    "/",

    authenticateToken,

    authorizeRole("admin"),

    createTenantAccount

);


// ============================================================
// GET MY TENANT ACCOUNT
// GET /api/tenant-accounts/me
//
// Hanya PENGHUNI.
//
// Penghuni hanya boleh melihat data dirinya sendiri.
//
// PENTING:
// Route /me harus diletakkan SEBELUM /:tenantId.
// ============================================================

router.get(

    "/me",

    authenticateToken,

    authorizeRole("penghuni"),

    getMyTenantAccount

);


// ============================================================
// CHANGE TENANT PASSWORD
// POST /api/tenant-accounts/change-password
//
// Hanya PENGHUNI.
//
// Penghuni hanya dapat mengganti password akun sendiri.
//
// Identitas akun diambil dari JWT:
// req.user.id
//
// Penghuni tidak dapat menentukan tenant/user lain
// melalui request.
// ============================================================

router.post(

    "/change-password",

    authenticateToken,

    authorizeRole("penghuni"),

    changeTenantPassword

);


// ============================================================
// GET TENANT ACCOUNT BY TENANT ID
// GET /api/tenant-accounts/:tenantId
//
// Hanya ADMIN.
//
// PENTING:
// Route ini diletakkan SETELAH /me dan /change-password
// agar endpoint khusus tersebut tidak dianggap sebagai
// tenantId.
// ============================================================

router.get(

    "/:tenantId",

    authenticateToken,

    authorizeRole("admin"),

    getTenantAccount

);


// ============================================================
// EXPORT
// ============================================================

module.exports = router;