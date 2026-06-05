import { useState } from "react";
import { useAuth }   from "../context/AuthContext";
import { useUploads } from "../context/UploadContext";
import { formatBytes } from "../lib/format";
import { Upload, X, FileIcon, AlertTriangle } from "lucide-react";
import Modal from "./Modal";

import { getApiUrl } from "../lib/api";
const API = getApiUrl();

// A lightweight file picker. The actual uploading runs in the background via the
// UploadProvider and shows in the transfer panel, so this dialog just collects
// files (and warns about overwrites) then closes.
export default function UploadPanel({ groupId, onUploadSuccess, initialFiles = [] }) {
  const { authFetch }    = useAuth();
  const { startUploads } = useUploads();
  const [files, setFiles] = useState(() => [...initialFiles]);
  const [drag, setDrag]   = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy]   = useState(false);

  // Resolves true (replace) / false (cancel) once the user answers.
  const askOverwrite = (names) => new Promise((resolve) => setConfirm({ names, resolve }));

  function addFiles(list) {
    const arr = Array.from(list || []);
    if (arr.length) setFiles((prev) => [...prev, ...arr]);
  }
  const removeAt = (i) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

  async function submit() {
    if (!files.length) return;
    setBusy(true);
    try {
      // Warn before silently overwriting same-named files already in the group.
      try {
        const res = await authFetch(`${API}/api/groups/${groupId}/files`);
        if (res.ok) {
          const existing = new Set((await res.json()).map((f) => f.filename));
          const clashes  = [...new Set(files.filter((f) => existing.has(f.name)).map((f) => f.name))];
          if (clashes.length && !(await askOverwrite(clashes))) { setBusy(false); return; }
        }
      } catch { /* if the check fails, let the upload proceed rather than block it */ }

      startUploads(groupId, files); // fire-and-forget — progress lives in the transfer panel
      onUploadSuccess?.();           // close the dialog; the file list refreshes via polling
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
    <div>
      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Upload files</h3>
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

      {files.length > 0 && (
        <div className="mt-4 space-y-1.5 max-h-56 overflow-y-auto">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-neutral-700 p-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-blue-50 dark:bg-[var(--accent)]/10">
                <FileIcon size={15} className="text-blue-500 dark:text-[var(--accent-bright)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{f.name}</p>
                <p className="text-xs font-mono text-gray-400 dark:text-neutral-500">{formatBytes(f.size)}</p>
              </div>
              <button onClick={() => removeAt(i)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors shrink-0">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={submit}
        disabled={busy || files.length === 0}
        className="mt-4 w-full py-2.5 bg-blue-600 hover:bg-blue-500 dark:bg-[var(--accent)] dark:hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--on-accent)] text-sm font-semibold rounded-xl transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 disabled:hover:translate-y-0"
      >
        {files.length > 0 ? `Upload ${files.length} file${files.length !== 1 ? "s" : ""}` : "Select files to upload"}
      </button>
    </div>

    {/* Overwrite confirmation */}
    {confirm && (
      <Modal onClose={() => { confirm.resolve(false); setConfirm(null); }} label="Replace existing files?">
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
      </Modal>
    )}
    </>
  );
}
