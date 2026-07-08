# WhatsApp Katabump ↔ Vercel Communication Setup Guide

This guide ensures the WhatsApp backend (hosted on Katabump) communicates correctly with the Gabriel frontend (hosted on Vercel).

## Architecture Overview

The Gabriel app uses a **split architecture** for WhatsApp:

- **Frontend (Vercel):** Next.js dashboard at `https://gabrielagent.vercel.app`
- **Backend (Katabump):** Standalone WhatsApp service at `https://gabriel-whatsapp.kdns.fr` (or your custom domain)
- **Communication:** The Vercel app proxies WhatsApp requests to Katabump using environment variables and API key authentication

## Step 1: Deploy WhatsApp Service to Katabump

### 1.1 Create a Katabump Server

1. Log in to [dashboard.katabump.com](https://dashboard.katabump.com)
2. Create a new **Node.js** server
3. Note the server IP address

### 1.2 Register a kdns.fr Subdomain

1. Visit [kdns.fr](https://kdns.fr)
2. Register a free subdomain (e.g., `gabriel-whatsapp.kdns.fr`)
3. Point the DNS to your Katabump server IP
4. Wait for DNS propagation (usually 5-10 minutes)

### 1.3 Upload WhatsApp Service

1. Zip the `whatsapp-service/` directory from the Gabriel project
2. Upload to Katabump via SFTP to `/home/container` or use the web upload
3. Extract the ZIP file

### 1.4 Configure Environment Variables

Create a `.env` file in `/home/container/whatsapp-service/` with:

```env
# Port (Katabump will assign this automatically)
PORT=3000

# API Key - must match WHATSAPP_SERVICE_API_KEY on Vercel
API_KEY="your-secure-random-api-key-here"

# Allow your Vercel frontend to call this service
ALLOWED_ORIGINS="https://gabrielagent.vercel.app,http://localhost:3000,http://localhost:3001"

# Persistent session storage
SESSION_PATH="./sessions"
SESSION_STORE="file"
LOG_LEVEL="info"
```

**Important:** Generate a strong, random `API_KEY`. You will use the same value on Vercel.

### 1.5 Start the Service

1. On the **Startup** tab, set the entry point to `npm start` or `node index.js`
2. Run the install command: `npm ci && npm run build`
3. Click **Start** to launch the service

### 1.6 Verify the Service

Test the health endpoint:

```bash
curl https://gabriel-whatsapp.kdns.fr/health
```

Expected response:

```json
{
  "ok": true,
  "status": "disconnected",
  "connectionStatus": "disconnected",
  "connected": false,
  "sessionId": "default",
  "sessions": [],
  "uptime": 123.45,
  "publicUrl": "https://gabriel-whatsapp.kdns.fr",
  "timestamp": "2026-07-08T12:00:00.000Z"
}
```

## Step 2: Configure Vercel Environment Variables

### 2.1 Set Environment Variables on Vercel

1. Log in to [vercel.com](https://vercel.com)
2. Open your Gabriel project
3. Go to **Settings** → **Environment Variables**
4. Add the following variables:

| Variable | Value | Notes |
|----------|-------|-------|
| `WHATSAPP_SERVICE_URL` | `https://gabriel-whatsapp.kdns.fr` | Replace with your actual kdns.fr subdomain |
| `WHATSAPP_SERVICE_API_KEY` | `your-secure-random-api-key-here` | Must match the `API_KEY` on Katabump |

### 2.2 Redeploy the Application

1. After adding environment variables, redeploy the Gabriel app
2. Vercel will rebuild and restart the application with the new variables

## Step 3: Test the Communication

### 3.1 Test from the Dashboard

1. Log in to the Gabriel dashboard at `https://gabrielagent.vercel.app`
2. Navigate to **Channels** → **WhatsApp**
3. Select a connection method (Web, API, or Pairing Code)
4. Click **Connect**

Expected behavior:

- **Web mode:** A QR code appears within 5 seconds
- **Pairing Code mode:** A pairing code appears within 10 seconds
- **API mode:** Credentials are saved immediately

### 3.2 Test from the Command Line

Test the Katabump service directly:

```bash
curl -X POST https://gabriel-whatsapp.kdns.fr/api/whatsapp/pair \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secure-random-api-key-here" \
  -d '{"sessionId":"default","phoneNumber":"6281376552730"}'
```

Expected response:

```json
{
  "success": true,
  "sessionId": "default",
  "pairingCode": "XXXX-XXXX",
  "status": "waiting"
}
```

### 3.3 Test from Vercel via the Proxy

Test the Vercel proxy endpoint:

```bash
curl "https://gabrielagent.vercel.app/api/channels/whatsapp/pair-code?number=6281376552730"
```

Expected response:

```json
{
  "code": "XXXX-XXXX",
  "pairingCode": "XXXX-XXXX",
  "sessionId": "default",
  "phone": "6281376552730",
  "status": "waiting",
  "timestamp": "2026-07-08T12:00:00.000Z",
  "expiresIn": 300
}
```

## Step 4: Troubleshooting

### Issue: "WHATSAPP_SERVICE_URL is not configured"

**Solution:** Ensure `WHATSAPP_SERVICE_URL` is set in Vercel environment variables and the app is redeployed.

### Issue: "Invalid or missing API key"

**Solution:** Verify that `WHATSAPP_SERVICE_API_KEY` on Vercel matches the `API_KEY` on Katabump exactly.

### Issue: CORS error in browser console

**Solution:** Ensure `ALLOWED_ORIGINS` on Katabump includes your Vercel URL (`https://gabrielagent.vercel.app`).

### Issue: "Connection timeout" or "Service unreachable"

**Solution:**
1. Verify the kdns.fr subdomain is pointing to the correct Katabump IP
2. Check that the Katabump service is running: `curl https://gabriel-whatsapp.kdns.fr/health`
3. Ensure the Katabump firewall allows port 443 (HTTPS)

### Issue: WhatsApp sessions reset after Katabump redeploy

**Solution:** Ensure `SESSION_PATH` is set to a persistent storage location on Katabump. If using ephemeral storage, sessions will be lost on redeploy.

## Communication Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ Browser / Dashboard                                         │
│ (https://gabrielagent.vercel.app)                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ 1. User clicks "Connect WhatsApp"
                       │
┌──────────────────────▼──────────────────────────────────────┐
│ Vercel Frontend (Next.js)                                   │
│ /api/channels/whatsapp/pair-code                            │
│ - Reads WHATSAPP_SERVICE_URL env var                        │
│ - Reads WHATSAPP_SERVICE_API_KEY env var                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ 2. POST with Authorization header
                       │    Bearer <API_KEY>
                       │
┌──────────────────────▼──────────────────────────────────────┐
│ Katabump Backend (Node.js)                                  │
│ https://gabriel-whatsapp.kdns.fr/api/whatsapp/pair          │
│ - Validates Authorization header against API_KEY            │
│ - Checks ALLOWED_ORIGINS for CORS                           │
│ - Generates WhatsApp pairing code                           │
│ - Stores session in SESSION_PATH                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ 3. Response with pairing code
                       │
┌──────────────────────▼──────────────────────────────────────┐
│ Vercel Frontend                                             │
│ - Displays pairing code to user                             │
│ - Polls /api/channels/whatsapp/status for updates           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ 4. User scans QR / enters pairing code
                       │
┌──────────────────────▼──────────────────────────────────────┐
│ WhatsApp App (on user's phone)                              │
│ - Connects to Katabump service                              │
│ - Establishes encrypted session                             │
└─────────────────────────────────────────────────────────────┘
```

## Environment Variable Reference

### Vercel (Frontend)

| Variable | Example | Required | Description |
|----------|---------|----------|-------------|
| `WHATSAPP_SERVICE_URL` | `https://gabriel-whatsapp.kdns.fr` | Yes | Public URL of the Katabump WhatsApp service |
| `WHATSAPP_SERVICE_API_KEY` | `your-secure-api-key` | Yes | API key for authentication with Katabump |

### Katabump (Backend)

| Variable | Example | Required | Description |
|----------|---------|----------|-------------|
| `PORT` | `3000` | No | Port to listen on (Katabump assigns automatically) |
| `API_KEY` | `your-secure-api-key` | Yes | Must match `WHATSAPP_SERVICE_API_KEY` on Vercel |
| `ALLOWED_ORIGINS` | `https://gabrielagent.vercel.app` | Yes | Comma-separated list of allowed frontend URLs |
| `SESSION_PATH` | `./sessions` | No | Directory for persistent session storage |
| `SESSION_STORE` | `file` | No | Session storage backend (`file`, `postgres`, `redis`, `s3`) |
| `LOG_LEVEL` | `info` | No | Logging level (`debug`, `info`, `warn`, `error`) |

## Next Steps

1. Deploy the WhatsApp service to Katabump following Step 1
2. Configure Vercel environment variables following Step 2
3. Test the communication following Step 3
4. Monitor the logs for any issues
5. Use the troubleshooting guide if needed

For more information, see:
- [WhatsApp Service README](./whatsapp-service/README.md)
- [Channel Setup Documentation](./docs/wiki/Channel-Setup.md)
- [WhatsApp Channel Documentation](./docs/wiki/WhatsApp-Channel.md)
