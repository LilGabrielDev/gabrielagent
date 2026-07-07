import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

function parseOrigins(value?: string): string[] | boolean {
  if (!value || value === "*") return true;
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export const config = {
  port: Number(process.env.PORT || 4000),
  apiKey: process.env.API_KEY || "",
  corsOrigin: parseOrigins(process.env.CORS_ORIGIN),
  sessionPath: path.resolve(process.env.SESSION_PATH || "./sessions"),
  logLevel: process.env.LOG_LEVEL || "info",
};
