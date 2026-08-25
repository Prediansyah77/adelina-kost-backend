const express = require("express");

const {
    getRooms,
    getRoomById,
    createRoom,
    updateRoom,
    deleteRoom
} = require("../controllers/roomController");

const router = express.Router();

// GET ALL ROOMS
router.get("/", getRooms);

// GET ROOM BY ID
router.get("/:id", getRoomById);

// CREATE ROOM
router.post("/", createRoom);

// UPDATE ROOM
router.put("/:id", updateRoom);

// DELETE ROOM
router.delete("/:id", deleteRoom);

module.exports = router;