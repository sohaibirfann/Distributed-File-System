import { useOutletContext } from "react-router-dom";
import { Users, Plus, LogIn, ShieldCheck } from "lucide-react";

export default function GroupsHome() {
  const { groups = [], openNew, openJoin } = useOutletContext() || {};
  const firstRun = groups.length === 0;

  if (!firstRun) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
          <Users size={26} className="text-gray-400 dark:text-neutral-500" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Pick a group</h2>
        <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1 max-w-xs">
          Select one of your groups from the sidebar, or create a new one to start sharing encrypted files.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-[var(--accent)]/15 flex items-center justify-center mb-5">
        <ShieldCheck size={30} className="text-blue-600 dark:text-[var(--accent-bright)]" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">Welcome to DFS</h2>
      <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1.5 max-w-sm">
        Create a private group to share end-to-end encrypted files with people you invite —
        or join a friend's group with their code.
      </p>
      <div className="flex items-center gap-2.5 mt-6">
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 dark:bg-[var(--accent)] dark:hover:bg-[var(--accent-hover)] text-[var(--on-accent)] transition-colors"
        >
          <Plus size={16} /> Create a group
        </button>
        <button
          onClick={openJoin}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-neutral-300 border border-gray-200 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <LogIn size={16} /> Join with a code
        </button>
      </div>
    </div>
  );
}
