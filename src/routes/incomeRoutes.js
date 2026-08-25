const express = require("express");

const {
    getIncomes,
    getIncomeById,
    createIncome,
    updateIncome,
    deleteIncome,
    getIncomeSummary
} = require("../controllers/incomeController");

const router = express.Router();


// ============================
// GET ALL INCOMES
// GET /api/incomes
// ============================

router.get("/", getIncomes);


// ============================
// GET INCOME SUMMARY
// GET /api/incomes/summary
// ============================

router.get("/summary", getIncomeSummary);


// ============================
// GET INCOME BY ID
// GET /api/incomes/:id
// ============================

router.get("/:id", getIncomeById);


// ============================
// CREATE INCOME
// POST /api/incomes
// ============================

router.post("/", createIncome);


// ============================
// UPDATE INCOME
// PUT /api/incomes/:id
// ============================

router.put("/:id", updateIncome);


// ============================
// DELETE INCOME
// DELETE /api/incomes/:id
// ============================

router.delete("/:id", deleteIncome);


module.exports = router;