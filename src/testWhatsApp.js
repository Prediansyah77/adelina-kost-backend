const {
    sendWhatsAppMessage
} = require("./services/whatsappService");

const testWhatsApp = async () => {

    try {

        const result = await sendWhatsAppMessage({

            phone: "081234567890",

            message: "Halo, ini testing WhatsApp ADELINA KOST 🚀"

        });

        console.log("HASIL:", result);

    } catch (error) {

        console.error(
            "TEST GAGAL:",
            error.message
        );

    }

};

testWhatsApp();