const db = require("../config/database");


// ======================================================
// WHATSAPP SERVICE
// ======================================================


// ======================================================
// ENVIRONMENT
// ======================================================

const WHATSAPP_API_VERSION =
    process.env.WHATSAPP_API_VERSION;

const WHATSAPP_PHONE_NUMBER_ID =
    process.env.WHATSAPP_PHONE_NUMBER_ID;

const WHATSAPP_ACCESS_TOKEN =
    process.env.WHATSAPP_ACCESS_TOKEN;

const WHATSAPP_TEST_MODE =
    process.env.WHATSAPP_TEST_MODE === "true";


// ======================================================
// NORMALISASI NOMOR WHATSAPP
// ======================================================

const normalizePhone = (phone) => {

    if (!phone) {

        throw new Error(
            "Nomor WhatsApp tidak tersedia"
        );

    }


    let normalizedPhone =
        String(phone).replace(/\D/g, "");


    // 081234567890
    // ↓
    // 6281234567890

    if (normalizedPhone.startsWith("0")) {

        normalizedPhone =
            "62" +
            normalizedPhone.slice(1);

    }


    return normalizedPhone;

};


// ======================================================
// VALIDASI KONFIGURASI WHATSAPP
// ======================================================

const validateWhatsAppConfig = () => {

    if (!WHATSAPP_API_VERSION) {

        throw new Error(
            "WHATSAPP_API_VERSION belum diatur di .env"
        );

    }


    if (!WHATSAPP_PHONE_NUMBER_ID) {

        throw new Error(
            "WHATSAPP_PHONE_NUMBER_ID belum diatur di .env"
        );

    }


    if (!WHATSAPP_ACCESS_TOKEN) {

        throw new Error(
            "WHATSAPP_ACCESS_TOKEN belum diatur di .env"
        );

    }

};


// ======================================================
// CEK APAKAH WHATSAPP SUDAH PERNAH DIKIRIM
// ======================================================

const hasWhatsAppBeenSent = async ({
    billId,
    type
}) => {

    if (!billId) {

        throw new Error(
            "Bill ID wajib diisi"
        );

    }


    if (!type) {

        throw new Error(
            "WhatsApp type wajib diisi"
        );

    }


    const [rows] = await db.query(`

        SELECT
            id,
            bill_id,
            phone,
            type,
            status,
            sent_at

        FROM whatsapp_logs

        WHERE bill_id = ?

        AND type = ?

        AND status = 'sent'

        LIMIT 1

    `, [
        billId,
        type
    ]);


    return rows.length > 0;

};


// ======================================================
// SIMPAN LOG WHATSAPP
// ======================================================

const logWhatsAppMessage = async ({
    billId,
    phone,
    message,
    type,
    status = "sent"
}) => {

    if (!billId) {

        throw new Error(
            "Bill ID wajib diisi"
        );

    }


    if (!phone) {

        throw new Error(
            "Nomor WhatsApp wajib diisi"
        );

    }


    if (!message) {

        throw new Error(
            "Pesan WhatsApp wajib diisi"
        );

    }


    if (!type) {

        throw new Error(
            "WhatsApp type wajib diisi"
        );

    }


    const normalizedPhone =
        normalizePhone(phone);


    const [result] = await db.query(`

        INSERT INTO whatsapp_logs
        (
            bill_id,
            phone,
            message,
            type,
            status
        )

        VALUES
        (
            ?,
            ?,
            ?,
            ?,
            ?
        )

    `, [
        billId,
        normalizedPhone,
        message,
        type,
        status
    ]);


    return {

        success: true,

        id:
            result.insertId,

        billId,

        phone:
            normalizedPhone,

        message,

        type,

        status

    };

};


// ======================================================
// KIRIM PESAN WHATSAPP
// ======================================================

const sendWhatsAppMessage = async ({
    phone,
    message
}) => {

    try {

        // ==============================================
        // VALIDASI
        // ==============================================

        if (!phone) {

            throw new Error(
                "Nomor WhatsApp tidak tersedia"
            );

        }


        if (!message) {

            throw new Error(
                "Pesan WhatsApp tidak boleh kosong"
            );

        }


        // ==============================================
        // NORMALISASI NOMOR
        // ==============================================

        const normalizedPhone =
            normalizePhone(phone);


        // ==============================================
        // TEST MODE
        // ==============================================
        //
        // Jika WHATSAPP_TEST_MODE=true:
        //
        // - Tidak menghubungi Meta
        // - Tidak membutuhkan Access Token asli
        // - Tidak membutuhkan Phone Number ID asli
        // - Pesan hanya ditampilkan di terminal
        // - Tetap dianggap berhasil
        //
        // Ini digunakan untuk testing backend
        // sebelum WhatsApp Cloud API asli siap.
        // ==============================================

        if (WHATSAPP_TEST_MODE) {

            const testMessageId =
                `TEST-${Date.now()}`;


            console.log(
                ""
            );

            console.log(
                "===================================="
            );

            console.log(
                "WHATSAPP TEST MODE"
            );

            console.log(
                "===================================="
            );

            console.log(
                "Status:",
                "SIMULASI BERHASIL"
            );

            console.log(
                "To:",
                normalizedPhone
            );

            console.log(
                "Message ID:",
                testMessageId
            );

            console.log(
                "Message:"
            );

            console.log(
                message
            );

            console.log(
                "===================================="
            );

            console.log(
                "Tidak ada pesan asli yang dikirim."
            );

            console.log(
                "===================================="
            );


            return {

                success: true,

                testMode: true,

                phone:
                    normalizedPhone,

                message,

                messageId:
                    testMessageId,

                response: {

                    test: true,

                    messageId:
                        testMessageId

                }

            };

        }


        // ==============================================
        // VALIDASI KONFIGURASI WHATSAPP ASLI
        // ==============================================

        validateWhatsAppConfig();


        // ==============================================
        // URL WHATSAPP CLOUD API
        // ==============================================

        const url =
            `https://graph.facebook.com/` +
            `${WHATSAPP_API_VERSION}/` +
            `${WHATSAPP_PHONE_NUMBER_ID}/messages`;


        // ==============================================
        // REQUEST KE META
        // ==============================================

        const response =
            await fetch(
                url,
                {

                    method: "POST",

                    headers: {

                        "Authorization":
                            `Bearer ${WHATSAPP_ACCESS_TOKEN}`,

                        "Content-Type":
                            "application/json"

                    },

                    body: JSON.stringify({

                        messaging_product:
                            "whatsapp",

                        recipient_type:
                            "individual",

                        to:
                            normalizedPhone,

                        type:
                            "text",

                        text: {

                            preview_url:
                                false,

                            body:
                                message

                        }

                    })

                }
            );


        // ==============================================
        // AMBIL RESPONSE META
        // ==============================================

        const data =
            await response.json();


        // ==============================================
        // CEK ERROR
        // ==============================================

        if (!response.ok) {

            console.error(
                "WhatsApp API Error:",
                data
            );


            throw new Error(

                data?.error?.message ||
                "Gagal mengirim WhatsApp"

            );

        }


        // ==============================================
        // BERHASIL DIKIRIM
        // ==============================================

        console.log(
            "===================================="
        );

        console.log(
            "WHATSAPP BERHASIL DIKIRIM"
        );

        console.log(
            "To:",
            normalizedPhone
        );

        console.log(
            "Message ID:",
            data?.messages?.[0]?.id
        );

        console.log(
            "===================================="
        );


        return {

            success: true,

            testMode: false,

            phone:
                normalizedPhone,

            message,

            messageId:
                data?.messages?.[0]?.id || null,

            response:
                data

        };


    } catch (error) {

        console.error(
            "WhatsApp Service Error:",
            error.message
        );

        throw error;

    }

};


// ======================================================
// EXPORT
// ======================================================

module.exports = {

    sendWhatsAppMessage,

    normalizePhone,

    hasWhatsAppBeenSent,

    logWhatsAppMessage,

    validateWhatsAppConfig

};