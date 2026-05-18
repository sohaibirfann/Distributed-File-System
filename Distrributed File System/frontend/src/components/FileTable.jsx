import { useEffect, useState } from "react";
import { useNotify } from "../context/NotificationContext";
import {
  Download, Eye, Trash2, Search, X, AlertTriangle, WifiOff,
  FileText, Image, Film, Music, Archive, Code, File,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL;

const TYPE_MAP = {
  // images
  jpg:  { icon: Image,    bg: "bg-sky-50 dark:bg-sky-950/40",       color: "text-sky-500"                          },
  jpeg: { icon: Image,    bg: "bg-sky-50 dark:bg-sky-950/40",       color: "text-sky-500"                          },
  png:  { icon: Image,    bg: "bg-sky-50 dark:bg-sky-950/40",       color: "text-sky-500"                          },
  gif:  { icon: Image,    bg: "bg-pink-50 dark:bg-pink-950/40",     color: "text-pink-500"                         },
  svg:  { icon: Image,    bg: "bg-orange-50 dark:bg-orange-950/40", color: "text-orange-500"                       },
  webp: { icon: Image,    bg: "bg-sky-50 dark:bg-sky-950/40",       color: "text-sky-500"                          },
  // video
  mp4:  { icon: Film,     bg: "bg-purple-50 dark:bg-purple-950/40", color: "text-purple-500"                       },
  mov:  { icon: Film,     bg: "bg-purple-50 dark:bg-purple-950/40", color: "text-purple-500"                       },
  avi:  { icon: Film,     bg: "bg-purple-50 dark:bg-purple-950/40", color: "text-purple-500"                       },
  mkv:  { icon: Film,     bg: "bg-purple-50 dark:bg-purple-950/40", color: "text-purple-500"                       },
  // audio
  mp3:  { icon: Music,    bg: "bg-emerald-50 dark:bg-emerald-950/40", color: "text-emerald-500"                    },
  wav:  { icon: Music,    bg: "bg-emerald-50 dark:bg-emerald-950/40", color: "text-emerald-500"                    },
  flac: { icon: Music,    bg: "bg-emerald-50 dark:bg-emerald-950/40", color: "text-emerald-500"                    },
  // docs
  pdf:  { icon: FileText, bg: "bg-red-50 dark:bg-red-950/40",       color: "text-red-500"                         },
  doc:  { icon: FileText, bg: "bg-blue-50 dark:bg-blue-950/40",     color: "text-blue-500"                        },
  docx: { icon: FileText, bg: "bg-blue-50 dark:bg-blue-950/40",     color: "text-blue-500"                        },
  txt:  { icon: FileText, bg: "bg-gray-100 dark:bg-neutral-800",    color: "text-gray-500 dark:text-neutral-400"  },
  // archives
  zip:  { icon: Archive,  bg: "bg-amber-50 dark:bg-amber-950/40",   color: "text-amber-500"                       },
  rar:  { icon: Archive,  bg: "bg-amber-50 dark:bg-amber-950/40",   color: "text-amber-500"                       },
  "7z": { icon: Archive,  bg: "bg-amber-50 dark:bg-amber-950/40",   color: "text-amber-500"                       },
  tar:  { icon: Archive,  bg: "bg-amber-50 dark:bg-amber-950/40",   color: "text-amber-500"                       },
  // code
  js:   { icon: Code,     bg: "bg-yellow-50 dark:bg-yellow-950/40", color: "text-yellow-500"                      },
  ts:   { icon: Code,     bg: "bg-blue-50 dark:bg-blue-950/40",     color: "text-blue-500"                        },
  py:   { icon: Code,     bg: "bg-blue-50 dark:bg-blue-950/40",     color: "text-blue-500"                        },
  json: { icon: Code,     bg: "bg-yellow-50 dark:bg-yellow-950/40", color: "text-yellow-500"                      },
  html: { icon: Code,     bg: "bg-orange-50 dark:bg-orange-950/40", color: "text-orange-500"                      },
  css:  { icon: Code,     bg: "bg-sky-50 dark:bg-sky-950/40",       color: "text-sky-500"                         },
};
const DEFAULT_TYPE = { icon: File, bg: "bg-blue-50 dark:bg-[#FF6363]/10", color: "text-blue-500 dark:text-[#FF6363]" };

function getType(filename) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return TYPE_MAP[ext] ?? DEFAULT_TYPE;
}

function formatSize(bytes) {
  if (bytes < 1024)             return `${bytes} B`;
  if (bytes < 1024 * 1024)      return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function FileTable({ isAdmin = false }) {
  const notify = useNotify();
  const [files, setFiles]               = useState([]);
  const [search, setSearch]             = useState("");
  const [apiError, setApiError]         = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [previewFile, setPreviewFile]   = useState(null);
  const [previewContent, setPreviewContent] = useState("");

  useEffect(() => {
    fetchFiles();
    const id = setInterval(fetchFiles, 3000);
    return () => clearInterval(id);
  }, []);

  async function fetchFiles() {
    try {
      const res = await fetch(`${API}/api/files`);
      setFiles(await res.json());
      setApiError(false);
    } catch {
      setApiError(true);
    }
  }

  async function handleDownload(filename) {
    const id = notify.loading("Preparing download…");
    try {
      const res = await fetch(`${API}/api/files/download/${filename}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      notify.dismiss(id);
      notify.success("Download complete");
    } catch {
      notify.dismiss(id);
      notify.error("Download failed");
    }
  }

  async function handlePreview(filename) {
    const id = notify.loading("Loading preview…");
    try {
      const res = await fetch(`${API}/api/files/download/${filename}`);
      setPreviewContent(await res.text());
      setPreviewFile(filename);
      notify.dismiss(id);
    } catch {
      notify.dismiss(id);
      notify.error("Preview failed");
    }
  }

  async function handleDelete(filename) {
    try {
      await fetch(`${API}/api/files/delete/${filename}`, { method: "DELETE" });
      notify.success("File deleted");
      setFileToDelete(null);
      fetchFiles();
    } catch {
      notify.error("Delete failed");
    }
  }

  const filtered = files.filter((f) =>
    f.filename.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="glass bg-white/75 dark:bg-neutral-900/70 rounded-2xl border border-gray-100 dark:border-neutral-800 overflow-hidden">
        {/* Search + count */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 dark:border-neutral-800">
          <Search size={15} className="text-gray-400 dark:text-neutral-500 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files…"
            className="flex-1 text-sm bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="text-gray-400 hover:text-gray-600 dark:text-neutral-500 dark:hover:text-neutral-300 transition-colors"
            >
              <X size={14} />
            </button>
          )}
          <span className="text-xs text-gray-400 dark:text-neutral-500 shrink-0 border-l border-gray-100 dark:border-neutral-800 pl-3">
            {filtered.length} {filtered.length === 1 ? "file" : "files"}
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/40 dark:bg-neutral-800/40 border-b border-gray-100 dark:border-neutral-800">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-neutral-400">Name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-neutral-400 hidden sm:table-cell">Size</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-neutral-400 hidden md:table-cell">Status</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 dark:text-neutral-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-neutral-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-5 py-16 text-center">
                    {apiError && files.length === 0 ? (
                      <>
                        <WifiOff size={28} className="mx-auto mb-3 text-red-400 dark:text-[#FF6363]" />
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
                            {isAdmin ? "Upload a file to get started" : "Check back later"}
                          </p>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((file, i) => {
                  const { icon: Icon, bg, color } = getType(file.filename);
                  return (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-neutral-800/40 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${bg}`}>
                            <Icon size={15} className={color} />
                          </div>
                          <span className="font-medium text-gray-800 dark:text-neutral-100 truncate max-w-[200px] sm:max-w-none">
                            {file.filename}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 hidden sm:table-cell">
                        <span className="text-gray-500 dark:text-neutral-400 font-mono text-xs">
                          {formatSize(file.size)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Distributed
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleDownload(file.filename)}
                            title="Download"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-neutral-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                          >
                            <Download size={13} />
                            <span className="hidden sm:inline">Download</span>
                          </button>
                          <button
                            onClick={() => handlePreview(file.filename)}
                            title="Preview"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-neutral-300 hover:bg-blue-50 dark:hover:bg-blue-500/10 hover:text-blue-700 dark:hover:text-blue-400 transition-colors"
                          >
                            <Eye size={13} />
                            <span className="hidden sm:inline">Preview</span>
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => setFileToDelete(file.filename)}
                              title="Delete"
                              className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 dark:hover:bg-[#FF6363]/10 hover:text-red-500 transition-colors"
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
        </div>
      </div>

      {/* Preview modal */}
      {previewFile && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewFile(null)}
        >
          <div
            className="glass bg-white/75 dark:bg-neutral-900/70 rounded-2xl border border-gray-100 dark:border-neutral-800 w-full max-w-2xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-neutral-800 shrink-0">
              <div className="flex items-center gap-2.5">
                {(() => { const { icon: Icon, bg, color } = getType(previewFile); return (
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${bg}`}>
                    <Icon size={13} className={color} />
                  </div>
                ); })()}
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{previewFile}</span>
              </div>
              <button
                onClick={() => setPreviewFile(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X size={15} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-5 bg-white/30 dark:bg-black rounded-b-2xl">
              <pre className="text-xs text-gray-700 dark:text-neutral-300 font-mono whitespace-pre-wrap leading-relaxed">
                {previewContent}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {fileToDelete && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setFileToDelete(null)}
        >
          <div
            className="glass bg-white/75 dark:bg-neutral-900/70 rounded-2xl border border-gray-100 dark:border-neutral-800 w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-11 h-11 bg-red-50 dark:bg-[#FF6363]/10 rounded-xl flex items-center justify-center mb-4">
              <AlertTriangle size={20} className="text-red-500" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Delete this file?</h3>
            <p className="text-sm text-gray-500 dark:text-neutral-400 mb-5">
              <span className="font-medium text-gray-800 dark:text-neutral-200 break-all">{fileToDelete}</span> will be permanently removed from all nodes. This can't be undone.
            </p>
            <div className="flex gap-2.5">
              <button
                onClick={() => setFileToDelete(null)}
                className="flex-1 py-2.5 text-sm font-medium border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(fileToDelete)}
                className="flex-1 py-2.5 text-sm font-medium bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
