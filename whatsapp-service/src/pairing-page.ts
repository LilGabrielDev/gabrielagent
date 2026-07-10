export const pairingPageHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WhatsApp Pairing Portal</title>
  <style>
    :root {
      color-scheme: dark;
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --bg: #07111f;
      --panel: #0f172a;
      --panel-2: #111c32;
      --text: #f8fafc;
      --muted: #94a3b8;
      --accent: #34d399;
      --accent-2: #38bdf8;
      --danger: #f87171;
      --border: rgba(148, 163, 184, 0.22);
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: linear-gradient(135deg, var(--bg), #111827 55%, #0f172a);
      color: var(--text);
      padding: 20px;
    }

    .shell {
      max-width: 1100px;
      margin: 0 auto;
      display: grid;
      gap: 18px;
    }

    .card, .panel {
      background: rgba(15, 23, 42, 0.95);
      border: 1px solid var(--border);
      border-radius: 24px;
      box-shadow: 0 20px 50px rgba(2, 8, 23, 0.35);
      backdrop-filter: blur(10px);
    }

    .hero {
      padding: 28px 28px 10px;
    }

    .eyebrow {
      display: inline-block;
      font-size: 0.78rem;
      letter-spacing: 0.3em;
      text-transform: uppercase;
      color: var(--accent);
      margin-bottom: 10px;
      font-weight: 700;
    }

    h1 {
      margin: 0 0 10px;
      font-size: clamp(1.5rem, 2.5vw, 2.25rem);
      line-height: 1.2;
    }

    .hero p {
      margin: 0;
      color: var(--muted);
      line-height: 1.6;
      max-width: 700px;
    }

    .content {
      display: grid;
      grid-template-columns: 1.1fr 0.9fr;
      gap: 18px;
      padding: 0 28px 28px;
    }

    .form-card, .result-card {
      background: var(--panel-2);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 20px;
    }

    label {
      display: block;
      font-size: 0.95rem;
      font-weight: 600;
      margin-bottom: 8px;
    }

    input {
      width: 100%;
      padding: 14px 15px;
      border-radius: 14px;
      border: 1px solid rgba(148, 163, 184, 0.28);
      background: #020617;
      color: white;
      font-size: 1rem;
      outline: none;
    }

    input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.14);
    }

    .button-row {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 14px;
    }

    button {
      border: none;
      border-radius: 999px;
      padding: 12px 18px;
      font-size: 0.95rem;
      font-weight: 700;
      cursor: pointer;
      transition: transform 0.18s ease, opacity 0.18s ease;
    }

    button:hover { transform: translateY(-1px); }
    button:disabled { opacity: 0.7; cursor: progress; }

    .primary { background: var(--accent); color: #052e16; }
    .secondary { background: transparent; color: var(--text); border: 1px solid var(--border); }

    .status {
      margin-top: 16px;
      padding: 12px 14px;
      border-radius: 14px;
      background: rgba(2, 8, 23, 0.65);
      color: var(--muted);
      border: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--accent-2);
      flex-shrink: 0;
    }

    .status.error .dot { background: var(--danger); }
    .status.success .dot { background: var(--accent); }
    .status.warn .dot { background: #fbbf24; }

    .meta {
      margin-top: 10px;
      color: var(--muted);
      font-size: 0.9rem;
    }

    .result-grid {
      display: grid;
      gap: 14px;
    }

    .panel h2 {
      margin: 0 0 8px;
      font-size: 1rem;
    }

    .hint {
      color: var(--muted);
      font-size: 0.95rem;
      line-height: 1.5;
      margin: 0 0 12px;
    }

    .box {
      min-height: 150px;
      border-radius: 16px;
      border: 1px dashed rgba(148, 163, 184, 0.28);
      background: rgba(2, 8, 23, 0.65);
      padding: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      color: var(--muted);
    }

    .box strong {
      display: block;
      font-size: 1.25rem;
      color: var(--text);
      letter-spacing: 0.16em;
      margin-top: 8px;
    }

    .qr-box {
      padding: 10px;
      background: white;
      border-radius: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      max-width: 240px;
      margin: 0 auto;
    }

    .qr-box img {
      width: 100%;
      height: auto;
      display: block;
      border-radius: 12px;
    }

    .hidden { display: none !important; }

    @media (max-width: 850px) {
      .content { grid-template-columns: 1fr; }
      body { padding: 12px; }
      .hero, .content { padding-left: 18px; padding-right: 18px; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <div class="card">
      <div class="hero">
        <div class="eyebrow">WhatsApp Pairing</div>
        <h1>Connect your device in seconds</h1>
        <p>Enter your number and let the backend prepare the pairing code and QR automatically. Everything stays on the backend side, and the page updates as soon as it is ready.</p>
      </div>

      <div class="content">
        <div class="form-card">
          <label for="phone-number">Phone number</label>
          <input id="phone-number" type="tel" inputmode="tel" autocomplete="tel" placeholder="e.g. +254712345678" />

          <div class="button-row">
            <button id="start-pairing-btn" class="primary" type="button">Start pairing</button>
            <button id="reset-pairing-btn" class="secondary" type="button">Reset</button>
          </div>

          <div id="status-box" class="status">
            <span class="dot"></span>
            <span id="status-text">Waiting for your number</span>
          </div>
          <div id="session-id" class="meta">Session: not started</div>
        </div>

        <div class="result-card">
          <div class="result-grid">
            <div class="panel">
              <h2>Pairing code</h2>
              <p class="hint">Use this code inside WhatsApp when the backend generates it.</p>
              <div id="pairing-placeholder" class="box">Your pairing code will appear here after the backend prepares it.</div>
              <div id="pairing-code-display" class="box hidden">
                <div>
                  <span class="hint">Open WhatsApp and enter this code</span>
                  <strong id="pairing-code"></strong>
                </div>
              </div>
            </div>

            <div class="panel">
              <h2>QR code</h2>
              <p class="hint">The QR appears automatically once the backend has prepared the session.</p>
              <div id="qr-placeholder" class="box">The QR code will appear here automatically.</div>
              <div id="qr-container" class="qr-box hidden">
                <img id="qr-image" alt="WhatsApp QR code" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    const apiBaseUrl = window.location.origin;
    const phoneInput = document.getElementById('phone-number');
    const startButton = document.getElementById('start-pairing-btn');
    const resetButton = document.getElementById('reset-pairing-btn');
    const statusBox = document.getElementById('status-box');
    const statusText = document.getElementById('status-text');
    const sessionIdBox = document.getElementById('session-id');
    const pairingPlaceholder = document.getElementById('pairing-placeholder');
    const pairingCodeDisplay = document.getElementById('pairing-code-display');
    const pairingCodeValue = document.getElementById('pairing-code');
    const qrPlaceholder = document.getElementById('qr-placeholder');
    const qrContainer = document.getElementById('qr-container');
    const qrImage = document.getElementById('qr-image');

    let currentSessionId = null;
    let currentPhoneNumber = '';

    function setStatus(message, tone = 'info') {
      statusText.textContent = message;
      statusBox.className = 'status';
      if (tone === 'success') statusBox.classList.add('success');
      if (tone === 'error') statusBox.classList.add('error');
      if (tone === 'warn') statusBox.classList.add('warn');
    }

    function showPairingCode(code) {
      pairingCodeValue.textContent = code;
      pairingPlaceholder.classList.add('hidden');
      pairingCodeDisplay.classList.remove('hidden');
    }

    function hidePairingCode() {
      pairingCodeDisplay.classList.add('hidden');
      pairingPlaceholder.classList.remove('hidden');
      pairingCodeValue.textContent = '';
    }

    function showQr(qr) {
      qrImage.src = qr;
      qrPlaceholder.classList.add('hidden');
      qrContainer.classList.remove('hidden');
    }

    function hideQr() {
      qrContainer.classList.add('hidden');
      qrPlaceholder.classList.remove('hidden');
      qrImage.removeAttribute('src');
    }

    function setSessionId(sessionId) {
      currentSessionId = sessionId;
      sessionIdBox.textContent = 'Session: ' + sessionId;
    }

    function resetView() {
      hidePairingCode();
      hideQr();
      setStatus('Waiting for your number', 'info');
      sessionIdBox.textContent = 'Session: not started';
      currentSessionId = null;
      currentPhoneNumber = '';
      phoneInput.value = '';
    }

    async function createSession(phoneNumber) {
      const response = await fetch(apiBaseUrl + '/api/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 'pairing_' + Date.now(), engine: 'baileys', phoneNumber })
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Unable to create a session');
      }
      currentPhoneNumber = phoneNumber;
      setSessionId(data.sessionId);
      return data.sessionId;
    }

    async function requestPairingCode(sessionId, phoneNumber) {
      const response = await fetch(apiBaseUrl + '/api/session/pairing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, phoneNumber })
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Unable to request the pairing code');
      }
      return data.pairingCode;
    }

    async function pollSession(sessionId) {
      const deadline = Date.now() + 30000;
      while (Date.now() < deadline) {
        const response = await fetch(apiBaseUrl + '/api/session/status/' + encodeURIComponent(sessionId));
        const data = await response.json();

        if (data.qr) {
          showQr(data.qr);
          setStatus('QR is ready — scan it with WhatsApp', 'warn');
          return;
        }

        if (data.pairingCode) {
          showPairingCode(data.pairingCode);
          setStatus('Pairing code is ready', 'success');
          return;
        }

        if (data.status === 'ready' || data.status === 'authenticated') {
          setStatus('Your WhatsApp session is ready', 'success');
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      setStatus('The backend did not return a code or QR yet. Please try again.', 'error');
    }

    async function startPairing() {
      const phoneNumber = phoneInput.value.trim();
      if (!/^\+?[0-9]{8,15}$/.test(phoneNumber)) {
        setStatus('Enter a valid phone number, for example +254712345678', 'error');
        return;
      }

      startButton.disabled = true;
      startButton.textContent = 'Preparing...';
      setStatus('Preparing the WhatsApp session...', 'info');

      try {
        const sessionId = await createSession(phoneNumber);
        const pairingCode = await requestPairingCode(sessionId, phoneNumber);
        if (pairingCode) {
          showPairingCode(pairingCode);
        }
        await pollSession(sessionId);
      } catch (error) {
        const message = error && error.message ? error.message : 'Unable to start pairing';
        setStatus(message, 'error');
      } finally {
        startButton.disabled = false;
        startButton.textContent = 'Start pairing';
      }
    }

    startButton.addEventListener('click', startPairing);
    resetButton.addEventListener('click', function() {
      resetView();
    });
    phoneInput.addEventListener('keydown', function(event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        startPairing();
      }
    });
  </script>
</body>
</html>`;
