import { useTransfers } from "../context/TransferContext";
import { Download, FileArchive, CheckCircle, AlertCircle, X } from "lucide-react";

const KIND_ICON = { download: Download, zip: FileArchive };

// MEGA-style docked transfer manager: a small card in the bottom-right listing
// active + just-finished transfers with progress bars. Hidden when idle.
export default function TransferPanel() {
  const { transfers, clearDone, remove } = useTransfers();
  if (transfers.length === 0) return null;

  const active = transfers.filter((t) => t.status === "active").length;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 max-w-[calc(100vw-2rem)] glass bg-white/90 dark:bg-neutral-900/90 rounded-xl border border-gray-100 dark:border-neutral-800 shadow-2xl overflow-hidden">
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-neutral-800">
        <span className="text-xs font-semibold text-gray-700 dark:text-neutral-200">
          {active > 0 ? `Transferring ${active} item${active === 1 ? "" : "s"}…` : "Transfers"}
        </span>
        <button
          onClick={clearDone}
          className="text-[11px] font-medium text-gray-400 hover:text-gray-700 dark:text-neutral-500 dark:hover:text-neutral-200 transition-colors"
        >
          Clear
        </button>
      </header>

      <ul className="max-h-72 overflow-y-auto p-2 space-y-1">
        {transfers.map((t) => {
          const Icon = KIND_ICON[t.kind] || Download;
          const indeterminate = t.status === "active" && t.progress < 0;
          return (
            <li key={t.id} className="group/tx flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
              <span className="shrink-0 text-gray-400 dark:text-neutral-500">
                {t.status === "done" ? <CheckCircle size={15} className="text-emerald-500" />
                 : t.status === "error" ? <AlertCircle size={15} className="text-red-500" />
                 : <Icon size={15} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-800 dark:text-neutral-200 truncate" title={t.name}>{t.name}</span>
                  <span className="shrink-0 text-[10px] tabular-nums text-gray-400 dark:text-neutral-500">
                    {t.status === "error" ? "Failed"
                     : t.status === "done" ? "Done"
                     : t.progress >= 0 ? `${t.progress}%` : "…"}
                  </span>
                </div>
                <div className="mt-1 h-1 rounded-full bg-gray-200/80 dark:bg-neutral-700/80 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-[width] duration-200 ${
                      t.status === "error" ? "bg-red-500" : "bg-blue-500 dark:bg-[var(--accent)]"
                    } ${indeterminate ? "animate-pulse w-2/5" : ""}`}
                    style={indeterminate ? undefined : { width: `${t.status === "done" ? 100 : Math.max(0, t.progress)}%` }}
                  />
                </div>
              </div>
              {t.status !== "active" && (
                <button
                  onClick={() => remove(t.id)}
                  className="shrink-0 p-1 rounded text-gray-300 hover:text-gray-600 dark:text-neutral-600 dark:hover:text-neutral-300 opacity-0 group-hover/tx:opacity-100 transition"
                  title="Dismiss"
                >
                  <X size={13} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
