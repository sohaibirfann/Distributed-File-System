import { createContext, useContext, useState, useCallback, useRef } from "react";

const TransferContext = createContext(null);

export function useTransfers() {
  return useContext(TransferContext);
}

export function TransferProvider({ children }) {
  const [transfers, setTransfers] = useState([]); // { id, name, kind, progress, status }
  const nextId = useRef(0);

  const start = useCallback((name, kind = "download") => {
    const id = ++nextId.current;
    setTransfers((t) => [...t, { id, name, kind, progress: -1, status: "active" }]);
    return id;
  }, []);

  const update = useCallback((id, patch) => {
    setTransfers((t) => t.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }, []);

  const finish = useCallback((id, status = "done") => {
    setTransfers((t) => t.map((x) => (x.id === id ? { ...x, status, progress: status === "done" ? 100 : x.progress } : x)));
  }, []);

  const remove    = useCallback((id) => setTransfers((t) => t.filter((x) => x.id !== id)), []);
  const clearDone = useCallback(() => setTransfers((t) => t.filter((x) => x.status === "active")), []);

  return (
    <TransferContext.Provider value={{ transfers, start, update, finish, remove, clearDone }}>
      {children}
    </TransferContext.Provider>
  );
}
