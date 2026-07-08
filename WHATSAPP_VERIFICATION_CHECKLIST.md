# WhatsApp Katabump ↔ Vercel Communication Verification Checklist

Use this checklist to verify that the WhatsApp backend and frontend are correctly configured and communicating.

## Pre-Deployment Checklist

### Katabump Server Setup

- [ ] Katabump Node.js server created
- [ ] Server IP address noted
- [ ] kdns.fr subdomain registered (e.g., `gabriel-whatsapp.kdns.fr`)
- [ ] DNS pointing to Katabump IP verified
- [ ] DNS propagation confirmed (test with `nslookup gabriel-whatsapp.kdns.fr`)

### WhatsApp Service Deployment

- [ ] `whatsapp-service/` directory uploaded to Katabump
- [ ] `.env` file created with correct values:
  - [ ] `API_KEY` set to a strong random value
  - [ ] `ALLOWED_ORIGINS` includes Vercel URL
  - [ ] `SESSION_PATH` set to persistent storage path
- [ ] `npm ci && npm run build` completed successfully
- [ ] Service started with `npm start` or `node index.js`

### Vercel Configuration

- [ ] `WHATSAPP_SERVICE_URL` environment variable set to Katabump URL
- [ ] `WHATSAPP_SERVICE_API_KEY` environment variable set (matches Katabump `API_KEY`)
- [ ] Application redeployed after environment variables added
- [ ] Deployment completed successfully

## Post-Deployment Verification

### Health Check

- [ ] Katabump service health endpoint responds:
  ```bash
  curl https://gabriel-whatsapp.kdns.fr/health
  ```
  Expected: HTTP 200 with JSON payload

- [ ] Vercel app is accessible:
  ```bash
  curl https://gabrielagent.vercel.app
  ```
  Expected: HTTP 200 with HTML

### API Key Authentication

- [ ] Katabump rejects requests without API key:
  ```bash
  curl https://gabriel-whatsapp.kdns.fr/api/whatsapp/pair \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"sessionId":"default","phoneNumber":"6281376552730"}'
  ```
  Expected: HTTP 401 with error message

- [ ] Katabump accepts requests with correct API key:
  ```bash
  curl https://gabriel-whatsapp.kdns.fr/api/whatsapp/pair \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_API_KEY" \
    -d '{"sessionId":"default","phoneNumber":"6281376552730"}'
  ```
  Expected: HTTP 200 with pairing code

### CORS Configuration

- [ ] Katabump allows requests from Vercel origin:
  ```bash
  curl -i https://gabriel-whatsapp.kdns.fr/health \
    -H "Origin: https://gabrielagent.vercel.app"
  ```
  Expected: Response includes `Access-Control-Allow-Origin: https://gabrielagent.vercel.app`

### Frontend Integration

- [ ] Dashboard WhatsApp page loads without errors:
  1. Log in to `https://gabrielagent.vercel.app`
  2. Navigate to **Channels** → **WhatsApp**
  3. Check browser console for errors

- [ ] Web mode QR code generation works:
  1. Select **WhatsApp Web** mode
  2. Click **Connect**
  3. QR code appears within 5 seconds
  4. Browser console shows no errors

- [ ] Pairing code generation works:
  1. Select **Pairing Code** mode
  2. Enter a phone number (e.g., `6281376552730`)
  3. Click **Connect**
  4. Pairing code appears within 10 seconds
  5. Browser console shows no errors

- [ ] API mode credentials save:
  1. Select **API** mode
  2. Enter API key and phone number
  3. Click **Connect**
  4. Success message appears
  5. Browser console shows no errors

### Proxy Endpoint Verification

- [ ] Vercel proxy endpoint works:
  ```bash
  curl "https://gabrielagent.vercel.app/api/channels/whatsapp/pair-code?number=6281376552730"
  ```
  Expected: HTTP 200 with pairing code

- [ ] Proxy endpoint returns correct format:
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

### Session Persistence

- [ ] Sessions survive Katabump service restart:
  1. Connect WhatsApp successfully
  2. Restart the Katabump service
  3. Verify WhatsApp is still connected
  4. If not connected, check `SESSION_PATH` is on persistent storage

### Monitoring and Logging

- [ ] Katabump logs show successful requests:
  ```bash
  # Check Katabump logs for:
  # - POST /api/whatsapp/pair requests
  # - Authorization header validation
  # - Session creation messages
  ```

- [ ] Vercel logs show no errors:
  1. Open Vercel project dashboard
  2. Check **Deployments** → **Logs** for errors
  3. Look for `WHATSAPP_SERVICE_URL` or `WHATSAPP_SERVICE_API_KEY` errors

## Troubleshooting Verification

### If QR Code Does Not Appear

- [ ] Verify `WHATSAPP_SERVICE_URL` is correct in Vercel
- [ ] Verify `WHATSAPP_SERVICE_API_KEY` matches Katabump `API_KEY`
- [ ] Check browser console for CORS errors
- [ ] Verify Katabump service is running: `curl https://gabriel-whatsapp.kdns.fr/health`
- [ ] Check Katabump logs for authentication failures

### If Pairing Code Does Not Appear

- [ ] Verify phone number format is correct (digits only)
- [ ] Verify Katabump service is running
- [ ] Check Katabump logs for pairing errors
- [ ] Verify `ALLOWED_ORIGINS` includes Vercel URL

### If Sessions Reset After Redeploy

- [ ] Verify `SESSION_PATH` is set in Katabump `.env`
- [ ] Verify `SESSION_PATH` points to persistent storage
- [ ] Check if Katabump has persistent volume configured
- [ ] If using ephemeral storage, sessions will reset on redeploy (expected behavior)

## Final Verification

- [ ] All items in this checklist are completed
- [ ] No errors in browser console
- [ ] No errors in Vercel logs
- [ ] No errors in Katabump logs
- [ ] WhatsApp connection works end-to-end
- [ ] Sessions persist across service restarts
- [ ] Team members can successfully connect WhatsApp

## Sign-Off

- [ ] Verified by: ________________
- [ ] Date: ________________
- [ ] Notes: ________________

---

**If any items fail, refer to the troubleshooting guide in `WHATSAPP_KATABUMP_SETUP.md`.**
