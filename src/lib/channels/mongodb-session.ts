"use server";

import mongoose, { Schema, Document } from "mongoose";
import { logger } from "@/lib/logger";

const MONGO_URL = process.env.MONGODB_URL || "";

interface IPairingSession extends Document {
  phoneNumber: string;
  pairingCode: string;
  status: "pairing_ready" | "connected" | "failed" | "disconnected";
  sessionData?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const pairingSessionSchema = new Schema<IPairingSession>(
  {
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    pairingCode: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pairing_ready", "connected", "failed", "disconnected"],
      default: "pairing_ready",
    },
    sessionData: {
      type: Schema.Types.Mixed,
      default: {},
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 86400, // Auto-delete after 24 hours
    },
  },
  {
    timestamps: true,
  }
);

let PairingSession: mongoose.Model<IPairingSession> | null = null;

export async function initializeMongoSession(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    logger.info("[MongoDB] Already connected");
    return;
  }

  if (!MONGO_URL) {
    logger.warn("[MongoDB] MONGODB_URL not configured, skipping MongoDB initialization");
    return;
  }

  try {
    await mongoose.connect(MONGO_URL, {
      dbName: "whatsapp_bot",
    });

    PairingSession =
      mongoose.models.PairingSession ||
      mongoose.model<IPairingSession>("PairingSession", pairingSessionSchema);

    logger.info("[MongoDB] Connected and initialized");
  } catch (error) {
    logger.error("[MongoDB] Failed to initialize:", error);
  }
}

export async function savePairingSession(
  phoneNumber: string,
  pairingCode: string,
  sessionData: Record<string, unknown> = {}
): Promise<boolean> {
  if (!PairingSession) {
    logger.warn("[MongoDB] Model not initialized, skipping save");
    return false;
  }

  try {
    await PairingSession.updateOne(
      { phoneNumber },
      {
        phoneNumber,
        pairingCode,
        status: "pairing_ready",
        sessionData,
      },
      { upsert: true }
    );

    logger.info(`[MongoDB] Saved pairing session for ${phoneNumber}`);
    return true;
  } catch (error) {
    logger.error("[MongoDB] Failed to save pairing session:", error);
    return false;
  }
}

export async function getPairingSession(
  phoneNumber: string
): Promise<Record<string, unknown> | null> {
  if (!PairingSession) {
    logger.warn("[MongoDB] Model not initialized, skipping retrieval");
    return null;
  }

  try {
    const session = await PairingSession.findOne({ phoneNumber }).lean();
    return session ? (session as Record<string, unknown>) : null;
  } catch (error) {
    logger.error("[MongoDB] Failed to get pairing session:", error);
    return null;
  }
}

export async function updatePairingStatus(
  phoneNumber: string,
  status: "pairing_ready" | "connected" | "failed" | "disconnected",
  additionalData: Record<string, unknown> = {}
): Promise<boolean> {
  if (!PairingSession) {
    logger.warn("[MongoDB] Model not initialized, skipping update");
    return false;
  }

  try {
    await PairingSession.updateOne(
      { phoneNumber },
      {
        status,
        ...additionalData,
      }
    );

    logger.info(`[MongoDB] Updated pairing status for ${phoneNumber}: ${status}`);
    return true;
  } catch (error) {
    logger.error("[MongoDB] Failed to update pairing status:", error);
    return false;
  }
}

export async function closeMongoSession(): Promise<void> {
  try {
    await mongoose.disconnect();
    logger.info("[MongoDB] Connection closed");
    PairingSession = null;
  } catch (error) {
    logger.error("[MongoDB] Failed to close connection:", error);
  }
}
