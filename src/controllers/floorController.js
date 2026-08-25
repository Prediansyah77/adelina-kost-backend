const db = require("../config/database");

// =====================================================
// GET ALL FLOORS
// GET /api/floors
// =====================================================

const getFloors = async (req, res) => {
    try {

        const [floors] = await db.query(`
            SELECT
                floors.id,
                floors.building_id,
                buildings.name AS building_name,
                floors.name,
                floors.floor_number,
                floors.status,
                floors.created_at,
                floors.updated_at
            FROM floors
            INNER JOIN buildings
                ON floors.building_id = buildings.id
            ORDER BY
                floors.building_id ASC,
                floors.floor_number ASC
        `);

        res.json({
            success: true,
            data: floors
        });

    } catch (error) {

        console.error("Get Floors Error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil data lantai",
            error: error.message
        });

    }
};


// =====================================================
// GET FLOOR BY ID
// GET /api/floors/:id
// =====================================================

const getFloorById = async (req, res) => {
    try {

        const { id } = req.params;

        const [floors] = await db.query(`
            SELECT
                floors.id,
                floors.building_id,
                buildings.name AS building_name,
                floors.name,
                floors.floor_number,
                floors.status,
                floors.created_at,
                floors.updated_at
            FROM floors
            INNER JOIN buildings
                ON floors.building_id = buildings.id
            WHERE floors.id = ?
        `, [id]);

        if (floors.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Lantai tidak ditemukan"
            });

        }

        res.json({
            success: true,
            data: floors[0]
        });

    } catch (error) {

        console.error("Get Floor By ID Error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil data lantai",
            error: error.message
        });

    }
};


// =====================================================
// CREATE FLOOR
// POST /api/floors
// =====================================================

const createFloor = async (req, res) => {
    try {

        const {
            building_id,
            name,
            floor_number,
            status
        } = req.body;


        // ==============================================
        // VALIDASI
        // ==============================================

        if (!building_id) {

            return res.status(400).json({
                success: false,
                message: "Building wajib dipilih"
            });

        }

        if (!name || !name.trim()) {

            return res.status(400).json({
                success: false,
                message: "Nama lantai wajib diisi"
            });

        }

        if (
            floor_number === undefined ||
            floor_number === null ||
            floor_number === ""
        ) {

            return res.status(400).json({
                success: false,
                message: "Nomor lantai wajib diisi"
            });

        }


        // ==============================================
        // CEK BUILDING
        // ==============================================

        const [building] = await db.query(`
            SELECT id
            FROM buildings
            WHERE id = ?
        `, [building_id]);


        if (building.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Bangunan tidak ditemukan"
            });

        }


        // ==============================================
        // CEK DUPLIKAT FLOOR
        // ==============================================

        const [existingFloor] = await db.query(`
            SELECT id
            FROM floors
            WHERE building_id = ?
              AND floor_number = ?
        `, [
            building_id,
            floor_number
        ]);


        if (existingFloor.length > 0) {

            return res.status(409).json({
                success: false,
                message: "Nomor lantai tersebut sudah digunakan pada bangunan ini"
            });

        }


        // ==============================================
        // INSERT
        // ==============================================

        const [result] = await db.query(`
            INSERT INTO floors
            (
                building_id,
                name,
                floor_number,
                status
            )
            VALUES (?, ?, ?, ?)
        `, [
            building_id,
            name.trim(),
            floor_number,
            status || "AKTIF"
        ]);


        // ==============================================
        // AMBIL DATA HASIL INSERT
        // ==============================================

        const [floor] = await db.query(`
            SELECT
                floors.id,
                floors.building_id,
                buildings.name AS building_name,
                floors.name,
                floors.floor_number,
                floors.status,
                floors.created_at,
                floors.updated_at
            FROM floors
            INNER JOIN buildings
                ON floors.building_id = buildings.id
            WHERE floors.id = ?
        `, [result.insertId]);


        res.status(201).json({
            success: true,
            message: "Lantai berhasil ditambahkan",
            data: floor[0]
        });

    } catch (error) {

        console.error("Create Floor Error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal menambahkan lantai",
            error: error.message
        });

    }
};


// =====================================================
// UPDATE FLOOR
// PUT /api/floors/:id
// =====================================================

const updateFloor = async (req, res) => {
    try {

        const { id } = req.params;

        const {
            building_id,
            name,
            floor_number,
            status
        } = req.body;


        // ==============================================
        // VALIDASI
        // ==============================================

        if (!building_id) {

            return res.status(400).json({
                success: false,
                message: "Building wajib dipilih"
            });

        }

        if (!name || !name.trim()) {

            return res.status(400).json({
                success: false,
                message: "Nama lantai wajib diisi"
            });

        }

        if (
            floor_number === undefined ||
            floor_number === null ||
            floor_number === ""
        ) {

            return res.status(400).json({
                success: false,
                message: "Nomor lantai wajib diisi"
            });

        }


        // ==============================================
        // CEK FLOOR
        // ==============================================

        const [existing] = await db.query(`
            SELECT id
            FROM floors
            WHERE id = ?
        `, [id]);


        if (existing.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Lantai tidak ditemukan"
            });

        }


        // ==============================================
        // CEK BUILDING
        // ==============================================

        const [building] = await db.query(`
            SELECT id
            FROM buildings
            WHERE id = ?
        `, [building_id]);


        if (building.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Bangunan tidak ditemukan"
            });

        }


        // ==============================================
        // CEK DUPLIKAT
        // ==============================================

        const [duplicate] = await db.query(`
            SELECT id
            FROM floors
            WHERE building_id = ?
              AND floor_number = ?
              AND id != ?
        `, [
            building_id,
            floor_number,
            id
        ]);


        if (duplicate.length > 0) {

            return res.status(409).json({
                success: false,
                message: "Nomor lantai tersebut sudah digunakan pada bangunan ini"
            });

        }


        // ==============================================
        // UPDATE
        // ==============================================

        await db.query(`
            UPDATE floors
            SET
                building_id = ?,
                name = ?,
                floor_number = ?,
                status = ?
            WHERE id = ?
        `, [
            building_id,
            name.trim(),
            floor_number,
            status || "AKTIF",
            id
        ]);


        // ==============================================
        // AMBIL DATA TERBARU
        // ==============================================

        const [floor] = await db.query(`
            SELECT
                floors.id,
                floors.building_id,
                buildings.name AS building_name,
                floors.name,
                floors.floor_number,
                floors.status,
                floors.created_at,
                floors.updated_at
            FROM floors
            INNER JOIN buildings
                ON floors.building_id = buildings.id
            WHERE floors.id = ?
        `, [id]);


        res.json({
            success: true,
            message: "Lantai berhasil diperbarui",
            data: floor[0]
        });

    } catch (error) {

        console.error("Update Floor Error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal memperbarui lantai",
            error: error.message
        });

    }
};


// =====================================================
// NONAKTIFKAN FLOOR
// PATCH /api/floors/:id/nonaktifkan
// =====================================================

const deactivateFloor = async (req, res) => {
    try {

        const { id } = req.params;


        // ==============================================
        // CEK FLOOR
        // ==============================================

        const [existing] = await db.query(`
            SELECT id
            FROM floors
            WHERE id = ?
        `, [id]);


        if (existing.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Lantai tidak ditemukan"
            });

        }


        // ==============================================
        // UPDATE STATUS
        // ==============================================

        await db.query(`
            UPDATE floors
            SET status = 'NONAKTIF'
            WHERE id = ?
        `, [id]);


        // ==============================================
        // AMBIL DATA TERBARU
        // ==============================================

        const [floor] = await db.query(`
            SELECT
                floors.id,
                floors.building_id,
                buildings.name AS building_name,
                floors.name,
                floors.floor_number,
                floors.status,
                floors.created_at,
                floors.updated_at
            FROM floors
            INNER JOIN buildings
                ON floors.building_id = buildings.id
            WHERE floors.id = ?
        `, [id]);


        res.json({
            success: true,
            message: "Lantai berhasil dinonaktifkan",
            data: floor[0]
        });

    } catch (error) {

        console.error("Deactivate Floor Error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal menonaktifkan lantai",
            error: error.message
        });

    }
};


module.exports = {
    getFloors,
    getFloorById,
    createFloor,
    updateFloor,
    deactivateFloor
};