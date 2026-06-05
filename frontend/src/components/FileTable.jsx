import { useAuth } from "../context/AuthContext";
import { getType, getPreviewType } from "../lib/fileTypes";
import { formatBytes, formatRelativeTime } from "../lib/format";
import { useFileBrowser } from "../lib/useFileBrowser";
import Skeleton from "./Skeleton";
import FileThumb from "./FileThumb";
import FilePreviewModal from "./FilePreviewModal";
import Modal from "./Modal";
import ConfirmDialog from "./ConfirmDialog";
import {
  Download, Eye, Trash2, Pencil, WifiOff, FileArchive,
  File, HardDrive, ChevronUp, ChevronDown, ChevronsUpDown, Loader2, RotateCw,
} from "lucide-react";

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

// View layer for a group's files (grid + list, modals). All data/actions come
// from the useFileBrowser hook so this component stays focused on rendering.
export default function FileTable({ groupId, canManage = false, search = "", onStats, view = "list" }) {
  const { authFetch } = useAuth(); // FileThumb needs it to lazily fetch thumbnails

  const {
    base, files, loading, apiError, filtered, sorted,
    downloading, failedDl, handleDownload,
    previewFile, previewType, previewContent, previewUrl,
    handlePreview, closePreview, navigatePreview, previewIdx, previewList,
    fileToDelete, setFileToDelete, deleting, handleDelete,
    fileToRename, setFileToRename, renameValue, setRenameValue, renaming, openRename, handleRename,
    selected, setSelected, toggleSelect, toggleSelectAll,
    confirmBulk, setConfirmBulk, bulkDeleting, bulkDownload, bulkDownloadIndividual, doBulkDelete,
    sort, handleSort,
  } = useFileBrowser({ groupId, search, onStats });

  function SortIcon({ col }) {
    if (sort.col !== col) return <ChevronsUpDown size={11} className="text-gray-300 dark:text-neutral-600" />;
    return sort.dir === "asc"
      ? <ChevronUp   size={11} className="text-blue-500 dark:text-[var(--accent-bright)]" />
      : <ChevronDown size={11} className="text-blue-500 dark:text-[var(--accent-bright)]" />;
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
                          <span
                            className={`font-medium text-gray-800 dark:text-neutral-100 truncate min-w-0 ${getPreviewType(file.filename) ? "cursor-pointer hover:underline" : ""}`}
                            title={getPreviewType(file.filename) ? `Preview ${file.filename}` : file.filename}
                            onClick={getPreviewType(file.filename) ? () => handlePreview(file.filename) : undefined}
                          >
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
