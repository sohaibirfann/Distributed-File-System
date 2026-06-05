import { useEffect, useState } from "react";
import { useNotify } from "../context/NotificationContext";
import { useAuth }   from "../context/AuthContext";
import { useTransfers } from "../context/TransferContext";
import { loadKey }     from "../lib/groupKeys";
import { decryptBytes } from "../lib/crypto";
import { getType, getPreviewType, PREVIEW_MIME } from "../lib/fileTypes";
import { formatBytes, formatRelativeTime } from "../lib/format";
import Skeleton from "./Skeleton";
import FileThumb from "./FileThumb";
import FilePreviewModal from "./FilePreviewModal";
import {
  Download, Eye, Trash2, Pencil, WifiOff, FileArchive,
  File, HardDrive, ChevronUp, ChevronDown, ChevronsUpDown, Loader2, RotateCw,
} from "lucide-react";
import Modal from "./Modal";
import ConfirmDialog from "./ConfirmDialog";

import { getApiUrl } from "../lib/api";
const API = getApiUrl();

// Deterministic per-username avatar color (for the "uploaded by" chip).
const AVATAR_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#f43f5e", "#0ea5e9", "#8b5cf6", "#14b8a6", "#f97316", "#ec4899", "#84cc16"];

function avatarColor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function Avatar({ name }) {
  return (
    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: avatarColor(name) }}>
      {(name?.[0] ?? "?").toUpperCase()}
    </div>
  );
}

export default function FileTable({ groupId, canManage = false, search = "", onStats, view = "list" }) {
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

  const [sort, setSort] = useState({ col: "uploadedAt", dir: "desc" });

  function handleSort(col) {
    setSort((prev) => ({
      col,
      dir: prev.col === col && prev.dir === "asc" ? "desc" : "asc",
    }));
  }

  function SortIcon({ col }) {
    if (sort.col !== col) return <ChevronsUpDown size={11} className="text-gray-300 dark:text-neutral-600" />;
    return sort.dir === "asc"
      ? <ChevronUp   size={11} className="text-blue-500 dark:text-[var(--accent-bright)]" />
      : <ChevronDown size={11} className="text-blue-500 dark:text-[var(--accent-bright)]" />;
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

  const emptyState = (
    apiError && files.length === 0 ? (
      <>
        <WifiOff size={28} className="mx-auto mb-3 text-red-400 dark:text-[var(--accent-bright)]" />
        <p className="text-sm font-medium text-gray-400 dark:text-neutral-500">Can't reach server</p>
      </>
    ) : (
      <>
        <File size={28} className="mx-auto mb-3 text-gray-200 dark:text-neutral-700" />
        <p className="text-sm font-medium text-gray-400 dark:text-neutral-500">{search ? "No files match your search" : "No files here yet"}</p>
        {!search && <p className="text-xs text-gray-300 dark:text-neutral-600 mt-1">{canManage ? "Upload a file to get started" : "Check back later"}</p>}
      </>
    )
  );

  return (
    <>
      {view === "grid" ? (
        <div className="p-4 grid grid-cols-[repeat(auto-fill,minmax(13.5rem,1fr))] gap-3">
          {loading && files.length === 0 ? (
            Array.from({ length: 10 }).map((_, i) => (
              <div key={`gsk-${i}`} className="glass bg-white/70 dark:bg-neutral-900/60 rounded-xl border border-gray-100 dark:border-neutral-800 overflow-hidden">
                <Skeleton className="aspect-square w-full rounded-none" />
                <div className="p-2.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2 mt-2" />
                </div>
              </div>
            ))
          ) : sorted.length === 0 ? (
            <div className="col-span-full flex flex-col items-center py-16 text-center">{emptyState}</div>
          ) : (
            sorted.map((file, i) => {
              const { icon: Icon, bg, color } = getType(file.filename);
              const dl = downloading.includes(file.filename);
              const fail = failedDl.includes(file.filename);
              const previewable = !!getPreviewType(file.filename);
              return (
                <div key={i} className="group relative glass bg-white/70 dark:bg-neutral-900/60 rounded-xl border border-gray-100 dark:border-neutral-800 overflow-hidden hover:border-gray-200 dark:hover:border-neutral-700 hover:shadow-lg transition-all">
                  {/* Large preview (click to open for previewable files) */}
                  <div
                    className={`relative aspect-square ${previewable ? "cursor-pointer" : ""}`}
                    onClick={previewable ? () => handlePreview(file.filename) : undefined}
                    title={previewable ? "Click to preview" : undefined}
                  >
                    <FileThumb filename={file.filename} size={file.size} hasThumb={file.hasThumb} base={base} groupId={groupId} authFetch={authFetch} className={`w-full h-full flex items-center justify-center ${bg}`}>
                      <Icon size={40} className={color} />
                    </FileThumb>

                    {/* Floating actions (with a backdrop so they read over photos) */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute top-2 right-2 flex items-center gap-0.5 rounded-lg bg-white/85 dark:bg-black/55 backdrop-blur-md px-0.5 shadow-sm transition-opacity ${(dl || fail) ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                    >
                      {dl ? (
                        <Loader2 size={15} className="m-1.5 animate-spin text-emerald-500" />
                      ) : (
                        <button onClick={() => handleDownload(file.filename)} title={fail ? "Retry download" : "Download"} className={`p-1.5 rounded-md ${fail ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10" : "text-gray-600 dark:text-neutral-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-600"}`}>{fail ? <RotateCw size={15} /> : <Download size={15} />}</button>
                      )}
                      {canManage && (
                        <>
                          <button onClick={() => openRename(file.filename)} title="Rename" className="p-1.5 rounded-md text-gray-600 dark:text-neutral-300 hover:bg-blue-50 dark:hover:bg-blue-500/10 hover:text-blue-600"><Pencil size={15} /></button>
                          <button onClick={() => setFileToDelete(file.filename)} title="Delete" className="p-1.5 rounded-md text-gray-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500"><Trash2 size={15} /></button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="p-2.5">
                    <p className="text-sm font-medium text-gray-800 dark:text-neutral-100 truncate" title={file.filename}>{file.filename}</p>
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] text-gray-400 dark:text-neutral-500">
                      <span className="truncate">{formatBytes(file.size)} · {formatRelativeTime(file.uploadedAt)}</span>
                      {file.uploadedBy && (
                        <>
                          <span className="shrink-0">·</span>
                          <Avatar name={file.uploadedBy} />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
      <>
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-6 py-2 bg-blue-50/90 dark:bg-[var(--accent)]/15 border-b border-blue-200/60 dark:border-[var(--accent)]/20 text-sm">
          <span className="font-medium text-blue-700 dark:text-[var(--accent-bright)]">{selected.size} selected</span>
          <div className="flex-1" />
          <button onClick={bulkDownloadIndividual} title="Download each file separately" className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-gray-700 dark:text-neutral-200 hover:bg-white/60 dark:hover:bg-white/10 transition-colors">
            <Download size={13} /> Download
          </button>
          <button onClick={bulkDownload} title="Download all as one .zip" className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-gray-700 dark:text-neutral-200 hover:bg-white/60 dark:hover:bg-white/10 transition-colors">
            <FileArchive size={13} /> Zip
          </button>
          {canManage && (
            <button onClick={() => setConfirmBulk(true)} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
              <Trash2 size={13} /> Delete
            </button>
          )}
          <button onClick={() => setSelected(new Set())} className="px-2.5 py-1 rounded-lg text-xs font-medium text-gray-500 dark:text-neutral-400 hover:bg-white/60 dark:hover:bg-white/10 transition-colors">
            Clear
          </button>
        </div>
      )}
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-[#f3f3f3]/80 dark:bg-[var(--bg)]/70 backdrop-blur-xl border-b border-gray-200/70 dark:border-neutral-800">
              <tr>
                <th className="w-10 pl-4 pr-0 py-2.5">
                  <input
                    type="checkbox"
                    aria-label="Select all files"
                    checked={sorted.length > 0 && selected.size === sorted.length}
                    onChange={toggleSelectAll}
                    className="accent-blue-600 dark:accent-[var(--accent)] align-middle"
                  />
                </th>
                {[
                  { label: "Name",   col: "filename",   cls: "" },
                  { label: "Size",   col: "size",       cls: "hidden sm:table-cell" },
                  { label: "Type",   col: "type",       cls: "hidden md:table-cell" },
                  { label: "Added",  col: "uploadedAt", cls: "hidden lg:table-cell" },
                ].map(({ label, col, cls }) => (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className={`px-6 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-neutral-400 cursor-pointer select-none hover:text-gray-700 dark:hover:text-neutral-200 transition-colors ${cls}`}
                  >
                    <div className="flex items-center gap-1">
                      {label}
                      <SortIcon col={col} />
                    </div>
                  </th>
                ))}
                <th className="px-6 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-neutral-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-neutral-800">
              {loading && files.length === 0 ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={`sk-${i}`}>
                    <td className="w-10 pl-4 pr-0 py-2.5" />
                    <td className="px-6 py-2.5">
                      <div className="flex items-center gap-3">
                        <Skeleton className="w-8 h-8 rounded-lg" />
                        <Skeleton className="h-3.5 w-40" />
                      </div>
                    </td>
                    <td className="px-6 py-2.5 hidden sm:table-cell"><Skeleton className="h-3 w-14" /></td>
                    <td className="px-6 py-2.5 hidden md:table-cell"><Skeleton className="h-4 w-10 rounded-md" /></td>
                    <td className="px-6 py-2.5 hidden lg:table-cell"><Skeleton className="h-3 w-16" /></td>
                    <td className="px-6 py-2.5"><div className="flex justify-end"><Skeleton className="h-6 w-24 rounded-lg" /></div></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-16 text-center">
                    {apiError && files.length === 0 ? (
                      <>
                        <WifiOff size={28} className="mx-auto mb-3 text-red-400 dark:text-[var(--accent-bright)]" />
                        <p className="text-sm font-medium text-gray-400 dark:text-neutral-500">Can't reach server</p>
                        <p className="text-xs text-gray-300 dark:text-neutral-600 mt-1">Make sure the backend is running</p>
                      </>
                    ) : (
                      <>
                        <File size={28} className="mx-auto mb-3 text-gray-200 dark:text-neutral-700" />
                        <p className="text-sm font-medium text-gray-400 dark:text-neutral-500">
                          {search ? "No files match your search" : "No files here yet"}
                        </p>
                        {!search && (
                          <p className="text-xs text-gray-300 dark:text-neutral-600 mt-1">
                            {canManage ? "Upload a file to get started" : "Check back later"}
                          </p>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                sorted.map((file, i) => {
                  const { icon: Icon, bg, color } = getType(file.filename);
                  return (
                    <tr key={i} className={`group transition-colors ${selected.has(file.filename) ? "bg-blue-50/60 dark:bg-[var(--accent)]/10" : "hover:bg-gray-50 dark:hover:bg-neutral-800/40"}`}>
                      <td className="w-10 pl-4 pr-0 py-2.5">
                        <input
                          type="checkbox"
                          aria-label={`Select ${file.filename}`}
                          checked={selected.has(file.filename)}
                          onChange={() => toggleSelect(file.filename)}
                          className="accent-blue-600 dark:accent-[var(--accent)] align-middle"
                        />
                      </td>
                      <td className="px-6 py-2.5 max-w-0 w-full">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileThumb filename={file.filename} size={file.size} hasThumb={file.hasThumb} base={base} groupId={groupId} authFetch={authFetch} className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${bg}`}>
                            <Icon size={15} className={color} />
                          </FileThumb>
                          <span className="font-medium text-gray-800 dark:text-neutral-100 truncate min-w-0" title={file.filename}>
                            {file.filename}
                          </span>
                          {file.cached && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-200/70 dark:border-teal-500/20 shrink-0">
                              <HardDrive size={9} />
                              cached
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-2.5 hidden sm:table-cell">
                        <span className="text-gray-500 dark:text-neutral-400 font-mono text-xs whitespace-nowrap">
                          {formatBytes(file.size)}
                        </span>
                      </td>
                      <td className="px-6 py-2.5 hidden md:table-cell">
                        {(() => {
                          const ext = file.filename.split(".").pop()?.toUpperCase() ?? "";
                          const { bg, color } = getType(file.filename);
                          return ext ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold font-mono ${bg} ${color}`}>
                              {ext}
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-neutral-500 text-xs">—</span>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-2.5 hidden lg:table-cell">
                        <span className="text-xs text-gray-500 dark:text-neutral-400">
                          {formatRelativeTime(file.uploadedAt)}
                        </span>
                        {file.uploadedBy && (
                          <span className="block text-[11px] text-gray-400 dark:text-neutral-600">by {file.uploadedBy}</span>
                        )}
                      </td>
                      <td className="px-6 py-2.5">
                        <div className={`flex items-center justify-end gap-1 transition-opacity ${(downloading.includes(file.filename) || failedDl.includes(file.filename)) ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"}`}>
                          {downloading.includes(file.filename) ? (
                            <span className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                              <Loader2 size={13} className="animate-spin" />
                              <span className="hidden sm:inline">Downloading…</span>
                            </span>
                          ) : failedDl.includes(file.filename) ? (
                            <button
                              onClick={() => handleDownload(file.filename)}
                              title="Retry download"
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                            >
                              <RotateCw size={13} />
                              <span className="hidden sm:inline">Retry</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleDownload(file.filename)}
                              title="Download"
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-neutral-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                            >
                              <Download size={13} />
                              <span className="hidden sm:inline">Download</span>
                            </button>
                          )}
                          {getPreviewType(file.filename) && (
                            <button
                              onClick={() => handlePreview(file.filename)}
                              title="Preview"
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-neutral-300 hover:bg-blue-50 dark:hover:bg-blue-500/10 hover:text-blue-700 dark:hover:text-blue-400 transition-colors"
                            >
                              <Eye size={13} />
                              <span className="hidden sm:inline">Preview</span>
                            </button>
                          )}
                          {canManage && (
                            <button
                              onClick={() => openRename(file.filename)}
                              title="Rename"
                              className="p-1.5 rounded-lg text-gray-500 dark:text-neutral-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            >
                              <Pencil size={13} />
                            </button>
                          )}
                          {canManage && (
                            <button
                              onClick={() => setFileToDelete(file.filename)}
                              title="Delete"
                              className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 dark:hover:bg-[var(--accent)]/10 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
      </>
      )}

      {/* Preview modal */}
      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          type={previewType}
          content={previewContent}
          url={previewUrl}
          onClose={closePreview}
          onDownload={() => handleDownload(previewFile)}
          onPrev={() => navigatePreview(-1)}
          onNext={() => navigatePreview(1)}
          hasPrev={previewIdx > 0}
          hasNext={previewIdx >= 0 && previewIdx < previewList.length - 1}
          index={previewIdx}
          total={previewList.length}
        />
      )}

      {/* Rename modal */}
      {fileToRename && (
        <Modal onClose={() => setFileToRename(null)} label="Rename file" dismissable={!renaming}>
          <form onSubmit={handleRename}>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Rename file</h3>
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onFocus={(e) => { const dot = e.target.value.lastIndexOf("."); if (dot > 0) e.target.setSelectionRange(0, dot); }}
              className="w-full px-3.5 py-2.5 bg-white/50 dark:bg-neutral-800/60 border border-gray-200 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-[var(--accent)]"
            />
            <div className="flex gap-2.5 mt-4">
              <button type="button" onClick={() => setFileToRename(null)} disabled={renaming}
                className="flex-1 py-2.5 text-sm font-medium border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40">
                Cancel
              </button>
              <button type="submit" disabled={renaming || !renameValue.trim() || renameValue.trim() === fileToRename}
                className="flex-1 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-500 dark:bg-[var(--accent)] dark:hover:bg-[var(--accent-hover)] text-[var(--on-accent)] rounded-xl transition-colors disabled:opacity-40">
                {renaming ? "Renaming…" : "Rename"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Bulk delete confirm */}
      {confirmBulk && (
        <ConfirmDialog
          label="Delete selected files"
          title={`Delete ${selected.size} file${selected.size === 1 ? "" : "s"}?`}
          confirmLabel="Delete" busyLabel="Deleting…" busy={bulkDeleting}
          onConfirm={doBulkDelete} onClose={() => setConfirmBulk(false)}
        >
          The selected files will be permanently removed from all nodes. This can't be undone.
        </ConfirmDialog>
      )}

      {/* Delete confirm */}
      {fileToDelete && (
        <ConfirmDialog
          label="Delete file" title="Delete this file?"
          confirmLabel="Delete" busyLabel="Deleting…" busy={deleting}
          busyNote="Removing chunks from all nodes… this may take a moment for large files."
          onConfirm={() => handleDelete(fileToDelete)} onClose={() => setFileToDelete(null)}
        >
          <span className="font-medium text-gray-800 dark:text-neutral-200 break-all">{fileToDelete}</span> will be permanently removed from all nodes. This can't be undone.
        </ConfirmDialog>
      )}
    </>
  );
}
