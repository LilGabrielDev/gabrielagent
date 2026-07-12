/**
 * Instagram Direct Messaging Channel
 *
 * Uses the Instagram Messaging API via Facebook Graph API.
 * Requires a Facebook App with Instagram Basic Display and Instagram Messaging API.
 */

import { prisma } from "@/lib/prisma";
import { chat, createNewConversation } from "@/lib/ai/engine";
import { resolveCustomer } from "@/lib/customer-resolver";
import { logger } from "@/lib/logger";
import { getActiveTenantId } from "@/lib/tenant-prisma";

interface InstagramConfig {
  appId: string;
  appSecret: string;
  pageAccessToken: string;
  instagramBusinessAccountId: string;
  verifyToken: string;
}

interface InstagramWebhookEntry {
  id: string;
  time: number;
  messaging?: Array<{
    sender: { id: string };
    recipient: { id: string };
    timestamp: number;
    message?: {
      mid: string;
      text?: string;
      attachments?: Array<{
        type: string;
        payload: { url: string };
      }>;
    };
  }>;
  changes?: Array<{
    field: string;
    value: {
      messaging_product: string;
      metadata: {
        page_id: string;
      };
      contacts?: Array<{
        profile: { name: string };
        wa_id: string;
      }>;
      messages?: Array<{
        from: string;
        id: string;
        text?: { body: string };
        timestamp: string;
        type: string;
      }>;
    };
  }>;
}

interface InstagramUser {
  id: string;
  username?: string;
  name?: string;
}

async function getInstagramConfig(): Promise<InstagramConfig | null> {
  const tenantId = getActiveTenantId();
  const settings = await prisma.settings.findFirst({
    where: tenantId ? { tenantId } : undefined,
  });
  if (!settings) return null;

  const config = settings as unknown as Record<string, unknown>;
  if (!config?.instagramAppId || !config?.instagramAccessToken) return null;

  return {
    appId: String(config.instagramAppId),
    appSecret: String(config.instagramAppSecret || ""),
    pageAccessToken: String(config.instagramAccessToken),
    instagramBusinessAccountId: String(config.instagramBusinessAccountId || ""),
    verifyToken: String(config.instagramVerifyToken || "gabriel-verify"),
  };
}

/**
 * Verify webhook subscription (GET request from Meta).
 */
export function verifyWebhook(
  mode: string | null,
  token: string | null,
  challenge: string | null
): string | null {
  if (mode === "subscribe" && token) {
    return challenge; // Return challenge to verify
  }
  return null;
}

/**
 * Handle incoming Instagram webhook event.
 */
export async function handleInstagramWebhook(
  body: InstagramWebhookEntry[]
): Promise<void> {
  const config = await getInstagramConfig();
  if (!config) {
    logger.warn("[Instagram] Not configured, ignoring webhook");
    return;
  }

  for (const entry of body) {
    // Handle Instagram Graph API messaging
    if (entry.messaging) {
      for (const event of entry.messaging) {
        if (event.message?.text) {
          await handleInstagramMessage(
            event.sender.id,
            event.message.text,
            config
          );
        }
      }
    }

    // Handle WhatsApp Cloud API style (reused for Instagram)
    if (entry.changes) {
      for (const change of entry.changes) {
        const value = change.value;
        if (value.messages) {
          for (const msg of value.messages) {
            if (msg.text?.body) {
              await handleInstagramMessage(
                msg.from,
                msg.text.body,
                config
              );
            }
          }
        }
      }
    }
  }
}

async function handleInstagramMessage(
  senderId: string,
  text: string,
  config: InstagramConfig
): Promise<void> {
  try {
    // Fetch user profile
    const user = await fetchInstagramUser(senderId, config.pageAccessToken);

    const customerId = await resolveCustomer(
      "instagram",
      senderId,
      user?.name || "Instagram User"
    );

    let conversation = await prisma.conversation.findFirst({
      where: {
        channel: "instagram",
        status: { in: ["active", "escalated"] },
        OR: [{ customerId }, { customerContact: senderId }],
      },
    });

    if (!conversation) {
      conversation = await createNewConversation(
        "instagram",
        user?.name || "Instagram User",
        senderId,
        customerId
      );
    }

    const aiResponse = await chat(conversation.id, text);

    // Send reply via Instagram API
    await sendInstagramMessage(senderId, aiResponse, config.pageAccessToken);
  } catch (error) {
    logger.error("[Instagram] Failed to handle message:", error);
  }
}

async function fetchInstagramUser(
  userId: string,
  accessToken: string
): Promise<InstagramUser | null> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${userId}?fields=id,username,name&access_token=${accessToken}`
    );
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function sendInstagramMessage(
  recipientId: string,
  text: string,
  accessToken: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${accessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text },
        }),
      }
    );

    return response.ok;
  } catch (error) {
    logger.error("[Instagram] Failed to send message:", error);
    return false;
  }
}

/**
 * Configure Instagram webhook subscription.
 */
export async function setupInstagramWebhook(
  accessToken: string,
  appId: string,
  appSecret: string,
  webhookUrl: string,
  verifyToken: string
): Promise<boolean> {
  try {
    // Get long-lived page access token
    const tokenResponse = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?` +
        `grant_type=fb_exchange_token&client_id=${appId}` +
        `&client_secret=${appSecret}&fb_exchange_token=${accessToken}`
    );
    if (!tokenResponse.ok) {
      logger.error("[Instagram] Failed to exchange token");
      return false;
    }

    const tokenData = await tokenResponse.json();

    // Subscribe to messages webhook
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${appId}/subscriptions?` +
        `access_token=${tokenData.access_token || accessToken}` +
        `&object=page&callback_url=${encodeURIComponent(webhookUrl)}` +
        `&verify_token=${verifyToken}&fields=messages,messaging_optins`,
      { method: "POST" }
    );

    return response.ok;
  } catch (error) {
    logger.error("[Instagram] Failed to setup webhook:", error);
    return false;
  }
}
