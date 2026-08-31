const express = require("express");


const {
    createBooking,
    getBookingById,
    getMyBooking
} = require("../controllers/bookingController");


const authenticateToken =
    require("../middleware/authMiddleware");


const authorizeRole =
    require("../middleware/roleMiddleware");


const router =
    express.Router();



// =====================================================
// CREATE BOOKING
// POST /api/bookings
// =====================================================
//
// Digunakan oleh calon penghuni untuk mengajukan kamar.
//
// =====================================================

router.post(

    "/",

    authenticateToken,

    authorizeRole("penghuni"),

    createBooking

);



// =====================================================
// GET MY BOOKING
// GET /api/bookings/my-booking
// =====================================================
//
// Digunakan oleh penghuni untuk melihat booking miliknya.
//
// Tenant ID diambil dari JWT:
//
// req.user.tenant_id
//
// Penghuni tidak bisa melihat booking penghuni lain.
//
// =====================================================

router.get(

    "/my-booking",

    authenticateToken,

    authorizeRole("penghuni"),

    getMyBooking

);



// =====================================================
// GET BOOKING BY ID
// GET /api/bookings/:id
// =====================================================
//
// Digunakan oleh halaman pembayaran booking.
//
// Penghuni:
// - hanya boleh melihat booking miliknya
//
// Admin:
// - boleh melihat booking mana pun
//
// =====================================================

router.get(

    "/:id",

    authenticateToken,

    authorizeRole(
        "penghuni",
        "admin"
    ),

    getBookingById

);



// =====================================================
// EXPORT
// =====================================================

module.exports = router;