// Shortcut hint: one pill per key, no "+" separator, e.g. [⌘][K] / [Ctrl][,].
// "mod" renders ⌘ on macOS, Ctrl elsewhere.
const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform || navigator.userAgent);

function label(k) {
  if (k === "mod") return isMac ? "⌘" : "Ctrl";
  return k;
}

// Transparent fill + a hairline keycap border outlines each key.
export default function Kbd({ keys = [], className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {keys.map((k, i) => (
        <kbd
          key={i}
          className="inline-flex items-center justify-center min-w-[1.3rem] px-1.5 py-0.5 rounded-[5px] text-[11px] font-medium leading-none whitespace-nowrap border bg-transparent border-gray-300/80 dark:border-white/20 text-gray-500 dark:text-neutral-300"
        >
          {label(k)}
        </kbd>
      ))}
    </span>
  );
}
