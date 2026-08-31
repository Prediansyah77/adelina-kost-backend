const db = require("../config/database");


// =====================================================
// CREATE BOOKING
// POST /api/bookings
// =====================================================
//
// Alur:
//
// JWT
//  ↓
// req.user.tenant_id
//  ↓
// tenants
//  ↓
// rooms
//  ↓
// room_bookings
//
// Booking maksimal 7 hari.
//
// booking_amount:
//
// harga kamar / 30 x booking_days
//
// =====================================================

const createBooking = async (req, res) => {

    let connection = null;

    try {

        // =================================================
        // USER DARI JWT
        // =================================================

        const user = req.user;


        if (!user) {

            return res.status(401).json({

                success: false,

                message:
                    "User tidak terautentikasi"

            });

        }


        // =================================================
        // CEK ROLE
        // =================================================

        if (
            String(user.role).toLowerCase() !==
            "penghuni"
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "Hanya penghuni yang dapat mengajukan kamar"

            });

        }


        // =================================================
        // TENANT ID
        // =================================================

        const tenantId =
            user.tenant_id;


        if (!tenantId) {

            return res.status(400).json({

                success: false,

                message:
                    "Akun belum terhubung dengan data penghuni"

            });

        }


        // =================================================
        // ROOM ID
        // =================================================

        const {
            room_id
        } = req.body;


        if (!room_id) {

            return res.status(400).json({

                success: false,

                message:
                    "Room ID wajib diisi"

            });

        }


        // =================================================
        // AMBIL DATA TENANT
        // =================================================

        const [tenants] =
            await db.query(`

                SELECT

                    id,
                    name,
                    phone,
                    address,
                    identity_number,
                    gender,
                    occupation,
                    boarding_purpose,
                    status

                FROM tenants

                WHERE id = ?

                LIMIT 1

            `, [

                tenantId

            ]);


        if (
            tenants.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Data penghuni tidak ditemukan"

            });

        }


        const tenant =
            tenants[0];


        // =================================================
        // CEK KONTRAK AKTIF
        // =================================================

        const [activeContracts] =
            await db.query(`

                SELECT
                    id

                FROM contracts

                WHERE tenant_id = ?

                AND status = 'active'

                LIMIT 1

            `, [

                tenantId

            ]);


        if (
            activeContracts.length > 0
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "Anda sudah menjadi penghuni aktif dan memiliki kontrak kamar"

            });

        }


        // =================================================
        // AMBIL DATA ROOM
        // =================================================

        const [rooms] =
            await db.query(`

                SELECT

                    r.id,
                    r.room_number,
                    r.building_id,
                    r.floor_id,
                    r.price,
                    r.status,

                    b.name AS building_name,

                    f.name AS floor_name

                FROM rooms r

                LEFT JOIN buildings b
                    ON r.building_id = b.id

                LEFT JOIN floors f
                    ON r.floor_id = f.id

                WHERE r.id = ?

                LIMIT 1

            `, [

                room_id

            ]);


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
            rooms[0];


        // =================================================
        // CEK STATUS ROOM
        // =================================================

        const roomStatus =
            String(
                room.status
            ).toLowerCase();


        if (
            roomStatus === "inactive" ||
            roomStatus === "nonaktif"
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "Kamar sedang tidak aktif"

            });

        }


        // =================================================
        // CEK KONTRAK ROOM
        // =================================================

        const [roomContracts] =
            await db.query(`

                SELECT
                    id

                FROM contracts

                WHERE room_id = ?

                AND status = 'active'

                LIMIT 1

            `, [

                room_id

            ]);


        if (
            roomContracts.length > 0
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "Kamar sudah ditempati penghuni lain"

            });

        }


        // =================================================
        // CEK BOOKING TENANT
        // =================================================

        const [existingBookings] =
            await db.query(`

                SELECT

                    id,
                    room_id,
                    status

                FROM room_bookings

                WHERE tenant_id = ?

                AND status IN (
                    'pending',
                    'approved'
                )

                LIMIT 1

            `, [

                tenantId

            ]);


        if (
            existingBookings.length > 0
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "Anda sudah memiliki pengajuan booking"

            });

        }


        // =================================================
        // CEK BOOKING ROOM
        // =================================================

        const [roomBookings] =
            await db.query(`

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

                room_id

            ]);


        if (
            roomBookings.length > 0
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "Kamar sedang dalam proses booking oleh calon penghuni lain"

            });

        }


        // =================================================
        // MULAI TRANSACTION
        // =================================================

        connection =
            await db.getConnection();

        await connection.beginTransaction();


        // =================================================
        // DEFAULT BOOKING
        // =================================================
        //
        // Durasi sementara 1 hari.
        //
        // Nanti user memilih durasi di halaman
        // pembayaran booking.
        //
        // Jadi nominal awal:
        //
        // price / 30
        //
        // =================================================

        const bookingDays =
            1;


        const dailyPrice =
            Number(room.price) / 30;


        const bookingAmount =
            Math.round(
                dailyPrice *
                bookingDays
            );


        // =================================================
        // TANGGAL MULAI
        // =================================================

        const requestedStartDate =
            new Date()
                .toISOString()
                .slice(
                    0,
                    10
                );


        // =================================================
        // INSERT BOOKING
        // =================================================

        const [result] =
            await connection.query(`

                INSERT INTO room_bookings
                (
                    tenant_id,
                    room_id,
                    booking_days,
                    booking_amount,
                    requested_start_date,
                    status
                )

                VALUES
                (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    'pending'
                )

            `, [

                tenantId,

                room_id,

                bookingDays,

                bookingAmount,

                requestedStartDate

            ]);


        // =================================================
        // COMMIT
        // =================================================

        await connection.commit();


        // =================================================
        // RESPONSE
        // =================================================

        return res.status(201).json({

            success: true,

            message:
                "Pengajuan kamar berhasil dibuat. Silakan lanjutkan pembayaran booking.",

            data: {

                booking_id:
                    result.insertId,

                tenant: {

                    id:
                        tenant.id,

                    name:
                        tenant.name,

                    phone:
                        tenant.phone,

                    address:
                        tenant.address,

                    identity_number:
                        tenant.identity_number,

                    gender:
                        tenant.gender,

                    occupation:
                        tenant.occupation,

                    boarding_purpose:
                        tenant.boarding_purpose

                },

                room: {

                    id:
                        room.id,

                    room_number:
                        room.room_number,

                    building_name:
                        room.building_name,

                    floor_name:
                        room.floor_name,

                    price:
                        Number(room.price)

                },

                booking: {

                    days:
                        bookingDays,

                    daily_price:
                        dailyPrice,

                    amount:
                        bookingAmount,

                    requested_start_date:
                        requestedStartDate,

                    status:
                        "pending"

                }

            }

        });


    } catch (error) {

        // =================================================
        // ROLLBACK
        // =================================================

        if (connection) {

            try {

                await connection.rollback();

            } catch (rollbackError) {

                console.error(
                    "Rollback Booking Error:",
                    rollbackError
                );

            }

        }


        console.error(
            "Create Booking Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Gagal membuat pengajuan kamar",

            error:
                error.message

        });


    } finally {

        if (connection) {

            connection.release();

        }

    }

};



// =====================================================
// GET BOOKING BY ID
// GET /api/bookings/:id
// =====================================================
//
// Digunakan halaman pembayaran booking.
//
// Data:
// - tenant
// - kamar
// - harga kamar
// - lama booking
// - nominal booking
// - status
//
// =====================================================

const getBookingById = async (req, res) => {

    try {

        // =================================================
        // USER
        // =================================================

        const user =
            req.user;


        if (!user) {

            return res.status(401).json({

                success: false,

                message:
                    "User tidak terautentikasi"

            });

        }


        // =================================================
        // BOOKING ID
        // =================================================

        const {
            id
        } = req.params;


        if (!id) {

            return res.status(400).json({

                success: false,

                message:
                    "Booking ID wajib diisi"

            });

        }


        // =================================================
        // QUERY BOOKING
        // =================================================

        const [rows] =
            await db.query(`

                SELECT

                    rb.id AS booking_id,

                    rb.tenant_id,

                    rb.room_id,

                    rb.booking_days,

                    rb.booking_amount,

                    rb.requested_start_date,

                    rb.notes,

                    rb.status AS booking_status,

                    rb.rejection_reason,

                    rb.created_at,

                    t.name AS tenant_name,

                    t.phone AS tenant_phone,

                    t.address AS tenant_address,

                    t.identity_number,

                    t.gender,

                    t.occupation,

                    t.boarding_purpose,

                    r.room_number,

                    r.price AS room_price,

                    b.name AS building_name,

                    f.name AS floor_name

                FROM room_bookings rb

                INNER JOIN tenants t
                    ON rb.tenant_id = t.id

                INNER JOIN rooms r
                    ON rb.room_id = r.id

                LEFT JOIN buildings b
                    ON r.building_id = b.id

                LEFT JOIN floors f
                    ON r.floor_id = f.id

                WHERE rb.id = ?

                LIMIT 1

            `, [

                id

            ]);


        // =================================================
        // BOOKING TIDAK DITEMUKAN
        // =================================================

        if (
            rows.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Data booking tidak ditemukan"

            });

        }


        const booking =
            rows[0];


        // =================================================
        // KEAMANAN
        // =================================================
        //
        // Penghuni hanya boleh melihat booking miliknya.
        //
        // Admin boleh melihat semua.
        //
        // =================================================

        const role =
            String(
                user.role
            ).toLowerCase();


        if (
            role !== "admin" &&
            Number(booking.tenant_id) !==
            Number(user.tenant_id)
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "Anda tidak memiliki akses ke booking ini"

            });

        }


        // =================================================
        // RESPONSE
        // =================================================

        return res.json({

            success: true,

            data: {

                booking: {

                    id:
                        booking.booking_id,

                    tenant_id:
                        booking.tenant_id,

                    room_id:
                        booking.room_id,

                    days:
                        Number(
                            booking.booking_days
                        ),

                    amount:
                        Number(
                            booking.booking_amount
                        ),

                    requested_start_date:
                        booking.requested_start_date,

                    notes:
                        booking.notes,

                    status:
                        booking.booking_status,

                    rejection_reason:
                        booking.rejection_reason,

                    created_at:
                        booking.created_at

                },

                tenant: {

                    id:
                        booking.tenant_id,

                    name:
                        booking.tenant_name,

                    phone:
                        booking.tenant_phone,

                    address:
                        booking.tenant_address,

                    identity_number:
                        booking.identity_number,

                    gender:
                        booking.gender,

                    occupation:
                        booking.occupation,

                    boarding_purpose:
                        booking.boarding_purpose

                },

                room: {

                    id:
                        booking.room_id,

                    room_number:
                        booking.room_number,

                    price:
                        Number(
                            booking.room_price
                        ),

                    building_name:
                        booking.building_name,

                    floor_name:
                        booking.floor_name

                }

            }

        });

    } catch (error) {

        console.error(
            "Get Booking By ID Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Gagal mengambil data booking",

            error:
                error.message

        });

    }

};



// =====================================================
// GET MY BOOKING
// GET /api/bookings/my-booking
// =====================================================
//
// Digunakan oleh dashboard penghuni.
//
// Tenant ID diambil langsung dari JWT.
//
// Penghuni hanya dapat melihat booking miliknya sendiri.
//
// Booking terbaru yang aktif/paling terakhir dibuat
// akan dikembalikan.
//
// =====================================================

const getMyBooking = async (req, res) => {

    try {

        // =================================================
        // CEK USER
        // =================================================

        const user =
            req.user;


        if (!user) {

            return res.status(401).json({

                success: false,

                message:
                    "User tidak terautentikasi"

            });

        }


        // =================================================
        // TENANT ID DARI JWT
        // =================================================

        const tenantId =
            user.tenant_id;


        if (!tenantId) {

            return res.status(400).json({

                success: false,

                message:
                    "Akun belum terhubung dengan data penghuni"

            });

        }


        // =================================================
        // AMBIL BOOKING TERBARU MILIK TENANT
        // =================================================

        const [rows] =
            await db.query(`

                SELECT

                    rb.id AS booking_id,

                    rb.tenant_id,

                    rb.room_id,

                    rb.booking_days,

                    rb.booking_amount,

                    rb.requested_start_date,

                    rb.notes,

                    rb.status AS booking_status,

                    rb.rejection_reason,

                    rb.created_at,

                    t.name AS tenant_name,

                    t.phone AS tenant_phone,

                    t.address AS tenant_address,

                    t.identity_number,

                    t.gender,

                    t.occupation,

                    t.boarding_purpose,

                    r.room_number,

                    r.price AS room_price,

                    b.name AS building_name,

                    f.name AS floor_name

                FROM room_bookings rb

                INNER JOIN tenants t
                    ON rb.tenant_id = t.id

                INNER JOIN rooms r
                    ON rb.room_id = r.id

                LEFT JOIN buildings b
                    ON r.building_id = b.id

                LEFT JOIN floors f
                    ON r.floor_id = f.id

                WHERE rb.tenant_id = ?

                ORDER BY rb.id DESC

                LIMIT 1

            `, [

                tenantId

            ]);


        // =================================================
        // BELUM ADA BOOKING
        // =================================================

        if (
            rows.length === 0
        ) {

            return res.status(200).json({

                success: true,

                data: null,

                message:
                    "Belum ada pengajuan booking"

            });

        }


        const booking =
            rows[0];


        // =================================================
        // RESPONSE
        // =================================================

        return res.status(200).json({

            success: true,

            data: {

                booking: {

                    id:
                        booking.booking_id,

                    tenant_id:
                        booking.tenant_id,

                    room_id:
                        booking.room_id,

                    days:
                        Number(
                            booking.booking_days
                        ),

                    amount:
                        Number(
                            booking.booking_amount
                        ),

                    requested_start_date:
                        booking.requested_start_date,

                    notes:
                        booking.notes,

                    status:
                        booking.booking_status,

                    rejection_reason:
                        booking.rejection_reason,

                    created_at:
                        booking.created_at

                },

                tenant: {

                    id:
                        booking.tenant_id,

                    name:
                        booking.tenant_name,

                    phone:
                        booking.tenant_phone,

                    address:
                        booking.tenant_address,

                    identity_number:
                        booking.identity_number,

                    gender:
                        booking.gender,

                    occupation:
                        booking.occupation,

                    boarding_purpose:
                        booking.boarding_purpose

                },

                room: {

                    id:
                        booking.room_id,

                    room_number:
                        booking.room_number,

                    price:
                        Number(
                            booking.room_price
                        ),

                    building_name:
                        booking.building_name,

                    floor_name:
                        booking.floor_name

                }

            }

        });

    } catch (error) {

        console.error(
            "Get My Booking Error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Gagal mengambil booking penghuni",

            error:
                error.message

        });

    }

};



// =====================================================
// EXPORT
// =====================================================

module.exports = {

    createBooking,

    getBookingById,

    getMyBooking

};