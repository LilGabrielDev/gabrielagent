import { EventEmitter } from "node:events";

export type SessionStatus =
  | "initializing"
  | "connecting"
  | "generating_qr"
  | "waiting_qr"
  | "generating_pairing"
  | "authenticated"
  | "ready"
  | "disconnected"
  | "failed";

export interface WhatsAppProviderEvent {
  event: "qr" | "pairing" | "authenticated" | "ready" | "status" | "disconnected" | "error";
  sessionId: string;
  status: SessionStatus;
  qr?: string | null;
  pairingCode?: string | null;
  phoneNumber?: string | null;
  error?: string | null;
}

export abstract class WhatsAppProvider extends EventEmitter {
  constructor(public sessionId: string) {
    super();
  }

  abstract initialize(): Promise<void>;
  abstract requestPairingCode(phoneNumber: string): Promise<string>;
  abstract logout(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract getStatus(): SessionStatus;
  abstract getQr(): string | null;
  abstract getPairingCode(): string | null;
  abstract getPhoneNumber(): string | null;

  protected emitEvent(event: WhatsAppProviderEvent["event"], data: Partial<WhatsAppProviderEvent>) {
    this.emit("event", {
      event,
      sessionId: this.sessionId,
      status: this.getStatus(),
      ...data,
    } as WhatsAppProviderEvent);
  }
}
