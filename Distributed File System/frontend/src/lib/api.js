// Coordinator (API) endpoint — resolved at runtime so the desktop app can point
// at any coordinator instead of one baked in at build time.
//
//   • Renderer source of truth: localStorage["dfs_coordinator_url"].
//   • Falls back to the build-time VITE_API_URL (used by the web build + dev).
//   • On desktop we also mirror the value to the main process (settings.json) so
//     the embedded storage node registers with the same coordinator.
//
// The API consts are read at module load, so callers reload the window after a
// change (see Settings / the setup gate) to pick up the new value everywhere.

const KEY = "dfs_coordinator_url";

// Trim, default to https://, validate, and drop any trailing slash. Returns ""
// for blank/invalid input.
export function normalizeUrl(raw) {
  let s = String(raw || "").trim();
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  try { new URL(s); } catch { return ""; }
  return s.replace(/\/+$/, "");
}

// The coordinator origin the app talks to. "" means none is configured.
export function getApiUrl() {
  let stored = "";
  try { stored = localStorage.getItem(KEY) || ""; } catch { /* ignore */ }
  return normalizeUrl(stored) || normalizeUrl(import.meta.env.VITE_API_URL || "");
}

// The raw user-set value (for prefilling the Settings field). Empty if unset.
export function getStoredCoordinator() {
  try { return localStorage.getItem(KEY) || ""; } catch { return ""; }
}

export function hasCoordinator() {
  return !!getApiUrl();
}

// Persist the coordinator URL for the renderer and, on desktop, for the main
// process (so the storage node re-registers against it). Throws on invalid input.
export async function setCoordinatorUrl(raw) {
  const url = normalizeUrl(raw);
  if (!url) throw new Error("Enter a valid address, e.g. https://coordinator.example.com");
  try { localStorage.setItem(KEY, url); } catch { /* ignore */ }
  try { await window.dfsDesktop?.settings?.set?.({ coordinatorUrl: url }); } catch { /* ignore */ }
  return url;
}
