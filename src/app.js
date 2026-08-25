const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
require("dotenv").config();

const db = require("./config/database");
const cron = require("node-cron");

// ======================================================
// WHATSAPP REMINDER JOB
// ======================================================

const {
    runWhatsAppReminderJob
} = require("./jobs/whatsappReminderJob");


// ======================================================
// IMPORT ROUTES
// ======================================================

const roomRoutes = require("./routes/roomRoutes");
const buildingRoutes = require("./routes/buildingRoutes");
const floorRoutes = require("./routes/floorRoutes");
const tenantRoutes = require("./routes/tenantRoutes");
const contractRoutes = require("./routes/contractRoutes");
const billRoutes = require("./routes/billRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const incomeRoutes = require("./routes/incomeRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const bankAccountRoutes = require("./routes/bankAccountRoutes");
const reconciliationRoutes = require("./routes/reconciliationRoutes");
const authRoutes = require("./routes/authRoutes");
const reportRoutes = require("./routes/reportRoutes");


// ======================================================
// MIDDLEWARE AUTH
// ======================================================

const authenticateToken =
    require("./middleware/authMiddleware");


// ======================================================
// APP
// ======================================================

const app = express();

const PORT = 5000;


// ======================================================
// MIDDLEWARE
// ======================================================

app.use(helmet());

app.use(cors());

app.use(express.json());


// ======================================================
// CHECK ROUTES
// ======================================================

console.log("");
console.log("========================================");
console.log("CHECK ROUTES");
console.log("========================================");

console.log(
    "roomRoutes:",
    typeof roomRoutes
);

console.log(
    "buildingRoutes:",
    typeof buildingRoutes
);

console.log(
    "floorRoutes:",
    typeof floorRoutes
);

console.log(
    "tenantRoutes:",
    typeof tenantRoutes
);

console.log(
    "contractRoutes:",
    typeof contractRoutes
);

console.log(
    "billRoutes:",
    typeof billRoutes
);

console.log(
    "paymentRoutes:",
    typeof paymentRoutes
);

console.log(
    "dashboardRoutes:",
    typeof dashboardRoutes
);

console.log(
    "incomeRoutes:",
    typeof incomeRoutes
);

console.log(
    "expenseRoutes:",
    typeof expenseRoutes
);

console.log(
    "bankAccountRoutes:",
    typeof bankAccountRoutes
);

console.log(
    "reconciliationRoutes:",
    typeof reconciliationRoutes
);

console.log(
    "authRoutes:",
    typeof authRoutes
);

console.log(
    "reportRoutes:",
    typeof reportRoutes
);

console.log("========================================");
console.log("");


// ======================================================
// API ROUTES
// ======================================================


// ======================================================
// ROOMS
// ======================================================

app.use(
    "/api/rooms",
    roomRoutes
);


// ======================================================
// BUILDINGS
// ======================================================

app.use(
    "/api/buildings",
    buildingRoutes
);


// ======================================================
// FLOORS
// ======================================================

app.use(
    "/api/floors",
    floorRoutes
);


// ======================================================
// TENANTS
// ======================================================

app.use(
    "/api/tenants",
    tenantRoutes
);


// ======================================================
// CONTRACTS
// ======================================================

app.use(
    "/api/contracts",
    contractRoutes
);


// ======================================================
// BILLS
// ======================================================

app.use(
    "/api/bills",
    billRoutes
);


// ======================================================
// PAYMENTS
// ======================================================

app.use(
    "/api/payments",
    paymentRoutes
);


// ======================================================
// DASHBOARD
// ======================================================

app.use(
    "/api/dashboard",
    dashboardRoutes
);


// ======================================================
// INCOMES
// ======================================================

app.use(
    "/api/incomes",
    incomeRoutes
);


// ======================================================
// EXPENSES
// ======================================================

app.use(
    "/api/expenses",
    expenseRoutes
);


// ======================================================
// BANK ACCOUNTS
// ======================================================
//
// GET     /api/bank-accounts
// GET     /api/bank-accounts/:id
// POST    /api/bank-accounts
// PUT     /api/bank-accounts/:id
// DELETE  /api/bank-accounts/:id
//
// ======================================================

app.use(
    "/api/bank-accounts",
    bankAccountRoutes
);


// ======================================================
// RECONCILIATIONS
// ======================================================

app.use(
    "/api/reconciliations",
    reconciliationRoutes
);


// ======================================================
// AUTH
// ======================================================

app.use(
    "/api/auth",
    authRoutes
);


// ======================================================
// REPORTS
// ======================================================

app.use(
    "/api/reports",
    reportRoutes
);


// ======================================================
// AUTH TEST
// ======================================================

app.get(
    "/api/auth/me",
    authenticateToken,
    (req, res) => {

        res.json({

            success: true,

            message: "Token valid",

            data: {
                user: req.user
            }

        });

    }
);


// ======================================================
// TEST BACKEND
// ======================================================

app.get(
    "/",
    (req, res) => {

        res.json({

            success: true,

            message:
                "ADELINA KOST Backend berhasil berjalan 🚀"

        });

    }
);


// ======================================================
// TEST DATABASE
// ======================================================

app.get(
    "/api/test-db",
    async (req, res) => {

        try {

            const [rows] =
                await db.query(
                    "SELECT 1 AS connected"
                );


            res.json({

                success: true,

                message:
                    "Database Adelina Kost berhasil terhubung",

                data: rows

            });

        } catch (error) {

            console.error(
                "Database Error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Database gagal terhubung",

                error:
                    error.message

            });

        }

    }
);


// ======================================================
// WHATSAPP REMINDER CRON JOB
// ======================================================
//
// FUNGSI:
//
// Menjalankan pengecekan tagihan setiap hari
// pada pukul 09:00 WIB.
//
// ======================================================

cron.schedule(
    "0 9 * * *",
    async () => {

        console.log("");

        console.log(
            "========================================"
        );

        console.log(
            "WHATSAPP REMINDER JOB DIMULAI"
        );

        console.log(
            "Waktu:",
            new Date().toLocaleString(
                "id-ID",
                {
                    timeZone: "Asia/Jakarta"
                }
            )
        );

        console.log(
            "========================================"
        );


        try {

            const result =
                await runWhatsAppReminderJob();


            console.log(
                "WhatsApp Reminder Job selesai."
            );


            console.log(
                "Hasil:",
                result
            );


        } catch (error) {

            console.error(
                "WhatsApp Reminder Job Error:",
                error
            );

        }


        console.log(
            "========================================"
        );

        console.log("");

    },
    {
        timezone: "Asia/Jakarta"
    }
);


// ======================================================
// START SERVER
// ======================================================

app.listen(
    PORT,
    () => {

        console.log(
            "================================="
        );

        console.log(
            "ADELINA KOST BACKEND"
        );

        console.log(
            `Server : http://localhost:${PORT}`
        );

        console.log(
            `DB Test: http://localhost:${PORT}/api/test-db`
        );

        console.log(
            `Report: http://localhost:${PORT}/api/reports?month=8&year=2026`
        );

        console.log(
            `Bank Accounts: http://localhost:${PORT}/api/bank-accounts`
        );

        console.log(
            `Reconciliations: http://localhost:${PORT}/api/reconciliations`
        );

        console.log(
            "WhatsApp Reminder Job: AKTIF"
        );

        console.log(
            "Schedule: Setiap hari pukul 09:00 WIB"
        );

        console.log(
            "Timezone: Asia/Jakarta"
        );

        console.log(
            "================================="
        );

    }
);