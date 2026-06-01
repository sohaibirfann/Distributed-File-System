import { useState, useRef, useEffect } from "react";
import { io } from "socket.io-client";
import { useNotify } from "../context/NotificationContext";
import { useAuth }   from "../context/AuthContext";
import { loadKey }     from "../lib/groupKeys";
import { encryptBytes } from "../lib/crypto";
import { Upload, X, FileIcon, CheckCircle, Loader2, AlertCircle } from "lucide-react";

const API     = import.meta.env.VITE_API_URL;
const MAX_SIZE = 500 * 1024 * 1024;

function formatSize(bytes) {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const toItem = (file) => ({ id: crypto.randomUUID(), file, status: "queued", progress: 0, error: "" });

export default function UploadPanel({ groupId, onUploadSuccess, initialFiles = [] }) {
  const notify = useNotify();
  const { token } = useAuth();
  const [items, setItems] = useState(() => initialFiles.map(toItem));
  const [drag, setDrag]   = useState(false);
  const [running, setRunning] = useState(false);
  const socketRef = useRef(null);

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
    <div className="glass bg-white/75 dark:bg-neutral-900/70 rounded-2xl border border-gray-100 dark:border-neutral-800 p-5">
      <label
        onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl py-8 cursor-pointer transition-colors duration-150 ${
          drag
            ? "border-blue-400 dark:border-[#FF6363] bg-blue-50 dark:bg-[#FF6363]/10"
            : "border-gray-200 dark:border-neutral-700 hover:border-blue-300 dark:hover:border-[#FF6363]/50 hover:bg-gray-50 dark:hover:bg-neutral-800/50"
        }`}
      >
        <input type="file" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-2.5 transition-colors ${drag ? "bg-blue-100 dark:bg-[#FF6363]/20" : "bg-gray-100 dark:bg-neutral-800"}`}>
          <Upload size={19} className={drag ? "text-blue-500 dark:text-[#FF6363]" : "text-gray-400 dark:text-neutral-500"} />
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
                  : it.status === "error" ? "bg-red-50 dark:bg-[#FF6363]/10"
                  : "bg-blue-50 dark:bg-[#FF6363]/10"
                }`}>
                  {it.status === "done"  ? <CheckCircle size={15} className="text-emerald-500" />
                   : it.status === "error" ? <AlertCircle size={15} className="text-red-500" />
                   : (it.status === "encrypting" || it.status === "uploading" || it.status === "distributing")
                     ? <Loader2 size={15} className="text-blue-500 dark:text-[#FF6363] animate-spin" />
                     : <FileIcon size={15} className="text-blue-500 dark:text-[#FF6363]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{it.file.name}</p>
                  <p className={`text-xs font-mono ${it.status === "error" ? "text-red-500" : "text-gray-400 dark:text-neutral-500"}`}>{statusLabel(it)}</p>
                </div>
                {(it.status === "queued" || it.status === "error") && !running && (
                  <button onClick={() => removeItem(it.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors shrink-0">
                    <X size={14} />
                  </button>
                )}
              </div>
              {(it.status === "uploading" || it.status === "distributing") && (
                <div className="h-1 bg-gray-100 dark:bg-neutral-700 rounded-full overflow-hidden mt-2">
                  <div className="h-full rounded-full bg-blue-500 dark:bg-[#FF6363] transition-all duration-300" style={{ width: `${Math.max(4, it.progress)}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={uploadAll}
        disabled={running || pendingCount === 0}
        className="mt-4 w-full py-2.5 bg-blue-600 hover:bg-blue-500 dark:bg-[#FF6363] dark:hover:bg-[#FF5252] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 disabled:hover:translate-y-0"
      >
        {running ? "Uploading…" : pendingCount > 0 ? `Upload ${pendingCount} file${pendingCount !== 1 ? "s" : ""}` : "Upload to network"}
      </button>
    </div>
  );
}
