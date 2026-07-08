# Gabriel WhatsApp Service

Standalone WhatsApp pairing and session service for Gabriel. Deploy this service on Render, Railway, Katabump, Fly.io, a VPS, Docker, or PM2, then point the Vercel app at it with `WHATSAPP_SERVICE_URL` when the frontend is not already configured.

## API

- `POST /api/whatsapp/pair`
  - Body: `{ "sessionId": "default", "phoneNumber": "15551234567" }`
  - Returns: `{ "success": true, "sessionId": "default", "pairingCode": "XXXX-XXXX", "status": "waiting" }`
- `GET /api/whatsapp/status/:sessionId`
- `DELETE /api/whatsapp/logout/:sessionId`
- `POST /api/whatsapp/reconnect/:sessionId`
- `GET /health`
- `GET /api/health`

If `API_KEY` is set, send either `Authorization: Bearer <API_KEY>` or `x-api-key: <API_KEY>`. Leave it unset for zero-config frontend proxy access.

## Environment

No environment variables are required. Optional overrides:

```env
PORT=3000
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

Create a Web Service with root directory `whatsapp-service`, build command `npm ci && npm run build`, and start command `npm start`. Add a persistent disk mounted at `/app/sessions` and set only `SESSION_PATH=/app/sessions` if you want sessions to survive redeploys; the service otherwise boots with `PORT`, CORS, and auth defaults.

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
WHATSAPP_SERVICE_URL=https://your-whatsapp-service.example.com
WHATSAPP_SERVICE_API_KEY=the-same-api-key
```

The existing `/api/channels/whatsapp` and `/api/channels/whatsapp/pair-code` routes proxy to this service, so the dashboard pairing UI can stay where it is.
