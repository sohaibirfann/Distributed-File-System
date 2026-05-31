const { app, BrowserWindow, Menu, ipcMain, shell } = require("electron");
const path = require("path");
const fs   = require("fs");

// In dev we load the live Vite server so UI changes hot-reload inside the window.
// In a packaged build this will point at the bundled frontend (added later).
const APP_URL = process.env.DFS_APP_URL || "http://localhost:5173";

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
    backgroundColor: "#080808",
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

app.whenReady().then(() => {
  Menu.setApplicationMenu(null); // no default OS menu — chrome is fully custom
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
