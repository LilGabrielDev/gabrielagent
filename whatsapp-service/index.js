import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const serverEntry = path.join(root, "dist", "server.js");

if (!existsSync(serverEntry)) {
  console.error("Missing dist/server.js. Run npm run build before starting the WhatsApp service.");
  process.exit(1);
}

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  process.exit(1);
});

try {
  await import("./dist/server.js");
} catch (error) {
  console.error("Failed to start WhatsApp service:", error);
  process.exit(1);
}
