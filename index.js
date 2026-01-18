import makeWASocket, {
  useMultiFileAuthState
} from "@whiskeysockets/baileys";
import OpenAI from "openai";

// ================= CONFIG =================
const OWNER_NUMBER = "6287847657259@s.whatsapp.net"; // GANTI
let BOT_MODE = "public"; // public | private

const COOLDOWN_TIME = 15 * 1000; // 15 detik
const REPLY_DELAY = 2000; // 2 detik
const MAX_MEMORY = 10; // max chat per user
// =========================================

const openai = new OpenAI({
  apiKey: "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"
});

const userCooldown = new Map();
const userMemory = new Map(); // 🧠 memory per user

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./session");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    if (update.connection === "open") {
      console.log("🤖 BOT AKTIF | MODE:", BOT_MODE);
    }
    if (update.connection === "close") {
      startBot();
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const jid = msg.key.remoteJid;

    // 🚫 Abaikan grup
    if (jid.endsWith("@g.us")) return;

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text;

    if (!text) return;

    const isOwner = jid === OWNER_NUMBER;

    // ===== OWNER COMMAND =====
    if (isOwner) {
      if (text === ".public") {
        BOT_MODE = "public";
        return sock.sendMessage(jid, { text: "✅ MODE PUBLIC" });
      }
      if (text === ".private") {
        BOT_MODE = "private";
        return sock.sendMessage(jid, { text: "🔒 MODE PRIVATE" });
      }
      if (text === ".reset") {
        userMemory.clear();
        return sock.sendMessage(jid, { text: "♻️ MEMORY RESET" });
      }
    }

    if (BOT_MODE === "private" && !isOwner) return;

    // ❄️ Cooldown
    const now = Date.now();
    const last = userCooldown.get(jid) || 0;
    if (now - last < COOLDOWN_TIME) return;
    userCooldown.set(jid, now);

    // 🧠 Ambil memory user
    if (!userMemory.has(jid)) {
      userMemory.set(jid, []);
    }

    const memory = userMemory.get(jid);

    memory.push({ role: "user", content: text });

    if (memory.length > MAX_MEMORY) {
      memory.splice(0, memory.length - MAX_MEMORY);
    }

    await new Promise(r => setTimeout(r, REPLY_DELAY));

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Kamu adalah AI WhatsApp berbahasa Indonesia, ramah, singkat, dan membantu."
          },
          ...memory
        ]
      });

      const reply = response.choices[0].message.content;

      memory.push({ role: "assistant", content: reply });

      await sock.sendMessage(jid, { text: reply });

    } catch (err) {
      await sock.sendMessage(jid, {
        text: "❌ AI sedang error."
      });
    }
  });
}

startBot();
        
