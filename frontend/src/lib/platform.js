// True when the app is running inside the Electron desktop shell (the preload
// sets window.dfsDesktop). Used to skip the web-only landing page.
export const isDesktop = () =>
  typeof window !== "undefined" && !!window.dfsDesktop?.isDesktop;
