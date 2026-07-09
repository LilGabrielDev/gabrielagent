# Gabriel WhatsApp Service

Standalone WhatsApp pairing and session service for Gabriel. Deploy this service on Render, Railway, Katabump, Fly.io, a VPS, Docker, or PM2, then point the Vercel app at it with `NEXT_PUBLIC_BACKEND_URL`.

## API

- `POST /api/whatsapp/pair`
  - Body: `{ "sessionId": "default", "phoneNumber": "15551234567" }`
  - Returns: `{ "success": true, "sessionId": "default", "pairingCode": "XXXX-XXXX", "status": "waiting" }`
- `GET /api/whatsapp/status/:sessionId`
- `DELETE /api/whatsapp/logout/:sessionId`
- `POST /api/whatsapp/reconnect/:sessionId`
- `GET /health`
- `GET /api/health`
- `GET /status`
- `GET /session/state`
- `POST /session/qr`
- `POST /session/pair`
- `POST /session/logout`
- `POST /session/restart`
- `WS /ws`

Realtime events: `loading`, `qr`, `pairing_code`, `authenticated`, `connected`, `ready`, `disconnected`, and `error`.

If `API_KEY` is set, send either `Authorization: Bearer <API_KEY>` or `x-api-key: <API_KEY>`. Leave it unset for zero-config frontend proxy access.

## Environment

Local development can run with defaults. Production must set `NODE_ENV=production` and `FRONTEND_URL`; Render supplies `PORT`.

```env
PORT=3000
NODE_ENV=development
FRONTEND_URL=https://gabrielagent.vercel.app
API_KEY=
ALLOWED_ORIGINS=https://gabrielagent.vercel.app,http://localhost:3000,http://localhost:3001
SESSION_STORE=file
SESSION_PATH=./sessions
LOG_LEVEL=info
```

`SESSION_STORE` defaults to `file`. The code is isolated behind a store adapter so `SESSION_STORE=postgres`, `redis`, or `s3` can be wired without changing the WhatsApp session manager. File storage still needs a persistent disk or volume to survive redeploys on ephemeral hosts.

## Local Development

```bash
npm install
npm run dev
```

Pair:

```bash
curl -X POST http://localhost:3000/api/whatsapp/pair \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"default\",\"phoneNumber\":\"15551234567\"}"
```

## Docker

```bash
docker compose up --build -d
```

The compose file mounts `whatsapp_sessions` at `/app/sessions`.

## Render

Use the root `render.yaml` Blueprint or create a Web Service with root directory `whatsapp-service`, build command `npm ci && npm run build`, start command `npm start`, and health check path `/health`. Add a persistent disk mounted at `/app/sessions` and set `SESSION_PATH=/app/sessions` so LocalAuth sessions survive Render restarts. Set `FRONTEND_URL` to the production Vercel URL.

Render's GitHub integration should have auto deploy enabled for the default branch. The included `render.yaml` sets `autoDeploy: true`, so future pushes redeploy only the backend service.

## Railway

Deploy the `whatsapp-service` directory and use `npm start`. Add a volume and set `SESSION_PATH` to that mounted path for persistent WhatsApp auth; no `API_KEY` or CORS env is required unless you intentionally lock the service down.

## Katabump

1. Create a **Node.js** server on [dashboard.katabump.com](https://dashboard.katabump.com).
2. Register a free subdomain at **kdns.fr** (e.g. `gabriel-whatsapp.kdns.fr`) and point DNS to your Katabump server IP.
3. Upload the `whatsapp-service` folder (ZIP or SFTP to `/home/container`).
4. Copy `.env.example` to `.env` and set `API_KEY` plus `ALLOWED_ORIGINS` (include your Gabriel Vercel URL).
5. On the **Startup** tab, set the entry to `index.js` (or use `npm start` if the egg supports it).
6. Run `npm ci && npm run build`, then **Start** the server.
7. Verify: `GET https://gabriel-whatsapp.kdns.fr/health`

On the Gabriel app (Vercel or local `.env`):

```env
WHATSAPP_SERVICE_URL="https://gabriel-whatsapp.kdns.fr"
WHATSAPP_SERVICE_API_KEY="the-same-api-key"
```

Replace `gabriel-whatsapp.kdns.fr` with your actual kdns.fr subdomain. If Katabump gives you persistent storage, set `SESSION_PATH` to that mount; otherwise sessions reset on redeploy and WhatsApp must be re-paired.

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
- Startup command: `npm start` or `node index.js`
- Variables: set `PORT` to the allocated port, set `API_KEY`, `CORS_ORIGIN`, and `SESSION_PATH=./sessions`

Do not delete the `sessions` directory between restarts.

## Vercel Integration

Set these variables in the existing Vercel app:

```env
NEXT_PUBLIC_BACKEND_URL=https://your-whatsapp-service.onrender.com
```

The dashboard connects to `/session/qr`, `/session/pair`, and `/ws` through `NEXT_PUBLIC_BACKEND_URL`. The existing `/api/channels/whatsapp` and `/api/channels/whatsapp/pair-code` routes remain as server-side compatibility proxies.
