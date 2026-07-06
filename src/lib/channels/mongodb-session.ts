"use server";

import { MongoClient, Db, Collection } from "mongodb";
import { logger } from "@/lib/logger";

let mongoClient: MongoClient | null = null;
let db: Db | null = null;
let sessionsCollection: Collection | null = null;

const MONGO_URL = process.env.MONGODB_URL || "";
const DB_NAME = "whatsapp_bot";
const COLLECTION_NAME = "pairing_sessions";

export async function initializeMongoSession(): Promise<void> {
  if (mongoClient && db) {
    logger.info("[MongoDB] Already connected");
    return;
  }

  if (!MONGO_URL) {
    logger.warn("[MongoDB] MONGODB_URL not configured, skipping MongoDB initialization");
    return;
  }

  try {
    mongoClient = new MongoClient(MONGO_URL);
    await mongoClient.connect();
    db = mongoClient.db(DB_NAME);
    sessionsCollection = db.collection(COLLECTION_NAME);

    // Create index on phoneNumber for faster lookups
    await sessionsCollection.createIndex({ phoneNumber: 1 });
    await sessionsCollection.createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: 86400 } // Auto-delete after 24 hours
    );

    logger.info("[MongoDB] Connected and initialized");
  } catch (error) {
    logger.error("[MongoDB] Failed to initialize:", error);
    mongoClient = null;
    db = null;
    sessionsCollection = null;
  }
}

export async function savePairingSession(
  phoneNumber: string,
  pairingCode: string,
  sessionData: Record<string, unknown> = {}
): Promise<boolean> {
  if (!sessionsCollection) {
    logger.warn("[MongoDB] Session collection not available, skipping save");
    return false;
  }

  try {
    await sessionsCollection.updateOne(
      { phoneNumber },
      {
        $set: {
          phoneNumber,
          pairingCode,
          status: "pairing_ready",
          sessionData,
          updatedAt: new Date(),
          createdAt: new Date(),
        },
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
  if (!sessionsCollection) {
    logger.warn("[MongoDB] Session collection not available, skipping retrieval");
    return null;
  }

  try {
    const session = await sessionsCollection.findOne({ phoneNumber });
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
  if (!sessionsCollection) {
    logger.warn("[MongoDB] Session collection not available, skipping update");
    return false;
  }

  try {
    await sessionsCollection.updateOne(
      { phoneNumber },
      {
        $set: {
          status,
          ...additionalData,
          updatedAt: new Date(),
        },
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
  if (mongoClient) {
    try {
      await mongoClient.close();
      logger.info("[MongoDB] Connection closed");
    } catch (error) {
      logger.error("[MongoDB] Failed to close connection:", error);
    } finally {
      mongoClient = null;
      db = null;
      sessionsCollection = null;
    }
  }
}
