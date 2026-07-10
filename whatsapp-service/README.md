# WhatsApp Backend API

This service provides a unified API for managing WhatsApp sessions using either `whatsapp-web.js` or `Baileys` as the underlying engine.

## API Endpoints

### 1. Create Session
`POST /api/session/create`
- Body: `{ "sessionId": "optional_id", "engine": "baileys" | "whatsapp-web.js" }`
- Response: `{ "success": true, "sessionId": "abc123" }`

### 2. Request Pairing Code
`POST /api/session/pairing`
- Body: `{ "sessionId": "abc123", "phoneNumber": "254712345678" }`
- Response: `{ "success": true, "pairingCode": "A1B2-C3D4" }`

### 3. Get QR Code
`POST /api/session/qr`
- Body: `{ "sessionId": "abc123" }`
- Response: `{ "success": true, "qr": "data:image/png;base64,..." }`

### 4. Get Status
`GET /api/session/status/:sessionId`
- Response: `{ "status": "waiting_qr" | "ready" | ... }`

### 5. Disconnect
`POST /api/session/disconnect`
- Body: `{ "sessionId": "abc123" }`
- Response: `{ "success": true }`

## Socket.IO Events
Connect to the server with `sessionId` as a query parameter.
- `qr`: Emitted when a new QR code is generated.
- `pairing`: Emitted when a pairing code is generated.
- `authenticated`: Emitted when the session is authenticated.
- `ready`: Emitted when the client is ready.
- `status`: Emitted on any status change.
- `disconnected`: Emitted when the client disconnects.
- `error`: Emitted on error.

## Deployment
This project is configured for deployment on **Render** using the provided `Dockerfile`. Ensure you have the necessary environment variables set (e.g., `PORT`).
