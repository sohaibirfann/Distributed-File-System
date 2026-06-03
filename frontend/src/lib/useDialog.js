import { useEffect, useRef } from "react";

// Accessibility helper for modal dialogs. While `open`, it:
//   • closes on Escape,
//   • moves focus into the dialog (first focusable),
//   • traps Tab focus within it,
//   • restores focus to the previously-focused element on close.
// Attach the returned ref to the dialog panel and pair it with
// role="dialog" aria-modal="true" aria-label="…".
export function useDialog(open, onClose) {
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const panel = ref.current;
    const prevFocused = document.activeElement;

    const focusables = () =>
      panel
        ? Array.from(
            panel.querySelectorAll(
              'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
            ),
          )
        : [];

    // Focus the first control (or the panel itself) once it's painted.
    const id = requestAnimationFrame(() => (focusables()[0] || panel)?.focus?.());

    function onKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current?.();
      } else if (e.key === "Tab") {
        const f = focusables();
        if (f.length === 0) { e.preventDefault(); panel?.focus?.(); return; }
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }

    document.addEventListener("keydown", onKey, true);
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener("keydown", onKey, true);
      if (prevFocused instanceof HTMLElement) prevFocused.focus?.();
    };
  }, [open]);

  return ref;
}
