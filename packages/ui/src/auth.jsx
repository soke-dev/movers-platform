import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api } from './api.js';

const AuthCtx = createContext(null);

/** Shares the signed-in Movers account. The session cookie works across learn., space. and admin. */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);
  const refresh = useCallback(async () => {
    try {
      setUser((await api('/auth/me')).user);
    } catch {
      setUser(null);
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  const logout = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
  };
  return <AuthCtx.Provider value={{ user, setUser, refresh, logout }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

export function RequireAuth({ children, staff = false, loginPath = '/login' }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (user === undefined) return <div className="loading">Loading…</div>;
  if (!user) return <Navigate to={`${loginPath}?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (staff && user.role === 'USER') return <div className="wrap" style={{ paddingBlock: 60 }}><p className="errbox">This page is for Movers staff. Ask an admin to give your account staff access.</p></div>;
  return children;
}
