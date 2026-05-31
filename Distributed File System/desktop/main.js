const { app, BrowserWindow, shell } = require("electron");
const path = require("path");

// In dev we load the live Vite server so UI changes hot-reload inside the window.
// In a packaged build this will point at the bundled frontend (added later).
const APP_URL = process.env.DFS_APP_URL || "http://localhost:5173";

function createWindow() {
  const win = new BrowserWindow({
    width:  1200,
    height: 820,
    minWidth:  900,
    minHeight: 600,
    backgroundColor: "#080808",
    title: "DFS",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadURL(APP_URL);

  // Open external links (if any) in the user's real browser, not the app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (process.env.DFS_DEV) win.webContents.openDevTools({ mode: "detach" });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
