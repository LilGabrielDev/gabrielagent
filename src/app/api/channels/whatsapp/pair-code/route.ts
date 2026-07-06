import { NextResponse } from "next/server";
import {
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState as createMultiFileAuthState,
  default as makeWASocket,
} from "@whiskeysockets/baileys";
import pino from "pino";
import { logger } from "@/lib/logger";
import { extractPairingCode } from "@/lib/channels/pairing-code";
import {
  initializeMongoSession,
  savePairingSession,
} from "@/lib/channels/mongodb-session";

/**
 * Dedicated endpoint for generating WhatsApp pairing codes
 * Mimics the knight-bot-paircode service pattern
 * Can be called from frontend or Vercel to get pairing codes
 */
export async function GET(request: Request) {
  try {
    // Initialize MongoDB session storage (non-blocking, handles failures gracefully)
    try {
      await initializeMongoSession();
    } catch (mongoError) {
      logger.warn("[Pairing Code] MongoDB initialization failed, continuing without session storage:", mongoError);
    }

    const { searchParams } = new URL(request.url);
    const phoneNumber = searchParams.get("number");

    if (!phoneNumber) {
      return NextResponse.json(
        { error: "Phone number is required", code: "MISSING_PHONE" },
        { status: 400 }
      );
    }

    // Normalize phone number
    const normalizedPhone = phoneNumber.replace(/[^0-9]/g, "");
    if (!normalizedPhone || normalizedPhone.length < 10) {
      return NextResponse.json(
        { error: "Invalid phone number format", code: "INVALID_PHONE" },
        { status: 400 }
      );
    }

    logger.info(`[Pairing Code] Requesting code for phone: ${normalizedPhone}`);

    // Generate pairing code using Baileys
    const pairingCode = await generatePairingCodeWithBaileys(normalizedPhone);

    if (!pairingCode) {
      return NextResponse.json(
        { error: "Failed to generate pairing code", code: "GENERATION_FAILED" },
        { status: 500 }
      );
    }

    // Try to save to MongoDB, but don't fail if it's not available
    try {
      await savePairingSession(normalizedPhone, pairingCode, {
        requestedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
      });
    } catch (mongoError) {
      logger.warn("[Pairing Code] Failed to save session to MongoDB:", mongoError);
    }

    logger.info(`[Pairing Code] Generated and saved code for ${normalizedPhone}`);

    return NextResponse.json(
      {
        code: pairingCode,
        phone: normalizedPhone,
        timestamp: new Date().toISOString(),
        expiresIn: 300, // 5 minutes
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("[Pairing Code] Error:", error);

    return NextResponse.json(
      { error: message, code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * Generate pairing code using Baileys library
 * Creates a temporary socket to request the pairing code
 */
async function generatePairingCodeWithBaileys(
  phoneNumber: string
): Promise<string | null> {
  let sock: any = null;

  try {
    const { state } = await createMultiFileAuthState("./baileys-session-temp");
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      browser: ["Vercel", "Bot", "1.0.0"],
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(
          state.keys,
          pino({ level: "fatal" }).child({ level: "fatal" })
        ),
      },
      generateHighQualityLinkPreview: false,
      syncFullHistory: false,
      defaultQueryTimeoutMs: 30000,
      connectTimeoutMs: 30000,
      keepAliveIntervalMs: 10000,
    });

    // Request pairing code with timeout
    const codePromise = sock.requestPairingCode(phoneNumber);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Pairing code request timeout")),
        25000
      )
    );

    const code = await Promise.race([codePromise, timeoutPromise]);
    const formatted = formatPairingCode(String(code));

    logger.info(`[Baileys] Got code for ${phoneNumber}: ${formatted}`);

    return formatted;
  } catch (error) {
    logger.error("[Baileys] Failed to generate code:", error);
    return null;
  } finally {
    // Cleanup socket
    if (sock) {
      try {
        await sock.logout();
      } catch {}
    }
  }
}

function formatPairingCode(code: string): string {
  const normalized = String(code).replace(/[^a-zA-Z0-9]/g, "");
  if (normalized.length <= 8) {
    return normalized;
  }
  return normalized.match(/.{1,4}/g)?.join("-") || normalized;
}
