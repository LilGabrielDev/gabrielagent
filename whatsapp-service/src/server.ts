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
  phoneNumber: z.string().min(10),
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
    request.path === "/api/health" ||
    request.path === "/health" ||
    request.path === "/status"
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
