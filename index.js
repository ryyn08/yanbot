const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore 
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const { Boom } = require("@hapi/boom");
const express = require("express");
const readline = require("readline");

const app = express();
app.use(express.json());
app.use(express.static('public')); // Melayani file HTML

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

let socket;
const OWNER_TARGET = "6285883881264@s.whatsapp.net";
const TOKEN_AUTH = "ryn";

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState("./session");
    const { version } = await fetchLatestBaileysVersion();

    socket = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        browser: ["Ubuntu", "Chrome", "20.0.04"],
    });

    // Fitur Pairing Code
    if (!socket.authState.creds.registered) {
        const phoneNumber = await question("Masukkan Nomor WhatsApp Bot (contoh: 6283119396819): ");
        setTimeout(async () => {
            let code = await socket.requestPairingCode(phoneNumber);
            console.log(`\n╭────────────────╼\n╎ Kode Pairing Anda: ${code}\n╰────────────────╼\n`);
        }, 3000);
    }

    socket.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === "open") {
            console.log("✅ Bot WhatsApp Terhubung!");
        }
    });

    socket.ev.on("creds.update", saveCreds);
}

// API Endpoint untuk menerima data dari HTML
app.post("/send-notif", async (req, res) => {
    const { token, link, emoji, waktu } = req.body;

    if (token !== TOKEN_AUTH) {
        return res.status(403).json({ status: "error", message: "Token Salah!" });
    }

    const pesan = `𝐇𝐈 𝐀𝐃𝐌𝐈𝐍 𝐓𝐇𝐄𝐑𝐄'𝐒 𝐍𝐄𝐖 𝐂𝐇 𝐃𝐀𝐓𝐀 𝐇𝐄𝐑𝐄🪀\n\nʟɪɴᴋ ᴄʜ : ${link}\nʀᴇᴀᴄᴛ ᴇᴍᴏᴊɪ : ${emoji}\nᴋᴇᴍʙᴀʟɪ ᴀᴋᴛɪꜰ : 10 Menit\nᴡᴀᴋᴛᴜ : ${waktu}`;

    try {
        await socket.sendMessage(OWNER_TARGET, { text: pesan });
        res.json({ status: "success" });
    } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server berjalan di port ${PORT}`);
    connectToWhatsApp();
});
