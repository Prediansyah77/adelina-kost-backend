const express = require("express");

const {
    getTenants,
    getAllTenants,
    getTenantById,
    getTenantHistory,
    getCalonTenants,
    getCalonTenantById,
    createTenant,
    updateTenant,
    deleteTenant,
    deleteTenantProfilePhoto,
    completeBiodata
} = require("../controllers/tenantController");

const {
    uploadProfile,
    uploadKtp
} = require("../middleware/uploadMiddleware");

const authenticateToken =
    require("../middleware/authMiddleware");

const router = express.Router();


// ============================================================
// GET ACTIVE TENANTS
// GET /api/tenants
// ============================================================

router.get(
    "/",
    getTenants
);


// ============================================================
// GET ALL TENANTS
// GET /api/tenants/all
// ============================================================

router.get(
    "/all",
    getAllTenants
);


// ============================================================
// GET TENANT HISTORY
// GET /api/tenants/history
// ============================================================

router.get(
    "/history",
    getTenantHistory
);


// ============================================================
// GET CALON TENANTS
// GET /api/tenants/calon
// ============================================================

router.get(
    "/calon",
    getCalonTenants
);


// ============================================================
// GET DETAIL CALON TENANT
// GET /api/tenants/calon/:id
// ============================================================

router.get(
    "/calon/:id",
    getCalonTenantById
);


// ============================================================
// COMPLETE BIODATA
// POST /api/tenants/complete-biodata
//
// Membutuhkan:
// - JWT
// - foto KTP
// ============================================================

router.post(
    "/complete-biodata",
    authenticateToken,
    uploadKtp.single("ktp"),
    completeBiodata
);


// ============================================================
// GET TENANT BY ID
// GET /api/tenants/:id
// ============================================================

router.get(
    "/:id",
    getTenantById
);


// ============================================================
// CREATE TENANT
// POST /api/tenants
// ============================================================

router.post(
    "/",
    createTenant
);


// ============================================================
// UPDATE TENANT
// PUT /api/tenants/:id
// ============================================================

router.put(
    "/:id",
    uploadProfile.single("profile_photo"),
    updateTenant
);


// ============================================================
// DELETE TENANT PROFILE PHOTO
// DELETE /api/tenants/:id/profile-photo
// ============================================================

router.delete(
    "/:id/profile-photo",
    deleteTenantProfilePhoto
);


// ============================================================
// DELETE TENANT
// DELETE /api/tenants/:id
// ============================================================

router.delete(
    "/:id",
    deleteTenant
);


// ============================================================
// EXPORT ROUTER
// ============================================================

module.exports = router;