import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { Server } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { z } from "zod";
import { WhatsAppSessionManager, type WhatsAppEngine } from "./session-manager.js";
import { logger } from "./logger.js";
import { HttpError } from "./http-error.js";
import rateLimit from "express-rate-limit";

const app = express();
const httpServer = createServer(app);

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.BACKEND_URL,
  process.env.NEXT_PUBLIC_APP_URL,
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:5173",
].filter((origin): origin is string => Boolean(origin));

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    methods: ["GET", "POST", "DELETE"],
    credentials: true,
  },
});

const sessions = new WhatsAppSessionManager();
const sessionIdSchema = z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/);
const phoneNumberSchema = z.string().trim().min(8).max(16).regex(/^\+?[0-9]{8,15}$/);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.socket.io", "https://cdn.tailwindcss.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "ws:", "wss:", "https://cdn.socket.io"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
  })
);
app.use(compression());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "64kb" }));
const publicDir = path.resolve(process.cwd(), "public");
app.use(express.static(publicDir));
app.use((req, _res, next) => {
  logger.info({ method: req.method, path: req.path }, "API request");
  next();
});

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.post("/api/session/create", async (req, res, next) => {
  try {
    const body = z
      .object({
        sessionId: sessionIdSchema.optional(),
        phoneNumber: phoneNumberSchema.optional(),
        engine: z.enum(["whatsapp-web.js", "baileys"]).optional().default("baileys"),
      })
      .parse(req.body);

    const sid = body.sessionId || `session_${Date.now()}`;
    const snapshot = await sessions.createSession(sid, body.engine as WhatsAppEngine, body.phoneNumber);

    res.status(201).json({ success: true, sessionId: sid, status: snapshot?.status ?? "initializing" });
  } catch (error) {
    next(error);
  }
});

app.post("/api/session/pairing", async (req, res, next) => {
  try {
    const body = z
      .object({
        sessionId: sessionIdSchema,
        phoneNumber: phoneNumberSchema.optional(),
      })
      .parse(req.body);

    const snapshot = sessions.getSnapshot(body.sessionId);
    if (!snapshot) {
      await sessions.createSession(body.sessionId, "baileys", body.phoneNumber);
    }

    const phone = body.phoneNumber || sessions.getPhoneNumber(body.sessionId);
    if (!phone) {
      throw new HttpError(400, "Phone number is required");
    }

    const pairingCode = await sessions.pair(body.sessionId, phone);
    res.json({ success: true, sessionId: body.sessionId, pairingCode, status: sessions.getStatus(body.sessionId) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/session/qr", async (req, res, next) => {
  try {
    const body = z.object({ sessionId: sessionIdSchema }).parse(req.body);
    const snapshot = sessions.getSnapshot(body.sessionId);
    if (!snapshot) {
      await sessions.createSession(body.sessionId, "baileys");
    }

    res.json({ success: true, sessionId: body.sessionId, qr: sessions.getQr(body.sessionId), status: sessions.getStatus(body.sessionId) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/session/status/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const snapshot = sessions.getSnapshot(sessionId);
  if (!snapshot) {
    res.status(404).json({ success: false, message: "Session not found", error: "Session not found", code: "SESSION_NOT_FOUND" });
    return;
  }

  res.json({ success: true, sessionId, status: snapshot.status, qr: snapshot.qr, pairingCode: snapshot.pairingCode, phoneNumber: snapshot.phoneNumber });
});

app.get("/api/session/:sessionId/status", (req, res) => {
  void (req.params.sessionId);
  res.redirect(307, `/api/session/status/${encodeURIComponent(req.params.sessionId)}`);
});

app.post("/api/session/:sessionId/qr", async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const snapshot = sessions.getSnapshot(sessionId);
    if (!snapshot) {
      await sessions.createSession(sessionId, "baileys");
    }

    res.json({ success: true, sessionId, qr: sessions.getQr(sessionId), status: sessions.getStatus(sessionId) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/session/:sessionId/pair", async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const body = z.object({ phoneNumber: phoneNumberSchema.optional() }).parse(req.body);
    const snapshot = sessions.getSnapshot(sessionId);
    if (!snapshot) {
      await sessions.createSession(sessionId, "baileys", body.phoneNumber);
    }

    const phone = body.phoneNumber || sessions.getPhoneNumber(sessionId);
    if (!phone) {
      throw new HttpError(400, "Phone number is required");
    }

    const pairingCode = await sessions.pair(sessionId, phone);
    res.json({ success: true, sessionId, pairingCode, status: sessions.getStatus(sessionId) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/session/disconnect", async (req, res, next) => {
  try {
    const body = z.object({ sessionId: sessionIdSchema }).parse(req.body);
    await sessions.logout(body.sessionId);
    res.json({ success: true, sessionId: body.sessionId });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/session/:sessionId", async (req, res, next) => {
  try {
    await sessions.logout(req.params.sessionId);
    res.json({ success: true, sessionId: req.params.sessionId });
  } catch (error) {
    next(error);
  }
});

app.post("/api/whatsapp/pair", async (req, res, next) => {
  try {
    const body = z.object({ sessionId: sessionIdSchema.optional(), phoneNumber: phoneNumberSchema }).parse(req.body);
    const sessionId = body.sessionId || "default";
    const snapshot = sessions.getSnapshot(sessionId);
    if (!snapshot) {
      await sessions.createSession(sessionId, "baileys", body.phoneNumber);
    }

    const pairingCode = await sessions.pair(sessionId, body.phoneNumber);
    res.json({ success: true, sessionId, pairingCode, status: sessions.getStatus(sessionId), qr: sessions.getQr(sessionId) });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/whatsapp/logout/:sessionId", async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    await sessions.logout(sessionId);
    res.json({ success: true, sessionId });
  } catch (error) {
    next(error);
  }
});

app.post("/api/whatsapp/reconnect/:sessionId", async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const snapshot = sessions.getSnapshot(sessionId);
    if (!snapshot) {
      await sessions.createSession(sessionId, "baileys");
    }

    res.json({ success: true, sessionId, status: sessions.getStatus(sessionId) });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, req: express.Request, res: express.Response) => {
  const status = error instanceof HttpError ? error.statusCode : 500;
  const code = error instanceof HttpError ? error.code ?? "internal_error" : "internal_error";
  const message = error instanceof Error ? error.message : "Internal Server Error";
  logger.error({ err: error, method: req.method, path: req.path }, "Request failed");
  res.status(status).json({
    success: false,
    message,
    error: message,
    code,
  });
});

io.on("connection", (socket) => {
  const sessionId = socket.handshake.query.sessionId as string | undefined;
  if (sessionId) {
    socket.join(sessionId);
    sessions.attachSocket(sessionId, socket.id);
    const snapshot = sessions.getSnapshot(sessionId);
    if (snapshot) {
      socket.emit("status", { sessionId, status: snapshot.status, qr: snapshot.qr, pairingCode: snapshot.pairingCode, phoneNumber: snapshot.phoneNumber });
    }
    logger.info({ sessionId, socketId: socket.id }, "Socket client joined session room");
  }

  socket.on("disconnect", () => {
    if (sessionId) {
      sessions.detachSocket(sessionId, socket.id);
    }
    logger.info({ sessionId, socketId: socket.id }, "Socket client disconnected");
  });
});

sessions.onEvent((event) => {
  io.to(event.sessionId).emit(event.event, event);
  io.to(event.sessionId).emit("status", { sessionId: event.sessionId, status: event.status, qr: event.qr, pairingCode: event.pairingCode, phoneNumber: event.phoneNumber });
});

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || "0.0.0.0";
httpServer.listen(PORT, HOST, () => {
  logger.info({ PORT, HOST }, "Server running");
});
