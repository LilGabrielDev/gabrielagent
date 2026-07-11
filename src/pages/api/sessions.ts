import type { NextApiRequest, NextApiResponse } from 'next';
import mongoose, { Schema, model, models } from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || 'gabrielagent';

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not configured for session storage API');
}

const sessionSchema = new Schema(
  {
    sessionId: { type: String, required: true, unique: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    updatedAt: { type: Date, default: Date.now },
  },
  { strict: false }
);

const WhatsAppSession = models.WhatsAppSession || model('WhatsAppSession', sessionSchema);

async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) return;
  if (!MONGODB_URI) throw new Error('MONGODB_URI not set');
  await mongoose.connect(MONGODB_URI, { dbName: DB_NAME });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const payload = req.body;
  if (!payload || !payload.sessionId) {
    return res.status(400).json({ success: false, error: 'Missing sessionId in body' });
  }

  try {
    await connectToDatabase();

    await WhatsAppSession.findOneAndUpdate(
      { sessionId: payload.sessionId },
      {
        payload,
        updatedAt: new Date(),
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    ).exec();

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Session save failed', err);
    return res.status(500).json({ success: false, error: 'Unable to save session' });
  }
}
