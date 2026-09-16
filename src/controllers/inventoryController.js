const db = require("../config/database");


// ============================================================
// GET ALL ROOM INVENTORIES
// ============================================================
const getRoomInventories = async (req, res) => {
    try {
        const {
            building_id,
            room_id,
            location,
            status
        } = req.query;


        // ========================================================
        // 1. AMBIL INVENTARIS FISIK KAMAR
        // ========================================================
        let query = `
            SELECT
                ri.id,
                ri.room_id,
                r.room_number,
                r.building_id,
                b.name AS building_name,

                c.id AS contract_id,
                t.id AS tenant_id,
                t.name AS tenant_name,

                ri.inventory_item_id,
                ii.name AS inventory_name,
                ii.category,

                ri.location,
                ri.quantity,
                ri.notes,
                ri.status,
                ri.created_at,
                ri.updated_at

            FROM room_inventories ri

            INNER JOIN rooms r
                ON r.id = ri.room_id

            INNER JOIN buildings b
                ON b.id = r.building_id

            INNER JOIN inventory_items ii
                ON ii.id = ri.inventory_item_id

            LEFT JOIN contracts c
                ON c.room_id = r.id
                AND c.status = 'ACTIVE'

            LEFT JOIN tenants t
                ON t.id = c.tenant_id

            WHERE 1 = 1
        `;


        const params = [];


        // ========================================================
        // FILTER BUILDING
        // ========================================================
        if (building_id) {

            query += `
                AND r.building_id = ?
            `;

            params.push(
                building_id
            );
        }


        // ========================================================
        // FILTER ROOM
        // ========================================================
        if (room_id) {

            query += `
                AND ri.room_id = ?
            `;

            params.push(
                room_id
            );
        }


        // ========================================================
        // FILTER LOCATION
        // ========================================================
        if (location) {

            query += `
                AND ri.location = ?
            `;

            params.push(
                location
            );
        }


        // ========================================================
        // FILTER STATUS
        // ========================================================
        if (status) {

            query += `
                AND ri.status = ?
            `;

            params.push(
                status
            );
        }


        // ========================================================
        // ORDER
        // ========================================================
        query += `
            ORDER BY
                b.id ASC,
                CAST(r.room_number AS UNSIGNED) ASC,
                ri.location ASC,
                ii.id ASC
        `;


        const [
            roomInventories
        ] = await db.query(
            query,
            params
        );


        // ========================================================
        // 2. AMBIL KUNCI DARI CONTRACT_INVENTORIES
        //
        // Kunci Adelina Kost 1 disimpan di sini karena
        // kunci merupakan inventaris yang diserahkan
        // kepada penghuni berdasarkan kontrak.
        // ========================================================
        let keyQuery = `
            SELECT
                ci.id,
                c.id AS contract_id,
                c.room_id,

                r.room_number,
                r.building_id,
                b.name AS building_name,

                t.id AS tenant_id,
                t.name AS tenant_name,

                ci.inventory_item_id,
                ii.name AS inventory_name,
                ii.category,

                'KAMAR' AS location,
                ci.quantity,
                ci.notes,
                ci.status,

                ci.created_at,
                ci.updated_at

            FROM contract_inventories ci

            INNER JOIN contracts c
                ON c.id = ci.contract_id

            INNER JOIN rooms r
                ON r.id = c.room_id

            INNER JOIN buildings b
                ON b.id = r.building_id

            INNER JOIN tenants t
                ON t.id = c.tenant_id

            INNER JOIN inventory_items ii
                ON ii.id = ci.inventory_item_id

            WHERE c.status = 'ACTIVE'

            AND ii.category = 'KUNCI'
        `;


        const keyParams = [];


        // ========================================================
        // FILTER BUILDING
        // ========================================================
        if (building_id) {

            keyQuery += `
                AND r.building_id = ?
            `;

            keyParams.push(
                building_id
            );
        }


        // ========================================================
        // FILTER ROOM
        // ========================================================
        if (room_id) {

            keyQuery += `
                AND c.room_id = ?
            `;

            keyParams.push(
                room_id
            );
        }


        // ========================================================
        // FILTER LOCATION
        //
        // Kunci ditampilkan sebagai bagian KAMAR
        // karena location di contract_inventories tidak
        // menggunakan enum lokasi seperti room_inventories.
        // ========================================================
        if (location) {

            keyQuery += `
                AND 'KAMAR' = ?
            `;

            keyParams.push(
                location
            );
        }


        // ========================================================
        // FILTER STATUS
        // ========================================================
        if (status) {

            keyQuery += `
                AND ci.status = ?
            `;

            keyParams.push(
                status
            );
        }


        // ========================================================
        // ORDER KUNCI
        // ========================================================
        keyQuery += `
            ORDER BY
                b.id ASC,
                CAST(r.room_number AS UNSIGNED) ASC,
                ii.id ASC
        `;


        const [
            keyInventories
        ] = await db.query(
            keyQuery,
            keyParams
        );


        // ========================================================
        // 3. GABUNGKAN INVENTARIS FISIK + KUNCI
        // ========================================================
        const data = [
            ...roomInventories,
            ...keyInventories
        ];


        // ========================================================
        // 4. SORT ULANG
        // ========================================================
        data.sort(
            (a, b) => {

                // ----------------------------------------------
                // BUILDING
                // ----------------------------------------------
                if (
                    Number(a.building_id) !==
                    Number(b.building_id)
                ) {

                    return (
                        Number(a.building_id) -
                        Number(b.building_id)
                    );
                }


                // ----------------------------------------------
                // ROOM
                // ----------------------------------------------
                const roomA =
                    Number(a.room_number);

                const roomB =
                    Number(b.room_number);


                if (
                    roomA !== roomB
                ) {

                    return (
                        roomA -
                        roomB
                    );
                }


                // ----------------------------------------------
                // LOCATION
                // ----------------------------------------------
                const locationOrder = {

                    KAMAR: 1,

                    KAMAR_MANDI: 2,

                    KUNCI: 3

                };


                // Kunci dari contract_inventories
                // location-nya memang KAMAR.
                // Karena category-nya KUNCI, kita prioritaskan
                // berdasarkan category.
                const locationA =
                    a.category === "KUNCI"
                        ? 3
                        : (
                            locationOrder[
                            a.location
                            ] || 99
                        );


                const locationB =
                    b.category === "KUNCI"
                        ? 3
                        : (
                            locationOrder[
                            b.location
                            ] || 99
                        );


                if (
                    locationA !==
                    locationB
                ) {

                    return (
                        locationA -
                        locationB
                    );
                }


                // ----------------------------------------------
                // INVENTORY ID
                // ----------------------------------------------
                return (
                    Number(
                        a.inventory_item_id
                    ) -
                    Number(
                        b.inventory_item_id
                    )
                );

            }
        );


        // ========================================================
        // RESPONSE
        // ========================================================
        return res.json({

            success: true,

            data

        });


    } catch (error) {

        console.error(
            "Get Room Inventories Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Gagal mengambil inventaris kamar",

            error:
                error.message

        });

    }
};



// ============================================================
// GET ROOM INVENTORY BY ID
// ============================================================
const getRoomInventoryById = async (
    req,
    res
) => {

    try {

        const {
            id
        } = req.params;


        // ========================================================
        // 1. CEK INVENTARIS FISIK KAMAR
        // ========================================================
        const roomQuery = `
            SELECT
                ri.id,
                ri.room_id,
                r.room_number,
                r.building_id,
                b.name AS building_name,

                c.id AS contract_id,
                t.id AS tenant_id,
                t.name AS tenant_name,

                ri.inventory_item_id,
                ii.name AS inventory_name,
                ii.category,

                ri.location,
                ri.quantity,
                ri.notes,
                ri.status,
                ri.created_at,
                ri.updated_at

            FROM room_inventories ri

            INNER JOIN rooms r
                ON r.id = ri.room_id

            INNER JOIN buildings b
                ON b.id = r.building_id

            INNER JOIN inventory_items ii
                ON ii.id = ri.inventory_item_id

            LEFT JOIN contracts c
                ON c.room_id = r.id
                AND c.status = 'ACTIVE'

            LEFT JOIN tenants t
                ON t.id = c.tenant_id

            WHERE ri.id = ?

            LIMIT 1
        `;


        const [
            roomRows
        ] = await db.query(
            roomQuery,
            [id]
        );


        if (
            roomRows.length > 0
        ) {

            return res.json({

                success: true,

                data:
                    roomRows[0]

            });

        }


        // ========================================================
        // 2. KALAU BUKAN ROOM_INVENTORIES
        // CEK CONTRACT_INVENTORIES
        // ========================================================
        const keyQuery = `
            SELECT
                ci.id,
                c.id AS contract_id,
                c.room_id,

                r.room_number,
                r.building_id,
                b.name AS building_name,

                t.id AS tenant_id,
                t.name AS tenant_name,

                ci.inventory_item_id,
                ii.name AS inventory_name,
                ii.category,

                'KAMAR' AS location,
                ci.quantity,
                ci.notes,
                ci.status,

                ci.created_at,
                ci.updated_at

            FROM contract_inventories ci

            INNER JOIN contracts c
                ON c.id = ci.contract_id

            INNER JOIN rooms r
                ON r.id = c.room_id

            INNER JOIN buildings b
                ON b.id = r.building_id

            INNER JOIN tenants t
                ON t.id = c.tenant_id

            INNER JOIN inventory_items ii
                ON ii.id = ci.inventory_item_id

            WHERE ci.id = ?

            LIMIT 1
        `;


        const [
            keyRows
        ] = await db.query(
            keyQuery,
            [id]
        );


        if (
            keyRows.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Inventaris kamar tidak ditemukan"

            });

        }


        return res.json({

            success: true,

            data:
                keyRows[0]

        });


    } catch (error) {

        console.error(
            "Get Room Inventory By ID Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Gagal mengambil detail inventaris kamar",

            error:
                error.message

        });

    }

};



// ============================================================
// CREATE ROOM INVENTORY
// ============================================================
const createRoomInventory = async (
    req,
    res
) => {

    try {

        const {
            room_id,
            inventory_item_id,
            location,
            quantity,
            notes,
            status
        } = req.body;


        // ========================================================
        // VALIDASI
        // ========================================================
        if (
            !room_id ||
            !inventory_item_id ||
            !location ||
            quantity === undefined
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Data inventaris belum lengkap"

            });

        }


        // ========================================================
        // CEK ROOM
        // ========================================================
        const [
            roomRows
        ] = await db.query(
            `
            SELECT id

            FROM rooms

            WHERE id = ?

            LIMIT 1
            `,
            [room_id]
        );


        if (
            roomRows.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Kamar tidak ditemukan"

            });

        }


        // ========================================================
        // CEK MASTER INVENTORY
        // ========================================================
        const [
            inventoryRows
        ] = await db.query(
            `
            SELECT id

            FROM inventory_items

            WHERE id = ?

            LIMIT 1
            `,
            [inventory_item_id]
        );


        if (
            inventoryRows.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Master inventaris tidak ditemukan"

            });

        }


        // ========================================================
        // CEK DUPLIKAT
        // ========================================================
        const [
            duplicateRows
        ] = await db.query(
            `
            SELECT id

            FROM room_inventories

            WHERE room_id = ?

            AND inventory_item_id = ?

            AND location = ?

            LIMIT 1
            `,
            [
                room_id,
                inventory_item_id,
                location
            ]
        );


        if (
            duplicateRows.length > 0
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "Inventaris tersebut sudah ada di kamar ini"

            });

        }


        // ========================================================
        // INSERT
        // ========================================================
        const [
            result
        ] = await db.query(
            `
            INSERT INTO room_inventories
            (
                room_id,
                inventory_item_id,
                location,
                quantity,
                notes,
                status
            )

            VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
                room_id,
                inventory_item_id,
                location,
                quantity,
                notes || null,
                status || "BAIK"
            ]
        );


        return res.status(201).json({

            success: true,

            message:
                "Inventaris kamar berhasil ditambahkan",

            data: {

                id:
                    result.insertId

            }

        });


    } catch (error) {

        console.error(
            "Create Room Inventory Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Gagal menambahkan inventaris kamar",

            error:
                error.message

        });

    }

};



// ============================================================
// UPDATE ROOM INVENTORY
// ============================================================
const updateRoomInventory = async (
    req,
    res
) => {

    try {

        const {
            id
        } = req.params;


        const {
            room_id,
            inventory_item_id,
            location,
            quantity,
            notes,
            status
        } = req.body;


        // ========================================================
        // CEK DATA
        // ========================================================
        const [
            existingRows
        ] = await db.query(
            `
            SELECT id

            FROM room_inventories

            WHERE id = ?

            LIMIT 1
            `,
            [id]
        );


        if (
            existingRows.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Inventaris kamar tidak ditemukan"

            });

        }


        // ========================================================
        // CEK DUPLIKAT
        // ========================================================
        const [
            duplicateRows
        ] = await db.query(
            `
            SELECT id

            FROM room_inventories

            WHERE room_id = ?

            AND inventory_item_id = ?

            AND location = ?

            AND id != ?

            LIMIT 1
            `,
            [
                room_id,
                inventory_item_id,
                location,
                id
            ]
        );


        if (
            duplicateRows.length > 0
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "Inventaris tersebut sudah ada di kamar ini"

            });

        }


        // ========================================================
        // UPDATE
        // ========================================================
        await db.query(
            `
            UPDATE room_inventories

            SET
                room_id = ?,
                inventory_item_id = ?,
                location = ?,
                quantity = ?,
                notes = ?,
                status = ?

            WHERE id = ?
            `,
            [
                room_id,
                inventory_item_id,
                location,
                quantity,
                notes || null,
                status || "BAIK",
                id
            ]
        );


        return res.json({

            success: true,

            message:
                "Inventaris kamar berhasil diperbarui"

        });


    } catch (error) {

        console.error(
            "Update Room Inventory Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Gagal memperbarui inventaris kamar",

            error:
                error.message

        });

    }

};



// ============================================================
// DELETE ROOM INVENTORY
// ============================================================
const deleteRoomInventory = async (
    req,
    res
) => {

    try {

        const {
            id
        } = req.params;


        // ========================================================
        // CEK DATA
        // ========================================================
        const [
            existingRows
        ] = await db.query(
            `
            SELECT id

            FROM room_inventories

            WHERE id = ?

            LIMIT 1
            `,
            [id]
        );


        if (
            existingRows.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Inventaris kamar tidak ditemukan"

            });

        }


        // ========================================================
        // DELETE
        // ========================================================
        await db.query(
            `
            DELETE FROM room_inventories

            WHERE id = ?
            `,
            [id]
        );


        return res.json({

            success: true,

            message:
                "Inventaris kamar berhasil dihapus"

        });


    } catch (error) {

        console.error(
            "Delete Room Inventory Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Gagal menghapus inventaris kamar",

            error:
                error.message

        });

    }

};



// ============================================================
// EXPORT
// ============================================================
module.exports = {

    getRoomInventories,

    getRoomInventoryById,

    createRoomInventory,

    updateRoomInventory,

    deleteRoomInventory

};