// Shortcut hint shown as a single rounded pill, e.g. "⌘ + K" / "Ctrl + ,".
// "mod" renders ⌘ on macOS, Ctrl elsewhere.
const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform || navigator.userAgent);

function label(k) {
  if (k === "mod") return isMac ? "⌘" : "Ctrl";
  return k;
}

export default function Kbd({ keys = [], className = "" }) {
  return (
    <kbd
      className={`inline-flex items-center px-2 py-1 rounded-md text-[11px] font-medium leading-none whitespace-nowrap
                  bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400
                  border border-gray-200 dark:border-neutral-700 ${className}`}
    >
      {keys.map(label).join(" + ")}
    </kbd>
  );
}
