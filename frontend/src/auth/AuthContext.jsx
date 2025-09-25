import { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as api from "../api/appApi";

const AuthCtx = createContext(null);
const STORAGE_KEY = "ces_user";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); }
    catch { return null; }
  });

  useEffect(() => {
    try {
      if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, [user]);

  const value = useMemo(() => {
    async function login(email, password) {
      const u = await api.login(email, password);
      setUser(u);
      return u;
    }
    function logout() {
      api.logout();
      setUser(null);
    }
    return { user, login, logout };
  }, [user]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
