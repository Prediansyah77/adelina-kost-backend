const express = require("express");

const {
    getFinancialReport
} = require("../controllers/reportController");

const router = express.Router();


// =====================================================
// GET LAPORAN KEUANGAN
// GET /api/reports?month=8&year=2026
// =====================================================

router.get(
    "/",
    getFinancialReport
);


module.exports = router;