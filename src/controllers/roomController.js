const db = require("../config/database");


// =====================================================
// HELPER
// =====================================================

// -----------------------------------------------------
// Ambil status kamar berdasarkan kondisi sebenarnya
//
// PRIORITAS:
//
// 1. Ada kontrak aktif       -> occupied
// 2. room.status = booked    -> booked
// 3. room.status = occupied  -> occupied
// 4. room.status = inactive  -> inactive
// 5. selain itu              -> available
//
// ALUR:
//
// available
//     ↓
// booked
//     ↓
// occupied
//
// CATATAN:
//
// Pembayaran booking TIDAK membuat kamar menjadi
// occupied.
//
// Pembayaran booking hanya memastikan booking tetap
// berjalan / disetujui.
//
// Kamar menjadi occupied ketika sudah mempunyai
// kontrak aktif.
// -----------------------------------------------------

const calculateRoomStatus = (room) => {

    const roomStatus = String(
        room.room_status ||
        room.status ||
        ""
    ).toLowerCase();


    const hasActiveContract =
        Number(
            room.active_contract_id || 0
        ) > 0;


    // =================================================
    // 1. ADA KONTRAK AKTIF
    //
    // Kontrak aktif = kamar resmi terisi.
    // =================================================

    if (
        hasActiveContract
    ) {

        return "occupied";

    }


    // =================================================
    // 2. BOOKED
    //
    // Kamar sedang dalam proses / status booking.
    //
    // Pembayaran booking yang sudah diverifikasi
    // TIDAK mengubah booked menjadi occupied.
    // =================================================

    if (
        roomStatus === "booked"
    ) {

        return "booked";

    }


    // =================================================
    // 3. OCCUPIED
    //
    // Hormati status occupied dari database.
    //
    // Catatan:
    // Secara normal occupied harus mempunyai
    // kontrak aktif.
    // =================================================

    if (
        roomStatus === "occupied"
    ) {

        return "occupied";

    }


    // =================================================
    // 4. NONAKTIF
    // =================================================

    if (
        roomStatus === "inactive"
    ) {

        return "inactive";

    }


    // =================================================
    // 5. DEFAULT
    // =================================================

    return "available";

};


// -----------------------------------------------------
// Format satu room hasil database
// -----------------------------------------------------

const formatRoom = (room) => {

    const calculatedStatus =
        calculateRoomStatus(room);


    let statusSource = "room";


    // =================================================
    // STATUS DARI KONTRAK AKTIF
    // =================================================

    if (
        calculatedStatus === "occupied" &&
        Number(
            room.active_contract_id || 0
        ) > 0
    ) {

        statusSource =
            "active_contract";

    }


    // =================================================
    // STATUS DARI BOOKING
    // =================================================

    if (
        calculatedStatus === "booked"
    ) {

        statusSource =
            "booking";

    }


    // =================================================
    // RESPONSE ROOM
    // =================================================

    return {

        ...room,

        // -------------------------------------------------
        // Status yang dipakai frontend
        // -------------------------------------------------

        status:
            calculatedStatus,


        // -------------------------------------------------
        // Status asli database
        // -------------------------------------------------

        room_status:
            room.room_status ||
            null,


        // -------------------------------------------------
        // Sumber status
        // -------------------------------------------------

        status_source:
            statusSource

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
// GET PUBLIC ROOMS
// GET /api/rooms/public
// =====================================================
//
// Endpoint khusus website User.
//
// Status:
//
// available
// booked
// occupied
// inactive
//
// Data tenant TIDAK dikirim ke publik.
// =====================================================

const getPublicRooms = async (
    req,
    res
) => {

    try {

        const [rooms] =
            await db.query(`

                SELECT

                    r.id,

                    r.room_number,

                    r.building_id,

                    r.floor_id,

                    r.price,

                    r.notes,

                    f.name AS floor_name,

                    b.name AS building_name,

                    CASE

                        WHEN c.id IS NOT NULL
                            THEN 'occupied'

                        WHEN LOWER(r.status) = 'booked'
                            THEN 'booked'

                        WHEN LOWER(r.status) = 'inactive'
                            THEN 'inactive'

                        ELSE 'available'

                    END AS status

                FROM rooms r

                LEFT JOIN floors f
                    ON r.floor_id = f.id

                LEFT JOIN buildings b
                    ON r.building_id = b.id

                LEFT JOIN contracts c
                    ON c.room_id = r.id
                    AND c.status = 'active'

                WHERE LOWER(r.status) != 'inactive'

                ORDER BY

                    b.id ASC,

                    f.id ASC,

                    r.id ASC

            `);


        return res.json({

            success: true,

            data:
                rooms

        });

    } catch (error) {

        console.error(
            "Get Public Rooms Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Gagal mengambil data kamar publik",

            error:
                error.message

        });

    }

};


// =====================================================
// GET ALL ROOMS
// GET /api/rooms
// =====================================================

const getRooms = async (
    req,
    res
) => {

    try {

        const [rooms] =
            await db.query(`

                ${ROOM_SELECT}

                ORDER BY r.id ASC

            `);


        // =================================================
        // HITUNG STATUS SEBENARNYA
        // =================================================

        const formattedRooms =
            rooms.map(
                formatRoom
            );


        return res.json({

            success: true,

            data:
                formattedRooms

        });

    } catch (error) {

        console.error(
            "Get Rooms Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Gagal mengambil data kamar",

            error:
                error.message

        });

    }

};


// =====================================================
// GET ROOM BY ID
// GET /api/rooms/:id
// =====================================================

const getRoomById = async (
    req,
    res
) => {

    try {

        const {
            id
        } = req.params;


        const [rooms] =
            await db.query(`

                ${ROOM_SELECT}

                WHERE r.id = ?

                LIMIT 1

            `, [

                id

            ]);


        // =================================================
        // ROOM TIDAK DITEMUKAN
        // =================================================

        if (
            rooms.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Kamar tidak ditemukan"

            });

        }


        const room =
            formatRoom(
                rooms[0]
            );


        return res.json({

            success: true,

            data:
                room

        });

    } catch (error) {

        console.error(
            "Get Room By ID Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Gagal mengambil data kamar",

            error:
                error.message

        });

    }

};


// =====================================================
// CREATE ROOM
// POST /api/rooms
// =====================================================

const createRoom = async (
    req,
    res
) => {

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
            !String(
                room_number
            ).trim()
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

        if (
            !building_id
        ) {

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
        // STATUS ROOM
        // =================================================

        const roomStatus =
            String(
                status ||
                "available"
            ).toLowerCase();


        const allowedStatus = [

            "available",

            "booked",

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
        // ROOM BARU TIDAK BOLEH BOOKED
        // =================================================
        //
        // Booking harus melalui proses booking.
        // =================================================

        if (
            roomStatus === "booked"
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Kamar tidak dapat langsung dibuat dengan status booking. Gunakan proses booking."

            });

        }


        // =================================================
        // ROOM BARU TIDAK BOLEH OCCUPIED
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

        if (
            floor_id
        ) {

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

                String(
                    room_number
                ).trim()

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

                String(
                    room_number
                ).trim(),

                building_id,

                floor_id ||
                null,

                Number(
                    price
                ),

                roomStatus,

                notes
                    ? String(
                        notes
                    ).trim()
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
            formatRoom(
                rooms[0]
            );


        // =================================================
        // RESPONSE
        // =================================================

        return res.status(201).json({

            success: true,

            message:
                "Kamar berhasil ditambahkan",

            data:
                room

        });

    } catch (error) {

        console.error(
            "Create Room Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Gagal menambahkan kamar",

            error:
                error.message

        });

    }

};


// =====================================================
// UPDATE ROOM
// PUT /api/rooms/:id
// =====================================================

const updateRoom = async (
    req,
    res
) => {

    try {

        const {
            id
        } = req.params;


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


        const existingRoom =
            existing[0];


        const existingStatus =
            String(
                existingRoom.status ||
                ""
            ).toLowerCase();


        // =================================================
        // VALIDASI NOMOR KAMAR
        // =================================================

        if (
            !room_number ||
            !String(
                room_number
            ).trim()
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

        if (
            !building_id
        ) {

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
            String(
                status ||
                ""
            ).toLowerCase();


        const allowedStatus = [

            "available",

            "booked",

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

        if (
            floor_id
        ) {

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

                String(
                    room_number
                ).trim(),

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

        if (
            hasActiveContract
        ) {

            // -------------------------------------------------
            // Kamar dengan kontrak aktif wajib occupied.
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

        if (
            !hasActiveContract
        ) {

            // -------------------------------------------------
            // Tidak boleh manual menjadi occupied.
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
        // BOOKED
        // =================================================
        //
        // Jangan izinkan user mengubah status booking
        // secara manual dari halaman kamar.
        //
        // Status booked berasal dari proses booking.
        // =================================================

        if (
            existingStatus === "booked"
        ) {

            if (
                roomStatus !== "booked"
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Kamar sedang dalam status booking. Status booking harus diselesaikan melalui proses booking."

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

            String(
                room_number
            ).trim(),

            building_id,

            floor_id ||
            null,

            Number(
                price
            ),

            roomStatus,

            notes
                ? String(
                    notes
                ).trim()
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
            formatRoom(
                rooms[0]
            );


        // =================================================
        // RESPONSE
        // =================================================

        return res.json({

            success: true,

            message:
                "Kamar berhasil diperbarui",

            data:
                room

        });

    } catch (error) {

        console.error(
            "Update Room Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Gagal memperbarui kamar",

            error:
                error.message

        });

    }

};


// =====================================================
// DELETE ROOM
// DELETE /api/rooms/:id
// =====================================================

const deleteRoom = async (
    req,
    res
) => {

    const connection =
        await db.getConnection();


    try {

        const {
            id
        } = req.params;


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
        // CEK BOOKING AKTIF
        // =================================================
        //
        // Jangan hapus kamar yang masih mempunyai booking.
        // =================================================

        const [activeBooking] =
            await connection.query(`

                SELECT

                    id,

                    tenant_id,

                    status

                FROM room_bookings

                WHERE room_id = ?

                AND status IN (
                    'pending',
                    'approved'
                )

                LIMIT 1

            `, [

                id

            ]);


        if (
            activeBooking.length > 0
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "Kamar tidak dapat dihapus karena masih memiliki booking aktif."

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

        return res.json({

            success: true,

            message:
                "Kamar berhasil dihapus"

        });

    } catch (error) {

        // =================================================
        // ROLLBACK
        // =================================================

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


        return res.status(500).json({

            success: false,

            message:
                "Gagal menghapus kamar",

            error:
                error.message

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

    deleteRoom,

    getPublicRooms

};