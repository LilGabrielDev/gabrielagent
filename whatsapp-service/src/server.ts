import express from "express";
import { createServer } from "node:http";
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
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const sessions = new WhatsAppSessionManager();

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
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
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
app.use(express.static("public"));

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/", (_req, res) => {
  res.sendFile("index.html", { root: "public" });
});

// Session creation
app.post("/api/session/create", async (req, res, next) => {
  try {
    const { sessionId, phoneNumber, engine } = z.object({
      sessionId: z.string().optional(),
      phoneNumber: z.string().optional(),
      engine: z.enum(["whatsapp-web.js", "baileys"]).optional().default("baileys"),
    }).parse(req.body);

    const sid = sessionId || `session_${Date.now()}`;
    await sessions.createSession(sid, engine as WhatsAppEngine);
    
    res.json({ success: true, sessionId: sid });
  } catch (error) {
    next(error);
  }
});

// Pairing code request
app.post("/api/session/pairing", async (req, res, next) => {
  try {
    const { sessionId, phoneNumber } = z.object({
      sessionId: z.string(),
      phoneNumber: z.string().optional(),
    }).parse(req.body);

    const provider = sessions.getProvider(sessionId);
    if (!provider) throw new HttpError(404, "Session not found");

    const phone = phoneNumber || (provider as any).phoneNumber;
    if (!phone) throw new HttpError(400, "Phone number is required");

    const pairingCode = await provider.requestPairingCode(phone);
    res.json({ success: true, pairingCode });
  } catch (error) {
    next(error);
  }
});

// QR code request (REST fallback)
app.post("/api/session/qr", async (req, res, next) => {
  try {
    const { sessionId } = z.object({ sessionId: z.string() }).parse(req.body);
    const provider = sessions.getProvider(sessionId);
    if (!provider) throw new HttpError(404, "Session not found");

    res.json({ success: true, qr: (provider as any).qr });
  } catch (error) {
    next(error);
  }
});

// Session status
app.get("/api/session/status/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const status = sessions.getStatus(sessionId);
  res.json({ status });
});

// Disconnect/Logout
app.post("/api/session/disconnect", async (req, res, next) => {
  try {
    const { sessionId } = z.object({ sessionId: z.string() }).parse(req.body);
    await sessions.logout(sessionId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const status = err instanceof HttpError ? err.statusCode : 500;
  logger.error(err);
  res.status(status).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

// Socket.IO events
io.on("connection", (socket) => {
  const sessionId = socket.handshake.query.sessionId as string;
  if (sessionId) {
    socket.join(sessionId);
    logger.info({ sessionId }, "Socket client joined session room");
  }

  socket.on("disconnect", () => {
    logger.info("Socket client disconnected");
  });
});

// Listen for WhatsApp events and broadcast via Socket.IO
sessions.onEvent((event) => {
  io.to(event.sessionId).emit(event.event, event);
  io.to(event.sessionId).emit("status", { sessionId: event.sessionId, status: event.status });
});

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
httpServer.listen(PORT, HOST, () => {
  logger.info({ PORT, HOST }, "Server running");
});
