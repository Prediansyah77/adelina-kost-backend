const express = require("express");

const {
    getExpenses,
    getExpenseById,
    createExpense,
    updateExpense,
    deleteExpense,
    getExpenseSummary
} = require("../controllers/expenseController");

const router = express.Router();


// ============================
// GET ALL EXPENSES
// GET /api/expenses
// ============================
router.get("/", getExpenses);
router.get("/summary", getExpenseSummary);


// ============================
// GET EXPENSE BY ID
// GET /api/expenses/:id
// ============================
router.get("/:id", getExpenseById);


// ============================
// CREATE EXPENSE
// POST /api/expenses
// ============================
router.post("/", createExpense);


// ============================
// UPDATE EXPENSE
// PUT /api/expenses/:id
// ============================
router.put("/:id", updateExpense);


// ============================
// DELETE EXPENSE
// DELETE /api/expenses/:id
// ============================
router.delete("/:id", deleteExpense);


module.exports = router;