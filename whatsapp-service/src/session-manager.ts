import { EventEmitter } from "node:events";
import { logger } from "./logger.js";
import { createSessionStore, validateSessionId } from "./session-store.js";
import { BaileysProvider } from "./providers/baileys.js";
import { WhatsAppWebProvider } from "./providers/whatsapp-web.js";
import type { WhatsAppProvider, WhatsAppProviderEvent } from "./providers/base.js";

export type WhatsAppEngine = "whatsapp-web.js" | "baileys";

export class WhatsAppSessionManager {
  private sessions = new Map<string, WhatsAppProvider>();
  private store = createSessionStore();
  private events = new EventEmitter();

  onEvent(listener: (event: WhatsAppProviderEvent) => void) {
    this.events.on("session", listener);
    return () => this.events.off("session", listener);
  }

  async createSession(sessionId: string, engine: WhatsAppEngine = "baileys") {
    validateSessionId(sessionId);
    const existing = this.sessions.get(sessionId);
    if (existing) return existing.getStatus();

    const sessionPath = this.store.getSessionPath(sessionId);
    let provider: WhatsAppProvider;

    if (engine === "whatsapp-web.js") {
      provider = new WhatsAppWebProvider(sessionId, sessionPath);
    } else {
      provider = new BaileysProvider(sessionId, sessionPath);
    }

    provider.on("event", (event: WhatsAppProviderEvent) => {
      this.events.emit("session", event);
    });

    await provider.initialize();
    this.sessions.set(sessionId, provider);
    return provider.getStatus();
  }

  async pair(sessionId: string, phoneNumber: string) {
    const provider = this.sessions.get(sessionId);
    if (!provider) throw new Error("Session not found");
    return await provider.requestPairingCode(phoneNumber);
  }

  async logout(sessionId: string) {
    const provider = this.sessions.get(sessionId);
    if (provider) {
      await provider.logout();
      this.sessions.delete(sessionId);
      await this.store.remove(sessionId);
    }
    return { success: true };
  }

  getStatus(sessionId: string) {
    const provider = this.sessions.get(sessionId);
    return provider ? provider.getStatus() : "disconnected";
  }

  getProvider(sessionId: string) {
    return this.sessions.get(sessionId);
  }
}
