const db = require("../config/database");


// ============================================================
// HELPER
// ============================================================

/**
 * Mengambil tanggal dalam format YYYY-MM-DD
 * tanpa terkena masalah timezone.
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
            String(
                value.getUTCMonth() + 1
            ).padStart(2, "0"),
            String(
                value.getUTCDate()
            ).padStart(2, "0")
        ].join("-");
    }


    return null;
};


// ============================================================
// GET DAYS IN MONTH
// ============================================================

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


// ============================================================
// CALCULATE DUE DATE
// ============================================================

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


    if (dueDay > daysInMonth) {
        dueDay = daysInMonth;
    }


    return (
        `${billingYear}-` +
        `${String(billingMonth).padStart(2, "0")}-` +
        `${String(dueDay).padStart(2, "0")}`
    );

};


// ============================================================
// CREATE INITIAL BILL
// ============================================================

const createInitialBill = async (
    connection,
    contractId,
    startDate,
    monthlyPrice
) => {

    const normalizedStartDate =
        normalizeDateOnly(startDate);


    if (!normalizedStartDate) {

        throw new Error(
            "Tanggal mulai kontrak tidak valid"
        );

    }


    const billingYear =
        Number(
            normalizedStartDate.slice(0, 4)
        );


    const billingMonth =
        Number(
            normalizedStartDate.slice(5, 7)
        );


    const dueDate =
        calculateDueDate(
            normalizedStartDate,
            billingYear,
            billingMonth
        );


    if (!dueDate) {

        throw new Error(
            "Gagal menghitung tanggal jatuh tempo"
        );

    }


    // ========================================================
    // CEK TAGIHAN DUPLIKAT
    // ========================================================

    const [existingBills] =
        await connection.query(
            `
            SELECT
                id,
                amount,
                due_date,
                status
            FROM bills
            WHERE contract_id = ?
              AND billing_month = ?
              AND billing_year = ?
            LIMIT 1
            `,
            [
                contractId,
                billingMonth,
                billingYear
            ]
        );


    // ========================================================
    // JIKA SUDAH ADA
    // ========================================================

    if (existingBills.length > 0) {

        return {

            created: false,

            bill_id:
                existingBills[0].id,

            billing_month:
                billingMonth,

            billing_year:
                billingYear,

            due_date:
                dueDate

        };

    }


    // ========================================================
    // BUAT TAGIHAN
    // ========================================================

    const [result] =
        await connection.query(
            `
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
            `,
            [
                contractId,
                billingMonth,
                billingYear,
                monthlyPrice,
                dueDate
            ]
        );


    return {

        created: true,

        bill_id:
            result.insertId,

        billing_month:
            billingMonth,

        billing_year:
            billingYear,

        due_date:
            dueDate

    };

};


// ============================================================
// GET ACTIVE CONTRACTS
// GET /api/contracts
//
// Hanya menampilkan kontrak ACTIVE.
// ============================================================

const getContracts = async (
    req,
    res
) => {

    try {

        const [contracts] =
            await db.query(
                `
                SELECT
                    c.id,

                    c.tenant_id,
                    t.name AS tenant_name,
                    t.phone AS tenant_phone,

                    c.room_id,
                    r.room_number,

                    DATE_FORMAT(
                        c.start_date,
                        '%Y-%m-%d'
                    ) AS start_date,

                    DATE_FORMAT(
                        c.end_date,
                        '%Y-%m-%d'
                    ) AS end_date,

                    c.monthly_price,

                    c.status,

                    c.created_at

                FROM contracts c

                INNER JOIN tenants t
                    ON c.tenant_id = t.id

                INNER JOIN rooms r
                    ON c.room_id = r.id

                WHERE c.status = 'active'

                ORDER BY
                    c.id DESC
                `
            );


        res.json({

            success: true,

            data:
                contracts

        });

    } catch (error) {

        console.error(
            "Get Active Contracts Error:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Gagal mengambil data kontrak aktif",

            error:
                error.message

        });

    }

};


// ============================================================
// GET CONTRACT HISTORY
// GET /api/contracts/history
//
// Menampilkan:
// - completed
// - cancelled
// ============================================================

const getContractHistory = async (
    req,
    res
) => {

    try {

        const [contracts] =
            await db.query(
                `
                SELECT
                    c.id,

                    c.tenant_id,
                    t.name AS tenant_name,
                    t.phone AS tenant_phone,
                    t.address AS tenant_address,
                    t.identity_number,

                    c.room_id,
                    r.room_number,

                    DATE_FORMAT(
                        c.start_date,
                        '%Y-%m-%d'
                    ) AS start_date,

                    DATE_FORMAT(
                        c.end_date,
                        '%Y-%m-%d'
                    ) AS end_date,

                    c.monthly_price,

                    c.status,

                    c.created_at

                FROM contracts c

                INNER JOIN tenants t
                    ON c.tenant_id = t.id

                INNER JOIN rooms r
                    ON c.room_id = r.id

                WHERE c.status IN (
                    'completed',
                    'cancelled'
                )

                ORDER BY
                    c.id DESC
                `
            );


        res.json({

            success: true,

            data:
                contracts

        });

    } catch (error) {

        console.error(
            "Get Contract History Error:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Gagal mengambil riwayat kontrak",

            error:
                error.message

        });

    }

};


// ============================================================
// GET CONTRACT BY ID
// GET /api/contracts/:id
// ============================================================

const getContractById = async (
    req,
    res
) => {

    try {

        const { id } =
            req.params;


        const [contracts] =
            await db.query(
                `
                SELECT
                    c.id,

                    c.tenant_id,
                    t.name AS tenant_name,
                    t.phone AS tenant_phone,
                    t.address AS tenant_address,
                    t.identity_number,

                    c.room_id,
                    r.room_number,

                    DATE_FORMAT(
                        c.start_date,
                        '%Y-%m-%d'
                    ) AS start_date,

                    DATE_FORMAT(
                        c.end_date,
                        '%Y-%m-%d'
                    ) AS end_date,

                    c.monthly_price,

                    c.status,

                    c.created_at

                FROM contracts c

                INNER JOIN tenants t
                    ON c.tenant_id = t.id

                INNER JOIN rooms r
                    ON c.room_id = r.id

                WHERE c.id = ?

                LIMIT 1
                `,
                [id]
            );


        if (contracts.length === 0) {

            return res.status(404).json({

                success: false,

                message:
                    "Kontrak tidak ditemukan"

            });

        }


        res.json({

            success: true,

            data:
                contracts[0]

        });

    } catch (error) {

        console.error(
            "Get Contract By ID Error:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Gagal mengambil data kontrak",

            error:
                error.message

        });

    }

};


// ============================================================
// CREATE CONTRACT
// POST /api/contracts
// ============================================================

const createContract = async (
    req,
    res
) => {

    const connection =
        await db.getConnection();


    try {

        const {
            tenant_id,
            room_id,
            start_date,
            end_date,
            monthly_price,
            status
        } = req.body;


        // ====================================================
        // VALIDASI INPUT
        // ====================================================

        if (
            !tenant_id ||
            !room_id ||
            !start_date ||
            !monthly_price
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Tenant, kamar, tanggal mulai, dan harga bulanan wajib diisi"

            });

        }


        // ====================================================
        // NORMALISASI START DATE
        // ====================================================

        const normalizedStartDate =
            normalizeDateOnly(
                start_date
            );


        if (!normalizedStartDate) {

            return res.status(400).json({

                success: false,

                message:
                    "Tanggal mulai kontrak tidak valid"

            });

        }


        // ====================================================
        // NORMALISASI END DATE
        // ====================================================

        const normalizedEndDate =
            end_date
                ? normalizeDateOnly(end_date)
                : null;


        if (
            end_date &&
            !normalizedEndDate
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Tanggal selesai kontrak tidak valid"

            });

        }


        // ====================================================
        // VALIDASI RANGE TANGGAL
        // ====================================================

        if (
            normalizedEndDate &&
            normalizedEndDate <
            normalizedStartDate
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Tanggal selesai tidak boleh sebelum tanggal mulai"

            });

        }


        // ====================================================
        // VALIDASI HARGA
        // ====================================================

        if (
            Number(monthly_price) <= 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Harga bulanan harus lebih besar dari 0"

            });

        }


        // ====================================================
        // STATUS
        // ====================================================

        const contractStatus =
            status || "active";


        const allowedStatus = [
            "active",
            "completed",
            "cancelled"
        ];


        if (
            !allowedStatus.includes(
                contractStatus
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Status kontrak tidak valid"

            });

        }


        // ====================================================
        // COMPLETED / CANCELLED
        // WAJIB END DATE
        // ====================================================

        if (
            (
                contractStatus === "completed" ||
                contractStatus === "cancelled"
            ) &&
            !normalizedEndDate
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Tanggal selesai wajib diisi untuk kontrak selesai atau dibatalkan"

            });

        }


        // ====================================================
        // CEK TENANT
        // ====================================================

        const [tenant] =
            await connection.query(
                `
                SELECT
                    id,
                    name
                FROM tenants
                WHERE id = ?
                `,
                [tenant_id]
            );


        if (tenant.length === 0) {

            return res.status(404).json({

                success: false,

                message:
                    "Penghuni tidak ditemukan"

            });

        }


        // ====================================================
        // CEK ROOM
        // ====================================================

        const [room] =
            await connection.query(
                `
                SELECT
                    id,
                    room_number,
                    price,
                    status
                FROM rooms
                WHERE id = ?
                `,
                [room_id]
            );


        if (room.length === 0) {

            return res.status(404).json({

                success: false,

                message:
                    "Kamar tidak ditemukan"

            });

        }


        // ====================================================
        // KONTRAK ACTIVE
        // ====================================================

        if (
            contractStatus === "active"
        ) {

            // ------------------------------------------------
            // TENANT ACTIVE
            // ------------------------------------------------

            const [tenantActiveContract] =
                await connection.query(
                    `
                    SELECT
                        id
                    FROM contracts
                    WHERE tenant_id = ?
                      AND status = 'active'
                    LIMIT 1
                    `,
                    [tenant_id]
                );


            if (
                tenantActiveContract.length > 0
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Penghuni masih memiliki kontrak aktif"

                });

            }


            // ------------------------------------------------
            // ROOM ACTIVE
            // ------------------------------------------------

            const [roomActiveContract] =
                await connection.query(
                    `
                    SELECT
                        id
                    FROM contracts
                    WHERE room_id = ?
                      AND status = 'active'
                    LIMIT 1
                    `,
                    [room_id]
                );


            if (
                roomActiveContract.length > 0
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Kamar masih memiliki kontrak aktif"

                });

            }

        }


        // ====================================================
        // TRANSACTION
        // ====================================================

        await connection.beginTransaction();


        // ====================================================
        // INSERT CONTRACT
        // ====================================================

        const [result] =
            await connection.query(
                `
                INSERT INTO contracts
                (
                    tenant_id,
                    room_id,
                    start_date,
                    end_date,
                    monthly_price,
                    status
                )
                VALUES (?, ?, ?, ?, ?, ?)
                `,
                [
                    tenant_id,
                    room_id,
                    normalizedStartDate,
                    normalizedEndDate,
                    Number(monthly_price),
                    contractStatus
                ]
            );


        const contractId =
            result.insertId;


        // ====================================================
        // UPDATE ROOM
        // ====================================================

        if (
            contractStatus === "active"
        ) {

            await connection.query(
                `
                UPDATE rooms
                SET status = 'occupied'
                WHERE id = ?
                `,
                [room_id]
            );

        } else {

            await connection.query(
                `
                UPDATE rooms
                SET status = 'available'
                WHERE id = ?
                `,
                [room_id]
            );

        }


        // ====================================================
        // CREATE INITIAL BILL
        // ====================================================

        let initialBill = null;


        if (
            contractStatus === "active"
        ) {

            initialBill =
                await createInitialBill(
                    connection,
                    contractId,
                    normalizedStartDate,
                    Number(monthly_price)
                );

        }


        // ====================================================
        // COMMIT
        // ====================================================

        await connection.commit();


        // ====================================================
        // GET DATA TERBARU
        // ====================================================

        const [contract] =
            await db.query(
                `
                SELECT
                    c.id,

                    c.tenant_id,
                    t.name AS tenant_name,
                    t.phone AS tenant_phone,

                    c.room_id,
                    r.room_number,

                    DATE_FORMAT(
                        c.start_date,
                        '%Y-%m-%d'
                    ) AS start_date,

                    DATE_FORMAT(
                        c.end_date,
                        '%Y-%m-%d'
                    ) AS end_date,

                    c.monthly_price,

                    c.status,

                    c.created_at

                FROM contracts c

                INNER JOIN tenants t
                    ON c.tenant_id = t.id

                INNER JOIN rooms r
                    ON c.room_id = r.id

                WHERE c.id = ?

                LIMIT 1
                `,
                [contractId]
            );


        // ====================================================
        // RESPONSE
        // ====================================================

        res.status(201).json({

            success: true,

            message:
                contractStatus === "active"
                    ? "Kontrak berhasil dibuat dan tagihan awal otomatis dibuat"
                    : "Riwayat kontrak berhasil dibuat",

            data:
                contract[0],

            bill:
                initialBill

        });


    } catch (error) {

        try {

            await connection.rollback();

        } catch (rollbackError) {

            console.error(
                "Rollback Error:",
                rollbackError
            );

        }


        console.error(
            "Create Contract Error:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Gagal membuat kontrak",

            error:
                error.message

        });

    } finally {

        connection.release();

    }

};


// ============================================================
// UPDATE CONTRACT
// PUT /api/contracts/:id
//
// active
// completed
// cancelled
//
// Jika completed/cancelled:
// - kontrak tetap disimpan
// - tagihan tetap disimpan
// - kamar menjadi available
// - kontrak tidak lagi muncul di halaman Kontrak
// - kontrak muncul di Riwayat
// ============================================================

const updateContract = async (
    req,
    res
) => {

    const connection =
        await db.getConnection();


    try {

        const { id } =
            req.params;


        const {
            start_date,
            end_date,
            monthly_price,
            status
        } = req.body;


        // ====================================================
        // VALIDASI INPUT
        // ====================================================

        if (
            !start_date ||
            !monthly_price ||
            !status
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Tanggal mulai, harga bulanan, dan status wajib diisi"

            });

        }


        // ====================================================
        // VALIDASI STATUS
        // ====================================================

        const allowedStatus = [
            "active",
            "completed",
            "cancelled"
        ];


        if (
            !allowedStatus.includes(status)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Status kontrak tidak valid"

            });

        }


        // ====================================================
        // NORMALISASI START DATE
        // ====================================================

        const normalizedStartDate =
            normalizeDateOnly(
                start_date
            );


        if (!normalizedStartDate) {

            return res.status(400).json({

                success: false,

                message:
                    "Tanggal mulai kontrak tidak valid"

            });

        }


        // ====================================================
        // NORMALISASI END DATE
        // ====================================================

        const normalizedEndDate =
            end_date
                ? normalizeDateOnly(end_date)
                : null;


        if (
            end_date &&
            !normalizedEndDate
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Tanggal selesai kontrak tidak valid"

            });

        }


        // ====================================================
        // VALIDASI RANGE
        // ====================================================

        if (
            normalizedEndDate &&
            normalizedEndDate <
            normalizedStartDate
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Tanggal selesai tidak boleh sebelum tanggal mulai"

            });

        }


        // ====================================================
        // COMPLETED / CANCELLED
        // END DATE WAJIB
        // ====================================================

        if (
            (
                status === "completed" ||
                status === "cancelled"
            ) &&
            !normalizedEndDate
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Tanggal selesai wajib diisi untuk kontrak selesai atau dibatalkan"

            });

        }


        // ====================================================
        // VALIDASI HARGA
        // ====================================================

        if (
            Number(monthly_price) <= 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Harga bulanan harus lebih besar dari 0"

            });

        }


        // ====================================================
        // CEK CONTRACT
        // ====================================================

        const [existing] =
            await connection.query(
                `
                SELECT
                    id,
                    tenant_id,
                    room_id,
                    start_date,
                    end_date,
                    monthly_price,
                    status
                FROM contracts
                WHERE id = ?
                LIMIT 1
                `,
                [id]
            );


        if (existing.length === 0) {

            return res.status(404).json({

                success: false,

                message:
                    "Kontrak tidak ditemukan"

            });

        }


        const contract =
            existing[0];


        const roomId =
            contract.room_id;


        const tenantId =
            contract.tenant_id;


        // ====================================================
        // JIKA DI-ACTIVE-KAN
        // ====================================================

        if (
            status === "active"
        ) {

            // ------------------------------------------------
            // CEK TENANT ACTIVE LAIN
            // ------------------------------------------------

            const [tenantActive] =
                await connection.query(
                    `
                    SELECT
                        id
                    FROM contracts
                    WHERE tenant_id = ?
                      AND status = 'active'
                      AND id != ?
                    LIMIT 1
                    `,
                    [
                        tenantId,
                        id
                    ]
                );


            if (
                tenantActive.length > 0
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Penghuni sudah memiliki kontrak aktif lain"

                });

            }


            // ------------------------------------------------
            // CEK ROOM ACTIVE LAIN
            // ------------------------------------------------

            const [roomActive] =
                await connection.query(
                    `
                    SELECT
                        id
                    FROM contracts
                    WHERE room_id = ?
                      AND status = 'active'
                      AND id != ?
                    LIMIT 1
                    `,
                    [
                        roomId,
                        id
                    ]
                );


            if (
                roomActive.length > 0
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Kamar sudah memiliki kontrak aktif lain"

                });

            }

        }


        // ====================================================
        // START TRANSACTION
        // ====================================================

        await connection.beginTransaction();


        // ====================================================
        // UPDATE CONTRACT
        // ====================================================

        await connection.query(
            `
            UPDATE contracts
            SET
                start_date = ?,
                end_date = ?,
                monthly_price = ?,
                status = ?
            WHERE id = ?
            `,
            [
                normalizedStartDate,
                normalizedEndDate,
                Number(monthly_price),
                status,
                id
            ]
        );


        // ====================================================
        // UPDATE ROOM STATUS
        // ====================================================

        if (
            status === "active"
        ) {

            await connection.query(
                `
                UPDATE rooms
                SET status = 'occupied'
                WHERE id = ?
                `,
                [roomId]
            );

        } else {

            await connection.query(
                `
                UPDATE rooms
                SET status = 'available'
                WHERE id = ?
                `,
                [roomId]
            );

        }


        // ====================================================
        // PASTIKAN TAGIHAN AWAL ADA
        // HANYA UNTUK ACTIVE
        // ====================================================

        let initialBill = null;


        if (
            status === "active"
        ) {

            initialBill =
                await createInitialBill(
                    connection,
                    id,
                    normalizedStartDate,
                    Number(monthly_price)
                );

        }


        // ====================================================
        // COMMIT
        // ====================================================

        await connection.commit();


        // ====================================================
        // GET UPDATED CONTRACT
        // ====================================================

        const [updatedContract] =
            await db.query(
                `
                SELECT
                    c.id,

                    c.tenant_id,
                    t.name AS tenant_name,
                    t.phone AS tenant_phone,

                    c.room_id,
                    r.room_number,

                    DATE_FORMAT(
                        c.start_date,
                        '%Y-%m-%d'
                    ) AS start_date,

                    DATE_FORMAT(
                        c.end_date,
                        '%Y-%m-%d'
                    ) AS end_date,

                    c.monthly_price,

                    c.status,

                    c.created_at

                FROM contracts c

                INNER JOIN tenants t
                    ON c.tenant_id = t.id

                INNER JOIN rooms r
                    ON c.room_id = r.id

                WHERE c.id = ?

                LIMIT 1
                `,
                [id]
            );


        // ====================================================
        // MESSAGE
        // ====================================================

        let message =
            "Kontrak berhasil diperbarui";


        if (
            status === "completed"
        ) {

            message =
                "Kontrak berhasil diselesaikan. Penghuni dipindahkan ke riwayat dan kamar sekarang tersedia.";

        } else if (
            status === "cancelled"
        ) {

            message =
                "Kontrak berhasil dibatalkan. Penghuni dipindahkan ke riwayat dan kamar sekarang tersedia.";

        } else if (
            status === "active"
        ) {

            message =
                "Kontrak berhasil diaktifkan dan kamar sekarang terisi.";

        }


        // ====================================================
        // RESPONSE
        // ====================================================

        res.json({

            success: true,

            message,

            data:
                updatedContract[0],

            bill:
                initialBill

        });


    } catch (error) {

        try {

            await connection.rollback();

        } catch (rollbackError) {

            console.error(
                "Rollback Error:",
                rollbackError
            );

        }


        console.error(
            "Update Contract Error:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Gagal memperbarui kontrak",

            error:
                error.message

        });

    } finally {

        connection.release();

    }

};


// ============================================================
// PROCESS MOVE OUT
// POST /api/contracts/:id/move-out
//
// Proses penghuni keluar:
//
// 1. Kontrak active -> completed
// 2. End date -> tanggal keluar
// 3. Tenant aktif -> nonaktif
// 4. Kamar -> available
//
// Kontrak TIDAK dihapus.
// Kontrak tetap masuk ke riwayat.
//
// Catatan:
// - moveOutReason
// - roomCondition
// - deposit
//
// belum disimpan di sini karena tabel contracts/tenants
// yang ada sekarang belum memiliki kolom khusus untuk data tersebut.
// ============================================================

const processMoveOut = async (
    req,
    res
) => {

    const connection =
        await db.getConnection();


    try {

        const { id } =
            req.params;


        const {
            moveOutDate
        } = req.body;


        // ====================================================
        // VALIDASI ID
        // ====================================================

        if (!id) {

            return res.status(400).json({

                success: false,

                message:
                    "ID kontrak wajib diisi"

            });

        }


        // ====================================================
        // VALIDASI TANGGAL KELUAR
        // ====================================================

        const normalizedMoveOutDate =
            normalizeDateOnly(
                moveOutDate
            );


        if (!normalizedMoveOutDate) {

            return res.status(400).json({

                success: false,

                message:
                    "Tanggal keluar wajib diisi dan harus valid"

            });

        }


        // ====================================================
        // START TRANSACTION
        // ====================================================

        await connection.beginTransaction();


        // ====================================================
        // LOCK CONTRACT
        // ====================================================

        const [contractRows] =
            await connection.query(
                `
                SELECT
                    c.id,
                    c.tenant_id,
                    c.room_id,
                    c.start_date,
                    c.end_date,
                    c.monthly_price,
                    c.status,

                    t.name AS tenant_name,
                    t.status AS tenant_status,

                    r.room_number,
                    r.status AS room_status

                FROM contracts c

                INNER JOIN tenants t
                    ON t.id = c.tenant_id

                INNER JOIN rooms r
                    ON r.id = c.room_id

                WHERE c.id = ?

                LIMIT 1

                FOR UPDATE
                `,
                [id]
            );


        // ====================================================
        // CONTRACT TIDAK DITEMUKAN
        // ====================================================

        if (
            contractRows.length === 0
        ) {

            await connection.rollback();

            return res.status(404).json({

                success: false,

                message:
                    "Kontrak tidak ditemukan"

            });

        }


        const contract =
            contractRows[0];


        // ====================================================
        // KONTRAK HARUS ACTIVE
        // ====================================================

        if (
            contract.status !== "active"
        ) {

            await connection.rollback();

            return res.status(409).json({

                success: false,

                message:
                    "Kontrak ini sudah tidak aktif"

            });

        }


        // ====================================================
        // VALIDASI TANGGAL KELUAR
        // TIDAK BOLEH SEBELUM TANGGAL MULAI
        // ====================================================

        const normalizedStartDate =
            normalizeDateOnly(
                contract.start_date
            );


        if (
            normalizedStartDate &&
            normalizedMoveOutDate <
            normalizedStartDate
        ) {

            await connection.rollback();

            return res.status(400).json({

                success: false,

                message:
                    "Tanggal keluar tidak boleh sebelum tanggal mulai kontrak"

            });

        }


        // ====================================================
        // UPDATE CONTRACT
        // ====================================================

        await connection.query(
            `
            UPDATE contracts
            SET
                end_date = ?,
                status = 'completed'
            WHERE id = ?
              AND status = 'active'
            `,
            [
                normalizedMoveOutDate,
                id
            ]
        );


        // ====================================================
        // UPDATE TENANT
        // ====================================================

        await connection.query(
            `
            UPDATE tenants
            SET
                status = 'nonaktif'
            WHERE id = ?
              AND status = 'aktif'
            `,
            [
                contract.tenant_id
            ]
        );


        // ====================================================
        // UPDATE ROOM
        // ====================================================

        await connection.query(
            `
            UPDATE rooms
            SET
                status = 'available'
            WHERE id = ?
            `,
            [
                contract.room_id
            ]
        );


        // ====================================================
        // COMMIT
        // ====================================================

        await connection.commit();


        // ====================================================
        // RESPONSE
        // ====================================================

        res.status(200).json({

            success: true,

            message:
                "Penghuni berhasil diproses keluar. Kontrak diselesaikan, status penghuni menjadi nonaktif, dan kamar sekarang tersedia.",

            data: {

                contract_id:
                    contract.id,

                tenant_id:
                    contract.tenant_id,

                tenant_name:
                    contract.tenant_name,

                room_id:
                    contract.room_id,

                room_number:
                    contract.room_number,

                move_out_date:
                    normalizedMoveOutDate,

                contract_status:
                    "completed",

                tenant_status:
                    "nonaktif",

                room_status:
                    "available"

            }

        });


    } catch (error) {

        try {

            await connection.rollback();

        } catch (rollbackError) {

            console.error(
                "Rollback Error:",
                rollbackError
            );

        }


        console.error(
            "Process Move Out Error:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Gagal memproses penghuni keluar",

            error:
                error.message

        });

    } finally {

        connection.release();

    }

};


// ============================================================
// DELETE CONTRACT
// DELETE /api/contracts/:id
//
// Kontrak yang sudah mempunyai tagihan
// TIDAK BOLEH dihapus.
//
// Gunakan completed/cancelled.
// ============================================================

const deleteContract = async (
    req,
    res
) => {

    const connection =
        await db.getConnection();


    try {

        const { id } =
            req.params;


        // ====================================================
        // CEK CONTRACT
        // ====================================================

        const [existing] =
            await connection.query(
                `
                SELECT
                    id,
                    room_id,
                    status
                FROM contracts
                WHERE id = ?
                LIMIT 1
                `,
                [id]
            );


        if (existing.length === 0) {

            return res.status(404).json({

                success: false,

                message:
                    "Kontrak tidak ditemukan"

            });

        }


        const roomId =
            existing[0].room_id;


        const contractStatus =
            existing[0].status;


        // ====================================================
        // CEK TAGIHAN
        // ====================================================

        const [bills] =
            await connection.query(
                `
                SELECT
                    id
                FROM bills
                WHERE contract_id = ?
                LIMIT 1
                `,
                [id]
            );


        // ====================================================
        // TIDAK BOLEH HAPUS JIKA SUDAH ADA TAGIHAN
        // ====================================================

        if (
            bills.length > 0
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "Kontrak tidak dapat dihapus karena sudah memiliki tagihan. Gunakan fitur Selesaikan Kontrak agar riwayat tetap tersimpan."

            });

        }


        // ====================================================
        // TRANSACTION
        // ====================================================

        await connection.beginTransaction();


        // ====================================================
        // DELETE CONTRACT
        // ====================================================

        await connection.query(
            `
            DELETE FROM contracts
            WHERE id = ?
            `,
            [id]
        );


        // ====================================================
        // CEK KONTRAK ACTIVE LAIN
        // ====================================================

        const [remainingActiveContract] =
            await connection.query(
                `
                SELECT
                    id
                FROM contracts
                WHERE room_id = ?
                  AND status = 'active'
                LIMIT 1
                `,
                [roomId]
            );


        // ====================================================
        // UPDATE ROOM
        // ====================================================

        if (
            remainingActiveContract.length > 0
        ) {

            await connection.query(
                `
                UPDATE rooms
                SET status = 'occupied'
                WHERE id = ?
                `,
                [roomId]
            );

        } else {

            await connection.query(
                `
                UPDATE rooms
                SET status = 'available'
                WHERE id = ?
                `,
                [roomId]
            );

        }


        // ====================================================
        // COMMIT
        // ====================================================

        await connection.commit();


        // ====================================================
        // RESPONSE
        // ====================================================

        res.json({

            success: true,

            message:
                contractStatus === "active"
                    ? "Kontrak berhasil dihapus dan kamar sekarang tersedia"
                    : "Kontrak berhasil dihapus"

        });


    } catch (error) {

        try {

            await connection.rollback();

        } catch (rollbackError) {

            console.error(
                "Rollback Error:",
                rollbackError
            );

        }


        console.error(
            "Delete Contract Error:",
            error
        );


        if (
            error.code ===
            "ER_ROW_IS_REFERENCED_2"
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "Kontrak tidak dapat dihapus karena masih digunakan oleh data lain."

            });

        }


        res.status(500).json({

            success: false,

            message:
                "Gagal menghapus kontrak",

            error:
                error.message

        });

    } finally {

        connection.release();

    }

};


// ============================================================
// EXPORT
// ============================================================

module.exports = {

    getContracts,

    getContractHistory,

    getContractById,

    createContract,

    updateContract,

    processMoveOut,

    deleteContract,

    createInitialBill

};