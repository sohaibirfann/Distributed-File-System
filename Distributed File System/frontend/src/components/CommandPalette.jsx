import { Command } from "cmdk";
import {
  Users, Plus, LogIn, Settings, LogOut, PanelLeft,
} from "lucide-react";
import Kbd from "./Kbd";

// Cmd/Ctrl+K command palette. Actions are passed in from the shell so the
// palette stays a dumb, themeable view.
export default function CommandPalette({
  open, onOpenChange, groups,
  onOpenGroup, onNewGroup, onJoin, onSettings, onToggleSidebar, onSignOut,
}) {
  const run = (fn) => () => { onOpenChange(false); fn(); };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command menu"
      overlayClassName="fixed inset-0 z-50 bg-black/30 backdrop-blur-md"
      contentClassName="fixed left-1/2 top-[16%] z-50 w-full max-w-lg -translate-x-1/2 px-4"
      className="glass bg-white/90 dark:bg-neutral-900/90 rounded-2xl border border-gray-100 dark:border-neutral-800 overflow-hidden shadow-2xl"
    >
      <Command.Input
        placeholder="Search groups or run a command…"
        className="w-full px-4 py-3.5 bg-transparent outline-none text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 border-b border-gray-100 dark:border-neutral-800"
      />
      <Command.List className="max-h-80 overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-sm text-gray-400 dark:text-neutral-500">No results.</Command.Empty>

        <Command.Group heading="Groups">
          {groups.map((g) => (
            <Item key={g.id} onSelect={run(() => onOpenGroup(g.id))} icon={<Users size={15} />}>
              {g.name}
            </Item>
          ))}
          <Item onSelect={run(onNewGroup)} icon={<Plus size={15} />}>New group…</Item>
          <Item onSelect={run(onJoin)}     icon={<LogIn size={15} />}>Join with a code…</Item>
        </Command.Group>

        <Command.Group heading="App">
          <Item onSelect={run(onSettings)}      icon={<Settings size={15} />} hint={["mod", ","]}>Settings</Item>
          <Item onSelect={run(onToggleSidebar)} icon={<PanelLeft size={15} />} hint={["mod", "B"]}>Toggle sidebar</Item>
          <Item onSelect={run(onSignOut)}       icon={<LogOut size={15} />}>Sign out</Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}

function Item({ children, onSelect, icon, hint }) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer text-gray-700 dark:text-neutral-200
                 aria-selected:bg-blue-100/70 dark:aria-selected:bg-[var(--accent)]/15 aria-selected:text-blue-700 dark:aria-selected:text-[var(--accent-bright)]"
    >
      <span className="shrink-0 text-gray-400 dark:text-neutral-500">{icon}</span>
      <span className="flex-1 truncate">{children}</span>
      {hint && <Kbd keys={hint} />}
    </Command.Item>
  );
}
