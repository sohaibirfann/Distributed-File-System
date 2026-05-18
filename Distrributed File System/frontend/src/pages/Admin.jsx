import { useState, useEffect } from "react";
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
    { label: "Files stored",  value: stats.files,        num: "text-violet-600  dark:text-violet-400"  },
    { label: "Total chunks",  value: stats.chunks,       num: "text-amber-600   dark:text-amber-400"   },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-stone-50 dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 p-5">
            <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-2">{c.label}</p>
            <p className={`text-4xl font-bold font-mono ${c.num}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Node table */}
      <div className="bg-stone-50 dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Node status</p>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">All connected storage nodes</p>
        </div>
        {nodes.length === 0 ? (
          <p className="px-5 py-10 text-sm text-center text-gray-400 dark:text-zinc-500">No nodes connected yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-stone-50 dark:bg-zinc-800/50">
              <tr className="border-b border-gray-100 dark:border-zinc-800">
                {["Node", "Status", "Chunks", "Health"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-zinc-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
              {nodes.map((node, i) => {
                const on = node.status === "online";
                return (
                  <tr key={i} className="hover:bg-stone-50 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="px-5 py-3 font-mono font-medium text-gray-900 dark:text-white">{node.name}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${on ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${on ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
                        {on ? "Online" : "Offline"}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-gray-600 dark:text-zinc-300">{node.chunks}</td>
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
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">Upload, preview, download, or delete files</p>
        </div>
        <button
          onClick={() => setShowUpload((v) => !v)}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
            showUpload
              ? "bg-stone-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300"
              : "bg-violet-600 hover:bg-violet-500 text-white hover:-translate-y-0.5 active:translate-y-0"
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
  const navigate  = useNavigate();
  const [active, setActive]   = useState("overview");
  const [refresh, setRefresh] = useState(false);

  if (!localStorage.getItem("isAdmin")) return <Navigate to="/" replace />;

  function handleExit() {
    localStorage.removeItem("isAdmin");
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-stone-100 dark:bg-zinc-950 flex flex-col">
      {/* Sticky header + tabs */}
      <header className="sticky top-0 z-40 bg-stone-50 dark:bg-zinc-900 border-b border-stone-200 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto px-6">
          {/* Top row */}
          <div className="flex items-center justify-between" style={{ height: 56 }}>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-violet-600 rounded-lg flex items-center justify-center">
                <Database size={14} className="text-white" />
              </div>
              <span className="font-bold text-gray-900 dark:text-white text-sm">DFS</span>
              <span className="text-[11px] font-semibold bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-full">
                Admin
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
              >
                {isDark ? <Sun size={15} /> : <Moon size={15} />}
              </button>
              <button
                onClick={handleExit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-gray-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              >
                <LogOut size={13} />
                Sign out
              </button>
            </div>
          </div>

          {/* Tab row */}
          <div className="flex -mb-px">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActive(id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  active === id
                    ? "border-violet-600 text-violet-600 dark:border-violet-400 dark:text-violet-400"
                    : "border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 hover:border-gray-200 dark:hover:border-zinc-700"
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8">
        {active === "overview" && <OverviewTab refresh={refresh} />}
        {active === "files"    && <FilesTab    refresh={refresh} onRefresh={() => setRefresh((p) => !p)} />}
        {active === "nodes"    && (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Storage nodes</h2>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">Connected peers and chunk distribution</p>
            </div>
            <NodesGrid refresh={refresh} />
          </div>
        )}
        {active === "logs" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Activity log</h2>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">Live event stream from the network</p>
            </div>
            <LogsPanel fullHeight />
          </div>
        )}
      </main>
    </div>
  );
}
