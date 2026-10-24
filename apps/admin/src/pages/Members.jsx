import { useState } from 'react';
import { api, useApi, useToast, Icon, Modal, Table, Chip, Empty, Loading, ErrorBox, fmtDay, isoDate } from '@movers/ui';
import { PageHead, UserSearch, waTo } from '../shared.jsx';

export default function Members() {
  const { data, error, loading, reload } = useApi('/admin/space/members');
  const toast = useToast();
  const [q, setQ] = useState('');
  const [addDays, setAddDays] = useState(null);
  const [sell, setSell] = useState(false);
  const rows = (data?.members || []).filter((m) => `${m.user.name} ${m.user.email}`.toLowerCase().includes(q.toLowerCase()));
  const low = rows.filter((m) => m.pass?.daysLeft != null && m.pass.daysLeft <= 2).length;
  const saveDays = async (e) => {
    e.preventDefault();
    try {
      await api(`/admin/space/passes/${addDays.pass.id}/add-days`, { method: 'POST', body: { days: Number(addDays.days) } });
      toast(`Added ${addDays.days} day${addDays.days > 1 ? 's' : ''} to ${addDays.user.name}’s pass.`);
      setAddDays(null);
      reload();
    } catch (x) {
      toast(x.message, true);
    }
  };
  return (
    <div className="pg">
      <PageHead eyebrow="Movers Space" title="Members" desc="Everyone with a pass. Add days, sell a pass at the desk, or message them.">
        <button className="btn ink" onClick={() => setSell(true)}><Icon name="plus" />Sell a pass</button>
      </PageHead>
      <div className="kpis">
        <div className="card"><span className="k">Members</span><div className="big">{data?.members.length ?? '—'}</div><p className="sub">With any pass</p></div>
        <div className="card"><span className="k">Active passes</span><div className="big">{data ? data.members.filter((m) => m.pass?.status === 'ACTIVE').length : '—'}</div><p className="sub">Paid and in date</p></div>
        <div className="card"><span className="k">Running low</span><div className="big" style={{ color: 'var(--due)' }}>{low}</div><p className="sub">2 days or fewer left</p></div>
        <div className="card"><span className="k">Visits this month</span><div className="big">{data ? data.members.reduce((s, m) => s + m.visitsThisMonth, 0) : '—'}</div><p className="sub">All members</p></div>
      </div>
      <label className="search"><Icon name="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search members" aria-label="Search members" /></label>
      <div className="panel">
        {loading ? <Loading /> : error ? <ErrorBox error={error} /> : rows.length ? (
          <Table head={['Member', 'Pass', 'Days left', 'This month', 'Last visit', '']}>
            {rows.map((m) => (
              <tr key={m.user.id}>
                <td><b>{m.user.name}</b><div className="small">{m.user.phone || m.user.email}</div></td>
                <td>{m.pass ? <>{m.pass.label}{m.pass.people > 1 ? ` × ${m.pass.people}` : ''} <Chip kind={m.pass.status === 'ACTIVE' ? 'ok' : 'wait'}>{m.pass.status === 'ACTIVE' ? `until ${fmtDay(m.pass.validUntil)}` : m.pass.status.toLowerCase()}</Chip></> : '—'}</td>
                <td>{m.pass?.daysLeft == null ? (m.pass ? 'Unlimited' : '—') : <span className="mono" style={{ color: m.pass.daysLeft <= 2 ? 'var(--due)' : 'inherit' }}>{m.pass.daysLeft}</span>}</td>
                <td className="mono">{m.visitsThisMonth} visits</td>
                <td>{m.lastVisit ? fmtDay(m.lastVisit) : '—'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {m.pass && <button className="linkbtn" onClick={() => setAddDays({ ...m, days: m.pass.daysLeft == null ? 7 : 1 })}>{m.pass.daysLeft == null ? 'Extend' : 'Add days'}</button>}
                  {m.user.phone && <> · <a className="linkbtn" target="_blank" rel="noreferrer" href={waTo(m.user.phone, `Hello ${m.user.name.split(' ')[0]}, this is Movers Space.`)}>WhatsApp</a></>}
                </td>
              </tr>
            ))}
          </Table>
        ) : <Empty icon="pin">No members yet.</Empty>}
      </div>
      {addDays && (
        <Modal title={`${addDays.pass.daysLeft == null ? 'Extend' : 'Add days to'} ${addDays.user.name}’s pass`} onClose={() => setAddDays(null)}>
          <form onSubmit={saveDays}>
            <div className="fields"><div className="field"><label htmlFor="ad-n">{addDays.pass.daysLeft == null ? 'Extra days of validity' : 'Days to add'}</label><input id="ad-n" type="number" min="1" max="60" value={addDays.days} onChange={(e) => setAddDays({ ...addDays, days: e.target.value })} /></div></div>
            <p className="small" style={{ marginTop: 10 }}>Use this for referral rewards or goodwill. To sell days, use “Sell a pass” so it shows in payments.</p>
            <div className="sheet-foot"><button type="button" className="btn ghost" onClick={() => setAddDays(null)}>Cancel</button><button className="btn ink">Save</button></div>
          </form>
        </Modal>
      )}
      {sell && <SellPass onClose={() => setSell(false)} onDone={reload} />}
    </div>
  );
}

function SellPass({ onClose, onDone }) {
  const toast = useToast();
  const [who, setWho] = useState(null);
  const [f, setF] = useState({ pass: 'day', people: 1, date: isoDate(), paid: true });
  const [err, setErr] = useState('');
  const save = async () => {
    try {
      const r = await api('/admin/space/orders', { method: 'POST', body: { userId: who.id, paid: f.paid, order: { type: 'desk', pass: f.pass, date: f.date, people: Number(f.people) } } });
      toast(`Pass sold to ${who.name}. Reference ${r.reference}.`);
      onDone();
      onClose();
    } catch (e) {
      setErr(e.message);
    }
  };
  return (
    <Modal title="Sell a pass" onClose={onClose}>
      <div style={{ marginTop: 14 }}>
        {!who ? <UserSearch onPick={setWho} /> : (
          <>
            <div className="row" style={{ justifyContent: 'space-between' }}><b>{who.name}</b><button className="linkbtn" onClick={() => setWho(null)}>Change</button></div>
            <div className="fields">
              <div className="field"><label htmlFor="sp-p">Pass</label><select id="sp-p" value={f.pass} onChange={(e) => setF({ ...f, pass: e.target.value })}><option value="day">Day pass</option><option value="weekly">Weekly pass</option><option value="monthly">Monthly hot desk</option></select></div>
              <div className="field"><label htmlFor="sp-n">People</label><input id="sp-n" type="number" min="1" max="10" value={f.people} onChange={(e) => setF({ ...f, people: e.target.value })} /></div>
              <div className="field"><label htmlFor="sp-d">Starts</label><input id="sp-d" type="date" min={isoDate()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
              <div className="field"><span className="lbl">Payment</span><div className="checkrow"><label className="tog"><input type="checkbox" checked={f.paid} onChange={(e) => setF({ ...f, paid: e.target.checked })} />Paid now at the desk</label></div></div>
            </div>
            {err && <p className="err" style={{ marginTop: 10 }}>{err}</p>}
            <div className="sheet-foot"><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn ink" onClick={save}>Sell pass</button></div>
          </>
        )}
      </div>
    </Modal>
  );
}
