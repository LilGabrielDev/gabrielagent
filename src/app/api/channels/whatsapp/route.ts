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
  try {
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
      const status = getWhatsAppStatus();
      return NextResponse.json(status, {
        status: status.status === "error" ? 502 : 200,
      });
    }

    if (action === "disconnect") {
      await disconnectWhatsApp();
      return NextResponse.json({ status: "disconnected" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to process WhatsApp action";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
