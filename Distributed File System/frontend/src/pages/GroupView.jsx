import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTheme }  from "../context/ThemeContext";
import { useAuth }   from "../context/AuthContext";
import { useNotify } from "../context/NotificationContext";
import FileTable   from "../components/FileTable";
import UploadPanel from "../components/UploadPanel";
import {
  Database, Moon, Sun, ArrowLeft, Users, Crown, UserPlus,
  Copy, Check, Upload, Shield,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL;

const PRESETS = [
  { key: "minimal",  label: "Minimal",  hint: "2 copies"      },
  { key: "balanced", label: "Balanced", hint: "3 copies"      },
  { key: "max",      label: "Maximum",  hint: "all nodes"     },
];

export default function GroupView() {
  const { id }                  = useParams();
  const { isDark, toggleTheme } = useTheme();
  const { authFetch }           = useAuth();
  const notify                  = useNotify();
  const navigate                = useNavigate();

  const [group, setGroup]       = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [copied, setCopied]     = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [refresh, setRefresh]   = useState(0);

  useEffect(() => { fetchGroup(); }, [id]);

  async function fetchGroup() {
    try {
      const res = await authFetch(`${API}/api/groups/${id}`);
      if (res.status === 403 || res.status === 404) { setNotFound(true); return; }
      setGroup(await res.json());
    } catch {
      notify.error("Couldn't load group");
    }
  }

  async function mintInvite() {
    try {
      const res  = await authFetch(`${API}/api/groups/${id}/invites`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setInviteCode(data.code);
      setCopied(false);
    } catch { notify.error("Couldn't create invite"); }
  }

  async function setReplication(preset) {
    try {
      const res = await authFetch(`${API}/api/groups/${id}/replication`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replication: preset }),
      });
      if (!res.ok) throw new Error();
      setGroup((g) => ({ ...g, replication: preset }));
      notify.success(`Replication set to ${preset}`);
    } catch { notify.error("Couldn't update replication"); }
  }

  function copyInvite() {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <Shield size={28} className="text-gray-300 dark:text-neutral-600" />
        <p className="text-sm text-gray-500 dark:text-neutral-400">You're not a member of this group.</p>
        <button onClick={() => navigate("/groups")} className="text-sm text-blue-600 dark:text-[#FF6363] hover:underline">← Back to groups</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 glass bg-white/40 dark:bg-neutral-950/45 border-b border-blue-100/60 dark:border-white/[0.06]">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-6" style={{ height: 56 }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 bg-blue-600 dark:bg-[#FF6363] rounded-lg flex items-center justify-center shrink-0">
              <Database size={14} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 dark:text-white text-sm truncate">{group?.name ?? "…"}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/groups")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-gray-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 border border-gray-200 dark:border-neutral-700 transition-colors">
              <ArrowLeft size={13} /> Groups
            </button>
            <button onClick={toggleTheme} className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:text-neutral-500 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 space-y-6">
        {/* Group meta: members, invite, replication */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Members */}
          <div className="glass bg-white/75 dark:bg-neutral-900/70 rounded-2xl border border-gray-100 dark:border-neutral-800 p-5">
            <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wide">
              <Users size={13} /> Members ({group?.members?.length ?? 0})
            </div>
            <div className="space-y-1.5">
              {group?.members?.map((m) => (
                <div key={m.user_id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-800 dark:text-neutral-200">{m.username}</span>
                  <span className={`flex items-center gap-1 text-xs font-medium ${m.role === "owner" ? "text-amber-600 dark:text-amber-400" : "text-gray-400 dark:text-neutral-500"}`}>
                    {m.role === "owner" ? <Crown size={11} /> : <UserPlus size={11} />}{m.role}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Invite */}
          <div className="glass bg-white/75 dark:bg-neutral-900/70 rounded-2xl border border-gray-100 dark:border-neutral-800 p-5">
            <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wide">
              <UserPlus size={13} /> Invite
            </div>
            {inviteCode ? (
              <div className="flex gap-2">
                <code className="flex-1 px-3 py-2 bg-gray-50 dark:bg-neutral-800 rounded-xl text-sm font-mono text-gray-900 dark:text-white truncate">{inviteCode}</code>
                <button onClick={copyInvite} className="px-3 py-2 bg-blue-600 hover:bg-blue-500 dark:bg-[#FF6363] dark:hover:bg-[#FF5252] text-white rounded-xl transition-colors">
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                </button>
              </div>
            ) : (
              <button onClick={mintInvite} className="w-full py-2 bg-blue-600 hover:bg-blue-500 dark:bg-[#FF6363] dark:hover:bg-[#FF5252] text-white text-sm font-medium rounded-xl transition-colors">
                Generate code
              </button>
            )}
          </div>

          {/* Replication */}
          <div className="glass bg-white/75 dark:bg-neutral-900/70 rounded-2xl border border-gray-100 dark:border-neutral-800 p-5">
            <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wide">
              <Shield size={13} /> Replication
            </div>
            <div className="flex gap-1.5">
              {PRESETS.map((p) => {
                const active = group?.replication === p.key;
                return (
                  <button
                    key={p.key}
                    onClick={() => setReplication(p.key)}
                    title={p.hint}
                    className={`flex-1 px-2 py-2 rounded-xl text-xs font-medium transition-colors ${
                      active
                        ? "bg-blue-600 dark:bg-[#FF6363] text-white"
                        : "bg-white/60 dark:bg-neutral-800/60 text-gray-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-700"
                    }`}
                  >
                    {p.label}
                    <span className={`block text-[10px] font-normal ${active ? "text-white/80" : "text-gray-400 dark:text-neutral-500"}`}>{p.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Files */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Files</h1>
            <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">Encrypted and distributed across this group's nodes</p>
          </div>
          <button
            onClick={() => setShowUpload((v) => !v)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
              showUpload
                ? "bg-white/60 dark:bg-neutral-800/60 text-gray-700 dark:text-neutral-300"
                : "bg-blue-600 hover:bg-blue-500 dark:bg-[#FF6363] dark:hover:bg-[#FF5252] text-white hover:-translate-y-0.5"
            }`}
          >
            <Upload size={14} /> {showUpload ? "Cancel" : "Upload file"}
          </button>
        </div>

        {showUpload && (
          <UploadPanel
            groupId={id}
            onUploadSuccess={() => { setRefresh((n) => n + 1); setShowUpload(false); }}
          />
        )}

        <FileTable key={refresh} groupId={id} canManage={true} />
      </main>
    </div>
  );
}
