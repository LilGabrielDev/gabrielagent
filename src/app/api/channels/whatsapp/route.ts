import { NextResponse } from "next/server";
import {
  getWhatsAppStatus,
  initWhatsApp,
  disconnectWhatsApp,
} from "@/lib/channels/whatsapp";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getWhatsAppStatus();
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

      const status = await initWhatsApp(mode === "pairing" ? "pairing" : "web", phoneNumber);
      await prisma.channel.upsert({
        where: { type: "whatsapp" },
        update: {
          isActive: status.status === "connected",
          status: status.status,
          config: {
            mode: "pairing",
            pairingPhoneNumber: status.phoneNumber,
            sessionId: status.sessionId,
          },
        },
        create: {
          type: "whatsapp",
          isActive: status.status === "connected",
          status: status.status,
          config: {
            mode: "pairing",
            pairingPhoneNumber: status.phoneNumber,
            sessionId: status.sessionId,
          },
        },
      });
      return NextResponse.json(status, {
        status: status.status === "error" ? 502 : 200,
      });
    }

    if (action === "disconnect") {
      await disconnectWhatsApp();
      await prisma.channel.upsert({
        where: { type: "whatsapp" },
        update: { isActive: false, status: "disconnected" },
        create: { type: "whatsapp", isActive: false, status: "disconnected" },
      });
      return NextResponse.json({ status: "disconnected" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to process WhatsApp action";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
