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
    deleteTenant
} = require("../controllers/tenantController");

const router = express.Router();


// ============================================================
// GET ACTIVE TENANTS
// GET /api/tenants
//
// Menampilkan penghuni yang memiliki kontrak ACTIVE.
// ============================================================

router.get(
    "/",
    getTenants
);


// ============================================================
// GET ALL TENANTS
// GET /api/tenants/all
//
// Menampilkan seluruh penghuni:
// - aktif
// - belum memiliki kontrak
// - kontrak selesai
// - kontrak dibatalkan
//
// HARUS sebelum /:id
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
// HARUS sebelum /:id
// ============================================================

router.get(
    "/history",
    getTenantHistory
);


// ============================================================
// GET CALON TENANTS
// GET /api/tenants/calon
//
// Menampilkan calon penghuni.
//
// HARUS sebelum /:id
// ============================================================

router.get(
    "/calon",
    getCalonTenants
);


// ============================================================
// GET DETAIL CALON TENANT
// GET /api/tenants/calon/:id
//
// Menampilkan detail calon penghuni:
// - data diri
// - username
// - KTP
// - booking
// - pembayaran booking
// - pembayaran full
//
// HARUS sebelum /:id
// ============================================================

router.get(
    "/calon/:id",
    getCalonTenantById
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