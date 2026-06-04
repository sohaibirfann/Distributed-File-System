import { useEffect, useRef, useState } from "react";
import { pingCoordinator, getApiUrl, hasCoordinator } from "./api";

// Polls the coordinator's /api/health so the UI can surface a plain-language
// connection state (the word "coordinator" never reaches the user). States:
//   checking     — first probe in flight
//   connected    — health check passed
//   reconnecting — an address is set but unreachable; we keep retrying
//   offline      — the machine itself has no network
//   none         — no address configured yet (the setup gate handles that)
//
// Cadence adapts: relaxed (15s) while healthy, brisk (5s) while trying to
// recover. Also re-probes on browser online/offline events and window focus so
// the pill reacts the moment connectivity changes.
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
