import { AlertTriangle } from "lucide-react";
import Modal from "./Modal";

// Reusable confirm dialog built on Modal: an icon badge, title, body copy
// (children), and Cancel / confirm buttons. `tone` picks the accent (danger =
// red, warn = amber). `busy` disables both buttons and swaps the confirm label;
// `busyNote` shows an optional spinner line while the action runs.
export default function ConfirmDialog({
  title,
  label,
  confirmLabel = "Confirm",
  busyLabel    = "Working…",
  busy         = false,
  busyNote,
  tone         = "danger",
  icon: Icon   = AlertTriangle,
  onConfirm,
  onClose,
  children,
}) {
  const danger = tone === "danger";
  return (
    <Modal onClose={onClose} label={label || title} dismissable={!busy}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${danger ? "bg-red-50 dark:bg-[var(--accent)]/10" : "bg-amber-50 dark:bg-amber-500/10"}`}>
        <Icon size={20} className={danger ? "text-red-500" : "text-amber-500"} />
      </div>
      <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-neutral-400 mb-5">{children}</p>
      {busy && busyNote && (
        <p className="text-xs text-gray-400 dark:text-neutral-500 mb-4 flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full border-2 border-red-400 border-t-transparent animate-spin shrink-0" />
          {busyNote}
        </p>
      )}
      <div className="flex gap-2.5">
        <button
          onClick={onClose}
          disabled={busy}
          className="flex-1 py-2.5 text-sm font-medium border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={busy}
          className={`flex-1 py-2.5 text-sm font-medium text-white rounded-xl transition-colors disabled:opacity-60 ${danger ? "bg-red-500 hover:bg-red-600" : "bg-amber-500 hover:bg-amber-600"}`}
        >
          {busy ? busyLabel : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
