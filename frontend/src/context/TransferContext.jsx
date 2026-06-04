import { createContext, useContext, useState, useCallback, useRef } from "react";

// Tracks in-flight transfers (downloads, zip bundles, …) so a single panel can
// show them app-wide, regardless of which group/page is open. Completed ones
// linger briefly then auto-clear.
const TransferContext = createContext(null);

export function useTransfers() {
  return useContext(TransferContext);
}

export function TransferProvider({ children }) {
  const [transfers, setTransfers] = useState([]); // { id, name, kind, progress, status }
  const nextId = useRef(0);

  // Begin a transfer; returns its id. progress -1 = indeterminate.
  const start = useCallback((name, kind = "download") => {
    const id = ++nextId.current;
    setTransfers((t) => [...t, { id, name, kind, progress: -1, status: "active" }]);
    return id;
  }, []);

  const update = useCallback((id, patch) => {
    setTransfers((t) => t.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }, []);

  // Mark done/error, then drop it from the list after a short grace period.
  const finish = useCallback((id, status = "done") => {
    setTransfers((t) => t.map((x) => (x.id === id ? { ...x, status, progress: status === "done" ? 100 : x.progress } : x)));
    setTimeout(() => setTransfers((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  const remove    = useCallback((id) => setTransfers((t) => t.filter((x) => x.id !== id)), []);
  const clearDone = useCallback(() => setTransfers((t) => t.filter((x) => x.status === "active")), []);

  return (
    <TransferContext.Provider value={{ transfers, start, update, finish, remove, clearDone }}>
      {children}
    </TransferContext.Provider>
  );
}
