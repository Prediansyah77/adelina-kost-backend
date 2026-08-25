const db = require("../config/database");


// ============================================================
// GET ACTIVE TENANTS
// GET /api/tenants
//
// Menampilkan HANYA penghuni yang memiliki kontrak ACTIVE.
//
// Jika penghuni memiliki kontrak ACTIVE:
// - contract_id ditampilkan
// - room_id ditampilkan
// - room_number ditampilkan
// - start_date ditampilkan
// - end_date ditampilkan
// - monthly_price ditampilkan
// - contract_status = active
//
// Jika penghuni:
// - kontraknya selesai
// - kontraknya dibatalkan
// - tidak memiliki kontrak
//
// Maka penghuni TIDAK ditampilkan di halaman Penghuni.
//
// DATA TIDAK DIHAPUS DARI DATABASE.
// Data tersebut tetap bisa dilihat melalui:
// GET /api/tenants/history
// ============================================================

const getTenants = async (req, res) => {

    try {

        const [tenants] = await db.query(`
            SELECT

                t.*,

                c.id AS contract_id,

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

                c.status AS contract_status

            FROM tenants t

            INNER JOIN contracts c
                ON c.id = (
                    SELECT
                        c2.id

                    FROM contracts c2

                    WHERE
                        c2.tenant_id = t.id

                        AND c2.status = 'active'

                    ORDER BY
                        c2.id DESC

                    LIMIT 1
                )

            LEFT JOIN rooms r
                ON c.room_id = r.id

            ORDER BY
                t.id ASC
        `);


        res.json({

            success: true,

            data: tenants

        });


    } catch (error) {

        console.error(
            "Get Tenants Error:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Gagal mengambil data penghuni",

            error:
                error.message

        });

    }

};


// ============================================================
// GET ALL TENANTS
// GET /api/tenants/all
//
// Menampilkan seluruh penghuni.
//
// Termasuk:
// - penghuni aktif
// - penghuni yang sudah selesai kontrak
// - penghuni yang pernah dibatalkan
// - penghuni yang belum memiliki kontrak
//
// Endpoint ini TETAP seperti sebelumnya.
// Tidak digunakan untuk halaman Penghuni aktif.
// ============================================================

const getAllTenants = async (req, res) => {

    try {

        const [tenants] = await db.query(`
            SELECT

                t.*,

                c.id AS contract_id,

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

                c.status AS contract_status

            FROM tenants t

            LEFT JOIN contracts c
                ON c.id = (
                    SELECT
                        c2.id

                    FROM contracts c2

                    WHERE
                        c2.tenant_id = t.id

                    ORDER BY

                        CASE

                            WHEN c2.status = 'active'
                                THEN 1

                            ELSE 2

                        END,

                        c2.id DESC

                    LIMIT 1
                )

            LEFT JOIN rooms r
                ON c.room_id = r.id

            ORDER BY
                t.id ASC
        `);


        res.json({

            success: true,

            data: tenants

        });


    } catch (error) {

        console.error(
            "Get All Tenants Error:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Gagal mengambil seluruh data penghuni",

            error:
                error.message

        });

    }

};


// ============================================================
// GET TENANT HISTORY
// GET /api/tenants/history
//
// Menampilkan penghuni yang:
//
// 1. Pernah memiliki kontrak
// 2. TIDAK memiliki kontrak ACTIVE
//
// Kontrak terakhir penghuni akan ditampilkan.
//
// Jika penghuni mempunyai kontrak active,
// penghuni tersebut TIDAK masuk history.
//
// Data tenant dan kontraknya TETAP berada di database.
// ============================================================

const getTenantHistory = async (req, res) => {

    try {

        const [tenants] = await db.query(`
            SELECT

                t.id,

                t.name,

                t.phone,

                t.address,

                t.identity_number,

                t.created_at,

                latest_contract.id AS contract_id,

                latest_contract.room_id,

                latest_contract.room_number,

                latest_contract.start_date,

                latest_contract.end_date,

                latest_contract.monthly_price,

                latest_contract.contract_status

            FROM tenants t

            INNER JOIN (

                SELECT

                    c1.id,

                    c1.tenant_id,

                    c1.room_id,

                    r.room_number,

                    DATE_FORMAT(
                        c1.start_date,
                        '%Y-%m-%d'
                    ) AS start_date,

                    DATE_FORMAT(
                        c1.end_date,
                        '%Y-%m-%d'
                    ) AS end_date,

                    c1.monthly_price,

                    c1.status AS contract_status

                FROM contracts c1

                INNER JOIN rooms r
                    ON c1.room_id = r.id

                INNER JOIN (

                    SELECT

                        tenant_id,

                        MAX(id) AS latest_contract_id

                    FROM contracts

                    GROUP BY tenant_id

                ) latest

                    ON latest.latest_contract_id = c1.id

            ) latest_contract

                ON latest_contract.tenant_id = t.id

            WHERE NOT EXISTS (

                SELECT 1

                FROM contracts active_contract

                WHERE
                    active_contract.tenant_id = t.id

                    AND active_contract.status = 'active'

            )

            ORDER BY
                latest_contract.id DESC
        `);


        res.json({

            success: true,

            data: tenants

        });


    } catch (error) {

        console.error(
            "Get Tenant History Error:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Gagal mengambil riwayat penghuni",

            error:
                error.message

        });

    }

};


// ============================================================
// GET TENANT BY ID
// GET /api/tenants/:id
//
// Menampilkan:
// - data penghuni
// - kontrak aktif jika ada
// - kamar jika ada
//
// Fitur tetap dipertahankan.
// ============================================================

const getTenantById = async (req, res) => {

    try {

        const { id } = req.params;


        // ====================================================
        // VALIDASI ID
        // ====================================================

        if (
            !id ||
            Number.isNaN(Number(id))
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "ID penghuni tidak valid"

            });

        }


        const [tenants] = await db.query(`
            SELECT

                t.*,

                c.id AS contract_id,

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

                c.status AS contract_status

            FROM tenants t

            LEFT JOIN contracts c
                ON c.tenant_id = t.id
                AND c.status = 'active'

            LEFT JOIN rooms r
                ON c.room_id = r.id

            WHERE t.id = ?

            LIMIT 1
        `, [id]);


        // ====================================================
        // TENANT TIDAK DITEMUKAN
        // ====================================================

        if (
            tenants.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Penghuni tidak ditemukan"

            });

        }


        res.json({

            success: true,

            data:
                tenants[0]

        });


    } catch (error) {

        console.error(
            "Get Tenant By ID Error:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Gagal mengambil data penghuni",

            error:
                error.message

        });

    }

};


// ============================================================
// CREATE TENANT
// POST /api/tenants
//
// Penghuni dibuat terlebih dahulu.
// Kontrak dibuat melalui /api/contracts.
// ============================================================

const createTenant = async (req, res) => {

    try {

        const {
            name,
            phone,
            address,
            identity_number
        } = req.body;


        // ====================================================
        // VALIDASI NAMA
        // ====================================================

        if (
            !name ||
            !name.trim()
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Nama penghuni wajib diisi"

            });

        }


        // ====================================================
        // NORMALISASI DATA
        // ====================================================

        const tenantName =
            name.trim();

        const tenantPhone =
            phone
                ? phone.trim()
                : null;

        const tenantAddress =
            address
                ? address.trim()
                : null;

        const identityNumber =
            identity_number
                ? identity_number.trim()
                : null;


        // ====================================================
        // INSERT TENANT
        // ====================================================

        const [result] =
            await db.query(`
                INSERT INTO tenants
                (
                    name,
                    phone,
                    address,
                    identity_number
                )

                VALUES (?, ?, ?, ?)
            `, [
                tenantName,
                tenantPhone,
                tenantAddress,
                identityNumber
            ]);


        // ====================================================
        // AMBIL DATA TERBARU
        // ====================================================

        const [tenant] =
            await db.query(`
                SELECT *
                FROM tenants
                WHERE id = ?
            `, [
                result.insertId
            ]);


        res.status(201).json({

            success: true,

            message:
                "Penghuni berhasil ditambahkan",

            data:
                tenant[0]

        });


    } catch (error) {

        console.error(
            "Create Tenant Error:",
            error
        );


        // ====================================================
        // DUPLICATE IDENTITY NUMBER
        // ====================================================

        if (
            error.code ===
            "ER_DUP_ENTRY"
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "Nomor identitas sudah digunakan"

            });

        }


        res.status(500).json({

            success: false,

            message:
                "Gagal menambahkan penghuni",

            error:
                error.message

        });

    }

};


// ============================================================
// UPDATE TENANT
// PUT /api/tenants/:id
//
// Memperbarui data pribadi penghuni.
//
// Tidak mengubah kontrak.
// Tidak mengubah kamar.
// Tidak mengubah tagihan.
// ============================================================

const updateTenant = async (req, res) => {

    try {

        const { id } = req.params;


        const {
            name,
            phone,
            address,
            identity_number
        } = req.body;


        // ====================================================
        // VALIDASI ID
        // ====================================================

        if (
            !id ||
            Number.isNaN(Number(id))
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "ID penghuni tidak valid"

            });

        }


        // ====================================================
        // VALIDASI NAMA
        // ====================================================

        if (
            !name ||
            !name.trim()
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Nama penghuni wajib diisi"

            });

        }


        // ====================================================
        // CEK TENANT
        // ====================================================

        const [existingTenant] =
            await db.query(`
                SELECT
                    id,
                    name

                FROM tenants

                WHERE id = ?

                LIMIT 1
            `, [id]);


        if (
            existingTenant.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Penghuni tidak ditemukan"

            });

        }


        // ====================================================
        // NORMALISASI DATA
        // ====================================================

        const tenantName =
            name.trim();

        const tenantPhone =
            phone
                ? phone.trim()
                : null;

        const tenantAddress =
            address
                ? address.trim()
                : null;

        const identityNumber =
            identity_number
                ? identity_number.trim()
                : null;


        // ====================================================
        // UPDATE
        // ====================================================

        await db.query(`
            UPDATE tenants

            SET

                name = ?,

                phone = ?,

                address = ?,

                identity_number = ?

            WHERE id = ?
        `, [
            tenantName,
            tenantPhone,
            tenantAddress,
            identityNumber,
            id
        ]);


        // ====================================================
        // AMBIL DATA TERBARU
        // ====================================================

        const [tenant] =
            await db.query(`
                SELECT *
                FROM tenants
                WHERE id = ?
            `, [id]);


        res.json({

            success: true,

            message:
                "Data penghuni berhasil diperbarui",

            data:
                tenant[0]

        });


    } catch (error) {

        console.error(
            "Update Tenant Error:",
            error
        );


        if (
            error.code ===
            "ER_DUP_ENTRY"
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "Nomor identitas sudah digunakan"

            });

        }


        res.status(500).json({

            success: false,

            message:
                "Gagal memperbarui data penghuni",

            error:
                error.message

        });

    }

};


// ============================================================
// DELETE TENANT
// DELETE /api/tenants/:id
//
// ATURAN:
//
// 1. Tenant tidak boleh dihapus jika kontrak ACTIVE.
//
// 2. Tenant tidak boleh dihapus jika pernah mempunyai kontrak.
//
// 3. Hanya tenant yang benar-benar belum pernah digunakan
//    yang boleh dihapus.
//
// Tujuannya agar:
// - history aman
// - kontrak aman
// - tagihan aman
// - relasi database aman
// ============================================================

const deleteTenant = async (req, res) => {

    const connection =
        await db.getConnection();


    try {

        const { id } = req.params;


        // ====================================================
        // VALIDASI ID
        // ====================================================

        if (
            !id ||
            Number.isNaN(Number(id))
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "ID penghuni tidak valid"

            });

        }


        // ====================================================
        // CEK TENANT
        // ====================================================

        const [tenants] =
            await connection.query(`
                SELECT
                    id,
                    name

                FROM tenants

                WHERE id = ?

                LIMIT 1
            `, [id]);


        if (
            tenants.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Penghuni tidak ditemukan"

            });

        }


        const tenant =
            tenants[0];


        // ====================================================
        // CEK KONTRAK ACTIVE
        // ====================================================

        const [activeContracts] =
            await connection.query(`
                SELECT
                    id,
                    room_id,
                    status

                FROM contracts

                WHERE tenant_id = ?

                AND status = 'active'

                LIMIT 1
            `, [id]);


        // ====================================================
        // MASIH AKTIF
        // ====================================================

        if (
            activeContracts.length > 0
        ) {

            return res.status(409).json({

                success: false,

                message:
                    `Penghuni ${tenant.name} masih memiliki kontrak aktif. Selesaikan kontrak terlebih dahulu sebelum menghapus penghuni.`

            });

        }


        // ====================================================
        // CEK RIWAYAT KONTRAK
        // ====================================================

        const [oldContracts] =
            await connection.query(`
                SELECT
                    id,
                    status

                FROM contracts

                WHERE tenant_id = ?

                LIMIT 1
            `, [id]);


        // ====================================================
        // SUDAH PERNAH PUNYA KONTRAK
        // ====================================================

        if (
            oldContracts.length > 0
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "Penghuni sudah memiliki riwayat kontrak. Data tidak boleh dihapus agar riwayat kontrak dan tagihan tetap aman. Gunakan fitur Riwayat Penghuni."

            });

        }


        // ====================================================
        // MULAI TRANSACTION
        // ====================================================

        await connection.beginTransaction();


        // ====================================================
        // DELETE TENANT
        // ====================================================

        const [result] =
            await connection.query(`
                DELETE FROM tenants

                WHERE id = ?
            `, [id]);


        // ====================================================
        // VALIDASI HASIL DELETE
        // ====================================================

        if (
            result.affectedRows === 0
        ) {

            await connection.rollback();

            return res.status(404).json({

                success: false,

                message:
                    "Penghuni tidak ditemukan"

            });

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
                `Penghuni ${tenant.name} berhasil dihapus`

        });


    } catch (error) {

        // ====================================================
        // ROLLBACK
        // ====================================================

        try {

            await connection.rollback();

        } catch (rollbackError) {

            console.error(
                "Rollback Error:",
                rollbackError
            );

        }


        console.error(
            "Delete Tenant Error:",
            error
        );


        // ====================================================
        // FOREIGN KEY ERROR
        // ====================================================

        if (
            error.code ===
            "ER_ROW_IS_REFERENCED_2"
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "Penghuni tidak dapat dihapus karena masih digunakan oleh data lain."

            });

        }


        res.status(500).json({

            success: false,

            message:
                "Gagal menghapus penghuni",

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

    getTenants,

    getAllTenants,

    getTenantById,

    getTenantHistory,

    createTenant,

    updateTenant,

    deleteTenant

};