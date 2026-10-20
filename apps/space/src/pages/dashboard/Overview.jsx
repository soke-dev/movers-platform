import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Icon, QR, Empty, useAuth, useToast, fmtDay, fmtDate, fmtTime, hm, displayName } from '@movers/ui';
import { useSpace } from './Dashboard.jsx';
import { BookingRow } from './Bookings.jsx';

export function visitMinutes(v) {
  const end = v.checkedOutAt ? new Date(v.checkedOutAt) : new Date();
  return Math.max(0, (end - new Date(v.checkedInAt)) / 60000);
}

export default function Overview() {
  const { data, reload } = useSpace();
  const { user } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const p = data.activePass;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const month = data.visits.filter((v) => new Date(v.checkedInAt) >= monthStart);
  const minutes = month.reduce((s, v) => s + visitMinutes(v), 0);
  const upcoming = data.bookings.filter((b) => b.status !== 'CANCELLED' && new Date(b.end) >= new Date()).sort((a, b) => new Date(a.start) - new Date(b.start));
  const hour = new Date().getHours();

  const act = async (path, msg) => {
    setBusy(true);
    try {
      await api(path, { method: 'POST' });
      toast(msg);
      reload();
    } catch (e) {
      toast(e.message, true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pg">
      <div className="pg-h"><div><p className="eyebrow">{fmtDay(new Date())} · Movers Space</p><h1>{hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'}, {displayName(user)}</h1></div></div>
      <div className="m-cards">
        <div className="card ck">
          <span className="k">Check-in</span>
          <div className="checkin">
            <div style={{ textAlign: 'center' }}><QR value={data.checkinCode} size={104} label="Your check-in code" /><div className="small tm">{data.referralCode}</div></div>
            <div>
              {data.openVisit ? (
                <>
                  <p style={{ font: '800 18px/1.2 var(--f-display)' }}>Checked in at {fmtTime(data.openVisit.checkedInAt)}</p>
                  <p className="sub">Desk {data.openVisit.desk}. Scan your code at the door or tap Check out when you leave, so your hours are right.</p>
                  <button className="btn soft sm" style={{ marginTop: 10 }} disabled={busy} onClick={() => act('/space/checkout', 'Checked out. See you next time.')}>Check out</button>
                </>
              ) : (
                <>
                  <p style={{ font: '800 18px/1.2 var(--f-display)' }}>You’re not checked in</p>
                  <p className="sub">Scan this code at the door or show it at the front desk, or check in here when you arrive.</p>
                  <button className="btn blue sm" style={{ marginTop: 10 }} disabled={busy || !p} onClick={() => act('/space/checkin', 'Checked in. Welcome to Movers Space.')}>Check in now</button>
                  {!p && <p className="small" style={{ marginTop: 6 }}>You need a pass first. <Link className="more" to="/dashboard/book">Buy one</Link></p>}
                </>
              )}
            </div>
          </div>
        </div>
        <div className="card">
          <span className="k">Your plan</span>
          {p ? (
            <>
              <b style={{ font: '800 20px var(--f-display)' }}>{p.label}{p.people > 1 ? ` · ${p.people} people` : ''}</b>
              {p.daysTotal != null && p.daysTotal <= 30 && <div className="passdots" style={{ gridTemplateColumns: `repeat(${Math.min(10, p.daysTotal)},1fr)` }}>{Array.from({ length: p.daysTotal }, (_, i) => <i key={i} className={i >= p.daysUsed ? 'free' : ''} />)}</div>}
              <p className="sub">{p.daysLeft != null ? <><b>{p.daysLeft} day{p.daysLeft === 1 ? '' : 's'} left</b> · </> : null}valid until {fmtDate(p.validUntil)}</p>
              {p.daysLeft != null && p.daysLeft <= 2 && <Link className="btn blue sm" style={{ alignSelf: 'flex-start' }} to="/dashboard/book">Buy another pass</Link>}
            </>
          ) : (
            <>
              <p className="sub">No active pass.</p>
              <Link className="btn blue sm" style={{ alignSelf: 'flex-start' }} to="/dashboard/book">Buy a pass</Link>
            </>
          )}
        </div>
        <div className="card">
          <span className="k">This month</span>
          <div className="big">{hm(minutes)}</div>
          <p className="sub">{month.length} visit{month.length === 1 ? '' : 's'}</p>
        </div>
      </div>
      <div className="d-grid">
        <div className="panel">
          <div className="panel-h"><h2>Coming up</h2><Link className="more" to="/dashboard/bookings">All bookings <Icon name="arrow" /></Link></div>
          {upcoming.length ? upcoming.slice(0, 3).map((b) => <BookingRow key={b.id} b={b} />) : <Empty icon="calendar">No upcoming bookings. <Link className="more" to="/dashboard/book">Book a room or the hall</Link></Empty>}
        </div>
        <div className="panel">
          <div className="panel-h"><h2>Recent visits</h2><Link className="more" to="/dashboard/visits">Full history <Icon name="arrow" /></Link></div>
          {data.visits.length ? (
            <ul className="list">
              {data.visits.slice(0, 4).map((v) => (
                <li key={v.id}><span className="ib" style={{ background: 'var(--blue-mist)', color: 'var(--blue-deep)' }}><Icon name="pin" /></span><div><div className="t">{fmtDay(v.checkedInAt)}</div><div className="d">{fmtTime(v.checkedInAt)}–{v.checkedOutAt ? fmtTime(v.checkedOutAt) : 'now'} · desk {v.desk}</div></div><span className="mono small">{hm(visitMinutes(v))}</span></li>
              ))}
            </ul>
          ) : <Empty icon="pin">Your visits will show here.</Empty>}
        </div>
      </div>
    </div>
  );
}
