const express = require("express");

const {
    getPayments,
    getPaymentById,
    createPayment,
    createTenantPayment,
    createBookingPayment,
    createFullPayment,
    verifyPayment,
    verifyBookingPayment,
    verifyFullPayment,
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

        createFullPayment:
            typeof createFullPayment,

        verifyPayment:
            typeof verifyPayment,

        verifyBookingPayment:
            typeof verifyBookingPayment,

        verifyFullPayment:
            typeof verifyFullPayment,

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
// Pembayaran tagihan biasa.
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
// CREATE PEMBAYARAN BOOKING / DP
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
// Fungsi:
// createBookingPayment()
//
// JANGAN DIGABUNG DENGAN FULL PAYMENT.
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
// CREATE PEMBAYARAN LUNAS
//
// POST /api/payments/full
//
// KHUSUS PENGHUNI
//
// Alur:
//
// pilih kamar
//     ↓
// pilih "Pesan Kamar Tanpa DP"
//     ↓
// pembayaran 1 bulan penuh
//     ↓
// upload bukti transfer
//     ↓
// submit
//
// Fungsi:
// createFullPayment()
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
// Tenant:
// tetap calon
//
// Kontrak:
// BELUM dibuat
//
// Saldo bank:
// BELUM bertambah
//
// Semua finalisasi dilakukan ketika
// admin memverifikasi pembayaran.
// ======================================================

router.post(

    "/full",

    authenticateToken,

    authorizeRole("penghuni"),

    uploadPaymentProof.single(
        "proof_file"
    ),

    createFullPayment

);


// ======================================================
// VERIFY PEMBAYARAN BOOKING
//
// PATCH /api/payments/booking/:id/verify
//
// KHUSUS ADMIN
//
// Digunakan untuk pembayaran yang dibuat
// melalui createBookingPayment().
// ======================================================

router.patch(

    "/booking/:id/verify",

    authenticateToken,

    authorizeRole("admin"),

    verifyBookingPayment

);


// ======================================================
// VERIFY PEMBAYARAN FULL
//
// PATCH /api/payments/full/:id/verify
//
// KHUSUS ADMIN
//
// Digunakan untuk pembayaran yang dibuat
// melalui createFullPayment().
//
// Alur:
//
// payment pending
//     ↓
// admin verifikasi
//     ↓
// payment verified
//     ↓
// booking approved
//     ↓
// tenant aktif
//     ↓
// contract active
//     ↓
// room occupied
//     ↓
// saldo bank bertambah
//     ↓
// bill bulan berikutnya dibuat
// ======================================================

router.patch(

    "/full/:id/verify",

    authenticateToken,

    authorizeRole("admin"),

    verifyFullPayment

);


// ======================================================
// VERIFY PEMBAYARAN TAGIHAN
//
// PATCH /api/payments/:id/verify
//
// KHUSUS ADMIN
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
// Route ini setelah route khusus.
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
// Pembayaran manual/admin.
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