# Katabump WhatsApp WebJS

Standalone WhatsApp WebJS runner with a small browser panel for showing the QR code.

This is separate from the main Next.js site. It does not add pages, sidebar items, or Vercel routes.

## Run With Docker

```bash
cd katabump
docker compose up --build
```

Open:

```text
http://localhost:3000
```

Click **Start WebJS**, wait for the QR code, then scan it from WhatsApp on your phone.

The WhatsApp session is stored in the Docker volume `katabump-whatsapp-data`, so reconnects can reuse the saved login.

## Run Without Docker

```bash
cd katabump
npm install
npm start
```

If Chromium is already installed, set:

```bash
PUPPETEER_EXECUTABLE_PATH=/path/to/chromium npm start
```

On Windows PowerShell:

```powershell
$env:PUPPETEER_EXECUTABLE_PATH="C:\Path\To\chrome.exe"
npm start
```

## Endpoints

- `/` - QR panel
- `/status` - JSON status and QR data URL
- `/start` - starts WebJS
- `/restart` - restarts WebJS
