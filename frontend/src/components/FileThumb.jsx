import { useEffect, useState, useRef } from "react";
import { loadKey } from "../lib/groupKeys";
import { decryptBytes, b64urlToBytes } from "../lib/crypto";
import { getPreviewType } from "../lib/fileTypes";
import { makeThumbnailBlob } from "../lib/thumbnail";

const THUMB_MAX_BYTES = 12 * 1024 * 1024; // fallback only: skip larger images
const thumbCache = new Map();             // `${groupId}:${filename}` -> objectURL ("" = failed/skip)

export default function FileThumb({ filename, size, base, groupId, authFetch, hasThumb, className, children }) {
  const isImage  = getPreviewType(filename) === "image";
  const cacheKey = `${groupId}:${filename}`;
  const ref = useRef(null);
  const [src, setSrc] = useState(() => thumbCache.get(cacheKey) || null);

  useEffect(() => {
    if (!isImage) return;
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

          let url;
          if (hasThumb) {
            const res = await authFetch(`${base}/thumb/${encodeURIComponent(filename)}`);
            if (!res.ok) throw new Error("thumb");
            const { thumb } = await res.json();
            const bytes = await decryptBytes(key, b64urlToBytes(thumb));
            url = URL.createObjectURL(new Blob([bytes], { type: "image/webp" }));
          } else {
            if (size != null && size > THUMB_MAX_BYTES) { thumbCache.set(cacheKey, ""); return; }
            const res = await authFetch(`${base}/download/${encodeURIComponent(filename)}`);
            if (!res.ok) throw new Error("download");
            const small = await makeThumbnailBlob(new Blob([await decryptBytes(key, await res.arrayBuffer())]));
            if (!small) throw new Error("decode");
            url = URL.createObjectURL(small);
          }

          thumbCache.set(cacheKey, url);
          if (!cancelled) setSrc(url);
        } catch {
          thumbCache.set(cacheKey, ""); // remember the miss; don't keep retrying
        }
      })();
    }, { rootMargin: "150px" });
    io.observe(el);
    return () => { cancelled = true; io.disconnect(); };
  }, [cacheKey, isImage, size, hasThumb]);

  return (
    <div ref={ref} className={`${className} overflow-hidden`}>
      {src ? <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" /> : children}
    </div>
  );
}
