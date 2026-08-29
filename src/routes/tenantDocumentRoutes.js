const express = require("express");

const {
    uploadKtp,
    getKtp,
    deleteKtp
} = require("../controllers/tenantDocumentController");

const uploadKtpMiddleware =
    require("../middleware/uploadKtp");

const router = express.Router();


// ============================================================
// UPLOAD / UPDATE KTP
// POST /api/tenant-documents/:tenantId/ktp
// ============================================================

router.post(
    "/:tenantId/ktp",
    uploadKtpMiddleware.single("ktp"),
    uploadKtp
);


// ============================================================
// GET KTP
// GET /api/tenant-documents/:tenantId/ktp
// ============================================================

router.get(
    "/:tenantId/ktp",
    getKtp
);


// ============================================================
// DELETE KTP
// DELETE /api/tenant-documents/:tenantId/ktp
// ============================================================

router.delete(
    "/:tenantId/ktp",
    deleteKtp
);


// ============================================================
// EXPORT
// ============================================================

module.exports = router;