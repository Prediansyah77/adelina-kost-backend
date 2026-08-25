const db = require("../config/database");

// =====================================================
// GET LAPORAN KEUANGAN
// GET /api/reports?month=8&year=2026
// =====================================================

const getFinancialReport = async (req, res) => {
    try {

        const { month, year } = req.query;

        // =================================================
        // VALIDASI
        // =================================================

        if (!month || !year) {
            return res.status(400).json({
                success: false,
                message: "month dan year wajib diisi"
            });
        }

        const monthNumber = Number(month);
        const yearNumber = Number(year);

        if (
            !Number.isInteger(monthNumber) ||
            monthNumber < 1 ||
            monthNumber > 12
        ) {
            return res.status(400).json({
                success: false,
                message: "month harus berupa angka 1 sampai 12"
            });
        }

        if (
            !Number.isInteger(yearNumber) ||
            yearNumber < 2000
        ) {
            return res.status(400).json({
                success: false,
                message: "year tidak valid"
            });
        }


        // =================================================
        // PEMASUKAN
        // =================================================
        // Hanya pembayaran yang masuk pada bulan/tahun
        // yang dipilih.
        //
        // Pembayaran diambil dari tabel payments.
        // =================================================

        const [payments] = await db.query(`
            SELECT
                p.id,
                p.payment_date,
                p.amount,
                p.payment_method,
                p.notes,

                b.billing_month,
                b.billing_year,

                t.name AS tenant_name,

                r.room_number

            FROM payments p

            INNER JOIN bills b
                ON p.bill_id = b.id

            INNER JOIN contracts c
                ON b.contract_id = c.id

            INNER JOIN tenants t
                ON c.tenant_id = t.id

            INNER JOIN rooms r
                ON c.room_id = r.id

            WHERE MONTH(p.payment_date) = ?
            AND YEAR(p.payment_date) = ?

            ORDER BY
                p.payment_date DESC,
                p.id DESC
        `, [
            monthNumber,
            yearNumber
        ]);


        // =================================================
        // TOTAL PEMASUKAN
        // =================================================

        const totalIncome = payments.reduce(
            (total, payment) => {
                return total + Number(payment.amount || 0);
            },
            0
        );


        // =================================================
        // PENGELUARAN
        // =================================================

        const [expenses] = await db.query(`
            SELECT
                id,
                expense_date,
                category,
                description,
                amount

            FROM expenses

            WHERE MONTH(expense_date) = ?
            AND YEAR(expense_date) = ?

            ORDER BY
                expense_date DESC,
                id DESC
        `, [
            monthNumber,
            yearNumber
        ]);


        // =================================================
        // TOTAL PENGELUARAN
        // =================================================

        const totalExpense = expenses.reduce(
            (total, expense) => {
                return total + Number(expense.amount || 0);
            },
            0
        );


        // =================================================
        // LABA / SALDO BERSIH
        // =================================================

        const netIncome =
            totalIncome -
            totalExpense;


        // =================================================
        // REKAP PENGELUARAN PER KATEGORI
        // =================================================

        const [expenseCategories] = await db.query(`
            SELECT
                category,

                COUNT(*) AS transaction_count,

                COALESCE(
                    SUM(amount),
                    0
                ) AS total_amount

            FROM expenses

            WHERE MONTH(expense_date) = ?
            AND YEAR(expense_date) = ?

            GROUP BY category

            ORDER BY total_amount DESC
        `, [
            monthNumber,
            yearNumber
        ]);


        // =================================================
        // RESPONSE
        // =================================================

        res.json({
            success: true,

            data: {

                period: {
                    month: monthNumber,
                    year: yearNumber
                },

                summary: {

                    total_income:
                        totalIncome,

                    total_expense:
                        totalExpense,

                    net_income:
                        netIncome,

                    payment_count:
                        payments.length,

                    expense_count:
                        expenses.length

                },

                income: payments.map(
                    (payment) => ({

                        id:
                            payment.id,

                        payment_date:
                            payment.payment_date,

                        amount:
                            Number(
                                payment.amount
                            ) || 0,

                        payment_method:
                            payment.payment_method,

                        notes:
                            payment.notes,

                        billing_month:
                            payment.billing_month,

                        billing_year:
                            payment.billing_year,

                        tenant_name:
                            payment.tenant_name,

                        room_number:
                            payment.room_number

                    })
                ),

                expenses: expenses.map(
                    (expense) => ({

                        id:
                            expense.id,

                        expense_date:
                            expense.expense_date,

                        category:
                            expense.category,

                        description:
                            expense.description,

                        amount:
                            Number(
                                expense.amount
                            ) || 0

                    })
                ),

                expense_categories:
                    expenseCategories.map(
                        (item) => ({

                            category:
                                item.category,

                            transaction_count:
                                Number(
                                    item.transaction_count
                                ) || 0,

                            total_amount:
                                Number(
                                    item.total_amount
                                ) || 0

                        })
                    )

            }
        });

    } catch (error) {

        console.error(
            "Financial Report Error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Gagal mengambil laporan keuangan",
            error: error.message
        });

    }
};


// =====================================================
// EXPORT
// =====================================================

module.exports = {
    getFinancialReport
};