const { app, BrowserWindow, Menu, ipcMain, shell, dialog, nativeTheme } = require("electron");
const path   = require("path");
const fs     = require("fs");
const crypto = require("crypto");
const { StorageNode } = require("./storageNode");

// In dev we load the live Vite server so UI changes hot-reload inside the window.
// In a packaged build this will point at the bundled frontend (added later).
const APP_URL = process.env.DFS_APP_URL || "http://localhost:5173";

// Dev convenience: pull BACKEND_URL / NODE_SECRET from the backend's .env so the
// embedded storage node can register with no extra setup. In a packaged build
// these come from the app's own config / the deployed coordinator instead.
function loadBackendEnv() {
  try {
    const text = fs.readFileSync(path.join(__dirname, "..", "backend", ".env"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch { /* no backend/.env — packaged build */ }
}
loadBackendEnv();

const NODE_PORT    = Number(process.env.DFS_NODE_PORT || 7330);
const coordUrl     = () => process.env.DFS_API_URL || process.env.BACKEND_URL || "http://localhost:5000";
const nodeSecret   = () => process.env.NODE_SECRET || process.env.DFS_NODE_SECRET || "";

// ── Window bounds persistence ───────────────────────────────────────────────
function stateFile() {
  return path.join(app.getPath("userData"), "window-state.json");
}
function loadState() {
  try { return JSON.parse(fs.readFileSync(stateFile(), "utf8")); } catch { return {}; }
}
function saveState(win) {
  try {
    const b = win.getNormalBounds();
    fs.writeFileSync(stateFile(), JSON.stringify({ ...b, maximized: win.isMaximized() }));
  } catch { /* ignore */ }
}

let mainWindow = null;

function createWindow() {
  const s = loadState();

  const win = new BrowserWindow({
    width:  s.width  ?? 1200,
    height: s.height ?? 820,
    x: s.x,
    y: s.y,
    minWidth:  900,
    minHeight: 600,
    frame: false,            // custom title bar drawn in the renderer
    // Windows 11 "Mica": a subtle, baked wallpaper tint behind the window —
    // the frosted look of the Settings app. Needs a transparent backgroundColor
    // plus a transparent app background in the renderer (.is-desktop styles).
    // (Not 'acrylic' — that's the heavier, see-through flyout blur.)
    backgroundColor: "#00000000",
    backgroundMaterial: "mica",
    title: "DFS",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow = win;
  if (s.maximized) win.maximize();

  win.loadURL(APP_URL);

  // Tell the renderer when the maximize state flips (to swap the button icon).
  win.on("maximize",   () => win.webContents.send("win:maximized", true));
  win.on("unmaximize", () => win.webContents.send("win:maximized", false));
  win.on("close",      () => saveState(win));

  // External links open in the user's real browser, not the app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (process.env.DFS_DEV) win.webContents.openDevTools({ mode: "detach" });
}

// ── Window-control IPC (from the custom title bar) ──────────────────────────
ipcMain.on("win:minimize",        (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
ipcMain.on("win:toggle-maximize", (e) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (!w) return;
  w.isMaximized() ? w.unmaximize() : w.maximize();
});
ipcMain.on("win:close",   (e) => BrowserWindow.fromWebContents(e.sender)?.close());
ipcMain.handle("win:is-maximized", (e) => BrowserWindow.fromWebContents(e.sender)?.isMaximized() ?? false);

// ── Settings store (JSON in userData) ───────────────────────────────────────
function settingsFile() {
  return path.join(app.getPath("userData"), "settings.json");
}
function defaultSettings() {
  return {
    contribute: false,
    storageDir: path.join(app.getPath("userData"), "storage"),
    quotaGB: 5,
  };
}
function readSettings() {
  try { return { ...defaultSettings(), ...JSON.parse(fs.readFileSync(settingsFile(), "utf8")) }; }
  catch { return defaultSettings(); }
}
function writeSettings(next) {
  const merged = { ...readSettings(), ...next };
  try { fs.writeFileSync(settingsFile(), JSON.stringify(merged, null, 2)); } catch { /* ignore */ }
  return merged;
}

// Stable per-install node identity (persisted in settings.json).
function getNodeId() {
  const s = readSettings();
  if (s.nodeId) return s.nodeId;
  const id = "desktop-" + crypto.randomBytes(4).toString("hex");
  writeSettings({ nodeId: id });
  return id;
}

// ── Embedded storage node ────────────────────────────────────────────────────
let storageNode  = null;
let syncingNode  = false;
let currentUserId = null; // the logged-in user (pushed from the renderer)

// Reconcile the running node to the current settings: stop any existing node,
// then (re)start it if the user is contributing — picking up dir/quota changes.
async function syncStorageNode() {
  if (syncingNode) return;
  syncingNode = true;
  try {
    if (storageNode) { await storageNode.stop(); storageNode = null; }

    const s      = readSettings();
    const secret = nodeSecret();
    // The node belongs to a user, so it only runs while contributing AND signed in.
    if (!s.contribute || !currentUserId) return;
    if (!secret) { console.warn("[node] contribute is on but no NODE_SECRET is configured — not starting"); return; }

    const node = new StorageNode({
      name:       getNodeId(),
      port:       NODE_PORT,
      storageDir: s.storageDir,
      quotaBytes: Math.max(1, Number(s.quotaGB) || 5) * 1024 * 1024 * 1024,
      coordUrl:   coordUrl(),
      secret,
      userId:     currentUserId,
    });
    const { url } = await node.start();
    storageNode = node;
    console.log(`[node] contributing as ${getNodeId()} @ ${url} (${coordUrl()})`);
  } catch (err) {
    console.error("[node] failed to start:", err.message);
    storageNode = null;
  } finally {
    syncingNode = false;
  }
}

ipcMain.handle("settings:get", () => readSettings());
ipcMain.handle("settings:set", (_e, partial) => {
  const merged = writeSettings(partial || {});
  syncStorageNode(); // apply contribute/dir/quota changes immediately
  return merged;
});
ipcMain.handle("node:status", () =>
  storageNode ? storageNode.status() : { running: false, registered: false, chunks: 0, bytes: 0 });

// The renderer tells us who's signed in so the node can register under that user
// (and stop when they sign out).
ipcMain.handle("node:set-user", (_e, userId) => {
  const next = userId ?? null;
  if (next === currentUserId) return true;
  currentUserId = next;
  syncStorageNode();
  return true;
});

ipcMain.handle("dialog:pick-folder", async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const res = await dialog.showOpenDialog(win, { properties: ["openDirectory", "createDirectory"] });
  return res.canceled ? null : res.filePaths[0];
});

// Start-with-OS is managed by Electron's login-item settings, not our JSON.
ipcMain.handle("startup:get", () => app.getLoginItemSettings().openAtLogin);
ipcMain.handle("startup:set", (_e, enabled) => {
  app.setLoginItemSettings({ openAtLogin: !!enabled });
  return app.getLoginItemSettings().openAtLogin;
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null); // no default OS menu — chrome is fully custom
  // Dark-only app: force the window's Mica + the renderer's prefers-color-scheme
  // to dark regardless of the OS setting, so the frost never tints light.
  nativeTheme.themeSource = "dark";
  createWindow();
  syncStorageNode(); // start contributing if the user enabled it last time
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => { if (storageNode) storageNode.stop(); });

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
