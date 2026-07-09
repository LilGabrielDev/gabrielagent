import compression from "compression";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { WebSocket, WebSocketServer } from "ws";
import pinoHttpImport from "pino-http";
import QRCode from "qrcode";
import { z } from "zod";
import { getAutoUpdateStatus, handleGitHubWebhook } from "./auto-updater.js";
import { config, isAllowedOrigin } from "./config.js";
import { HttpError } from "./http-error.js";
import { logger } from "./logger.js";
import { WhatsAppSessionManager } from "./session-manager.js";

const pairSchema = z.object({
  sessionId: z.string().min(1).default("default"),
  phoneNumber: z.string().trim().optional(),
});

const qrSchema = z.object({
  sessionId: z.string().min(1).default("default"),
});

const app = express();
const sessions = new WhatsAppSessionManager();
const pinoHttp = pinoHttpImport.default || pinoHttpImport;
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

app.set("trust proxy", true);

app.disable("x-powered-by");
app.use(helmet());
app.use(compression());
app.use(limiter);
app.post(
  "/api/github/webhook",
  express.raw({ type: "application/json", limit: "1mb" }),
  async (request, response, next) => {
    try {
      const rawBody = Buffer.isBuffer(request.body)
        ? request.body
        : Buffer.from(JSON.stringify(request.body || {}));
      response.status(202).json(await handleGitHubWebhook(request.headers, rawBody));
    } catch (error) {
      next(error);
    }
  }
);
app.use(express.json({ limit: "64kb" }));
app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin is not allowed by CORS: ${origin}`));
    },
    credentials: true,
  })
);
app.use(pinoHttp({ logger }));

app.use((request, _response, next) => {
  if (
    !config.apiKey ||
    request.path === "/" ||
    request.path === "/api/health" ||
    request.path === "/health" ||
    request.path === "/status" ||
    request.path === "/code" ||
    request.path === "/api/code"
  ) {
    next();
    return;
  }

  const bearer = request.header("authorization")?.replace(/^Bearer\s+/i, "");
  const apiKey = request.header("x-api-key");

  if (bearer === config.apiKey || apiKey === config.apiKey) {
    next();
    return;
  }

  next(new HttpError(401, "Invalid or missing API key"));
});

function getHealthPayload() {
  const statuses = sessions.listStatuses();
  const primary = statuses.find((session) => session.sessionId === "default") || statuses[0];

  return {
    ok: true,
    status: primary?.healthStatus || "disconnected",
    connectionStatus: primary?.status || "disconnected",
    connected: Boolean(primary?.connected),
    sessionId: primary?.sessionId || "default",
    sessions: statuses,
    uptime: process.uptime(),
    publicUrl: config.publicUrl,
    timestamp: new Date().toISOString(),
  };
}

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.get("/", (_request, response) => {
  response.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Gabriel WhatsApp Pairing</title>
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        font-family: Inter, Arial, sans-serif;
        background: radial-gradient(circle at top, #13203f 0%, #060816 55%, #03050b 100%);
        color: #f5f7ff;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
      }
      .card {
        width: min(960px, 100%);
        background: rgba(8, 13, 30, 0.92);
        border: 1px solid rgba(147, 197, 253, 0.2);
        border-radius: 24px;
        box-shadow: 0 24px 70px rgba(0, 0, 0, 0.35);
        overflow: hidden;
      }
      .hero {
        padding: 28px 28px 16px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
      }
      .hero h1 { margin: 0; font-size: 1.8rem; }
      .hero p { margin: 8px 0 0; color: #a8b0c6; line-height: 1.5; }
      .content { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 24px; padding: 24px 28px 28px; }
      .panel { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 18px; padding: 20px; }
      .qr-box { min-height: 320px; display: grid; place-items: center; }
      .qr-box img { width: min(280px, 100%); border-radius: 16px; background: white; padding: 10px; }
      .status { margin-top: 10px; color: #8ac4ff; font-size: 0.95rem; }
      form { display: grid; gap: 12px; }
      label { font-size: 0.95rem; color: #cbd5e1; }
      input { width: 100%; padding: 12px 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.16); background: rgba(255,255,255,0.06); color: white; font-size: 1rem; box-sizing: border-box; }
      button { border: none; border-radius: 999px; padding: 12px 16px; font-weight: 700; cursor: pointer; background: linear-gradient(90deg, #38bdf8, #6366f1); color: white; }
      button.secondary { background: rgba(255,255,255,0.12); color: #f8fafc; }
      .result { margin-top: 16px; padding: 14px; border-radius: 14px; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16,185,129,0.28); min-height: 62px; }
      .result strong { display: block; font-size: 1.1rem; margin-bottom: 4px; }
      .hint { font-size: 0.92rem; color: #9fb0c8; margin-top: 6px; }
      @media (max-width: 760px) { .content { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="hero">
        <h1>Gabriel WhatsApp Pairing</h1>
        <p>Open this page on your Render service to generate a live QR code automatically. Enter the WhatsApp number, click Get Code, and the pairing code will appear instantly.</p>
      </div>
      <div class="content">
        <div class="panel">
          <div class="qr-box" id="qrBox">
            <img id="qrImage" alt="WhatsApp QR code" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" />
          </div>
          <div class="status" id="statusText">Preparing QR session…</div>
        </div>
        <div class="panel">
          <form id="pairForm">
            <label for="phone">Phone number for pairing code (optional for QR)</label>
            <input id="phone" name="phone" placeholder="254712345678" />
            <button type="submit">Get Code</button>
            <button type="button" class="secondary" id="refreshBtn">Refresh QR</button>
          </form>
          <div class="result" id="resultBox">
            <strong>No pairing code yet</strong>
            <span>QR is generated automatically. Add a number if you want a pairing code.</span>
          </div>
          <div class="hint">The QR flow works without a number. The pairing code only needs a phone number.</div>
        </div>
      </div>
    </div>

    <script>
      const sessionId = 'default';
      const qrImage = document.getElementById('qrImage');
      const statusText = document.getElementById('statusText');
      const resultBox = document.getElementById('resultBox');
      const pairForm = document.getElementById('pairForm');
      const refreshBtn = document.getElementById('refreshBtn');

      async function setStatus(message) {
        statusText.textContent = message;
      }

      async function createSession() {
        try {
          await fetch('/api/session/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId })
          });
          await loadQr();
        } catch (error) {
          setStatus('Unable to start a WhatsApp session right now.');
        }
      }

      async function loadQr() {
        try {
          setStatus('Generating QR…');
          const response = await fetch('/api/session/' + encodeURIComponent(sessionId) + '/qr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId })
          });
          const payload = await response.json();
          if (payload && payload.qr) {
            qrImage.src = payload.qr;
            setStatus('Scan the QR with WhatsApp Linked Devices.');
          } else {
            setStatus('QR is not ready yet.');
          }
        } catch (error) {
          setStatus('QR generation failed.');
        }
      }

      pairForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const phone = document.getElementById('phone').value.trim().replace(/[^0-9]/g, '');
        if (!phone) {
          resultBox.innerHTML = '<strong>Need a number for pairing</strong><span>QR works without a number. Add a phone number to request a pairing code.</span>';
          return;
        }

        resultBox.innerHTML = '<strong>Generating pairing code…</strong><span>Please wait a moment.</span>';
        try {
          const response = await fetch('/api/session/' + encodeURIComponent(sessionId) + '/pair', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, phoneNumber: phone })
          });
          const payload = await response.json();
          if (payload && payload.pairingCode) {
            resultBox.innerHTML = '<strong>' + payload.pairingCode + '</strong><span>Open WhatsApp Linked Devices and enter this code.</span>';
          } else {
            resultBox.innerHTML = '<strong>Unable to generate code</strong><span>Try again in a moment.</span>';
          }
        } catch (error) {
          resultBox.innerHTML = '<strong>Pairing failed</strong><span>Please try again in a moment.</span>';
        }
      });

      refreshBtn.addEventListener('click', () => loadQr());
      createSession();
    </script>
  </body>
</html>`);
});

app.get("/code", async (request, response, next) => {
  try {
    const rawNumber = String(request.query.number || request.query.phone || "");
    const normalizedPhone = rawNumber.replace(/[^0-9]/g, "");

    if (!normalizedPhone || normalizedPhone.length < 6) {
      response.status(400).json({ success: false, error: "Please provide a valid WhatsApp number" });
      return;
    }

    const sessionId = typeof request.query.sessionId === "string" ? request.query.sessionId : "default";
    const result = await sessions.pair(sessionId, normalizedPhone);

    if (!result.pairingCode) {
      throw new HttpError(502, "Failed to generate pairing code");
    }

    response.json({
      success: true,
      code: result.pairingCode,
      number: normalizedPhone,
      sessionId,
      status: result.status,
      healthStatus: result.healthStatus,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/code", async (request, response, next) => {
  try {
    const rawNumber = String(request.query.number || request.query.phone || "");
    const normalizedPhone = rawNumber.replace(/[^0-9]/g, "");

    if (!normalizedPhone || normalizedPhone.length < 6) {
      response.status(400).json({ success: false, error: "Please provide a valid WhatsApp number" });
      return;
    }

    const sessionId = typeof request.query.sessionId === "string" ? request.query.sessionId : "default";
    const result = await sessions.pair(sessionId, normalizedPhone);

    if (!result.pairingCode) {
      throw new HttpError(502, "Failed to generate pairing code");
    }

    response.json({
      success: true,
      code: result.pairingCode,
      number: normalizedPhone,
      sessionId,
      status: result.status,
      healthStatus: result.healthStatus,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/health", (_request, response) => {
  response.json(getHealthPayload());
});

app.get("/status", (_request, response) => {
  response.json(getHealthPayload());
});

app.get("/session/state", (_request, response) => {
  response.json(sessions.getStatus("default"));
});

app.get("/api/admin/update", (_request, response) => {
  response.json(getAutoUpdateStatus());
});

async function toQrDataUrl(value: string | null | undefined) {
  if (!value) return null;
  if (value.startsWith("data:image/")) return value;
  try {
    return await QRCode.toDataURL(value, { width: 256, margin: 1 });
  } catch (error) {
    logger.warn({ error }, "Failed to render QR payload as PNG");
    return null;
  }
}

app.post("/api/session/create", async (request, response, next) => {
  try {
    const body = z.object({ sessionId: z.string().min(1).default("default") }).parse(request.body || {});
    response.json({ success: true, ...(await sessions.createSession(body.sessionId)) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/whatsapp/pair", async (request, response, next) => {
  try {
    const body = pairSchema.parse(request.body);
    const result = await sessions.pair(body.sessionId, body.phoneNumber);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/session/pair", async (request, response, next) => {
  try {
    const body = pairSchema.parse(request.body);
    const result = await sessions.pair(body.sessionId, body.phoneNumber);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/session/:sessionId/qr", async (request, response, next) => {
  try {
    const body = qrSchema.parse(request.body || {});
    const sessionId = request.params.sessionId || body.sessionId;
    const result = await sessions.startQr(sessionId);
    const qr = await toQrDataUrl(result.qr);
    response.json({
      success: true,
      sessionId: result.sessionId || sessionId,
      pairingCode: result.pairingCode ?? null,
      qr,
      status: result.status,
      healthStatus: result.healthStatus,
      format: "png",
      mimeType: "image/png",
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/whatsapp/qr", async (request, response, next) => {
  try {
    const body = qrSchema.parse(request.body);
    const result = await sessions.startQr(body.sessionId);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/session/qr", async (request, response, next) => {
  try {
    const body = qrSchema.parse(request.body);
    const result = await sessions.startQr(body.sessionId);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/session/:sessionId/pair", async (request, response, next) => {
  try {
    const body = pairSchema.parse(request.body || {});
    const sessionId = request.params.sessionId || body.sessionId;
    const result = await sessions.pair(sessionId, body.phoneNumber);
    response.json({
      success: true,
      sessionId: result.sessionId || sessionId,
      pairingCode: result.pairingCode ?? null,
      qr: result.qr ?? null,
      status: result.status,
      healthStatus: result.healthStatus,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/session/:sessionId/status", (request, response, next) => {
  try {
    response.json(sessions.getStatus(request.params.sessionId));
  } catch (error) {
    next(error);
  }
});

app.get("/api/session/:sessionId/qr", async (request, response, next) => {
  try {
    const status = sessions.getStatus(request.params.sessionId);
    const qr = await toQrDataUrl(status.qr);
    response.json({ success: true, sessionId: request.params.sessionId, qr, format: "png", mimeType: "image/png", status });
  } catch (error) {
    next(error);
  }
});

app.get("/api/session/:sessionId/pair", (request, response, next) => {
  try {
    const status = sessions.getStatus(request.params.sessionId);
    response.json({ success: true, sessionId: request.params.sessionId, pairingCode: status.pairingCode });
  } catch (error) {
    next(error);
  }
});

app.get("/api/session/:sessionId/events", (request, response) => {
  response.setHeader("Content-Type", "text/event-stream");
  response.setHeader("Cache-Control", "no-cache");
  response.setHeader("Connection", "keep-alive");
  response.setHeader("X-Accel-Buffering", "no");
  response.flushHeaders?.();

  const sessionId = request.params.sessionId;
  const send = (payload: unknown) => {
    response.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  const initial = sessions.getStatus(sessionId);
  send({ event: "status", ...initial });

  const unsubscribe = sessions.onEvent((event) => {
    if (event.sessionId !== sessionId) return;
    send({
      event: event.event,
      sessionId: event.sessionId,
      status: event.status,
      healthStatus: event.healthStatus,
      connected: event.connected,
      qr: event.qr,
      pairingCode: event.pairingCode,
      phoneNumber: event.phoneNumber,
      error: event.error,
      updatedAt: event.updatedAt,
    });
  });

  request.on("close", () => {
    unsubscribe();
    response.end();
  });
});

app.delete("/api/session/:sessionId", async (request, response, next) => {
  try {
    response.json(await sessions.logout(request.params.sessionId));
  } catch (error) {
    next(error);
  }
});

app.get("/api/whatsapp/status/:sessionId", (request, response, next) => {
  try {
    response.json(sessions.getStatus(request.params.sessionId));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/whatsapp/logout/:sessionId", async (request, response, next) => {
  try {
    response.json(await sessions.logout(request.params.sessionId));
  } catch (error) {
    next(error);
  }
});

app.post("/session/logout", async (request, response, next) => {
  try {
    const body = qrSchema.parse(request.body || {});
    response.json(await sessions.logout(body.sessionId));
  } catch (error) {
    next(error);
  }
});

app.post("/api/whatsapp/reconnect/:sessionId", async (request, response, next) => {
  try {
    response.json(await sessions.reconnect(request.params.sessionId));
  } catch (error) {
    next(error);
  }
});

app.post("/session/restart", async (request, response, next) => {
  try {
    const body = qrSchema.parse(request.body || {});
    response.json(await sessions.reconnect(body.sessionId));
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  void _next;

  if (error instanceof z.ZodError) {
    response.status(400).json({
      success: false,
      error: "Invalid request body",
      issues: error.issues,
    });
    return;
  }

  if (error instanceof HttpError) {
    response.status(error.statusCode).json({
      success: false,
      error: error.message,
    });
    return;
  }

  logger.error({ error }, "Unhandled request error");
  response.status(500).json({
    success: false,
    error: "Internal server error",
  });
});

async function start() {
  try {
    await sessions.bootstrap();

    const bindHost = process.env.HOST || "0.0.0.0";
    const server = app.listen(config.port, bindHost, () => {
      logger.info(
        {
          port: config.port,
          sessionPath: config.sessionPath,
          sessionStore: config.sessionStore,
          corsOrigins: config.corsOrigins,
          publicUrl: config.publicUrl,
          authEnabled: Boolean(config.apiKey),
        },
        "WhatsApp service listening"
      );
    });

    const sockets = new Set<WebSocket>();
    const websocketServer = new WebSocketServer({ server, path: "/ws" });

    function send(socket: WebSocket, payload: unknown) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(payload));
      }
    }

    websocketServer.on("connection", (socket, request) => {
      const origin = request.headers.origin;
      if (!isAllowedOrigin(origin)) {
        socket.close(1008, "Origin is not allowed");
        return;
      }

      sockets.add(socket);
      send(socket, {
        event: "ready",
        sessionId: "default",
        status: sessions.getStatus("default"),
      });

      socket.on("close", () => sockets.delete(socket));
    });

    sessions.onEvent((event) => {
      for (const socket of sockets) {
        send(socket, event);
      }
    });

    function shutdown(signal: string) {
      logger.info({ signal }, "Shutting down WhatsApp service");
      websocketServer.close();
      server.close(() => process.exit(0));
    }

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    logger.error({ error }, "Failed to start WhatsApp service");
    process.exit(1);
  }
}

void start();
