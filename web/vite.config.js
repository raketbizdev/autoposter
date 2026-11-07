import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const api = 'http://127.0.0.1:4317';
const PROJECT = fileURLToPath(new URL('..', import.meta.url));
const SERVER_LABEL = 'com.autoposter.server';
const SERVER_PLIST = path.join(os.homedir(), 'Library', 'LaunchAgents', `${SERVER_LABEL}.plist`);

async function apiUp() {
  try { return (await fetch(`${api}/api/status`, { signal: AbortSignal.timeout(1500) })).ok; } catch { return false; }
}

// Kills an autoposter server that holds the port but no longer answers. Other programs on the port are left alone.
function killStuckServer() {
  let pids = [];
  try { pids = execFileSync('lsof', ['-ti', 'tcp:4317', '-sTCP:LISTEN'], { encoding: 'utf8' }).split('\n').filter(Boolean); } catch {}
  for (const pid of pids) {
    try {
      const cmd = execFileSync('ps', ['-o', 'command=', '-p', pid], { encoding: 'utf8' });
      if (cmd.includes(path.join(PROJECT, 'src', 'server.js')) || cmd.includes('src/server.js')) process.kill(Number(pid), 'SIGKILL');
    } catch {}
  }
}

function startServer() {
  if (fs.existsSync(SERVER_PLIST)) {
    execFileSync('launchctl', ['kickstart', '-k', `gui/${process.getuid()}/${SERVER_LABEL}`]);
    return;
  }
  killStuckServer();
  fs.mkdirSync(path.join(PROJECT, 'logs'), { recursive: true });
  const log = fs.openSync(path.join(PROJECT, 'logs', 'server.log'), 'a');
  const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(PROJECT, 'src', 'server.js')],
    { cwd: PROJECT, detached: true, stdio: ['ignore', log, log], env: process.env });
  child.unref();
  fs.closeSync(log);
}

// Dev-only endpoint so the dashboard can bring the API server back when it is down.
// It lives in Vite because a dead API server can't restart itself.
function serverControl() {
  return {
    name: 'autoposter-server-control',
    configureServer(server) {
      server.middlewares.use('/__dev/restart-server', async (req, res) => {
        const send = (code, body) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(body)); };
        if (req.method !== 'POST') return send(405, { error: 'POST only' });
        try {
          startServer();
          const end = Date.now() + 10_000;
          while (Date.now() < end) {
            if (await apiUp()) return send(200, { ok: true });
            await new Promise((r) => setTimeout(r, 400));
          }
          send(503, { error: 'The server did not come back; see logs/server.log' });
        } catch (e) {
          send(500, { error: e.message });
        }
      });
    },
  };
}

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react(), serverControl()],
  server: { host: '127.0.0.1', port: 5173, proxy: { '/api': api, '/media': api } },
  build: { outDir: 'dist', emptyOutDir: true },
});
