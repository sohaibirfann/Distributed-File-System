import {
  FileText, Image, Film, Music, Archive, Code, File,
} from "lucide-react";

const TYPE_MAP = {
  jpg:  { icon: Image,    bg: "bg-sky-50 dark:bg-sky-950/40",       color: "text-sky-500"                          },
  jpeg: { icon: Image,    bg: "bg-sky-50 dark:bg-sky-950/40",       color: "text-sky-500"                          },
  png:  { icon: Image,    bg: "bg-sky-50 dark:bg-sky-950/40",       color: "text-sky-500"                          },
  gif:  { icon: Image,    bg: "bg-pink-50 dark:bg-pink-950/40",     color: "text-pink-500"                         },
  svg:  { icon: Image,    bg: "bg-orange-50 dark:bg-orange-950/40", color: "text-orange-500"                       },
  webp: { icon: Image,    bg: "bg-sky-50 dark:bg-sky-950/40",       color: "text-sky-500"                          },
  mp4:  { icon: Film,     bg: "bg-purple-50 dark:bg-purple-950/40", color: "text-purple-500"                       },
  mov:  { icon: Film,     bg: "bg-purple-50 dark:bg-purple-950/40", color: "text-purple-500"                       },
  avi:  { icon: Film,     bg: "bg-purple-50 dark:bg-purple-950/40", color: "text-purple-500"                       },
  mkv:  { icon: Film,     bg: "bg-purple-50 dark:bg-purple-950/40", color: "text-purple-500"                       },
  webm: { icon: Film,     bg: "bg-purple-50 dark:bg-purple-950/40", color: "text-purple-500"                       },
  m4v:  { icon: Film,     bg: "bg-purple-50 dark:bg-purple-950/40", color: "text-purple-500"                       },
  ogv:  { icon: Film,     bg: "bg-purple-50 dark:bg-purple-950/40", color: "text-purple-500"                       },
  mp3:  { icon: Music,    bg: "bg-emerald-50 dark:bg-emerald-950/40", color: "text-emerald-500"                    },
  wav:  { icon: Music,    bg: "bg-emerald-50 dark:bg-emerald-950/40", color: "text-emerald-500"                    },
  flac: { icon: Music,    bg: "bg-emerald-50 dark:bg-emerald-950/40", color: "text-emerald-500"                    },
  pdf:  { icon: FileText, bg: "bg-red-50 dark:bg-red-950/40",       color: "text-red-500"                         },
  doc:  { icon: FileText, bg: "bg-blue-50 dark:bg-blue-950/40",     color: "text-blue-500"                        },
  docx: { icon: FileText, bg: "bg-blue-50 dark:bg-blue-950/40",     color: "text-blue-500"                        },
  txt:  { icon: FileText, bg: "bg-gray-100 dark:bg-neutral-800",    color: "text-gray-500 dark:text-neutral-400"  },
  zip:  { icon: Archive,  bg: "bg-amber-50 dark:bg-amber-950/40",   color: "text-amber-500"                       },
  rar:  { icon: Archive,  bg: "bg-amber-50 dark:bg-amber-950/40",   color: "text-amber-500"                       },
  "7z": { icon: Archive,  bg: "bg-amber-50 dark:bg-amber-950/40",   color: "text-amber-500"                       },
  tar:  { icon: Archive,  bg: "bg-amber-50 dark:bg-amber-950/40",   color: "text-amber-500"                       },
  js:   { icon: Code,     bg: "bg-yellow-50 dark:bg-yellow-950/40", color: "text-yellow-500"                      },
  ts:   { icon: Code,     bg: "bg-blue-50 dark:bg-blue-950/40",     color: "text-blue-500"                        },
  py:   { icon: Code,     bg: "bg-blue-50 dark:bg-blue-950/40",     color: "text-blue-500"                        },
  json: { icon: Code,     bg: "bg-yellow-50 dark:bg-yellow-950/40", color: "text-yellow-500"                      },
  html: { icon: Code,     bg: "bg-orange-50 dark:bg-orange-950/40", color: "text-orange-500"                      },
  css:  { icon: Code,     bg: "bg-sky-50 dark:bg-sky-950/40",       color: "text-sky-500"                         },
};
export const DEFAULT_TYPE = { icon: File, bg: "bg-blue-50 dark:bg-[var(--accent)]/10", color: "text-blue-500 dark:text-[var(--accent-bright)]" };

function extOf(filename) {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

export function getType(filename) {
  return TYPE_MAP[extOf(filename)] ?? DEFAULT_TYPE;
}

const TEXT_EXTENSIONS = new Set([
  "txt","md","csv","log","json","xml","yaml","yml","toml","ini","env","conf",
  "html","css","svg","js","ts","jsx","tsx","py","java","c","cpp","h","cs",
  "go","rs","rb","php","swift","kt","sh","bash","zsh","ps1","bat","sql",
]);
const IMAGE_EXTENSIONS = new Set(["jpg","jpeg","png","gif","webp","svg"]);
const VIDEO_EXTENSIONS = new Set(["mp4","webm","ogv","m4v","mov"]);

export const PREVIEW_MIME = {
  mp4: "video/mp4", m4v: "video/mp4", webm: "video/webm",
  ogv: "video/ogg", mov: "video/quicktime", pdf: "application/pdf",
};

export function getPreviewType(filename) {
  const ext = extOf(filename);
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  if (ext === "pdf")             return "pdf";
  if (TEXT_EXTENSIONS.has(ext))  return "text";
  return null;
}
