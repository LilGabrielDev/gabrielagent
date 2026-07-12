import QRCode from "qrcode";
import { logger } from "@/lib/logger";

type WhatsAppStatus =
  | "disconnected"
  | "qr_ready"
  | "pairing_ready"
  | "connecting"
  | "connected"
  | "error";

type WhatsAppMode = "web" | "pairing" | "api";

interface RemotePairResponse {
  success?: boolean;
  sessionId?: string;
  pairingCode?: string;
  code?: string;
  qr?: string | null;
  status?: string;
  error?: string;
}

interface RemoteStatusResponse {
  connected?: boolean;
  status?: string;
  sessionId?: string;
  phoneNumber?: string | null;
  pairingCode?: string | null;
  qr?: string | null;
  mode?: WhatsAppMode;
  error?: string;
}

export interface WhatsAppChannelStatus {
  status: WhatsAppStatus;
  qr: string | null;
  pairingCode: string | null;
  mode: WhatsAppMode;
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
    process.env.NEXT_PUBLIC_BACKEND_URL ||
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

  const apiKey = process.env.WHATSAPP_SERVICE_API_KEY;
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
    headers["x-api-key"] = apiKey;
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

async function toQrDataUrl(qr: string | null | undefined): Promise<string | null> {
  if (!qr) return null;
  if (qr.startsWith("data:image/")) return qr;
  try {
    return await QRCode.toDataURL(qr, { width: 256, margin: 1 });
  } catch (error) {
    logger.warn("[WhatsApp] Failed to render QR code", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function mapRemoteStatus(
  status?: string,
  connected?: boolean,
  qr?: string | null
): WhatsAppStatus {
  if (connected) return "connected";

  switch (status) {
    case "connected":
      return "connected";
    case "waiting":
    case "pairing":
    case "pairing_ready":
      return qr ? "qr_ready" : "pairing_ready";
    case "connecting":
    case "reconnecting":
      return qr ? "qr_ready" : "connecting";
    case "error":
      return "error";
    default:
      return qr ? "qr_ready" : "disconnected";
  }
}

function assertServiceConfigured(): string {
  const baseUrl = getServiceBaseUrl();
  if (!baseUrl) {
    throw new Error(
      "NEXT_PUBLIC_BACKEND_URL is not configured. Deploy whatsapp-service on Render and set the backend URL."
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
  };
  return lastStatus;
}

function statusMessage(
  status: WhatsAppStatus,
  mode: WhatsAppMode,
  remoteStatus?: string
): string {
  if (status === "connected") return "Connected to WhatsApp";
  if (status === "qr_ready") {
    return "Scan the QR code with WhatsApp Linked Devices";
  }
  if (status === "pairing_ready") {
    return "Enter the pairing code in WhatsApp Linked Devices";
  }
  if (status === "connecting") return "Connecting to WhatsApp service...";
  if (status === "error") return "WhatsApp service error";
  if (remoteStatus) return `WhatsApp service status: ${remoteStatus}`;
  if (mode === "api") return "Business API credentials saved";
  return "WhatsApp service is not connected";
}

export async function getWhatsAppStatus(
  sessionId = DEFAULT_SESSION_ID
): Promise<WhatsAppChannelStatus> {
  if (!getServiceBaseUrl()) return lastStatus;

  try {
    const remote = await requestJson<RemoteStatusResponse>(
      `/api/session/${encodeURIComponent(sessionId)}/status`,
      { method: "GET" },
      10000
    );
    const status = mapRemoteStatus(remote.status, remote.connected, remote.qr);
    const qrDataUrl = await toQrDataUrl(remote.qr);

    const next = updateLastStatus({
      status,
      qr: qrDataUrl,
      pairingCode: remote.pairingCode ? formatPairingCode(remote.pairingCode) : null,
      phoneNumber: remote.phoneNumber || lastStatus.phoneNumber,
      sessionId: remote.sessionId || sessionId,
      message: statusMessage(status, lastStatus.mode, remote.status),
    });

    // Persist session snapshot to frontend DB (best-effort)
    void saveSessionToFrontendDB({
      sessionId: next.sessionId,
      status: next.status,
      qr: remote.qr || null,
      pairingCode: remote.pairingCode || null,
      phoneNumber: next.phoneNumber,
      mode: next.mode,
    }).catch(() => {
      /* ignore persistence errors */
    });

    return next;
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
  mode: WhatsAppMode = "pairing",
  phoneNumber?: string,
  sessionId = DEFAULT_SESSION_ID
): Promise<WhatsAppChannelStatus> {
  if (mode === "api") {
    return updateLastStatus({
      status: "connected",
      mode: "api",
      phoneNumber: phoneNumber ? normalizePhoneNumber(phoneNumber) : null,
      sessionId,
      message: "Business API credentials saved",
    });
  }

  if (mode === "web") {
    const remote = await requestJson<RemotePairResponse>(`/api/session/${encodeURIComponent(sessionId)}/qr`, {
      method: "POST",
      body: JSON.stringify({ sessionId }),
    });

    const status = mapRemoteStatus(remote.status || "waiting", false, remote.qr);
    const qrDataUrl = await toQrDataUrl(remote.qr);

    const next = updateLastStatus({
      status,
      qr: qrDataUrl,
      pairingCode: null,
      mode: "web",
      sessionId: remote.sessionId || sessionId,
      message: statusMessage(status, "web", remote.status),
    });

    void saveSessionToFrontendDB({
      sessionId: next.sessionId,
      status: next.status,
      qr: remote.qr || null,
      pairingCode: null,
      phoneNumber: next.phoneNumber,
      mode: next.mode,
    }).catch(() => {});

    return next;
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

  const nextPair = updateLastStatus({
    status: mapRemoteStatus(remote.status || "waiting", false, remote.qr),
    pairingCode: formatPairingCode(pairingCode),
    qr: await toQrDataUrl(remote.qr),
    phoneNumber: normalizedPhoneNumber,
    mode: "pairing",
    sessionId: remote.sessionId || sessionId,
    message: "Enter the pairing code in WhatsApp Linked Devices",
  });

  void saveSessionToFrontendDB({
    sessionId: nextPair.sessionId,
    status: nextPair.status,
    qr: remote.qr || null,
    pairingCode: pairingCode,
    phoneNumber: nextPair.phoneNumber,
    mode: nextPair.mode,
  }).catch(() => {});

  return nextPair;
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
    qr: null,
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

export function isWhatsAppServiceConfigured(): boolean {
  return Boolean(getServiceBaseUrl());
}

async function saveSessionToFrontendDB(payload: Partial<RemoteStatusResponse> & { sessionId: string }) {
  try {
    await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // silent: persistence is best-effort and should not break frontend flows
  }
}
