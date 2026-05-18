import { useState } from "react";
import { useNotify } from "../context/NotificationContext";
import { Upload, X, FileIcon, CheckCircle } from "lucide-react";

const API = import.meta.env.VITE_API_URL;

function formatSize(bytes) {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function UploadPanel({ onUploadSuccess }) {
  const notify = useNotify();
  const [file, setFile]         = useState(null);
  const [progress, setProgress] = useState(0);
  const [done, setDone]         = useState(false);
  const [drag, setDrag]         = useState(false);

  function pick(f) {
    if (!f) return;
    setFile(f);
    setProgress(0);
    setDone(false);
  }

  async function upload() {
    if (!file) return notify.error("Select a file first");
    const id = notify.loading("Uploading…");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API}/api/files/upload`, { method: "POST", body: form });
      if (!res.ok) throw new Error();
      let v = 0;
      const tick = setInterval(() => {
        v += 10;
        setProgress(v);
        if (v >= 100) {
          clearInterval(tick);
          setDone(true);
          notify.dismiss(id);
          notify.success("File uploaded successfully");
          setTimeout(() => {
            onUploadSuccess?.();
            setFile(null);
            setProgress(0);
            setDone(false);
          }, 800);
        }
      }, 120);
    } catch {
      notify.dismiss(id);
      notify.error("Upload failed");
    }
  }

  return (
    <div className="bg-stone-50 dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 p-5">
      {/* Drop zone */}
      <label
        onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl py-10 cursor-pointer transition-colors duration-150 ${
          drag
            ? "border-violet-400 bg-violet-50 dark:bg-violet-950/30"
            : "border-stone-200 dark:border-zinc-700 hover:border-violet-300 dark:hover:border-violet-700 hover:bg-stone-50 dark:hover:bg-zinc-800/50"
        }`}
      >
        <input type="file" className="hidden" onChange={(e) => pick(e.target.files[0])} />
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 transition-colors ${drag ? "bg-violet-100 dark:bg-violet-900/40" : "bg-stone-100 dark:bg-zinc-800"}`}>
          <Upload size={20} className={drag ? "text-violet-500" : "text-gray-400 dark:text-zinc-500"} />
        </div>
        <p className="text-sm font-semibold text-gray-700 dark:text-zinc-300">
          {drag ? "Drop your file here" : "Drag & drop a file"}
        </p>
        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">or click to browse — any file type</p>
      </label>

      {/* Selected file */}
      {file && (
        <div className="mt-4 rounded-xl border border-stone-200 dark:border-zinc-700 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${done ? "bg-emerald-50 dark:bg-emerald-950/40" : "bg-violet-50 dark:bg-violet-950/40"}`}>
              {done
                ? <CheckCircle size={16} className="text-emerald-500" />
                : <FileIcon   size={16} className="text-violet-500" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{file.name}</p>
              <p className="text-xs text-gray-400 dark:text-zinc-500 font-mono">{formatSize(file.size)}</p>
            </div>
            {!done && progress === 0 && (
              <button
                onClick={() => setFile(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-stone-100 dark:hover:bg-zinc-700 transition-colors shrink-0"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Progress bar */}
          {progress > 0 && (
            <div>
              <div className="h-1.5 bg-gray-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-200 ${done ? "bg-emerald-500" : "bg-violet-500"}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1.5 font-mono">
                {done ? "Done!" : `${progress}%`}
              </p>
            </div>
          )}
        </div>
      )}

      <button
        onClick={upload}
        disabled={!file || progress > 0}
        className="mt-4 w-full py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 disabled:hover:translate-y-0"
      >
        Upload to network
      </button>
    </div>
  );
}
