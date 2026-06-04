// Shared display formatters for the file UI.

// Human-readable byte size (B / KB / MB / GB).
export function formatBytes(bytes) {
  const b = bytes || 0;
  if (b < 1024)       return `${b} B`;
  if (b < 1024 ** 2)  return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3)  return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

// Relative "x ago" timestamp, falling back to an absolute date past a week.
export function formatRelativeTime(iso) {
  if (!iso) return "—";
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (diff  < 60000) return "just now";
  if (mins  < 60)    return `${mins}m ago`;
  if (hours < 24)    return `${hours}h ago`;
  if (days  < 7)     return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
