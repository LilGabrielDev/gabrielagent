import express from "express";
import qrcode from "qrcode";
import { Client, LocalAuth } from "whatsapp-web.js";

const app = express();
const port = Number(process.env.PORT || 3000);
const authDir = process.env.KATABUMP_AUTH_DIR || ".wwebjs_auth";
const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;

let client = null;
let qrImage = null;
let status = "disconnected";
let message = "WhatsApp WebJS is not started";
let startedAt = null;

function panelHtml() {
  const qrBlock = qrImage
    ? `<img class="qr" src="${qrImage}" alt="WhatsApp QR code" />`
    : `<div class="qr empty">QR code will appear here</div>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Katabump WhatsApp WebJS</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f7f9;
      --panel: #ffffff;
      --text: #17202a;
      --muted: #65758b;
      --border: #d9e0ea;
      --green: #159947;
      --red: #c73737;
      --blue: #2563eb;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: Arial, Helvetica, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: grid;
      place-items: center;
      padding: 24px;
    }
    main {
      width: min(940px, 100%);
      display: grid;
      grid-template-columns: 360px 1fr;
      gap: 18px;
    }
    section {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 22px;
    }
    h1 { margin: 0 0 8px; font-size: 24px; }
    h2 { margin: 0 0 14px; font-size: 15px; color: var(--muted); font-weight: 600; }
    p { line-height: 1.5; color: var(--muted); }
    .qr {
      width: 316px;
      max-width: 100%;
      aspect-ratio: 1;
      border: 1px solid var(--border);
      border-radius: 8px;
      display: grid;
      place-items: center;
      background: #fff;
      color: var(--muted);
      text-align: center;
      padding: 14px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 8px 12px;
      text-transform: capitalize;
      font-size: 14px;
      font-weight: 700;
    }
    .dot { width: 9px; height: 9px; border-radius: 999px; background: var(--muted); }
    .connected .dot { background: var(--green); }
    .error .dot { background: var(--red); }
    .qr_ready .dot, .connecting .dot { background: var(--blue); }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
    button, a.button {
      border: 0;
      border-radius: 7px;
      padding: 10px 14px;
      background: var(--blue);
      color: white;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      font-size: 14px;
    }
    button.secondary { background: #253044; }
    dl { display: grid; grid-template-columns: 120px 1fr; gap: 8px 12px; margin: 18px 0 0; }
    dt { color: var(--muted); }
    dd { margin: 0; font-weight: 700; overflow-wrap: anywhere; }
    code {
      display: block;
      background: #101827;
      color: #dbeafe;
      border-radius: 8px;
      padding: 14px;
      overflow-x: auto;
      font-size: 13px;
      line-height: 1.45;
    }
    @media (max-width: 760px) {
      main { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <section>
      <h1>Katabump WhatsApp WebJS</h1>
      <h2>Scan the QR code to connect WhatsApp</h2>
      ${qrBlock}
    </section>
    <section>
      <span class="badge ${status}"><span class="dot"></span>${status.replace("_", " ")}</span>
      <p>${message}</p>
      <div class="actions">
        <form method="post" action="/start"><button type="submit">Start WebJS</button></form>
        <form method="post" action="/restart"><button class="secondary" type="submit">Restart</button></form>
        <a class="button" href="/status">JSON Status</a>
      </div>
      <dl>
        <dt>Started</dt><dd>${startedAt || "Not started"}</dd>
        <dt>Auth folder</dt><dd>${authDir}</dd>
        <dt>Port</dt><dd>${port}</dd>
      </dl>
      <p>Run with Docker:</p>
      <code>docker compose up --build</code>
    </section>
  </main>
  <script>
    setTimeout(() => window.location.reload(), 4000);
  </script>
</body>
</html>`;
}

async function destroyClient() {
  if (!client) return;
  try {
    await client.destroy();
  } catch (error) {
    console.error("Failed to destroy WhatsApp client", error);
  }
  client = null;
}

async function startClient() {
  if (client) {
    message = "WhatsApp WebJS is already running";
    return;
  }

  status = "connecting";
  message = "Starting WhatsApp WebJS...";
  qrImage = null;
  startedAt = new Date().toISOString();

  client = new Client({
    authStrategy: new LocalAuth({ dataPath: authDir }),
    puppeteer: {
      headless: true,
      executablePath,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    },
  });

  client.on("qr", async (qr) => {
    qrImage = await qrcode.toDataURL(qr);
    status = "qr_ready";
    message = "Scan this QR code with WhatsApp on your phone";
  });

  client.on("authenticated", () => {
    status = "connecting";
    message = "Authenticated. Loading WhatsApp chats...";
  });

  client.on("ready", () => {
    qrImage = null;
    status = "connected";
    message = "WhatsApp is connected and ready";
  });

  client.on("auth_failure", (reason) => {
    status = "error";
    message = `Authentication failed: ${reason}`;
  });

  client.on("disconnected", async (reason) => {
    status = "disconnected";
    message = `Disconnected: ${reason}`;
    qrImage = null;
    client = null;
  });

  client.on("message", (msg) => {
    console.log(`[${msg.from}] ${msg.body}`);
  });

  try {
    await client.initialize();
  } catch (error) {
    status = "error";
    message = error instanceof Error ? error.message : "Failed to start WhatsApp WebJS";
    console.error(error);
    client = null;
  }
}

app.use(express.urlencoded({ extended: false }));

app.get("/", (_req, res) => {
  res.type("html").send(panelHtml());
});

app.get("/status", (_req, res) => {
  res.json({
    status,
    message,
    hasQr: Boolean(qrImage),
    qr: qrImage,
    startedAt,
    authDir,
  });
});

app.post("/start", async (_req, res) => {
  await startClient();
  res.redirect("/");
});

app.post("/restart", async (_req, res) => {
  await destroyClient();
  status = "disconnected";
  message = "Restarting WhatsApp WebJS...";
  await startClient();
  res.redirect("/");
});

app.listen(port, () => {
  console.log(`Katabump WhatsApp WebJS panel: http://localhost:${port}`);
});
