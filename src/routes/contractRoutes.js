const express = require("express");

const {

    getContracts,

    getContractById,

    getContractHistory,

    createContract,

    updateContract,

    deleteContract

} = require("../controllers/contractController");

const router = express.Router();


// ============================================================
// GET SEMUA KONTRAK
// GET /api/contracts
//
// Menampilkan semua kontrak:
// - active
// - completed
// - cancelled
// ============================================================

router.get("/", getContracts);


// ============================================================
// GET RIWAYAT KONTRAK
// GET /api/contracts/history
//
// Menampilkan kontrak yang sudah selesai / dibatalkan.
//
// PENTING:
// Route ini harus berada SEBELUM /:id.
// ============================================================

router.get("/history", getContractHistory);


// ============================================================
// GET KONTRAK BERDASARKAN ID
// GET /api/contracts/:id
// ============================================================

router.get("/:id", getContractById);


// ============================================================
// CREATE KONTRAK
// POST /api/contracts
// ============================================================

router.post("/", createContract);


// ============================================================
// UPDATE KONTRAK
// PUT /api/contracts/:id
// ============================================================

router.put("/:id", updateContract);


// ============================================================
// DELETE KONTRAK
// DELETE /api/contracts/:id
// ============================================================

router.delete("/:id", deleteContract);


// ============================================================
// EXPORT
// ============================================================

module.exports = router;