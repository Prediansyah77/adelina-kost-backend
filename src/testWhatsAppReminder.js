const {
    runWhatsAppReminderJob
} = require("./jobs/whatsappReminderJob");


// =====================================================
// TEST WHATSAPP REMINDER JOB
// =====================================================

const testReminder = async () => {

    try {

        console.log("=================================");
        console.log("TEST WHATSAPP REMINDER JOB");
        console.log("=================================");


        const result =
            await runWhatsAppReminderJob();


        console.log("=================================");
        console.log("HASIL TEST:");
        console.log(result);
        console.log("=================================");


    } catch (error) {

        console.error(
            "TEST GAGAL:",
            error.message
        );

    }

};


// =====================================================
// JALANKAN TEST
// =====================================================

testReminder();
