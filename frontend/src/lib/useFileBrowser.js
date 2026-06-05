import { useEffect, useState } from "react";
import { useNotify } from "../context/NotificationContext";
import { useAuth }   from "../context/AuthContext";
import { useTransfers } from "../context/TransferContext";
import { loadKey }     from "./groupKeys";
import { decryptBytes } from "./crypto";
import { getPreviewType, PREVIEW_MIME } from "./fileTypes";
import { getApiUrl } from "./api";

const API = getApiUrl();

// All the data + actions behind the file browser: list/poll, download (with
// progress), preview/lightbox, delete, rename, multi-select + bulk zip/delete,
// sort, and search/sort derivation. FileTable is the view that renders what this
// returns. Keeping it here keeps the component focused on markup.
export function useFileBrowser({ groupId, search = "", onStats }) {
  const notify = useNotify();
  const { authFetch } = useAuth();
  const transfers = useTransfers();

  const [files, setFiles]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [apiError, setApiError]         = useState(false);
  const [fileToDelete, setFileToDelete]     = useState(null);
  const [deleting, setDeleting]             = useState(false);
  const [fileToRename, setFileToRename]     = useState(null);
  const [renameValue, setRenameValue]       = useState("");
  const [renaming, setRenaming]             = useState(false);
  const [selected, setSelected]             = useState(() => new Set()); // multi-select (filenames)
  const [confirmBulk, setConfirmBulk]       = useState(false);
  const [bulkDeleting, setBulkDeleting]     = useState(false);
  const [previewFile, setPreviewFile]       = useState(null);
  const [previewType, setPreviewType]       = useState(null);
  const [previewContent, setPreviewContent] = useState("");
  const [previewUrl, setPreviewUrl]         = useState(null);
  const [downloading, setDownloading]       = useState([]);
  const [failedDl, setFailedDl]             = useState([]);   // downloads that errored — show a Retry
  const [sort, setSort]                     = useState({ col: "uploadedAt", dir: "desc" });

  const base = `${API}/api/groups/${groupId}/files`;

  useEffect(() => { setSelected(new Set()); }, [groupId]); // drop selection when switching groups

  useEffect(() => {
    if (!groupId) return;
    fetchFiles();
    // Poll while the app is on-screen; pause when hidden to avoid needless
    // requests (and thumbnail decrypts) in the background, then refetch the
    // moment the tab/window is visible again.
    const id = setInterval(() => {
      if (document.visibilityState === "visible") fetchFiles();
    }, 3000);
    const onVisible = () => { if (document.visibilityState === "visible") fetchFiles(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, [groupId]);

  async function fetchFiles() {
    try {
      const res = await authFetch(base);
      setFiles(await res.json());
      setApiError(false);
    } catch {
      setApiError(true);
    } finally {
      setLoading(false);
    }
  }

  // Read a response body, reporting download progress (% of Content-Length) via
  // onProgress. Falls back to a plain arrayBuffer read if streaming/length is
  // unavailable.
  async function readWithProgress(res, onProgress) {
    const total = Number(res.headers.get("Content-Length")) || 0;
    if (!res.body?.getReader) return res.arrayBuffer();
    const reader = res.body.getReader();
    const chunks = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (total) onProgress(Math.round((received / total) * 100));
    }
    const out = new Uint8Array(received);
    let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.length; }
    return out.buffer;
  }

  async function handleDownload(filename) {
    setDownloading((d) => [...d, filename]);
    setFailedDl((s) => s.filter((f) => f !== filename)); // clear any prior failure on (re)try
    const tid = transfers.start(filename, "download");
    try {
      const key = await loadKey(groupId);
      if (!key) throw new Error("This device doesn't hold this group's key");

      const res = await authFetch(`${base}/download/${encodeURIComponent(filename)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Download failed");
      }

      let plain;
      try {
        plain = await decryptBytes(key, await readWithProgress(res, (pct) => transfers.update(tid, { progress: pct })));
      } catch {
        throw new Error("Could not decrypt — wrong or missing key");
      }

      const url = URL.createObjectURL(new Blob([plain]));
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      transfers.finish(tid, "done");
      notify.success("Download complete");
    } catch (err) {
      transfers.finish(tid, "error");
      notify.error(err.message || "Download failed");
      setFailedDl((s) => (s.includes(filename) ? s : [...s, filename]));
    } finally {
      setDownloading((d) => d.filter((f) => f !== filename));
    }
  }

  function closePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewFile(null);
    setPreviewType(null);
    setPreviewContent("");
    setPreviewUrl(null);
  }

  async function handlePreview(filename) {
    const type = getPreviewType(filename);
    if (previewUrl) URL.revokeObjectURL(previewUrl); // free the prior image when navigating
    const id   = notify.loading("Loading preview…");
    try {
      const key = await loadKey(groupId);
      if (!key) throw new Error("This device doesn't hold this group's key");

      const res = await authFetch(`${base}/download/${encodeURIComponent(filename)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Preview failed");
      }

      let plain;
      try {
        plain = await decryptBytes(key, await res.arrayBuffer());
      } catch {
        throw new Error("Could not decrypt — wrong or missing key");
      }

      if (type === "image" || type === "video" || type === "pdf") {
        const ext = filename.split(".").pop()?.toLowerCase() ?? "";
        setPreviewUrl(URL.createObjectURL(new Blob([plain], { type: PREVIEW_MIME[ext] || "" })));
      } else {
        setPreviewContent(new TextDecoder().decode(plain));
      }
      setPreviewType(type);
      setPreviewFile(filename);
      notify.dismiss(id);
    } catch (err) {
      notify.dismiss(id);
      notify.error(err.message || "Preview failed");
    }
  }

  async function handleDelete(filename) {
    setDeleting(true);
    try {
      const res = await authFetch(`${base}/delete/${encodeURIComponent(filename)}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      notify.success("File deleted");
      setFileToDelete(null);
      fetchFiles();
    } catch {
      notify.error("Delete failed");
    }
    setDeleting(false);
  }

  function openRename(filename) {
    setFileToRename(filename);
    setRenameValue(filename);
  }

  async function handleRename(e) {
    e?.preventDefault?.();
    const newName = renameValue.trim();
    if (!newName || newName === fileToRename) { setFileToRename(null); return; }
    setRenaming(true);
    try {
      const res = await authFetch(`${base}/rename/${encodeURIComponent(fileToRename)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newName }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Rename failed");
      }
      notify.success("File renamed");
      setFileToRename(null);
      fetchFiles();
    } catch (err) {
      notify.error(err.message || "Rename failed");
    }
    setRenaming(false);
  }

  // ── Multi-select ──────────────────────────────────────────────────────────
  function toggleSelect(name) {
    setSelected((s) => { const n = new Set(s); n.has(name) ? n.delete(name) : n.add(name); return n; });
  }
  function toggleSelectAll() {
    setSelected((s) => (s.size === sorted.length ? new Set() : new Set(sorted.map((f) => f.filename))));
  }
  // Download each selected file separately (like a normal one-by-one download).
  async function bulkDownloadIndividual() {
    for (const name of [...selected]) await handleDownload(name); // each gets its own transfer row
  }

  // Decrypt the selected files on-device and hand back a single .zip.
  async function bulkDownload() {
    const names = [...selected];
    if (names.length === 0) return;
    const tid = transfers.start(`${names.length} files (.zip)`, "zip");
    try {
      const key = await loadKey(groupId);
      if (!key) throw new Error("This device doesn't hold this group's key");

      const { default: JSZip } = await import("jszip"); // lazy — keeps it out of the main bundle
      const zip = new JSZip();
      let ok = 0;
      for (const name of names) {
        try {
          const res = await authFetch(`${base}/download/${encodeURIComponent(name)}`);
          if (!res.ok) throw new Error();
          zip.file(name, await decryptBytes(key, await res.arrayBuffer()));
          ok++;
        } catch { /* skip this one; reported in the summary */ }
        transfers.update(tid, { progress: Math.round((ok / names.length) * 100) });
      }
      if (ok === 0) throw new Error("Couldn't fetch any of the selected files");

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "dfs-files.zip";
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);

      transfers.finish(tid, "done");
      notify[ok === names.length ? "success" : "error"](`Zipped ${ok} of ${names.length} file${names.length === 1 ? "" : "s"}`);
    } catch (err) {
      transfers.finish(tid, "error");
      notify.error(err.message || "Download failed");
    }
  }
  async function doBulkDelete() {
    setBulkDeleting(true);
    const names = [...selected];
    const results = await Promise.allSettled(
      names.map((n) => authFetch(`${base}/delete/${encodeURIComponent(n)}`, { method: "DELETE" })),
    );
    const ok = results.filter((r) => r.status === "fulfilled" && r.value.ok).length;
    notify[ok === names.length ? "success" : "error"](`Deleted ${ok} of ${names.length} file${names.length === 1 ? "" : "s"}`);
    setConfirmBulk(false);
    setBulkDeleting(false);
    setSelected(new Set());
    fetchFiles();
  }

  function handleSort(col) {
    setSort((prev) => ({
      col,
      dir: prev.col === col && prev.dir === "asc" ? "desc" : "asc",
    }));
  }

  const filtered = files.filter((f) =>
    f.filename.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    let av, bv;
    if      (sort.col === "filename")   { av = a.filename.toLowerCase();  bv = b.filename.toLowerCase(); }
    else if (sort.col === "size")       { av = a.size;                    bv = b.size; }
    else if (sort.col === "type")       { av = a.filename.split(".").pop()?.toLowerCase() ?? ""; bv = b.filename.split(".").pop()?.toLowerCase() ?? ""; }
    else if (sort.col === "uploadedAt") { av = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0; bv = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0; }
    else return 0;
    if (av < bv) return sort.dir === "asc" ? -1 : 1;
    if (av > bv) return sort.dir === "asc" ?  1 : -1;
    return 0;
  });

  const totalSize = filtered.reduce((s, f) => s + (f.size || 0), 0); // visible (search-filtered)
  const allSize   = files.reduce((s, f) => s + (f.size || 0), 0);    // whole group
  useEffect(() => {
    onStats?.({ count: filtered.length, totalSize, total: files.length, allSize });
  }, [filtered.length, totalSize, files.length, allSize]);

  // Lightbox navigation: the previewable files in display order + where we are.
  const previewList = sorted.filter((f) => getPreviewType(f.filename)).map((f) => f.filename);
  const previewIdx  = previewList.indexOf(previewFile);
  function navigatePreview(dir) {
    const target = previewList[previewIdx + dir];
    if (target) handlePreview(target);
  }

  return {
    base, files, loading, apiError, filtered, sorted,
    downloading, failedDl, handleDownload,
    previewFile, previewType, previewContent, previewUrl,
    handlePreview, closePreview, navigatePreview, previewIdx, previewList,
    fileToDelete, setFileToDelete, deleting, handleDelete,
    fileToRename, setFileToRename, renameValue, setRenameValue, renaming, openRename, handleRename,
    selected, setSelected, toggleSelect, toggleSelectAll,
    confirmBulk, setConfirmBulk, bulkDeleting, bulkDownload, bulkDownloadIndividual, doBulkDelete,
    sort, handleSort,
  };
}
