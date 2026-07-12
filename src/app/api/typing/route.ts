import { NextRequest, NextResponse } from "next/server";
import { emitTyping } from "@/lib/realtime";

/**
 * POST /api/typing
 * Emit a typing indicator event.
 * Called by the frontend when the user types in the reply input.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversationId, isTyping, userName } = body;

    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId is required" },
        { status: 400 }
      );
    }

    emitTyping(conversationId, userName || "Agent", isTyping);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to process typing event" },
      { status: 500 }
    );
  }
}
