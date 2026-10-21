import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api } from './api.js';

const AuthCtx = createContext(null);
const REF_KEY = 'mv-ref';

/** A referral link (?ref=CODE) is remembered, so sign-up fills the code in even after they browse around. */
function rememberRef() {
  const ref = new URLSearchParams(window.location.search).get('ref');
  try {
    if (ref) localStorage.setItem(REF_KEY, ref.trim().toUpperCase());
  } catch { /* private mode */ }
}
rememberRef();

export function storedRef() {
  try {
    return localStorage.getItem(REF_KEY) || '';
  } catch {
    return '';
  }
}

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
  if (staff && user.role === 'USER') return <StaffOnly user={user} />;
  return children;
}

/** Signed in (one login covers every Movers site) but not as staff: say which account, and let them switch. */
function StaffOnly({ user }) {
  const { logout } = useAuth();
  return (
    <div className="wrap" style={{ paddingBlock: 60, maxWidth: 520 }}>
      <p className="errbox">This page is for Movers staff.</p>
      <p style={{ marginTop: 14, color: 'var(--ink-2)' }}>
        You’re logged in as <b>{user.email}</b>, which doesn’t have staff access. Log out and log in with a staff account,
        or ask an admin to add you under Team.
      </p>
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn ink" onClick={logout}>Log out and switch account</button>
      </div>
    </div>
  );
}
