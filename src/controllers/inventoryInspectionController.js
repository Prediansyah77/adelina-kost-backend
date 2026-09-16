const db = require("../config/database");


// ============================================================
// GET INSPECTIONS BY CONTRACT
// ============================================================
const getInspectionsByContract = async (req, res) => {
    try {
        const { contract_id } = req.params;

        // ========================================================
        // AMBIL HEADER INSPECTION
        // ========================================================
        const [inspections] = await db.query(
            `
            SELECT
                ii.id,
                ii.contract_id,
                ii.room_id,
                r.room_number,
                b.id AS building_id,
                b.name AS building_name,

                ii.inspection_type,
                ii.inspected_at,
                ii.inspected_by,
                ii.notes,
                ii.created_at

            FROM inventory_inspections ii

            INNER JOIN rooms r
                ON r.id = ii.room_id

            INNER JOIN buildings b
                ON b.id = r.building_id

            WHERE ii.contract_id = ?

            ORDER BY
                ii.inspected_at DESC,
                ii.id DESC
            `,
            [contract_id]
        );

        // ========================================================
        // AMBIL DETAIL SETIAP INSPECTION
        // ========================================================
        for (const inspection of inspections) {

            const [items] = await db.query(
                `
                SELECT
                    id,
                    inspection_id,
                    inventory_item_id,
                    item_name,
                    location,
                    quantity_expected,
                    quantity_actual,
                    condition_status,
                    notes,
                    created_at

                FROM inventory_inspection_items

                WHERE inspection_id = ?

                ORDER BY
                    location ASC,
                    id ASC
                `,
                [inspection.id]
            );

            inspection.items = items;
        }

        return res.json({
            success: true,
            data: inspections
        });

    } catch (error) {

        console.error(
            "Get Inspections By Contract Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Gagal mengambil data pemeriksaan inventaris",
            error: error.message
        });
    }
};


// ============================================================
// GET INSPECTION BY ID
// ============================================================
const getInspectionById = async (req, res) => {
    try {
        const { id } = req.params;

        // ========================================================
        // HEADER
        // ========================================================
        const [inspectionRows] = await db.query(
            `
            SELECT
                ii.id,
                ii.contract_id,
                ii.room_id,
                r.room_number,
                b.id AS building_id,
                b.name AS building_name,

                ii.inspection_type,
                ii.inspected_at,
                ii.inspected_by,
                ii.notes,
                ii.created_at

            FROM inventory_inspections ii

            INNER JOIN rooms r
                ON r.id = ii.room_id

            INNER JOIN buildings b
                ON b.id = r.building_id

            WHERE ii.id = ?

            LIMIT 1
            `,
            [id]
        );

        if (inspectionRows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Data pemeriksaan tidak ditemukan"
            });
        }

        const inspection = inspectionRows[0];

        // ========================================================
        // DETAIL
        // ========================================================
        const [items] = await db.query(
            `
            SELECT
                id,
                inspection_id,
                inventory_item_id,
                item_name,
                location,
                quantity_expected,
                quantity_actual,
                condition_status,
                notes,
                created_at

            FROM inventory_inspection_items

            WHERE inspection_id = ?

            ORDER BY
                location ASC,
                id ASC
            `,
            [id]
        );

        inspection.items = items;

        return res.json({
            success: true,
            data: inspection
        });

    } catch (error) {

        console.error(
            "Get Inspection By ID Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Gagal mengambil detail pemeriksaan",
            error: error.message
        });
    }
};


// ============================================================
// CREATE INSPECTION
// ============================================================
const createInspection = async (req, res) => {

    const connection = await db.getConnection();

    try {

        const {
            contract_id,
            room_id,
            inspection_type,
            inspected_by,
            notes,
            items
        } = req.body;


        // ========================================================
        // VALIDASI HEADER
        // ========================================================
        if (
            !contract_id ||
            !room_id ||
            !inspection_type
        ) {

            return res.status(400).json({
                success: false,
                message: "contract_id, room_id, dan inspection_type wajib diisi"
            });
        }


        // ========================================================
        // VALIDASI TYPE
        // ========================================================
        if (
            ![
                "CHECK_IN",
                "CHECK_OUT"
            ].includes(inspection_type)
        ) {

            return res.status(400).json({
                success: false,
                message: "inspection_type harus CHECK_IN atau CHECK_OUT"
            });
        }


        // ========================================================
        // VALIDASI ITEMS
        // ========================================================
        if (
            !Array.isArray(items) ||
            items.length === 0
        ) {

            return res.status(400).json({
                success: false,
                message: "Minimal harus ada satu item pemeriksaan"
            });
        }


        // ========================================================
        // CEK CONTRACT
        // ========================================================
        const [contractRows] = await connection.query(
            `
            SELECT
                id,
                room_id,
                tenant_id,
                status

            FROM contracts

            WHERE id = ?

            LIMIT 1
            `,
            [contract_id]
        );


        if (contractRows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Kontrak tidak ditemukan"
            });
        }


        const contract =
            contractRows[0];


        // ========================================================
        // PASTIKAN ROOM SESUAI CONTRACT
        // ========================================================
        if (
            Number(contract.room_id) !==
            Number(room_id)
        ) {

            return res.status(400).json({
                success: false,
                message: "Kamar tidak sesuai dengan kontrak"
            });
        }


        // ========================================================
        // CEK DUPLIKAT INSPECTION
        //
        // Satu kontrak boleh memiliki:
        // - satu CHECK_IN
        // - satu CHECK_OUT
        //
        // ========================================================
        const [existingInspection] =
            await connection.query(
                `
                SELECT id

                FROM inventory_inspections

                WHERE contract_id = ?
                AND inspection_type = ?

                LIMIT 1
                `,
                [
                    contract_id,
                    inspection_type
                ]
            );


        if (
            existingInspection.length > 0
        ) {

            return res.status(409).json({
                success: false,
                message:
                    `Pemeriksaan ${inspection_type} untuk kontrak ini sudah ada`
            });
        }


        // ========================================================
        // VALIDASI SETIAP ITEM
        // ========================================================
        for (const item of items) {

            if (
                !item.inventory_item_id ||
                !item.item_name ||
                !item.location
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Setiap item harus memiliki inventory_item_id, item_name, dan location"
                });
            }


            if (
                ![
                    "KAMAR",
                    "KAMAR_MANDI",
                    "KUNCI"
                ].includes(item.location)
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Location item tidak valid"
                });
            }


            const expected =
                Number(
                    item.quantity_expected ?? 0
                );


            const actual =
                Number(
                    item.quantity_actual ?? 0
                );


            if (
                expected < 0 ||
                actual < 0
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Quantity tidak boleh negatif"
                });
            }


            if (
                ![
                    "BAIK",
                    "RUSAK_RINGAN",
                    "RUSAK_BERAT",
                    "HILANG"
                ].includes(
                    item.condition_status || "BAIK"
                )
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Condition status tidak valid"
                });
            }
        }


        // ========================================================
        // START TRANSACTION
        // ========================================================
        await connection.beginTransaction();


        // ========================================================
        // INSERT HEADER
        // ========================================================
        const [inspectionResult] =
            await connection.query(
                `
                INSERT INTO inventory_inspections
                (
                    contract_id,
                    room_id,
                    inspection_type,
                    inspected_by,
                    notes
                )

                VALUES (?, ?, ?, ?, ?)
                `,
                [
                    contract_id,
                    room_id,
                    inspection_type,
                    inspected_by || null,
                    notes || null
                ]
            );


        const inspectionId =
            inspectionResult.insertId;


        // ========================================================
        // INSERT DETAIL
        // ========================================================
        for (const item of items) {

            await connection.query(
                `
                INSERT INTO inventory_inspection_items
                (
                    inspection_id,
                    inventory_item_id,
                    item_name,
                    location,
                    quantity_expected,
                    quantity_actual,
                    condition_status,
                    notes
                )

                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    inspectionId,

                    item.inventory_item_id,

                    item.item_name,

                    item.location,

                    Number(
                        item.quantity_expected ?? 0
                    ),

                    Number(
                        item.quantity_actual ?? 0
                    ),

                    item.condition_status ||
                    "BAIK",

                    item.notes || null
                ]
            );
        }


        // ========================================================
        // COMMIT
        // ========================================================
        await connection.commit();


        return res.status(201).json({
            success: true,
            message:
                `Pemeriksaan ${inspection_type} berhasil dibuat`,
            data: {
                id: inspectionId
            }
        });


    } catch (error) {

        // ========================================================
        // ROLLBACK
        // ========================================================
        await connection.rollback();


        console.error(
            "Create Inventory Inspection Error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Gagal membuat pemeriksaan inventaris",
            error: error.message
        });


    } finally {

        connection.release();

    }
};


// ============================================================
// DELETE INSPECTION
// ============================================================
const deleteInspection = async (req, res) => {

    const connection =
        await db.getConnection();

    try {

        const { id } = req.params;


        // ========================================================
        // CEK INSPECTION
        // ========================================================
        const [rows] =
            await connection.query(
                `
                SELECT id

                FROM inventory_inspections

                WHERE id = ?

                LIMIT 1
                `,
                [id]
            );


        if (rows.length === 0) {

            return res.status(404).json({
                success: false,
                message:
                    "Pemeriksaan tidak ditemukan"
            });
        }


        await connection.beginTransaction();


        // ========================================================
        // HAPUS DETAIL
        // ========================================================
        await connection.query(
            `
            DELETE FROM inventory_inspection_items

            WHERE inspection_id = ?
            `,
            [id]
        );


        // ========================================================
        // HAPUS HEADER
        // ========================================================
        await connection.query(
            `
            DELETE FROM inventory_inspections

            WHERE id = ?
            `,
            [id]
        );


        await connection.commit();


        return res.json({
            success: true,
            message:
                "Pemeriksaan berhasil dihapus"
        });


    } catch (error) {

        await connection.rollback();


        console.error(
            "Delete Inventory Inspection Error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Gagal menghapus pemeriksaan",
            error: error.message
        });


    } finally {

        connection.release();

    }

};


// ============================================================
// EXPORT
// ============================================================

module.exports = {

    getInspectionsByContract,

    getInspectionById,

    createInspection,

    deleteInspection

};