const express = require("express");

const {

    getTenants,
    getAllTenants,
    getTenantById,
    getTenantHistory,
    createTenant,
    updateTenant,
    deleteTenant

} = require("../controllers/tenantController");

const router = express.Router();


// ============================================================
// GET ALL TENANTS
// GET /api/tenants
//
// Menampilkan penghuni yang memiliki kontrak ACTIVE.
//
// Dipertahankan untuk kebutuhan:
// - dropdown penghuni
// - kontrak
// - pembayaran
// - fitur lain yang membutuhkan penghuni aktif
// ============================================================

router.get(
    "/",
    getTenants
);


// ============================================================
// GET ALL TENANTS INCLUDING WITHOUT CONTRACT
// GET /api/tenants/all
//
// Menampilkan seluruh penghuni:
// - aktif
// - belum memiliki kontrak
// - kontrak selesai
// - kontrak dibatalkan
//
// Route ini HARUS berada sebelum /:id.
// ============================================================

router.get(
    "/all",
    getAllTenants
);


// ============================================================
// GET TENANT HISTORY
// GET /api/tenants/history
//
// Menampilkan penghuni yang sudah tidak memiliki
// kontrak active.
//
// Route ini HARUS berada sebelum /:id.
// ============================================================

router.get(
    "/history",
    getTenantHistory
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
    updateTenant
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