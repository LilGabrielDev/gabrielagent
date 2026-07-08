import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { HttpError } from "./http-error.js";
import { logger } from "./logger.js";

const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/;

export interface SessionStore {
  kind: "file" | "postgres" | "redis" | "s3";
  root: string;
  initialize(): Promise<void>;
  listSessionIds(): Promise<string[]>;
  getSessionPath(sessionId: string): string;
  remove(sessionId: string): Promise<void>;
  quarantine(sessionId: string): Promise<void>;
}

class FileSessionStore implements SessionStore {
  kind: SessionStore["kind"] = "file";
  root = config.sessionPath;

  async initialize() {
    await fs.mkdir(this.root, { recursive: true });
  }

  async listSessionIds() {
    const entries = await fs.readdir(this.root, { withFileTypes: true }).catch(() => []);
    return entries
      .filter((entry) => entry.isDirectory() && SESSION_ID_PATTERN.test(entry.name))
      .map((entry) => entry.name);
  }

  getSessionPath(sessionId: string) {
    validateSessionId(sessionId);
    const directory = path.resolve(this.root, sessionId);
    const root = path.resolve(this.root);
    if (!directory.startsWith(root)) {
      throw new HttpError(400, "Invalid sessionId");
    }
    return directory;
  }

  async remove(sessionId: string) {
    await fs.rm(this.getSessionPath(sessionId), { recursive: true, force: true });
  }

  async quarantine(sessionId: string) {
    const source = this.getSessionPath(sessionId);
    const target = path.resolve(this.root, `.corrupt-${sessionId}-${Date.now()}`);
    await fs.rename(source, target).catch(async () => {
      await this.remove(sessionId);
    });
  }
}

class ExternalSessionStore extends FileSessionStore {
  constructor(public kind: "postgres" | "redis" | "s3") {
    super();
  }

  async initialize() {
    logger.warn(
      { requestedStore: this.kind },
      "External WhatsApp auth persistence is not configured in this build; using file store adapter path"
    );
    await super.initialize();
  }
}

export function createSessionStore(): SessionStore {
  switch (config.sessionStore) {
    case "postgres":
    case "redis":
    case "s3":
      return new ExternalSessionStore(config.sessionStore);
    case "file":
    default:
      return new FileSessionStore();
  }
}

export function validateSessionId(sessionId: string) {
  if (!SESSION_ID_PATTERN.test(sessionId)) {
    throw new HttpError(400, "sessionId may only contain letters, numbers, dashes, and underscores");
  }
}
