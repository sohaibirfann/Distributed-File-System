const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform || navigator.userAgent);

function label(k) {
  if (k === "mod") return isMac ? "⌘" : "Ctrl";
  return k;
}

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
