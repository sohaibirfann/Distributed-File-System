import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth }   from "../context/AuthContext";
import { useNotify } from "../context/NotificationContext";
import FileTable   from "../components/FileTable";
import UploadPanel from "../components/UploadPanel";
import InviteModal from "../components/InviteModal";
import { Users, Crown, UserPlus, Upload, Shield } from "lucide-react";

const API = import.meta.env.VITE_API_URL;

const PRESETS = [
  { key: "minimal",  label: "Minimal",  hint: "2 copies"      },
  { key: "balanced", label: "Balanced", hint: "3 copies"      },
  { key: "max",      label: "Maximum",  hint: "all nodes"     },
];

export default function GroupView() {
  const { id }        = useParams();
  const { authFetch } = useAuth();
  const notify        = useNotify();
  const navigate      = useNavigate();

  const [group, setGroup]       = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [refresh, setRefresh]   = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [dropped, setDropped]   = useState(null);
  const [dropNonce, setDropNonce] = useState(0);
  const dragCount = useRef(0);

  function onDragEnter(e) {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    dragCount.current++;
    setDragOver(true);
  }
  function onDragOver(e) {
    if (e.dataTransfer.types.includes("Files")) e.preventDefault();
  }
  function onDragLeave() {
    dragCount.current--;
    if (dragCount.current <= 0) { dragCount.current = 0; setDragOver(false); }
  }
  function onDrop(e) {
    e.preventDefault();
    dragCount.current = 0;
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (!files.length) return;
    setDropped(files);
    setDropNonce((n) => n + 1);
    setShowUpload(true);
  }

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

  if (notFound) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <Shield size={28} className="text-gray-300 dark:text-neutral-600" />
        <p className="text-sm text-gray-500 dark:text-neutral-400">You're not a member of this group.</p>
        <button onClick={() => navigate("/groups")} className="text-sm text-blue-600 dark:text-[#FF6363] hover:underline">← Back to groups</button>
      </div>
    );
  }

  return (
    <div
      className="relative max-w-5xl w-full mx-auto px-6 py-8 space-y-6"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {dragOver && (
        <div className="absolute inset-3 z-40 pointer-events-none flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-blue-400/70 dark:border-[#FF6363]/70 bg-blue-500/10 dark:bg-[#FF6363]/10 backdrop-blur-sm">
          <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-[#FF6363]/15 flex items-center justify-center">
            <Upload size={26} className="text-blue-500 dark:text-[#FF6363]" />
          </div>
          <p className="text-base font-semibold text-blue-600 dark:text-[#FF6363]">Drop to upload to {group?.name}</p>
        </div>
      )}

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate">{group?.name ?? "…"}</h1>

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
          <div className="glass bg-white/75 dark:bg-neutral-900/70 rounded-2xl border border-gray-100 dark:border-neutral-800 p-5 flex flex-col">
            <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wide">
              <UserPlus size={13} /> Invite
            </div>
            <p className="text-xs text-gray-500 dark:text-neutral-400 mb-3 flex-1">Share a code so friends can join this group.</p>
            <button onClick={() => setShowInvite(true)} className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-500 dark:bg-[#FF6363] dark:hover:bg-[#FF5252] text-white text-sm font-medium rounded-xl transition-colors">
              <UserPlus size={14} /> Invite people
            </button>
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
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Files</h2>
            <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">Encrypted and distributed across this group's nodes</p>
          </div>
          <button
            onClick={() => { setDropped(null); setShowUpload((v) => !v); }}
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
            key={dropNonce}
            groupId={id}
            initialFiles={dropped ?? []}
            onUploadSuccess={() => { setRefresh((n) => n + 1); setShowUpload(false); setDropped(null); }}
          />
        )}

        <FileTable key={refresh} groupId={id} canManage={true} />

      {showInvite && (
        <InviteModal groupId={id} groupName={group?.name} onClose={() => setShowInvite(false)} />
      )}
    </div>
  );
}
