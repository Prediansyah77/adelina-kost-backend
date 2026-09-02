const express = require("express");

const {
    getContracts,
    getContractById,
    getContractHistory,
    createContract,
    updateContract,
    deleteContract,
    processMoveOut
} = require("../controllers/contractController");

const router = express.Router();


// ============================================================
// GET KONTRAK AKTIF
// GET /api/contracts
//
// Menampilkan kontrak dengan status:
// - active
//
// Kontrak completed/cancelled ada di history.
// ============================================================

router.get(
    "/",
    getContracts
);


// ============================================================
// GET RIWAYAT KONTRAK
// GET /api/contracts/history
//
// Menampilkan kontrak:
// - completed
// - cancelled
//
// PENTING:
// Route ini harus berada SEBELUM /:id.
// ============================================================

router.get(
    "/history",
    getContractHistory
);


// ============================================================
// PROSES PENGHUNI KELUAR
// POST /api/contracts/:id/move-out
//
// Digunakan ketika penghuni keluar dari kos.
//
// Proses lengkap akan ditangani oleh:
// processMoveOut
// ============================================================

router.post(
    "/:id/move-out",
    processMoveOut
);


// ============================================================
// GET KONTRAK BERDASARKAN ID
// GET /api/contracts/:id
//
// Bisa mengambil kontrak:
// - active
// - completed
// - cancelled
// ============================================================

router.get(
    "/:id",
    getContractById
);


// ============================================================
// CREATE KONTRAK
// POST /api/contracts
// ============================================================

router.post(
    "/",
    createContract
);


// ============================================================
// UPDATE KONTRAK
// PUT /api/contracts/:id
// ============================================================

router.put(
    "/:id",
    updateContract
);


// ============================================================
// DELETE KONTRAK
// DELETE /api/contracts/:id
// ============================================================

router.delete(
    "/:id",
    deleteContract
);


// ============================================================
// EXPORT
// ============================================================

module.exports = router;