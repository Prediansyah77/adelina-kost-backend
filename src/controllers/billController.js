const db = require("../config/database");

const SYSTEM_START_YEAR = 2026;
const SYSTEM_START_MONTH = 8;


// =====================================================
// HELPER
// =====================================================

/**
 * Normalisasi tanggal menjadi YYYY-MM-DD.
 *
 * Tidak menggunakan:
 * new Date("YYYY-MM-DD")
 *
 * karena bisa menyebabkan tanggal mundur 1 hari
 * akibat timezone.
 */
const normalizeDateOnly = (value) => {

    if (!value) {
        return null;
    }

    // Jika string
    if (typeof value === "string") {

        const datePart = value.slice(0, 10);

        if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
            return null;
        }

        return datePart;
    }

    // Jika Date object
    if (value instanceof Date) {

        if (Number.isNaN(value.getTime())) {
            return null;
        }

        return [
            value.getUTCFullYear(),
            String(value.getUTCMonth() + 1).padStart(2, "0"),
            String(value.getUTCDate()).padStart(2, "0")
        ].join("-");
    }

    return null;
};


// =====================================================
// GET CURRENT DATE WIB
// =====================================================

/**
 * Mengambil tanggal sekarang berdasarkan WIB.
 *
 * Hasil:
 * {
 *     year: 2026,
 *     month: 8,
 *     day: 22
 * }
 */
const getCurrentWIBDate = () => {

    const formatter = new Intl.DateTimeFormat(
        "en-CA",
        {
            timeZone: "Asia/Jakarta",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }
    );

    const parts = formatter.formatToParts(new Date());

    const result = {};

    for (const part of parts) {

        if (
            part.type === "year" ||
            part.type === "month" ||
            part.type === "day"
        ) {

            result[part.type] =
                Number(part.value);
        }
    }

    return result;
};


// =====================================================
// JUMLAH HARI DALAM BULAN
// =====================================================

/**
 * month:
 * 1  = Januari
 * 2  = Februari
 * ...
 * 12 = Desember
 */
const getDaysInMonth = (
    year,
    month
) => {

    return new Date(
        Date.UTC(
            year,
            month,
            0
        )
    ).getUTCDate();

};


// =====================================================
// PERIODE REQUEST
// =====================================================

/**
 * Mengambil bulan dan tahun dari:
 *
 * GET:
 * /api/bills?month=8&year=2026
 *
 * Jika tidak ada:
 * gunakan bulan/tahun sekarang WIB.
 */
const getRequestedPeriod = (req) => {

    const currentDate =
        getCurrentWIBDate();


    const rawMonth =
        req.query?.month ??
        req.body?.billing_month ??
        req.body?.billingMonth ??
        currentDate.month;


    const rawYear =
        req.query?.year ??
        req.body?.billing_year ??
        req.body?.billingYear ??
        currentDate.year;


    return {
        billingMonth: Number(rawMonth),
        billingYear: Number(rawYear)
    };

};


// =====================================================
// BANDINGKAN PERIODE
// =====================================================

/**
 * Mengubah periode menjadi angka yang mudah dibandingkan.
 *
 * Contoh:
 *
 * Agustus 2026
 * = 2026 * 12 + 8
 */
const periodValue = (
    year,
    month
) => {

    return (
        Number(year) * 12 +
        Number(month)
    );

};


// =====================================================
// CEK PERIODE SEBELUM SISTEM
// =====================================================

/**
 * Mengecek apakah periode berada sebelum
 * sistem mulai digunakan.
 *
 * Sistem mulai:
 * Agustus 2026
 */
const isBeforeSystemStart = (
    billingYear,
    billingMonth
) => {

    return (
        periodValue(
            billingYear,
            billingMonth
        ) <
        periodValue(
            SYSTEM_START_YEAR,
            SYSTEM_START_MONTH
        )
    );

};


// =====================================================
// VALIDASI PERIODE
// =====================================================

const validateBillingPeriod = (
    billingMonth,
    billingYear
) => {

    if (
        !Number.isInteger(billingMonth) ||
        billingMonth < 1 ||
        billingMonth > 12
    ) {

        return {
            valid: false,
            message:
                "Bulan tagihan tidak valid. Gunakan angka 1 sampai 12."
        };

    }


    if (
        !Number.isInteger(billingYear) ||
        billingYear < 2000 ||
        billingYear > 2100
    ) {

        return {
            valid: false,
            message:
                "Tahun tagihan tidak valid."
        };

    }


    // =============================================
    // PERIODE SEBELUM SISTEM
    // =============================================

    if (
        isBeforeSystemStart(
            billingYear,
            billingMonth
        )
    ) {

        return {
            valid: false,

            code:
                "PERIOD_BEFORE_SYSTEM_START",

            message:
                `Periode tagihan ${billingMonth}/${billingYear} tidak tersedia karena sistem ADELINA KOST mulai digunakan pada ${SYSTEM_START_MONTH}/${SYSTEM_START_YEAR}.`
        };

    }


    return {
        valid: true
    };

};


// =====================================================
// FORMAT TANGGAL
// =====================================================

const buildDate = (
    year,
    month,
    day
) => {

    return (
        `${year}-` +
        `${String(month).padStart(2, "0")}-` +
        `${String(day).padStart(2, "0")}`
    );

};


// =====================================================
// HITUNG DUE DATE
// =====================================================

/**
 * Contoh:
 *
 * start_date = 2026-08-16
 * billing    = 8 / 2026
 *
 * due_date   = 2026-08-16
 *
 *
 * Jika start_date = 2026-08-31
 * billing September:
 *
 * due_date = 2026-09-30
 */
const calculateDueDate = (
    startDate,
    billingYear,
    billingMonth
) => {

    const normalizedStartDate =
        normalizeDateOnly(startDate);


    if (!normalizedStartDate) {
        return null;
    }


    let dueDay =
        Number(
            normalizedStartDate.slice(8, 10)
        );


    const daysInMonth =
        getDaysInMonth(
            billingYear,
            billingMonth
        );


    if (
        dueDay > daysInMonth
    ) {

        dueDay =
            daysInMonth;

    }


    return buildDate(
        billingYear,
        billingMonth,
        dueDay
    );

};


// =====================================================
// CEK KONTRAK BERLAKU PADA PERIODE
// =====================================================

const contractOverlapsBillingPeriod = (
    startDate,
    endDate,
    billingYear,
    billingMonth
) => {

    const periodStart =
        buildDate(
            billingYear,
            billingMonth,
            1
        );


    const daysInMonth =
        getDaysInMonth(
            billingYear,
            billingMonth
        );


    const periodEnd =
        buildDate(
            billingYear,
            billingMonth,
            daysInMonth
        );


    // Kontrak mulai setelah bulan billing
    if (
        startDate &&
        startDate > periodEnd
    ) {

        return false;

    }


    // Kontrak selesai sebelum bulan billing
    if (
        endDate &&
        endDate < periodStart
    ) {

        return false;

    }


    return true;

};


// =====================================================
// AUTO STATUS LATE
// =====================================================

/**
 * Mengubah unpaid menjadi late jika:
 *
 * due_date < tanggal hari ini WIB
 *
 * Tidak mengubah paid.
 */
const updateLateBills = async (
    billingMonth,
    billingYear
) => {

    const currentDate =
        getCurrentWIBDate();


    const today =
        buildDate(
            currentDate.year,
            currentDate.month,
            currentDate.day
        );


    await db.query(`
        UPDATE bills
        SET status = 'late'
        WHERE billing_month = ?
        AND billing_year = ?
        AND status = 'unpaid'
        AND due_date < ?
    `, [
        billingMonth,
        billingYear,
        today
    ]);

};


// =====================================================
// AMBIL KONTRAK AKTIF
// =====================================================

const getActiveContracts = async () => {

    const [contracts] =
        await db.query(`
            SELECT
                c.id,
                c.tenant_id,
                c.room_id,
 
                DATE_FORMAT(
                    c.start_date,
                    '%Y-%m-%d'
                ) AS start_date,
 
                DATE_FORMAT(
                    c.end_date,
                    '%Y-%m-%d'
                ) AS end_date,
 
                c.monthly_price,
                c.status AS contract_status,
 
                t.name AS tenant_name,
                t.phone AS tenant_phone,
 
                r.room_number
 
            FROM contracts AS c
 
            INNER JOIN tenants AS t
                ON c.tenant_id = t.id
 
            INNER JOIN rooms AS r
                ON c.room_id = r.id
 
            WHERE c.status = 'active'
 
            ORDER BY c.id ASC
        `);


    return contracts;

};


// =====================================================
// CREATE / REPAIR BILL
// =====================================================

const ensureBillsForPeriod = async (
    billingMonth,
    billingYear
) => {

    // =============================================
    // SAFETY CHECK
    // =============================================

    if (
        isBeforeSystemStart(
            billingYear,
            billingMonth
        )
    ) {

        return {

            billingMonth,
            billingYear,

            createdBills: [],
            skippedBills: [],
            failedBills: [],
            repairedBills: []

        };

    }


    const contracts =
        await getActiveContracts();


    const createdBills = [];
    const skippedBills = [];
    const failedBills = [];
    const repairedBills = [];


    for (
        const contract of contracts
    ) {

        try {

            // =========================================
            // VALIDASI HARGA
            // =========================================

            if (
                contract.monthly_price === null ||
                contract.monthly_price === undefined ||
                Number(contract.monthly_price) <= 0
            ) {

                failedBills.push({

                    contract_id:
                        contract.id,

                    tenant_name:
                        contract.tenant_name,

                    room_number:
                        contract.room_number,

                    reason:
                        "monthly_price tidak valid"

                });

                continue;

            }


            // =========================================
            // NORMALISASI TANGGAL KONTRAK
            // =========================================

            const startDate =
                normalizeDateOnly(
                    contract.start_date
                );


            const endDate =
                normalizeDateOnly(
                    contract.end_date
                );


            if (!startDate) {

                failedBills.push({

                    contract_id:
                        contract.id,

                    tenant_name:
                        contract.tenant_name,

                    room_number:
                        contract.room_number,

                    reason:
                        "Tanggal mulai kontrak tidak valid"

                });

                continue;

            }


            // =========================================
            // CEK KONTRAK BERLAKU
            // =========================================

            const contractIsValid =
                contractOverlapsBillingPeriod(
                    startDate,
                    endDate,
                    billingYear,
                    billingMonth
                );


            if (!contractIsValid) {

                skippedBills.push({

                    contract_id:
                        contract.id,

                    tenant_name:
                        contract.tenant_name,

                    room_number:
                        contract.room_number,

                    reason:
                        "Kontrak tidak berlaku pada periode tersebut"

                });

                continue;

            }


            // =========================================
            // HITUNG DUE DATE
            // =========================================

            const correctDueDate =
                calculateDueDate(
                    startDate,
                    billingYear,
                    billingMonth
                );


            if (!correctDueDate) {

                failedBills.push({

                    contract_id:
                        contract.id,

                    tenant_name:
                        contract.tenant_name,

                    room_number:
                        contract.room_number,

                    reason:
                        "Gagal menghitung tanggal jatuh tempo"

                });

                continue;

            }


            // =========================================
            // CEK TAGIHAN
            // =========================================

            const [existingBills] =
                await db.query(`
                    SELECT
                        b.id,
                        b.status,
 
                        DATE_FORMAT(
                            b.due_date,
                            '%Y-%m-%d'
                        ) AS due_date
 
                    FROM bills AS b
 
                    WHERE b.contract_id = ?
 
                    AND b.billing_month = ?
 
                    AND b.billing_year = ?
 
                    LIMIT 1
                `, [
                    contract.id,
                    billingMonth,
                    billingYear
                ]);


            // =========================================
            // TAGIHAN SUDAH ADA
            // =========================================

            if (
                existingBills.length > 0
            ) {

                const existingBill =
                    existingBills[0];


                const existingDueDate =
                    normalizeDateOnly(
                        existingBill.due_date
                    );


                // =====================================
                // PERBAIKI DUE DATE
                // =====================================

                if (
                    existingDueDate !==
                    correctDueDate
                ) {

                    await db.query(`
                        UPDATE bills AS b
                        SET b.due_date = ?
                        WHERE b.id = ?
                    `, [
                        correctDueDate,
                        existingBill.id
                    ]);


                    repairedBills.push({

                        bill_id:
                            existingBill.id,

                        contract_id:
                            contract.id,

                        tenant_name:
                            contract.tenant_name,

                        room_number:
                            contract.room_number,

                        old_due_date:
                            existingDueDate,

                        new_due_date:
                            correctDueDate

                    });

                }


                skippedBills.push({

                    contract_id:
                        contract.id,

                    bill_id:
                        existingBill.id,

                    tenant_name:
                        contract.tenant_name,

                    room_number:
                        contract.room_number,

                    reason:
                        "Tagihan periode tersebut sudah ada"

                });

                continue;

            }


            // =========================================
            // BUAT TAGIHAN BARU
            // =========================================

            const [result] =
                await db.query(`
                    INSERT INTO bills
                    (
                        contract_id,
                        billing_month,
                        billing_year,
                        amount,
                        due_date,
                        status
                    )
 
                    VALUES (?, ?, ?, ?, ?, 'unpaid')
                `, [
                    contract.id,
                    billingMonth,
                    billingYear,
                    contract.monthly_price,
                    correctDueDate
                ]);


            createdBills.push({

                id:
                    result.insertId,

                contract_id:
                    contract.id,

                tenant_name:
                    contract.tenant_name,

                room_number:
                    contract.room_number,

                billing_month:
                    billingMonth,

                billing_year:
                    billingYear,

                amount:
                    Number(
                        contract.monthly_price
                    ),

                due_date:
                    correctDueDate,

                status:
                    "unpaid"

            });


        } catch (error) {

            console.error(
                `Generate bill error - Contract ${contract.id}:`,
                error
            );


            // Kalau terjadi duplicate
            // karena request bersamaan,
            // jangan dianggap server error besar.

            if (
                error.code === "ER_DUP_ENTRY"
            ) {

                skippedBills.push({

                    contract_id:
                        contract.id,

                    tenant_name:
                        contract.tenant_name,

                    room_number:
                        contract.room_number,

                    reason:
                        "Tagihan sudah dibuat oleh proses lain"

                });

                continue;

            }


            failedBills.push({

                contract_id:
                    contract.id,

                tenant_name:
                    contract.tenant_name,

                room_number:
                    contract.room_number,

                reason:
                    error.message

            });

        }

    }


    return {

        billingMonth,
        billingYear,

        createdBills,
        skippedBills,
        failedBills,
        repairedBills

    };

};


// =====================================================
// GET ALL BILLS
// GET /api/bills
// GET /api/bills?month=8&year=2026
// =====================================================

const getBills = async (
    req,
    res
) => {

    try {

        const {
            billingMonth,
            billingYear
        } = getRequestedPeriod(req);


        // =============================================
        // VALIDASI PERIODE
        // =============================================

        const validation =
            validateBillingPeriod(
                billingMonth,
                billingYear
            );


        if (!validation.valid) {

            return res.status(400).json({

                success: false,

                code:
                    validation.code || "INVALID_PERIOD",

                message:
                    validation.message

            });

        }


        // =============================================
        // AUTO GENERATE / REPAIR
        // =============================================

        const generationResult =
            await ensureBillsForPeriod(
                billingMonth,
                billingYear
            );


        // =============================================
        // UPDATE STATUS LATE
        // =============================================

        await updateLateBills(
            billingMonth,
            billingYear
        );


        // =============================================
        // AMBIL TAGIHAN
        //
        // HANYA UNPAID + LATE
        //
        // PAID TETAP ADA DI DATABASE
        // TAPI TIDAK DITAMPILKAN DI HALAMAN AKTIF
        // =============================================

        const [rows] =
            await db.query(`
                SELECT
                    b.id,
                    b.contract_id,
 
                    c.tenant_id,
                    c.room_id,
 
                    t.name AS tenant_name,
                    t.phone AS tenant_phone,
 
                    r.room_number,
 
                    b.billing_month,
                    b.billing_year,
                    b.amount,
 
                    DATE_FORMAT(
                        b.due_date,
                        '%Y-%m-%d'
                    ) AS due_date,
 
                    b.status AS bill_status,
 
                    b.created_at,
 
                    c.status AS contract_status,
 
                    DATE_FORMAT(
                        c.start_date,
                        '%Y-%m-%d'
                    ) AS contract_start_date,
 
                    DATE_FORMAT(
                        c.end_date,
                        '%Y-%m-%d'
                    ) AS contract_end_date
 
                FROM bills AS b
 
                INNER JOIN contracts AS c
                    ON b.contract_id = c.id
 
                INNER JOIN tenants AS t
                    ON c.tenant_id = t.id
 
                INNER JOIN rooms AS r
                    ON c.room_id = r.id
 
                WHERE c.status = 'active'
 
                AND b.status IN (
                    'unpaid',
                    'late'
                )
 
                AND b.billing_month = ?
 
                AND b.billing_year = ?
 
                ORDER BY
                    b.due_date ASC,
                    b.id ASC
            `, [
                billingMonth,
                billingYear
            ]);


        // =============================================
        // RESPONSE
        // =============================================

        return res.status(200).json({

            success: true,

            period: {

                month:
                    billingMonth,

                year:
                    billingYear

            },

            system_start: {

                month:
                    SYSTEM_START_MONTH,

                year:
                    SYSTEM_START_YEAR

            },

            data:
                rows,

            summary: {

                total:
                    rows.reduce(
                        (
                            total,
                            bill
                        ) =>
                            total +
                            Number(
                                bill.amount || 0
                            ),
                        0
                    ),

                unpaid:
                    rows.filter(
                        bill =>
                            bill.bill_status === "unpaid"
                    ).length,

                late:
                    rows.filter(
                        bill =>
                            bill.bill_status === "late"
                    ).length,

                paid:
                    0

            },

            generation: {

                created:
                    generationResult
                        .createdBills
                        .length,

                skipped:
                    generationResult
                        .skippedBills
                        .length,

                repaired:
                    generationResult
                        .repairedBills
                        .length,

                failed:
                    generationResult
                        .failedBills
                        .length

            }

        });


    } catch (error) {

        console.error(
            "Get Bills Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Gagal mengambil data tagihan",

            error:
                error.message

        });

    }

};


// =====================================================
// GET BILL BY ID
// GET /api/bills/:id
// =====================================================

// =====================================================
// GET MY BILLS
// GET /api/bills/my-bills
//
// PENGHUNI
//
// Tenant ID diambil dari JWT.
// Penghuni hanya bisa melihat tagihan miliknya sendiri.
// =====================================================

const getMyBills = async (
    req,
    res
) => {

    try {

        // =============================================
        // CEK AUTHENTICATION
        // =============================================

        if (!req.user) {

            return res.status(401).json({

                success: false,

                message:
                    "User belum terautentikasi"

            });

        }


        // =============================================
        // AMBIL TENANT ID DARI JWT
        // =============================================

        const tenantId =
            req.user.tenant_id;


        // =============================================
        // VALIDASI TENANT ID
        // =============================================

        if (
            !tenantId ||
            Number.isNaN(Number(tenantId))
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "Akun penghuni tidak memiliki tenant_id yang valid"

            });

        }


        // =============================================
        // AMBIL TANGGAL BERJALAN WIB
        // =============================================

        const currentDate =
            getCurrentWIBDate();


        // =============================================
        // AUTO GENERATE TAGIHAN BULAN BERJALAN
        // =============================================

        await ensureBillsForPeriod(
            currentDate.month,
            currentDate.year
        );


        // =============================================
        // UPDATE STATUS LATE
        //
        // HANYA UNTUK PERIODE SISTEM
        //
        // Sistem mulai:
        // Agustus 2026
        // =============================================

        const today =
            buildDate(
                currentDate.year,
                currentDate.month,
                currentDate.day
            );


        await db.query(`
            UPDATE bills AS b

            INNER JOIN contracts AS c
                ON b.contract_id = c.id

            SET
                b.status = 'late'

            WHERE c.tenant_id = ?

            AND b.status = 'unpaid'

            AND b.due_date < ?

            AND (
                b.billing_year > ?
                OR (
                    b.billing_year = ?
                    AND b.billing_month >= ?
                )
            )

            AND (
                b.billing_year < ?
                OR (
                    b.billing_year = ?
                    AND b.billing_month <= ?
                )
            )
        `, [

            tenantId,

            today,

            // ==============================
            // BATAS AWAL SISTEM
            // Agustus 2026
            // ==============================

            SYSTEM_START_YEAR,

            SYSTEM_START_YEAR,

            SYSTEM_START_MONTH,

            // ==============================
            // BATAS AKHIR
            // Bulan berjalan
            // ==============================

            currentDate.year,

            currentDate.year,

            currentDate.month

        ]);


        // =============================================
        // AMBIL TAGIHAN TENANT
        //
        // HANYA:
        //
        // Agustus 2026
        // sampai bulan berjalan
        //
        // Tagihan sebelum sistem dimulai
        // TIDAK DITAMPILKAN.
        // =============================================

        const [rows] =
            await db.query(`
        SELECT

            b.id,
            b.contract_id,

            c.tenant_id,
            c.room_id,

            t.name AS tenant_name,

            r.room_number,

            b.billing_month,
            b.billing_year,
            b.amount,

            DATE_FORMAT(
                b.due_date,
                '%Y-%m-%d'
            ) AS due_date,

            b.status AS bill_status,

            b.created_at,

            c.status AS contract_status,

            DATE_FORMAT(
                c.start_date,
                '%Y-%m-%d'
            ) AS contract_start_date,

            DATE_FORMAT(
                c.end_date,
                '%Y-%m-%d'
            ) AS contract_end_date

        FROM bills AS b

        INNER JOIN contracts AS c
            ON b.contract_id = c.id

        INNER JOIN tenants AS t
            ON c.tenant_id = t.id

        INNER JOIN rooms AS r
            ON c.room_id = r.id

        WHERE c.tenant_id = ?

        AND (
            b.billing_year > ?
            OR (
                b.billing_year = ?
                AND b.billing_month >= ?
            )
        )

        AND (
            b.billing_year < ?
            OR (
                b.billing_year = ?
                AND b.billing_month <= ?
            )
        )

        ORDER BY

            b.billing_year DESC,

            b.billing_month DESC,

            b.id DESC

    `, [

                tenantId,

                SYSTEM_START_YEAR,
                SYSTEM_START_YEAR,
                SYSTEM_START_MONTH,

                currentDate.year,
                currentDate.year,
                currentDate.month

            ]);


        // =============================================
        // SUMMARY
        // =============================================

        const unpaidBills =
            rows.filter(
                bill =>
                    bill.bill_status === "unpaid"
            );


        const lateBills =
            rows.filter(
                bill =>
                    bill.bill_status === "late"
            );


        const paidBills =
            rows.filter(
                bill =>
                    bill.bill_status === "paid"
            );


        const unpaidAmount =
            unpaidBills.reduce(
                (total, bill) =>
                    total +
                    Number(
                        bill.amount || 0
                    ),
                0
            );


        const lateAmount =
            lateBills.reduce(
                (total, bill) =>
                    total +
                    Number(
                        bill.amount || 0
                    ),
                0
            );


        const paidAmount =
            paidBills.reduce(
                (total, bill) =>
                    total +
                    Number(
                        bill.amount || 0
                    ),
                0
            );


        // =============================================
        // TAGIHAN AKTIF TERBARU
        // =============================================

        const activeBills =
            rows.filter(
                bill =>
                    bill.bill_status === "unpaid" ||
                    bill.bill_status === "late"
            );


        const currentBill =
            activeBills.length > 0
                ? activeBills[0]
                : null;


        // =============================================
        // RESPONSE
        // =============================================

        return res.status(200).json({

            success: true,

            data: rows,

            summary: {

                total:
                    rows.length,

                unpaid:
                    unpaidBills.length,

                late:
                    lateBills.length,

                paid:
                    paidBills.length,

                unpaid_amount:
                    unpaidAmount,

                late_amount:
                    lateAmount,

                paid_amount:
                    paidAmount

            },

            current_bill:
                currentBill

        });


    } catch (error) {

        console.error(
            "Get My Bills Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Gagal mengambil tagihan penghuni",

            error:
                error.message

        });

    }

};
const getBillById = async (
    req,
    res
) => {

    try {

        const { id } =
            req.params;


        const [rows] =
            await db.query(`
                SELECT
                    b.id,
                    b.contract_id,
 
                    c.tenant_id,
                    c.room_id,
 
                    t.name AS tenant_name,
                    t.phone AS tenant_phone,
 
                    r.room_number,
 
                    b.billing_month,
                    b.billing_year,
                    b.amount,
 
                    DATE_FORMAT(
                        b.due_date,
                        '%Y-%m-%d'
                    ) AS due_date,
 
                    b.status AS bill_status,
 
                    b.created_at,
 
                    c.status AS contract_status,
 
                    DATE_FORMAT(
                        c.start_date,
                        '%Y-%m-%d'
                    ) AS contract_start_date,
 
                    DATE_FORMAT(
                        c.end_date,
                        '%Y-%m-%d'
                    ) AS contract_end_date
 
                FROM bills AS b
 
                INNER JOIN contracts AS c
                    ON b.contract_id = c.id
 
                INNER JOIN tenants AS t
                    ON c.tenant_id = t.id
 
                INNER JOIN rooms AS r
                    ON c.room_id = r.id
 
                WHERE b.id = ?
            `, [id]);


        if (
            rows.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Tagihan tidak ditemukan"

            });

        }


        return res.status(200).json({

            success: true,

            data:
                rows[0]

        });


    } catch (error) {

        console.error(
            "Get Bill By ID Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Gagal mengambil tagihan",

            error:
                error.message

        });

    }

};


// =====================================================
// CREATE BILL MANUAL
// POST /api/bills
// =====================================================

const createBill = async (
    req,
    res
) => {

    try {

        const {
            contract_id,
            billing_month,
            billing_year,
            amount,
            due_date,
            status
        } = req.body;


        // =============================================
        // VALIDASI INPUT
        // =============================================

        if (
            contract_id === undefined ||
            billing_month === undefined ||
            billing_year === undefined ||
            amount === undefined
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "contract_id, billing_month, billing_year, dan amount wajib diisi"

            });

        }


        // =============================================
        // KONTRAK
        // =============================================

        const [contractRows] =
            await db.query(`
                SELECT
                    c.id,
                    c.tenant_id,
                    c.room_id,
 
                    DATE_FORMAT(
                        c.start_date,
                        '%Y-%m-%d'
                    ) AS start_date,
 
                    DATE_FORMAT(
                        c.end_date,
                        '%Y-%m-%d'
                    ) AS end_date,
 
                    c.monthly_price,
 
                    c.status AS contract_status
 
                FROM contracts AS c
 
                WHERE c.id = ?
            `, [
                contract_id
            ]);


        if (
            contractRows.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Kontrak tidak ditemukan"

            });

        }


        const contract =
            contractRows[0];


        // =============================================
        // PERIODE
        // =============================================

        const newBillingMonth =
            Number(billing_month);


        const newBillingYear =
            Number(billing_year);


        const validation =
            validateBillingPeriod(
                newBillingMonth,
                newBillingYear
            );


        if (!validation.valid) {

            return res.status(400).json({

                success: false,

                code:
                    validation.code || "INVALID_PERIOD",

                message:
                    validation.message

            });

        }


        // =============================================
        // AMOUNT
        // =============================================

        if (
            amount === null ||
            amount === undefined ||
            Number(amount) <= 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "amount harus lebih besar dari 0"

            });

        }


        // =============================================
        // STATUS
        // =============================================

        const billStatus =
            status || "unpaid";


        const allowedStatus = [
            "unpaid",
            "paid",
            "late"
        ];


        if (
            !allowedStatus.includes(
                billStatus
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "status harus unpaid, paid, atau late"

            });

        }


        // =============================================
        // CEK KONTRAK BERLAKU
        // =============================================

        const startDate =
            normalizeDateOnly(
                contract.start_date
            );


        const endDate =
            normalizeDateOnly(
                contract.end_date
            );


        const contractIsValid =
            contractOverlapsBillingPeriod(
                startDate,
                endDate,
                newBillingYear,
                newBillingMonth
            );


        if (!contractIsValid) {

            return res.status(400).json({

                success: false,

                message:
                    "Kontrak tidak berlaku pada periode tagihan tersebut"

            });

        }


        // =============================================
        // CEK DUPLIKAT
        // =============================================

        const [duplicateRows] =
            await db.query(`
                SELECT
                    b.id
 
                FROM bills AS b
 
                WHERE b.contract_id = ?
 
                AND b.billing_month = ?
 
                AND b.billing_year = ?
 
                LIMIT 1
            `, [
                contract_id,
                newBillingMonth,
                newBillingYear
            ]);


        if (
            duplicateRows.length > 0
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "Tagihan untuk kontrak dan periode tersebut sudah ada"

            });

        }


        // =============================================
        // DUE DATE
        // =============================================

        const calculatedDueDate =
            calculateDueDate(
                startDate,
                newBillingYear,
                newBillingMonth
            );


        let finalDueDate;


        if (
            due_date !== undefined &&
            due_date !== null &&
            due_date !== ""
        ) {

            finalDueDate =
                normalizeDateOnly(
                    due_date
                );

        } else {

            finalDueDate =
                calculatedDueDate;

        }


        if (!finalDueDate) {

            return res.status(400).json({

                success: false,

                message:
                    "Tanggal jatuh tempo tidak valid"

            });

        }


        // =============================================
        // INSERT
        // =============================================

        const [result] =
            await db.query(`
                INSERT INTO bills
                (
                    contract_id,
                    billing_month,
                    billing_year,
                    amount,
                    due_date,
                    status
                )
 
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                contract_id,
                newBillingMonth,
                newBillingYear,
                amount,
                finalDueDate,
                billStatus
            ]);


        // =============================================
        // DATA BARU
        // =============================================

        const [rows] =
            await db.query(`
                SELECT
                    b.id,
                    b.contract_id,
 
                    c.tenant_id,
                    c.room_id,
 
                    t.name AS tenant_name,
                    t.phone AS tenant_phone,
 
                    r.room_number,
 
                    b.billing_month,
                    b.billing_year,
                    b.amount,
 
                    DATE_FORMAT(
                        b.due_date,
                        '%Y-%m-%d'
                    ) AS due_date,
 
                    b.status AS bill_status,
 
                    b.created_at,
 
                    c.status AS contract_status
 
                FROM bills AS b
 
                INNER JOIN contracts AS c
                    ON b.contract_id = c.id
 
                INNER JOIN tenants AS t
                    ON c.tenant_id = t.id
 
                INNER JOIN rooms AS r
                    ON c.room_id = r.id
 
                WHERE b.id = ?
            `, [
                result.insertId
            ]);


        return res.status(201).json({

            success: true,

            message:
                "Tagihan berhasil dibuat",

            data:
                rows[0]

        });


    } catch (error) {

        console.error(
            "Create Bill Error:",
            error
        );


        if (
            error.code === "ER_DUP_ENTRY"
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "Tagihan untuk kontrak dan periode tersebut sudah ada"

            });

        }


        return res.status(500).json({

            success: false,

            message:
                "Gagal membuat tagihan",

            error:
                error.message

        });

    }

};


// =====================================================
// GENERATE MONTHLY BILLS
// POST /api/bills/generate
// =====================================================

const generateMonthlyBills = async (
    req,
    res
) => {

    try {

        const {
            billingMonth,
            billingYear
        } = getRequestedPeriod(req);


        // =============================================
        // VALIDASI
        // =============================================

        const validation =
            validateBillingPeriod(
                billingMonth,
                billingYear
            );


        if (!validation.valid) {

            return res.status(400).json({

                success: false,

                code:
                    validation.code || "INVALID_PERIOD",

                message:
                    validation.message

            });

        }


        // =============================================
        // GENERATE
        // =============================================

        const result =
            await ensureBillsForPeriod(
                billingMonth,
                billingYear
            );


        // =============================================
        // UPDATE LATE
        // =============================================

        await updateLateBills(
            billingMonth,
            billingYear
        );


        return res.status(200).json({

            success: true,

            message:
                `Generate tagihan ${billingMonth}/${billingYear} selesai`,

            summary: {

                created:
                    result.createdBills.length,

                skipped:
                    result.skippedBills.length,

                repaired:
                    result.repairedBills.length,

                failed:
                    result.failedBills.length

            },

            created:
                result.createdBills,

            skipped:
                result.skippedBills,

            repaired:
                result.repairedBills,

            failed:
                result.failedBills

        });


    } catch (error) {

        console.error(
            "Generate Monthly Bills Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Gagal generate tagihan bulanan",

            error:
                error.message

        });

    }

};


// =====================================================
// UPDATE BILL
// PUT /api/bills/:id
// PATCH /api/bills/:id
// =====================================================

const updateBill = async (
    req,
    res
) => {

    try {

        const { id } =
            req.params;


        const {
            billing_month,
            billing_year,
            amount,
            due_date,
            status
        } = req.body;


        // =============================================
        // CEK BILL
        // =============================================

        const [existingRows] =
            await db.query(`
                SELECT
                    b.*
                FROM bills AS b
 
                WHERE b.id = ?
            `, [
                id
            ]);


        if (
            existingRows.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Tagihan tidak ditemukan"

            });

        }


        const existingBill =
            existingRows[0];


        // =============================================
        // DATA BARU / LAMA
        // =============================================

        const newBillingMonth =
            billing_month !== undefined
                ? Number(billing_month)
                : Number(
                    existingBill.billing_month
                );


        const newBillingYear =
            billing_year !== undefined
                ? Number(billing_year)
                : Number(
                    existingBill.billing_year
                );


        const newAmount =
            amount !== undefined
                ? amount
                : existingBill.amount;


        const newStatus =
            status !== undefined
                ? status
                : existingBill.status;


        // =============================================
        // VALIDASI PERIODE
        // =============================================

        const validation =
            validateBillingPeriod(
                newBillingMonth,
                newBillingYear
            );


        if (!validation.valid) {

            return res.status(400).json({

                success: false,

                code:
                    validation.code || "INVALID_PERIOD",

                message:
                    validation.message

            });

        }


        // =============================================
        // VALIDASI AMOUNT
        // =============================================

        if (
            newAmount === null ||
            newAmount === undefined ||
            Number(newAmount) <= 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "amount harus lebih besar dari 0"

            });

        }


        // =============================================
        // VALIDASI STATUS
        // =============================================

        const allowedStatus = [
            "unpaid",
            "paid",
            "late"
        ];


        if (
            !allowedStatus.includes(
                newStatus
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "status harus unpaid, paid, atau late"

            });

        }


        // =============================================
        // CEK DUPLIKAT
        // =============================================

        const [duplicateRows] =
            await db.query(`
                SELECT
                    b.id
 
                FROM bills AS b
 
                WHERE b.contract_id = ?
 
                AND b.billing_month = ?
 
                AND b.billing_year = ?
 
                AND b.id != ?
 
                LIMIT 1
            `, [
                existingBill.contract_id,
                newBillingMonth,
                newBillingYear,
                id
            ]);


        if (
            duplicateRows.length > 0
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "Tagihan untuk periode tersebut sudah ada"

            });

        }


        // =============================================
        // AMBIL KONTRAK
        // =============================================

        const [contractRows] =
            await db.query(`
                SELECT
                    DATE_FORMAT(
                        c.start_date,
                        '%Y-%m-%d'
                    ) AS start_date,
 
                    DATE_FORMAT(
                        c.end_date,
                        '%Y-%m-%d'
                    ) AS end_date
 
                FROM contracts AS c
 
                WHERE c.id = ?
            `, [
                existingBill.contract_id
            ]);


        const startDate =
            contractRows.length > 0
                ? normalizeDateOnly(
                    contractRows[0].start_date
                )
                : null;


        const endDate =
            contractRows.length > 0
                ? normalizeDateOnly(
                    contractRows[0].end_date
                )
                : null;


        // =============================================
        // CEK KONTRAK BERLAKU
        // =============================================

        const contractIsValid =
            contractOverlapsBillingPeriod(
                startDate,
                endDate,
                newBillingYear,
                newBillingMonth
            );


        if (!contractIsValid) {

            return res.status(400).json({

                success: false,

                message:
                    "Kontrak tidak berlaku pada periode tagihan tersebut"

            });

        }


        // =============================================
        // DUE DATE
        // =============================================

        let finalDueDate;


        if (
            due_date !== undefined &&
            due_date !== null &&
            due_date !== ""
        ) {

            finalDueDate =
                normalizeDateOnly(
                    due_date
                );

        } else {

            finalDueDate =
                calculateDueDate(
                    startDate,
                    newBillingYear,
                    newBillingMonth
                );

        }


        if (!finalDueDate) {

            return res.status(400).json({

                success: false,

                message:
                    "Tanggal jatuh tempo tidak valid"

            });

        }


        // =============================================
        // UPDATE
        // =============================================

        await db.query(`
            UPDATE bills AS b
 
            SET
                b.billing_month = ?,
                b.billing_year = ?,
                b.amount = ?,
                b.due_date = ?,
                b.status = ?
 
            WHERE b.id = ?
        `, [
            newBillingMonth,
            newBillingYear,
            newAmount,
            finalDueDate,
            newStatus,
            id
        ]);


        // =============================================
        // DATA TERBARU
        // =============================================

        const [rows] =
            await db.query(`
                SELECT
                    b.id,
                    b.contract_id,
 
                    c.tenant_id,
                    c.room_id,
 
                    t.name AS tenant_name,
                    t.phone AS tenant_phone,
 
                    r.room_number,
 
                    b.billing_month,
                    b.billing_year,
                    b.amount,
 
                    DATE_FORMAT(
                        b.due_date,
                        '%Y-%m-%d'
                    ) AS due_date,
 
                    b.status AS bill_status,
 
                    b.created_at,
 
                    c.status AS contract_status
 
                FROM bills AS b
 
                INNER JOIN contracts AS c
                    ON b.contract_id = c.id
 
                INNER JOIN tenants AS t
                    ON c.tenant_id = t.id
 
                INNER JOIN rooms AS r
                    ON c.room_id = r.id
 
                WHERE b.id = ?
            `, [
                id
            ]);


        return res.status(200).json({

            success: true,

            message:
                "Tagihan berhasil diperbarui",

            data:
                rows[0]

        });


    } catch (error) {

        console.error(
            "Update Bill Error:",
            error
        );


        if (
            error.code === "ER_DUP_ENTRY"
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "Tagihan untuk periode tersebut sudah ada"

            });

        }


        return res.status(500).json({

            success: false,

            message:
                "Gagal memperbarui tagihan",

            error:
                error.message

        });

    }

};


// =====================================================
// DELETE BILL
// DELETE /api/bills/:id
// =====================================================

const deleteBill = async (
    req,
    res
) => {

    try {

        const { id } =
            req.params;


        // =============================================
        // CEK BILL
        // =============================================

        const [existingRows] =
            await db.query(`
                SELECT
                    b.id
 
                FROM bills AS b
 
                WHERE b.id = ?
            `, [
                id
            ]);


        if (
            existingRows.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Tagihan tidak ditemukan"

            });

        }


        // =============================================
        // DELETE
        // =============================================

        await db.query(`
            DELETE FROM bills
            WHERE id = ?
        `, [
            id
        ]);


        return res.status(200).json({

            success: true,

            message:
                "Tagihan berhasil dihapus"

        });


    } catch (error) {

        console.error(
            "Delete Bill Error:",
            error
        );


        if (
            error.code === "ER_ROW_IS_REFERENCED_2" ||
            error.code === "ER_ROW_IS_REFERENCED"
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Tagihan tidak dapat dihapus karena sudah memiliki pembayaran"

            });

        }


        return res.status(500).json({

            success: false,

            message:
                "Gagal menghapus tagihan",

            error:
                error.message

        });

    }

};


// =====================================================
// AUTO GENERATE TAGIHAN BULANAN
// =====================================================
//
// Setiap hari pukul 00:01 WIB, sistem memastikan tagihan
// untuk bulan berjalan sudah tersedia untuk semua kontrak aktif.
//
// Aman terhadap duplikasi karena ensureBillsForPeriod()
// selalu mengecek tagihan berdasarkan contract_id + periode.
//
// =====================================================

try {

    const cron = require("node-cron");

    cron.schedule(
        "1 0 * * *",
        async () => {

            try {

                const currentDate =
                    getCurrentWIBDate();

                console.log(
                    `[BILL SCHEDULER] Generate tagihan ${currentDate.month}/${currentDate.year}...`
                );

                const result =
                    await ensureBillsForPeriod(
                        currentDate.month,
                        currentDate.year
                    );

                await updateLateBills(
                    currentDate.month,
                    currentDate.year
                );

                console.log(
                    `[BILL SCHEDULER] Selesai. ` +
                    `Created: ${result.createdBills.length}, ` +
                    `Skipped: ${result.skippedBills.length}, ` +
                    `Repaired: ${result.repairedBills.length}, ` +
                    `Failed: ${result.failedBills.length}`
                );

            } catch (error) {

                console.error(
                    "[BILL SCHEDULER] Error:",
                    error
                );

            }

        },
        {
            timezone: "Asia/Jakarta"
        }
    );

    console.log(
        "[BILL SCHEDULER] Aktif - setiap hari 00:01 WIB"
    );

} catch (error) {

    console.error(
        "[BILL SCHEDULER] Gagal mengaktifkan scheduler:",
        error
    );

}


// =====================================================
// EXPORT
// =====================================================

module.exports = {

    getBills,

    getBillById,

    createBill,

    generateMonthlyBills,

    updateBill,

    deleteBill,

    getMyBills

};
