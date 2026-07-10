import { EventEmitter } from "node:events";
import { logger } from "./logger.js";
import { createSessionStore, validateSessionId } from "./session-store.js";
import { BaileysProvider } from "./providers/baileys.js";
import { WhatsAppWebProvider } from "./providers/whatsapp-web.js";
import type { WhatsAppProvider, WhatsAppProviderEvent } from "./providers/base.js";

export type WhatsAppEngine = "whatsapp-web.js" | "baileys";

export class WhatsAppSessionManager {
  private sessions = new Map<string, { provider: WhatsAppProvider; lastUpdated: number; engine: WhatsAppEngine }>();
  private store = createSessionStore();
  private events = new EventEmitter();

  onEvent(listener: (event: WhatsAppProviderEvent) => void) {
    this.events.on("session", listener);
    return () => this.events.off("session", listener);
  }

  async createSession(sessionId: string, engine: WhatsAppEngine = "baileys", phoneNumber?: string) {
    validateSessionId(sessionId);
    const existing = this.sessions.get(sessionId);
    if (existing) {
      return existing.provider.getStatus();
    }

    const sessionPath = this.store.getSessionPath(sessionId);
    let provider: WhatsAppProvider;

    if (engine === "whatsapp-web.js") {
      provider = new WhatsAppWebProvider(sessionId, sessionPath);
    } else {
      provider = new BaileysProvider(sessionId, sessionPath);
    }

    provider.on("event", (event: WhatsAppProviderEvent) => {
      this.events.emit("session", event);
      const current = this.sessions.get(sessionId);
      if (current) {
        current.lastUpdated = Date.now();
      }
    });

    await provider.initialize();
    if (phoneNumber) {
      const normalized = phoneNumber.trim();
      if (normalized) {
        provider.emit("event", {
          event: "status",
          sessionId,
          status: provider.getStatus(),
          phoneNumber: normalized,
        } as WhatsAppProviderEvent);
      }
    }

    this.sessions.set(sessionId, { provider, lastUpdated: Date.now(), engine });
    return provider.getStatus();
  }

  async pair(sessionId: string, phoneNumber: string) {
    const current = this.sessions.get(sessionId);
    if (!current) throw new Error("Session not found");
    return await current.provider.requestPairingCode(phoneNumber);
  }

  async logout(sessionId: string) {
    const current = this.sessions.get(sessionId);
    if (current) {
      await current.provider.logout();
      this.sessions.delete(sessionId);
      await this.store.remove(sessionId);
    }
    return { success: true };
  }

  getStatus(sessionId: string) {
    const current = this.sessions.get(sessionId);
    return current ? current.provider.getStatus() : "disconnected";
  }

  getProvider(sessionId: string) {
    return this.sessions.get(sessionId)?.provider;
  }

  getQr(sessionId: string) {
    return this.sessions.get(sessionId)?.provider.getQr() ?? null;
  }

  getPairingCode(sessionId: string) {
    return this.sessions.get(sessionId)?.provider.getPairingCode() ?? null;
  }

  getPhoneNumber(sessionId: string) {
    return this.sessions.get(sessionId)?.provider.getPhoneNumber() ?? null;
  }
}
