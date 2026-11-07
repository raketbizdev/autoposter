// Desktop app (macOS and Windows): runs the dashboard server and the worker, lives in the menu bar / system tray,
// opens at login if the person wants, and keeps the computer awake while the worker runs.
import { app, BrowserWindow, Menu, Tray, nativeImage, powerSaveBlocker, shell, dialog } from 'electron';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const IS_MAC = process.platform === 'darwin';

// Data lives in the per-user app folder (~/Library/Application Support/Autoposter, %APPDATA%\Autoposter).
// Set before the server modules read it.
process.env.AUTOPOSTER_HOME ||= app.getPath('userData');

if (!app.requestSingleInstanceLock()) app.quit();

let win = null;
let tray = null;
let baseUrl = null;
let ctx = null; // { db, p, server, workerPid, startWorker }
let awakeId = null;
let quitting = false;

function freePort(preferred) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => { const t = net.createServer(); t.listen(0, '127.0.0.1', () => { const { port } = t.address(); t.close(() => resolve(port)); }); });
    s.listen(preferred, '127.0.0.1', () => s.close(() => resolve(preferred)));
  });
}

async function startServer() {
  const { paths } = await import('../src/config.js');
  const { openDb, getSettings } = await import('../src/db.js');
  const { createApp, startWorker, workerPid } = await import('../src/server.js');
  const p = paths();
  const db = openDb(p.db);
  const port = await freePort(Number(process.env.AUTOPOSTER_PORT || 4317));
  const server = await new Promise((resolve, reject) => {
    const s = createApp(db, p).listen(port, '127.0.0.1', () => resolve(s));
    s.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Autoposter app: ${baseUrl} (data: ${p.home})`);
  ctx = { db, p, server, getSettings, startWorker, workerPid: () => workerPid(p.lock) };
  // Bring the worker back if it was running when the app last quit.
  if (getSettings(db).worker_autostart === '1' && !ctx.workerPid()) startWorker(p);
}

function workerRunning() {
  return Boolean(ctx?.workerPid());
}

// Keeps the computer from sleeping while the worker might have to post (the CLI version uses caffeinate for this).
function syncAwake() {
  const want = workerRunning();
  if (want && awakeId === null) awakeId = powerSaveBlocker.start('prevent-app-suspension');
  if (!want && awakeId !== null) { powerSaveBlocker.stop(awakeId); awakeId = null; }
  refreshTray();
}

function showWindow() {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    return;
  }
  win = new BrowserWindow({
    width: 1320, height: 880, minWidth: 420, minHeight: 560,
    title: 'Autoposter', backgroundColor: '#F4F2EE', show: false,
    icon: path.join(here, 'assets', 'icon.png'),
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  win.removeMenu?.();
  win.loadURL(baseUrl);
  win.once('ready-to-show', () => win.show());
  // Links to Facebook, GitHub and the Claude extension open in the person's browser, not inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(baseUrl)) { e.preventDefault(); shell.openExternal(url); } });
  // Closing the window keeps the app running in the menu bar / tray so scheduled posts still go out.
  win.on('close', (e) => { if (!quitting) { e.preventDefault(); win.hide(); } });
  win.on('closed', () => { win = null; });
}

function openAtLogin() {
  return app.getLoginItemSettings().openAtLogin;
}

function refreshTray() {
  if (!tray) return;
  const running = workerRunning();
  tray.setToolTip(`Autoposter — ${running ? 'worker running' : 'worker stopped'}`);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Autoposter', click: showWindow },
    { label: running ? 'Worker running' : 'Worker stopped', enabled: false },
    { type: 'separator' },
    {
      label: 'Open at login', type: 'checkbox', checked: openAtLogin(),
      click: (item) => { app.setLoginItemSettings({ openAtLogin: item.checked, openAsHidden: true, args: ['--hidden'] }); },
    },
    { label: 'Show data folder', click: () => shell.openPath(process.env.AUTOPOSTER_HOME) },
    { type: 'separator' },
    { label: 'Quit Autoposter', click: () => app.quit() },
  ]));
}

function createTray() {
  const image = IS_MAC
    ? nativeImage.createFromPath(path.join(here, 'assets', 'trayTemplate.png'))
    : nativeImage.createFromPath(path.join(here, 'assets', 'tray.png'));
  if (IS_MAC) image.setTemplateImage(true);
  tray = new Tray(image);
  if (!IS_MAC) tray.on('click', showWindow); // Windows: left-click opens, right-click shows the menu
  refreshTray();
}

// Quitting stops the worker. If a post is being published, ask first: stopping mid-post leaves it "Needs check".
app.on('before-quit', (e) => {
  if (quitting || !ctx) return;
  const publishing = ctx.db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE status = 'running'").get().n > 0;
  if (publishing) {
    const choice = dialog.showMessageBoxSync({
      type: 'warning', buttons: ['Keep running', 'Quit anyway'], defaultId: 0, cancelId: 0,
      message: 'A post is being published right now',
      detail: 'If you quit, Claude stops mid-post and the post is marked "Needs check".',
    });
    if (choice === 0) { e.preventDefault(); return; }
  }
  quitting = true;
  const pid = ctx.workerPid();
  if (pid) { try { process.kill(pid); } catch { /* already gone */ } }
  ctx.server.close();
});

app.on('second-instance', showWindow);
app.on('activate', showWindow); // macOS: clicking the Dock icon

app.whenReady().then(async () => {
  try {
    await startServer();
  } catch (err) {
    dialog.showErrorBox('Autoposter could not start', String(err?.stack || err));
    app.exit(1);
    return;
  }
  if (IS_MAC && app.dock) app.dock.setIcon(path.join(here, 'assets', 'icon.png'));
  createTray();
  syncAwake();
  setInterval(syncAwake, 15_000);
  const startedHidden = process.argv.includes('--hidden') || app.getLoginItemSettings().wasOpenedAsHidden;
  if (!startedHidden) showWindow();
});

// Keep running with no windows open: the tray is the app.
app.on('window-all-closed', () => {});

