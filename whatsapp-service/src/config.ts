import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

const defaultOrigins = [
  "https://gabrielagent.vercel.app",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
];

function parseOrigins(value?: string): string[] {
  if (!value || value === "*") return defaultOrigins;
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function detectPublicUrl() {
  const explicit = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }

  if (process.env.FLY_APP_NAME) {
    return `https://${process.env.FLY_APP_NAME}.fly.dev`;
  }

  return `http://localhost:${process.env.PORT || 3000}`;
}

export const config = {
  port: Number(process.env.PORT || 3000),
  apiKey: process.env.API_KEY || "",
  corsOrigins: parseOrigins(process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGIN),
  sessionPath: path.resolve(process.env.SESSION_PATH || "./sessions"),
  sessionStore: process.env.SESSION_STORE || "file",
  autoUpdate: {
    enabled: process.env.AUTO_UPDATE_ENABLED === "true",
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || "",
    branch: process.env.AUTO_UPDATE_BRANCH || "main",
    restart: process.env.AUTO_UPDATE_RESTART !== "false",
  },
  publicUrl: detectPublicUrl(),
  logLevel: process.env.LOG_LEVEL || "info",
};
