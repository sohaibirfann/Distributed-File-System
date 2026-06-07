import { useEffect, useRef, useState } from "react";
import { pingCoordinator, getApiUrl, hasCoordinator } from "./api";

const OK_INTERVAL  = 15_000;
const BAD_INTERVAL = 5_000;

export function useCoordinatorStatus() {
  const [status, setStatus] = useState("checking");
  const timer = useRef(null);

  useEffect(() => {
    let alive = true;

    function schedule(ms) {
      clearTimeout(timer.current);
      timer.current = setTimeout(check, ms);
    }

    async function check() {
      if (!alive) return;

      if (!hasCoordinator()) {
        setStatus("none");
        return schedule(OK_INTERVAL);
      }
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setStatus("offline");
        return schedule(BAD_INTERVAL);
      }

      const ok = await pingCoordinator(getApiUrl(), 4000);
      if (!alive) return;
      setStatus(ok ? "connected" : "reconnecting");
      schedule(ok ? OK_INTERVAL : BAD_INTERVAL);
    }

    check();

    const recheck   = () => check();
    const goOffline = () => { if (alive) setStatus("offline"); };
    window.addEventListener("online", recheck);
    window.addEventListener("offline", goOffline);
    window.addEventListener("focus", recheck);

    return () => {
      alive = false;
      clearTimeout(timer.current);
      window.removeEventListener("online", recheck);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("focus", recheck);
    };
  }, []);

  return status;
}
