import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { Database, FolderOpen, ShieldCheck, ArrowRight, Eye, EyeOff, Sun, Moon, ServerOff } from "lucide-react";

const isAdminMachine = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

const ADMIN_PASSWORD = "admin";

export default function Login() {
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [screen, setScreen] = useState("home"); // "home" | "admin"
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAdminLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    await new Promise((r) => setTimeout(r, 350));
    if (password === ADMIN_PASSWORD) {
      localStorage.setItem("isAdmin", "true");
      navigate("/admin");
    } else {
      setError("Wrong password. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-stone-100 dark:bg-zinc-950 flex flex-col">
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 z-10 p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-200 hover:bg-stone-200 dark:hover:bg-zinc-800 transition-colors"
      >
        {isDark ? <Sun size={17} /> : <Moon size={17} />}
      </button>

      <div className="flex-1 flex flex-col items-center justify-center px-4">
        {/* Logo */}
        <div className="w-16 h-16 bg-violet-600 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-violet-500/25">
          <Database size={28} className="text-white" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          Distributed File System
        </h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mb-8">
          Encrypted storage across your local network
        </p>

        {/* Card */}
        <div className="w-full max-w-[340px] bg-stone-50 dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 p-6">
          {screen === "home" && (
            <div className="space-y-3">
              <button
                onClick={() => navigate("/user")}
                className="w-full flex items-center justify-between px-4 py-3.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium text-sm transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 group"
              >
                <div className="flex items-center gap-2.5">
                  <FolderOpen size={16} />
                  <span>Browse Files</span>
                </div>
                <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform duration-150" />
              </button>

              <button
                onClick={() => setScreen("admin")}
                className="w-full flex items-center justify-between px-4 py-3.5 bg-stone-50 hover:bg-stone-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-stone-200 dark:border-zinc-700 text-stone-700 dark:text-zinc-200 rounded-xl font-medium text-sm transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 group"
              >
                <div className="flex items-center gap-2.5">
                  <ShieldCheck size={16} />
                  <span>Admin</span>
                </div>
                <ArrowRight size={15} className="opacity-40 group-hover:opacity-80 group-hover:translate-x-0.5 transition-all duration-150" />
              </button>
            </div>
          )}

          {screen === "admin" && (
            <div>
              {!isAdminMachine ? (
                <div className="text-center py-2">
                  <div className="w-11 h-11 bg-amber-50 dark:bg-amber-950/40 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <ServerOff size={20} className="text-amber-500" />
                  </div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                    Admin not available here
                  </p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mb-4 leading-relaxed">
                    Admin access is only available on the machine running the backend server.
                  </p>
                  <button
                    onClick={() => setScreen("home")}
                    className="w-full py-2 text-sm text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors"
                  >
                    ← Back
                  </button>
                </div>
              ) : (
                <>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                    Admin sign in
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mb-4">
                    Enter your admin password to continue
                  </p>

                  <form onSubmit={handleAdminLogin} className="space-y-3">
                    <div className="relative">
                      <input
                        type={showPass ? "text" : "password"}
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError(""); }}
                        placeholder="Password"
                        autoFocus
                        className="w-full px-4 py-3 pr-10 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl text-sm text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-zinc-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 transition-colors"
                      >
                        {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>

                    {error && <p className="text-xs text-red-500">{error}</p>}

                    <button
                      type="submit"
                      disabled={loading || !password}
                      className="w-full py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-medium text-sm transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 disabled:hover:translate-y-0"
                    >
                      {loading ? "Signing in…" : "Sign In"}
                    </button>

                    <button
                      type="button"
                      onClick={() => { setScreen("home"); setPassword(""); setError(""); }}
                      className="w-full py-2 text-sm text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors"
                    >
                      ← Back
                    </button>
                  </form>
                </>
              )}
            </div>
          )}
        </div>

        <p className="mt-6 text-xs text-gray-300 dark:text-zinc-600">
          AES-256 encrypted · Fault tolerant · Multi-node
        </p>
      </div>
    </div>
  );
}
