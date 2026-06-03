import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth }  from "../context/AuthContext";
import { Database, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { isDesktop } from "../lib/platform";

const API = import.meta.env.VITE_API_URL;

export default function Login() {
  const { login, user }         = useAuth();
  const navigate                = useNavigate();

  const [mode, setMode]         = useState("login"); // "login" | "register"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const isRegister = mode === "register";

  useEffect(() => {
    if (user) navigate("/groups", { replace: true });
  }, [user]);

  function switchMode(next) {
    setMode(next);
    setError("");
    setConfirm("");
  }

  // Logs in with the given credentials and routes into the app.
  async function authenticate(uname, pword) {
    const res  = await fetch(`${API}/api/auth/login`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ username: uname, password: pword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");
    login(data.token);
    navigate("/groups", { replace: true });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (isRegister) {
      if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
      if (password !== confirm) { setError("Passwords don't match."); return; }
    }

    setLoading(true);
    try {
      if (isRegister) {
        const res  = await fetch(`${API}/api/auth/register`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Sign up failed"); setLoading(false); return; }
        // Auto-login straight after a successful sign up.
        await authenticate(username, password);
      } else {
        await authenticate(username, password);
      }
    } catch (err) {
      setError(err.message === "Failed to fetch"
        ? "Could not reach server. Make sure the backend is running."
        : err.message || "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-full flex flex-col">
      {!isDesktop() && (
        <button
          onClick={() => navigate("/")}
          className="absolute top-4 left-4 z-10 flex items-center gap-1.5 p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:text-neutral-500 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors text-xs font-medium"
        >
          <ArrowLeft size={14} />
          Back
        </button>
      )}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="w-16 h-16 bg-blue-600 dark:bg-[var(--accent)] rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-blue-500/20 dark:shadow-[var(--accent)]/20">
          <Database size={28} className="text-[var(--on-accent)]" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          Distributed File System
        </h1>
        <p className="text-sm text-gray-500 dark:text-neutral-400 mb-8">
          {isRegister ? "Create an account to get started" : "Sign in to access your files"}
        </p>

        <div className="glass w-full max-w-[340px] bg-white/60 dark:bg-white/[0.05] rounded-2xl border border-gray-100 dark:border-neutral-800 p-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
            {isRegister ? "Sign up" : "Sign in"}
          </h2>
          <p className="text-xs text-gray-500 dark:text-neutral-400 mb-4">
            {isRegister ? "Pick a username and password" : "Enter your username and password"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(""); }}
              placeholder="Username"
              autoFocus
              autoComplete="username"
              className="w-full px-4 py-3 bg-white/50 dark:bg-neutral-800/60 border border-gray-200 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:border-blue-500 dark:focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-[var(--accent)]/20 transition-all"
            />

            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                placeholder="Password"
                autoComplete={isRegister ? "new-password" : "current-password"}
                className="w-full px-4 py-3 pr-10 bg-white/50 dark:bg-neutral-800/60 border border-gray-200 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:border-blue-500 dark:focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-[var(--accent)]/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPass((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-neutral-200 transition-colors"
              >
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {isRegister && (
              <input
                type={showPass ? "text" : "password"}
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setError(""); }}
                placeholder="Confirm password"
                autoComplete="new-password"
                className="w-full px-4 py-3 bg-white/50 dark:bg-neutral-800/60 border border-gray-200 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:border-blue-500 dark:focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-[var(--accent)]/20 transition-all"
              />
            )}

            {error && <p className="text-xs text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={loading || !username || !password || (isRegister && !confirm)}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 dark:bg-[var(--accent)] dark:hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--on-accent)] rounded-xl font-medium text-sm transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 disabled:hover:translate-y-0"
            >
              {loading
                ? (isRegister ? "Creating account…" : "Signing in…")
                : (isRegister ? "Create account"    : "Sign In")}
            </button>
          </form>

          <p className="text-xs text-center text-gray-500 dark:text-neutral-400 mt-4">
            {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              type="button"
              onClick={() => switchMode(isRegister ? "login" : "register")}
              className="font-semibold text-blue-600 dark:text-[var(--accent-bright)] hover:underline underline-offset-2"
            >
              {isRegister ? "Sign in" : "Sign up"}
            </button>
          </p>
        </div>

        <p className="mt-6 text-xs text-gray-400 dark:text-neutral-600">
          AES-256 encrypted · Fault tolerant · Multi-node
        </p>
      </div>
    </div>
  );
}
