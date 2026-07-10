import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys";
import { WhatsAppProvider, type SessionStatus } from "./base.js";
import QRCode from "qrcode";
import { logger } from "../logger.js";

export class BaileysProvider extends WhatsAppProvider {
  private socket?: WASocket;
  private status: SessionStatus = "initializing";
  private qr: string | null = null;
  private pairingCode: string | null = null;
  private phoneNumber: string | null = null;
  private versionPromise = fetchLatestBaileysVersion();

  constructor(sessionId: string, private sessionPath: string) {
    super(sessionId);
  }

  async initialize(): Promise<void> {
    this.status = "initializing";
    this.emitEvent("status", {});

    const { state, saveCreds } = await useMultiFileAuthState(this.sessionPath);
    const { version } = await this.versionPromise;
    const socketLogger = logger.child({ sessionId: this.sessionId, module: "baileys" });

    this.socket = makeWASocket({
      version,
      logger: socketLogger,
      printQRInTerminal: false,
      browser: ["Gabriel", "Chrome", "1.0.0"],
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, socketLogger),
      },
      syncFullHistory: false,
      markOnlineOnConnect: true,
    });

    this.socket.ev.on("creds.update", saveCreds);

    this.socket.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.status = "waiting_qr";
        try {
          this.qr = await QRCode.toDataURL(qr);
          this.emitEvent("qr", { qr: this.qr });
        } catch (err) {
          logger.error({ err, sessionId: this.sessionId }, "Failed to generate QR DataURL");
        }
      }

      if (connection === "open") {
        this.status = "ready";
        this.qr = null;
        this.pairingCode = null;
        this.emitEvent("ready", {});
      }

      if (connection === "close") {
        const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
        this.status = "disconnected";
        this.emitEvent("disconnected", { error: lastDisconnect?.error?.message });
        
        if (shouldReconnect) {
          this.initialize(); // Simple auto-reconnect
        }
      }
    });
  }

  async requestPairingCode(phoneNumber: string): Promise<string> {
    if (!this.socket) throw new Error("Socket not initialized");
    
    this.status = "generating_pairing";
    this.phoneNumber = phoneNumber;
    this.emitEvent("status", { phoneNumber });

    try {
      const code = await this.socket.requestPairingCode(phoneNumber);
      this.pairingCode = this.formatPairingCode(code);
      this.status = "waiting_qr";
      this.emitEvent("pairing", { pairingCode: this.pairingCode });
      return this.pairingCode;
    } catch (err: any) {
      this.status = "failed";
      this.emitEvent("error", { error: err.message });
      throw err;
    }
  }

  private formatPairingCode(code: string) {
    const normalized = String(code).replace(/[^a-zA-Z0-9]/g, "");
    if (normalized.length <= 8) return normalized;
    return normalized.match(/.{1,4}/g)?.join("-") || normalized;
  }

  async logout(): Promise<void> {
    if (this.socket) {
      await this.socket.logout();
      this.status = "disconnected";
      this.emitEvent("disconnected", {});
    }
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.end(undefined);
      this.status = "disconnected";
      this.emitEvent("disconnected", {});
    }
  }

  getStatus(): SessionStatus {
    return this.status;
  }
}
