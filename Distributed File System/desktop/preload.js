const { contextBridge } = require("electron");

// Minimal, safe bridge. The renderer can detect it's running inside the desktop
// app (vs a plain browser tab). The embedded storage node will expose more here.
contextBridge.exposeInMainWorld("dfsDesktop", {
  isDesktop: true,
  version: "0.0.0",
});
