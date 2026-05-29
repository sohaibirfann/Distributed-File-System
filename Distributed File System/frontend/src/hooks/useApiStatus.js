import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

const API = import.meta.env.VITE_API_URL;

export function useApiStatus() {
  const { authFetch } = useAuth();
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await authFetch(`${API}/api/health`, {
          signal: AbortSignal.timeout(3000),
        });
        if (!cancelled) setStatus(res.ok ? "online" : "offline");
      } catch {
        if (!cancelled) setStatus("offline");
      }
    }

    check();
    const id = setInterval(check, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [authFetch]);

  return status;
}
