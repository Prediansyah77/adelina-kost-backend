const express = require("express");

const {
    getBills,
    getBillById,
    createBill,
    generateMonthlyBills,
    updateBill,
    deleteBill
} = require("../controllers/billController");

const router = express.Router();


// =====================================================
// GET SEMUA TAGIHAN
// GET /api/bills
// =====================================================
router.get("/", getBills);


// =====================================================
// GET TAGIHAN BERDASARKAN ID
// GET /api/bills/:id
// =====================================================
router.get("/:id", getBillById);


// =====================================================
// POST MEMBUAT TAGIHAN MANUAL
// POST /api/bills
// =====================================================
router.post("/", createBill);


// =====================================================
// POST GENERATE TAGIHAN BULANAN
// POST /api/bills/generate
// =====================================================
router.post("/generate", generateMonthlyBills);


// =====================================================
// PUT UPDATE TAGIHAN
// PUT /api/bills/:id
// =====================================================
router.put("/:id", updateBill);


// =====================================================
// PATCH UPDATE TAGIHAN
// PATCH /api/bills/:id
// =====================================================
router.patch("/:id", updateBill);


// =====================================================
// DELETE TAGIHAN
// DELETE /api/bills/:id
// =====================================================
router.delete("/:id", deleteBill);


module.exports = router;