const { app, BrowserWindow, Menu, ipcMain, shell, dialog, nativeTheme, Notification } = require("electron");
const path   = require("path");
const fs     = require("fs");
const crypto = require("crypto");
const { StorageNode } = require("./storageNode");

const APP_URL = process.env.DFS_APP_URL || "http://localhost:5173";

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
const coordUrl     = () => readSettings().coordinatorUrl || process.env.DFS_API_URL || process.env.BACKEND_URL || "http://localhost:5000";
const nodeSecret   = () => process.env.NODE_SECRET || process.env.DFS_NODE_SECRET || "";

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
    backgroundColor: "#202020", // solid app surface (matches the renderer background)
    title: "DFS",
    icon: path.join(__dirname, "icon.png"), // taskbar / window icon (Win/Linux)
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow = win;
  if (s.maximized) win.maximize();

  if (app.isPackaged) win.loadFile(path.join(process.resourcesPath, "ui", "index.html"));
  else                win.loadURL(APP_URL);

  win.on("maximize",   () => win.webContents.send("win:maximized", true));
  win.on("unmaximize", () => win.webContents.send("win:maximized", false));
  win.on("close",      () => saveState(win));

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (process.env.DFS_DEV) win.webContents.openDevTools({ mode: "detach" });
}

ipcMain.on("win:minimize",        (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
ipcMain.on("win:toggle-maximize", (e) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (!w) return;
  w.isMaximized() ? w.unmaximize() : w.maximize();
});
ipcMain.on("win:close",   (e) => BrowserWindow.fromWebContents(e.sender)?.close());
ipcMain.handle("win:is-maximized", (e) => BrowserWindow.fromWebContents(e.sender)?.isMaximized() ?? false);

function settingsFile() {
  return path.join(app.getPath("userData"), "settings.json");
}
function defaultSettings() {
  return {
    contribute: false,
    storageDir: path.join(app.getPath("userData"), "storage"),
    quotaGB: 5,
    coordinatorUrl: "",
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

function getNodeId() {
  const s = readSettings();
  if (s.nodeId) return s.nodeId;
  const id = "desktop-" + crypto.randomBytes(4).toString("hex");
  writeSettings({ nodeId: id });
  return id;
}

let storageNode  = null;
let syncingNode  = false;
let currentUserId = null; // the logged-in user (pushed from the renderer)
let currentToken  = null; // their JWT — the node registers with this (no shared secret)

async function syncStorageNode() {
  if (syncingNode) return;
  syncingNode = true;
  try {
    if (storageNode) { await storageNode.stop(); storageNode = null; }

    const s = readSettings();
    if (!s.contribute || !currentToken) return;

    const node = new StorageNode({
      name:       getNodeId(),
      port:       NODE_PORT,
      storageDir: s.storageDir,
      quotaBytes: Math.max(1, Number(s.quotaGB) || 5) * 1024 * 1024 * 1024,
      coordUrl:   coordUrl(),
      token:      currentToken,
      secret:     nodeSecret(),
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

ipcMain.handle("node:set-user", (_e, payload) => {
  const id    = payload && typeof payload === "object" ? (payload.id ?? null)    : (payload ?? null);
  const token = payload && typeof payload === "object" ? (payload.token ?? null) : null;
  if (id === currentUserId && token === currentToken) return true;
  currentUserId = id;
  currentToken  = token;
  syncStorageNode();
  return true;
});

ipcMain.handle("dialog:pick-folder", async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const res = await dialog.showOpenDialog(win, { properties: ["openDirectory", "createDirectory"] });
  return res.canceled ? null : res.filePaths[0];
});

ipcMain.handle("startup:get", () => app.getLoginItemSettings().openAtLogin);
ipcMain.handle("startup:set", (_e, enabled) => {
  app.setLoginItemSettings({ openAtLogin: !!enabled });
  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.handle("notify:show", (_e, { title, body } = {}) => {
  if (!Notification.isSupported()) return false;
  const n = new Notification({ title: title || "DFS", body: body || "", icon: path.join(__dirname, "icon.png") });
  n.on("click", () => { mainWindow?.show(); mainWindow?.focus(); });
  n.show();
  return true;
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null); // no default OS menu — chrome is fully custom
  nativeTheme.themeSource = "dark";
  if (process.platform === "win32") app.setAppUserModelId("com.dfs.app");
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
