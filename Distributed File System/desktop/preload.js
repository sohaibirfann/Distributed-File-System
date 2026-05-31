const { contextBridge, ipcRenderer } = require("electron");

// Safe bridge to the renderer. Lets the React app detect the desktop shell and
// drive the custom (frameless) window's controls.
contextBridge.exposeInMainWorld("dfsDesktop", {
  isDesktop: true,
  version: "0.0.0",
  windowControls: {
    minimize:       () => ipcRenderer.send("win:minimize"),
    toggleMaximize: () => ipcRenderer.send("win:toggle-maximize"),
    close:          () => ipcRenderer.send("win:close"),
    isMaximized:    () => ipcRenderer.invoke("win:is-maximized"),
    onMaximizeChange: (cb) => {
      const handler = (_e, val) => cb(val);
      ipcRenderer.on("win:maximized", handler);
      return () => ipcRenderer.removeListener("win:maximized", handler);
    },
  },
});
