import { createContext, useContext, useEffect, useState } from 'react';
import { api, useApi, Icon, phoneToWa } from '@movers/ui';

/** The class the admin is looking at. Defaults to the one shown on the website. */
const CohortCtx = createContext(null);

export function CohortProvider({ children }) {
  const list = useApi('/admin/cohorts');
  const [id, setId] = useState(() => localStorage.getItem('mv-cohort') || '');
  const cohorts = list.data?.cohorts || [];
  const current = cohorts.find((c) => c.id === id) || cohorts.find((c) => c.isCurrent) || cohorts[0] || null;
  const choose = (v) => {
    setId(v);
    try { localStorage.setItem('mv-cohort', v); } catch { /* private mode */ }
  };
  return <CohortCtx.Provider value={{ cohorts, cohort: current, choose, reload: list.reload, loading: list.loading }}>{children}</CohortCtx.Provider>;
}

export const useCohort = () => useContext(CohortCtx);

export function CohortSelect() {
  const { cohorts, cohort, choose } = useCohort();
  if (!cohorts.length) return null;
  return (
    <select className="select" aria-label="Class" value={cohort?.id || ''} onChange={(e) => choose(e.target.value)}>
      {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.code}{c.isCurrent ? ' (on website)' : ''}</option>)}
    </select>
  );
}

/** Type a name, email or phone and pick a person. */
export function UserSearch({ onPick, placeholder = 'Search by name, email or phone' }) {
  const [q, setQ] = useState('');
  const [users, setUsers] = useState([]);
  useEffect(() => {
    if (q.trim().length < 2) {
      setUsers([]);
      return;
    }
    const t = setTimeout(() => api(`/admin/users?q=${encodeURIComponent(q.trim())}`).then((r) => setUsers(r.users)).catch(() => setUsers([])), 250);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div>
      <label className="search" style={{ maxWidth: 'none' }}><Icon name="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label="Find a person" /></label>
      {users.length > 0 && (
        <ul className="list" style={{ marginTop: 10 }}>
          {users.map((u) => (
            <li key={u.id}>
              <span className="ib"><Icon name="users" /></span>
              <div><div className="t">{u.name}</div><div className="d">{u.email} · {u.phone || 'no phone'}</div></div>
              <button className="btn ink sm" onClick={() => { onPick(u); setQ(''); setUsers([]); }}>Choose</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const waTo = (phone, text) => `https://wa.me/${phoneToWa(phone)}?text=${encodeURIComponent(text)}`;

export function PageHead({ eyebrow, title, desc, children }) {
  return (
    <div className="pg-h">
      <div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{desc && <p className="desc">{desc}</p>}</div>
      {children && <div className="row">{children}</div>}
    </div>
  );
}
