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

function normalizeOrigin(origin?: string) {
  if (!origin) return undefined;
  return origin.replace(/\/+$/, "");
}

function getFrontendOrigins() {
  return [process.env.FRONTEND_URL, process.env.NEXT_PUBLIC_APP_URL]
    .map(normalizeOrigin)
    .filter((origin): origin is string => Boolean(origin));
}

function parseOrigins(value?: string): string[] {
  const configured = !value || value === "*" ? defaultOrigins : value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return Array.from(new Set([...configured, ...getFrontendOrigins()]));
}

export function isAllowedOrigin(origin?: string) {
  if (!origin) return true;
  if (config.corsOrigins.includes(origin)) return true;
  return /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);
}

function validateEnvironment() {
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = "production";
  }

  if (!process.env.PORT) {
    process.env.PORT = "3001";
  }

  if (!process.env.SESSION_STORE) {
    process.env.SESSION_STORE = "file";
  }

  if (!process.env.SESSION_PATH) {
    process.env.SESSION_PATH = "./sessions";
  }

  if (!process.env.LOG_LEVEL) {
    process.env.LOG_LEVEL = "info";
  }

  if (!process.env.FRONTEND_URL && !process.env.NEXT_PUBLIC_APP_URL) {
    process.env.FRONTEND_URL = "https://gabrielagent.vercel.app";
  }
}

function detectPublicUrl() {
  const explicit = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || process.env.RAILWAY_PUBLIC_DOMAIN || process.env.FLY_APP_NAME;
  if (explicit) {
    if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
    if (process.env.FLY_APP_NAME) return `https://${process.env.FLY_APP_NAME}.fly.dev`;
    return explicit.replace(/\/+$/, "");
  }

  return `http://0.0.0.0:${process.env.PORT || 3001}`;
}

export const config = {
  port: Number(process.env.PORT || 3001),
  apiKey: process.env.API_KEY || "",
  corsOrigins: parseOrigins(process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGIN),
  sessionPath: path.resolve(process.env.SESSION_PATH || "./sessions"),
  sessionStore: (process.env.SESSION_STORE || "file").toLowerCase(),
  autoUpdate: {
    enabled: false,
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || "",
    branch: process.env.AUTO_UPDATE_BRANCH || "main",
    restart: false,
  },
  publicUrl: detectPublicUrl(),
  logLevel: process.env.LOG_LEVEL || "info",
};

validateEnvironment();
