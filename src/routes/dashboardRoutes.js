const express = require("express");

const {
    getDashboardSummary,
    getMonthlyBillSummary,
    getMonthlyDashboard,
    getFinancialDashboard,
    getFinancialReport,
    getMonthlyFinancialReport
} = require("../controllers/dashboardController");

const router = express.Router();

// ============================
// DASHBOARD SUMMARY
// ============================
router.get("/summary", getDashboardSummary);

// ============================
// MONTHLY DASHBOARD
// ============================
router.get("/monthly", getMonthlyDashboard);

// ============================
// MONTHLY BILL SUMMARY
// ============================
router.get("/monthly-bills", getMonthlyBillSummary);

// ============================
// FINANCIAL DASHBOARD
// ============================
router.get("/financial", getFinancialDashboard);

// ============================
// FINANCIAL REPORT
// ============================
router.get("/financial-report", getFinancialReport);

// ============================
// MONTHLY FINANCIAL REPORT
// ============================
router.get(
    "/monthly-financial-report",
    getMonthlyFinancialReport
);

module.exports = router;