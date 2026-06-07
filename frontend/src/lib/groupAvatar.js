
export const COLOR_PALETTE = [
  "#6366f1", "#10b981", "#f59e0b", "#f43f5e", "#0ea5e9",
  "#8b5cf6", "#14b8a6", "#f97316", "#ec4899", "#84cc16",
];

export function autoColor(id = "") {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return COLOR_PALETTE[h % COLOR_PALETTE.length];
}

export function groupColor(group) {
  return (group && group.color) || autoColor(group && group.id);
}

export function groupLabel(group) {
  if (group && group.emoji) return group.emoji;
  return ((group && group.name) || "?").slice(0, 1).toUpperCase();
}

export function isEmojiLabel(group) {
  return !!(group && group.emoji);
}
