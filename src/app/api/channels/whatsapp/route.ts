import { NextRequest, NextResponse } from "next/server";
import {
  getWhatsAppStatus,
  initWhatsApp,
  disconnectWhatsApp,
} from "@/lib/channels/whatsapp";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthenticated } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

type WhatsAppMode = "web" | "pairing" | "api";

async function upsertWhatsAppChannel(
  status: Awaited<ReturnType<typeof getWhatsAppStatus>>,
  mode: WhatsAppMode,
  config: Record<string, unknown> = {}
) {
  return prisma.channel.upsert({
    where: { type: "whatsapp" },
    update: {
      isActive: status.status === "connected",
      status: status.status,
      config: {
        mode,
        pairingPhoneNumber: status.phoneNumber,
        sessionId: status.sessionId,
        ...config,
      },
    },
    create: {
      type: "whatsapp",
      isActive: status.status === "connected",
      status: status.status,
      config: {
        mode,
        pairingPhoneNumber: status.phoneNumber,
        sessionId: status.sessionId,
        ...config,
      },
    },
  });
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, "channels:read");
  if (!isAuthenticated(auth)) return auth;

  const status = await getWhatsAppStatus();
  return NextResponse.json(status);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, "channels:update");
  if (!isAuthenticated(auth)) return auth;

  try {
    const body = await request.json();
    const { action, mode, phoneNumber, apiKey } = body as {
      action?: string;
      mode?: WhatsAppMode;
      phoneNumber?: string;
      apiKey?: string;
    };

    if (action === "connect") {
      const connectMode: WhatsAppMode = mode || "pairing";

      if (connectMode === "pairing" && !phoneNumber) {
        return NextResponse.json(
          { error: "Phone number is required for pairing mode" },
          { status: 400 }
        );
      }

      if (connectMode === "api") {
        if (!apiKey || !phoneNumber) {
          return NextResponse.json(
            { error: "API key and phone number are required for Business API mode" },
            { status: 400 }
          );
        }

        const status = await initWhatsApp("api", phoneNumber);
        await upsertWhatsAppChannel(status, "api", { apiKey, phoneNumber });
        return NextResponse.json({
          ...status,
          status: "connected",
          message: "Business API credentials saved",
        });
      }

      const status = await initWhatsApp(connectMode, phoneNumber);
      await upsertWhatsAppChannel(status, connectMode);
      return NextResponse.json(status, {
        status: status.status === "error" ? 502 : 200,
      });
    }

    if (action === "disconnect") {
      const status = await disconnectWhatsApp();
      await prisma.channel.upsert({
        where: { type: "whatsapp" },
        update: { isActive: false, status: "disconnected" },
        create: { type: "whatsapp", isActive: false, status: "disconnected" },
      });
      return NextResponse.json({ ...status, message: "WhatsApp disconnected" });
    }

    if (action === "sync") {
      const status = await getWhatsAppStatus();
      const channel = await prisma.channel.findUnique({ where: { type: "whatsapp" } });
      const savedMode =
        (channel?.config as { mode?: WhatsAppMode } | null)?.mode || status.mode;

      await upsertWhatsAppChannel(status, savedMode);
      return NextResponse.json(status);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to process WhatsApp action";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
