import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function waitForServer(url, timeoutMs = 15000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = async () => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          resolve();
          return;
        }
      } catch {
        // keep retrying
      }

      if (Date.now() - started > timeoutMs) {
        reject(new Error(`Server did not become ready at ${url}`));
        return;
      }

      setTimeout(attempt, 500);
    };

    attempt();
  });
}

test('the pairing page exposes the socket client script and the session API works', async () => {
  const port = 3101 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, ['index.js'], {
    cwd: rootDir,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });

  try {
    await waitForServer(`http://127.0.0.1:${port}/health`);

    const pageResponse = await fetch(`http://127.0.0.1:${port}/`);
    const pageHtml = await pageResponse.text();
    assert.match(pageHtml, /socket\.io\/socket\.io\.js/);

    const createResponse = await fetch(`http://127.0.0.1:${port}/api/session/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'test_session', engine: 'baileys' }),
    });
    const createBody = await createResponse.json();
    assert.equal(createResponse.status, 201);
    assert.equal(createBody.success, true);
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (!child.killed) {
      child.kill('SIGKILL');
    }
  }
});
