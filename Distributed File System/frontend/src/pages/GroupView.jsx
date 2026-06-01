import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth }   from "../context/AuthContext";
import { useNotify } from "../context/NotificationContext";
import FileTable   from "../components/FileTable";
import UploadPanel from "../components/UploadPanel";
import InviteModal from "../components/InviteModal";
import Skeleton    from "../components/Skeleton";
import Kbd         from "../components/Kbd";
import { Users, Crown, UserPlus, Upload, Shield, Search, X, List, LayoutGrid } from "lucide-react";

const API = import.meta.env.VITE_API_URL;

const PRESETS = {
  minimal:  "Minimal",
  balanced: "Balanced",
  max:      "Maximum",
};

function fmtSize(b) {
  if (!b) return "0 B";
  if (b < 1024)        return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export default function GroupView() {
  const { id }        = useParams();
  const { authFetch } = useAuth();
  const notify        = useNotify();
  const navigate      = useNavigate();

  const [group, setGroup]       = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [refresh, setRefresh]   = useState(0);
  const [search, setSearch]     = useState("");
  const [stats, setStats]       = useState({ count: 0, totalSize: 0 });
  const [view, setView]         = useState(() => localStorage.getItem("dfs_fileview") || "list");

  function chooseView(v) { localStorage.setItem("dfs_fileview", v); setView(v); }
  const [dragOver, setDragOver] = useState(false);
  const [dropped, setDropped]   = useState(null);
  const [dropNonce, setDropNonce] = useState(0);
  const dragCount = useRef(0);
  const searchRef = useRef(null);

  useEffect(() => { fetchGroup(); }, [id]);

  // "/" focuses search (unless already typing); Esc clears + blurs.
  useEffect(() => {
    function onKey(e) {
      const el = document.activeElement;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (e.key === "/" && !typing) { e.preventDefault(); searchRef.current?.focus(); }
      else if (e.key === "Escape" && el === searchRef.current) { setSearch(""); searchRef.current?.blur(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function fetchGroup() {
    try {
      const res = await authFetch(`${API}/api/groups/${id}`);
      if (res.status === 403 || res.status === 404) { setNotFound(true); return; }
      setGroup(await res.json());
    } catch { notify.error("Couldn't load group"); }
  }

  function onDragEnter(e) {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault(); dragCount.current++; setDragOver(true);
  }
  function onDragOver(e) { if (e.dataTransfer.types.includes("Files")) e.preventDefault(); }
  function onDragLeave() { dragCount.current--; if (dragCount.current <= 0) { dragCount.current = 0; setDragOver(false); } }
  function onDrop(e) {
    e.preventDefault();
    dragCount.current = 0;
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (!files.length) return;
    setDropped(files); setDropNonce((n) => n + 1); setShowUpload(true);
  }

  if (notFound) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <Shield size={28} className="text-gray-300 dark:text-neutral-600" />
        <p className="text-sm text-gray-500 dark:text-neutral-400">You're not a member of this group.</p>
        <button onClick={() => navigate("/groups")} className="text-sm text-blue-600 dark:text-[#4cc2ff] hover:underline">← Back to groups</button>
      </div>
    );
  }

  const memberCount = group?.members?.length;

  return (
    <div
      className="h-full flex flex-col"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="relative shrink-0 flex items-center justify-between gap-3 px-6 h-14 border-b border-gray-200/70 dark:border-white/[0.06] bg-transparent">
        <div className="flex items-center gap-2.5 min-w-0">
          {group
            ? <h1 className="text-base font-bold text-gray-900 dark:text-white truncate">{group.name}</h1>
            : <Skeleton className="h-5 w-32" />}

          <button
            onClick={() => setMembersOpen((o) => !o)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors shrink-0"
          >
            <Users size={13} />
            {memberCount ?? "…"} {memberCount === 1 ? "member" : "members"}
          </button>

          <span className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium text-gray-500 dark:text-neutral-400 bg-gray-100/70 dark:bg-neutral-800/60 shrink-0" title="Replication (set at creation)">
            <Shield size={12} /> {PRESETS[group?.replication] ?? "…"}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center rounded-lg border border-gray-200 dark:border-neutral-700 overflow-hidden mr-1">
            <button
              onClick={() => chooseView("list")}
              title="List view"
              className={`p-1.5 transition-colors ${view === "list" ? "bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-200" : "text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:hover:text-neutral-300"}`}
            >
              <List size={14} />
            </button>
            <button
              onClick={() => chooseView("grid")}
              title="Grid view"
              className={`p-1.5 transition-colors ${view === "grid" ? "bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-200" : "text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:hover:text-neutral-300"}`}
            >
              <LayoutGrid size={14} />
            </button>
          </div>
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 border border-gray-200 dark:border-neutral-700 transition-colors"
          >
            <UserPlus size={13} /> Invite
          </button>
          <button
            onClick={() => { setDropped(null); setShowUpload((v) => !v); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              showUpload
                ? "bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300"
                : "bg-blue-600 hover:bg-blue-500 dark:bg-[#0067C0] dark:hover:bg-[#005ba1] text-white"
            }`}
          >
            <Upload size={13} /> {showUpload ? "Cancel" : "Upload"}
          </button>
        </div>

        {/* Members popover */}
        {membersOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setMembersOpen(false)} />
            <div className="absolute top-[3.25rem] left-6 z-40 w-60 glass bg-white/90 dark:bg-neutral-900/90 rounded-xl border border-gray-100 dark:border-neutral-800 p-2 shadow-lg">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-neutral-500">Members</p>
              {group?.members?.map((m) => (
                <div key={m.user_id} className="flex items-center justify-between px-2 py-1.5 text-sm">
                  <span className="text-gray-800 dark:text-neutral-200 truncate">{m.username}</span>
                  <span className={`flex items-center gap-1 text-xs font-medium shrink-0 ${m.role === "owner" ? "text-amber-600 dark:text-amber-400" : "text-gray-400 dark:text-neutral-500"}`}>
                    {m.role === "owner" ? <Crown size={11} /> : <UserPlus size={11} />}{m.role}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Search bar ──────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-3 px-6 py-2.5 border-b border-gray-200/70 dark:border-white/[0.06] bg-transparent">
        <Search size={15} className="text-gray-400 dark:text-neutral-500 shrink-0" />
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search files…"
          className="flex-1 text-sm bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500"
        />
        {search ? (
          <button onClick={() => setSearch("")} className="text-gray-400 hover:text-gray-600 dark:text-neutral-500 dark:hover:text-neutral-300 transition-colors">
            <X size={14} />
          </button>
        ) : (
          <Kbd keys={["/"]} />
        )}
        <span className="text-xs text-gray-400 dark:text-neutral-500 shrink-0 border-l border-gray-100 dark:border-neutral-800 pl-3 whitespace-nowrap">
          {stats.count} {stats.count === 1 ? "file" : "files"}{stats.totalSize > 0 ? ` · ${fmtSize(stats.totalSize)}` : ""}
        </span>
      </div>

      {/* ── File area ───────────────────────────────────────────── */}
      <div className="relative flex-1 min-h-0 overflow-y-auto">
        {dragOver && (
          <div className="absolute inset-0 z-40 pointer-events-none flex flex-col items-center justify-center gap-3 bg-blue-500/10 dark:bg-[#0067C0]/10 backdrop-blur-sm border-2 border-dashed border-blue-400/70 dark:border-[#0067C0]/70 m-2 rounded-xl">
            <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-[#0067C0]/15 flex items-center justify-center">
              <Upload size={26} className="text-blue-500 dark:text-[#4cc2ff]" />
            </div>
            <p className="text-base font-semibold text-blue-600 dark:text-[#4cc2ff]">Drop to upload to {group?.name}</p>
          </div>
        )}

        {showUpload && (
          <div className="px-6 py-4 border-b border-gray-100 dark:border-white/[0.06]">
            <UploadPanel
              key={dropNonce}
              groupId={id}
              initialFiles={dropped ?? []}
              onUploadSuccess={() => { setRefresh((n) => n + 1); setShowUpload(false); setDropped(null); }}
            />
          </div>
        )}

        <FileTable key={refresh} groupId={id} canManage search={search} onStats={setStats} view={view} />
      </div>

      {showInvite && (
        <InviteModal groupId={id} groupName={group?.name} onClose={() => setShowInvite(false)} />
      )}
    </div>
  );
}
