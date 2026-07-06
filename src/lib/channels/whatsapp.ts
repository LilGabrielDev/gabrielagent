import type { Client, Message } from "whatsapp-web.js";
import { prisma } from "@/lib/prisma";
import { chat, createNewConversation } from "@/lib/ai/engine";
import { logger } from "@/lib/logger";
import { resolveCustomer } from "@/lib/customer-resolver";
import { extractPairingCode } from "@/lib/channels/pairing-code";

let whatsappClient: Client | null = null;
let currentQR: string | null = null;
let pairingCode: string | null = null;
let connectionStatus: "disconnected" | "qr_ready" | "pairing_ready" | "connecting" | "connected" | "error" = "disconnected";
let statusMessage = "";
let currentMode: "web" | "pairing" = "pairing";
let currentPairingPhoneNumber = "";

const PAIRING_CODE_ENDPOINT =
  process.env.WHATSAPP_PAIRING_CODE_ENDPOINT ||
  "https://knight-bot-paircode.onrender.com/code";

export function getWhatsAppStatus() {
  return {
    status: connectionStatus,
    qr: currentQR,
    pairingCode,
    mode: currentMode,
    message: statusMessage,
    phoneNumber: currentPairingPhoneNumber || null,
  };
}

export async function initWhatsApp(mode: "web" | "pairing" = "pairing", phoneNumber?: string): Promise<void> {
  if (mode === "pairing") {
    return initWhatsAppPairing(phoneNumber);
  }
  return initWhatsAppWeb();
}

function normalizePairingPhoneNumber(phoneNumber: string): string {
  return phoneNumber.replace(/[^0-9]/g, "");
}

function formatPairingCode(code: string): string {
  const normalized = String(code).replace(/[^a-zA-Z0-9]/g, "");
  if (normalized.length <= 8) {
    return normalized;
  }
  return normalized.match(/.{1,4}/g)?.join("-") || normalized;
}

async function requestPairingCodeFromLink(phoneNumber: string): Promise<string> {
  const url = new URL(PAIRING_CODE_ENDPOINT);
  url.searchParams.set("number", phoneNumber);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Pairing code service returned ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "";
    const rawBody = await response.text();
    let payload: unknown = rawBody;

    if (contentType.includes("application/json")) {
      try {
        payload = JSON.parse(rawBody);
      } catch {
        payload = rawBody;
      }
    }

    const extractedCode = extractPairingCode(payload);
    if (!extractedCode) {
      throw new Error("Pairing code service unavailable");
    }

    return formatPairingCode(extractedCode);
  } finally {
    clearTimeout(timeout);
  }
}

async function initWhatsAppWeb(): Promise<void> {
  if (whatsappClient) {
    logger.info("[WhatsApp] Web client already exists");
    return;
  }

  currentMode = "web";
  connectionStatus = "connecting";
  statusMessage = "Initializing WhatsApp client...";

  const [{ Client: WhatsAppClient, LocalAuth }, qrcode] = await Promise.all([
    import("whatsapp-web.js"),
    import("qrcode"),
  ]);

  const client = new WhatsAppClient({
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
  const normalizedPhoneNumber = phoneNumber ? normalizePairingPhoneNumber(phoneNumber) : "";

  if (!normalizedPhoneNumber) {
    throw new Error("Phone number is required for pairing mode");
  }

  currentMode = "pairing";
  connectionStatus = "connecting";
  statusMessage = "Initializing WhatsApp pairing session...";
  pairingCode = null;
  currentQR = null;
  currentPairingPhoneNumber = normalizedPhoneNumber;

  try {
    pairingCode = await requestPairingCodeFromLink(normalizedPhoneNumber);
    connectionStatus = "pairing_ready";
    statusMessage = "Enter the pairing code in WhatsApp Linked Devices";
    logger.info("[WhatsApp] Pairing code received from link service");

    await prisma.channel.upsert({
      where: { type: "whatsapp" },
      update: {
        isActive: false,
        status: "pairing_ready",
        config: {
          mode: "pairing",
          pairingPhoneNumber: normalizedPhoneNumber,
          pairingCodeEndpoint: PAIRING_CODE_ENDPOINT,
          sessionStorage: "remote-mongodb",
        },
      },
      create: {
        type: "whatsapp",
        isActive: false,
        status: "pairing_ready",
        config: {
          mode: "pairing",
          pairingPhoneNumber: normalizedPhoneNumber,
          pairingCodeEndpoint: PAIRING_CODE_ENDPOINT,
          sessionStorage: "remote-mongodb",
        },
      },
    });
  } catch (error) {
    logger.error("[WhatsApp] Failed to request pairing code from link service:", error);
    connectionStatus = "error";
    statusMessage =
      error instanceof Error ? error.message : "Failed to generate pairing code";
    pairingCode = null;

    await prisma.channel.upsert({
      where: { type: "whatsapp" },
      update: { isActive: false, status: "error" },
      create: { type: "whatsapp", isActive: false, status: "error" },
    });
  }
}

export async function disconnectWhatsApp(): Promise<void> {
  if (whatsappClient) {
    await whatsappClient.destroy();
    whatsappClient = null;
  }

  currentQR = null;
  pairingCode = null;
  currentPairingPhoneNumber = "";
  connectionStatus = "disconnected";
  statusMessage = "Disconnected";

  await prisma.channel.upsert({
    where: { type: "whatsapp" },
    update: { isActive: false, status: "disconnected" },
    create: { type: "whatsapp", isActive: false, status: "disconnected" },
  });
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
