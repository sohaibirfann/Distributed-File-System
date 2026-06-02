import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { useAuth }   from "../context/AuthContext";
import { useNotify } from "../context/NotificationContext";
import { useTitle }  from "../context/TitleContext";
import { hasKey }    from "../lib/groupKeys";
import FileTable   from "../components/FileTable";
import UploadPanel from "../components/UploadPanel";
import InviteModal from "../components/InviteModal";
import Skeleton    from "../components/Skeleton";
import Kbd         from "../components/Kbd";
import { Users, Crown, UserPlus, Upload, Shield, Search, X, List, LayoutGrid, MoreHorizontal, Pencil, Trash2, LogOut, KeyRound, Files, Lock } from "lucide-react";

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
  const { setTitle }  = useTitle();
  const { refreshGroups } = useOutletContext() || {};

  const [group, setGroup]       = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [menuOpen, setMenuOpen]   = useState(false);
  const [renameOpen, setRenameOpen]   = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming]       = useState(false);
  const [confirm, setConfirm]         = useState(null); // null | "delete" | "leave"
  const [confirming, setConfirming]   = useState(false);
  const [transferTo, setTransferTo]   = useState(null); // member to hand ownership to
  const [transferring, setTransferring] = useState(false);
  const [refresh, setRefresh]   = useState(0);
  const [search, setSearch]     = useState("");
  const [stats, setStats]       = useState({ count: 0, totalSize: 0, total: 0, allSize: 0 });
  const [view, setView]         = useState(() => localStorage.getItem("dfs_fileview") || "list");

  function chooseView(v) { localStorage.setItem("dfs_fileview", v); setView(v); }
  const [dragOver, setDragOver] = useState(false);
  const [dropped, setDropped]   = useState(null);
  const [dropNonce, setDropNonce] = useState(0);
  const dragCount = useRef(0);
  const searchRef = useRef(null);

  useEffect(() => { fetchGroup(); }, [id]);

  // Reflect the open group in the custom title bar + OS window title.
  useEffect(() => {
    if (group?.name) { setTitle(group.name); document.title = `${group.name} · DFS`; }
    return () => { setTitle(null); document.title = "DFS"; };
  }, [group?.name]);

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
      localStorage.setItem("dfs_last_group", id); // reopen this group on next launch
    } catch { notify.error("Couldn't load group"); }
  }

  async function doRename(e) {
    e?.preventDefault?.();
    const name = renameValue.trim();
    if (!name || name === group?.name) { setRenameOpen(false); return; }
    setRenaming(true);
    try {
      const res = await authFetch(`${API}/api/groups/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error();
      setGroup((g) => ({ ...g, name }));
      refreshGroups?.();
      notify.success("Group renamed");
      setRenameOpen(false);
    } catch { notify.error("Couldn't rename group"); }
    finally { setRenaming(false); }
  }

  async function doDelete() {
    setConfirming(true);
    try {
      const res = await authFetch(`${API}/api/groups/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      notify.success("Group deleted");
      refreshGroups?.();
      navigate("/groups");
    } catch { notify.error("Couldn't delete group"); setConfirming(false); }
  }

  async function doLeave() {
    setConfirming(true);
    try {
      const res = await authFetch(`${API}/api/groups/${id}/members/me`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      notify.success("Left group");
      refreshGroups?.();
      navigate("/groups");
    } catch { notify.error("Couldn't leave group"); setConfirming(false); }
  }

  async function removeMember(userId, username) {
    try {
      const res = await authFetch(`${API}/api/groups/${id}/members/${userId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      notify.success(`Removed ${username}`);
      fetchGroup();
    } catch { notify.error("Couldn't remove member"); }
  }

  async function doTransfer() {
    setTransferring(true);
    try {
      const res = await authFetch(`${API}/api/groups/${id}/transfer`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: transferTo.user_id }),
      });
      if (!res.ok) throw new Error();
      notify.success(`${transferTo.username} is now the owner`);
      setTransferTo(null);
      fetchGroup(); // roles changed — myRole becomes "member"
    } catch { notify.error("Couldn't transfer ownership"); }
    finally { setTransferring(false); }
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
  const isOwner     = group?.myRole === "owner";
  const keyMissing  = group && !hasKey(id);

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
            onClick={() => { setMenuOpen(false); setMembersOpen((o) => !o); }}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors shrink-0"
          >
            <Users size={13} />
            {memberCount ?? "…"} {memberCount === 1 ? "member" : "members"}
          </button>

          <span className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium text-gray-500 dark:text-neutral-400 bg-gray-100/70 dark:bg-neutral-800/60 shrink-0" title="Replication (set at creation)">
            <Shield size={12} /> {PRESETS[group?.replication] ?? "…"}
          </span>

          {group && (
            <span className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium text-gray-500 dark:text-neutral-400 shrink-0" title="Files in this group">
              <Files size={12} />
              {stats.total} {stats.total === 1 ? "file" : "files"}{stats.allSize > 0 ? ` · ${fmtSize(stats.allSize)}` : ""}
            </span>
          )}

          {group && (
            <span
              className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 shrink-0"
              title="End-to-end encrypted — files are encrypted on your device before upload; the coordinator only ever sees ciphertext."
            >
              <Lock size={12} /> Encrypted
            </span>
          )}

          {group && (
            <button
              onClick={() => { setMembersOpen(false); setMenuOpen((o) => !o); }}
              title="Group options"
              className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-500 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors shrink-0"
            >
              <MoreHorizontal size={15} />
            </button>
          )}
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
                <div key={m.user_id} className="group/mem flex items-center justify-between gap-2 px-2 py-1.5 text-sm">
                  <span className="text-gray-800 dark:text-neutral-200 truncate">{m.username}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`flex items-center gap-1 text-xs font-medium ${m.role === "owner" ? "text-amber-600 dark:text-amber-400" : "text-gray-400 dark:text-neutral-500"}`}>
                      {m.role === "owner" ? <Crown size={11} /> : <UserPlus size={11} />}{m.role}
                    </span>
                    {isOwner && m.role !== "owner" && (
                      <button
                        onClick={() => { setMembersOpen(false); setTransferTo(m); }}
                        title={`Make ${m.username} the owner`}
                        className="p-1 rounded-md text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 opacity-0 group-hover/mem:opacity-100 transition"
                      >
                        <Crown size={12} />
                      </button>
                    )}
                    {isOwner && m.role !== "owner" && (
                      <button
                        onClick={() => removeMember(m.user_id, m.username)}
                        title={`Remove ${m.username}`}
                        className="p-1 rounded-md text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 opacity-0 group-hover/mem:opacity-100 transition"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Group options menu */}
        {menuOpen && group && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
            <div className="absolute top-[3.25rem] left-6 z-40 w-44 glass bg-white/90 dark:bg-neutral-900/90 rounded-xl border border-gray-100 dark:border-neutral-800 p-1.5 shadow-lg text-sm">
              {isOwner ? (
                <>
                  <button
                    onClick={() => { setRenameValue(group.name); setRenameOpen(true); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-gray-700 dark:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    <Pencil size={14} /> Rename group
                  </button>
                  <button
                    onClick={() => { setConfirm("delete"); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={14} /> Delete group
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { setConfirm("leave"); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                >
                  <LogOut size={14} /> Leave group
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Search bar ──────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-3 px-6 py-2.5 border-b border-gray-200/70 dark:border-white/[0.06]">
        <div className="flex-1 flex items-center gap-2.5 px-3 py-1.5 rounded-lg border bg-white/60 dark:bg-neutral-800/40 border-gray-200 dark:border-neutral-700 transition-all duration-150 focus-within:bg-white dark:focus-within:bg-neutral-800/70 focus-within:border-blue-500 dark:focus-within:border-[#0067C0] focus-within:ring-2 focus-within:ring-blue-500/20 dark:focus-within:ring-[#0067C0]/30">
          <Search size={15} className="text-gray-400 dark:text-neutral-500 shrink-0" />
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files…"
            className="flex-1 text-sm bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500"
          />
          {search ? (
            <button onClick={() => setSearch("")} className="shrink-0 text-gray-400 hover:text-gray-600 dark:text-neutral-500 dark:hover:text-neutral-300 transition-colors">
              <X size={14} />
            </button>
          ) : (
            <Kbd keys={["/"]} />
          )}
        </div>
        {search && (
          <span className="text-xs text-gray-400 dark:text-neutral-500 shrink-0 whitespace-nowrap">
            {stats.count} {stats.count === 1 ? "match" : "matches"}
          </span>
        )}
      </div>

      {/* Missing-key notice — this device joined elsewhere / cleared storage */}
      {keyMissing && (
        <div className="shrink-0 mx-6 mt-3 flex items-start gap-2.5 rounded-xl border border-amber-300/50 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 px-4 py-3">
          <KeyRound size={16} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="text-sm">
            <p className="font-medium text-amber-800 dark:text-amber-300">This device is missing the group's key</p>
            <p className="text-xs text-amber-700/80 dark:text-amber-300/70 mt-0.5">
              Files here are end-to-end encrypted. Open an invite link for this group on this device to unlock and download them — the key travels in the invite, never through the server.
            </p>
          </div>
        </div>
      )}

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

      {/* Rename modal */}
      {renameOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => !renaming && setRenameOpen(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={doRename}
            className="glass bg-white/80 dark:bg-neutral-900/80 rounded-2xl border border-gray-100 dark:border-neutral-800 w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Rename group</h3>
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white/50 dark:bg-neutral-800/60 border border-gray-200 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-[#0067C0]"
            />
            <div className="flex gap-2.5 mt-4">
              <button type="button" onClick={() => setRenameOpen(false)} disabled={renaming}
                className="flex-1 py-2.5 text-sm font-medium border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40">
                Cancel
              </button>
              <button type="submit" disabled={renaming || !renameValue.trim()}
                className="flex-1 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-500 dark:bg-[#0067C0] dark:hover:bg-[#005ba1] text-white rounded-xl transition-colors disabled:opacity-40">
                {renaming ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete / Leave confirm */}
      {confirm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => !confirming && setConfirm(null)}>
          <div onClick={(e) => e.stopPropagation()}
            className="glass bg-white/80 dark:bg-neutral-900/80 rounded-2xl border border-gray-100 dark:border-neutral-800 w-full max-w-sm p-6">
            <div className="w-11 h-11 bg-red-50 dark:bg-red-500/10 rounded-xl flex items-center justify-center mb-4">
              {confirm === "delete" ? <Trash2 size={20} className="text-red-500" /> : <LogOut size={20} className="text-red-500" />}
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
              {confirm === "delete" ? "Delete this group?" : "Leave this group?"}
            </h3>
            <p className="text-sm text-gray-500 dark:text-neutral-400 mb-5">
              {confirm === "delete" ? (
                <><span className="font-medium text-gray-800 dark:text-neutral-200 break-all">{group?.name}</span> and its file list will be removed for everyone. This can't be undone.</>
              ) : (
                <>You'll lose access to <span className="font-medium text-gray-800 dark:text-neutral-200 break-all">{group?.name}</span>. You can rejoin later with an invite.</>
              )}
            </p>
            <div className="flex gap-2.5">
              <button onClick={() => setConfirm(null)} disabled={confirming}
                className="flex-1 py-2.5 text-sm font-medium border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40">
                Cancel
              </button>
              <button onClick={confirm === "delete" ? doDelete : doLeave} disabled={confirming}
                className="flex-1 py-2.5 text-sm font-medium bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors disabled:opacity-60">
                {confirming ? "Working…" : confirm === "delete" ? "Delete" : "Leave"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer ownership confirm */}
      {transferTo && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => !transferring && setTransferTo(null)}>
          <div onClick={(e) => e.stopPropagation()}
            className="glass bg-white/80 dark:bg-neutral-900/80 rounded-2xl border border-gray-100 dark:border-neutral-800 w-full max-w-sm p-6">
            <div className="w-11 h-11 bg-amber-50 dark:bg-amber-500/10 rounded-xl flex items-center justify-center mb-4">
              <Crown size={20} className="text-amber-500" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Make {transferTo.username} the owner?</h3>
            <p className="text-sm text-gray-500 dark:text-neutral-400 mb-5">
              <span className="font-medium text-gray-800 dark:text-neutral-200 break-all">{transferTo.username}</span> will be able to rename, delete and manage members. You'll become a regular member.
            </p>
            <div className="flex gap-2.5">
              <button onClick={() => setTransferTo(null)} disabled={transferring}
                className="flex-1 py-2.5 text-sm font-medium border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40">
                Cancel
              </button>
              <button onClick={doTransfer} disabled={transferring}
                className="flex-1 py-2.5 text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-colors disabled:opacity-60">
                {transferring ? "Transferring…" : "Make owner"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
