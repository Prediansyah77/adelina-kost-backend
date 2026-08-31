const express = require("express");

const {
    getRooms,
    getRoomById,
    createRoom,
    updateRoom,
    deleteRoom,
    getPublicRooms,
} = require("../controllers/roomController");

const router = express.Router();


// ============================================================
// GET PUBLIC ROOMS
// GET /api/rooms/public
//
// Harus diletakkan sebelum /:id
// supaya "public" tidak dianggap sebagai ID.
// ============================================================

router.get(
    "/public",
    getPublicRooms
);


// ============================================================
// GET ALL ROOMS
// GET /api/rooms
//
// Digunakan oleh ADMIN.
// Mengambil seluruh kamar.
// ============================================================

router.get(
    "/",
    getRooms
);


// ============================================================
// GET ROOM BY ID
// GET /api/rooms/:id
// ============================================================

router.get(
    "/:id",
    getRoomById
);


// ============================================================
// CREATE ROOM
// POST /api/rooms
// ============================================================

router.post(
    "/",
    createRoom
);


// ============================================================
// UPDATE ROOM
// PUT /api/rooms/:id
// ============================================================

router.put(
    "/:id",
    updateRoom
);


// ============================================================
// DELETE ROOM
// DELETE /api/rooms/:id
// ============================================================

router.delete(
    "/:id",
    deleteRoom
);


// ============================================================
// EXPORT
// ============================================================

module.exports = router;