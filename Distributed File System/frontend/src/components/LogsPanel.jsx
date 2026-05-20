import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { Terminal, Trash2, Download } from "lucide-react";

export default function LogsPanel({ fullHeight = false }) {
  const [logs, setLogs]           = useState([]);
  const [connected, setConnected] = useState(false);
  const bottomRef                 = useRef(null);

  useEffect(() => {
    const socket = io(import.meta.env.VITE_API_URL);

    socket.on("connect",    () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("log", (msg) => {
      setLogs((prev) =>
        [...prev, { time: new Date().toLocaleTimeString(), msg }].slice(-100)
      );
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  function exportLogs() {
    const text = logs.map((e) => `[${e.time}] ${e.msg}`).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `dfs-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="glass bg-white/75 dark:bg-neutral-900/70 rounded-2xl border border-gray-100 dark:border-neutral-800 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-neutral-800">
        <div className="flex items-center gap-2.5">
          <Terminal size={15} className="text-gray-400 dark:text-neutral-500" />
          <span className="text-sm font-semibold text-gray-900 dark:text-white">Activity log</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            connected
              ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-gray-100 dark:bg-neutral-800 text-gray-400 dark:text-neutral-500"
          }`}>
            {connected ? "● Live" : "○ Connecting"}
          </span>
        </div>
        {logs.length > 0 && (
          <div className="flex items-center gap-1">
            <button
              onClick={exportLogs}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-600 dark:text-neutral-500 dark:hover:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <Download size={12} />
              Export
            </button>
            <button
              onClick={() => setLogs([])}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-600 dark:text-neutral-500 dark:hover:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <Trash2 size={12} />
              Clear
            </button>
          </div>
        )}
      </div>

      <div className={`bg-black font-mono text-xs overflow-y-auto p-4 ${fullHeight ? "min-h-[480px] max-h-[580px]" : "min-h-[260px] max-h-[340px]"}`}>
        {logs.length === 0 ? (
          <span className="text-neutral-600">Waiting for events…</span>
        ) : (
          logs.map((entry, i) => (
            <div key={i} className="flex gap-3 mb-1 leading-relaxed group">
              <span className="text-neutral-600 shrink-0 select-none">{entry.time}</span>
              <span className="text-emerald-400 break-all group-hover:text-emerald-300 transition-colors">{entry.msg}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
