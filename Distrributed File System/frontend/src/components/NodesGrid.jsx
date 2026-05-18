import { useEffect, useState } from "react";
import { HardDrive, Wifi, WifiOff } from "lucide-react";

const API = import.meta.env.VITE_API_URL;

export default function NodesGrid({ refresh }) {
  const [nodes, setNodes] = useState([]);

  useEffect(() => {
    fetchNodes();
    const id = setInterval(fetchNodes, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  async function fetchNodes() {
    try {
      const res = await fetch(`${API}/api/nodes`);
      setNodes(await res.json());
    } catch {}
  }

  const online  = nodes.filter((n) => n.status === "online").length;
  const offline = nodes.length - online;

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          {online} online
        </div>
        {offline > 0 && (
          <div className="flex items-center gap-1.5 text-sm font-medium text-red-500">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            {offline} offline
          </div>
        )}
      </div>

      {nodes.length === 0 ? (
        <div className="bg-stone-50 dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 flex flex-col items-center py-16">
          <div className="w-12 h-12 bg-stone-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mb-3">
            <HardDrive size={22} className="text-gray-400 dark:text-zinc-500" />
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-zinc-400">No nodes connected</p>
          <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">Nodes will appear here once they register</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {nodes.map((node, i) => {
            const on = node.status === "online";
            return (
              <div
                key={i}
                className={`bg-stone-50 dark:bg-zinc-900 rounded-2xl border p-5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-sm ${
                  on
                    ? "border-stone-200 dark:border-zinc-800"
                    : "border-stone-200 dark:border-zinc-800 opacity-70"
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${on ? "bg-emerald-50 dark:bg-emerald-950/40" : "bg-stone-100 dark:bg-zinc-800"}`}>
                      <HardDrive size={16} className={on ? "text-emerald-500" : "text-gray-400 dark:text-zinc-500"} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white font-mono">{node.name}</p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 ${on ? "text-emerald-600 dark:text-emerald-400" : "text-red-400"}`}>
                    {on ? <Wifi size={14} /> : <WifiOff size={14} />}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 mb-0.5">Chunks stored</p>
                    <p className="text-2xl font-bold font-mono text-gray-800 dark:text-zinc-100">{node.chunks}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 dark:text-zinc-400 mb-0.5">Health</p>
                    <span className={`text-sm font-semibold ${on ? "text-emerald-600 dark:text-emerald-400" : "text-red-400"}`}>
                      {on ? "Healthy" : "Degraded"}
                    </span>
                  </div>
                </div>

                {/* Chunk bar */}
                {node.chunks > 0 && (
                  <div className="mt-4 flex items-end gap-0.5 h-8">
                    {Array.from({ length: Math.min(node.chunks, 16) }).map((_, j) => (
                      <div
                        key={j}
                        className={`flex-1 rounded-sm ${on ? "bg-violet-200 dark:bg-violet-800/60" : "bg-gray-200 dark:bg-zinc-700"}`}
                        style={{ height: `${35 + (j % 5) * 15}%` }}
                      />
                    ))}
                    {node.chunks > 16 && (
                      <div className="flex-1 flex items-end justify-center">
                        <span className="text-[10px] text-gray-400 dark:text-zinc-500">+{node.chunks - 16}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
