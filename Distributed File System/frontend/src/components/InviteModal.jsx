import { useState, useEffect } from "react";
import { useAuth }   from "../context/AuthContext";
import { useNotify } from "../context/NotificationContext";
import { buildInvite, getKeyB64 } from "../lib/groupKeys";
import { X, Copy, Check, UserPlus, ShieldAlert } from "lucide-react";

const API = import.meta.env.VITE_API_URL;

function inviteMessage(groupName, invite) {
  return `Join my "${groupName}" group on DFS 🔒

To join:
1. Open the DFS app and sign in
2. Click "Join with code" in the sidebar
3. Paste this invite:

${invite}

Heads up: this code also unlocks the group's encrypted files, so only share it with people you trust.`;
}

export default function InviteModal({ groupId, groupName, onClose }) {
  const { authFetch } = useAuth();
  const notify        = useNotify();

  const [invite, setInvite]   = useState("");   // joinCode#key
  const [error, setError]     = useState("");
  const [copied, setCopied]   = useState("");   // "" | "invite" | "code"

  useEffect(() => {
    const keyB64 = getKeyB64(groupId);
    if (!keyB64) { setError("This device doesn't hold this group's key, so it can't create an invite."); return; }
    (async () => {
      try {
        const res  = await authFetch(`${API}/api/groups/${groupId}/invites`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
        });
        const data = await res.json();
        if (!res.ok) throw new Error();
        setInvite(buildInvite(data.code, keyB64));
      } catch {
        setError("Couldn't create an invite. Try again.");
      }
    })();
  }, [groupId]);

  function copy(kind) {
    const text = kind === "invite" ? inviteMessage(groupName, invite) : invite;
    navigator.clipboard.writeText(text);
    setCopied(kind);
    notify.success(kind === "invite" ? "Invite message copied — paste it to your friend" : "Code copied");
    setTimeout(() => setCopied(""), 1600);
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="glass bg-white/80 dark:bg-neutral-900/80 rounded-2xl border border-gray-100 dark:border-neutral-800 w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-[#FF6363]/10 flex items-center justify-center">
              <UserPlus size={16} className="text-blue-600 dark:text-[#FF6363]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Invite to {groupName}</h3>
              <p className="text-xs text-gray-400 dark:text-neutral-500">Anyone with this code can join and read the files</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800"><X size={15} /></button>
        </div>

        {error ? (
          <p className="mt-5 text-sm text-red-500">{error}</p>
        ) : !invite ? (
          <p className="mt-6 text-sm text-center text-gray-400 dark:text-neutral-500">Creating invite…</p>
        ) : (
          <div className="mt-5 space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wide mb-1.5">Invite code</p>
              <code className="block px-3 py-2.5 bg-gray-50 dark:bg-neutral-800 rounded-xl text-sm font-mono text-gray-900 dark:text-white break-all select-all">{invite}</code>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => copy("invite")}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-500 dark:bg-[#FF6363] dark:hover:bg-[#FF5252] text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {copied === "invite" ? <Check size={15} /> : <Copy size={15} />}
                {copied === "invite" ? "Copied!" : "Copy invite"}
              </button>
              <button
                onClick={() => copy("code")}
                className="px-3.5 py-2.5 border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-300 text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                {copied === "code" ? "Copied" : "Code only"}
              </button>
            </div>

            <div className="flex items-start gap-2 text-xs text-amber-700/90 dark:text-amber-400/80 bg-amber-50 dark:bg-amber-500/10 rounded-xl px-3 py-2.5">
              <ShieldAlert size={14} className="shrink-0 mt-0.5" />
              <span>This code also unlocks the group's encrypted files — only share it with people you trust.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
