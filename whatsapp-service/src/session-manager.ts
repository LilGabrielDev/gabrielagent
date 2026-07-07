import fs from "node:fs/promises";
import path from "node:path";
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys";
import { config } from "./config.js";
import { HttpError } from "./http-error.js";
import { logger } from "./logger.js";

type SessionStatus =
  | "idle"
  | "connecting"
  | "waiting"
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "logged_out"
  | "error";

interface SessionRecord {
  id: string;
  phoneNumber?: string;
  socket?: WASocket;
  status: SessionStatus;
  connected: boolean;
  pairingCode?: string;
  lastError?: string;
  reconnectTimer?: NodeJS.Timeout;
  reconnectAttempts: number;
  createdAt: string;
  updatedAt: string;
}

export interface SessionStatusResponse {
  sessionId: string;
  connected: boolean;
  status: SessionStatus;
  phoneNumber: string | null;
  pairingCode: string | null;
  lastError: string | null;
  updatedAt: string;
}

const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/;

export class WhatsAppSessionManager {
  private sessions = new Map<string, SessionRecord>();
  private versionPromise = fetchLatestBaileysVersion();

  async bootstrap() {
    await fs.mkdir(config.sessionPath, { recursive: true });
    const entries = await fs.readdir(config.sessionPath, { withFileTypes: true });
    await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && SESSION_ID_PATTERN.test(entry.name))
        .map((entry) => this.reconnect(entry.name).catch((error) => {
          logger.warn({ error, sessionId: entry.name }, "Failed to restore WhatsApp session");
        }))
    );
  }

  async pair(sessionId: string, phoneNumber: string) {
    const normalizedPhone = phoneNumber.replace(/[^0-9]/g, "");
    if (normalizedPhone.length < 10) {
      throw new HttpError(400, "A valid phoneNumber is required");
    }

    const session = await this.connect(sessionId, normalizedPhone);

    if (session.connected) {
      return this.toPairResponse(session);
    }

    if (!session.socket) {
      throw new HttpError(500, "WhatsApp socket was not initialized");
    }

    const code = await this.withTimeout(
      session.socket.requestPairingCode(normalizedPhone),
      30000,
      "Timed out while requesting WhatsApp pairing code"
    );

    session.phoneNumber = normalizedPhone;
    session.pairingCode = this.formatPairingCode(code);
    session.status = "waiting";
    session.updatedAt = new Date().toISOString();

    return this.toPairResponse(session);
  }

  async reconnect(sessionId: string) {
    const session = await this.connect(sessionId);
    return this.getStatus(session.id);
  }

  getStatus(sessionId: string): SessionStatusResponse {
    this.validateSessionId(sessionId);
    const session = this.sessions.get(sessionId);

    if (!session) {
      return {
        sessionId,
        connected: false,
        status: "disconnected",
        phoneNumber: null,
        pairingCode: null,
        lastError: null,
        updatedAt: new Date().toISOString(),
      };
    }

    return {
      sessionId: session.id,
      connected: session.connected,
      status: session.status,
      phoneNumber: session.phoneNumber || null,
      pairingCode: session.pairingCode || null,
      lastError: session.lastError || null,
      updatedAt: session.updatedAt,
    };
  }

  listStatuses() {
    return Array.from(this.sessions.keys()).map((sessionId) => this.getStatus(sessionId));
  }

  async logout(sessionId: string) {
    this.validateSessionId(sessionId);
    const session = this.sessions.get(sessionId);

    if (session?.reconnectTimer) clearTimeout(session.reconnectTimer);

    try {
      await session?.socket?.logout();
    } catch (error) {
      logger.warn({ error, sessionId }, "Socket logout failed; removing local session anyway");
    }

    session?.socket?.end(undefined);
    this.sessions.delete(sessionId);
    await this.removeSessionDirectory(sessionId);

    return {
      success: true,
      sessionId,
      status: "logged_out",
    };
  }

  private async connect(sessionId: string, phoneNumber?: string): Promise<SessionRecord> {
    this.validateSessionId(sessionId);

    const existing = this.sessions.get(sessionId);
    if (existing?.socket && ["connecting", "waiting", "connected"].includes(existing.status)) {
      if (phoneNumber) existing.phoneNumber = phoneNumber;
      return existing;
    }

    const now = new Date().toISOString();
    const session: SessionRecord =
      existing ||
      {
        id: sessionId,
        status: "idle",
        connected: false,
        reconnectAttempts: 0,
        createdAt: now,
        updatedAt: now,
      };

    session.status = "connecting";
    session.lastError = undefined;
    session.phoneNumber = phoneNumber || session.phoneNumber;
    session.updatedAt = now;
    this.sessions.set(sessionId, session);

    const authDirectory = this.getSessionDirectory(sessionId);
    await fs.mkdir(authDirectory, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(authDirectory);
    const { version } = await this.versionPromise;
    const socketLogger = logger.child({ sessionId, module: "baileys" });

    const socket = makeWASocket({
      version,
      logger: socketLogger,
      printQRInTerminal: false,
      browser: ["Owly", "Chrome", "1.0.0"],
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, socketLogger),
      },
      syncFullHistory: false,
      markOnlineOnConnect: true,
      defaultQueryTimeoutMs: 60000,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
      generateHighQualityLinkPreview: false,
    });

    session.socket = socket;

    socket.ev.on("creds.update", saveCreds);
    socket.ev.on("connection.update", (update) => {
      const statusCode = (update.lastDisconnect?.error as any)?.output?.statusCode;
      session.updatedAt = new Date().toISOString();

      if (update.connection === "open") {
        session.status = "connected";
        session.connected = true;
        session.pairingCode = undefined;
        session.lastError = undefined;
        session.reconnectAttempts = 0;
        logger.info({ sessionId }, "WhatsApp session connected");
        return;
      }

      if (update.connection === "connecting") {
        session.status = session.status === "waiting" ? "waiting" : "connecting";
        session.connected = false;
        return;
      }

      if (update.connection === "close") {
        session.connected = false;
        session.socket = undefined;
        session.lastError = update.lastDisconnect?.error?.message;

        if (statusCode === DisconnectReason.loggedOut) {
          session.status = "logged_out";
          logger.warn({ sessionId }, "WhatsApp session logged out");
          return;
        }

        session.status = "reconnecting";
        this.scheduleReconnect(session);
      }
    });

    return session;
  }

  private scheduleReconnect(session: SessionRecord) {
    if (session.reconnectTimer) clearTimeout(session.reconnectTimer);

    const delay = Math.min(30000, 1000 * 2 ** session.reconnectAttempts);
    session.reconnectAttempts += 1;
    session.reconnectTimer = setTimeout(() => {
      this.connect(session.id, session.phoneNumber).catch((error) => {
        session.status = "error";
        session.lastError = error instanceof Error ? error.message : String(error);
        session.updatedAt = new Date().toISOString();
        logger.error({ error, sessionId: session.id }, "WhatsApp reconnect failed");
        this.scheduleReconnect(session);
      });
    }, delay);
  }

  private validateSessionId(sessionId: string) {
    if (!SESSION_ID_PATTERN.test(sessionId)) {
      throw new HttpError(400, "sessionId may only contain letters, numbers, dashes, and underscores");
    }
  }

  private getSessionDirectory(sessionId: string) {
    const directory = path.resolve(config.sessionPath, sessionId);
    const root = path.resolve(config.sessionPath);
    if (!directory.startsWith(root)) {
      throw new HttpError(400, "Invalid sessionId");
    }
    return directory;
  }

  private async removeSessionDirectory(sessionId: string) {
    const directory = this.getSessionDirectory(sessionId);
    await fs.rm(directory, { recursive: true, force: true });
  }

  private formatPairingCode(code: string) {
    const normalized = String(code).replace(/[^a-zA-Z0-9]/g, "");
    if (normalized.length <= 8) return normalized;
    return normalized.match(/.{1,4}/g)?.join("-") || normalized;
  }

  private toPairResponse(session: SessionRecord) {
    return {
      success: true,
      sessionId: session.id,
      pairingCode: session.pairingCode || null,
      status: session.connected ? "connected" : "waiting",
    };
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
    let timeout: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timeout = setTimeout(() => reject(new HttpError(504, message)), timeoutMs);
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
}
