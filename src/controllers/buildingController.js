const db = require("../config/database");

// ============================
// GET ALL BUILDINGS
// ============================
const getBuildings = async (req, res) => {
    try {
        const [buildings] = await db.query(`
            SELECT *
            FROM buildings
            ORDER BY id ASC
        `);

        res.json({
            success: true,
            data: buildings
        });

    } catch (error) {
        console.error("Get Buildings Error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil data bangunan",
            error: error.message
        });
    }
};


// ============================
// UPDATE BUILDING
// PUT /api/buildings/:id
// ============================
const updateBuilding = async (req, res) => {
    try {

        const { id } = req.params;

        const {
            name,
            address,
            description,
            status
        } = req.body;


        // ============================
        // VALIDASI
        // ============================

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Nama bangunan wajib diisi"
            });
        }


        // ============================
        // UPDATE DATABASE
        // ============================

        const [result] = await db.query(`
            UPDATE buildings
            SET
                name = ?,
                address = ?,
                description = ?,
                status = ?
            WHERE id = ?
        `, [
            name.trim(),
            address || null,
            description || null,
            status || "AKTIF",
            id
        ]);


        // ============================
        // CEK DATA
        // ============================

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Bangunan tidak ditemukan"
            });
        }


        // ============================
        // AMBIL DATA TERBARU
        // ============================

        const [building] = await db.query(`
            SELECT *
            FROM buildings
            WHERE id = ?
        `, [id]);


        res.json({
            success: true,
            message: "Bangunan berhasil diperbarui",
            data: building[0]
        });


    } catch (error) {

        console.error("Update Building Error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal memperbarui bangunan",
            error: error.message
        });

    }
};


// ============================
// NONAKTIFKAN BUILDING
// PATCH /api/buildings/:id/nonaktifkan
// ============================
const deactivateBuilding = async (req, res) => {
    try {

        const { id } = req.params;


        // ============================
        // UPDATE STATUS
        // ============================

        const [result] = await db.query(`
            UPDATE buildings
            SET status = 'NONAKTIF'
            WHERE id = ?
        `, [id]);


        // ============================
        // CEK DATA
        // ============================

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Bangunan tidak ditemukan"
            });
        }


        // ============================
        // AMBIL DATA TERBARU
        // ============================

        const [building] = await db.query(`
            SELECT *
            FROM buildings
            WHERE id = ?
        `, [id]);


        res.json({
            success: true,
            message: "Bangunan berhasil dinonaktifkan",
            data: building[0]
        });


    } catch (error) {

        console.error("Deactivate Building Error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal menonaktifkan bangunan",
            error: error.message
        });

    }
};


// ============================
// CREATE BUILDING
// POST /api/buildings
// ============================
const createBuilding = async (req, res) => {
    try {

        const {
            name,
            address,
            description,
            status
        } = req.body;


        // ============================
        // VALIDASI
        // ============================

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Nama bangunan wajib diisi"
            });
        }


        // ============================
        // INSERT DATABASE
        // ============================

        const [result] = await db.query(`
            INSERT INTO buildings
            (
                name,
                address,
                description,
                status
            )
            VALUES (?, ?, ?, ?)
        `, [
            name.trim(),
            address || null,
            description || null,
            status || "AKTIF"
        ]);


        // ============================
        // AMBIL DATA YANG BARU DIBUAT
        // ============================

        const [building] = await db.query(`
            SELECT *
            FROM buildings
            WHERE id = ?
        `, [result.insertId]);


        res.status(201).json({
            success: true,
            message: "Bangunan berhasil ditambahkan",
            data: building[0]
        });


    } catch (error) {

        console.error("Create Building Error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal menambahkan bangunan",
            error: error.message
        });

    }
};


// ============================
// EXPORT
// ============================

module.exports = {
    getBuildings,
    createBuilding,
    updateBuilding,
    deactivateBuilding
};