// You will need firebase-admin installed in your Netlify functions package.json
const admin = require('firebase-admin');

// Initialize Firebase Admin (Only once per container cold start)
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        })
    });
}

const db = admin.firestore();

exports.handler = async (event, context) => {
    // 1. Meta / WhatsApp Webhook Verification (Only runs during initial setup)
    if (event.httpMethod === 'GET') {
        const verify_token = "OMNISCHOOL_SECURE_TOKEN"; // Set this in your WhatsApp dashboard
        const qs = event.queryStringParameters;
        if (qs['hub.mode'] === 'subscribe' && qs['hub.verify_token'] === verify_token) {
            return { statusCode: 200, body: qs['hub.challenge'] };
        }
        return { statusCode: 403, body: 'Forbidden' };
    }

    // 2. Handle Incoming Messages (POST)
    if (event.httpMethod === 'POST') {
        try {
            const body = JSON.parse(event.body);
            
            // Extract the incoming message and phone number (Format depends on your API provider)
            // This example uses the standard Meta WhatsApp Cloud API structure
            const messageObj = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
            
            if (!messageObj) return { statusCode: 200, body: 'Not a message event' };

            const senderPhone = messageObj.from; // e.g., "263771234567"
            const incomingText = messageObj.text?.body?.trim().toLowerCase() || "";

            let replyMessage = "";

            // ==========================================
            // IDENTITY ROUTER LOGIC
            // ==========================================

            // Step A: Check if sender is an Admin/Staff
            const staffQuery = await db.collection("staff").where("phone", "==", senderPhone).get();
            
            if (!staffQuery.empty) {
                // IT'S AN ADMIN!
                const adminData = staffQuery.docs[0].data();
                
                if (incomingText === "menu" || incomingText === "hi") {
                    replyMessage = `👑 *Welcome back, ${adminData.name}.*\n\nReply with a number:\n1. Total Enrolled Students\n2. View Arrears\n3. Today's Attendance`;
                } else if (incomingText === "1") {
                    // Quick DB query to count students
                    const studentsSnap = await db.collection("students").get();
                    replyMessage = `📊 *Campus Status*\nTotal Active Students: ${studentsSnap.size}`;
                } else {
                    replyMessage = "Invalid command. Reply 'Menu' to see options.";
                }

            } else {
                // Step B: If not an Admin, check if they are a Parent
                const parentQuery = await db.collection("students").where("parent_contact", "==", senderPhone).get();

                if (!parentQuery.empty) {
                    // IT'S A PARENT!
                    const studentData = parentQuery.docs[0].data();
                    
                    if (incomingText === "menu" || incomingText === "hi") {
                        replyMessage = `🏫 *Welcome to OmniSchool.*\nGuardian of: ${studentData.name}\n\nReply with a number:\n1. Check Fee Balance\n2. Check Recent Grades`;
                    } else if (incomingText === "1") {
                        // In a real app, query the transactions to calculate balance here
                        replyMessage = `💰 *Fee Status for ${studentData.name}*\nClass: ${studentData.class}\nStatus: Please contact Bursar for full statement.`;
                    } else {
                        replyMessage = "Invalid command. Reply 'Menu' to see options.";
                    }
                } else {
                    // Step C: Unknown Number (Guest)
                    replyMessage = "👋 *Welcome to OmniSchool.*\nYou are not registered in our system. Please contact the administration office for enrollment.";
                }
            }

            // ==========================================
            // SEND THE REPLY BACK VIA WHATSAPP API
            // ==========================================
            await sendWhatsAppMessage(senderPhone, replyMessage);

            return { statusCode: 200, body: 'Message processed' };

        } catch (error) {
            console.error("Webhook Error:", error);
            return { statusCode: 500, body: 'Internal Server Error' };
        }
    }
};

// Helper function to send the reply back
async function sendWhatsAppMessage(to, text) {
    const token = process.env.WHATSAPP_API_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;
    const url = `https://graph.facebook.com/v17.0/${phoneId}/messages`;

    const payload = {
        messaging_product: "whatsapp",
        to: to,
        type: "text",
        text: { body: text }
    };

    await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
}
