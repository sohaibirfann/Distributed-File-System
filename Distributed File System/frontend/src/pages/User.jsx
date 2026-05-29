import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth }  from "../context/AuthContext";
import { Moon, Sun, Database, LogOut } from "lucide-react";
import { useApiStatus } from "../hooks/useApiStatus";
import FileTable from "../components/FileTable";

const API = import.meta.env.VITE_API_URL;

export default function User() {
  const { isDark, toggleTheme } = useTheme();
  const { logout, authFetch, user } = useAuth();
  const navigate    = useNavigate();
  const apiStatus   = useApiStatus();
  const [stats, setStats] = useState({ files: 0, usersOnline: 0 });

  useEffect(() => {
    authFetch(`${API}/api/health`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 glass bg-white/40 dark:bg-neutral-950/45 border-b border-blue-100/60 dark:border-white/[0.06]">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-6" style={{ height: 56 }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-blue-600 dark:bg-[#FF6363] rounded-lg flex items-center justify-center">
              <Database size={14} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 dark:text-white text-sm">DFS</span>
            <span className="hidden sm:block text-[11px] font-semibold bg-blue-100 dark:bg-[#FF6363]/15 text-blue-700 dark:text-[#FF6363] px-2 py-0.5 rounded-full border border-blue-300 dark:border-[#FF6363]/35">
              Guest
            </span>
            <div
              title={apiStatus === "online" ? "Server connected" : apiStatus === "offline" ? "Server offline" : "Connecting…"}
              className={`hidden sm:block w-1.5 h-1.5 rounded-full transition-colors duration-500 ${
                apiStatus === "online"  ? "bg-emerald-500 animate-pulse" :
                apiStatus === "offline" ? "bg-red-500"                  :
                                         "bg-neutral-400"
              }`}
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-3 text-xs text-gray-500 dark:text-neutral-400 mr-2">
              <span>
                <span className="font-semibold text-gray-800 dark:text-neutral-200">{stats.files}</span> files
              </span>
              <span>
                <span className="font-semibold text-gray-800 dark:text-neutral-200">{stats.usersOnline}</span> nodes
              </span>
            </div>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:text-neutral-500 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button
              onClick={() => { logout(); navigate("/"); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-gray-500 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-[#FF6363]/10 border border-gray-200 dark:border-neutral-700 hover:border-red-200 dark:hover:border-red-500/40 transition-colors"
            >
              <LogOut size={13} />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Files</h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-0.5">
            Browse, preview and download shared files
          </p>
        </div>

        <FileTable isAdmin={false} />
      </main>
    </div>
  );
}
