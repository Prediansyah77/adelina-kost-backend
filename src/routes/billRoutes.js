const express = require("express");

const {

    getBills,

    getBillById,

    createBill,

    generateMonthlyBills,

    updateBill,

    deleteBill,

    getMyBills

} = require("../controllers/billController");


const authenticateToken =
    require("../middleware/authMiddleware");


const authorizeRole =
    require("../middleware/roleMiddleware");


const router = express.Router();


// =====================================================
// GET SEMUA TAGIHAN
// GET /api/bills
//
// ADMIN
// =====================================================

router.get(

    "/",

    authenticateToken,

    authorizeRole("admin"),

    getBills

);


// =====================================================
// GET TAGIHAN SAYA
// GET /api/bills/my-bills
//
// PENGHUNI
//
// Tenant ID diambil dari JWT.
// Penghuni hanya bisa melihat tagihan miliknya sendiri.
//
// PENTING:
// Route /my-bills harus diletakkan SEBELUM /:id.
// =====================================================

router.get(

    "/my-bills",

    authenticateToken,

    authorizeRole("penghuni"),

    getMyBills

);


// =====================================================
// GET TAGIHAN BERDASARKAN ID
// GET /api/bills/:id
//
// ADMIN
// =====================================================

router.get(

    "/:id",

    authenticateToken,

    authorizeRole("admin"),

    getBillById

);


// =====================================================
// POST MEMBUAT TAGIHAN MANUAL
// POST /api/bills
//
// ADMIN
// =====================================================

router.post(

    "/",

    authenticateToken,

    authorizeRole("admin"),

    createBill

);


// =====================================================
// POST GENERATE TAGIHAN BULANAN
// POST /api/bills/generate
//
// ADMIN
// =====================================================

router.post(

    "/generate",

    authenticateToken,

    authorizeRole("admin"),

    generateMonthlyBills

);


// =====================================================
// PUT UPDATE TAGIHAN
// PUT /api/bills/:id
//
// ADMIN
// =====================================================

router.put(

    "/:id",

    authenticateToken,

    authorizeRole("admin"),

    updateBill

);


// =====================================================
// PATCH UPDATE TAGIHAN
// PATCH /api/bills/:id
//
// ADMIN
// =====================================================

router.patch(

    "/:id",

    authenticateToken,

    authorizeRole("admin"),

    updateBill

);


// =====================================================
// DELETE TAGIHAN
// DELETE /api/bills/:id
//
// ADMIN
// =====================================================

router.delete(

    "/:id",

    authenticateToken,

    authorizeRole("admin"),

    deleteBill

);


// =====================================================
// EXPORT
// =====================================================

module.exports = router;