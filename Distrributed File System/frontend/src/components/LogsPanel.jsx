import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:5000");

export default function LogsPanel() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    socket.on("log", (message) => {
      setLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] ${message}`,
        ...prev,
      ]);
    });

    return () => {
      socket.off("log");
    };
  }, []);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 h-full">
      <h2 className="text-2xl font-semibold mb-5">
        System Logs
      </h2>

      <div className="space-y-3 max-h-[450px] overflow-y-auto">
        {logs.length === 0 ? (
          <div className="text-slate-500 text-sm">
            Waiting for system events...
          </div>
        ) : (
          logs.map((log, index) => (
            <div
              key={index}
              className="
                bg-slate-800
                rounded-xl
                p-3
                text-sm
                border border-slate-700
              "
            >
              {log}
            </div>
          ))
        )}
      </div>
    </div>
  );
}