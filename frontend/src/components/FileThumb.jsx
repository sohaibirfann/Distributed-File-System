import { useEffect, useState, useRef } from "react";
import { loadKey } from "../lib/groupKeys";
import { decryptBytes } from "../lib/crypto";
import { getPreviewType } from "../lib/fileTypes";

// ── Image thumbnails ──────────────────────────────────────────────────────────
// There's no server-side thumbnail (the server only holds ciphertext), so a
// thumbnail means downloading + decrypting the file on-device. To keep that cheap
// we only do it for images under a size cap, lazily (when the row scrolls into
// view), and we downscale to a tiny data URL and cache it (revoking the full blob).
const THUMB_MAX_BYTES = 12 * 1024 * 1024; // skip images larger than this
const thumbCache = new Map();             // `${groupId}:${filename}` -> dataURL ("" = failed/skip)

function makeThumb(blob, max = 128) {
  return new Promise((resolve, reject) => {
    const u = URL.createObjectURL(blob);
    const img = new window.Image(); // NB: `Image` is the DOM constructor, not the lucide icon
    img.onload = () => {
      const w0 = img.naturalWidth || max, h0 = img.naturalHeight || max;
      const r = Math.min(1, max / Math.max(w0, h0));
      const w = Math.max(1, Math.round(w0 * r)), h = Math.max(1, Math.round(h0 * r));
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(u);
      try { resolve(c.toDataURL("image/webp", 0.82)); }
      catch { try { resolve(c.toDataURL("image/png")); } catch (e) { reject(e); } }
    };
    img.onerror = () => { URL.revokeObjectURL(u); reject(new Error("decode")); };
    img.src = u;
  });
}

// Renders the file's type icon (passed as children), swapping in a decrypted
// image thumbnail once it scrolls into view (for image files under the size cap).
// Keeps the parent's sized/rounded container styling via `className`.
export default function FileThumb({ filename, size, base, groupId, authFetch, className, children }) {
  const isImage  = getPreviewType(filename) === "image";
  const cacheKey = `${groupId}:${filename}`;
  const ref = useRef(null);
  const [src, setSrc] = useState(() => thumbCache.get(cacheKey) || null);

  useEffect(() => {
    if (!isImage || (size != null && size > THUMB_MAX_BYTES)) return;
    if (thumbCache.has(cacheKey)) { setSrc(thumbCache.get(cacheKey) || null); return; }
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      (async () => {
        try {
          const key = await loadKey(groupId);
          if (!key) throw new Error("no key");
          const res = await authFetch(`${base}/download/${encodeURIComponent(filename)}`);
          if (!res.ok) throw new Error("download");
          const thumb = await makeThumb(new Blob([await decryptBytes(key, await res.arrayBuffer())]));
          thumbCache.set(cacheKey, thumb);
          if (!cancelled) setSrc(thumb);
        } catch {
          thumbCache.set(cacheKey, ""); // remember the miss; don't keep retrying
        }
      })();
    }, { rootMargin: "150px" });
    io.observe(el);
    return () => { cancelled = true; io.disconnect(); };
  }, [cacheKey, isImage, size]);

  return (
    <div ref={ref} className={`${className} overflow-hidden`}>
      {src ? <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" /> : children}
    </div>
  );
}
