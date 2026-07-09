import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { WebSocket, WebSocketServer } from "ws";
import pinoHttpImport from "pino-http";
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

app.disable("x-powered-by");
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

    const server = app.listen(config.port, () => {
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
