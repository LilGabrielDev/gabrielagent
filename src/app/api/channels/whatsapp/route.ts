import { NextResponse } from "next/server";
import {
  getWhatsAppStatus,
  initWhatsApp,
  disconnectWhatsApp,
} from "@/lib/channels/whatsapp";

export async function GET() {
  const status = getWhatsAppStatus();
  return NextResponse.json(status);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { action, mode, phoneNumber } = body;

  if (action === "connect") {
    if (mode === "pairing" && !phoneNumber) {
      return NextResponse.json(
        { error: "Phone number is required for pairing mode" },
        { status: 400 }
      );
    }

    await initWhatsApp(mode === "pairing" ? "pairing" : "web", phoneNumber);
    // Wait a moment for QR / pairing code to generate
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
