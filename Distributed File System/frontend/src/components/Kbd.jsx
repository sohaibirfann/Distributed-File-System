// Small keyboard-key badges (Raycast-style hints). Pass keys as an array, e.g.
// <Kbd keys={["mod", ","]} /> — "mod" renders ⌘ on macOS, Ctrl elsewhere.
const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform || navigator.userAgent);

function label(k) {
  if (k === "mod") return isMac ? "⌘" : "Ctrl";
  return k;
}

export default function Kbd({ keys = [], className = "" }) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {keys.map((k, i) => (
        <kbd
          key={i}
          className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-[5px] text-[10px] font-semibold font-sans
                     bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400
                     border border-gray-200 dark:border-neutral-700 shadow-[0_1px_0_rgba(0,0,0,0.04)]"
        >
          {label(k)}
        </kbd>
      ))}
    </span>
  );
}
