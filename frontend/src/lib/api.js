
const KEY = "dfs_coordinator_url";

export function normalizeUrl(raw) {
  let s = String(raw || "").trim();
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) {
    const host = s.split("/")[0].split(":")[0];
    const isLan = host === "localhost"
      || /^127\./.test(host)
      || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
    s = (isLan ? "http://" : "https://") + s;
  }
  try { new URL(s); } catch { return ""; }
  return s.replace(/\/+$/, "");
}

export function getApiUrl() {
  let stored = "";
  try { stored = localStorage.getItem(KEY) || ""; } catch { /* ignore */ }
  return normalizeUrl(stored) || normalizeUrl(import.meta.env.VITE_API_URL || "");
}

export function getStoredCoordinator() {
  try { return localStorage.getItem(KEY) || ""; } catch { return ""; }
}

export function hasCoordinator() {
  return !!getApiUrl();
}

export async function pingCoordinator(raw, timeoutMs = 5000) {
  const url = normalizeUrl(raw);
  if (!url) return false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url + "/api/health", { signal: ctrl.signal });
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    return !!(data && data.ok);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function setCoordinatorUrl(raw) {
  const url = normalizeUrl(raw);
  if (!url) throw new Error("Enter a valid address, e.g. https://coordinator.example.com");
  try { localStorage.setItem(KEY, url); } catch { /* ignore */ }
  try { await window.dfsDesktop?.settings?.set?.({ coordinatorUrl: url }); } catch { /* ignore */ }
  return url;
}
