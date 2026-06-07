import { createContext, useContext, useState, useCallback, useRef } from "react";
import { CheckCircle, XCircle, Loader2, Info, X } from "lucide-react";

const NotificationContext = createContext(null);

const CONFIG = {
  success: {
    icon: CheckCircle,
    classes:
      "bg-emerald-50 dark:bg-emerald-950/90 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300",
    iconColor: "text-emerald-500",
  },
  error: {
    icon: XCircle,
    classes:
      "bg-red-50 dark:bg-red-950/90 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300",
    iconColor: "text-red-500",
  },
  loading: {
    icon: Loader2,
    classes:
      "bg-white dark:bg-neutral-900/95 border-gray-200 dark:border-neutral-700 text-gray-800 dark:text-neutral-200",
    iconColor: "text-gray-500 dark:text-neutral-400",
  },
  info: {
    icon: Info,
    classes:
      "bg-white dark:bg-neutral-900/95 border-gray-200 dark:border-neutral-700 text-gray-800 dark:text-neutral-200",
    iconColor: "text-gray-400 dark:text-neutral-400",
  },
};

function Banner({ notification, onDismiss }) {
  const { icon: Icon, classes, iconColor } = CONFIG[notification.type] ?? CONFIG.info;
  return (
    <div
      className={`notification-enter flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-md text-sm font-medium w-full ${classes}`}
    >
      <Icon
        size={16}
        className={`shrink-0 ${iconColor} ${notification.type === "loading" ? "animate-spin" : ""}`}
      />
      <span className="flex-1 leading-snug">{notification.message}</span>
      {notification.type !== "loading" && (
        <button
          onClick={onDismiss}
          className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export function NotificationProvider({ children }) {
  const [items, setItems] = useState([]);
  const counter = useRef(0);

  const dismiss = useCallback((id) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const add = useCallback(
    ({ type = "info", message, duration = 3500 }) => {
      const id = ++counter.current;
      setItems((prev) => [...prev, { id, type, message }]);
      if (duration > 0) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  const notify = {
    success: (message, duration) => add({ type: "success", message, duration }),
    error: (message, duration) => add({ type: "error", message, duration }),
    loading: (message) => add({ type: "loading", message, duration: 0 }),
    info: (message, duration) => add({ type: "info", message, duration }),
    dismiss,
  };

  return (
    <NotificationContext.Provider value={notify}>
      {children}
      <div className="toast-stack fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
        {items.map((n) => (
          <div key={n.id} className="pointer-events-auto">
            <Banner notification={n} onDismiss={() => dismiss(n.id)} />
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export const useNotify = () => useContext(NotificationContext);
