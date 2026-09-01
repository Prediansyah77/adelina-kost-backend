const db = require("../config/database");

// ============================================================
// HELPER
// ============================================================

const toNumber = (value) => {
    return Number(value) || 0;
};


// ============================================================
// GET DASHBOARD SUMMARY
// ============================================================
// Endpoint:
// GET /api/dashboard/summary
//
// Digunakan untuk:
// - Total kamar
// - Kamar tersedia
// - Kamar terisi
// - Occupancy rate
// - Total penghuni
// - Kontrak aktif
// - Pendapatan bulan ini
// - Pengeluaran bulan ini
// - Laba operasional bulan ini
// - Tagihan belum dibayar
// - Pembayaran menunggu / informasi tambahan
// ============================================================

const getDashboardSummary = async (req, res) => {

    try {

        // ========================================================
        // TENTUKAN BULAN & TAHUN SAAT INI
        // ========================================================

        const now = new Date();

        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();


        // ========================================================
        // 1. ROOM SUMMARY
        // ========================================================

        const [roomSummary] = await db.query(`
            SELECT

                COUNT(*) AS total_rooms,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'available'
                            THEN 1
                            ELSE 0
                        END
                    ),
                    0
                ) AS available_rooms,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'occupied'
                            THEN 1
                            ELSE 0
                        END
                    ),
                    0
                ) AS occupied_rooms

            FROM rooms
        `);


        const totalRooms =
            toNumber(roomSummary[0]?.total_rooms);

        const availableRooms =
            toNumber(roomSummary[0]?.available_rooms);

        const occupiedRooms =
            toNumber(roomSummary[0]?.occupied_rooms);


        const occupancyRate =
            totalRooms > 0
                ? Number(
                    (
                        (occupiedRooms / totalRooms) * 100
                    ).toFixed(2)
                )
                : 0;


        // ========================================================
        // 2. TENANT SUMMARY
        // ========================================================

        const [tenantSummary] = await db.query(`
            SELECT
                COUNT(*) AS total_tenants
            FROM tenants
        `);


        const totalTenants =
            toNumber(tenantSummary[0]?.total_tenants);


        // ========================================================
        // 3. ACTIVE CONTRACT SUMMARY
        // ========================================================

        const [contractSummary] = await db.query(`
            SELECT
                COUNT(*) AS active_contracts
            FROM contracts
            WHERE status = 'active'
        `);


        const activeContracts =
            toNumber(
                contractSummary[0]?.active_contracts
            );


        // ========================================================
        // 4. BILL SUMMARY BULAN INI
        // ========================================================
        //
        // Menggunakan billing_month dan billing_year
        // karena sistem ADELINA KOST memang menyimpan
        // periode tagihan secara eksplisit.
        //
        // ========================================================

        const [billSummary] = await db.query(`
            SELECT

                COUNT(*) AS total_bills,

                COALESCE(
                    SUM(amount),
                    0
                ) AS total_bill_amount,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'paid'
                            THEN amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS paid_amount,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'unpaid'
                            THEN amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS unpaid_amount,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'late'
                            THEN amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS late_amount,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'paid'
                            THEN 1
                            ELSE 0
                        END
                    ),
                    0
                ) AS paid_bills,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'unpaid'
                            THEN 1
                            ELSE 0
                        END
                    ),
                    0
                ) AS unpaid_bills,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'late'
                            THEN 1
                            ELSE 0
                        END
                    ),
                    0
                ) AS late_bills

            FROM bills

            WHERE billing_month = ?
            AND billing_year = ?
        `, [
            currentMonth,
            currentYear
        ]);


        const totalBills =
            toNumber(
                billSummary[0]?.total_bills
            );

        const totalBillAmount =
            toNumber(
                billSummary[0]?.total_bill_amount
            );

        const paidBillAmount =
            toNumber(
                billSummary[0]?.paid_amount
            );

        const unpaidBillAmount =
            toNumber(
                billSummary[0]?.unpaid_amount
            );

        const lateBillAmount =
            toNumber(
                billSummary[0]?.late_amount
            );

        const paidBills =
            toNumber(
                billSummary[0]?.paid_bills
            );

        const unpaidBills =
            toNumber(
                billSummary[0]?.unpaid_bills
            );

        const lateBills =
            toNumber(
                billSummary[0]?.late_bills
            );


        // ========================================================
        // 5. INCOME BULAN INI
        // ========================================================

        const [incomeSummary] = await db.query(`
            SELECT

                COUNT(*) AS total_transactions,

                COALESCE(
                    SUM(amount),
                    0
                ) AS total_amount

            FROM incomes

            WHERE MONTH(income_date) = ?
            AND YEAR(income_date) = ?
        `, [
            currentMonth,
            currentYear
        ]);


        const monthlyIncome =
            toNumber(
                incomeSummary[0]?.total_amount
            );

        const incomeTransactions =
            toNumber(
                incomeSummary[0]?.total_transactions
            );


        // ========================================================
        // 6. EXPENSE BULAN INI
        // ========================================================

        const [expenseSummary] = await db.query(`
            SELECT

                COUNT(*) AS total_transactions,

                COALESCE(
                    SUM(amount),
                    0
                ) AS total_amount

            FROM expenses

            WHERE MONTH(expense_date) = ?
            AND YEAR(expense_date) = ?
        `, [
            currentMonth,
            currentYear
        ]);


        const monthlyExpense =
            toNumber(
                expenseSummary[0]?.total_amount
            );

        const expenseTransactions =
            toNumber(
                expenseSummary[0]?.total_transactions
            );


        // ========================================================
        // 7. LABA OPERASIONAL
        // ========================================================

        const monthlyProfit =
            monthlyIncome - monthlyExpense;


        // ========================================================
        // 8. PEMBAYARAN BULAN INI
        // ========================================================

        const [paymentSummary] = await db.query(`
            SELECT

                COUNT(*) AS total_payments,

                COALESCE(
                    SUM(amount),
                    0
                ) AS total_amount

           FROM payments

WHERE status = 'verified'
AND MONTH(payment_date) = ?
AND YEAR(payment_date) = ?
        `, [
            currentMonth,
            currentYear
        ]);


        const totalPayments =
            toNumber(
                paymentSummary[0]?.total_payments
            );

        const totalPaymentAmount =
            toNumber(
                paymentSummary[0]?.total_amount
            );


        // ========================================================
        // 9. RESPONSE
        // ========================================================

        res.json({

            success: true,

            data: {

                // ==================================================
                // PERIOD
                // ==================================================

                period: {
                    month: currentMonth,
                    year: currentYear
                },


                // ==================================================
                // ROOMS
                // ==================================================

                rooms: {

                    total: totalRooms,

                    available: availableRooms,

                    occupied: occupiedRooms,

                    occupancy_rate: occupancyRate
                },


                // ==================================================
                // TENANTS
                // ==================================================

                tenants: {

                    total: totalTenants
                },


                // ==================================================
                // CONTRACTS
                // ==================================================

                contracts: {

                    active: activeContracts
                },


                // ==================================================
                // BILLS
                // ==================================================

                bills: {

                    total: totalBills,

                    total_amount: totalBillAmount,

                    paid: paidBills,

                    paid_amount: paidBillAmount,

                    unpaid: unpaidBills,

                    unpaid_amount: unpaidBillAmount,

                    late: lateBills,

                    late_amount: lateBillAmount
                },


                // ==================================================
                // INCOME
                // ==================================================

                income: {

                    transactions:
                        incomeTransactions,

                    amount:
                        monthlyIncome
                },


                // ==================================================
                // EXPENSE
                // ==================================================

                expense: {

                    transactions:
                        expenseTransactions,

                    amount:
                        monthlyExpense
                },


                // ==================================================
                // FINANCIAL
                // ==================================================

                financial: {

                    total_income:
                        monthlyIncome,

                    total_expense:
                        monthlyExpense,

                    net_income:
                        monthlyProfit
                },


                // ==================================================
                // PAYMENTS
                // ==================================================

                payments: {

                    total:
                        totalPayments,

                    amount:
                        totalPaymentAmount
                }

            }

        });

    } catch (error) {

        console.error(
            "Dashboard Summary Error:",
            error
        );

        res.status(500).json({

            success: false,

            message:
                "Gagal mengambil summary dashboard",

            error:
                error.message
        });
    }
};


// ============================================================
// GET MONTHLY DASHBOARD
// ============================================================
// GET /api/dashboard/monthly?month=8&year=2026
// ============================================================

const getMonthlyDashboard = async (req, res) => {

    try {

        const {
            month,
            year
        } = req.query;


        if (!month || !year) {

            return res.status(400).json({

                success: false,

                message:
                    "Bulan dan tahun wajib diisi"
            });
        }


        const monthNumber =
            Number(month);

        const yearNumber =
            Number(year);


        if (
            !Number.isInteger(monthNumber) ||
            monthNumber < 1 ||
            monthNumber > 12 ||
            !Number.isInteger(yearNumber) ||
            yearNumber < 2000
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Bulan atau tahun tidak valid"
            });
        }


        // ========================================================
        // BILL
        // ========================================================

        const [billSummary] = await db.query(`
            SELECT

                COUNT(*) AS total_bills,

                COALESCE(
                    SUM(amount),
                    0
                ) AS total_amount,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'paid'
                            THEN amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS paid_amount,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'unpaid'
                            THEN amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS unpaid_amount,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'late'
                            THEN amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS late_amount,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'paid'
                            THEN 1
                            ELSE 0
                        END
                    ),
                    0
                ) AS paid_bills,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'unpaid'
                            THEN 1
                            ELSE 0
                        END
                    ),
                    0
                ) AS unpaid_bills,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'late'
                            THEN 1
                            ELSE 0
                        END
                    ),
                    0
                ) AS late_bills

            FROM bills

            WHERE billing_month = ?
            AND billing_year = ?
        `, [
            monthNumber,
            yearNumber
        ]);


        // ========================================================
        // INCOME
        // ========================================================

        const [incomeSummary] = await db.query(`
            SELECT

                COUNT(*) AS total_transactions,

                COALESCE(
                    SUM(amount),
                    0
                ) AS total_amount

            FROM incomes

            WHERE MONTH(income_date) = ?
            AND YEAR(income_date) = ?
        `, [
            monthNumber,
            yearNumber
        ]);


        // ========================================================
        // EXPENSE
        // ========================================================

        const [expenseSummary] = await db.query(`
            SELECT

                COUNT(*) AS total_transactions,

                COALESCE(
                    SUM(amount),
                    0
                ) AS total_amount

            FROM expenses

            WHERE MONTH(expense_date) = ?
            AND YEAR(expense_date) = ?
        `, [
            monthNumber,
            yearNumber
        ]);


        // ========================================================
        // PAYMENT
        // ========================================================

        const [paymentSummary] = await db.query(`
            SELECT

                COUNT(*) AS total_payments,

                COALESCE(
                    SUM(amount),
                    0
                ) AS total_amount

            FROM payments

            WHERE MONTH(payment_date) = ?
            AND YEAR(payment_date) = ?
        `, [
            monthNumber,
            yearNumber
        ]);


        const totalIncome =
            toNumber(
                incomeSummary[0]?.total_amount
            );

        const totalExpense =
            toNumber(
                expenseSummary[0]?.total_amount
            );


        const netIncome =
            totalIncome - totalExpense;


        // ========================================================
        // RESPONSE
        // ========================================================

        res.json({

            success: true,

            data: {

                period: {

                    month: monthNumber,

                    year: yearNumber
                },


                bills: {

                    total:
                        toNumber(
                            billSummary[0]?.total_bills
                        ),

                    total_amount:
                        toNumber(
                            billSummary[0]?.total_amount
                        ),

                    paid:
                        toNumber(
                            billSummary[0]?.paid_bills
                        ),

                    paid_amount:
                        toNumber(
                            billSummary[0]?.paid_amount
                        ),

                    unpaid:
                        toNumber(
                            billSummary[0]?.unpaid_bills
                        ),

                    unpaid_amount:
                        toNumber(
                            billSummary[0]?.unpaid_amount
                        ),

                    late:
                        toNumber(
                            billSummary[0]?.late_bills
                        ),

                    late_amount:
                        toNumber(
                            billSummary[0]?.late_amount
                        )
                },


                income: {

                    transactions:
                        toNumber(
                            incomeSummary[0]?.total_transactions
                        ),

                    amount:
                        totalIncome
                },


                expense: {

                    transactions:
                        toNumber(
                            expenseSummary[0]?.total_transactions
                        ),

                    amount:
                        totalExpense
                },


                financial: {

                    total_income:
                        totalIncome,

                    total_expense:
                        totalExpense,

                    net_income:
                        netIncome
                },


                payments: {

                    total:
                        toNumber(
                            paymentSummary[0]?.total_payments
                        ),

                    amount:
                        toNumber(
                            paymentSummary[0]?.total_amount
                        )
                }

            }

        });

    } catch (error) {

        console.error(
            "Monthly Dashboard Error:",
            error
        );

        res.status(500).json({

            success: false,

            message:
                "Gagal mengambil dashboard bulanan",

            error:
                error.message
        });
    }
};


// ============================================================
// GET MONTHLY BILL SUMMARY
// ============================================================

const getMonthlyBillSummary = async (req, res) => {

    try {

        const {
            month,
            year
        } = req.query;


        if (!month || !year) {

            return res.status(400).json({

                success: false,

                message:
                    "month dan year wajib diisi"
            });
        }


        const monthNumber =
            Number(month);

        const yearNumber =
            Number(year);


        if (
            !Number.isInteger(monthNumber) ||
            monthNumber < 1 ||
            monthNumber > 12
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "month harus berupa angka 1 sampai 12"
            });
        }


        if (
            !Number.isInteger(yearNumber) ||
            yearNumber < 2000
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "year tidak valid"
            });
        }


        const [summary] = await db.query(`
            SELECT

                COUNT(*) AS total_bills,

                COALESCE(
                    SUM(amount),
                    0
                ) AS total_amount,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'paid'
                            THEN amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS paid_amount,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'unpaid'
                            THEN amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS unpaid_amount,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'late'
                            THEN amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS late_amount,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'paid'
                            THEN 1
                            ELSE 0
                        END
                    ),
                    0
                ) AS paid_bills,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'unpaid'
                            THEN 1
                            ELSE 0
                        END
                    ),
                    0
                ) AS unpaid_bills,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'late'
                            THEN 1
                            ELSE 0
                        END
                    ),
                    0
                ) AS late_bills

            FROM bills

            WHERE billing_month = ?
            AND billing_year = ?
        `, [
            monthNumber,
            yearNumber
        ]);


        res.json({

            success: true,

            data: {

                month:
                    monthNumber,

                year:
                    yearNumber,

                bills: {

                    total:
                        toNumber(
                            summary[0]?.total_bills
                        ),

                    paid:
                        toNumber(
                            summary[0]?.paid_bills
                        ),

                    unpaid:
                        toNumber(
                            summary[0]?.unpaid_bills
                        ),

                    late:
                        toNumber(
                            summary[0]?.late_bills
                        )
                },

                amount: {

                    total:
                        toNumber(
                            summary[0]?.total_amount
                        ),

                    paid:
                        toNumber(
                            summary[0]?.paid_amount
                        ),

                    unpaid:
                        toNumber(
                            summary[0]?.unpaid_amount
                        ),

                    late:
                        toNumber(
                            summary[0]?.late_amount
                        )
                }

            }

        });

    } catch (error) {

        console.error(
            "Monthly Bill Summary Error:",
            error
        );

        res.status(500).json({

            success: false,

            message:
                "Gagal mengambil summary tagihan bulanan",

            error:
                error.message
        });
    }
};


// ============================================================
// GET FINANCIAL DASHBOARD
// ============================================================

const getFinancialDashboard = async (req, res) => {

    try {

        const {
            month,
            year
        } = req.query;


        if (!month || !year) {

            return res.status(400).json({

                success: false,

                message:
                    "Bulan dan tahun wajib diisi"
            });
        }


        const monthNumber =
            Number(month);

        const yearNumber =
            Number(year);


        if (
            !Number.isInteger(monthNumber) ||
            monthNumber < 1 ||
            monthNumber > 12 ||
            !Number.isInteger(yearNumber) ||
            yearNumber < 2000
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Bulan atau tahun tidak valid"
            });
        }


        // ========================================================
        // INCOME
        // ========================================================

        const [incomeSummary] = await db.query(`
            SELECT

                COUNT(*) AS total_transactions,

                COALESCE(
                    SUM(amount),
                    0
                ) AS total_amount

            FROM incomes

            WHERE MONTH(income_date) = ?
            AND YEAR(income_date) = ?
        `, [
            monthNumber,
            yearNumber
        ]);


        // ========================================================
        // EXPENSE
        // ========================================================

        const [expenseSummary] = await db.query(`
            SELECT

                COUNT(*) AS total_transactions,

                COALESCE(
                    SUM(amount),
                    0
                ) AS total_amount

            FROM expenses

            WHERE MONTH(expense_date) = ?
            AND YEAR(expense_date) = ?
        `, [
            monthNumber,
            yearNumber
        ]);


        // ========================================================
        // BILLS
        // ========================================================

        const [billSummary] = await db.query(`
            SELECT

                COUNT(*) AS total_bills,

                COALESCE(
                    SUM(amount),
                    0
                ) AS total_amount,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'paid'
                            THEN amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS paid_amount,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'unpaid'
                            THEN amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS unpaid_amount,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'late'
                            THEN amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS late_amount,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'paid'
                            THEN 1
                            ELSE 0
                        END
                    ),
                    0
                ) AS paid_bills,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'unpaid'
                            THEN 1
                            ELSE 0
                        END
                    ),
                    0
                ) AS unpaid_bills,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'late'
                            THEN 1
                            ELSE 0
                        END
                    ),
                    0
                ) AS late_bills

            FROM bills

            WHERE billing_month = ?
            AND billing_year = ?
        `, [
            monthNumber,
            yearNumber
        ]);


        // ========================================================
        // PAYMENTS
        // ========================================================

        const [paymentSummary] = await db.query(`
            SELECT

                COUNT(*) AS total_payments,

                COALESCE(
                    SUM(amount),
                    0
                ) AS total_amount

            FROM payments

            WHERE MONTH(payment_date) = ?
            AND YEAR(payment_date) = ?
        `, [
            monthNumber,
            yearNumber
        ]);


        const totalIncome =
            toNumber(
                incomeSummary[0]?.total_amount
            );

        const totalExpense =
            toNumber(
                expenseSummary[0]?.total_amount
            );

        const netIncome =
            totalIncome - totalExpense;


        // ========================================================
        // RESPONSE
        // ========================================================

        res.json({

            success: true,

            data: {

                period: {

                    month:
                        monthNumber,

                    year:
                        yearNumber
                },


                income: {

                    transactions:
                        toNumber(
                            incomeSummary[0]?.total_transactions
                        ),

                    amount:
                        totalIncome
                },


                expense: {

                    transactions:
                        toNumber(
                            expenseSummary[0]?.total_transactions
                        ),

                    amount:
                        totalExpense
                },


                financial: {

                    total_income:
                        totalIncome,

                    total_expense:
                        totalExpense,

                    net_income:
                        netIncome
                },


                bills: {

                    total:
                        toNumber(
                            billSummary[0]?.total_bills
                        ),

                    total_amount:
                        toNumber(
                            billSummary[0]?.total_amount
                        ),

                    paid:
                        toNumber(
                            billSummary[0]?.paid_bills
                        ),

                    paid_amount:
                        toNumber(
                            billSummary[0]?.paid_amount
                        ),

                    unpaid:
                        toNumber(
                            billSummary[0]?.unpaid_bills
                        ),

                    unpaid_amount:
                        toNumber(
                            billSummary[0]?.unpaid_amount
                        ),

                    late:
                        toNumber(
                            billSummary[0]?.late_bills
                        ),

                    late_amount:
                        toNumber(
                            billSummary[0]?.late_amount
                        )
                },


                payments: {

                    total:
                        toNumber(
                            paymentSummary[0]?.total_payments
                        ),

                    amount:
                        toNumber(
                            paymentSummary[0]?.total_amount
                        )
                }

            }

        });

    } catch (error) {

        console.error(
            "Financial Dashboard Error:",
            error
        );

        res.status(500).json({

            success: false,

            message:
                "Gagal mengambil dashboard keuangan",

            error:
                error.message
        });
    }
};


// ============================================================
// GET FINANCIAL REPORT
// ============================================================

const getFinancialReport = async (req, res) => {

    try {

        const {
            month,
            year
        } = req.query;


        if (!month || !year) {

            return res.status(400).json({

                success: false,

                message:
                    "Bulan dan tahun wajib diisi"
            });
        }


        const monthNumber =
            Number(month);

        const yearNumber =
            Number(year);


        if (
            !Number.isInteger(monthNumber) ||
            monthNumber < 1 ||
            monthNumber > 12 ||
            !Number.isInteger(yearNumber) ||
            yearNumber < 2000
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Bulan atau tahun tidak valid"
            });
        }


        // ========================================================
        // INCOME
        // ========================================================

        const [incomeSummary] = await db.query(`
            SELECT

                COUNT(*) AS total_transactions,

                COALESCE(
                    SUM(amount),
                    0
                ) AS total_amount

            FROM incomes

            WHERE MONTH(income_date) = ?
            AND YEAR(income_date) = ?
        `, [
            monthNumber,
            yearNumber
        ]);


        // ========================================================
        // EXPENSE
        // ========================================================

        const [expenseSummary] = await db.query(`
            SELECT

                COUNT(*) AS total_transactions,

                COALESCE(
                    SUM(amount),
                    0
                ) AS total_amount

            FROM expenses

            WHERE MONTH(expense_date) = ?
            AND YEAR(expense_date) = ?
        `, [
            monthNumber,
            yearNumber
        ]);


        // ========================================================
        // BILLS
        // ========================================================

        const [billSummary] = await db.query(`
            SELECT

                COUNT(*) AS total_bills,

                COALESCE(
                    SUM(amount),
                    0
                ) AS total_amount,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'paid'
                            THEN amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS paid_amount,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'unpaid'
                            THEN amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS unpaid_amount,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'late'
                            THEN amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS late_amount,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'paid'
                            THEN 1
                            ELSE 0
                        END
                    ),
                    0
                ) AS paid_bills,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'unpaid'
                            THEN 1
                            ELSE 0
                        END
                    ),
                    0
                ) AS unpaid_bills,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'late'
                            THEN 1
                            ELSE 0
                        END
                    ),
                    0
                ) AS late_bills

            FROM bills

            WHERE billing_month = ?
            AND billing_year = ?
        `, [
            monthNumber,
            yearNumber
        ]);


        // ========================================================
        // PAYMENTS
        // ========================================================

        const [paymentSummary] = await db.query(`
            SELECT

                COUNT(*) AS total_payments,

                COALESCE(
                    SUM(amount),
                    0
                ) AS total_amount

            FROM payments

            WHERE MONTH(payment_date) = ?
            AND YEAR(payment_date) = ?
        `, [
            monthNumber,
            yearNumber
        ]);


        // ========================================================
        // INCOME CATEGORIES
        // ========================================================

        const [incomeCategories] = await db.query(`
            SELECT

                category,

                COUNT(*) AS transactions,

                COALESCE(
                    SUM(amount),
                    0
                ) AS amount

            FROM incomes

            WHERE MONTH(income_date) = ?
            AND YEAR(income_date) = ?

            GROUP BY category

            ORDER BY amount DESC
        `, [
            monthNumber,
            yearNumber
        ]);


        // ========================================================
        // EXPENSE CATEGORIES
        // ========================================================

        const [expenseCategories] = await db.query(`
            SELECT

                category,

                COUNT(*) AS transactions,

                COALESCE(
                    SUM(amount),
                    0
                ) AS amount

            FROM expenses

            WHERE MONTH(expense_date) = ?
            AND YEAR(expense_date) = ?

            GROUP BY category

            ORDER BY amount DESC
        `, [
            monthNumber,
            yearNumber
        ]);


        const totalIncome =
            toNumber(
                incomeSummary[0]?.total_amount
            );

        const totalExpense =
            toNumber(
                expenseSummary[0]?.total_amount
            );


        res.json({

            success: true,

            data: {

                period: {

                    month:
                        monthNumber,

                    year:
                        yearNumber
                },


                financial: {

                    total_income:
                        totalIncome,

                    total_expense:
                        totalExpense,

                    net_income:
                        totalIncome - totalExpense
                },


                income: {

                    transactions:
                        toNumber(
                            incomeSummary[0]?.total_transactions
                        ),

                    amount:
                        totalIncome,

                    categories:
                        incomeCategories.map(item => ({

                            category:
                                item.category,

                            transactions:
                                toNumber(
                                    item.transactions
                                ),

                            amount:
                                toNumber(
                                    item.amount
                                )

                        }))
                },


                expense: {

                    transactions:
                        toNumber(
                            expenseSummary[0]?.total_transactions
                        ),

                    amount:
                        totalExpense,

                    categories:
                        expenseCategories.map(item => ({

                            category:
                                item.category,

                            transactions:
                                toNumber(
                                    item.transactions
                                ),

                            amount:
                                toNumber(
                                    item.amount
                                )

                        }))
                },


                bills: {

                    total:
                        toNumber(
                            billSummary[0]?.total_bills
                        ),

                    total_amount:
                        toNumber(
                            billSummary[0]?.total_amount
                        ),

                    paid:
                        toNumber(
                            billSummary[0]?.paid_bills
                        ),

                    paid_amount:
                        toNumber(
                            billSummary[0]?.paid_amount
                        ),

                    unpaid:
                        toNumber(
                            billSummary[0]?.unpaid_bills
                        ),

                    unpaid_amount:
                        toNumber(
                            billSummary[0]?.unpaid_amount
                        ),

                    late:
                        toNumber(
                            billSummary[0]?.late_bills
                        ),

                    late_amount:
                        toNumber(
                            billSummary[0]?.late_amount
                        )
                },


                payments: {

                    total:
                        toNumber(
                            paymentSummary[0]?.total_payments
                        ),

                    amount:
                        toNumber(
                            paymentSummary[0]?.total_amount
                        )
                }

            }

        });

    } catch (error) {

        console.error(
            "Financial Report Error:",
            error
        );

        res.status(500).json({

            success: false,

            message:
                "Gagal mengambil laporan keuangan",

            error:
                error.message
        });
    }
};


// ============================================================
// GET MONTHLY FINANCIAL REPORT
// ============================================================

const getMonthlyFinancialReport = async (req, res) => {

    try {

        const {
            month,
            year
        } = req.query;


        if (!month || !year) {

            return res.status(400).json({

                success: false,

                message:
                    "Bulan dan tahun wajib diisi"
            });
        }


        const monthNumber =
            Number(month);

        const yearNumber =
            Number(year);


        if (
            !Number.isInteger(monthNumber) ||
            monthNumber < 1 ||
            monthNumber > 12 ||
            !Number.isInteger(yearNumber) ||
            yearNumber < 2000
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Bulan atau tahun tidak valid"
            });
        }


        // ========================================================
        // INCOME
        // ========================================================

        const [incomeSummary] = await db.query(`
            SELECT

                COUNT(*) AS total_transactions,

                COALESCE(
                    SUM(amount),
                    0
                ) AS total_amount

            FROM incomes

            WHERE MONTH(income_date) = ?
            AND YEAR(income_date) = ?
        `, [
            monthNumber,
            yearNumber
        ]);


        // ========================================================
        // EXPENSE
        // ========================================================

        const [expenseSummary] = await db.query(`
            SELECT

                COUNT(*) AS total_transactions,

                COALESCE(
                    SUM(amount),
                    0
                ) AS total_amount

            FROM expenses

            WHERE MONTH(expense_date) = ?
            AND YEAR(expense_date) = ?
        `, [
            monthNumber,
            yearNumber
        ]);


        // ========================================================
        // BILLS
        // ========================================================

        const [billSummary] = await db.query(`
            SELECT

                COUNT(*) AS total_bills,

                COALESCE(
                    SUM(amount),
                    0
                ) AS total_amount,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'paid'
                            THEN amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS paid_amount,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'unpaid'
                            THEN amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS unpaid_amount,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'late'
                            THEN amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS late_amount,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'paid'
                            THEN 1
                            ELSE 0
                        END
                    ),
                    0
                ) AS paid_bills,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'unpaid'
                            THEN 1
                            ELSE 0
                        END
                    ),
                    0
                ) AS unpaid_bills,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'late'
                            THEN 1
                            ELSE 0
                        END
                    ),
                    0
                ) AS late_bills

            FROM bills

            WHERE billing_month = ?
            AND billing_year = ?
        `, [
            monthNumber,
            yearNumber
        ]);


        // ========================================================
        // PAYMENTS
        // ========================================================

        const [paymentSummary] = await db.query(`
            SELECT

                COUNT(*) AS total_payments,

                COALESCE(
                    SUM(amount),
                    0
                ) AS total_amount

            FROM payments

            WHERE MONTH(payment_date) = ?
            AND YEAR(payment_date) = ?
        `, [
            monthNumber,
            yearNumber
        ]);


        const totalIncome =
            toNumber(
                incomeSummary[0]?.total_amount
            );

        const totalExpense =
            toNumber(
                expenseSummary[0]?.total_amount
            );


        res.json({

            success: true,

            data: {

                period: {

                    month:
                        monthNumber,

                    year:
                        yearNumber
                },


                income: {

                    transactions:
                        toNumber(
                            incomeSummary[0]?.total_transactions
                        ),

                    amount:
                        totalIncome
                },


                expense: {

                    transactions:
                        toNumber(
                            expenseSummary[0]?.total_transactions
                        ),

                    amount:
                        totalExpense
                },


                financial: {

                    total_income:
                        totalIncome,

                    total_expense:
                        totalExpense,

                    net_income:
                        totalIncome - totalExpense
                },


                bills: {

                    total:
                        toNumber(
                            billSummary[0]?.total_bills
                        ),

                    total_amount:
                        toNumber(
                            billSummary[0]?.total_amount
                        ),

                    paid:
                        toNumber(
                            billSummary[0]?.paid_bills
                        ),

                    paid_amount:
                        toNumber(
                            billSummary[0]?.paid_amount
                        ),

                    unpaid:
                        toNumber(
                            billSummary[0]?.unpaid_bills
                        ),

                    unpaid_amount:
                        toNumber(
                            billSummary[0]?.unpaid_amount
                        ),

                    late:
                        toNumber(
                            billSummary[0]?.late_bills
                        ),

                    late_amount:
                        toNumber(
                            billSummary[0]?.late_amount
                        )
                },


                payments: {

                    total:
                        toNumber(
                            paymentSummary[0]?.total_payments
                        ),

                    amount:
                        toNumber(
                            paymentSummary[0]?.total_amount
                        )
                }

            }

        });

    } catch (error) {

        console.error(
            "Monthly Financial Report Error:",
            error
        );

        res.status(500).json({

            success: false,

            message:
                "Gagal mengambil laporan bulanan",

            error:
                error.message
        });
    }
};


// ============================================================
// EXPORT
// ============================================================

module.exports = {

    getDashboardSummary,

    getMonthlyBillSummary,

    getMonthlyDashboard,

    getFinancialDashboard,

    getFinancialReport,

    getMonthlyFinancialReport

};