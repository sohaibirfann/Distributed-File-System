import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import {
  LayoutDashboard, Files, Server, Terminal,
  Moon, Sun, LogOut, Database, Upload,
} from "lucide-react";
import FileTable from "../components/FileTable";
import UploadPanel from "../components/UploadPanel";
import NodesGrid from "../components/NodesGrid";
import LogsPanel from "../components/LogsPanel";
import { useApiStatus } from "../hooks/useApiStatus";

const API = import.meta.env.VITE_API_URL;

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "files",    label: "Files",    icon: Files           },
  { id: "nodes",    label: "Nodes",    icon: Server          },
  { id: "logs",     label: "Logs",     icon: Terminal        },
];

// ── Overview ──────────────────────────────────────────────────
function OverviewTab({ refresh }) {
  const [stats, setStats] = useState({ files: 0, chunks: 0, usersOnline: 0 });
  const [nodes, setNodes] = useState([]);

  useEffect(() => { fetchAll(); }, [refresh]);

  async function fetchAll() {
    try {
      const [h, n] = await Promise.all([
        fetch(`${API}/api/health`).then((r) => r.json()),
        fetch(`${API}/api/nodes`).then((r)  => r.json()),
      ]);
      setStats(h); setNodes(n);
    } catch {}
  }

  const cards = [
    { label: "Nodes online",  value: stats.usersOnline, num: "text-emerald-600 dark:text-emerald-400" },
    { label: "Files stored",  value: stats.files,        num: "text-blue-600 dark:text-[#FF6363]"        },
    { label: "Total chunks",  value: stats.chunks,       num: "text-amber-600 dark:text-amber-400"     },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="glass bg-white/75 dark:bg-neutral-900/70 rounded-2xl border border-gray-100 dark:border-neutral-800 p-5">
            <p className="text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wide mb-2">{c.label}</p>
            <p className={`text-4xl font-bold font-mono ${c.num}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="glass bg-white/75 dark:bg-neutral-900/70 rounded-2xl border border-gray-100 dark:border-neutral-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Node status</p>
          <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">All connected storage nodes</p>
        </div>
        {nodes.length === 0 ? (
          <p className="px-5 py-10 text-sm text-center text-gray-400 dark:text-neutral-500">No nodes connected yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-white/40 dark:bg-neutral-800/40">
              <tr className="border-b border-gray-100 dark:border-neutral-800">
                {["Node", "Status", "Chunks", "Health"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-neutral-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-neutral-800">
              {nodes.map((node, i) => {
                const on = node.status === "online";
                return (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-neutral-800/40 transition-colors">
                    <td className="px-5 py-3 font-mono font-medium text-gray-900 dark:text-white">{node.name}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${on ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${on ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
                        {on ? "Online" : "Offline"}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-gray-600 dark:text-neutral-300">{node.chunks}</td>
                    <td className={`px-5 py-3 text-xs font-medium ${on ? "text-emerald-600 dark:text-emerald-400" : "text-red-400"}`}>
                      {on ? "Healthy" : "Degraded"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Files ─────────────────────────────────────────────────────
function FilesTab({ refresh, onRefresh }) {
  const [showUpload, setShowUpload] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">All files</h2>
          <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">Upload, preview, download, or delete files</p>
        </div>
        <button
          onClick={() => setShowUpload((v) => !v)}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
            showUpload
              ? "bg-white/60 dark:bg-neutral-800/60 text-gray-700 dark:text-neutral-300"
              : "bg-blue-600 hover:bg-blue-500 dark:bg-[#FF6363] dark:hover:bg-[#FF5252] text-white hover:-translate-y-0.5 active:translate-y-0"
          }`}
        >
          <Upload size={14} />
          {showUpload ? "Cancel" : "Upload file"}
        </button>
      </div>

      {showUpload && (
        <UploadPanel onUploadSuccess={() => { onRefresh(); setShowUpload(false); }} />
      )}

      <FileTable isAdmin={true} refresh={refresh} />
    </div>
  );
}

// ── Admin page ────────────────────────────────────────────────
export default function Admin() {
  const { isDark, toggleTheme } = useTheme();
  const navigate    = useNavigate();
  const apiStatus   = useApiStatus();
  const [active, setActive]   = useState("overview");
  const [refresh, setRefresh] = useState(false);
  const tabRefs = useRef({});
  const [ind, setInd] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const el = tabRefs.current[active];
    if (el) setInd({ left: el.offsetLeft, width: el.offsetWidth });
  }, [active]);

  if (!localStorage.getItem("isAdmin")) return <Navigate to="/" replace />;

  function handleExit() {
    localStorage.removeItem("isAdmin");
    navigate("/");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 glass bg-white/40 dark:bg-neutral-950/45 border-b border-blue-100/60 dark:border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex items-center justify-between" style={{ height: 56 }}>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-blue-600 dark:bg-[#FF6363] rounded-lg flex items-center justify-center">
                <Database size={14} className="text-white" />
              </div>
              <span className="font-bold text-gray-900 dark:text-white text-sm">DFS</span>
              <span className="text-[11px] font-semibold bg-blue-100 dark:bg-[#FF6363]/15 text-blue-700 dark:text-[#FF6363] px-2 py-0.5 rounded-full border border-blue-300 dark:border-[#FF6363]/35">
                Admin
              </span>
              <div
                title={apiStatus === "online" ? "Server connected" : apiStatus === "offline" ? "Server offline" : "Connecting…"}
                className={`w-1.5 h-1.5 rounded-full transition-colors duration-500 ${
                  apiStatus === "online"  ? "bg-emerald-500 animate-pulse" :
                  apiStatus === "offline" ? "bg-red-500"                  :
                                           "bg-neutral-400"
                }`}
              />
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:text-neutral-500 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
              >
                {isDark ? <Sun size={15} /> : <Moon size={15} />}
              </button>
              <button
                onClick={handleExit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-gray-500 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-[#FF6363]/10 transition-colors"
              >
                <LogOut size={13} />
                Sign out
              </button>
            </div>
          </div>

          <div className="relative flex -mb-px">
            {/* sliding underline */}
            <span
              className="absolute bottom-0 h-0.5 rounded-full bg-blue-600 dark:bg-[#FF6363] transition-all duration-200 ease-out"
              style={{ left: ind.left, width: ind.width }}
            />
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                ref={(el) => { tabRefs.current[id] = el; }}
                onClick={() => setActive(id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors duration-150 ${
                  active === id
                    ? "text-blue-600 dark:text-[#FF6363]"
                    : "text-gray-500 dark:text-neutral-400 hover:text-gray-800 dark:hover:text-neutral-200"
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8">
        <div key={active} className="tab-content">
        {active === "overview" && <OverviewTab refresh={refresh} />}
        {active === "files"    && <FilesTab    refresh={refresh} onRefresh={() => setRefresh((p) => !p)} />}
        {active === "nodes"    && (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Storage nodes</h2>
              <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">Connected peers and chunk distribution</p>
            </div>
            <NodesGrid refresh={refresh} />
          </div>
        )}
        {active === "logs" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Activity log</h2>
              <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">Live event stream from the network</p>
            </div>
            <LogsPanel fullHeight />
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
