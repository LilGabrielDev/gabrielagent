import { getBackendUrl } from "@/lib/api";

export type BackendSocketEventName =
  | "loading"
  | "qr"
  | "pairing_code"
  | "authenticated"
  | "connected"
  | "ready"
  | "disconnected"
  | "error";

export interface BackendSocketEvent {
  event: BackendSocketEventName;
  sessionId: string;
  status?: string;
  healthStatus?: string;
  connected?: boolean;
  qr?: string | null;
  pairingCode?: string | null;
  phoneNumber?: string | null;
  error?: string | null;
  updatedAt?: string;
}

export interface BackendSocket {
  close(): void;
}

export function connectBackendSocket(
  onEvent: (event: BackendSocketEvent) => void,
  onConnectionChange?: (connected: boolean) => void
): BackendSocket {
  let closed = false;
  let socket: WebSocket | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let retryMs = 1000;

  const connect = () => {
    if (closed) return;

    const url = new URL(getBackendUrl());
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = "/ws";
    url.search = "";

    socket = new WebSocket(url);
    socket.addEventListener("open", () => {
      retryMs = 1000;
      onConnectionChange?.(true);
    });
    socket.addEventListener("message", (message) => {
      try {
        onEvent(JSON.parse(message.data));
      } catch {
        onEvent({
          event: "error",
          sessionId: "default",
          error: "Received an invalid realtime message",
        });
      }
    });
    socket.addEventListener("close", () => {
      onConnectionChange?.(false);
      if (closed) return;
      retry = setTimeout(connect, retryMs);
      retryMs = Math.min(retryMs * 2, 10000);
    });
    socket.addEventListener("error", () => {
      onConnectionChange?.(false);
    });
  };

  connect();

  return {
    close() {
      closed = true;
      if (retry) clearTimeout(retry);
      socket?.close();
    },
  };
}
