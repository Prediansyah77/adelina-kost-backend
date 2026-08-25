const express = require("express");

const {
    getFloors,
    getFloorById,
    createFloor,
    updateFloor,
    deactivateFloor
} = require("../controllers/floorController");

const router = express.Router();


// GET ALL FLOORS
router.get("/", getFloors);


// GET FLOOR BY ID
router.get("/:id", getFloorById);


// CREATE FLOOR
router.post("/", createFloor);


// UPDATE FLOOR
router.put("/:id", updateFloor);


// NONAKTIFKAN FLOOR
router.patch("/:id/nonaktifkan", deactivateFloor);


module.exports = router;