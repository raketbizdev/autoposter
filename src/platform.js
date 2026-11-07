// Everything that differs between macOS and Windows, or between plain Node and the desktop app (Electron).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';

export const IS_WIN = process.platform === 'win32';
export const IS_MAC = process.platform === 'darwin';
export const IN_ELECTRON = Boolean(process.versions.electron);

// Inside the desktop app, process.execPath is the app itself; this env makes it behave as plain Node.
export function nodeEnv(extra = {}) {
  return { ...process.env, ...(IN_ELECTRON ? { ELECTRON_RUN_AS_NODE: '1' } : {}), ...extra };
}

/**
 * Starts a Node script detached from this process, logging to logFile. On a Mac outside the desktop app it runs under
 * caffeinate so the Mac doesn't idle-sleep mid-post; the desktop app keeps the computer awake itself.
 */
export function spawnNodeScript(script, args, { cwd, logFile, env = {} }) {
  const log = fs.openSync(logFile, 'a');
  const nodeArgs = ['--disable-warning=ExperimentalWarning', script, ...args];
  const [cmd, cmdArgs] = IS_MAC && !IN_ELECTRON
    ? ['/usr/bin/caffeinate', ['-i', process.execPath, ...nodeArgs]]
    : [process.execPath, nodeArgs];
  const child = spawn(cmd, cmdArgs, { cwd, detached: true, windowsHide: true, stdio: ['ignore', log, log], env: nodeEnv(env) });
  child.unref();
  fs.closeSync(log);
  return child;
}

function isFile(p) {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

// Newest Node version folder first, so an nvm install of claude is found under the version in use.
function nvmBins(home) {
  const base = path.join(home, '.nvm', 'versions', 'node');
  try {
    return fs.readdirSync(base)
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
      .map((v) => path.join(base, v, 'bin'));
  } catch {
    return [];
  }
}

/** Every place the claude CLI is usually installed, most likely first. */
export function claudeCandidates({ home = os.homedir(), env = process.env, platform = process.platform } = {}) {
  if (platform === 'win32') {
    const appData = env.APPDATA || path.join(home, 'AppData', 'Roaming');
    const local = env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    return [
      path.join(home, '.local', 'bin', 'claude.exe'), // official installer
      path.join(local, 'Programs', 'claude', 'claude.exe'),
      path.join(appData, 'npm', 'claude.cmd'), // npm install -g
      ...(env.PATH || '').split(';').filter(Boolean).flatMap((d) => [path.join(d, 'claude.exe'), path.join(d, 'claude.cmd')]),
    ];
  }
  return [
    path.join(home, '.local', 'bin', 'claude'), // official installer
    path.join(home, '.claude', 'local', 'claude'),
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
    ...nvmBins(home).map((d) => path.join(d, 'claude')),
    ...(env.PATH || '').split(':').filter(Boolean).map((d) => path.join(d, 'claude')),
  ];
}

/**
 * Finds the claude CLI. Apps opened from the Dock, Start menu or at login don't get the terminal's PATH,
 * so the usual install folders are checked directly.
 */
export function findClaude(opts = {}) {
  const env = opts.env || process.env;
  if (env.CLAUDE_BIN && isFile(env.CLAUDE_BIN)) return env.CLAUDE_BIN;
  return claudeCandidates(opts).find(isFile) || null;
}

// cmd.exe quoting for a .cmd/.bat shim, which Windows can only start through a shell.
export function quoteForCmd(arg) {
  const s = String(arg);
  return /^[\w@%+=:,./\\*-]+$/.test(s) ? s : `"${s.replace(/"/g, '""')}"`;
}

/** spawn() for the claude CLI on any platform, including Windows npm shims (claude.cmd). */
export function spawnClaude(bin, args, options = {}) {
  if (IS_WIN && /\.(cmd|bat)$/i.test(bin)) {
    return spawn(quoteForCmd(bin), args.map(quoteForCmd), { ...options, shell: true, windowsHide: true });
  }
  return spawn(bin, args, { ...options, windowsHide: true });
}

// The folder holding claude goes first on PATH, so its own helpers resolve when started from the app.
export function envWithClaude(bin, env = process.env) {
  if (!bin) return env;
  const sep = IS_WIN ? ';' : ':';
  const key = IS_WIN ? (Object.keys(env).find((k) => k.toUpperCase() === 'PATH') || 'Path') : 'PATH';
  return { ...env, [key]: `${path.dirname(bin)}${sep}${env[key] || ''}` };
}

export function parseAuthStatus(text) {
  const s = JSON.parse(text);
  return {
    loggedIn: Boolean(s.loggedIn),
    authMethod: s.authMethod ?? null,
    email: s.email ?? null,
    // 'pro', 'max', 'team', 'enterprise'… Missing on older Claude Code versions.
    plan: s.subscriptionType ?? null,
  };
}

/** Runs `claude auth status`. Returns { loggedIn, authMethod, email } or null when claude can't be run. */
export function claudeAuthStatus(bin) {
  if (!bin) return null;
  try {
    const out = IS_WIN && /\.(cmd|bat)$/i.test(bin)
      ? execFileSync('cmd.exe', ['/d', '/s', '/c', `${quoteForCmd(bin)} auth status`], { encoding: 'utf8', timeout: 20_000, windowsHide: true })
      : execFileSync(bin, ['auth', 'status'], { encoding: 'utf8', timeout: 20_000, env: envWithClaude(bin) });
    return parseAuthStatus(out);
  } catch (err) {
    // `auth status` exits non-zero when logged out but still prints JSON.
    try {
      return parseAuthStatus(String(err.stdout || ''));
    } catch {
      return null;
    }
  }
}

/** Opens a visible terminal window running a command, for steps that need the person (install, log in). */
export function openTerminal(command) {
  if (IS_WIN) {
    // A detached process on Windows gets its own console window.
    spawn('powershell.exe', ['-NoExit', '-Command', command], { detached: true, windowsHide: false, stdio: 'ignore' }).unref();
  } else if (IS_MAC) {
    const script = `tell application "Terminal" to do script ${JSON.stringify(command)}\ntell application "Terminal" to activate`;
    spawn('osascript', ['-e', script], { detached: true }).unref();
  } else {
    spawn('x-terminal-emulator', ['-e', `bash -lc ${JSON.stringify(`${command}; exec bash`)}`], { detached: true }).unref();
  }
}

/** Stops a child and everything it started. On Windows, killing cmd.exe alone would leave claude running. */
export function killTree(child) {
  if (IS_WIN && child.pid) {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
  }
}

// Anthropic's official Claude Code installers (https://docs.claude.com/en/docs/claude-code/setup).
export const CLAUDE_INSTALL_COMMAND = IS_WIN
  ? 'irm https://claude.ai/install.ps1 | iex'
  : 'curl -fsSL https://claude.ai/install.sh | bash';

export function claudeLoginCommand(bin) {
  const exe = bin ? (IS_WIN ? `& ${JSON.stringify(bin)}` : JSON.stringify(bin)) : 'claude';
  return `${exe} auth login --claudeai`;
}

// The Claude in Chrome extension's ID in the Chrome Web Store.
export const CLAUDE_EXTENSION_ID = 'fcoeoabgfenejglbffodgkkbkcdhcgfn';

/** Chrome-family user-data folders on this computer. */
export function chromeDataDirs({ home = os.homedir(), env = process.env, platform = process.platform } = {}) {
  if (platform === 'win32') {
    const local = env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    return [
      ['Chrome', path.join(local, 'Google', 'Chrome', 'User Data')],
      ['Chrome Beta', path.join(local, 'Google', 'Chrome Beta', 'User Data')],
      ['Chrome Canary', path.join(local, 'Google', 'Chrome SxS', 'User Data')],
    ];
  }
  if (platform === 'darwin') {
    const base = path.join(home, 'Library', 'Application Support', 'Google');
    return [['Chrome', path.join(base, 'Chrome')], ['Chrome Beta', path.join(base, 'Chrome Beta')], ['Chrome Canary', path.join(base, 'Chrome Canary')]];
  }
  return [['Chrome', path.join(home, '.config', 'google-chrome')], ['Chrome Beta', path.join(home, '.config', 'google-chrome-beta')]];
}

/**
 * Chrome profiles that have the Claude in Chrome extension installed, read from disk (no browser needed).
 * Returns [{ browser, profile }] with the profile's display name when Chrome recorded one.
 */
export function findClaudeExtension(opts = {}) {
  const found = [];
  for (const [browser, dir] of chromeDataDirs(opts)) {
    let names = {};
    try { names = JSON.parse(fs.readFileSync(path.join(dir, 'Local State'), 'utf8'))?.profile?.info_cache ?? {}; } catch { /* no Local State */ }
    let profiles = [];
    try { profiles = fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { continue; }
    for (const p of profiles) {
      if (fs.existsSync(path.join(dir, p, 'Extensions', CLAUDE_EXTENSION_ID))) {
        found.push({ browser, profile: names[p]?.name || p });
      }
    }
  }
  return found;
}
