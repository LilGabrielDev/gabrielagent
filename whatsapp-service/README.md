# Owly WhatsApp Service

Standalone WhatsApp pairing and session service for Owly. Deploy this service on Render, Railway, a VPS, Docker, PM2, or a Pterodactyl Node.js server, then point the Vercel app at it with `WHATSAPP_SERVICE_URL`.

## API

- `POST /api/whatsapp/pair`
  - Body: `{ "sessionId": "default", "phoneNumber": "15551234567" }`
  - Returns: `{ "success": true, "sessionId": "default", "pairingCode": "XXXX-XXXX", "status": "waiting" }`
- `GET /api/whatsapp/status/:sessionId`
- `DELETE /api/whatsapp/logout/:sessionId`
- `POST /api/whatsapp/reconnect/:sessionId`
- `GET /api/health`

If `API_KEY` is set, send either `Authorization: Bearer <API_KEY>` or `x-api-key: <API_KEY>`.

## Environment

Copy `.env.example` to `.env`.

```env
PORT=4000
API_KEY=change-this-to-a-long-random-secret
CORS_ORIGIN=https://your-vercel-app.vercel.app
SESSION_PATH=./sessions
LOG_LEVEL=info
```

Use a persistent disk or volume for `SESSION_PATH`. This is what lets sessions survive deploys and restarts.

## Local Development

```bash
npm install
npm run dev
```

Pair:

```bash
curl -X POST http://localhost:4000/api/whatsapp/pair \
  -H "Content-Type: application/json" \
  -H "x-api-key: change-this-to-a-long-random-secret" \
  -d "{\"sessionId\":\"default\",\"phoneNumber\":\"15551234567\"}"
```

## Docker

```bash
docker compose up --build -d
```

The compose file mounts `whatsapp_sessions` at `/app/sessions`.

## Render

1. Create a Web Service from this repo and set the root directory to `whatsapp-service`.
2. Build command: `npm ci && npm run build`
3. Start command: `npm start`
4. Add a persistent disk mounted at `/app/sessions`.
5. Set `SESSION_PATH=/app/sessions`, `API_KEY`, `CORS_ORIGIN`, and `PORT`.

## Railway

1. Deploy the `whatsapp-service` directory.
2. Set the start command to `npm start`.
3. Add a volume and set `SESSION_PATH` to the mounted path.
4. Set `API_KEY` and `CORS_ORIGIN`.

## VPS / PM2

```bash
npm ci
npm run build
pm2 start ecosystem.config.js
pm2 save
```

Keep `SESSION_PATH` on persistent storage.

## Pterodactyl

Use a Node.js egg:

- Install command: `npm ci && npm run build`
- Startup command: `npm start`
- Variables: set `PORT` to the allocated port, set `API_KEY`, `CORS_ORIGIN`, and `SESSION_PATH=./sessions`

Do not delete the `sessions` directory between restarts.

## Vercel Integration

Set these variables in the existing Vercel app:

```env
WHATSAPP_SERVICE_URL=https://your-whatsapp-service.example.com
WHATSAPP_SERVICE_API_KEY=the-same-api-key
```

The existing `/api/channels/whatsapp` and `/api/channels/whatsapp/pair-code` routes proxy to this service, so the dashboard pairing UI can stay where it is.
