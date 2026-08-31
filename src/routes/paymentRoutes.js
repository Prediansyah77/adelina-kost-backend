const express = require("express");

const {
    getPayments,
    getPaymentById,
    createPayment,
    createTenantPayment,
    createBookingPayment,
    verifyPayment,
    verifyBookingPayment,
    rejectPayment,
    updatePayment,
    deletePayment,
    getPaymentSummary,
    getMyPayments
} = require("../controllers/paymentController");

const authenticateToken =
    require("../middleware/authMiddleware");

const authorizeRole =
    require("../middleware/roleMiddleware");

const uploadPaymentProof =
    require("../middleware/paymentUpload");


// ======================================================
// DEBUG
// ======================================================

console.log(
    "DEBUG paymentRoutes:",
    {

        createTenantPayment:
            typeof createTenantPayment,

        createBookingPayment:
            typeof createBookingPayment,

        verifyPayment:
            typeof verifyPayment,

        verifyBookingPayment:
            typeof verifyBookingPayment,

        rejectPayment:
            typeof rejectPayment,

        authenticateToken:
            typeof authenticateToken,

        authorizeRole:
            typeof authorizeRole,

        uploadPaymentProof:
            typeof uploadPaymentProof,

        getPayments:
            typeof getPayments,

        getPaymentById:
            typeof getPaymentById,

        createPayment:
            typeof createPayment,

        updatePayment:
            typeof updatePayment,

        deletePayment:
            typeof deletePayment,

        getPaymentSummary:
            typeof getPaymentSummary,

        getMyPayments:
            typeof getMyPayments

    }
);


// ======================================================
// ROUTER
// ======================================================

const router =
    express.Router();


// ======================================================
// GET SEMUA PEMBAYARAN
//
// GET /api/payments
//
// KHUSUS ADMIN
// ======================================================

router.get(

    "/",

    authenticateToken,

    authorizeRole("admin"),

    getPayments

);


// ======================================================
// GET REKAP PEMBAYARAN
//
// GET /api/payments/summary
//
// CONTOH:
//
// /api/payments/summary?month=9&year=2026
//
// KHUSUS ADMIN
//
// PENTING:
// Route ini harus berada sebelum /:id
// ======================================================

router.get(

    "/summary",

    authenticateToken,

    authorizeRole("admin"),

    getPaymentSummary

);


// ======================================================
// GET PEMBAYARAN MILIK PENGHUNI
//
// GET /api/payments/my-payments
//
// KHUSUS PENGHUNI
//
// Digunakan oleh:
// TenantDashboard.jsx
//
// Untuk menampilkan:
// - pembayaran terakhir
// - status pembayaran
// - nominal
// - tanggal pembayaran
// - metode pembayaran
// - bukti pembayaran
// ======================================================
//
// PENTING:
// Route ini HARUS berada sebelum:
//
// /:id
//
// Karena kalau setelah /:id,
// "my-payments" akan dianggap sebagai ID.
// ======================================================

router.get(

    "/my-payments",

    authenticateToken,

    authorizeRole("penghuni"),

    getMyPayments

);


// ======================================================
// CREATE PEMBAYARAN DARI PENGHUNI
//
// POST /api/payments/tenant
//
// KHUSUS PENGHUNI
//
// Alur:
//
// PENGHUNI
//     ↓
// Upload bukti transfer
//     ↓
// Submit pembayaran
//     ↓
// status = pending
//     ↓
// ADMIN VERIFIKASI / TOLAK
//
// ======================================================

router.post(

    "/tenant",

    authenticateToken,

    authorizeRole("penghuni"),

    uploadPaymentProof.single(
        "proof_file"
    ),

    createTenantPayment

);


// ======================================================
// CREATE PEMBAYARAN BOOKING
//
// POST /api/payments/booking
//
// KHUSUS PENGHUNI
//
// Alur:
//
// pilih kamar
//     ↓
// pilih lama booking 1 - 7 hari
//     ↓
// upload bukti transfer
//     ↓
// kirim pembayaran
//
// Status payment:
// pending
//
// Status booking:
// pending
//
// Status kamar:
// available → booked
//
// Saldo bank:
// BELUM bertambah
//
// Saldo bertambah setelah admin
// melakukan verifikasi.
// ======================================================

router.post(

    "/booking",

    authenticateToken,

    authorizeRole("penghuni"),

    uploadPaymentProof.single(
        "proof_file"
    ),

    createBookingPayment

);


// ======================================================
// VERIFY PEMBAYARAN BOOKING
//
// PATCH /api/payments/booking/:id/verify
//
// KHUSUS ADMIN
//
// Alur:
//
// payment pending
//       ↓
// admin verifikasi
//       ↓
// payment verified
//       ↓
// booking approved
//       ↓
// saldo bank bertambah
//
// ======================================================

router.patch(

    "/booking/:id/verify",

    authenticateToken,

    authorizeRole("admin"),

    verifyBookingPayment

);


// ======================================================
// VERIFY PEMBAYARAN TAGIHAN
//
// PATCH /api/payments/:id/verify
//
// KHUSUS ADMIN
//
// Alur:
//
// pending
//    ↓
// verified
//    ↓
// saldo bank bertambah
//    ↓
// bill diperbarui
//    ↓
// jika lunas → next bill dibuat
//
// ======================================================

router.patch(

    "/:id/verify",

    authenticateToken,

    authorizeRole("admin"),

    verifyPayment

);


// ======================================================
// REJECT PEMBAYARAN
//
// PATCH /api/payments/:id/reject
//
// KHUSUS ADMIN
//
// Alur:
//
// pending
//    ↓
// rejected
//
// Saldo bank:
// TIDAK berubah
//
// Bill:
// tetap unpaid
//
// Tenant:
// bisa melakukan pembayaran ulang
//
// ======================================================

router.patch(

    "/:id/reject",

    authenticateToken,

    authorizeRole("admin"),

    rejectPayment

);


// ======================================================
// GET PEMBAYARAN BERDASARKAN ID
//
// GET /api/payments/:id
//
// KHUSUS ADMIN
//
// PENTING:
// Route ini diletakkan setelah route khusus
// seperti:
//
// /summary
// /my-payments
//
// ======================================================

router.get(

    "/:id",

    authenticateToken,

    authorizeRole("admin"),

    getPaymentById

);


// ======================================================
// CREATE PEMBAYARAN ADMIN
//
// POST /api/payments
//
// KHUSUS ADMIN
//
// Fitur pembayaran manual/admin
// tetap dipertahankan.
// ======================================================

router.post(

    "/",

    authenticateToken,

    authorizeRole("admin"),

    createPayment

);


// ======================================================
// UPDATE PEMBAYARAN
//
// PUT /api/payments/:id
//
// KHUSUS ADMIN
// ======================================================

router.put(

    "/:id",

    authenticateToken,

    authorizeRole("admin"),

    updatePayment

);


// ======================================================
// DELETE PEMBAYARAN
//
// DELETE /api/payments/:id
//
// KHUSUS ADMIN
// ======================================================

router.delete(

    "/:id",

    authenticateToken,

    authorizeRole("admin"),

    deletePayment

);


// ======================================================
// EXPORT ROUTER
// ======================================================

module.exports = router;