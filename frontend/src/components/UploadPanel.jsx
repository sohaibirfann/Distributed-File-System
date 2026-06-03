import { useState, useRef, useEffect } from "react";
import { io } from "socket.io-client";
import { useNotify } from "../context/NotificationContext";
import { useAuth }   from "../context/AuthContext";
import { loadKey }     from "../lib/groupKeys";
import { encryptBytes } from "../lib/crypto";
import { Upload, X, FileIcon, CheckCircle, Loader2, AlertCircle, AlertTriangle, RotateCw } from "lucide-react";
import { useDialog } from "../lib/useDialog";

import { getApiUrl } from "../lib/api";
const API = getApiUrl();
const MAX_SIZE = 500 * 1024 * 1024;

function formatSize(bytes) {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const toItem = (file) => ({ id: crypto.randomUUID(), file, status: "queued", progress: 0, error: "" });

export default function UploadPanel({ groupId, onUploadSuccess, initialFiles = [] }) {
  const notify = useNotify();
  const { token, authFetch } = useAuth();
  const [items, setItems] = useState(() => initialFiles.map(toItem));
  const [drag, setDrag]   = useState(false);
  const [running, setRunning] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const overwriteRef = useDialog(!!confirm, () => { confirm?.resolve(false); setConfirm(null); }); // { names: [], resolve } — overwrite prompt
  const socketRef = useRef(null);

  // Resolves true (replace) / false (cancel) once the user answers the prompt.
  const askOverwrite = (names) => new Promise((resolve) => setConfirm({ names, resolve }));

  useEffect(() => () => socketRef.current?.disconnect(), []);

  function setItem(id, patch) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }
  function addFiles(list) {
    const arr = Array.from(list || []).map(toItem);
    if (arr.length) setItems((prev) => [...prev, ...arr]);
  }
  function removeItem(id) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  async function uploadOne(item, key, socket) {
    const { file } = item;
    if (file.size > MAX_SIZE) { setItem(item.id, { status: "error", error: "Too large (max 500 MB)" }); return false; }

    setItem(item.id, { status: "encrypting", error: "" });
    let cipher;
    try { cipher = await encryptBytes(key, await file.arrayBuffer()); }
    catch { setItem(item.id, { status: "error", error: "Encryption failed" }); return false; }

    const form = new FormData();
    form.append("file", new Blob([cipher], { type: "application/octet-stream" }), file.name);

    const onProg = ({ filename, percent }) => { if (filename === file.name) setItem(item.id, { progress: percent }); };
    socket.on("upload-progress", onProg);

    try {
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${API}/api/groups/${groupId}/files/upload`);
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) setItem(item.id, { status: "uploading", progress: Math.round((e.loaded / e.total) * 100) });
        });
        xhr.upload.addEventListener("load", () => setItem(item.id, { status: "distributing", progress: 0 }));
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else { try { reject(new Error(JSON.parse(xhr.responseText).message || "Upload failed")); } catch { reject(new Error("Upload failed")); } }
        });
        xhr.addEventListener("error", () => reject(new Error("Upload failed")));
        xhr.send(form);
      });
      setItem(item.id, { status: "done", progress: 100 });
      return true;
    } catch (err) {
      setItem(item.id, { status: "error", error: err.message || "Upload failed" });
      return false;
    } finally {
      socket.off("upload-progress", onProg);
    }
  }

  async function uploadAll() {
    const pending = items.filter((it) => it.status === "queued" || it.status === "error");
    if (!pending.length) return;

    const key = await loadKey(groupId);
    if (!key) return notify.error("This device doesn't hold this group's key");

    // Warn before silently overwriting same-named files already in the group.
    try {
      const res = await authFetch(`${API}/api/groups/${groupId}/files`);
      if (res.ok) {
        const existing = new Set((await res.json()).map((f) => f.filename));
        const clashes  = [...new Set(pending.filter((it) => existing.has(it.file.name)).map((it) => it.file.name))];
        if (clashes.length && !(await askOverwrite(clashes))) return;
      }
    } catch { /* if the check fails, let the upload proceed rather than block it */ }

    setRunning(true);
    const socket = io(API);
    socketRef.current = socket;

    let ok = 0, fail = 0;
    for (const it of pending) {
      const success = await uploadOne(it, key, socket);
      success ? ok++ : fail++;
    }

    socket.disconnect();
    socketRef.current = null;
    setRunning(false);

    if (ok && !fail) notify.success(`Uploaded ${ok} file${ok !== 1 ? "s" : ""}`);
    else if (ok && fail) notify.error(`${ok} uploaded, ${fail} failed`);
    else notify.error(`Upload failed`);

    // Close only when everything succeeded; otherwise keep the panel so errors
    // stay visible (the file list refreshes on its own via polling).
    if (ok && !fail) setTimeout(() => onUploadSuccess?.(), 600);
  }

  // Retry a single failed file (transient upload/network errors).
  async function retryOne(item) {
    if (running) return;
    const key = await loadKey(groupId);
    if (!key) return notify.error("This device doesn't hold this group's key");
    setRunning(true);
    const socket = io(API);
    socketRef.current = socket;
    const ok = await uploadOne(item, key, socket);
    socket.disconnect();
    socketRef.current = null;
    setRunning(false);
    if (ok) notify.success("Upload complete");
  }

  const pendingCount = items.filter((it) => it.status === "queued" || it.status === "error").length;

  function statusLabel(it) {
    switch (it.status) {
      case "encrypting":   return "Encrypting…";
      case "uploading":    return `Uploading ${it.progress}%`;
      case "distributing": return it.progress > 0 ? `Distributing ${it.progress}%` : "Distributing…";
      case "done":         return "Done";
      case "error":        return it.error || "Failed";
      default:             return formatSize(it.file.size);
    }
  }

  return (
    <>
    <div className="glass bg-white/75 dark:bg-neutral-900/70 rounded-2xl border border-gray-100 dark:border-neutral-800 p-5">
      <label
        onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl py-8 cursor-pointer transition-colors duration-150 ${
          drag
            ? "border-blue-400 dark:border-[var(--accent)] bg-blue-50 dark:bg-[var(--accent)]/10"
            : "border-gray-200 dark:border-neutral-700 hover:border-blue-300 dark:hover:border-[var(--accent)]/50 hover:bg-gray-50 dark:hover:bg-neutral-800/50"
        }`}
      >
        <input type="file" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-2.5 transition-colors ${drag ? "bg-blue-100 dark:bg-[var(--accent)]/20" : "bg-gray-100 dark:bg-neutral-800"}`}>
          <Upload size={19} className={drag ? "text-blue-500 dark:text-[var(--accent-bright)]" : "text-gray-400 dark:text-neutral-500"} />
        </div>
        <p className="text-sm font-semibold text-gray-700 dark:text-neutral-300">{drag ? "Drop your files here" : "Drag & drop files"}</p>
        <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">or click to browse — select multiple</p>
      </label>

      {items.length > 0 && (
        <div className="mt-4 space-y-2">
          {items.map((it) => (
            <div key={it.id} className="rounded-xl border border-gray-100 dark:border-neutral-700 p-3">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  it.status === "done"  ? "bg-emerald-50 dark:bg-emerald-500/10"
                  : it.status === "error" ? "bg-red-50 dark:bg-[var(--accent)]/10"
                  : "bg-blue-50 dark:bg-[var(--accent)]/10"
                }`}>
                  {it.status === "done"  ? <CheckCircle size={15} className="text-emerald-500" />
                   : it.status === "error" ? <AlertCircle size={15} className="text-red-500" />
                   : (it.status === "encrypting" || it.status === "uploading" || it.status === "distributing")
                     ? <Loader2 size={15} className="text-blue-500 dark:text-[var(--accent-bright)] animate-spin" />
                     : <FileIcon size={15} className="text-blue-500 dark:text-[var(--accent-bright)]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{it.file.name}</p>
                  <p className={`text-xs font-mono ${it.status === "error" ? "text-red-500" : "text-gray-400 dark:text-neutral-500"}`}>{statusLabel(it)}</p>
                </div>
                {it.status === "error" && !running && (
                  <button onClick={() => retryOne(it)} title="Retry" className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 dark:hover:text-[var(--accent-bright)] hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors shrink-0">
                    <RotateCw size={14} />
                  </button>
                )}
                {(it.status === "queued" || it.status === "error") && !running && (
                  <button onClick={() => removeItem(it.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors shrink-0">
                    <X size={14} />
                  </button>
                )}
              </div>
              {(it.status === "uploading" || it.status === "distributing") && (
                <div className="h-1 bg-gray-100 dark:bg-neutral-700 rounded-full overflow-hidden mt-2">
                  <div className="h-full rounded-full bg-blue-500 dark:bg-[var(--accent)] transition-all duration-300" style={{ width: `${Math.max(4, it.progress)}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={uploadAll}
        disabled={running || pendingCount === 0}
        className="mt-4 w-full py-2.5 bg-blue-600 hover:bg-blue-500 dark:bg-[var(--accent)] dark:hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--on-accent)] text-sm font-semibold rounded-xl transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 disabled:hover:translate-y-0"
      >
        {running ? "Uploading…" : pendingCount > 0 ? `Upload ${pendingCount} file${pendingCount !== 1 ? "s" : ""}` : "Upload to network"}
      </button>
    </div>

    {/* Overwrite confirmation */}
    {confirm && (
      <div className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center z-50 p-4"
        onClick={() => { confirm.resolve(false); setConfirm(null); }}>
        <div ref={overwriteRef} role="dialog" aria-modal="true" aria-label="Replace existing files?" onClick={(e) => e.stopPropagation()}
          className="glass bg-white/80 dark:bg-neutral-900/80 rounded-2xl border border-gray-100 dark:border-neutral-800 w-full max-w-sm p-6">
          <div className="w-11 h-11 bg-amber-50 dark:bg-amber-500/10 rounded-xl flex items-center justify-center mb-4">
            <AlertTriangle size={20} className="text-amber-500" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
            Replace existing file{confirm.names.length !== 1 ? "s" : ""}?
          </h3>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mb-3">
            {confirm.names.length === 1 ? (
              <>A file named <span className="font-medium text-gray-800 dark:text-neutral-200 break-all">{confirm.names[0]}</span> already exists in this group and will be overwritten.</>
            ) : (
              <>{confirm.names.length} files already exist in this group and will be overwritten:</>
            )}
          </p>
          {confirm.names.length > 1 && (
            <ul className="mb-4 max-h-28 overflow-y-auto text-xs font-mono text-gray-600 dark:text-neutral-400 space-y-0.5">
              {confirm.names.map((n) => <li key={n} className="truncate">{n}</li>)}
            </ul>
          )}
          <div className="flex gap-2.5 mt-2">
            <button onClick={() => { confirm.resolve(false); setConfirm(null); }}
              className="flex-1 py-2.5 text-sm font-medium border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors">
              Cancel
            </button>
            <button onClick={() => { confirm.resolve(true); setConfirm(null); }}
              className="flex-1 py-2.5 text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-colors">
              Replace
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
