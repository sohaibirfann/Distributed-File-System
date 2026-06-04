import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth }   from "../context/AuthContext";
import { useNotify } from "../context/NotificationContext";
import { buildInvite, getKeyB64 } from "../lib/groupKeys";
import { useDialog } from "../lib/useDialog";
import { X, Copy, Check, UserPlus, ShieldAlert, Clock, Trash2, Plus, Loader2, ChevronDown, UserCheck } from "lucide-react";

import { getApiUrl } from "../lib/api";
const API = getApiUrl();

// Expiry presets for new invites. Default to 7 days — a short-lived link shrinks
// the window if an invite leaks (the code also unlocks the group's files).
const EXPIRY_OPTS = [
  { key: "1h",    label: "1 hour",  ms: 3_600_000 },
  { key: "24h",   label: "24 hours", ms: 86_400_000 },
  { key: "7d",    label: "7 days",  ms: 7 * 86_400_000 },
  { key: "30d",   label: "30 days", ms: 30 * 86_400_000 },
  { key: "never", label: "No expiry", ms: null },
];

function inviteMessage(groupName, invite) {
  return `Join my "${groupName}" group on DFS 🔒

To join:
1. Open the DFS app and sign in
2. Click "Join with code" in the sidebar
3. Paste this invite:

${invite}

Heads up: this code also unlocks the group's encrypted files, so only share it with people you trust.`;
}

// Usage state for a capped (max_uses) invite. Null for unlimited invites.
function usageLabel(inv) {
  if (inv.max_uses == null) return null;
  if (inv.uses >= inv.max_uses) return { text: "Used", spent: true };
  if (inv.max_uses === 1)      return { text: "One-time", spent: false };
  return { text: `${inv.max_uses - inv.uses} of ${inv.max_uses} left`, spent: false };
}

// Human-readable remaining lifetime of an invite.
function expiryLabel(iso) {
  if (!iso) return { text: "No expiry", expired: false };
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return { text: "Expired", expired: true };
  const days = Math.round(ms / 86_400_000);
  const hrs  = Math.round(ms / 3_600_000);
  const mins = Math.round(ms / 60_000);
  if (days >= 1) return { text: `${days}d left`, expired: false };
  if (hrs  >= 1) return { text: `${hrs}h left`,  expired: false };
  return { text: `${mins}m left`, expired: false };
}

export default function InviteModal({ groupId, groupName, onClose }) {
  const { authFetch } = useAuth();
  const notify        = useNotify();

  const keyB64 = getKeyB64(groupId);
  const base   = `${API}/api/groups/${groupId}/invites`;

  const [invites, setInvites] = useState(null);  // null = loading
  const [error, setError]     = useState(keyB64 ? "" : "This device doesn't hold this group's key, so it can't create invites.");
  const [expiry, setExpiry]   = useState("7d");
  const [singleUse, setSingleUse] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied]   = useState("");     // the code just copied
  const panelRef = useDialog(true, onClose);

  const load = useCallback(async () => {
    try {
      const res = await authFetch(base);
      if (!res.ok) throw new Error();
      setInvites(await res.json());
    } catch {
      setInvites([]);
      setError("Couldn't load invites. Try again.");
    }
  }, [base, authFetch]);

  useEffect(() => { if (keyB64) load(); }, [keyB64, load]);

  async function create() {
    setCreating(true);
    setError("");
    try {
      const opt = EXPIRY_OPTS.find((o) => o.key === expiry);
      const expiresAt = opt?.ms == null ? null : new Date(Date.now() + opt.ms).toISOString();
      const res = await authFetch(base, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresAt, singleUse }),
      });
      if (!res.ok) throw new Error();
      await load();
      notify.success("Invite created");
    } catch {
      setError("Couldn't create an invite. Try again.");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(code) {
    setInvites((list) => list.filter((i) => i.code !== code)); // optimistic
    try {
      const res = await authFetch(`${base}/${encodeURIComponent(code)}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      notify.success("Invite revoked");
    } catch {
      notify.error("Couldn't revoke — refreshing");
      load();
    }
  }

  function copy(code) {
    const full = buildInvite(code, keyB64);
    navigator.clipboard.writeText(inviteMessage(groupName, full));
    setCopied(code);
    notify.success("Invite message copied — paste it to your friend");
    setTimeout(() => setCopied((c) => (c === code ? "" : c)), 1600);
  }

  return (
    <div className="dialog-backdrop fixed inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={`Invite to ${groupName}`} className="dialog-panel glass bg-white/80 dark:bg-neutral-900/80 rounded-2xl border border-gray-100 dark:border-neutral-800 w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-[var(--accent)]/10 flex items-center justify-center">
              <UserPlus size={16} className="text-blue-600 dark:text-[var(--accent-bright)]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Invite to {groupName}</h3>
              <p className="text-xs text-gray-400 dark:text-neutral-500">Anyone with a code can join and read the files</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800"><X size={15} /></button>
        </div>

        {!keyB64 ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : (
          <>
            {/* Create a new invite */}
            <div className="flex items-end gap-2">
              <div className="flex-1 min-w-0">
                <span className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1.5">Expires after</span>
                <Dropdown value={expiry} options={EXPIRY_OPTS} onChange={setExpiry} />
              </div>
              <button
                onClick={create}
                disabled={creating}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 dark:bg-[var(--accent)] dark:hover:bg-[var(--accent-hover)] text-[var(--on-accent)] text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                Create
              </button>
            </div>
            <label className="flex items-center gap-2 mt-2.5 text-xs text-gray-600 dark:text-neutral-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={singleUse}
                onChange={(e) => setSingleUse(e.target.checked)}
                className="accent-blue-600 dark:accent-[var(--accent)]"
              />
              One-time use — the invite stops working after one person joins
            </label>

            {/* Active invites */}
            <div className="mt-5">
              <p className="text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wide mb-2">Active invites</p>
              {invites === null ? (
                <p className="text-sm text-center text-gray-400 dark:text-neutral-500 py-5">Loading…</p>
              ) : invites.length === 0 ? (
                <p className="text-sm text-center text-gray-400 dark:text-neutral-500 py-5">No active invites yet — create one to share.</p>
              ) : (
                <ul className="space-y-2 max-h-56 overflow-y-auto">
                  {invites.map((inv) => {
                    const exp = expiryLabel(inv.expires_at);
                    const use = usageLabel(inv);
                    return (
                      <li key={inv.code} className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-neutral-800/60 rounded-xl">
                        <div className="min-w-0 flex-1">
                          <code className="block text-xs font-mono text-gray-900 dark:text-white truncate select-all" title={inv.code}>{inv.code}</code>
                          <span className="flex items-center gap-2 mt-0.5">
                            <span className={`inline-flex items-center gap-1 text-[11px] ${exp.expired ? "text-red-500" : "text-gray-400 dark:text-neutral-500"}`}>
                              <Clock size={10} /> {exp.text}
                            </span>
                            {use && (
                              <span className={`text-[11px] ${use.spent ? "text-red-500" : "text-gray-400 dark:text-neutral-500"}`}>
                                · {use.text}
                              </span>
                            )}
                          </span>
                          {inv.redeemers?.length > 0 && (
                            <span className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-neutral-500 mt-0.5 truncate" title={inv.redeemers.join(", ")}>
                              <UserCheck size={10} className="shrink-0" /> used by {inv.redeemers.join(", ")}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => copy(inv.code)}
                          title="Copy invite message"
                          className="shrink-0 p-2 rounded-lg text-gray-500 dark:text-neutral-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 hover:text-blue-600 transition-colors"
                        >
                          {copied === inv.code ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
                        </button>
                        <button
                          onClick={() => revoke(inv.code)}
                          title="Revoke invite"
                          className="shrink-0 p-2 rounded-lg text-gray-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="mt-4 flex items-start gap-2 text-xs text-amber-700/90 dark:text-amber-400/80 bg-amber-50 dark:bg-amber-500/10 rounded-xl px-3 py-2.5">
              <ShieldAlert size={14} className="shrink-0 mt-0.5" />
              <span>An invite also unlocks the group's encrypted files. Revoke any you no longer need — and prefer a short expiry.</span>
            </div>

            {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}

// Themed dropdown — the native <select> popup is OS-rendered and ignores the
// app's dark/frosted styling, so we roll a small custom listbox instead.
function Dropdown({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = options.find((o) => o.key === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey  = (e) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true); // capture: beat the dialog's Esc-to-close
    return () => { document.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey, true); };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-white/50 dark:bg-neutral-800/60 border border-gray-200 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-white hover:border-gray-300 dark:hover:border-neutral-600 focus:outline-none focus:border-blue-500 dark:focus:border-[var(--accent)] transition-colors"
      >
        <span className="truncate">{current?.label}</span>
        <ChevronDown size={15} className={`shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul
          role="listbox"
          className="dialog-panel absolute z-50 mt-1.5 w-full glass bg-white/90 dark:bg-neutral-900/90 rounded-xl border border-gray-100 dark:border-neutral-800 p-1 shadow-xl"
        >
          {options.map((o) => (
            <li
              key={o.key}
              role="option"
              aria-selected={o.key === value}
              onClick={() => { onChange(o.key); setOpen(false); }}
              className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-sm cursor-pointer transition-colors ${
                o.key === value
                  ? "bg-blue-50 dark:bg-[var(--accent)]/15 text-blue-700 dark:text-[var(--accent-bright)] font-medium"
                  : "text-gray-700 dark:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800"
              }`}
            >
              <span className="truncate">{o.label}</span>
              {o.key === value && <Check size={14} className="shrink-0" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
