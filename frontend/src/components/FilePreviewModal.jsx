import { useEffect } from "react";
import { X, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { getType } from "../lib/fileTypes";
import Modal from "./Modal";

// Presentational preview dialog. The caller decrypts the file and passes the
// ready-to-render data: a blob `url` (image/video/pdf) or text `content`.
// Optional onPrev/onNext turn it into a lightbox over the group's previewable
// files (arrows + ←/→ keys).
export default function FilePreviewModal({
  file, type, content, url, onClose, onDownload,
  onPrev, onNext, hasPrev = false, hasNext = false, index, total,
}) {
  const { icon: Icon, bg, color } = getType(file);
  const sizing =
    type === "image" || type === "video" ? "max-w-[90vw]"
    : type === "pdf" ? "w-[85vw] h-[85vh]"
    : "w-full max-w-3xl max-h-[80vh]";

  // ←/→ flip between previewable files.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowLeft"  && hasPrev) { e.preventDefault(); onPrev?.(); }
      else if (e.key === "ArrowRight" && hasNext) { e.preventDefault(); onNext?.(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasPrev, hasNext, onPrev, onNext]);

  return (
    <Modal onClose={onClose} label={`Preview: ${file}`} panelClassName={`flex flex-col ${sizing}`}>
        {/* Lightbox arrows (viewport-anchored) */}
        {hasPrev && (
          <button
            onClick={onPrev} title="Previous (←)"
            className="fixed left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/85 dark:bg-black/55 backdrop-blur-md shadow-lg flex items-center justify-center text-gray-700 dark:text-neutral-200 hover:bg-white dark:hover:bg-black/70 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
        )}
        {hasNext && (
          <button
            onClick={onNext} title="Next (→)"
            className="fixed right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/85 dark:bg-black/55 backdrop-blur-md shadow-lg flex items-center justify-center text-gray-700 dark:text-neutral-200 hover:bg-white dark:hover:bg-black/70 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-neutral-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${bg}`}>
              <Icon size={13} className={color} />
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{file}</span>
            {type === "text" && (
              <span className="text-xs text-gray-400 dark:text-neutral-500 shrink-0">
                {content.split("\n").length} lines
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {total > 1 && Number.isInteger(index) && (
              <span className="text-xs tabular-nums text-gray-400 dark:text-neutral-500 mr-1.5">{index + 1} of {total}</span>
            )}
            {onDownload && (
              <button
                onClick={onDownload}
                title="Download"
                className="p-1.5 rounded-lg text-gray-500 dark:text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
              >
                <Download size={15} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Body */}
        {type === "image" ? (
          <div className="preview-checkerboard p-4 rounded-b-2xl">
            <img
              src={url}
              alt={file}
              className="block max-w-full max-h-[75vh] object-contain rounded-lg shadow-md"
            />
          </div>
        ) : type === "video" ? (
          <div className="p-4 rounded-b-2xl bg-black/80">
            <video
              src={url}
              controls
              autoPlay
              className="block max-w-full max-h-[75vh] rounded-lg shadow-md"
            />
          </div>
        ) : type === "pdf" ? (
          <iframe
            src={url}
            title={file}
            className="flex-1 w-full rounded-b-2xl bg-white"
          />
        ) : (
          <div className="flex-1 overflow-auto rounded-b-2xl bg-white/30 dark:bg-black">
            <table className="min-w-full border-collapse font-mono text-xs">
              <tbody>
                {content.split("\n").map((line, i) => (
                  <tr key={i} className="hover:bg-blue-50/40 dark:hover:bg-neutral-800/40">
                    <td className="sticky left-0 select-none text-right pr-3 pl-4 py-px text-neutral-400 dark:text-neutral-600 bg-gray-50/90 dark:bg-neutral-900/90 border-r border-gray-100 dark:border-neutral-800 w-10 align-top leading-5">
                      {i + 1}
                    </td>
                    <td className="pl-4 pr-6 py-px text-gray-700 dark:text-neutral-300 whitespace-pre-wrap break-all align-top leading-5">
                      {line || " "}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </Modal>
  );
}
