import { createContext, useContext, useState, type ReactNode } from 'react';
import { api, setToken, getToken } from './api';

interface Session {
  name: string;
  role: string;
}

interface AuthCtx {
  session: Session | null;
  authenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(
    getToken() ? { name: 'Administrador', role: 'ADMIN' } : null,
  );

  async function login(email: string, password: string): Promise<void> {
    const res = await api.post<{ token: string; name: string; role: string }>(
      '/auth/login',
      { email, password },
    );
    setToken(res.token);
    setSession({ name: res.name, role: res.role });
  }

  function logout(): void {
    setToken(null);
    setSession(null);
    window.location.href = '/login';
  }

  return (
    <Ctx.Provider value={{ session, authenticated: Boolean(session), login, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
