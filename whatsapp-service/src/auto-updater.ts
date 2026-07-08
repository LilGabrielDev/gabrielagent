import { spawn } from "node:child_process";
import crypto from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import { config } from "./config.js";
import { HttpError } from "./http-error.js";
import { logger } from "./logger.js";

type UpdateStatus = "disabled" | "idle" | "running" | "updated" | "failed" | "skipped";

interface UpdateState {
  status: UpdateStatus;
  startedAt: string | null;
  finishedAt: string | null;
  lastEvent: string | null;
  lastDelivery: string | null;
  lastCommit: string | null;
  lastError: string | null;
  lastOutput: string[];
}

interface PushPayload {
  ref?: string;
  after?: string;
  repository?: {
    full_name?: string;
  };
  head_commit?: {
    id?: string;
    message?: string;
  };
}

let updatePromise: Promise<UpdateState> | null = null;

const state: UpdateState = {
  status: config.autoUpdate.enabled ? "idle" : "disabled",
  startedAt: null,
  finishedAt: null,
  lastEvent: null,
  lastDelivery: null,
  lastCommit: null,
  lastError: null,
  lastOutput: [],
};

export function getAutoUpdateStatus() {
  return {
    ...state,
    enabled: config.autoUpdate.enabled,
    branch: config.autoUpdate.branch,
    restart: config.autoUpdate.restart,
  };
}

export async function handleGitHubWebhook(headers: IncomingHttpHeaders, rawBody: Buffer) {
  if (!config.autoUpdate.enabled) {
    throw new HttpError(404, "Auto-update webhook is disabled");
  }

  verifySignature(headers, rawBody);

  const event = getHeader(headers, "x-github-event");
  const delivery = getHeader(headers, "x-github-delivery");
  state.lastEvent = event;
  state.lastDelivery = delivery;

  if (event !== "push") {
    state.status = "skipped";
    state.lastError = null;
    return { accepted: false, status: "skipped", reason: "Only push events trigger updates" };
  }

  const payload = parsePayload(rawBody);
  const targetRef = `refs/heads/${config.autoUpdate.branch}`;
  if (payload.ref !== targetRef) {
    state.status = "skipped";
    state.lastError = null;
    return {
      accepted: false,
      status: "skipped",
      reason: `Ignored ${payload.ref || "unknown ref"}; waiting for ${targetRef}`,
    };
  }

  state.lastCommit = payload.after || payload.head_commit?.id || null;

  if (updatePromise) {
    return {
      accepted: true,
      status: "running",
      message: "An update is already running",
    };
  }

  updatePromise = runUpdate()
    .catch((error) => {
      state.status = "failed";
      state.finishedAt = new Date().toISOString();
      state.lastError = error instanceof Error ? error.message : String(error);
      logger.error({ error }, "Auto-update failed");
      return state;
    })
    .finally(() => {
      updatePromise = null;
    });

  return {
    accepted: true,
    status: "running",
    message: "Update started",
  };
}

async function runUpdate() {
  state.status = "running";
  state.startedAt = new Date().toISOString();
  state.finishedAt = null;
  state.lastError = null;
  state.lastOutput = [];

  await runCommand("git", ["pull", "--ff-only", "origin", config.autoUpdate.branch]);
  await runCommand(npmCommand(), ["ci"]);
  await runCommand(npmCommand(), ["run", "build"]);

  state.status = "updated";
  state.finishedAt = new Date().toISOString();

  if (config.autoUpdate.restart) {
    setTimeout(() => process.exit(0), 500);
  }

  return state;
}

function verifySignature(headers: IncomingHttpHeaders, rawBody: Buffer) {
  const secret = config.autoUpdate.webhookSecret;
  if (!secret) {
    logger.warn("GITHUB_WEBHOOK_SECRET is not set; auto-update webhook is accepting unsigned requests");
    return;
  }

  const signature = getHeader(headers, "x-hub-signature-256");
  const expected = `sha256=${crypto.createHmac("sha256", secret).update(rawBody).digest("hex")}`;

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new HttpError(401, "Invalid GitHub webhook signature");
  }
}

function getHeader(headers: IncomingHttpHeaders, name: string) {
  const value = headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function parsePayload(rawBody: Buffer): PushPayload {
  try {
    return JSON.parse(rawBody.toString("utf8")) as PushPayload;
  } catch {
    throw new HttpError(400, "Invalid GitHub webhook payload");
  }
}

function runCommand(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
    });

    child.stdout.on("data", (chunk) => appendOutput(chunk));
    child.stderr.on("data", (chunk) => appendOutput(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function appendOutput(chunk: Buffer) {
  const lines = chunk
    .toString("utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  state.lastOutput.push(...lines);
  state.lastOutput = state.lastOutput.slice(-80);
}
