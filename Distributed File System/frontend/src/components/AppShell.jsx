import { useState, useEffect, useCallback } from "react";
import { Outlet, useNavigate, useParams, useLocation } from "react-router-dom";
import { useTheme }  from "../context/ThemeContext";
import { useAuth }   from "../context/AuthContext";
import { useNotify } from "../context/NotificationContext";
import { createKeyForGroup, storeKeyB64, parseInvite } from "../lib/groupKeys";
import Kbd from "./Kbd";
import Skeleton from "./Skeleton";
import {
  Database, Users, Plus, LogIn, Moon, Sun, LogOut, X, Settings,
  PanelLeftClose, PanelLeftOpen,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL;

// Deterministic per-group color so each group keeps a stable visual identity.
const PALETTE = ["#6366f1", "#10b981", "#f59e0b", "#f43f5e", "#0ea5e9", "#8b5cf6", "#14b8a6", "#f97316", "#ec4899", "#84cc16"];
function colorFor(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

const REP_PRESETS = [
  { key: "minimal",  label: "Minimal",  hint: "2 copies"  },
  { key: "balanced", label: "Balanced", hint: "3 copies"  },
  { key: "max",      label: "Maximum",  hint: "all nodes" },
];

export default function AppShell() {
  const { isDark, toggleTheme }     = useTheme();
  const { logout, authFetch, user } = useAuth();
  const notify                      = useNotify();
  const navigate                    = useNavigate();
  const { id: activeId }            = useParams();
  const location                    = useLocation();
  const onSettings                  = location.pathname === "/settings";

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("dfs_sidebar_collapsed") === "1",
  );
  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [modal, setModal]   = useState(null); // null | "new" | "join"

  const fetchGroups = useCallback(async () => {
    try {
      const res = await authFetch(`${API}/api/groups`);
      setGroups(await res.json());
    } catch { /* ignore — sidebar just stays as-is */ }
    finally { setLoadingGroups(false); }
  }, [authFetch]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  function toggleCollapsed() {
    setCollapsed((c) => {
      localStorage.setItem("dfs_sidebar_collapsed", c ? "0" : "1");
      return !c;
    });
  }

  // Ctrl/Cmd+B toggles the sidebar; Ctrl/Cmd+, opens Settings.
  useEffect(() => {
    function onKey(e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() === "b") { e.preventDefault(); toggleCollapsed(); }
      else if (e.key === ",")          { e.preventDefault(); navigate("/settings"); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside
        className={`flex flex-col shrink-0 glass bg-white/55 dark:bg-neutral-950/55 border-r border-blue-100/60 dark:border-white/[0.06] transition-[width] duration-200 ease-out ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        {/* Brand + collapse toggle */}
        <div className={`flex items-center h-14 shrink-0 ${collapsed ? "justify-center" : "justify-between px-3"}`}>
          {!collapsed && (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-blue-600 dark:bg-[#FF6363] rounded-lg flex items-center justify-center">
                <Database size={14} className="text-white" />
              </div>
              <span className="font-bold text-gray-900 dark:text-white text-sm">DFS</span>
            </div>
          )}
          <button
            onClick={toggleCollapsed}
            title={collapsed ? "Expand" : "Collapse"}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-700 dark:text-neutral-500 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        {/* Groups */}
        <div className="flex-1 overflow-y-auto px-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-700">
          {!collapsed && (
            <p className="px-2 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-neutral-600">
              Groups
            </p>
          )}

          <div className="space-y-0.5">
            {loadingGroups && groups.length === 0 &&
              Array.from({ length: 4 }).map((_, i) => (
                <div key={`gsk-${i}`} className={`flex items-center gap-2.5 ${collapsed ? "justify-center p-2" : "px-2.5 py-2"}`}>
                  <Skeleton className="w-7 h-7 rounded-lg shrink-0" />
                  {!collapsed && <Skeleton className="h-3.5 flex-1" style={{ maxWidth: `${70 - i * 10}%` }} />}
                </div>
              ))}
            {groups.map((g) => {
              const active = g.id === activeId;
              return (
                <button
                  key={g.id}
                  onClick={() => navigate(`/groups/${g.id}`)}
                  title={collapsed ? g.name : undefined}
                  className={`relative w-full flex items-center gap-2.5 rounded-xl transition-colors ${collapsed ? "justify-center p-2" : "px-2.5 py-2"} ${
                    active
                      ? "bg-blue-100/70 dark:bg-[#FF6363]/15 text-blue-700 dark:text-[#FF6363]"
                      : "text-gray-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800/70"
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-blue-600 dark:bg-[#FF6363]" />
                  )}
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold text-white"
                    style={{ backgroundColor: colorFor(g.id) }}
                  >
                    {g.name.slice(0, 1).toUpperCase()}
                  </div>
                  {!collapsed && <span className="text-sm font-medium truncate">{g.name}</span>}
                </button>
              );
            })}
          </div>

          {/* New / Join */}
          <div className={`mt-2 ${collapsed ? "space-y-0.5" : "space-y-0.5"}`}>
            <button
              onClick={() => setModal("new")}
              title={collapsed ? "New group" : undefined}
              className={`w-full flex items-center gap-2.5 rounded-xl text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800/70 transition-colors ${collapsed ? "justify-center p-2" : "px-2.5 py-2"}`}
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-dashed border-gray-300 dark:border-neutral-700">
                <Plus size={14} />
              </div>
              {!collapsed && <span className="text-sm font-medium">New group</span>}
            </button>
            <button
              onClick={() => setModal("join")}
              title={collapsed ? "Join group" : undefined}
              className={`w-full flex items-center gap-2.5 rounded-xl text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800/70 transition-colors ${collapsed ? "justify-center p-2" : "px-2.5 py-2"}`}
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0">
                <LogIn size={14} />
              </div>
              {!collapsed && <span className="text-sm font-medium">Join with code</span>}
            </button>
          </div>
        </div>

        {/* Footer: user, theme, sign out */}
        <div className="shrink-0 border-t border-gray-100 dark:border-white/[0.06] p-2 space-y-0.5">
          {!collapsed && user && (
            <div className="px-2.5 py-1.5 text-xs text-gray-400 dark:text-neutral-500 truncate">
              Signed in as <span className="font-semibold text-gray-600 dark:text-neutral-300">{user.username}</span>
            </div>
          )}
          <button
            onClick={() => navigate("/settings")}
            title={collapsed ? "Settings" : undefined}
            className={`w-full flex items-center gap-2.5 rounded-xl transition-colors ${collapsed ? "justify-center p-2" : "px-2.5 py-2"} ${
              onSettings
                ? "bg-blue-100/70 dark:bg-[#FF6363]/15 text-blue-700 dark:text-[#FF6363]"
                : "text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800/70"
            }`}
          >
            <div className="w-7 h-7 flex items-center justify-center shrink-0"><Settings size={15} /></div>
            {!collapsed && <span className="text-sm font-medium flex-1 text-left">Settings</span>}
            {!collapsed && <Kbd keys={["mod", ","]} />}
          </button>
          <button
            onClick={toggleTheme}
            title={collapsed ? "Theme" : undefined}
            className={`w-full flex items-center gap-2.5 rounded-xl text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800/70 transition-colors ${collapsed ? "justify-center p-2" : "px-2.5 py-2"}`}
          >
            <div className="w-7 h-7 flex items-center justify-center shrink-0">{isDark ? <Sun size={15} /> : <Moon size={15} />}</div>
            {!collapsed && <span className="text-sm font-medium">{isDark ? "Light mode" : "Dark mode"}</span>}
          </button>
          <button
            onClick={() => { logout(); navigate("/"); }}
            title={collapsed ? "Sign out" : undefined}
            className={`w-full flex items-center gap-2.5 rounded-xl text-gray-500 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-[#FF6363]/10 transition-colors ${collapsed ? "justify-center p-2" : "px-2.5 py-2"}`}
          >
            <div className="w-7 h-7 flex items-center justify-center shrink-0"><LogOut size={15} /></div>
            {!collapsed && <span className="text-sm font-medium">Sign out</span>}
          </button>
        </div>
      </aside>

      {/* ── Main panel ──────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <Outlet context={{ refreshGroups: fetchGroups }} />
      </main>

      {modal && (
        <NewJoinModal
          mode={modal}
          onClose={() => setModal(null)}
          onDone={(groupId) => { setModal(null); fetchGroups(); if (groupId) navigate(`/groups/${groupId}`); }}
        />
      )}
    </div>
  );
}

// ── New / Join modal ────────────────────────────────────────────────────────
function NewJoinModal({ mode, onClose, onDone }) {
  const { authFetch } = useAuth();
  const notify        = useNotify();
  const [value, setValue]   = useState("");
  const [rep, setRep]       = useState("balanced");
  const [busy, setBusy]     = useState(false);
  const isNew = mode === "new";

  async function submit(e) {
    e.preventDefault();
    if (!value.trim()) return;
    setBusy(true);
    try {
      if (isNew) {
        const res = await authFetch(`${API}/api/groups`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: value.trim(), replication: rep }),
        });
        if (!res.ok) throw new Error();
        const group = await res.json();
        await createKeyForGroup(group.id);
        notify.success(`Group "${group.name}" created`);
        onDone(group.id);
      } else {
        const { joinCode, keyB64 } = parseInvite(value);
        if (!keyB64) { notify.error("Invalid invite — the key is missing from the code"); setBusy(false); return; }
        const res  = await authFetch(`${API}/api/groups/join`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: joinCode }),
        });
        const data = await res.json();
        if (!res.ok) { notify.error(data.error || "Couldn't join"); setBusy(false); return; }
        storeKeyB64(data.id, keyB64);
        notify.success(`Joined "${data.name}"`);
        onDone(data.id);
      }
    } catch {
      notify.error(isNew ? "Couldn't create group" : "Couldn't join group");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="glass bg-white/80 dark:bg-neutral-900/80 rounded-2xl border border-gray-100 dark:border-neutral-800 w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">{isNew ? "Create a group" : "Join with a code"}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800"><X size={15} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
            placeholder={isNew ? "Group name" : "Invite code"}
            className={`w-full px-3.5 py-2.5 bg-white/50 dark:bg-neutral-800/60 border border-gray-200 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:border-blue-500 dark:focus:border-[#FF6363] ${isNew ? "" : "font-mono"}`}
          />

          {isNew && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-neutral-400 mb-1.5">Replication</p>
              <div className="flex gap-1.5">
                {REP_PRESETS.map((pr) => {
                  const active = rep === pr.key;
                  return (
                    <button
                      type="button"
                      key={pr.key}
                      onClick={() => setRep(pr.key)}
                      className={`flex-1 px-2 py-2 rounded-xl text-xs font-medium transition-colors ${
                        active
                          ? "bg-blue-600 dark:bg-[#FF6363] text-white"
                          : "bg-white/60 dark:bg-neutral-800/60 text-gray-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-700"
                      }`}
                    >
                      {pr.label}
                      <span className={`block text-[10px] font-normal ${active ? "text-white/80" : "text-gray-400 dark:text-neutral-500"}`}>{pr.hint}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-400 dark:text-neutral-500 mt-1.5">How many copies of each file to keep across members. This can't be changed later.</p>
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !value.trim()}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 dark:bg-[#FF6363] dark:hover:bg-[#FF5252] disabled:opacity-40 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {busy ? "…" : isNew ? "Create group" : "Join group"}
          </button>
        </form>
      </div>
    </div>
  );
}
