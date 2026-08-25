const express = require("express");

const {
    getBuildings,
    createBuilding,
    updateBuilding,
    deactivateBuilding
} = require("../controllers/buildingController");

const router = express.Router();

router.get("/", getBuildings);
router.post("/", createBuilding);
router.put("/:id", updateBuilding);
router.patch("/:id/nonaktifkan", deactivateBuilding);

module.exports = router;