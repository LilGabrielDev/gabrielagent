# WhatsApp Backend Architecture Design

## Overview
The goal is to refactor the existing WhatsApp backend (currently using Baileys) to support both `whatsapp-web.js` and `Baileys` as underlying engines. The API contract must remain unchanged so that any frontend can consume it without modifications. The backend will be deployed on Render.

## Core Components

### 1. Session Manager (`session-manager.ts`)
The central orchestrator that manages multiple WhatsApp sessions. It will delegate engine-specific operations to the appropriate provider.
- Maintains a map of active sessions.
- Handles session lifecycle (create, connect, disconnect, logout).
- Emits unified events (QR, pairing code, status changes) via an `EventEmitter`.

### 2. Provider Abstraction (`providers/base.ts`)
An interface or abstract class defining the contract that both engines must implement.
- `connect(sessionId: string, phoneNumber?: string): Promise<void>`
- `requestPairingCode(phoneNumber: string): Promise<string>`
- `logout(): Promise<void>`
- `disconnect(): Promise<void>`
- `on(event: string, listener: Function): void`

### 3. Engine Implementations
- **Baileys Provider (`providers/baileys.ts`)**: Wraps the existing Baileys implementation.
- **WhatsApp-Web.js Provider (`providers/whatsapp-web.ts`)**: Implements the provider interface using `whatsapp-web.js`.

### 4. Session Store (`session-store.ts`)
Handles persistent storage of session data (auth credentials).
- Needs to support both Baileys (multi-file auth state) and whatsapp-web.js (LocalAuth or custom strategy).

### 5. REST API (`server.ts`)
Exposes endpoints for session management.
- `POST /api/session/create`
- `POST /api/session/pairing` (or `/api/session/:sessionId/pair`)
- `POST /api/session/qr` (or `/api/session/:sessionId/qr`)
- `GET /api/session/status/:sessionId`
- `POST /api/session/disconnect`

### 6. Socket.IO Integration (`socket.ts`)
Replaces or augments the existing `ws` implementation with `Socket.IO` as requested in the requirements.
- Emits events: `qr`, `pairing`, `authenticated`, `ready`, `status`, `disconnected`, `error`.

## File Layout
```
whatsapp-service/
├── src/
│   ├── providers/
│   │   ├── base.ts
│   │   ├── baileys.ts
│   │   └── whatsapp-web.ts
│   ├── server.ts
│   ├── socket.ts
│   ├── session-manager.ts
│   ├── session-store.ts
│   ├── config.ts
│   ├── logger.ts
│   └── http-error.ts
├── package.json
├── tsconfig.json
└── index.js
```

## Migration Strategy
1. Install `whatsapp-web.js` and `socket.io`.
2. Create the provider abstraction.
3. Move existing Baileys logic into `baileys.ts`.
4. Implement `whatsapp-web.ts`.
5. Update `session-manager.ts` to use providers based on configuration or session creation parameters.
6. Replace `ws` with `socket.io` in `server.ts` or a dedicated `socket.ts`.
7. Ensure all REST endpoints match the requested API contract.
8. Test locally, then prepare for Render deployment.
