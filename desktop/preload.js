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
  settings: {
    get:        ()        => ipcRenderer.invoke("settings:get"),
    set:        (partial) => ipcRenderer.invoke("settings:set", partial),
    pickFolder: ()        => ipcRenderer.invoke("dialog:pick-folder"),
    getStartup: ()        => ipcRenderer.invoke("startup:get"),
    setStartup: (enabled) => ipcRenderer.invoke("startup:set", enabled),
  },
  node: {
    getStatus: ()     => ipcRenderer.invoke("node:status"),
    setUser:   (payload) => ipcRenderer.invoke("node:set-user", payload), // { id, token } | null
  },
  // Show a native OS notification (file added, member joined, …).
  notify: (payload) => ipcRenderer.invoke("notify:show", payload),
});
