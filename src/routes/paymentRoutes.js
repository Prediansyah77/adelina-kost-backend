const express = require("express");

const {
    getPayments,
    getPaymentById,
    createPayment,
    updatePayment,
    deletePayment,
    getPaymentSummary
} = require("../controllers/paymentController");


// ======================================================
// ROUTER
// ======================================================

const router = express.Router();


// ======================================================
// GET SEMUA PEMBAYARAN
// GET /api/payments
// ======================================================

router.get(
    "/",
    getPayments
);


// ======================================================
// GET REKAP PEMBAYARAN
// GET /api/payments/summary?month=8&year=2026
//
// PENTING:
// Route /summary harus diletakkan SEBELUM /:id
// supaya "summary" tidak dianggap sebagai ID.
// ======================================================

router.get(
    "/summary",
    getPaymentSummary
);


// ======================================================
// GET PEMBAYARAN BERDASARKAN ID
// GET /api/payments/:id
// ======================================================

router.get(
    "/:id",
    getPaymentById
);


// ======================================================
// CREATE PEMBAYARAN
// POST /api/payments
// ======================================================

router.post(
    "/",
    createPayment
);


// ======================================================
// UPDATE PEMBAYARAN
// PUT /api/payments/:id
// ======================================================

router.put(
    "/:id",
    updatePayment
);


// ======================================================
// DELETE PEMBAYARAN
// DELETE /api/payments/:id
// ======================================================

router.delete(
    "/:id",
    deletePayment
);


// ======================================================
// EXPORT ROUTER
// ======================================================
//
// WAJIB:
// module.exports = router
//
// Jangan:
// module.exports = { router }
// Jangan:
// module.exports = { paymentRoutes: router }
//
// Karena app.js menggunakan:
// app.use("/api/payments", paymentRoutes)
// ======================================================

module.exports = router;