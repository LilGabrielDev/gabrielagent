import { Client, LocalAuth, Message } from "whatsapp-web.js";
import * as qrcode from "qrcode";
import pino from "pino";
import {
  default as makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from "@whiskeysockets/baileys";
import { prisma } from "@/lib/prisma";
import { chat, createNewConversation } from "@/lib/ai/engine";
import { logger } from "@/lib/logger";
import { resolveCustomer } from "@/lib/customer-resolver";

let whatsappClient: Client | null = null;
let baileysSocket: any = null;
let currentQR: string | null = null;
let pairingCode: string | null = null;
let connectionStatus: "disconnected" | "qr_ready" | "pairing_ready" | "connecting" | "connected" | "error" = "disconnected";
let statusMessage = "";
let currentMode: "web" | "pairing" = "web";

export function getWhatsAppStatus() {
  return {
    status: connectionStatus,
    qr: currentQR,
    pairingCode,
    mode: currentMode,
    message: statusMessage,
  };
}

export async function initWhatsApp(mode: "web" | "pairing" = "web", phoneNumber?: string): Promise<void> {
  if (mode === "pairing") {
    return initWhatsAppPairing(phoneNumber);
  }
  return initWhatsAppWeb();
}

async function initWhatsAppWeb(): Promise<void> {
  if (whatsappClient) {
    logger.info("[WhatsApp] Web client already exists");
    return;
  }

  currentMode = "web";
  connectionStatus = "connecting";
  statusMessage = "Initializing WhatsApp client...";

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: ".wwebjs_auth" }),
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    },
  });

  client.on("qr", async (qr: string) => {
    logger.info("[WhatsApp] QR code received");
    currentQR = await qrcode.toDataURL(qr);
    connectionStatus = "qr_ready";
    statusMessage = "Scan the QR code with WhatsApp on your phone";
  });

  client.on("ready", async () => {
    logger.info("[WhatsApp] Client is ready");
    currentQR = null;
    connectionStatus = "connected";
    statusMessage = "Connected to WhatsApp";

    await prisma.channel.upsert({
      where: { type: "whatsapp" },
      update: { isActive: true, status: "connected" },
      create: { type: "whatsapp", isActive: true, status: "connected" },
    });
  });

  client.on("authenticated", () => {
    logger.info("[WhatsApp] Authenticated");
    connectionStatus = "connecting";
    statusMessage = "Authenticated, loading chats...";
  });

  client.on("auth_failure", (message: string) => {
    logger.error(`[WhatsApp] Auth failure: ${message}`);
    connectionStatus = "error";
    statusMessage = `Authentication failed: ${message}`;
  });

  client.on("disconnected", async (reason: string) => {
    logger.info(`[WhatsApp] Disconnected: ${reason}`);
    connectionStatus = "disconnected";
    statusMessage = `Disconnected: ${reason}`;
    whatsappClient = null;

    await prisma.channel.upsert({
      where: { type: "whatsapp" },
      update: { isActive: false, status: "disconnected" },
      create: { type: "whatsapp", isActive: false, status: "disconnected" },
    });
  });

  client.on("message", async (message: Message) => {
    try {
      if (message.fromMe) return;

      const contact = await message.getContact();
      const customerName = contact.pushname || contact.name || "Unknown";
      const customerContact = message.from;

      // Resolve customer identity across channels
      const customerId = await resolveCustomer("whatsapp", customerContact, customerName);

      // Find or create conversation
      let conversation = await prisma.conversation.findFirst({
        where: {
          channel: "whatsapp",
          status: { in: ["active", "escalated"] },
          OR: [
            { customerId },
            { customerContact },
          ],
        },
      });

      if (!conversation) {
        conversation = await createNewConversation(
          "whatsapp",
          customerName,
          customerContact,
          customerId
        );
      }

      let messageContent = message.body;

      // Handle media messages
      if (message.hasMedia) {
        const media = await message.downloadMedia();
        if (media) {
          const mediaType = media.mimetype.split("/")[0];
          messageContent = `[${mediaType} attachment: ${media.filename || "media"}] ${message.body || ""}`;

          if (mediaType === "audio") {
            messageContent = `[Voice message received] ${message.body || ""}`;
          }
        }
      }

      // Get AI response
      const aiResponse = await chat(conversation.id, messageContent);

      // Send response back via WhatsApp
      await message.reply(aiResponse);
    } catch (error) {
      logger.error("[WhatsApp] Failed to process message:", error);
    }
  });

  whatsappClient = client;
  await client.initialize();
}

async function initWhatsAppPairing(phoneNumber?: string): Promise<void> {
  if (baileysSocket) {
    logger.info("[WhatsApp] Pairing socket already exists");
    return;
  }

  if (!phoneNumber) {
    throw new Error("Phone number is required for pairing mode");
  }

  currentMode = "pairing";
  connectionStatus = "connecting";
  statusMessage = "Initializing WhatsApp pairing session...";
  pairingCode = null;
  currentQR = null;

  const { state, saveCreds } = await useMultiFileAuthState("./baileys-session");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    browser: ["Vercel", "Bot", "1.0.0"],
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
    },
    generateHighQualityLinkPreview: true,
    syncFullHistory: false,
    defaultQueryTimeoutMs: 60000,
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 10000,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update: any) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      logger.info("[WhatsApp] Pairing socket connected");
      pairingCode = null;
      connectionStatus = "connected";
      statusMessage = "Connected to WhatsApp";

      await prisma.channel.upsert({
        where: { type: "whatsapp" },
        update: { isActive: true, status: "connected" },
        create: { type: "whatsapp", isActive: true, status: "connected" },
      });
    }

    if (connection === "close") {
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      const reason = lastDisconnect?.error?.message || String(lastDisconnect?.error || "unknown");
      logger.info(`[WhatsApp] Pairing socket disconnected: ${reason}`);
      connectionStatus = "disconnected";
      statusMessage = `Disconnected: ${reason}`;
      baileysSocket = null;
      pairingCode = null;
      currentQR = null;

      await prisma.channel.upsert({
        where: { type: "whatsapp" },
        update: { isActive: false, status: "disconnected" },
        create: { type: "whatsapp", isActive: false, status: "disconnected" },
      });

      if (shouldReconnect) {
        await initWhatsAppPairing(phoneNumber);
      }
    }
  });

  try {
    const code = await sock.requestPairingCode(phoneNumber);
    pairingCode = code?.match(/.{1,4}/g)?.join("-") || String(code);
    connectionStatus = "pairing_ready";
    statusMessage = "Enter the pairing code in WhatsApp Linked Devices";
  } catch (error) {
    logger.error("[WhatsApp] Failed to request pairing code:", error);
    connectionStatus = "error";
    statusMessage = "Failed to generate pairing code";
  }

  baileysSocket = sock;
}

export async function disconnectWhatsApp(): Promise<void> {
  if (whatsappClient) {
    await whatsappClient.destroy();
    whatsappClient = null;
  }

  if (baileysSocket) {
    try {
      await baileysSocket.logout();
    } catch {}
    baileysSocket = null;
  }

  currentQR = null;
  pairingCode = null;
  connectionStatus = "disconnected";
  statusMessage = "Disconnected";
}

export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<boolean> {
  if (!whatsappClient || connectionStatus !== "connected") {
    return false;
  }

  const chatId = to.includes("@c.us") ? to : `${to}@c.us`;
  await whatsappClient.sendMessage(chatId, message);
  return true;
}
