import { useState } from 'react';
import { Table, Empty, fmtDay, fmtTime, monthName, hm } from '@movers/ui';
import { useSpace } from './Dashboard.jsx';
import { visitMinutes } from './Overview.jsx';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Visits() {
  const { data } = useSpace();
  const [offset, setOffset] = useState(0);
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const inMonth = data.visits.filter((v) => {
    const d = new Date(v.checkedInAt);
    return d >= first && d <= new Date(last.getFullYear(), last.getMonth(), last.getDate(), 23, 59);
  });
  const byDay = new Map();
  inMonth.forEach((v) => {
    const k = new Date(v.checkedInAt).getDate();
    byDay.set(k, [...(byDay.get(k) || []), v]);
  });
  const minutes = inMonth.reduce((s, v) => s + visitMinutes(v), 0);
  const avgArrival = inMonth.length ? Math.round(inMonth.reduce((s, v) => s + new Date(v.checkedInAt).getHours() * 60 + new Date(v.checkedInAt).getMinutes(), 0) / inMonth.length) : null;
  const lead = (first.getDay() + 6) % 7;
  const p = data.activePass;
  return (
    <div className="pg">
      <div className="pg-h"><div><p className="eyebrow">{p ? `${p.label} · valid until ${fmtDay(p.validUntil)}` : 'No active pass'}</p><h1>Visits</h1><p className="desc">Each check-in uses one day from a bundle or day pass. Check out when you leave so your hours are right.</p></div></div>
      <div className="stats">
        <div className="card"><span className="k">Visits</span><div className="big">{inMonth.length}</div><p className="sub">{monthName(first)}</p></div>
        <div className="card"><span className="k">Hours</span><div className="big">{hm(minutes)}</div><p className="sub">This month</p></div>
        <div className="card"><span className="k">Avg arrival</span><div className="big">{avgArrival == null ? '—' : `${String(Math.floor(avgArrival / 60)).padStart(2, '0')}:${String(avgArrival % 60).padStart(2, '0')}`}</div><p className="sub">Across {inMonth.length} visits</p></div>
        <div className="card"><span className="k">Days left</span><div className="big">{p?.daysLeft ?? '—'}</div><p className="sub">{p ? (p.daysLeft == null ? 'Unlimited until renewal' : 'On your pass') : 'Buy a pass to check in'}</p></div>
      </div>
      <div className="panel">
        <div className="panel-h">
          <h2>{monthName(first)}</h2>
          <div className="row"><button className="btn soft sm" onClick={() => setOffset(offset - 1)}>Previous</button><button className="btn soft sm" disabled={offset >= 0} onClick={() => setOffset(offset + 1)}>Next</button></div>
        </div>
        <div className="cal">
          {DOW.map((d) => <span key={d} className="dow">{d}</span>)}
          {Array.from({ length: lead }, (_, i) => <span key={`o${i}`} className="day out" />)}
          {Array.from({ length: last.getDate() }, (_, i) => {
            const day = i + 1;
            const vs = byDay.get(day);
            const today = offset === 0 && day === now.getDate();
            return (
              <span key={day} className={`day${vs ? ' in' : ''}${today ? ' today' : ''}`}>
                <span>{day}</span>
                {vs && <span className="tm">{fmtTime(vs[0].checkedInAt)}{vs[0].checkedOutAt ? `–${fmtTime(vs[0].checkedOutAt)}` : ''}</span>}
              </span>
            );
          })}
        </div>
      </div>
      <div className="panel">
        <div className="panel-h"><h2>Visit log</h2></div>
        {data.visits.length ? (
          <Table head={['Date', 'In', 'Out', 'Hours', 'Desk']}>
            {data.visits.map((v) => (
              <tr key={v.id}><td>{fmtDay(v.checkedInAt)}</td><td className="tm">{fmtTime(v.checkedInAt)}</td><td className="tm">{v.checkedOutAt ? fmtTime(v.checkedOutAt) : '—'}</td><td className="tm">{hm(visitMinutes(v))}</td><td>Desk {v.desk}{v.guestName ? ` · ${v.guestName}` : ''}</td></tr>
            ))}
          </Table>
        ) : <Empty icon="pin">No visits yet.</Empty>}
      </div>
    </div>
  );
}
