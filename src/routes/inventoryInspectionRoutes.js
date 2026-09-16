const express = require("express");

const {
    getInspectionsByContract,
    getInspectionById,
    createInspection,
    deleteInspection
} = require("../controllers/inventoryInspectionController");

const router = express.Router();


// ============================================================
// GET ALL INSPECTIONS BY CONTRACT
// ============================================================

router.get(
    "/contract/:contract_id",
    getInspectionsByContract
);


// ============================================================
// GET INSPECTION BY ID
// ============================================================

router.get(
    "/:id",
    getInspectionById
);


// ============================================================
// CREATE INSPECTION
// ============================================================

router.post(
    "/",
    createInspection
);


// ============================================================
// DELETE INSPECTION
// ============================================================

router.delete(
    "/:id",
    deleteInspection
);


module.exports = router;