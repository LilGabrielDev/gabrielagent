import { NextResponse } from "next/server";
import { extractPairingCode } from "@/lib/channels/pairing-code";

export const dynamic = "force-dynamic";

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

export async function GET(request: Request) {
  const baseUrl = getServiceBaseUrl();
  if (!baseUrl) {
    return NextResponse.json(
      {
        error: "WHATSAPP_SERVICE_URL is not configured",
        code: "SERVICE_NOT_CONFIGURED",
      },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const phoneNumber = searchParams.get("number")?.replace(/[^0-9]/g, "");

  if (!phoneNumber || phoneNumber.length < 10) {
    return NextResponse.json(
      { error: "Valid phone number is required", code: "INVALID_PHONE" },
      { status: 400 }
    );
  }

  const response = await fetch(`${baseUrl}/api/whatsapp/pair`, {
    method: "POST",
    headers: getServiceHeaders(),
    body: JSON.stringify({
      sessionId: searchParams.get("sessionId") || "default",
      phoneNumber,
    }),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return NextResponse.json(payload, { status: response.status });
  }

  const code = extractPairingCode(payload);
  return NextResponse.json({
    code,
    pairingCode: code,
    sessionId: payload.sessionId || "default",
    phone: phoneNumber,
    status: payload.status || "waiting",
    timestamp: new Date().toISOString(),
    expiresIn: 300,
  });
}
