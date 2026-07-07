import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import pinoHttpImport from "pino-http";
import { z } from "zod";
import { config } from "./config.js";
import { HttpError } from "./http-error.js";
import { logger } from "./logger.js";
import { WhatsAppSessionManager } from "./session-manager.js";

const pairSchema = z.object({
  sessionId: z.string().min(1).default("default"),
  phoneNumber: z.string().min(10),
});

const app = express();
const sessions = new WhatsAppSessionManager();
const pinoHttp = pinoHttpImport.default || pinoHttpImport;

app.disable("x-powered-by");
app.use(express.json({ limit: "64kb" }));
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(pinoHttp({ logger }));

app.use((request, _response, next) => {
  if (!config.apiKey || request.path === "/api/health") {
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

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    status: "healthy",
    sessions: sessions.listStatuses().length,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
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

app.post("/api/whatsapp/reconnect/:sessionId", async (request, response, next) => {
  try {
    response.json(await sessions.reconnect(request.params.sessionId));
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
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

await sessions.bootstrap();

const server = app.listen(config.port, () => {
  logger.info(
    {
      port: config.port,
      sessionPath: config.sessionPath,
      corsOrigin: config.corsOrigin,
      authEnabled: Boolean(config.apiKey),
    },
    "WhatsApp service listening"
  );
});

function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down WhatsApp service");
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
