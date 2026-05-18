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
    <div className="min-h-screen bg-stone-100 dark:bg-zinc-950 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-stone-50 dark:bg-zinc-900 border-b border-stone-200 dark:border-zinc-800">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-6" style={{ height: 56 }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-violet-600 rounded-lg flex items-center justify-center">
              <Database size={14} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 dark:text-white text-sm">DFS</span>
            <span className="hidden sm:block text-xs text-gray-400 dark:text-zinc-500 border-l border-gray-200 dark:border-zinc-700 pl-2.5 ml-0.5">
              Guest
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-3 text-xs text-gray-500 dark:text-zinc-400 mr-2">
              <span>
                <span className="font-semibold text-gray-800 dark:text-zinc-200">{stats.files}</span> files
              </span>
              <span>
                <span className="font-semibold text-gray-800 dark:text-zinc-200">{stats.usersOnline}</span> nodes
              </span>
            </div>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-gray-600 dark:text-zinc-300 hover:bg-violet-50 dark:hover:bg-violet-950/30 hover:text-violet-700 dark:hover:text-violet-300 border border-gray-200 dark:border-zinc-700 hover:border-violet-200 dark:hover:border-violet-800 transition-colors"
            >
              <ShieldCheck size={13} />
              Admin
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Files</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">
            Browse, preview and download shared files
          </p>
        </div>

        <FileTable isAdmin={false} />
      </main>
    </div>
  );
}
