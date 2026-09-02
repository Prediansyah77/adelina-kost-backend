const express = require("express");

const {
    getPayments,
    getPaymentById,
    createPayment,
    createTenantPayment,

    // =====================================================
    // BOOKING
    // =====================================================

    createBookingPayment,
    createInitialBookingPayment,
    createRemainingBookingPayment,

    // =====================================================
    // FULL PAYMENT
    // =====================================================

    createFullPayment,

    // =====================================================
    // VERIFY
    // =====================================================

    verifyPayment,
    verifyBookingPayment,
    verifyFullPayment,

    // =====================================================
    // OTHER
    // =====================================================

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

        createInitialBookingPayment:
            typeof createInitialBookingPayment,

        createRemainingBookingPayment:
            typeof createRemainingBookingPayment,

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
// KHUSUS ADMIN
//
// Route harus sebelum /:id
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
// ======================================================

router.get(

    "/my-payments",

    authenticateToken,

    authorizeRole("penghuni"),

    getMyPayments

);


// ======================================================
// CREATE PEMBAYARAN TAGIHAN
//
// POST /api/payments/tenant
//
// KHUSUS PENGHUNI
//
// Pembayaran tagihan bulanan biasa.
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
// CREATE INITIAL BOOKING PAYMENT / DP
//
// POST /api/payments/booking-initial
//
// KHUSUS PENGHUNI
//
// Flow:
//
// pilih kamar
//     ↓
// halaman pembayaran DP
//     ↓
// upload bukti
//     ↓
// submit
//     ↓
// createInitialBookingPayment()
//     ↓
// room_bookings dibuat
//     ↓
// payments dibuat
//     ↓
// room available → booked
//
// PENTING:
//
// Booking BELUM dibuat ketika user hanya
// membuka halaman pembayaran.
//
// Booking dibuat ketika DP benar-benar
// disubmit.
//
// ======================================================

router.post(

    "/booking-initial",

    authenticateToken,

    authorizeRole("penghuni"),

    uploadPaymentProof.single(
        "proof_file"
    ),

    createInitialBookingPayment

);


// ======================================================
// CREATE PEMBAYARAN BOOKING LAMA
//
// POST /api/payments/booking
//
// KHUSUS PENGHUNI
//
// Function lama:
//
// createBookingPayment()
//
// Route ini DIPERTAHANKAN agar function lama
// tidak rusak.
//
// Digunakan untuk flow booking yang sudah
// menggunakan booking_id.
//
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
// CREATE PEMBAYARAN SISA BOOKING
//
// POST /api/payments/booking-remaining
//
// KHUSUS PENGHUNI
//
// Flow:
//
// booking sudah approved
//     ↓
// DP sudah verified
//     ↓
// user bayar sisa
//     ↓
// createRemainingBookingPayment()
//     ↓
// payment baru dibuat
//     ↓
// status pending
//     ↓
// admin verifikasi
//     ↓
// verifyBookingPayment()
//     ↓
// jika total sudah lunas:
// tenant → aktif
// contract → active
// room → occupied
//
// PENTING:
//
// Function ini TIDAK membuat booking baru.
//
// Menggunakan booking_id yang sudah ada.
// ======================================================

router.post(

    "/booking-remaining",

    authenticateToken,

    authorizeRole("penghuni"),

    uploadPaymentProof.single(
        "proof_file"
    ),

    createRemainingBookingPayment

);


// ======================================================
// CREATE PEMBAYARAN FULL
//
// POST /api/payments/full
//
// KHUSUS PENGHUNI
//
// Flow:
//
// pilih kamar
//     ↓
// bayar 1 bulan penuh
//     ↓
// createFullPayment()
//     ↓
// booking pending
//     ↓
// payment pending
//     ↓
// room booked
//     ↓
// admin verifikasi
//     ↓
// tenant aktif
//     ↓
// contract active
//     ↓
// room occupied
//
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
// VERIFY PEMBAYARAN BOOKING / DP / SISA
//
// PATCH /api/payments/booking/:id/verify
//
// KHUSUS ADMIN
//
// Digunakan untuk:
//
// 1. DP booking
// 2. pembayaran lanjutan
// 3. pelunasan booking
//
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
// Digunakan untuk pembayaran full langsung.
//
// ======================================================

router.patch(

    "/full/:id/verify",

    authenticateToken,

    authorizeRole("admin"),

    verifyFullPayment

);


// ======================================================
// VERIFY PEMBAYARAN TAGIHAN BIASA
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
// Route diletakkan setelah route-route khusus.
// ======================================================

router.get(

    "/:id",

    authenticateToken,

    authorizeRole("admin"),

    getPaymentById

);


// ======================================================
// CREATE PEMBAYARAN MANUAL ADMIN
//
// POST /api/payments
//
// KHUSUS ADMIN
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