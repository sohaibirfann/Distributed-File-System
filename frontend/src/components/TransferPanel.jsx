import { useState, useEffect } from "react";
import { useTransfers } from "../context/TransferContext";
import { Download, FileArchive, CheckCircle, AlertCircle, X, ChevronDown, ChevronUp } from "lucide-react";

const KIND_ICON = { download: Download, zip: FileArchive };

// MEGA-style docked transfer manager (bottom-right): Transfers / Completed tabs,
// live progress bars, and a minimize toggle. Stays put after downloads finish
// until cleared. Hidden only when there are no transfers at all.
export default function TransferPanel() {
  const { transfers, clearDone, remove } = useTransfers();
  const [tab, setTab] = useState("active");
  const [min, setMin] = useState(false);

  const active    = transfers.filter((t) => t.status === "active");
  const completed = transfers.filter((t) => t.status !== "active");

  // Pop the panel open and jump to Transfers whenever something new starts.
  useEffect(() => {
    if (active.length > 0) { setMin(false); setTab("active"); }
  }, [active.length]);

  if (transfers.length === 0) return null;

  const shown = tab === "active" ? active : completed;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 max-w-[calc(100vw-2rem)] glass bg-white/90 dark:bg-neutral-900/90 rounded-xl border border-gray-100 dark:border-neutral-800 shadow-2xl overflow-hidden">
      {/* Header (click to minimize/restore) */}
      <header
        className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-neutral-800 cursor-pointer select-none"
        onClick={() => setMin((m) => !m)}
      >
        <span className="text-xs font-semibold text-gray-700 dark:text-neutral-200">
          {active.length > 0 ? `Transferring ${active.length} item${active.length === 1 ? "" : "s"}…` : "Transfers"}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); setMin((m) => !m); }}
          className="p-0.5 rounded text-gray-400 hover:text-gray-700 dark:text-neutral-500 dark:hover:text-neutral-200 transition-colors"
          title={min ? "Expand" : "Minimize"}
        >
          {min ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </header>

      {!min && (
        <>
          {/* Tabs */}
          <div className="flex items-center gap-1 px-2 pt-2">
            <Tab label="Transfers" count={active.length}    active={tab === "active"}    onClick={() => setTab("active")} />
            <Tab label="Completed" count={completed.length} active={tab === "completed"} onClick={() => setTab("completed")} />
            <div className="flex-1" />
            {tab === "completed" && completed.length > 0 && (
              <button onClick={clearDone} className="px-2 py-1 text-[11px] font-medium text-gray-400 hover:text-gray-700 dark:text-neutral-500 dark:hover:text-neutral-200 transition-colors">
                Clear
              </button>
            )}
          </div>

          <ul className="max-h-72 overflow-y-auto p-2 space-y-1">
            {shown.length === 0 ? (
              <li className="px-2 py-6 text-center text-xs text-gray-400 dark:text-neutral-500">
                {tab === "active" ? "No active transfers" : "Nothing completed yet"}
              </li>
            ) : shown.map((t) => {
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
                    {t.status === "active" && (
                      <div className="mt-1 h-1 rounded-full bg-gray-200/80 dark:bg-neutral-700/80 overflow-hidden">
                        <div
                          className={`h-full rounded-full bg-blue-500 dark:bg-[var(--accent)] transition-[width] duration-200 ${indeterminate ? "animate-pulse w-2/5" : ""}`}
                          style={indeterminate ? undefined : { width: `${Math.max(0, t.progress)}%` }}
                        />
                      </div>
                    )}
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
        </>
      )}
    </div>
  );
}

function Tab({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
        active
          ? "bg-blue-50 dark:bg-[var(--accent)]/15 text-blue-700 dark:text-[var(--accent-bright)]"
          : "text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800"
      }`}
    >
      {label}{count > 0 ? ` (${count})` : ""}
    </button>
  );
}
