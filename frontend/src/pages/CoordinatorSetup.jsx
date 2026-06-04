import { useState } from "react";
import { Database, ArrowRight, Loader2 } from "lucide-react";
import { setCoordinatorUrl, getStoredCoordinator, pingCoordinator } from "../lib/api";

// First-run gate (desktop): the app can't do anything until it knows which
// coordinator to talk to. Shown only when none is configured.
export default function CoordinatorSetup() {
  const [value, setValue]     = useState(getStoredCoordinator());
  const [error, setError]     = useState("");
  const [busy, setBusy]       = useState(false);
  const [canForce, setForce]  = useState(false); // allow saving despite a failed probe

  async function connect(e, force = false) {
    e?.preventDefault?.();
    setError("");
    setBusy(true);
    try {
      if (!force && !(await pingCoordinator(value))) {
        setError("Couldn't reach a DFS server at that address. Double-check it.");
        setForce(true);
        setBusy(false);
        return;
      }
      await setCoordinatorUrl(value);
      // Reload so every module re-reads the new coordinator URL.
      window.location.reload();
    } catch (err) {
      setError(err.message || "Couldn't save that address.");
      setBusy(false);
    }
  }

  return (
    <div className="h-full flex items-center justify-center px-6">
      <form onSubmit={connect} className="w-full max-w-md flex flex-col items-center text-center">
        <div className="w-16 h-16 bg-blue-600 dark:bg-[var(--accent)] rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-blue-500/20 dark:shadow-[var(--accent)]/20">
          <Database size={28} className="text-[var(--on-accent)]" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Connect to a server</h1>
        <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1.5 max-w-sm">
          DFS needs the address of a server — the lightweight relay that helps your
          group find each other. It never sees your files or keys.
        </p>

        <input
          autoFocus
          value={value}
          onChange={(e) => { setValue(e.target.value); setForce(false); }}
          placeholder="https://server.example.com"
          spellCheck={false}
          autoCapitalize="off"
          className="w-full mt-6 px-4 py-3 bg-white/50 dark:bg-neutral-800/60 border border-gray-200 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:border-blue-500 dark:focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-[var(--accent)]/20 transition-all"
        />
        {error && <p className="text-xs text-red-500 dark:text-red-400 mt-2 self-start">{error}</p>}

        <button
          type="submit"
          disabled={busy || !value.trim()}
          className="w-full mt-4 py-3 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 dark:bg-[var(--accent)] dark:hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--on-accent)] rounded-xl font-medium text-sm transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 disabled:hover:translate-y-0"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <>Connect <ArrowRight size={15} /></>}
        </button>

        {canForce && (
          <button
            type="button"
            onClick={(e) => connect(e, true)}
            disabled={busy}
            className="mt-2 text-xs text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200 hover:underline disabled:opacity-40"
          >
            Connect anyway
          </button>
        )}

        <p className="text-[11px] text-gray-400 dark:text-neutral-500 mt-4">
          You can change this later in Settings.
        </p>
      </form>
    </div>
  );
}
