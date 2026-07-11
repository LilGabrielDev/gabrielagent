import type { NextApiRequest, NextApiResponse } from 'next';
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || 'gabrielagent';

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not configured for session storage API');
}

let cachedClient: MongoClient | null = null;

async function getClient() {
  if (cachedClient) return cachedClient;
  if (!MONGODB_URI) throw new Error('MONGODB_URI not set');
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  cachedClient = client;
  return client;
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
    const client = await getClient();
    const db = client.db(DB_NAME);
    const col = db.collection('whatsapp_sessions');

    const filter = { sessionId: payload.sessionId };
    const update = { $set: { ...payload, updatedAt: new Date() } };
    const opts = { upsert: true };

    await col.updateOne(filter, update, opts);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Session save failed', err);
    return res.status(500).json({ success: false, error: 'Unable to save session' });
  }
}
