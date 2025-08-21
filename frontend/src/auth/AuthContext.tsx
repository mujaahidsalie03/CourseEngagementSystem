import { createContext, useContext, useMemo, useState } from 'react';
import { jwtDecode } from 'jwt-decode';
import { clearToken, getToken, setToken } from './token';
import type { Role, User } from '../domain/types';
import { http } from '../api/http';
import { endpoints } from '../api/endpoints';

type Jwt = { _id: string; email: string; role: Role; fullName?: string; iat: number; exp: number };

type Ctx = {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthCtx = createContext<Ctx>(null as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const t = getToken();
    if (!t) return null;
    try {
      const d = jwtDecode<Jwt>(t);
      return { _id: d._id, email: d.email, role: d.role, fullName: d.fullName || 'user' };
    } catch {
      return null;
    }
  });

  async function login(email: string, password: string) {
    const { data } = await http.post<{ token: string }>(endpoints.auth.login, { email, password });
    setToken(data.token);
    const d = jwtDecode<Jwt>(data.token);
    setUser({ _id: d._id, email: d.email, role: d.role, fullName: d.fullName || 'user' });
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  const val = useMemo(() => ({ user, login, logout }), [user]);
  return <AuthCtx.Provider value={val}>{children}</AuthCtx.Provider>;
}

export const useAuthCtx = () => useContext(AuthCtx);
