const db = require("../config/database");

const {
    sendWhatsAppMessage
} = require("../services/whatsappService");


// ======================================================
// WHATSAPP REMINDER JOB
// ======================================================
//
// Fungsi:
// 1. Cari tagihan H-2
// 2. Pastikan belum lunas
// 3. Ambil data penghuni
// 4. Cek whatsapp_logs agar tidak kirim duplikat
// 5. Buat pesan WhatsApp
// 6. Kirim melalui whatsappService
// 7. Simpan hasil ke whatsapp_logs
//
// Saat ini whatsappService masih TESTING,
// jadi pesan hanya muncul di terminal.
// ======================================================

const runWhatsAppReminderJob = async () => {

    try {

        console.log(
            "Mengecek tagihan untuk WhatsApp reminder..."
        );


        // ==================================================
        // AMBIL TAGIHAN H-2
        // ==================================================

        const [rows] = await db.query(`

            SELECT

                b.id AS bill_id,

                b.contract_id,

                b.billing_month,

                b.billing_year,

                b.amount,

                b.due_date,

                b.status,

                c.tenant_id,

                c.room_id,

                t.name AS tenant_name,

                t.phone AS tenant_phone,

                r.room_number

            FROM bills b

            JOIN contracts c
                ON b.contract_id = c.id

            JOIN tenants t
                ON c.tenant_id = t.id

            JOIN rooms r
                ON c.room_id = r.id

            WHERE b.status = 'unpaid'

            AND b.due_date IS NOT NULL

            AND DATEDIFF(
                b.due_date,
                CURDATE()
            ) = 2

            ORDER BY
                b.due_date ASC

        `);


        // ==================================================
        // TIDAK ADA TAGIHAN
        // ==================================================

        if (rows.length === 0) {

            console.log(
                "Tidak ada tagihan yang perlu dikirim reminder."
            );

            return {

                success: true,

                total: 0,

                sent: 0,

                skipped: 0,

                failed: 0

            };

        }


        console.log(
            `Ditemukan ${rows.length} tagihan untuk reminder.`
        );


        let sentCount = 0;

        let skippedCount = 0;

        let failedCount = 0;


        // ==================================================
        // LOOP SETIAP TAGIHAN
        // ==================================================

        for (const bill of rows) {

            try {

                // ==========================================
                // TIPE REMINDER
                // ==========================================

                const reminderType =
                    "payment_reminder_h2";


                // ==========================================
                // CEK REMINDER SUDAH PERNAH TERKIRIM
                // ==========================================

                const [logRows] = await db.query(`

                    SELECT
                        id

                    FROM whatsapp_logs

                    WHERE bill_id = ?

                    AND type = ?

                    AND status = 'sent'

                    LIMIT 1

                `, [
                    bill.bill_id,
                    reminderType
                ]);


                // ==========================================
                // JIKA SUDAH TERKIRIM
                // JANGAN KIRIM LAGI
                // ==========================================

                if (logRows.length > 0) {

                    console.log(
                        `Reminder dilewati: ` +
                        `${bill.tenant_name} ` +
                        `(Kamar ${bill.room_number}) ` +
                        `sudah pernah dikirim.`
                    );

                    skippedCount++;

                    continue;

                }


                // ==========================================
                // VALIDASI NOMOR WHATSAPP
                // ==========================================

                if (!bill.tenant_phone) {

                    console.warn(
                        `Penghuni ${bill.tenant_name} ` +
                        `tidak memiliki nomor WhatsApp.`
                    );

                    failedCount++;

                    continue;

                }


                // ==========================================
                // FORMAT BULAN
                // ==========================================

                const monthNames = [

                    "Januari",
                    "Februari",
                    "Maret",
                    "April",
                    "Mei",
                    "Juni",
                    "Juli",
                    "Agustus",
                    "September",
                    "Oktober",
                    "November",
                    "Desember"

                ];


                const billingMonth =
                    monthNames[
                    Number(bill.billing_month) - 1
                    ] || bill.billing_month;


                // ==========================================
                // FORMAT JUMLAH UANG
                // ==========================================

                const formattedAmount =
                    new Intl.NumberFormat(
                        "id-ID"
                    ).format(
                        Number(bill.amount)
                    );


                // ==========================================
                // FORMAT TANGGAL JATUH TEMPO
                // ==========================================

                const dueDate =
                    new Date(bill.due_date);


                const formattedDueDate =
                    dueDate.toLocaleDateString(
                        "id-ID",
                        {
                            day: "numeric",
                            month: "long",
                            year: "numeric"
                        }
                    );


                // ==========================================
                // BUAT PESAN WHATSAPP
                // ==========================================

                const message =

                    `Halo Kak ${bill.tenant_name} 👋

Ini pengingat pembayaran ADELINA KOST.

🏠 Kamar: ${bill.room_number}

📅 Tagihan: ${billingMonth} ${bill.billing_year}

💰 Jumlah: Rp ${formattedAmount}

⏰ Jatuh tempo: ${formattedDueDate}

Saat ini tagihan masih berstatus BELUM LUNAS.

Mohon melakukan pembayaran sebelum jatuh tempo ya Kak 🙏

Terima kasih.

— ADELINA KOST`;


                // ==========================================
                // KIRIM WHATSAPP
                // ==========================================

                const whatsappResult =
                    await sendWhatsAppMessage({

                        phone:
                            bill.tenant_phone,

                        message

                    });


                // ==========================================
                // SIMPAN LOG BERHASIL
                // ==========================================

                await db.query(`

                    INSERT INTO whatsapp_logs
                    (
                        bill_id,
                        phone,
                        message,
                        type,
                        status
                    )

                    VALUES (?, ?, ?, ?, 'sent')

                `, [

                    bill.bill_id,

                    whatsappResult.phone,

                    message,

                    reminderType

                ]);


                sentCount++;


                console.log(
                    `Reminder berhasil dikirim dan dicatat: ` +
                    `${bill.tenant_name} ` +
                    `(Kamar ${bill.room_number})`
                );


            } catch (error) {

                failedCount++;


                console.error(
                    `Gagal mengirim reminder untuk ` +
                    `${bill.tenant_name}:`,
                    error.message
                );


                // ==========================================
                // SIMPAN LOG GAGAL
                // ==========================================

                try {

                    await db.query(`

                        INSERT INTO whatsapp_logs
                        (
                            bill_id,
                            phone,
                            message,
                            type,
                            status
                        )

                        VALUES (?, ?, ?, ?, 'failed')

                    `, [

                        bill.bill_id,

                        bill.tenant_phone || "-",

                        "Gagal mengirim payment reminder H-2",

                        "payment_reminder_h2"

                    ]);

                } catch (logError) {

                    console.error(
                        "Gagal menyimpan WhatsApp log:",
                        logError.message
                    );

                }

            }

        }


        // ==================================================
        // HASIL JOB
        // ==================================================

        console.log(
            "========================================"
        );

        console.log(
            "WHATSAPP REMINDER JOB SELESAI"
        );

        console.log(
            `Total    : ${rows.length}`
        );

        console.log(
            `Berhasil : ${sentCount}`
        );

        console.log(
            `Dilewati : ${skippedCount}`
        );

        console.log(
            `Gagal    : ${failedCount}`
        );

        console.log(
            "========================================"
        );


        return {

            success: true,

            total:
                rows.length,

            sent:
                sentCount,

            skipped:
                skippedCount,

            failed:
                failedCount

        };


    } catch (error) {

        console.error(
            "WhatsApp Reminder Job Error:",
            error
        );

        throw error;

    }

};


// ======================================================
// EXPORT
// ======================================================

module.exports = {

    runWhatsAppReminderJob

};