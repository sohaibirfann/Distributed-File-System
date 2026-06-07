export function makeThumbnailBlob(blob, max = 256) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new window.Image(); // NB: the DOM constructor, not the lucide icon
    img.onload = () => {
      const w0 = img.naturalWidth || max, h0 = img.naturalHeight || max;
      const r = Math.min(1, max / Math.max(w0, h0));
      const w = Math.max(1, Math.round(w0 * r)), h = Math.max(1, Math.round(h0 * r));
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => resolve(b), "image/webp", 0.8);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}
