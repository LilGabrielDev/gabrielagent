import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { requireAuth, isAuthenticated } from "@/lib/route-auth";
import { ensureDefaultTenant, channelLookup, resolveTenantId } from "@/lib/default-tenant";
import { disconnectWhatsApp, getWhatsAppStatus } from "@/lib/channels/whatsapp";

const CHANNEL_TYPES = ["whatsapp", "email", "phone", "sms", "telegram", "widget"];

type RouteContext = { params: Promise<{ type: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request, "channels:read");
  if (!isAuthenticated(auth)) return auth;

  try {
    const { type } = await context.params;

    if (!CHANNEL_TYPES.includes(type)) {
      return NextResponse.json(
        { error: "Invalid channel type" },
        { status: 400 }
      );
    }

    const tenant = await ensureDefaultTenant();
    const tenantId = resolveTenantId(auth.tenantId ?? tenant.id);

    const channel = await prisma.channel.findUnique({
      where: channelLookup(type, tenantId),
    });

    if (!channel) {
      return NextResponse.json({
        id: null,
        type,
        isActive: false,
        config: {},
        status: "disconnected",
        createdAt: null,
        updatedAt: null,
      });
    }

    return NextResponse.json(channel);
  } catch (error) {
    logger.error("Failed to fetch channel:", error);
    return NextResponse.json(
      { error: "Failed to fetch channel" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request, "channels:update");
  if (!isAuthenticated(auth)) return auth;

  try {
    const { type } = await context.params;

    if (!CHANNEL_TYPES.includes(type)) {
      return NextResponse.json(
        { error: "Invalid channel type" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { isActive, config, status } = body;

    const tenant = await ensureDefaultTenant();
    const tenantId = resolveTenantId(auth.tenantId ?? tenant.id);

    const channel = await prisma.channel.upsert({
      where: channelLookup(type, tenantId),
      update: {
        isActive: typeof isActive === "boolean" ? isActive : undefined,
        config: config ?? undefined,
        status: status ?? undefined,
      },
      create: {
        type,
        tenantId,
        isActive: typeof isActive === "boolean" ? isActive : false,
        config: config ?? {},
        status: status ?? "disconnected",
      },
    });

    return NextResponse.json(channel);
  } catch (error) {
    logger.error("Failed to update channel:", error);
    return NextResponse.json(
      { error: "Failed to update channel" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request, "channels:update");
  if (!isAuthenticated(auth)) return auth;

  try {
    const { type } = await context.params;

    if (!CHANNEL_TYPES.includes(type)) {
      return NextResponse.json(
        { error: "Invalid channel type" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { action } = body;

    if (!action || !["connect", "disconnect", "test"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be one of: connect, disconnect, test" },
        { status: 400 }
      );
    }

    const tenant = await ensureDefaultTenant();
    const tenantId = resolveTenantId(auth.tenantId ?? tenant.id);
    const channelWhere = channelLookup(type, tenantId);

    const channel = await prisma.channel.findUnique({ where: channelWhere });

    if (action === "disconnect") {
      if (type === "whatsapp") {
        const status = await disconnectWhatsApp();
        const updated = await prisma.channel.upsert({
          where: channelWhere,
          update: { status: "disconnected", isActive: false },
          create: {
            type,
            tenantId,
            isActive: false,
            config: {},
            status: "disconnected",
          },
        });
        return NextResponse.json({
          ...updated,
          message: status.message || "WhatsApp disconnected",
        });
      }

      const updated = await prisma.channel.upsert({
        where: channelWhere,
        update: { status: "disconnected" },
        create: {
          type,
          tenantId,
          isActive: false,
          config: {},
          status: "disconnected",
        },
      });
      return NextResponse.json({
        ...updated,
        message: `${type} channel disconnected`,
      });
    }

    if (action === "connect") {
      if (type === "whatsapp") {
        const remoteStatus = await getWhatsAppStatus();
        const updated = await prisma.channel.upsert({
          where: channelWhere,
          update: {
            status: remoteStatus.status,
            isActive: remoteStatus.status === "connected",
          },
          create: {
            type,
            tenantId,
            isActive: remoteStatus.status === "connected",
            config: {},
            status: remoteStatus.status,
          },
        });
        return NextResponse.json({
          ...updated,
          message:
            remoteStatus.status === "connected"
              ? "WhatsApp channel connected"
              : "WhatsApp connection updated",
        });
      }

      if (!channel?.config || Object.keys(channel.config as object).length === 0) {
        return NextResponse.json(
          { error: "Channel must be configured before connecting" },
          { status: 400 }
        );
      }

      const updated = await prisma.channel.update({
        where: channelWhere,
        data: { status: "connected", isActive: true },
      });

      return NextResponse.json({
        ...updated,
        message: `${type} channel connected`,
      });
    }

    if (action === "test") {
      if (!channel?.config || Object.keys(channel.config as object).length === 0) {
        return NextResponse.json(
          { error: "Channel must be configured before testing" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `${type} connection test initiated`,
        channel,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    logger.error("Failed to perform channel action:", error);
    return NextResponse.json(
      { error: "Failed to perform channel action" },
      { status: 500 }
    );
  }
}
