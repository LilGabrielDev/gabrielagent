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
  phoneNumber: z.string().trim().optional().default(""),
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
    status: primary?.status || "disconnected",
    healthStatus: primary?.healthStatus || "disconnected",
    sessions: statuses.length,
    active: statuses.filter((s) => s.connected).length,
    version: "1.0.0",
    uptime: process.uptime(),
    autoUpdate: getAutoUpdateStatus(),
  };
}

app.get("/", (_request, response) => {
  response.json(getHealthPayload());
});

app.get("/api/health", (_request, response) => {
  response.json(getHealthPayload());
});

app.get("/health", (_request, response) => {
  response.json(getHealthPayload());
});

app.get("/status", (_request, response) => {
  response.json(getHealthPayload());
});

app.get("/code", async (request, response, next) => {
  try {
    const sessionId = String(request.query.sessionId || "default");
    const phoneNumber = String(request.query.number || request.query.phone || "");
    const normalizedPhone = phoneNumber.replace(/[^0-9]/g, "");

    if (!normalizedPhone) {
      throw new HttpError(400, "A valid phoneNumber is required via ?number= or ?phone=");
    }

    const result = await sessions.pair(sessionId, normalizedPhone);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/code", async (request, response, next) => {
  try {
    const sessionId = String(request.query.sessionId || "default");
    const phoneNumber = String(request.query.number || request.query.phone || "");
    const normalizedPhone = phoneNumber.replace(/[^0-9]/g, "");

    if (!normalizedPhone) {
      throw new HttpError(400, "A valid phoneNumber is required via ?number= or ?phone=");
    }

    const result = await sessions.pair(sessionId, normalizedPhone);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

async function toQrDataUrl(value: string | null) {
  if (!value) return null;
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
    const phoneNumber = body.phoneNumber;
    if (!phoneNumber) {
      throw new HttpError(400, "phoneNumber is required");
    }
    const result = await sessions.pair(body.sessionId, phoneNumber);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/session/pair", async (request, response, next) => {
  try {
    const body = pairSchema.parse(request.body);
    const phoneNumber = body.phoneNumber;
    if (!phoneNumber) {
      throw new HttpError(400, "phoneNumber is required");
    }
    const result = await sessions.pair(body.sessionId, phoneNumber);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/session/:sessionId/qr", async (request, response, next) => {
  try {
    const body = qrSchema.parse(request.body || {});
    const sessionId = request.params.sessionId ?? body.sessionId ?? "default";
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
    const sessionId = request.params.sessionId ?? body.sessionId ?? "default";
    const phoneNumber = body.phoneNumber;
    if (!phoneNumber) {
      throw new HttpError(400, "phoneNumber is required");
    }
    const result = await sessions.pair(sessionId, phoneNumber);
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
    const sessionId = request.params.sessionId ?? "default";
    response.json(sessions.getStatus(sessionId));
  } catch (error) {
    next(error);
  }
});

app.post("/api/session/:sessionId/logout", async (request, response, next) => {
  try {
    const sessionId = request.params.sessionId ?? "default";
    response.json(await sessions.logout(sessionId));
  } catch (error) {
    next(error);
  }
});

app.post("/api/session/:sessionId/reconnect", async (request, response, next) => {
  try {
    const sessionId = request.params.sessionId ?? "default";
    response.json(await sessions.reconnect(sessionId));
  } catch (error) {
    next(error);
  }
});

app.post("/api/session/disconnect", async (request, response, next) => {
  try {
    const body = z.object({ sessionId: z.string().min(1).default("default") }).parse(request.body || {});
    response.json(await sessions.logout(body.sessionId));
  } catch (error) {
    next(error);
  }
});

app.use((error: any, _request: Request, response: Response, _next: NextFunction) => {
  const status = error.status || error.statusCode || 500;
  const message = error.message || "Internal Server Error";

  if (status >= 500) {
    logger.error({ error }, "Unhandled request error");
  }

  response.status(status).json({
    success: false,
    status,
    message,
  });
});

const port = Number(process.env.PORT || 3000);
const server = app.listen(port, "0.0.0.0", () => {
  logger.info({ port }, "WhatsApp service API listening");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws: WebSocket, request: Request) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  const sessionId = url.searchParams.get("sessionId") || "default";

  logger.info({ sessionId }, "WebSocket client connected");

  const cleanup = sessions.onEvent((event) => {
    if (event.sessionId === sessionId) {
      ws.send(JSON.stringify(event));
    }
  });

  ws.on("close", () => {
    logger.info({ sessionId }, "WebSocket client disconnected");
    cleanup();
  });

  ws.send(
    JSON.stringify({
      event: "status",
      ...sessions.getStatus(sessionId),
    })
  );
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error({ reason, promise }, "Unhandled Rejection");
});

process.on("uncaughtException", (error) => {
  logger.error({ error }, "Uncaught Exception");
  process.exit(1);
});
