import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys";
import { EventEmitter } from "node:events";
import { HttpError } from "./http-error.js";
import { logger } from "./logger.js";
import { createSessionStore, validateSessionId } from "./session-store.js";

type SessionStatus =
  | "idle"
  | "connecting"
  | "waiting"
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "logged_out"
  | "error";

export type HealthConnectionStatus = "disconnected" | "qr_pending" | "paired" | "ready";

interface SessionRecord {
  id: string;
  phoneNumber?: string;
  socket?: WASocket;
  status: SessionStatus;
  connected: boolean;
  pairingCode?: string;
  qr?: string;
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
  healthStatus: HealthConnectionStatus;
  phoneNumber: string | null;
  pairingCode: string | null;
  qr: string | null;
  lastError: string | null;
  updatedAt: string;
}

export type WhatsAppSessionEventName =
  | "loading"
  | "qr"
  | "pairing_code"
  | "authenticated"
  | "connected"
  | "ready"
  | "disconnected"
  | "error";

export interface WhatsAppSessionEvent {
  event: WhatsAppSessionEventName;
  sessionId: string;
  status: SessionStatus;
  healthStatus: HealthConnectionStatus;
  connected: boolean;
  qr: string | null;
  pairingCode: string | null;
  phoneNumber: string | null;
  error: string | null;
  updatedAt: string;
}

interface DisconnectErrorWithStatus {
  output?: {
    statusCode?: number;
  };
}

export class WhatsAppSessionManager {
  private sessions = new Map<string, SessionRecord>();
  private store = createSessionStore();
  private versionPromise = fetchLatestBaileysVersion();
  private events = new EventEmitter();

  onEvent(listener: (event: WhatsAppSessionEvent) => void) {
    this.events.on("session", listener);
    return () => this.events.off("session", listener);
  }

  async bootstrap() {
    await this.store.initialize();
    const sessionIds = await this.store.listSessionIds();
    await Promise.all(
      sessionIds
        .map((sessionId) => this.reconnect(sessionId).catch(async (error) => {
          logger.warn({ error, sessionId }, "Failed to restore WhatsApp session");
          await this.markCorrupt(sessionId, error);
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
    this.emitSessionEvent("pairing_code", session);

    return this.toPairResponse(session);
  }

  async startQr(sessionId: string) {
    const session = await this.connect(sessionId);

    if (session.connected) {
      return this.toPairResponse(session);
    }

    const qr = await this.waitForField(
      session,
      "qr",
      45000,
      "Timed out while waiting for WhatsApp QR code"
    );

    session.qr = qr;
    session.status = "waiting";
    session.updatedAt = new Date().toISOString();

    return this.toPairResponse(session);
  }

  async reconnect(sessionId: string) {
    const session = await this.connect(sessionId);
    return this.getStatus(session.id);
  }

  getStatus(sessionId: string): SessionStatusResponse {
    validateSessionId(sessionId);
    const session = this.sessions.get(sessionId);

    if (!session) {
      return {
        sessionId,
        connected: false,
        status: "disconnected",
        healthStatus: "disconnected",
        phoneNumber: null,
        pairingCode: null,
        qr: null,
        lastError: null,
        updatedAt: new Date().toISOString(),
      };
    }

    return {
      sessionId: session.id,
      connected: session.connected,
      status: session.status,
      healthStatus: this.toHealthStatus(session),
      phoneNumber: session.phoneNumber || null,
      pairingCode: session.pairingCode || null,
      qr: session.qr || null,
      lastError: session.lastError || null,
      updatedAt: session.updatedAt,
    };
  }

  listStatuses() {
    return Array.from(this.sessions.keys()).map((sessionId) => this.getStatus(sessionId));
  }

  async logout(sessionId: string) {
    validateSessionId(sessionId);
    const session = this.sessions.get(sessionId);

    if (session?.reconnectTimer) clearTimeout(session.reconnectTimer);

    try {
      await session?.socket?.logout();
    } catch (error) {
      logger.warn({ error, sessionId }, "Socket logout failed; removing local session anyway");
    }

    session?.socket?.end(undefined);
    this.sessions.delete(sessionId);
    await this.store.remove(sessionId);

    return {
      success: true,
      sessionId,
      status: "logged_out",
    };
  }

  private async connect(sessionId: string, phoneNumber?: string): Promise<SessionRecord> {
    validateSessionId(sessionId);

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
    this.emitSessionEvent("loading", session);

    const authDirectory = this.store.getSessionPath(sessionId);

    let authState: Awaited<ReturnType<typeof useMultiFileAuthState>>;
    try {
      authState = await useMultiFileAuthState(authDirectory);
    } catch (error) {
      await this.markCorrupt(sessionId, error);
      authState = await useMultiFileAuthState(authDirectory);
    }

    const { state, saveCreds } = authState;
    const { version } = await this.versionPromise;
    const socketLogger = logger.child({ sessionId, module: "baileys" });

    const socket = makeWASocket({
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
      defaultQueryTimeoutMs: 60000,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
      generateHighQualityLinkPreview: false,
    });

    session.socket = socket;

    socket.ev.on("creds.update", saveCreds);
    socket.ev.on("creds.update", () => {
      this.emitSessionEvent("authenticated", session);
    });
    socket.ev.on("connection.update", (update) => {
      const disconnectError = update.lastDisconnect?.error as DisconnectErrorWithStatus | undefined;
      const statusCode = disconnectError?.output?.statusCode;
      session.updatedAt = new Date().toISOString();

      if (update.connection === "open") {
        session.status = "connected";
        session.connected = true;
        session.pairingCode = undefined;
        session.qr = undefined;
        session.lastError = undefined;
        session.reconnectAttempts = 0;
        logger.info({ sessionId }, "WhatsApp session connected");
        this.emitSessionEvent("connected", session);
        this.emitSessionEvent("ready", session);
        return;
      }

      if (update.connection === "connecting") {
        session.status = session.status === "waiting" ? "waiting" : "connecting";
        session.connected = false;
        if (update.qr) {
          session.qr = update.qr;
          session.status = "waiting";
          this.emitSessionEvent("qr", session);
        } else {
          this.emitSessionEvent("loading", session);
        }
        return;
      }

      if (update.connection === "close") {
        session.connected = false;
        session.socket = undefined;
        session.lastError = update.lastDisconnect?.error?.message;

        if (statusCode === DisconnectReason.loggedOut) {
          session.status = "logged_out";
          session.pairingCode = undefined;
          session.qr = undefined;
          logger.warn({ sessionId }, "WhatsApp session logged out");
          this.emitSessionEvent("disconnected", session);
          this.store.remove(sessionId).catch((error) => {
            logger.warn({ error, sessionId }, "Failed to remove logged-out WhatsApp session");
          });
          return;
        }

        session.status = "reconnecting";
        this.emitSessionEvent("disconnected", session);
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
        this.emitSessionEvent("error", session);
        this.scheduleReconnect(session);
      });
    }, delay);
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
      qr: session.qr || null,
      status: session.connected ? "connected" : "waiting",
      healthStatus: this.toHealthStatus(session),
    };
  }

  private toHealthStatus(session: SessionRecord): HealthConnectionStatus {
    if (session.connected || session.status === "connected") return "ready";
    if (session.pairingCode) return "paired";
    if (session.status === "connecting" || session.status === "waiting" || session.qr) {
      return "qr_pending";
    }
    return "disconnected";
  }

  private async markCorrupt(sessionId: string, error: unknown) {
    logger.warn({ error, sessionId }, "Quarantining corrupted WhatsApp session");
    this.sessions.delete(sessionId);
    await this.store.quarantine(sessionId);
  }

  private emitSessionEvent(event: WhatsAppSessionEventName, session: SessionRecord) {
    this.events.emit("session", {
      event,
      sessionId: session.id,
      status: session.status,
      healthStatus: this.toHealthStatus(session),
      connected: session.connected,
      qr: session.qr || null,
      pairingCode: session.pairingCode || null,
      phoneNumber: session.phoneNumber || null,
      error: session.lastError || null,
      updatedAt: session.updatedAt,
    } satisfies WhatsAppSessionEvent);
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

  private waitForField(
    session: SessionRecord,
    field: "qr" | "pairingCode",
    timeoutMs: number,
    message: string
  ): Promise<string> {
    const existing = session[field];
    if (existing) return Promise.resolve(existing);

    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const interval = setInterval(() => {
        const value = session[field];
        if (value) {
          clearInterval(interval);
          resolve(value);
          return;
        }

        if (Date.now() - startedAt > timeoutMs) {
          clearInterval(interval);
          reject(new HttpError(504, message));
        }
      }, 250);
    });
  }
}
