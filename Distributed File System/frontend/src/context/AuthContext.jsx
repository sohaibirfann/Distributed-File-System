import { createContext, useContext, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext(null);

function parseToken(tokenStr) {
  try { return JSON.parse(atob(tokenStr.split(".")[1])); } catch { return null; }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("dfs_token") || null);
  const [user,  setUser]  = useState(() => {
    const t = localStorage.getItem("dfs_token");
    return t ? parseToken(t) : null;
  });

  function login(tokenStr) {
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
      logout();
      throw new Error("Session expired — please log in again");
    }
    return res;
  }, [token]);

  return (
    <AuthContext.Provider value={{ token, user, login, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
