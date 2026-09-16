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
// TRANSFER ROOM
// POST /api/rooms/transfer
// =====================================================


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
// TRANSFER ROOM
// POST /api/rooms/transfer
// =====================================================

// =====================================================
// TRANSFER ROOM
// POST /api/rooms/transfer
// =====================================================

const transferRoom = async (
    req,
    res
) => {

    console.log("=== TRANSFER ROOM REQUEST MASUK ===");

    const connection =
        await db.getConnection();

    let transactionStarted = false;
    let transactionFinished = false;

    try {

        // =====================================================
        // MULAI DATABASE TRANSACTION
        // =====================================================

        await connection.beginTransaction();

        transactionStarted = true;

        console.log(
            "=== TRANSFER ROOM TRANSACTION START ==="
        );


        const {
            tenant_id,
            new_room_id,
            transfer_date,
            reason
        } = req.body;


        // =====================================================
        // CEK PENGHUNI
        // =====================================================

        const [tenants] =
            await connection.query(`

                SELECT
                    id,
                    name,
                    status

                FROM tenants

                WHERE id = ?

                LIMIT 1

            `, [
                tenant_id
            ]);


        if (tenants.length === 0) {

            return res.status(404).json({

                success: false,

                message:
                    "Penghuni tidak ditemukan"

            });

        }


        const tenant =
            tenants[0];


        // =====================================================
        // CEK KONTRAK AKTIF
        //
        // FOR UPDATE digunakan supaya kontrak tidak berubah
        // oleh proses lain selama transfer berlangsung.
        // =====================================================

        const [contracts] =
            await connection.query(`

                SELECT
                    id,
                    tenant_id,
                    room_id,
                    start_date,
                    end_date,
                    monthly_price,
                    status

                FROM contracts

                WHERE tenant_id = ?

                AND status = 'active'

                LIMIT 1

                FOR UPDATE

            `, [
                tenant_id
            ]);


        if (contracts.length === 0) {

            return res.status(409).json({

                success: false,

                message:
                    "Penghuni tidak memiliki kontrak aktif"

            });

        }


        const contract =
            contracts[0];


        // =====================================================
        // VALIDASI KAMAR TUJUAN TIDAK SAMA
        // =====================================================

        if (
            Number(contract.room_id) ===
            Number(new_room_id)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Kamar tujuan sama dengan kamar saat ini"

            });

        }


        // =====================================================
        // CEK KAMAR TUJUAN
        //
        // FOR UPDATE mengunci kamar tujuan selama transaction.
        // Ini mencegah dua proses transfer menggunakan kamar
        // kosong yang sama secara bersamaan.
        // =====================================================

        const [newRooms] =
            await connection.query(`

                SELECT
                    r.id,
                    r.room_number,
                    r.building_id,
                    r.floor_id,
                    r.price,
                    r.status,
                    f.name AS floor_name,
                    b.name AS building_name

                FROM rooms r

                LEFT JOIN floors f
                    ON r.floor_id = f.id

                LEFT JOIN buildings b
                    ON r.building_id = b.id

                WHERE r.id = ?

                LIMIT 1

                FOR UPDATE

            `, [
                new_room_id
            ]);


        if (newRooms.length === 0) {

            return res.status(404).json({

                success: false,

                message:
                    "Kamar tujuan tidak ditemukan"

            });

        }


        const newRoom =
            newRooms[0];


        // =====================================================
        // CEK KAMAR TUJUAN MEMILIKI KONTRAK AKTIF
        // =====================================================

        const [activeTargetContracts] =
            await connection.query(`

                SELECT
                    id,
                    tenant_id

                FROM contracts

                WHERE room_id = ?

                AND status = 'active'

                LIMIT 1

            `, [
                new_room_id
            ]);


        if (activeTargetContracts.length > 0) {

            return res.status(409).json({

                success: false,

                message:
                    "Kamar tujuan sedang ditempati penghuni lain"

            });

        }


        // =====================================================
        // CEK STATUS KAMAR TUJUAN
        // =====================================================

        const targetRoomStatus =
            String(
                newRoom.status || ""
            ).toLowerCase();


        if (
            targetRoomStatus !== "available"
        ) {

            return res.status(409).json({

                success: false,

                message:
                    `Kamar ${newRoom.room_number} tidak tersedia untuk pindah. Status saat ini: ${targetRoomStatus}`

            });

        }


        // =====================================================
        // SIMPAN ID KAMAR LAMA
        // =====================================================

        const oldRoomId =
            contract.room_id;


        // =====================================================
        // UPDATE KONTRAK
        //
        // HANYA room_id yang berubah.
        //
        // tenant_id tetap.
        // monthly_price tetap.
        // start_date tetap.
        // end_date tetap.
        // status tetap active.
        // =====================================================

        const [contractUpdate] =
            await connection.query(`

                UPDATE contracts

                SET room_id = ?

                WHERE id = ?

                AND tenant_id = ?

                AND status = 'active'

            `, [
                new_room_id,
                contract.id,
                tenant_id
            ]);


        if (
            contractUpdate.affectedRows !== 1
        ) {

            throw new Error(
                "Gagal memperbarui kamar pada kontrak"
            );

        }


        // =====================================================
        // UPDATE KAMAR LAMA
        //
        // occupied → available
        // =====================================================

        const [oldRoomUpdate] =
            await connection.query(`

                UPDATE rooms

                SET status = 'available'

                WHERE id = ?

            `, [
                oldRoomId
            ]);


        if (
            oldRoomUpdate.affectedRows !== 1
        ) {

            throw new Error(
                "Gagal mengubah status kamar lama"
            );

        }


        // =====================================================
        // UPDATE KAMAR BARU
        //
        // available → occupied
        // =====================================================

        const [newRoomUpdate] =
            await connection.query(`

                UPDATE rooms

                SET status = 'occupied'

                WHERE id = ?

                AND status = 'available'

            `, [
                new_room_id
            ]);


        if (
            newRoomUpdate.affectedRows !== 1
        ) {

            throw new Error(
                "Gagal mengubah status kamar baru"
            );

        }


        // =====================================================
        // SIMPAN RIWAYAT TRANSFER
        // =====================================================

        const [transferHistory] =
            await connection.query(`

                INSERT INTO room_transfers (

                    tenant_id,
                    old_room_id,
                    new_room_id,
                    transfer_date,
                    reason

                )

                VALUES (?, ?, ?, ?, ?)

            `, [
                tenant_id,
                oldRoomId,
                new_room_id,
                transfer_date || null,
                reason || null
            ]);


        if (
            transferHistory.affectedRows !== 1
        ) {

            throw new Error(
                "Gagal menyimpan riwayat pindah kamar"
            );

        }


        // =====================================================
        // COMMIT TRANSACTION
        // =====================================================

        await connection.commit();

        transactionFinished = true;

        console.log(
            "=== TRANSFER ROOM TRANSACTION COMMIT ==="
        );


        // =====================================================
        // RESPONSE BERHASIL
        // =====================================================

        return res.json({

            success: true,

            message:
                "Pindah kamar berhasil",

            data: {

                tenant: {

                    id:
                        tenant.id,

                    name:
                        tenant.name

                },

                contract: {

                    id:
                        contract.id,

                    old_room_id:
                        oldRoomId,

                    new_room_id:
                        Number(new_room_id),

                    monthly_price:
                        contract.monthly_price

                },

                old_room: {

                    id:
                        oldRoomId,

                    status:
                        "available"

                },

                new_room: {

                    id:
                        newRoom.id,

                    room_number:
                        newRoom.room_number,

                    building_id:
                        newRoom.building_id,

                    building_name:
                        newRoom.building_name,

                    floor_id:
                        newRoom.floor_id,

                    floor_name:
                        newRoom.floor_name,

                    status:
                        "occupied"

                },

                transfer: {

                    transfer_date:
                        transfer_date || null,

                    reason:
                        reason || null

                }

            }

        });


    } catch (error) {

        console.error(
            "Transfer Room Error:",
            error
        );


        // =====================================================
        // ROLLBACK JIKA TERJADI ERROR
        // =====================================================

        if (
            transactionStarted &&
            !transactionFinished
        ) {

            try {

                await connection.rollback();

                console.log(
                    "=== TRANSFER ROOM TRANSACTION ROLLBACK ==="
                );

            } catch (rollbackError) {

                console.error(
                    "Rollback Error:",
                    rollbackError
                );

            }

        }


        return res.status(500).json({

            success: false,

            message:
                "Gagal memproses pindah kamar",

            error:
                error.message

        });

    } finally {

        // =====================================================
        // SAFETY ROLLBACK
        //
        // Kalau transaction masih belum selesai,
        // pastikan tidak ada transaction yang menggantung.
        // =====================================================

        if (
            transactionStarted &&
            !transactionFinished
        ) {

            try {

                await connection.rollback();

            } catch (rollbackError) {

                console.error(
                    "Final Rollback Error:",
                    rollbackError
                );

            }

        }


        // =====================================================
        // RELEASE CONNECTION
        // =====================================================

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

    getPublicRooms,

    transferRoom

};