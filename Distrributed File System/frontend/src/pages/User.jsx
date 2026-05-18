import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { Moon, Sun, Database, ShieldCheck } from "lucide-react";
import FileTable from "../components/FileTable";

const API = import.meta.env.VITE_API_URL;

export default function User() {
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ files: 0, usersOnline: 0 });

  useEffect(() => {
    fetch(`${API}/api/health`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 glass bg-white/40 dark:bg-neutral-950/45 border-b border-blue-100/60 dark:border-white/[0.06]">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-6" style={{ height: 56 }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-blue-600 dark:bg-[#FF6363] rounded-lg flex items-center justify-center">
              <Database size={14} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 dark:text-white text-sm">DFS</span>
            <span className="hidden sm:block text-xs text-gray-400 dark:text-neutral-500 border-l border-gray-200 dark:border-neutral-800 pl-2.5 ml-0.5">
              Guest
            </span>
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
              onClick={() => navigate("/")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-gray-600 dark:text-neutral-300 hover:bg-blue-50 dark:hover:bg-[#FF6363]/10 hover:text-blue-700 dark:hover:text-[#FF6363] border border-gray-200 dark:border-neutral-700 hover:border-blue-200 dark:hover:border-[#FF6363]/40 transition-colors"
            >
              <ShieldCheck size={13} />
              Admin
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-8">
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
