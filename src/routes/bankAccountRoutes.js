const express = require("express");

const {
    getBankAccounts,
    getBankAccountById,
    createBankAccount,
    updateBankAccount,
    deleteBankAccount
} = require("../controllers/bankAccountController");

const router = express.Router();


// =====================================================
// GET SEMUA REKENING
// GET /api/bank-accounts
// =====================================================

router.get(
    "/",
    getBankAccounts
);


// =====================================================
// GET REKENING BERDASARKAN ID
// GET /api/bank-accounts/:id
// =====================================================

router.get(
    "/:id",
    getBankAccountById
);


// =====================================================
// CREATE REKENING
// POST /api/bank-accounts
// =====================================================

router.post(
    "/",
    createBankAccount
);


// =====================================================
// UPDATE REKENING
// PUT /api/bank-accounts/:id
// =====================================================

router.put(
    "/:id",
    updateBankAccount
);


// =====================================================
// NONAKTIFKAN REKENING
// DELETE /api/bank-accounts/:id
// =====================================================

router.delete(
    "/:id",
    deleteBankAccount
);


module.exports = router;