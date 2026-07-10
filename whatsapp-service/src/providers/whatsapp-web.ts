import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import { WhatsAppProvider, type SessionStatus } from "./base.js";
import QRCode from "qrcode";
import { logger } from "../logger.js";
import path from "node:path";

export class WhatsAppWebProvider extends WhatsAppProvider {
  private client: any;
  private status: SessionStatus = "initializing";
  private qr: string | null = null;
  private pairingCode: string | null = null;
  private phoneNumber: string | null = null;

  constructor(sessionId: string, private sessionPath: string) {
    super(sessionId);
  }

  async initialize(): Promise<void> {
    this.status = "initializing";
    this.emitEvent("status", {});

    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: this.sessionId,
        dataPath: this.sessionPath,
      }),
      puppeteer: {
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        handleSIGTERM: false,
      },
    });

    this.client.on("qr", async (qr: string) => {
      this.status = "waiting_qr";
      try {
        this.qr = await QRCode.toDataURL(qr);
        this.emitEvent("qr", { qr: this.qr });
      } catch (err) {
        logger.error({ err, sessionId: this.sessionId }, "Failed to generate QR DataURL");
      }
    });

    this.client.on("authenticated", () => {
      this.status = "authenticated";
      this.qr = null;
      this.pairingCode = null;
      this.emitEvent("authenticated", {});
    });

    this.client.on("ready", () => {
      this.status = "ready";
      this.emitEvent("ready", {});
    });

    this.client.on("disconnected", (reason: string) => {
      this.status = "disconnected";
      this.emitEvent("disconnected", { error: reason });
    });

    this.client.on("auth_failure", (msg: string) => {
      this.status = "failed";
      this.emitEvent("error", { error: msg });
    });

    try {
      await this.client.initialize();
    } catch (err: any) {
      this.status = "failed";
      this.emitEvent("error", { error: err.message });
      throw err;
    }
  }

  async requestPairingCode(phoneNumber: string): Promise<string> {
    this.status = "generating_pairing";
    this.phoneNumber = phoneNumber;
    this.emitEvent("status", { phoneNumber });
    
    try {
      const code = await this.client.requestPairingCode(phoneNumber);
      this.pairingCode = code;
      this.status = "waiting_qr"; // whatsapp-web.js uses the same flow but returns code
      this.emitEvent("pairing", { pairingCode: code });
      return code;
    } catch (err: any) {
      this.status = "failed";
      this.emitEvent("error", { error: err.message });
      throw err;
    }
  }

  async logout(): Promise<void> {
    if (this.client) {
      await this.client.logout();
      this.status = "disconnected";
      this.emitEvent("disconnected", {});
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.destroy();
      this.status = "disconnected";
      this.emitEvent("disconnected", {});
    }
  }

  getStatus(): SessionStatus {
    return this.status;
  }

  getQr(): string | null {
    return this.qr;
  }

  getPairingCode(): string | null {
    return this.pairingCode;
  }

  getPhoneNumber(): string | null {
    return this.phoneNumber;
  }
}
