import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme }  from "../context/ThemeContext";
import { useAuth }   from "../context/AuthContext";
import { useNotify } from "../context/NotificationContext";
import {
  Database, Moon, Sun, LogOut, Users, Plus, LogIn,
} from "lucide-react";
import { createKeyForGroup, storeKeyB64, parseInvite } from "../lib/groupKeys";

const API = import.meta.env.VITE_API_URL;

export default function Groups() {
  const { isDark, toggleTheme }     = useTheme();
  const { logout, authFetch } = useAuth();
  const notify                      = useNotify();
  const navigate                    = useNavigate();

  const [groups, setGroups]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName]   = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining]   = useState(false);

  useEffect(() => { fetchGroups(); }, []);

  async function fetchGroups() {
    try {
      const res = await authFetch(`${API}/api/groups`);
      setGroups(await res.json());
    } catch {
      notify.error("Couldn't load your groups");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await authFetch(`${API}/api/groups`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) throw new Error();
      const group = await res.json();
      // Generate this group's encryption key on-device; it never goes to the server.
      await createKeyForGroup(group.id);
      notify.success(`Group "${newName.trim()}" created`);
      setNewName("");
      fetchGroups();
    } catch {
      notify.error("Couldn't create group");
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    const { joinCode: code, keyB64 } = parseInvite(joinCode);
    if (!keyB64) { notify.error("Invalid invite — the key is missing from the code"); return; }

    setJoining(true);
    try {
      const res  = await authFetch(`${API}/api/groups/join`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) { notify.error(data.error || "Couldn't join"); return; }
      // Persist the group key carried in the invite (never sent to the server).
      storeKeyB64(data.id, keyB64);
      notify.success(`Joined "${data.name}"`);
      setJoinCode("");
      fetchGroups();
    } catch {
      notify.error("Couldn't join group");
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 glass bg-white/40 dark:bg-neutral-950/45 border-b border-blue-100/60 dark:border-white/[0.06]">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-6" style={{ height: 56 }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-blue-600 dark:bg-[#FF6363] rounded-lg flex items-center justify-center">
              <Database size={14} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 dark:text-white text-sm">DFS</span>
            <span className="hidden sm:flex items-center gap-1 text-[11px] font-semibold bg-blue-100 dark:bg-[#FF6363]/15 text-blue-700 dark:text-[#FF6363] px-2 py-0.5 rounded-full border border-blue-300 dark:border-[#FF6363]/35">
              <Users size={10} /> Groups
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:text-neutral-500 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button
              onClick={() => { logout(); navigate("/"); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-gray-500 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-[#FF6363]/10 border border-gray-200 dark:border-neutral-700 transition-colors"
            >
              <LogOut size={13} /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Your groups</h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-0.5">
            Private circles that share encrypted files across members' machines
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <form onSubmit={handleCreate} className="glass bg-white/75 dark:bg-neutral-900/70 rounded-2xl border border-gray-100 dark:border-neutral-800 p-5">
            <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-900 dark:text-white">
              <Plus size={15} className="text-blue-600 dark:text-[#FF6363]" /> Create a group
            </div>
            <div className="flex gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Group name"
                className="flex-1 px-3 py-2 bg-white/50 dark:bg-neutral-800/60 border border-gray-200 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:border-blue-500 dark:focus:border-[#FF6363]"
              />
              <button type="submit" disabled={creating || !newName.trim()} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 dark:bg-[#FF6363] dark:hover:bg-[#FF5252] disabled:opacity-40 text-white text-sm font-medium rounded-xl transition-colors">
                {creating ? "…" : "Create"}
              </button>
            </div>
          </form>

          <form onSubmit={handleJoin} className="glass bg-white/75 dark:bg-neutral-900/70 rounded-2xl border border-gray-100 dark:border-neutral-800 p-5">
            <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-900 dark:text-white">
              <LogIn size={15} className="text-blue-600 dark:text-[#FF6363]" /> Join with a code
            </div>
            <div className="flex gap-2">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Invite code"
                className="flex-1 px-3 py-2 bg-white/50 dark:bg-neutral-800/60 border border-gray-200 dark:border-neutral-700 rounded-xl text-sm font-mono text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:border-blue-500 dark:focus:border-[#FF6363]"
              />
              <button type="submit" disabled={joining || !joinCode.trim()} className="px-4 py-2 bg-white/70 dark:bg-neutral-800/60 hover:bg-white dark:hover:bg-neutral-700/70 border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-200 disabled:opacity-40 text-sm font-medium rounded-xl transition-colors">
                {joining ? "…" : "Join"}
              </button>
            </div>
          </form>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 dark:text-neutral-500 text-center py-12">Loading…</p>
        ) : groups.length === 0 ? (
          <div className="glass bg-white/75 dark:bg-neutral-900/70 rounded-2xl border border-gray-100 dark:border-neutral-800 flex flex-col items-center py-16">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-neutral-800 flex items-center justify-center mb-3">
              <Users size={22} className="text-gray-400 dark:text-neutral-500" />
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-neutral-400">No groups yet</p>
            <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">Create one above, or join with an invite code</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => navigate(`/groups/${g.id}`)}
                className="glass bg-white/75 dark:bg-neutral-900/70 rounded-2xl border border-gray-100 dark:border-neutral-800 p-5 text-left hover:-translate-y-0.5 transition-transform duration-150"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-[#FF6363]/10 flex items-center justify-center mb-3">
                  <Users size={16} className="text-blue-600 dark:text-[#FF6363]" />
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate" title={g.name}>{g.name}</p>
                <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1 font-mono truncate">{g.id.slice(0, 8)}…</p>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
