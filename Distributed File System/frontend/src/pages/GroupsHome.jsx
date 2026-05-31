import { Users } from "lucide-react";

export default function GroupsHome() {
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
