import { useCoordinatorStatus } from "../lib/useCoordinatorStatus";

const STATES = {
  checking:     { dot: "bg-gray-400",                    label: "",              title: "Checking connection…" },
  connected:    { dot: "bg-emerald-500",                 label: "",              title: "Connected" },
  reconnecting: { dot: "bg-amber-500 animate-pulse",     label: "Reconnecting…", title: "Can't reach the network right now — retrying" },
  offline:      { dot: "bg-gray-500",                    label: "Offline",       title: "This device has no internet connection" },
  none:         { dot: "bg-gray-500",                    label: "Not connected", title: "No server address set — open Settings to connect" },
};

export default function ConnectionStatus() {
  const status = useCoordinatorStatus();
  const s = STATES[status] || STATES.checking;

  return (
    <span
      className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-neutral-400"
      title={s.title}
      role="status"
      aria-live="polite"
      aria-label={`Connection status: ${s.title}`}
    >
      <span className={`w-2 h-2 rounded-full ${s.dot}`} />
      {s.label && <span className="font-medium">{s.label}</span>}
    </span>
  );
}
