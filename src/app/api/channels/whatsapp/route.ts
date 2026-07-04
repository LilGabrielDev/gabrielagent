import { NextResponse } from "next/server";

const isVercel = process.env.VERCEL === "1" || process.env.VERCEL === "true";

const vercelUnsupportedStatus = {
  status: "unsupported",
  qr: null,
  message:
    "WhatsApp Web mode uses Puppeteer and persistent local auth storage, so it is disabled on Vercel. Use WhatsApp Business API mode or host the WhatsApp worker on a long-running server.",
};

export async function GET() {
  if (isVercel) {
    return NextResponse.json(vercelUnsupportedStatus);
  }

  const { getWhatsAppStatus } = await import("@/lib/channels/whatsapp");
  const status = getWhatsAppStatus();
  return NextResponse.json(status);
}

export async function POST(request: Request) {
  if (isVercel) {
    return NextResponse.json(vercelUnsupportedStatus, { status: 501 });
  }

  const body = await request.json();
  const { action } = body;
  const {
    getWhatsAppStatus,
    initWhatsApp,
    disconnectWhatsApp,
  } = await import("@/lib/channels/whatsapp");

  if (action === "connect") {
    await initWhatsApp();
    // Wait a moment for QR to generate
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const status = getWhatsAppStatus();
    return NextResponse.json(status);
  }

  if (action === "disconnect") {
    await disconnectWhatsApp();
    return NextResponse.json({ status: "disconnected" });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
