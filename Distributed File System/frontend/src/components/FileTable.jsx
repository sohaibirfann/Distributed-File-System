import { useEffect, useState } from "react";
import { useNotify } from "../context/NotificationContext";
import { useAuth }   from "../context/AuthContext";
import { loadKey }     from "../lib/groupKeys";
import { decryptBytes } from "../lib/crypto";
import Skeleton from "./Skeleton";
import {
  Download, Eye, Trash2, X, AlertTriangle, WifiOff,
  FileText, Image, Film, Music, Archive, Code, File, HardDrive,
  ChevronUp, ChevronDown, ChevronsUpDown, Loader2, RotateCw,
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
const DEFAULT_TYPE = { icon: File, bg: "bg-blue-50 dark:bg-[#0067C0]/10", color: "text-blue-500 dark:text-[#4cc2ff]" };

function getType(filename) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return TYPE_MAP[ext] ?? DEFAULT_TYPE;
}

const TEXT_EXTENSIONS = new Set([
  "txt","md","csv","log","json","xml","yaml","yml","toml","ini","env","conf",
  "html","css","svg","js","ts","jsx","tsx","py","java","c","cpp","h","cs",
  "go","rs","rb","php","swift","kt","sh","bash","zsh","ps1","bat","sql",
]);
const IMAGE_EXTENSIONS = new Set(["jpg","jpeg","png","gif","webp","svg"]);

function getPreviewType(filename) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (TEXT_EXTENSIONS.has(ext))  return "text";
  return null;
}

function formatSize(bytes) {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

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

function formatRelativeTime(iso) {
  if (!iso) return "—";
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (diff  < 60000)  return "just now";
  if (mins  < 60)     return `${mins}m ago`;
  if (hours < 24)     return `${hours}h ago`;
  if (days  < 7)      return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function FileTable({ groupId, canManage = false, search = "", onStats, view = "list" }) {
  const notify = useNotify();
  const { authFetch } = useAuth();
  const [files, setFiles]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [apiError, setApiError]         = useState(false);
  const [fileToDelete, setFileToDelete]     = useState(null);
  const [deleting, setDeleting]             = useState(false);
  const [previewFile, setPreviewFile]       = useState(null);
  const [previewType, setPreviewType]       = useState(null);
  const [previewContent, setPreviewContent] = useState("");
  const [previewUrl, setPreviewUrl]         = useState(null);
  const [downloading, setDownloading]       = useState([]);
  const [failedDl, setFailedDl]             = useState([]);   // downloads that errored — show a Retry

  const base = `${API}/api/groups/${groupId}/files`;

  useEffect(() => {
    if (!groupId) return;
    fetchFiles();
    const id = setInterval(fetchFiles, 3000);
    return () => clearInterval(id);
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

  async function handleDownload(filename) {
    setDownloading((d) => [...d, filename]);
    setFailedDl((s) => s.filter((f) => f !== filename)); // clear any prior failure on (re)try
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
        plain = await decryptBytes(key, await res.arrayBuffer());
      } catch {
        throw new Error("Could not decrypt — wrong or missing key");
      }

      const url = URL.createObjectURL(new Blob([plain]));
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      notify.success("Download complete");
    } catch (err) {
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

      if (type === "image") {
        setPreviewUrl(URL.createObjectURL(new Blob([plain])));
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
      ? <ChevronUp   size={11} className="text-blue-500 dark:text-[#4cc2ff]" />
      : <ChevronDown size={11} className="text-blue-500 dark:text-[#4cc2ff]" />;
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

  const emptyState = (
    apiError && files.length === 0 ? (
      <>
        <WifiOff size={28} className="mx-auto mb-3 text-red-400 dark:text-[#4cc2ff]" />
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
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {loading && files.length === 0 ? (
            Array.from({ length: 10 }).map((_, i) => (
              <div key={`gsk-${i}`} className="glass bg-white/70 dark:bg-neutral-900/60 rounded-xl border border-gray-100 dark:border-neutral-800 p-4">
                <Skeleton className="w-12 h-12 rounded-xl" />
                <Skeleton className="h-3.5 w-3/4 mt-3" />
                <Skeleton className="h-3 w-1/2 mt-2" />
              </div>
            ))
          ) : sorted.length === 0 ? (
            <div className="col-span-full flex flex-col items-center py-16 text-center">{emptyState}</div>
          ) : (
            sorted.map((file, i) => {
              const { icon: Icon, bg, color } = getType(file.filename);
              const dl = downloading.includes(file.filename);
              const fail = failedDl.includes(file.filename);
              return (
                <div key={i} className="group relative glass bg-white/70 dark:bg-neutral-900/60 rounded-xl border border-gray-100 dark:border-neutral-800 p-4 hover:-translate-y-0.5 transition-transform">
                  <div className={`absolute top-2 right-2 flex items-center gap-0.5 transition-opacity ${(dl || fail) ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                    {dl ? (
                      <Loader2 size={14} className="m-1.5 animate-spin text-emerald-500" />
                    ) : (
                      <button onClick={() => handleDownload(file.filename)} title={fail ? "Retry download" : "Download"} className={`p-1.5 rounded-lg ${fail ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10" : "text-gray-500 dark:text-neutral-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-600"}`}>{fail ? <RotateCw size={14} /> : <Download size={14} />}</button>
                    )}
                    {getPreviewType(file.filename) && (
                      <button onClick={() => handlePreview(file.filename)} title="Preview" className="p-1.5 rounded-lg text-gray-500 dark:text-neutral-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 hover:text-blue-600"><Eye size={14} /></button>
                    )}
                    {canManage && (
                      <button onClick={() => setFileToDelete(file.filename)} title="Delete" className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 dark:hover:bg-[#0067C0]/10 hover:text-red-500"><Trash2 size={14} /></button>
                    )}
                  </div>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${bg}`}><Icon size={22} className={color} /></div>
                  <p className="mt-3 text-sm font-medium text-gray-800 dark:text-neutral-100 truncate" title={file.filename}>{file.filename}</p>
                  <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">{formatSize(file.size)} · {formatRelativeTime(file.uploadedAt)}</p>
                  {file.uploadedBy && (
                    <div className="flex items-center gap-1.5 mt-2.5">
                      <Avatar name={file.uploadedBy} />
                      <span className="text-[11px] text-gray-400 dark:text-neutral-500 truncate">{file.uploadedBy}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-[#f3f3f3]/80 dark:bg-[#202020]/70 backdrop-blur-xl border-b border-gray-200/70 dark:border-neutral-800">
              <tr>
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
                  <td colSpan="5" className="px-6 py-16 text-center">
                    {apiError && files.length === 0 ? (
                      <>
                        <WifiOff size={28} className="mx-auto mb-3 text-red-400 dark:text-[#4cc2ff]" />
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
                    <tr key={i} className="group hover:bg-gray-50 dark:hover:bg-neutral-800/40 transition-colors">
                      <td className="px-6 py-2.5 max-w-0 w-full">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${bg}`}>
                            <Icon size={15} className={color} />
                          </div>
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
                          {formatSize(file.size)}
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
                              onClick={() => setFileToDelete(file.filename)}
                              title="Delete"
                              className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 dark:hover:bg-[#0067C0]/10 hover:text-red-500 transition-colors"
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
      )}

      {/* Preview modal */}
      {previewFile && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center z-50 p-4"
          onClick={closePreview}
        >
          <div
            className={`glass bg-white/75 dark:bg-neutral-900/70 rounded-2xl border border-gray-100 dark:border-neutral-800 flex flex-col ${previewType === "image" ? "max-w-[90vw]" : "w-full max-w-3xl max-h-[80vh]"}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-neutral-800 shrink-0">
              <div className="flex items-center gap-2.5">
                {(() => { const { icon: Icon, bg, color } = getType(previewFile); return (
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${bg}`}>
                    <Icon size={13} className={color} />
                  </div>
                ); })()}
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{previewFile}</span>
                {previewType === "text" && (
                  <span className="text-xs text-gray-400 dark:text-neutral-500">
                    {previewContent.split("\n").length} lines
                  </span>
                )}
              </div>
              <button
                onClick={closePreview}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Modal body */}
            {previewType === "image" ? (
              <div className="p-4 rounded-b-2xl"
                style={{ background: "repeating-conic-gradient(rgba(0,0,0,0.06) 0% 25%, transparent 0% 50%) 0 0 / 16px 16px" }}>
                <img
                  src={previewUrl}
                  alt={previewFile}
                  className="block max-w-full max-h-[75vh] object-contain rounded-lg shadow-md"
                />
              </div>
            ) : (
              <div className="flex-1 overflow-auto rounded-b-2xl bg-white/30 dark:bg-black">
                <table className="min-w-full border-collapse font-mono text-xs">
                  <tbody>
                    {previewContent.split("\n").map((line, i) => (
                      <tr key={i} className="hover:bg-blue-50/40 dark:hover:bg-neutral-800/40">
                        <td className="sticky left-0 select-none text-right pr-3 pl-4 py-px text-neutral-400 dark:text-neutral-600 bg-gray-50/90 dark:bg-neutral-900/90 border-r border-gray-100 dark:border-neutral-800 w-10 align-top leading-5">
                          {i + 1}
                        </td>
                        <td className="pl-4 pr-6 py-px text-gray-700 dark:text-neutral-300 whitespace-pre-wrap break-all align-top leading-5">
                          {line || " "}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete modal */}
      {fileToDelete && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center z-50 p-4"
          onClick={() => !deleting && setFileToDelete(null)}
        >
          <div
            className="glass bg-white/75 dark:bg-neutral-900/70 rounded-2xl border border-gray-100 dark:border-neutral-800 w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-11 h-11 bg-red-50 dark:bg-[#0067C0]/10 rounded-xl flex items-center justify-center mb-4">
              <AlertTriangle size={20} className="text-red-500" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Delete this file?</h3>
            <p className="text-sm text-gray-500 dark:text-neutral-400 mb-5">
              <span className="font-medium text-gray-800 dark:text-neutral-200 break-all">{fileToDelete}</span> will be permanently removed from all nodes. This can't be undone.
            </p>
            {deleting && (
              <p className="text-xs text-gray-400 dark:text-neutral-500 mb-4 flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full border-2 border-red-400 border-t-transparent animate-spin shrink-0" />
                Removing chunks from all nodes… this may take a moment for large files.
              </p>
            )}
            <div className="flex gap-2.5">
              <button
                onClick={() => setFileToDelete(null)}
                disabled={deleting}
                className="flex-1 py-2.5 text-sm font-medium border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(fileToDelete)}
                disabled={deleting}
                className="flex-1 py-2.5 text-sm font-medium bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors disabled:opacity-60 disabled:pointer-events-none"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
