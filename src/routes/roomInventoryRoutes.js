const express = require("express");

const {
    getRoomInventories,
    getRoomInventoryById,
    createRoomInventory,
    updateRoomInventory,
    deleteRoomInventory
} = require("../controllers/inventoryController");

const router = express.Router();


// ======================================================
// GET SEMUA INVENTARIS KAMAR
// GET /api/room-inventories
// ======================================================
router.get(
    "/",
    getRoomInventories
);


// ======================================================
// GET INVENTARIS KAMAR BERDASARKAN ID
// GET /api/room-inventories/:id
// ======================================================
router.get(
    "/:id",
    getRoomInventoryById
);


// ======================================================
// TAMBAH INVENTARIS KAMAR
// POST /api/room-inventories
// ======================================================
router.post(
    "/",
    createRoomInventory
);


// ======================================================
// UPDATE INVENTARIS KAMAR
// PUT /api/room-inventories/:id
// ======================================================
router.put(
    "/:id",
    updateRoomInventory
);


// ======================================================
// HAPUS INVENTARIS KAMAR
// DELETE /api/room-inventories/:id
// ======================================================
router.delete(
    "/:id",
    deleteRoomInventory
);


module.exports = router;