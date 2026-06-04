import { X } from "lucide-react";
import { getType } from "../lib/fileTypes";
import { useDialog } from "../lib/useDialog";

// Presentational preview dialog. The caller decrypts the file and passes the
// ready-to-render data: a blob `url` (image/video/pdf) or text `content`.
export default function FilePreviewModal({ file, type, content, url, onClose }) {
  const panelRef = useDialog(true, onClose);
  const { icon: Icon, bg, color } = getType(file);

  return (
    <div
      className="dialog-backdrop fixed inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef} role="dialog" aria-modal="true" aria-label={`Preview: ${file}`}
        className={`dialog-panel glass bg-white/75 dark:bg-neutral-900/70 rounded-2xl border border-gray-100 dark:border-neutral-800 flex flex-col ${
          type === "image" || type === "video" ? "max-w-[90vw]"
          : type === "pdf" ? "w-[85vw] h-[85vh]"
          : "w-full max-w-3xl max-h-[80vh]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-neutral-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${bg}`}>
              <Icon size={13} className={color} />
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">{file}</span>
            {type === "text" && (
              <span className="text-xs text-gray-400 dark:text-neutral-500">
                {content.split("\n").length} lines
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        {type === "image" ? (
          <div className="p-4 rounded-b-2xl"
            style={{ background: "repeating-conic-gradient(rgba(0,0,0,0.06) 0% 25%, transparent 0% 50%) 0 0 / 16px 16px" }}>
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
      </div>
    </div>
  );
}
