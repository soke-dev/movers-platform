import { useState } from 'react';
import { api, useAuth, useToast } from '@movers/ui';
import { PageHead, UserSearch } from '../shared.jsx';

const ROLES = [['USER', 'No admin access'], ['STAFF', 'Staff: front desk and teaching'], ['ADMIN', 'Admin: everything, including team']];

export default function Team() {
  const { user } = useAuth();
  const toast = useToast();
  const [who, setWho] = useState(null);
  if (user.role !== 'ADMIN') return <p className="errbox">Only an admin can manage the team.</p>;
  const setRole = async (role) => {
    try {
      const r = await api(`/admin/users/${who.id}/role`, { method: 'PATCH', body: { role } });
      setWho(r.user);
      toast(`${r.user.name} is now ${role === 'USER' ? 'a regular user' : role.toLowerCase()}.`);
    } catch (e) {
      toast(e.message, true);
    }
  };
  return (
    <div className="pg">
      <PageHead eyebrow="Account" title="Team" desc="Give staff access to this admin. They sign up on the Learn or Space site first, then you find them here." />
      <div className="panel">
        {!who ? <UserSearch onPick={setWho} placeholder="Find the person by name or email" /> : (
          <>
            <div className="row" style={{ justifyContent: 'space-between' }}><div><b>{who.name}</b><div className="small">{who.email}</div></div><button className="linkbtn" onClick={() => setWho(null)}>Find someone else</button></div>
            <div className="opts" style={{ marginTop: 14 }}>
              {ROLES.map(([k, l]) => (
                <label className="opt" key={k} style={{ gridTemplateColumns: 'auto minmax(0,1fr)' }}>
                  <input type="radio" name="role" checked={who.role === k} disabled={who.id === user.id} onChange={() => setRole(k)} />
                  <div><b>{k === 'USER' ? 'Member or student' : k === 'STAFF' ? 'Staff' : 'Admin'}</b><span>{l}</span></div>
                </label>
              ))}
            </div>
            {who.id === user.id && <p className="small" style={{ marginTop: 10 }}>You can’t change your own role.</p>}
          </>
        )}
      </div>
    </div>
  );
}
