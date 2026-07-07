import { logger } from "@/lib/logger";

type WhatsAppStatus =
  | "disconnected"
  | "qr_ready"
  | "pairing_ready"
  | "connecting"
  | "connected"
  | "error";

interface RemotePairResponse {
  success?: boolean;
  sessionId?: string;
  pairingCode?: string;
  code?: string;
  status?: string;
  error?: string;
}

interface RemoteStatusResponse {
  connected?: boolean;
  status?: string;
  sessionId?: string;
  phoneNumber?: string | null;
  pairingCode?: string | null;
  error?: string;
}

export interface WhatsAppChannelStatus {
  status: WhatsAppStatus;
  qr: string | null;
  pairingCode: string | null;
  mode: "pairing";
  message: string;
  phoneNumber: string | null;
  sessionId: string;
}

const DEFAULT_SESSION_ID = "default";

let lastStatus: WhatsAppChannelStatus = {
  status: "disconnected",
  qr: null,
  pairingCode: null,
  mode: "pairing",
  message: "WhatsApp service is not connected",
  phoneNumber: null,
  sessionId: DEFAULT_SESSION_ID,
};

function getServiceBaseUrl(): string | null {
  const url =
    process.env.WHATSAPP_SERVICE_URL ||
    process.env.WHATSAPP_BACKEND_URL ||
    process.env.WHATSAPP_PAIRING_SERVICE_URL;

  return url ? url.replace(/\/+$/, "") : null;
}

function getServiceHeaders(): HeadersInit {
  const headers: HeadersInit = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (process.env.WHATSAPP_SERVICE_API_KEY) {
    headers.Authorization = `Bearer ${process.env.WHATSAPP_SERVICE_API_KEY}`;
    headers["x-api-key"] = process.env.WHATSAPP_SERVICE_API_KEY;
  }

  return headers;
}

function normalizePhoneNumber(phoneNumber: string): string {
  return phoneNumber.replace(/[^0-9]/g, "");
}

function formatPairingCode(code: string): string {
  const normalized = String(code).replace(/[^a-zA-Z0-9]/g, "");
  if (normalized.length <= 8) return normalized;
  return normalized.match(/.{1,4}/g)?.join("-") || normalized;
}

function mapRemoteStatus(status?: string, connected?: boolean): WhatsAppStatus {
  if (connected) return "connected";

  switch (status) {
    case "connected":
      return "connected";
    case "waiting":
    case "pairing":
    case "pairing_ready":
      return "pairing_ready";
    case "connecting":
    case "reconnecting":
      return "connecting";
    case "error":
      return "error";
    default:
      return "disconnected";
  }
}

function assertServiceConfigured(): string {
  const baseUrl = getServiceBaseUrl();
  if (!baseUrl) {
    throw new Error(
      "WHATSAPP_SERVICE_URL is not configured. Deploy whatsapp-service and set the URL in Vercel."
    );
  }
  return baseUrl;
}

async function requestJson<T>(
  path: string,
  init?: RequestInit,
  timeoutMs = 30000
): Promise<T> {
  const baseUrl = assertServiceConfigured();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        ...getServiceHeaders(),
        ...(init?.headers || {}),
      },
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};

    if (!response.ok) {
      const message =
        typeof payload?.error === "string"
          ? payload.error
          : `WhatsApp service returned ${response.status}`;
      throw new Error(message);
    }

    return payload as T;
  } finally {
    clearTimeout(timeout);
  }
}

function updateLastStatus(next: Partial<WhatsAppChannelStatus>) {
  lastStatus = {
    ...lastStatus,
    ...next,
    mode: "pairing",
    qr: null,
  };
  return lastStatus;
}

export async function getWhatsAppStatus(
  sessionId = DEFAULT_SESSION_ID
): Promise<WhatsAppChannelStatus> {
  if (!getServiceBaseUrl()) return lastStatus;

  try {
    const remote = await requestJson<RemoteStatusResponse>(
      `/api/whatsapp/status/${encodeURIComponent(sessionId)}`,
      { method: "GET" },
      10000
    );
    const status = mapRemoteStatus(remote.status, remote.connected);

    return updateLastStatus({
      status,
      pairingCode: remote.pairingCode ? formatPairingCode(remote.pairingCode) : null,
      phoneNumber: remote.phoneNumber || lastStatus.phoneNumber,
      sessionId: remote.sessionId || sessionId,
      message:
        status === "connected"
          ? "Connected to WhatsApp"
          : status === "pairing_ready"
            ? "Enter the pairing code in WhatsApp Linked Devices"
            : `WhatsApp service status: ${remote.status || status}`,
    });
  } catch (error) {
    logger.warn("[WhatsApp] Failed to fetch remote status", {
      error: error instanceof Error ? error.message : String(error),
    });
    return updateLastStatus({
      status: "error",
      message: error instanceof Error ? error.message : "Failed to fetch WhatsApp status",
    });
  }
}

export async function initWhatsApp(
  mode: "web" | "pairing" = "pairing",
  phoneNumber?: string,
  sessionId = DEFAULT_SESSION_ID
): Promise<WhatsAppChannelStatus> {
  if (mode !== "pairing") {
    throw new Error("WhatsApp Web QR mode must run on the dedicated WhatsApp service.");
  }

  const normalizedPhoneNumber = phoneNumber ? normalizePhoneNumber(phoneNumber) : "";
  if (!normalizedPhoneNumber || normalizedPhoneNumber.length < 10) {
    throw new Error("A valid phone number is required for pairing mode");
  }

  const remote = await requestJson<RemotePairResponse>("/api/whatsapp/pair", {
    method: "POST",
    body: JSON.stringify({
      sessionId,
      phoneNumber: normalizedPhoneNumber,
    }),
  });

  const pairingCode = remote.pairingCode || remote.code;
  if (!pairingCode) {
    throw new Error(remote.error || "WhatsApp service did not return a pairing code");
  }

  return updateLastStatus({
    status: mapRemoteStatus(remote.status || "waiting", false),
    pairingCode: formatPairingCode(pairingCode),
    phoneNumber: normalizedPhoneNumber,
    sessionId: remote.sessionId || sessionId,
    message: "Enter the pairing code in WhatsApp Linked Devices",
  });
}

export async function disconnectWhatsApp(
  sessionId = DEFAULT_SESSION_ID
): Promise<WhatsAppChannelStatus> {
  if (getServiceBaseUrl()) {
    try {
      await requestJson(`/api/whatsapp/logout/${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
      });
    } catch (error) {
      logger.warn("[WhatsApp] Remote logout failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return updateLastStatus({
    status: "disconnected",
    pairingCode: null,
    phoneNumber: null,
    sessionId,
    message: "Disconnected",
  });
}

export async function reconnectWhatsApp(
  sessionId = DEFAULT_SESSION_ID
): Promise<WhatsAppChannelStatus> {
  await requestJson(`/api/whatsapp/reconnect/${encodeURIComponent(sessionId)}`, {
    method: "POST",
  });
  return getWhatsAppStatus(sessionId);
}

export async function sendWhatsAppMessage(): Promise<boolean> {
  logger.warn("[WhatsApp] Sending messages is not exposed by the dedicated pairing service yet");
  return false;
}
