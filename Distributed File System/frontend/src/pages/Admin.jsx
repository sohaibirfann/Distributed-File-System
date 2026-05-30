import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useNotify } from "../context/NotificationContext";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, Server, Terminal,
  Moon, Sun, LogOut, Database,
  HardDrive, Trash2, AlertTriangle, File, Users,
} from "lucide-react";
import NodesGrid from "../components/NodesGrid";
import LogsPanel from "../components/LogsPanel";
import { useApiStatus } from "../hooks/useApiStatus";

const API = import.meta.env.VITE_API_URL;

function fmtBytes(b) {
  if (!b) return "0 B";
  if (b < 1024)          return `${b} B`;
  if (b < 1024 * 1024)   return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

function fmtRelative(iso) {
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

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "nodes",    label: "Nodes",    icon: Server          },
  { id: "logs",     label: "Logs",     icon: Terminal        },
];

// ── Overview ──────────────────────────────────────────────────
function OverviewTab({ refresh, nodes }) {
  const notify = useNotify();
  const { authFetch } = useAuth();
  const [stats, setStats] = useState({
    files: 0, chunks: 0, usersOnline: 0,
    distributedBytes: 0, cacheUsed: 0, cacheMax: 209715200,
    cachedFiles: [], lastUploaded: null,
  });
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => { fetchStats(); }, [refresh]);

  useEffect(() => {
    const id = setInterval(fetchStats, 5000);
    return () => clearInterval(id);
  }, []);

  async function fetchStats() {
    try {
      const h = await authFetch(`${API}/api/health`).then((r) => r.json());
      setStats(h);
    } catch {}
  }

  async function handleClearCache() {
    setClearing(true);
    try {
      const res  = await authFetch(`${API}/api/files/cache`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        notify.success(`Cleared ${data.cleared} cached file${data.cleared !== 1 ? "s" : ""}`);
        fetchStats();
      } else {
        notify.error("Failed to clear cache");
      }
    } catch {
      notify.error("Failed to clear cache");
    }
    setClearing(false);
    setShowClearConfirm(false);
  }

  const cachePercent = stats.cacheMax > 0
    ? Math.min(100, (stats.cacheUsed / stats.cacheMax) * 100)
    : 0;
  const barColor = cachePercent > 80 ? "bg-red-500"
    : cachePercent > 50 ? "bg-amber-500"
    : "bg-emerald-500";

  const onlineCount = nodes.filter((n) => n.status === "online").length;

  const cards = [
    { label: "Nodes online",  value: onlineCount,   num: "text-emerald-600 dark:text-emerald-400" },
    { label: "Files stored",  value: stats.files,   num: "text-blue-600 dark:text-[#FF6363]"      },
    { label: "Total chunks",  value: stats.chunks,  num: "text-amber-600 dark:text-amber-400"     },
  ];

  return (
    <>
      <div className="space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-4">
          {cards.map((c) => (
            <div key={c.label} className="glass bg-white/75 dark:bg-neutral-900/70 rounded-2xl border border-gray-100 dark:border-neutral-800 p-5">
              <p className="text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wide mb-2">{c.label}</p>
              <p className={`text-4xl font-bold font-mono ${c.num}`}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Last uploaded + Storage */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Last uploaded */}
          <div className="glass bg-white/75 dark:bg-neutral-900/70 rounded-2xl border border-gray-100 dark:border-neutral-800 p-5 flex flex-col">
            <p className="text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wide mb-4">Last uploaded</p>
            <div className="flex-1 flex items-center">
              {stats.lastUploaded ? (
                <div className="flex items-center gap-3 w-full">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-[#FF6363]/10 flex items-center justify-center shrink-0">
                    <File size={18} className="text-blue-500 dark:text-[#FF6363]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-neutral-100 truncate" title={stats.lastUploaded.filename}>
                      {stats.lastUploaded.filename}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
                      {fmtBytes(stats.lastUploaded.size)} · {fmtRelative(stats.lastUploaded.uploadedAt)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 opacity-50">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                    <File size={18} className="text-gray-400 dark:text-neutral-500" />
                  </div>
                  <p className="text-sm text-gray-400 dark:text-neutral-500">No files uploaded yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Storage card */}
          <div className="glass bg-white/75 dark:bg-neutral-900/70 rounded-2xl border border-gray-100 dark:border-neutral-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wide">Storage</p>
              {(stats.cachedFiles?.length ?? 0) > 0 && (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-gray-500 dark:text-neutral-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-[#FF6363]/10 transition-colors"
                >
                  <Trash2 size={11} />
                  Clear cache
                </button>
              )}
            </div>

            {/* Distributed */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Server size={13} className="text-gray-400 dark:text-neutral-500 shrink-0" />
                <span className="text-xs text-gray-600 dark:text-neutral-300">Distributed</span>
              </div>
              <span className="text-xs font-mono font-semibold text-gray-700 dark:text-neutral-200">
                {fmtBytes(stats.distributedBytes)}
                <span className="font-normal text-gray-400 dark:text-neutral-500 ml-1">across {onlineCount} node{onlineCount !== 1 ? "s" : ""}</span>
              </span>
            </div>

            {/* Cache bar */}
            <div className="border-t border-gray-100 dark:border-neutral-800 pt-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <HardDrive size={13} className="text-gray-400 dark:text-neutral-500 shrink-0" />
                  <span className="text-xs text-gray-600 dark:text-neutral-300">Cache</span>
                </div>
                <span className="text-xs font-mono text-gray-500 dark:text-neutral-400">
                  <span className="font-semibold text-gray-700 dark:text-neutral-200">{fmtBytes(stats.cacheUsed)}</span>
                  {" / "}{fmtBytes(stats.cacheMax)}
                </span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                  style={{ width: `${cachePercent}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-400 dark:text-neutral-500 mt-1.5">
                {stats.cachedFiles?.length ?? 0} file{(stats.cachedFiles?.length ?? 0) !== 1 ? "s" : ""} cached · {cachePercent.toFixed(1)}% used
              </p>
            </div>
          </div>
        </div>

        {/* Node status table */}
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
                  {["Node", "Status", "Chunks", "Latency"].map((h) => (
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
                      <td className={`px-5 py-3 text-xs font-semibold font-mono ${
                        node.latency === null ? "text-red-400" :
                        node.latency < 100    ? "text-emerald-600 dark:text-emerald-400" :
                        node.latency < 500    ? "text-amber-500 dark:text-amber-400" :
                                                "text-red-500"
                      }`}>
                        {node.latency === null ? "Offline" : `${node.latency} ms`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Clear cache confirmation modal */}
      {showClearConfirm && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => !clearing && setShowClearConfirm(false)}
        >
          <div
            className="glass bg-white/75 dark:bg-neutral-900/70 rounded-2xl border border-gray-100 dark:border-neutral-800 w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-11 h-11 bg-amber-50 dark:bg-amber-500/10 rounded-xl flex items-center justify-center mb-4">
              <AlertTriangle size={20} className="text-amber-500" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Clear the cache?</h3>
            <p className="text-sm text-gray-500 dark:text-neutral-400 mb-5">
              {stats.cachedFiles?.length} cached file{stats.cachedFiles?.length !== 1 ? "s" : ""} will be removed from local storage. Files are safe on the distributed nodes and will be re-cached on next download.
            </p>
            <div className="flex gap-2.5">
              <button
                onClick={() => setShowClearConfirm(false)}
                disabled={clearing}
                className="flex-1 py-2.5 text-sm font-medium border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleClearCache}
                disabled={clearing}
                className="flex-1 py-2.5 text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-colors disabled:opacity-50"
              >
                {clearing ? "Clearing…" : "Clear cache"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Admin page ────────────────────────────────────────────────
export default function Admin() {
  const { isDark, toggleTheme } = useTheme();
  const { logout, authFetch }   = useAuth();
  const navigate    = useNavigate();
  const apiStatus   = useApiStatus();
  const [active, setActive]   = useState("overview");
  const [refresh, setRefresh] = useState(false);
  const [nodes, setNodes]       = useState([]);
  const [nodesError, setNodesError] = useState(false);
  const tabRefs         = useRef({});
  const tabContentRefs  = useRef({});
  const [ind, setInd]   = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const el = tabRefs.current[active];
    if (el) setInd({ left: el.offsetLeft, width: el.offsetWidth });
  }, [active]);

  useEffect(() => {
    async function fetchNodes() {
      try {
        const res = await authFetch(`${API}/api/nodes`);
        setNodes(await res.json());
        setNodesError(false);
      } catch {
        setNodesError(true);
      }
    }
    fetchNodes();
    const id = setInterval(fetchNodes, 5000);
    return () => clearInterval(id);
  }, []);

  function handleTabSwitch(id) {
    setActive(id);
    const el = tabContentRefs.current[id];
    if (el) {
      el.classList.remove("tab-content");
      void el.offsetWidth; // force reflow to restart CSS animation
      el.classList.add("tab-content");
    }
  }

  function handleExit() {
    logout();
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
                onClick={() => navigate("/groups")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-gray-600 dark:text-neutral-300 hover:bg-blue-50 dark:hover:bg-[#FF6363]/10 hover:text-blue-700 dark:hover:text-[#FF6363] transition-colors"
              >
                <Users size={13} />
                Groups
              </button>
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
                onClick={() => handleTabSwitch(id)}
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
        <div ref={(el) => { tabContentRefs.current["overview"] = el; }} className="tab-content" style={{ display: active === "overview" ? "" : "none" }}>
          <OverviewTab refresh={refresh} nodes={nodes} />
        </div>
        <div ref={(el) => { tabContentRefs.current["nodes"] = el; }} className="tab-content" style={{ display: active === "nodes" ? "" : "none" }}>
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Storage nodes</h2>
              <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">Connected peers and chunk distribution</p>
            </div>
            <NodesGrid nodes={nodes} apiError={nodesError} />
          </div>
        </div>
        <div ref={(el) => { tabContentRefs.current["logs"] = el; }} className="tab-content" style={{ display: active === "logs" ? "" : "none" }}>
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Activity log</h2>
              <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">Live event stream from the network</p>
            </div>
            <LogsPanel fullHeight />
          </div>
        </div>
      </main>
    </div>
  );
}
