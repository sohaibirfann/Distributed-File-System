import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { useNotify } from "./NotificationContext";

const AuthContext = createContext(null);

function parseToken(tokenStr) {
  try { return JSON.parse(atob(tokenStr.split(".")[1])); } catch { return null; }
}

export function AuthProvider({ children }) {
  const notify = useNotify();
  const [token, setToken] = useState(() => localStorage.getItem("dfs_token") || null);
  const [user,  setUser]  = useState(() => {
    const t = localStorage.getItem("dfs_token");
    return t ? parseToken(t) : null;
  });
  // Guards against multiple in-flight 401s (e.g. the file poller) all firing a toast.
  const expiredRef = useRef(false);

  function login(tokenStr) {
    expiredRef.current = false;
    localStorage.setItem("dfs_token", tokenStr);
    setToken(tokenStr);
    setUser(parseToken(tokenStr));
  }

  function logout() {
    localStorage.removeItem("dfs_token");
    setToken(null);
    setUser(null);
  }

  const authFetch = useCallback(async (url, options = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      if (!expiredRef.current) {
        expiredRef.current = true;
        notify.error("Your session expired — please sign in again.");
      }
      logout();
      throw new Error("Session expired — please log in again");
    }
    return res;
  }, [token, notify]);

  // Tell the desktop shell who's signed in, so its embedded storage node can
  // register under this user (and stop when they sign out). No-op on the web.
  useEffect(() => {
    window.dfsDesktop?.node?.setUser(user?.id ?? null);
  }, [user]);

  return (
    <AuthContext.Provider value={{ token, user, login, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
