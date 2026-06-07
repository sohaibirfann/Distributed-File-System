import { useDialog } from "../lib/useDialog";

export default function Modal({
  onClose,
  label,
  panelClassName = "w-full max-w-sm p-6",
  dismissable = true,
  children,
}) {
  const close = () => { if (dismissable) onClose?.(); };
  const ref = useDialog(true, close);

  return (
    <div
      className="dialog-backdrop fixed inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center z-50 p-4"
      onClick={close}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        className={`dialog-panel glass bg-white/80 dark:bg-neutral-900/80 rounded-2xl border border-gray-100 dark:border-neutral-800 ${panelClassName}`}
      >
        {children}
      </div>
    </div>
  );
}
