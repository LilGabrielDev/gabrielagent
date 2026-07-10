import { EventEmitter } from "node:events";
import { logger } from "./logger.js";
import { createSessionStore, validateSessionId } from "./session-store.js";
import { BaileysProvider } from "./providers/baileys.js";
import { WhatsAppWebProvider } from "./providers/whatsapp-web.js";
import type { SessionStatus, WhatsAppProvider, WhatsAppProviderEvent } from "./providers/base.js";

export type WhatsAppEngine = "whatsapp-web.js" | "baileys";

export interface SessionSnapshot {
  sessionId: string;
  phoneNumber: string | null;
  socketId: string | null;
  status: SessionStatus;
  qr: string | null;
  pairingCode: string | null;
  lastActivity: number;
  connectionState: SessionStatus;
  createdAt: number;
  updatedAt: number;
  engine: WhatsAppEngine;
}

interface ManagedSession {
  provider: WhatsAppProvider;
  engine: WhatsAppEngine;
  phoneNumber: string | null;
  socketId: string | null;
  status: SessionStatus;
  qr: string | null;
  pairingCode: string | null;
  lastActivity: number;
  connectionState: SessionStatus;
  createdAt: number;
  updatedAt: number;
}

export class WhatsAppSessionManager {
  private sessions = new Map<string, ManagedSession>();
  private store = createSessionStore();
  private events = new EventEmitter();

  constructor() {
    void this.initialize();
    setInterval(() => {
      void this.gc();
    }, 60_000);
  }

  async initialize() {
    await this.store.initialize();
  }

  onEvent(listener: (event: WhatsAppProviderEvent) => void) {
    this.events.on("session", listener);
    return () => this.events.off("session", listener);
  }

  async createSession(sessionId: string, engine: WhatsAppEngine = "baileys", phoneNumber?: string) {
    validateSessionId(sessionId);
    const existing = this.sessions.get(sessionId);
    if (existing) {
      if (phoneNumber) {
        existing.phoneNumber = phoneNumber.trim() || existing.phoneNumber;
        existing.updatedAt = Date.now();
        existing.lastActivity = Date.now();
      }
      return this.getSnapshot(sessionId);
    }

    const sessionPath = this.store.getSessionPath(sessionId);
    let provider: WhatsAppProvider;

    if (engine === "whatsapp-web.js") {
      provider = new WhatsAppWebProvider(sessionId, sessionPath);
    } else {
      provider = new BaileysProvider(sessionId, sessionPath);
    }

    const now = Date.now();
    const managed: ManagedSession = {
      provider,
      engine,
      phoneNumber: phoneNumber?.trim() || null,
      socketId: null,
      status: "initializing",
      qr: null,
      pairingCode: null,
      lastActivity: now,
      connectionState: "initializing",
      createdAt: now,
      updatedAt: now,
    };

    provider.on("event", (event: WhatsAppProviderEvent) => {
      this.handleProviderEvent(sessionId, event);
    });

    this.sessions.set(sessionId, managed);

    try {
      await provider.initialize();
      managed.status = provider.getStatus();
      managed.connectionState = provider.getStatus();
      managed.updatedAt = Date.now();
      managed.lastActivity = Date.now();
      if (phoneNumber) {
        managed.phoneNumber = phoneNumber.trim();
      }
    } catch (error) {
      managed.status = "failed";
      managed.connectionState = "failed";
      managed.updatedAt = Date.now();
      managed.lastActivity = Date.now();
      logger.error({ err: error, sessionId }, "Failed to initialize WhatsApp session");
      throw error;
    }

    return this.getSnapshot(sessionId);
  }

  async pair(sessionId: string, phoneNumber: string): Promise<string> {
    const current = this.sessions.get(sessionId);
    if (!current) {
      const created = await this.createSession(sessionId, "baileys", phoneNumber);
      return await this.pair(sessionId, phoneNumber);
    }

    const normalized = phoneNumber.trim();
    if (!normalized) {
      throw new Error("Phone number is required");
    }

    current.phoneNumber = normalized;
    current.lastActivity = Date.now();
    current.updatedAt = Date.now();
    return await current.provider.requestPairingCode(normalized);
  }

  async logout(sessionId: string) {
    const current = this.sessions.get(sessionId);
    if (current) {
      await current.provider.logout().catch((error) => {
        logger.error({ err: error, sessionId }, "Failed to logout provider cleanly");
      });
      this.sessions.delete(sessionId);
      await this.store.remove(sessionId).catch((error) => {
        logger.error({ err: error, sessionId }, "Failed to remove session store data");
      });
    }
    return { success: true };
  }

  attachSocket(sessionId: string, socketId: string) {
    const current = this.sessions.get(sessionId);
    if (!current) return;
    current.socketId = socketId;
    current.updatedAt = Date.now();
    current.lastActivity = Date.now();
  }

  detachSocket(sessionId: string, socketId: string) {
    const current = this.sessions.get(sessionId);
    if (!current || current.socketId !== socketId) return;
    current.socketId = null;
    current.updatedAt = Date.now();
    current.lastActivity = Date.now();
  }

  getStatus(sessionId: string) {
    return this.getSnapshot(sessionId)?.status ?? "disconnected";
  }

  getProvider(sessionId: string) {
    return this.sessions.get(sessionId)?.provider;
  }

  getQr(sessionId: string) {
    return this.getSnapshot(sessionId)?.qr ?? null;
  }

  getPairingCode(sessionId: string) {
    return this.getSnapshot(sessionId)?.pairingCode ?? null;
  }

  getPhoneNumber(sessionId: string) {
    return this.getSnapshot(sessionId)?.phoneNumber ?? null;
  }

  getSnapshot(sessionId: string): SessionSnapshot | null {
    const current = this.sessions.get(sessionId);
    if (!current) return null;

    return {
      sessionId,
      phoneNumber: current.phoneNumber,
      socketId: current.socketId,
      status: current.provider.getStatus(),
      qr: current.provider.getQr(),
      pairingCode: current.provider.getPairingCode(),
      lastActivity: current.lastActivity,
      connectionState: current.provider.getStatus(),
      createdAt: current.createdAt,
      updatedAt: current.updatedAt,
      engine: current.engine,
    };
  }

  private handleProviderEvent(sessionId: string, event: WhatsAppProviderEvent) {
    const current = this.sessions.get(sessionId);
    if (!current) return;

    current.status = event.status;
    current.connectionState = event.status;
    current.updatedAt = Date.now();
    current.lastActivity = Date.now();

    if (event.phoneNumber) {
      current.phoneNumber = event.phoneNumber;
    }

    if (event.event === "qr") {
      current.qr = event.qr ?? null;
    } else if (event.event === "pairing") {
      current.pairingCode = event.pairingCode ?? null;
    } else if (event.event === "authenticated" || event.event === "ready") {
      current.qr = null;
      current.pairingCode = null;
    } else if (event.event === "disconnected") {
      current.qr = null;
      current.pairingCode = null;
    }

    this.events.emit("session", event);
  }

  private async gc() {
    const now = Date.now();
    const staleIds = [...this.sessions.entries()]
      .filter(([, session]) => session.status === "disconnected" && now - session.updatedAt > 30 * 60_000)
      .map(([sessionId]) => sessionId);

    for (const sessionId of staleIds) {
      await this.logout(sessionId).catch((error) => {
        logger.error({ err: error, sessionId }, "Failed to cleanup stale session");
      });
    }
  }
}
