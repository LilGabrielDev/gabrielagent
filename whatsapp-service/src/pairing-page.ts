export const pairingPageHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WhatsApp Pairing Backend</title>
  <script src="https://cdn.socket.io/4.7.4/socket.io.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-screen bg-slate-950 p-4 text-slate-100 sm:p-8">
  <div class="mx-auto flex max-w-6xl flex-col gap-6 rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl shadow-black/40 sm:p-8 lg:p-10">
    <header class="space-y-3">
      <p class="text-sm font-semibold uppercase tracking-[0.35em] text-emerald-400">WhatsApp Pairing Portal</p>
      <h1 class="text-3xl font-black text-white sm:text-4xl">Link your device in seconds with a phone number</h1>
      <p class="max-w-2xl text-sm text-slate-300 sm:text-base">Enter the number tied to your WhatsApp account and let the backend prepare the session, pairing code, and QR automatically.</p>
    </header>

    <div class="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section class="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 sm:p-6">
        <div class="space-y-4">
          <div>
            <label for="phone-number" class="mb-2 block text-sm font-semibold text-slate-200">Phone number</label>
            <input id="phone-number" type="tel" inputmode="tel" placeholder="e.g. 254712345678" class="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-emerald-500" />
          </div>

          <div class="flex flex-wrap gap-3">
            <button id="start-pairing-btn" onclick="startPairing()" class="rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400">Start pairing</button>
            <button onclick="resetPairing()" class="rounded-xl border border-slate-700 px-5 py-3 font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800">Reset</button>
          </div>

          <div class="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <p class="text-xs uppercase tracking-[0.3em] text-slate-400">Status</p>
            <p id="status-badge" class="mt-2 text-lg font-semibold text-slate-100">Waiting for your number</p>
            <p id="session-id-display" class="mt-2 text-sm text-slate-400">Session: not started</p>
          </div>

          <div class="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <p class="text-xs uppercase tracking-[0.3em] text-slate-400">How it works</p>
            <ul class="mt-3 space-y-2 text-sm text-slate-300">
              <li>• The backend creates a secure WhatsApp session.</li>
              <li>• The pairing code is generated for the phone number you enter.</li>
              <li>• The QR code appears automatically for device linking.</li>
            </ul>
          </div>
        </div>
      </section>

      <section class="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-5 sm:p-6">
        <div class="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <p class="text-xs uppercase tracking-[0.3em] text-slate-400">Pairing code</p>
          <div id="pairing-code-display" class="mt-3 hidden rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
            <p class="text-sm text-emerald-300">Open WhatsApp, choose Link a device, and enter this code</p>
            <p id="pairing-code" class="mt-3 text-4xl font-black tracking-[0.35em] text-emerald-300"></p>
          </div>
          <p id="pairing-placeholder" class="mt-3 text-sm text-slate-400">The pairing code will appear here after you start pairing.</p>
        </div>

        <div class="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <p class="text-xs uppercase tracking-[0.3em] text-slate-400">QR code</p>
          <div id="qr-container" class="mt-3 hidden rounded-2xl border border-slate-800 bg-white p-4 text-center">
            <img id="qr-image" class="mx-auto max-w-[240px] rounded-xl" alt="WhatsApp QR Code" />
          </div>
          <p id="qr-placeholder" class="mt-3 text-sm text-slate-400">The QR code will show automatically once the backend starts the session.</p>
        </div>

        <div class="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <p class="text-xs uppercase tracking-[0.3em] text-slate-400">Activity</p>
          <div id="activity-log" class="mt-3 space-y-2 rounded-2xl bg-slate-950 p-3 font-mono text-sm text-slate-300"></div>
        </div>
      </section>
    </div>
  </div>

  <script>
    const apiBaseUrl = window.location.origin;
    let socket = null;
    let currentSessionId = null;
    let currentPhoneNumber = '';

    function setStatus(message, tone = 'info') {
      const badge = document.getElementById('status-badge');
      const tones = {
        info: 'text-slate-100',
        success: 'text-emerald-300',
        warn: 'text-amber-300',
        error: 'text-rose-300'
      };
      badge.className = 'mt-2 text-lg font-semibold ' + (tones[tone] || tones.info);
      badge.textContent = message;
    }

    function addLog(message, type = 'info') {
      const logArea = document.getElementById('activity-log');
      const entry = document.createElement('div');
      entry.className = 'rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2';
      entry.innerHTML = '<span class="mr-2 text-slate-500">[' + new Date().toLocaleTimeString() + ']</span><span class="font-semibold text-slate-200">' + type.toUpperCase() + '</span> ' + message;
      logArea.prepend(entry);
      while (logArea.children.length > 12) {
        logArea.removeChild(logArea.lastChild);
      }
    }

    function showPairingCode(code) {
      const display = document.getElementById('pairing-code-display');
      const placeholder = document.getElementById('pairing-placeholder');
      const value = document.getElementById('pairing-code');
      value.textContent = code;
      display.classList.remove('hidden');
      placeholder.classList.add('hidden');
    }

    function hidePairingCode() {
      document.getElementById('pairing-code-display').classList.add('hidden');
      document.getElementById('pairing-placeholder').classList.remove('hidden');
    }

    function showQr(qr) {
      const container = document.getElementById('qr-container');
      const image = document.getElementById('qr-image');
      const placeholder = document.getElementById('qr-placeholder');
      image.src = qr;
      container.classList.remove('hidden');
      placeholder.classList.add('hidden');
    }

    function hideQr() {
      document.getElementById('qr-container').classList.add('hidden');
      document.getElementById('qr-placeholder').classList.remove('hidden');
    }

    function setSessionId(sessionId) {
      currentSessionId = sessionId;
      document.getElementById('session-id-display').textContent = 'Session: ' + sessionId;
    }

    async function createSession(phoneNumber) {
      const response = await fetch(apiBaseUrl + '/api/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 'pairing_' + Date.now(), engine: 'baileys', phoneNumber })
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.message || 'Unable to create session');
      currentPhoneNumber = phoneNumber;
      setSessionId(data.sessionId);
      addLog('Session created for ' + phoneNumber);
      return data.sessionId;
    }

    async function requestPairingCode(sessionId, phoneNumber) {
      const response = await fetch(apiBaseUrl + '/api/session/pairing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, phoneNumber })
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.message || 'Unable to request pairing code');
      return data.pairingCode;
    }

    async function fetchQr(sessionId) {
      const response = await fetch(apiBaseUrl + '/api/session/qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      const data = await response.json();
      if (data.success && data.qr) {
        showQr(data.qr);
        setStatus('QR ready — scan it with WhatsApp', 'warn');
        addLog('QR loaded from backend');
      }
    }

    function setupSocket(sessionId) {
      if (socket) socket.disconnect();
      socket = io(apiBaseUrl, { query: { sessionId } });
      socket.on('connect', function() {
        addLog('Socket connected');
      });
      socket.on('qr', function(data) {
        if (data.sessionId === sessionId && data.qr) {
          showQr(data.qr);
          setStatus('QR ready — scan it with WhatsApp', 'warn');
          addLog('QR code received');
        }
      });
      socket.on('pairing', function(data) {
        if (data.sessionId === sessionId) {
          showPairingCode(data.pairingCode);
          setStatus('Pairing code ready', 'success');
          addLog('Pairing code received for ' + currentPhoneNumber);
        }
      });
      socket.on('authenticated', function() {
        setStatus('Authenticated and connected', 'success');
        addLog('Session authenticated');
      });
      socket.on('ready', function() {
        setStatus('WhatsApp is ready', 'success');
        addLog('Session ready');
      });
      socket.on('status', function(data) {
        if (data.sessionId === sessionId && data.status) {
          setStatus('Status: ' + data.status, 'info');
        }
      });
      socket.on('disconnected', function(data) {
        if (data.sessionId === sessionId) {
          setStatus('Session disconnected', 'error');
          addLog('Session disconnected');
        }
      });
      socket.on('error', function(data) {
        if (data.sessionId === sessionId) {
          setStatus('Error: ' + (data.error || 'Unknown error'), 'error');
          addLog('Error: ' + (data.error || 'Unknown error'));
        }
      });
    }

    async function startPairing() {
      const phoneNumber = document.getElementById('phone-number').value.trim();
      const button = document.getElementById('start-pairing-btn');
      if (!phoneNumber) {
        alert('Please enter a phone number first.');
        return;
      }
      button.disabled = true;
      button.textContent = 'Working...';
      setStatus('Creating WhatsApp session...', 'info');
      addLog('Starting pairing flow');
      try {
        const sessionId = await createSession(phoneNumber);
        setupSocket(sessionId);
        const pairingCode = await requestPairingCode(sessionId, phoneNumber);
        await fetchQr(sessionId);
        showPairingCode(pairingCode);
        setStatus('Pairing code and QR are ready', 'success');
        addLog('Pairing code ready for ' + phoneNumber);
      } catch (error) {
        console.error(error);
        setStatus(error.message || 'Failed to start pairing', 'error');
        addLog(error.message || 'Failed to start pairing');
      } finally {
        button.disabled = false;
        button.textContent = 'Start pairing';
      }
    }

    function resetPairing() {
      hidePairingCode();
      hideQr();
      document.getElementById('phone-number').value = '';
      setStatus('Waiting for your number', 'info');
      document.getElementById('session-id-display').textContent = 'Session: not started';
      currentSessionId = null;
      currentPhoneNumber = '';
      if (socket) {
        socket.disconnect();
        socket = null;
      }
      document.getElementById('activity-log').innerHTML = '';
      addLog('UI reset');
    }

    document.addEventListener('DOMContentLoaded', function() {
      addLog('Backend pairing UI ready');
      setStatus('Waiting for your number', 'info');
    });
  </script>
</body>
</html>`;
