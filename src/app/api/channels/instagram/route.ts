import { NextRequest, NextResponse } from "next/server";
import { verifyWebhook, handleInstagramWebhook } from "@/lib/channels/instagram";
import { logger } from "@/lib/logger";

/**
 * GET /api/channels/instagram
 *
 * Webhook verification endpoint for Meta's Instagram Messaging API.
 * Meta sends a GET request with hub.mode, hub.verify_token, and hub.challenge
 * when setting up or verifying the webhook subscription.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  logger.debug("[Instagram Webhook] Verification attempt", {
    mode,
    tokenProvided: !!token,
    challengeProvided: !!challenge,
  });

  const result = verifyWebhook(mode, token, challenge);

  if (result) {
    // Return the challenge text as plain text — Meta expects the raw challenge back
    return new NextResponse(result, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  logger.warn("[Instagram Webhook] Verification failed — invalid mode or token", {
    mode,
  });

  return NextResponse.json(
    { error: { code: "VERIFICATION_FAILED", message: "Invalid verification request" } },
    { status: 403 }
  );
}

/**
 * POST /api/channels/instagram
 *
 * Handles incoming Instagram webhook events (messages, mentions, comments, etc.).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    logger.debug("[Instagram Webhook] Received event");

    // Meta sends the entry array nested under an "entry" key
    // e.g. { object: "instagram", entry: [...] }
    const entries = body.entry ?? (Array.isArray(body) ? body : []);

    if (entries.length > 0) {
      await handleInstagramWebhook(entries);
    } else {
      logger.warn("[Instagram Webhook] Received empty or unrecognised payload");
    }

    // Always return 200 OK to acknowledge receipt (Meta expects this)
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("[Instagram Webhook] Failed to process event", error);

    // Still return 200 — if we return an error Meta will retry, which we don't want
    return NextResponse.json({ ok: true });
  }
}