const express = require("express");

const {
    getAllReconciliations,
    getReconciliationById,
    createReconciliation,
    updateReconciliation,
    deleteReconciliation
} = require("../controllers/reconciliationController");

const router = express.Router();

// ======================================================
// GET ALL RECONCILIATIONS
// GET /api/reconciliations
// ======================================================
router.get("/", getAllReconciliations);

// ======================================================
// GET RECONCILIATION BY ID
// GET /api/reconciliations/:id
// ======================================================
router.get("/:id", getReconciliationById);

// ======================================================
// CREATE RECONCILIATION
// POST /api/reconciliations
// ======================================================
router.post("/", createReconciliation);

// ======================================================
// UPDATE RECONCILIATION
// PUT /api/reconciliations/:id
// ======================================================
router.put("/:id", updateReconciliation);

// ======================================================
// DELETE RECONCILIATION
// DELETE /api/reconciliations/:id
// ======================================================
router.delete("/:id", deleteReconciliation);

module.exports = router;