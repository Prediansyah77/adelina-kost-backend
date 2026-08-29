const db = require("../config/database");


// =====================================================
// GET LAPORAN KEUANGAN
// GET /api/reports
//
// MODE 1 — BULANAN
// /api/reports?month=8&year=2026
//
// MODE 2 — CUSTOM TANGGAL
// /api/reports?startDate=2026-08-01&endDate=2026-08-30
//
// BACKWARD COMPATIBILITY:
// /api/reports?start_date=2026-08-01&end_date=2026-08-30
// =====================================================

const getFinancialReport = async (req, res) => {

    try {

        const {
            month,
            year,

            // Format baru
            startDate,
            endDate,

            // Format lama
            start_date,
            end_date

        } = req.query;


        // =================================================
        // NORMALISASI CUSTOM DATE
        //
        // Prioritas:
        // startDate / endDate
        //
        // Jika tidak ada:
        // start_date / end_date
        // =================================================

        const customStartDate =
            startDate || start_date;

        const customEndDate =
            endDate || end_date;


        // =================================================
        // TENTUKAN MODE LAPORAN
        // =================================================

        const isMonthly =
            month !== undefined &&
            year !== undefined;


        const isCustomDate =
            customStartDate !== undefined &&
            customEndDate !== undefined;


        // =================================================
        // TIDAK BOLEH CAMPUR MODE
        // =================================================

        if (
            isMonthly &&
            isCustomDate
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Gunakan laporan bulanan atau custom tanggal, jangan keduanya sekaligus."

            });

        }


        // =================================================
        // MODE CUSTOM TANGGAL
        // =================================================

        if (isCustomDate) {

            // -------------------------------------------------
            // VALIDASI FORMAT TANGGAL
            // -------------------------------------------------

            const dateRegex =
                /^\d{4}-\d{2}-\d{2}$/;


            if (
                !dateRegex.test(customStartDate) ||
                !dateRegex.test(customEndDate)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Format tanggal harus YYYY-MM-DD"

                });

            }


            // -------------------------------------------------
            // VALIDASI TANGGAL
            // -------------------------------------------------

            const startDateObject =
                new Date(
                    `${customStartDate}T00:00:00`
                );


            const endDateObject =
                new Date(
                    `${customEndDate}T00:00:00`
                );


            if (
                Number.isNaN(
                    startDateObject.getTime()
                ) ||
                Number.isNaN(
                    endDateObject.getTime()
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Tanggal tidak valid"

                });

            }


            // -------------------------------------------------
            // END DATE TIDAK BOLEH SEBELUM START DATE
            // -------------------------------------------------

            if (
                endDateObject < startDateObject
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Tanggal sampai tidak boleh sebelum tanggal mulai"

                });

            }

        }


        // =================================================
        // MODE BULANAN
        // =================================================

        else if (isMonthly) {

            const monthNumber =
                Number(month);


            const yearNumber =
                Number(year);


            // -------------------------------------------------
            // VALIDASI MONTH
            // -------------------------------------------------

            if (
                !Number.isInteger(
                    monthNumber
                ) ||
                monthNumber < 1 ||
                monthNumber > 12
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "month harus berupa angka 1 sampai 12"

                });

            }


            // -------------------------------------------------
            // VALIDASI YEAR
            // -------------------------------------------------

            if (
                !Number.isInteger(
                    yearNumber
                ) ||
                yearNumber < 2000
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "year tidak valid"

                });

            }

        }


        // =================================================
        // TIDAK ADA FILTER
        // =================================================

        else {

            return res.status(400).json({

                success: false,

                message:
                    "Gunakan month & year atau startDate & endDate"

            });

        }


        // =================================================
        // KONDISI SQL
        // =================================================

        let paymentDateCondition = "";

        let expenseDateCondition = "";

        let paymentParams = [];

        let expenseParams = [];


        // =================================================
        // MODE BULANAN
        // =================================================

        if (isMonthly) {

            const monthNumber =
                Number(month);


            const yearNumber =
                Number(year);


            paymentDateCondition = `
                MONTH(p.payment_date) = ?
                AND YEAR(p.payment_date) = ?
            `;


            paymentParams = [
                monthNumber,
                yearNumber
            ];


            expenseDateCondition = `
                MONTH(expense_date) = ?
                AND YEAR(expense_date) = ?
            `;


            expenseParams = [
                monthNumber,
                yearNumber
            ];

        }


        // =================================================
        // MODE CUSTOM TANGGAL
        // =================================================

        if (isCustomDate) {

            paymentDateCondition = `
                p.payment_date >= ?
                AND p.payment_date < DATE_ADD(?, INTERVAL 1 DAY)
            `;


            paymentParams = [
                customStartDate,
                customEndDate
            ];


            expenseDateCondition = `
                expense_date >= ?
                AND expense_date < DATE_ADD(?, INTERVAL 1 DAY)
            `;


            expenseParams = [
                customStartDate,
                customEndDate
            ];

        }


        // =================================================
        // PEMASUKAN
        // =================================================

        const [payments] =
            await db.query(
                `
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

                WHERE
                    ${paymentDateCondition}

                ORDER BY
                    p.payment_date DESC,
                    p.id DESC
                `,
                paymentParams
            );


        // =================================================
        // TOTAL PEMASUKAN
        // =================================================

        const totalIncome =
            payments.reduce(
                (
                    total,
                    payment
                ) => {

                    return (
                        total +
                        Number(
                            payment.amount || 0
                        )
                    );

                },
                0
            );


        // =================================================
        // PENGELUARAN
        // =================================================

        const [expenses] =
            await db.query(
                `
                SELECT

                    id,

                    expense_date,

                    category,

                    description,

                    amount

                FROM expenses

                WHERE
                    ${expenseDateCondition}

                ORDER BY
                    expense_date DESC,
                    id DESC
                `,
                expenseParams
            );


        // =================================================
        // TOTAL PENGELUARAN
        // =================================================

        const totalExpense =
            expenses.reduce(
                (
                    total,
                    expense
                ) => {

                    return (
                        total +
                        Number(
                            expense.amount || 0
                        )
                    );

                },
                0
            );


        // =================================================
        // LABA BERSIH
        // =================================================

        const netIncome =
            totalIncome -
            totalExpense;


        // =================================================
        // REKAP PENGELUARAN PER KATEGORI
        // =================================================

        const [expenseCategories] =
            await db.query(
                `
                SELECT

                    category,

                    COUNT(*) AS transaction_count,

                    COALESCE(
                        SUM(amount),
                        0
                    ) AS total_amount

                FROM expenses

                WHERE
                    ${expenseDateCondition}

                GROUP BY
                    category

                ORDER BY
                    total_amount DESC
                `,
                expenseParams
            );


        // =================================================
        // PERIOD RESPONSE
        // =================================================

        let period;


        if (isMonthly) {

            period = {

                type:
                    "monthly",

                month:
                    Number(month),

                year:
                    Number(year)

            };

        } else {

            period = {

                type:
                    "custom",

                start_date:
                    customStartDate,

                end_date:
                    customEndDate

            };

        }


        // =================================================
        // RESPONSE
        // =================================================

        res.json({

            success: true,

            data: {

                period,


                // =================================================
                // SUMMARY
                // =================================================

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


                // =================================================
                // INCOME
                // =================================================

                income:

                    payments.map(
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


                // =================================================
                // EXPENSES
                // =================================================

                expenses:

                    expenses.map(
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


                // =================================================
                // EXPENSE CATEGORIES
                // =================================================

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

            message:
                "Gagal mengambil laporan keuangan",

            error:
                error.message

        });

    }

};


// =====================================================
// EXPORT
// =====================================================

module.exports = {

    getFinancialReport

};