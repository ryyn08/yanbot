const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion, 
    makeInMemoryStore 
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const { Boom } = require("@hapi/boom");
const express = require("express");
const bodyParser = require("body-parser");
const readline = require("readline");
const path = require("path");

const app = express();
app.use(bodyParser.json());
app.use(express.static(__dirname)); // Supaya bisa buka index.html

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

// --- KONFIGURASI NOMOR ---
const botNomor = "6283119396819"; // Nomor yang jadi Bot
const ownerTujuan = "6285883881264@s.whatsapp.net"; // Nomor yang akan menerima laporan

let sock;

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("./session");
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    // --- LOGIKA PAIRING CODE ---
    if (!sock.authState.creds.registered) {
        console.log("Menunggu input nomor telepon untuk Pairing...");
        const phoneNumber = botNomor; // Otomatis pake nomor yang kamu kasih
        setTimeout(async () => {
            let code = await sock.requestPairingCode(phoneNumber);
            console.log(`\n╭────────────────────────────╼`);
            console.log(`╎ YOUR PAIRING CODE : ${code}`);
            console.log(`╰────────────────────────────╼\n`);
        }, 3000);
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            let shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === "open") {
            console.log("✅ BOT BERHASIL TERHUBUNG!");
        }
    });
}

// --- API UNTUK TERIMA DATA DARI WEBSITE ---
app.post("/send-data", async (req, res) => {
    const { url, react } = req.body;
    
    if (!sock) return res.status(500).send("Bot belum siap");

    const waktu = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
    
    // Format teks sesuai permintaanmu
    const teksLaporan = `𝐇𝐈 𝐀𝐃𝐌𝐈𝐍 𝐓𝐇𝐄𝐑𝐄'𝐒 𝐍𝐄𝐖 𝐂𝐇 𝐃𝐀𝐓𝐀 𝐇𝐄𝐑𝐄🪀

ʟɪɴᴋ ᴄʜ : ${url}
ʀᴇᴀᴄᴛ ᴇᴍᴏᴊɪ : ${react}
ᴋᴇᴍʙᴀʟɪ ᴀᴋᴛɪꜰ : Ya
ᴡᴀᴋᴛᴜ : ${waktu}`;

    try {
        await sock.sendMessage(ownerTujuan, { text: teksLaporan });
        res.status(200).send("Terkirim");
    } catch (err) {
        console.error("Gagal kirim:", err);
        res.status(500).send("Error");
    }
});

// Jalankan Server Web dan Bot
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server jalan di http://localhost:${PORT}`);
    startBot();
});
