const db = require("../config/database");

// =====================================================
// HELPER
// =====================================================

// -----------------------------------------------------
// Ambil status kamar berdasarkan kondisi sebenarnya
//
// PRIORITAS:
// 1. Ada kontrak aktif  -> occupied
// 2. Tidak ada kontrak  -> mengikuti room.status
//    - inactive         -> inactive
//    - selain itu       -> available
//
// Jadi rooms.status yang nyangkut "occupied" tidak akan
// membuat kamar tampil terisi kalau kontraknya sudah tidak aktif.
// -----------------------------------------------------
const calculateRoomStatus = (room) => {
    const roomStatus = String(
        room.room_status || room.status || ""
    ).toLowerCase();

    const hasActiveContract =
        Number(room.active_contract_id || 0) > 0;

    // Kalau ada kontrak aktif, kamar pasti terisi
    if (hasActiveContract) {
        return "occupied";
    }

    // Kalau tidak ada kontrak aktif dan kamar nonaktif
    if (roomStatus === "inactive") {
        return "inactive";
    }

    // Selain itu kamar tersedia
    return "available";
};


// -----------------------------------------------------
// Format satu room hasil database
// -----------------------------------------------------
const formatRoom = (room) => {

    const calculatedStatus =
        calculateRoomStatus(room);

    return {
        ...room,

        // Status yang dipakai frontend
        status: calculatedStatus,

        // Simpan status asli database untuk debugging
        room_status: room.room_status || null,

        // Informasi sumber status
        status_source:
            calculatedStatus === "occupied"
                ? "active_contract"
                : "room"
    };
};


// -----------------------------------------------------
// Query dasar room
// -----------------------------------------------------
const ROOM_SELECT = `
    SELECT
        r.*,

        r.status AS room_status,

        f.name AS floor_name,
        b.name AS building_name,

        c.id AS active_contract_id,
        c.tenant_id AS tenant_id,

        t.name AS tenant_name,
        t.phone AS tenant_phone

    FROM rooms r

    LEFT JOIN floors f
        ON r.floor_id = f.id

    LEFT JOIN buildings b
        ON r.building_id = b.id

    LEFT JOIN contracts c
        ON c.room_id = r.id
        AND c.status = 'active'

    LEFT JOIN tenants t
        ON c.tenant_id = t.id
`;


// =====================================================
// GET ALL ROOMS
// GET /api/rooms
// =====================================================
const getRooms = async (req, res) => {

    try {

        const [rooms] = await db.query(`
            ${ROOM_SELECT}
            ORDER BY r.id ASC
        `);

        // -------------------------------------------------
        // Hitung status sebenarnya berdasarkan kontrak
        // -------------------------------------------------

        const formattedRooms =
            rooms.map(formatRoom);

        res.json({
            success: true,
            data: formattedRooms
        });

    } catch (error) {

        console.error(
            "Get Rooms Error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Gagal mengambil data kamar",
            error: error.message
        });
    }
};


// =====================================================
// GET ROOM BY ID
// GET /api/rooms/:id
// =====================================================
const getRoomById = async (req, res) => {

    try {

        const { id } = req.params;

        const [rooms] = await db.query(`
            ${ROOM_SELECT}
            WHERE r.id = ?
            LIMIT 1
        `, [id]);

        // -------------------------------------------------
        // CEK ROOM
        // -------------------------------------------------

        if (rooms.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Kamar tidak ditemukan"
            });
        }

        const room =
            formatRoom(rooms[0]);

        res.json({
            success: true,
            data: room
        });

    } catch (error) {

        console.error(
            "Get Room By ID Error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Gagal mengambil data kamar",
            error: error.message
        });
    }
};


// =====================================================
// CREATE ROOM
// POST /api/rooms
// =====================================================
const createRoom = async (req, res) => {

    try {

        const {
            room_number,
            building_id,
            floor_id,
            price,
            status,
            notes
        } = req.body;


        // =================================================
        // VALIDASI NOMOR KAMAR
        // =================================================

        if (
            !room_number ||
            !String(room_number).trim()
        ) {

            return res.status(400).json({
                success: false,
                message: "Nomor kamar wajib diisi"
            });
        }


        // =================================================
        // VALIDASI BUILDING
        // =================================================

        if (!building_id) {

            return res.status(400).json({
                success: false,
                message: "Building ID wajib diisi"
            });
        }


        // =================================================
        // VALIDASI HARGA
        // =================================================

        if (
            price === undefined ||
            price === null ||
            Number(price) <= 0
        ) {

            return res.status(400).json({
                success: false,
                message: "Harga kamar wajib diisi"
            });
        }


        // =================================================
        // STATUS ROOM
        // =================================================

        const roomStatus =
            String(status || "available")
                .toLowerCase();


        const allowedStatus = [
            "available",
            "occupied",
            "inactive"
        ];


        if (
            !allowedStatus.includes(
                roomStatus
            )
        ) {

            return res.status(400).json({
                success: false,
                message: "Status kamar tidak valid"
            });
        }


        // =================================================
        // ROOM BARU TIDAK BOLEH LANGSUNG OCCUPIED
        // =================================================

        if (
            roomStatus === "occupied"
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Kamar tidak dapat langsung dibuat dengan status terisi. Buat kontrak aktif untuk mengisi kamar."
            });
        }


        // =================================================
        // CEK BUILDING
        // =================================================

        const [building] =
            await db.query(`
                SELECT
                    id
                FROM buildings
                WHERE id = ?
                LIMIT 1
            `, [
                building_id
            ]);


        if (
            building.length === 0
        ) {

            return res.status(404).json({
                success: false,
                message:
                    "Bangunan tidak ditemukan"
            });
        }


        // =================================================
        // CEK FLOOR
        // =================================================

        if (floor_id) {

            const [floor] =
                await db.query(`
                    SELECT
                        id
                    FROM floors
                    WHERE id = ?
                    AND building_id = ?
                    LIMIT 1
                `, [
                    floor_id,
                    building_id
                ]);


            if (
                floor.length === 0
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Lantai tidak sesuai dengan bangunan"
                });
            }
        }


        // =================================================
        // CEK DUPLIKAT NOMOR KAMAR
        // =================================================

        const [duplicate] =
            await db.query(`
                SELECT
                    id
                FROM rooms
                WHERE building_id = ?
                AND room_number = ?
                LIMIT 1
            `, [
                building_id,
                String(room_number).trim()
            ]);


        if (
            duplicate.length > 0
        ) {

            return res.status(409).json({
                success: false,
                message:
                    "Nomor kamar sudah digunakan pada bangunan ini"
            });
        }


        // =================================================
        // INSERT ROOM
        // =================================================

        const [result] =
            await db.query(`
                INSERT INTO rooms
                (
                    room_number,
                    building_id,
                    floor_id,
                    price,
                    status,
                    notes
                )
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                String(room_number).trim(),
                building_id,
                floor_id || null,
                Number(price),
                roomStatus,
                notes
                    ? String(notes).trim()
                    : null
            ]);


        // =================================================
        // AMBIL DATA ROOM BARU
        // =================================================

        const [rooms] =
            await db.query(`
                ${ROOM_SELECT}
                WHERE r.id = ?
                LIMIT 1
            `, [
                result.insertId
            ]);


        const room =
            formatRoom(rooms[0]);


        // =================================================
        // RESPONSE
        // =================================================

        res.status(201).json({
            success: true,
            message:
                "Kamar berhasil ditambahkan",
            data: room
        });

    } catch (error) {

        console.error(
            "Create Room Error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Gagal menambahkan kamar",
            error: error.message
        });
    }
};


// =====================================================
// UPDATE ROOM
// PUT /api/rooms/:id
// =====================================================
const updateRoom = async (req, res) => {

    try {

        const { id } = req.params;

        const {
            room_number,
            building_id,
            floor_id,
            price,
            status,
            notes
        } = req.body;


        // =================================================
        // CEK ROOM
        // =================================================

        const [existing] =
            await db.query(`
                SELECT
                    id,
                    room_number,
                    building_id,
                    floor_id,
                    price,
                    status,
                    notes
                FROM rooms
                WHERE id = ?
                LIMIT 1
            `, [
                id
            ]);


        if (
            existing.length === 0
        ) {

            return res.status(404).json({
                success: false,
                message:
                    "Kamar tidak ditemukan"
            });
        }


        // =================================================
        // VALIDASI NOMOR KAMAR
        // =================================================

        if (
            !room_number ||
            !String(room_number).trim()
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Nomor kamar wajib diisi"
            });
        }


        // =================================================
        // VALIDASI BUILDING
        // =================================================

        if (!building_id) {

            return res.status(400).json({
                success: false,
                message:
                    "Building ID wajib diisi"
            });
        }


        // =================================================
        // VALIDASI HARGA
        // =================================================

        if (
            price === undefined ||
            price === null ||
            Number(price) <= 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Harga kamar wajib diisi"
            });
        }


        // =================================================
        // VALIDASI STATUS
        // =================================================

        const roomStatus =
            String(status || "")
                .toLowerCase();


        const allowedStatus = [
            "available",
            "occupied",
            "inactive"
        ];


        if (
            !allowedStatus.includes(
                roomStatus
            )
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Status kamar tidak valid"
            });
        }


        // =================================================
        // CEK BUILDING
        // =================================================

        const [building] =
            await db.query(`
                SELECT
                    id
                FROM buildings
                WHERE id = ?
                LIMIT 1
            `, [
                building_id
            ]);


        if (
            building.length === 0
        ) {

            return res.status(404).json({
                success: false,
                message:
                    "Bangunan tidak ditemukan"
            });
        }


        // =================================================
        // CEK FLOOR
        // =================================================

        if (floor_id) {

            const [floor] =
                await db.query(`
                    SELECT
                        id
                    FROM floors
                    WHERE id = ?
                    AND building_id = ?
                    LIMIT 1
                `, [
                    floor_id,
                    building_id
                ]);


            if (
                floor.length === 0
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Lantai tidak sesuai dengan bangunan"
                });
            }
        }


        // =================================================
        // CEK DUPLIKAT NOMOR KAMAR
        // =================================================

        const [duplicate] =
            await db.query(`
                SELECT
                    id
                FROM rooms
                WHERE building_id = ?
                AND room_number = ?
                AND id != ?
                LIMIT 1
            `, [
                building_id,
                String(room_number).trim(),
                id
            ]);


        if (
            duplicate.length > 0
        ) {

            return res.status(409).json({
                success: false,
                message:
                    "Nomor kamar sudah digunakan pada bangunan ini"
            });
        }


        // =================================================
        // CEK KONTRAK AKTIF
        // =================================================

        const [activeContracts] =
            await db.query(`
                SELECT
                    id,
                    tenant_id,
                    status
                FROM contracts
                WHERE room_id = ?
                AND status = 'active'
                LIMIT 1
            `, [
                id
            ]);


        const hasActiveContract =
            activeContracts.length > 0;


        // =================================================
        // ADA KONTRAK AKTIF
        // =================================================

        if (hasActiveContract) {

            // -------------------------------------------------
            // Tidak boleh mengubah kamar aktif menjadi
            // available / inactive secara manual.
            //
            // Kontrak harus diselesaikan terlebih dahulu.
            // -------------------------------------------------

            if (
                roomStatus !== "occupied"
            ) {

                return res.status(409).json({
                    success: false,
                    message:
                        "Kamar masih memiliki kontrak aktif. Selesaikan kontrak penghuni terlebih dahulu sebelum mengubah status kamar."
                });
            }
        }


        // =================================================
        // TIDAK ADA KONTRAK AKTIF
        // =================================================

        if (!hasActiveContract) {

            // -------------------------------------------------
            // Kamar tanpa kontrak aktif tidak boleh manual
            // menjadi occupied.
            // -------------------------------------------------

            if (
                roomStatus === "occupied"
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Status terisi harus berasal dari kontrak aktif. Buat kontrak penghuni terlebih dahulu."
                });
            }
        }


        // =================================================
        // UPDATE ROOM
        // =================================================

        await db.query(`
            UPDATE rooms
            SET
                room_number = ?,
                building_id = ?,
                floor_id = ?,
                price = ?,
                status = ?,
                notes = ?
            WHERE id = ?
        `, [
            String(room_number).trim(),
            building_id,
            floor_id || null,
            Number(price),
            roomStatus,
            notes
                ? String(notes).trim()
                : null,
            id
        ]);


        // =================================================
        // AMBIL DATA TERBARU
        // =================================================

        const [rooms] =
            await db.query(`
                ${ROOM_SELECT}
                WHERE r.id = ?
                LIMIT 1
            `, [
                id
            ]);


        const room =
            formatRoom(rooms[0]);


        // =================================================
        // RESPONSE
        // =================================================

        res.json({
            success: true,
            message:
                "Kamar berhasil diperbarui",
            data: room
        });

    } catch (error) {

        console.error(
            "Update Room Error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Gagal memperbarui kamar",
            error: error.message
        });
    }
};


// =====================================================
// DELETE ROOM
// DELETE /api/rooms/:id
// =====================================================
const deleteRoom = async (req, res) => {

    const connection =
        await db.getConnection();

    try {

        const { id } = req.params;


        // =================================================
        // CEK ROOM
        // =================================================

        const [existing] =
            await connection.query(`
                SELECT
                    id,
                    room_number,
                    status
                FROM rooms
                WHERE id = ?
                LIMIT 1
            `, [
                id
            ]);


        if (
            existing.length === 0
        ) {

            return res.status(404).json({
                success: false,
                message:
                    "Kamar tidak ditemukan"
            });
        }


        // =================================================
        // CEK KONTRAK AKTIF
        // =================================================

        const [activeContract] =
            await connection.query(`
                SELECT
                    id,
                    tenant_id
                FROM contracts
                WHERE room_id = ?
                AND status = 'active'
                LIMIT 1
            `, [
                id
            ]);


        if (
            activeContract.length > 0
        ) {

            return res.status(409).json({
                success: false,
                message:
                    "Kamar tidak dapat dihapus karena masih memiliki kontrak aktif. Selesaikan kontrak penghuni terlebih dahulu."
            });
        }


        // =================================================
        // CEK RIWAYAT KONTRAK
        // =================================================

        const [contracts] =
            await connection.query(`
                SELECT
                    id,
                    status
                FROM contracts
                WHERE room_id = ?
                LIMIT 1
            `, [
                id
            ]);


        // -------------------------------------------------
        // Kalau sudah pernah dihuni,
        // jangan hapus agar histori tetap aman.
        // -------------------------------------------------

        if (
            contracts.length > 0
        ) {

            return res.status(409).json({
                success: false,
                message:
                    "Kamar tidak dapat dihapus karena sudah memiliki riwayat kontrak. Gunakan status nonaktif agar histori tetap tersimpan."
            });
        }


        // =================================================
        // MULAI TRANSACTION
        // =================================================

        await connection.beginTransaction();


        // =================================================
        // DELETE ROOM
        // =================================================

        await connection.query(`
            DELETE FROM rooms
            WHERE id = ?
        `, [
            id
        ]);


        // =================================================
        // COMMIT
        // =================================================

        await connection.commit();


        // =================================================
        // RESPONSE
        // =================================================

        res.json({
            success: true,
            message:
                "Kamar berhasil dihapus"
        });

    } catch (error) {

        // -------------------------------------------------
        // ROLLBACK
        // -------------------------------------------------

        try {

            await connection.rollback();

        } catch (rollbackError) {

            console.error(
                "Rollback Error:",
                rollbackError
            );
        }


        console.error(
            "Delete Room Error:",
            error
        );


        res.status(500).json({
            success: false,
            message:
                "Gagal menghapus kamar",
            error: error.message
        });

    } finally {

        connection.release();
    }
};


// =====================================================
// EXPORT
// =====================================================

module.exports = {
    getRooms,
    getRoomById,
    createRoom,
    updateRoom,
    deleteRoom
};