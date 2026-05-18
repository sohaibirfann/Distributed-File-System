import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { Terminal, Trash2 } from "lucide-react";

const socket = io(import.meta.env.VITE_API_URL);

export default function LogsPanel({ fullHeight = false }) {
  const [logs, setLogs]         = useState([]);
  const [connected, setConnected] = useState(false);
  const bottomRef               = useRef(null);

  useEffect(() => {
    socket.on("connect",    () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("log", (msg) => {
      setLogs((prev) =>
        [...prev, { time: new Date().toLocaleTimeString(), msg }].slice(-100)
      );
    });
    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("log");
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="bg-stone-50 dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
        <div className="flex items-center gap-2.5">
          <Terminal size={15} className="text-gray-400 dark:text-zinc-500" />
          <span className="text-sm font-semibold text-gray-900 dark:text-white">Activity log</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            connected
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
              : "bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500"
          }`}>
            {connected ? "● Live" : "○ Connecting"}
          </span>
        </div>
        {logs.length > 0 && (
          <button
            onClick={() => setLogs([])}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <Trash2 size={12} />
            Clear
          </button>
        )}
      </div>

      {/* Log output */}
      <div className={`bg-zinc-950 font-mono text-xs overflow-y-auto p-4 ${fullHeight ? "min-h-[480px] max-h-[580px]" : "min-h-[260px] max-h-[340px]"}`}>
        {logs.length === 0 ? (
          <span className="text-zinc-600">Waiting for events…</span>
        ) : (
          logs.map((entry, i) => (
            <div key={i} className="flex gap-3 mb-1 leading-relaxed group">
              <span className="text-zinc-600 shrink-0 select-none">{entry.time}</span>
              <span className="text-emerald-400 break-all group-hover:text-emerald-300 transition-colors">{entry.msg}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
