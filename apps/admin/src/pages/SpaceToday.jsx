import { useState } from 'react';
import { api, useApi, useToast, Icon, Modal, Empty, Loading, ErrorBox, Chip, fmtTime, fmtDay, isoDate } from '@movers/ui';
import { PageHead, UserSearch } from '../shared.jsx';

export default function SpaceToday() {
  const { data, error, loading, reload } = useApi('/admin/space/today');
  const toast = useToast();
  const [checkin, setCheckin] = useState(false);
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} retry={reload} />;
  const used = new Set(data.inNow.map((v) => v.desk));
  const out = async (v) => {
    await api(`/admin/space/visits/${v.id}/checkout`, { method: 'POST' });
    toast(`${v.guestName || v.user.name} checked out.`);
    reload();
  };
  return (
    <div className="pg">
      <PageHead eyebrow={fmtDay(new Date())} title="Space today" desc="Who’s in, which desks are taken and what’s booked.">
        <button className="btn blue" onClick={() => setCheckin(true)}><Icon name="qr" />Check someone in</button>
      </PageHead>
      <div className="kpis">
        <div className="card"><span className="k">In now</span><div className="big">{data.inNow.length}</div><p className="sub">{data.desks - data.inNow.length} desks free</p></div>
        <div className="card"><span className="k">Visits today</span><div className="big">{data.inNow.length + data.leftToday.length}</div><p className="sub">{data.leftToday.length} already left</p></div>
        <div className="card"><span className="k">Rooms today</span><div className="big">{data.bookings.length}</div><p className="sub">Meeting rooms and hall</p></div>
        <div className="card"><span className="k">Next hall event</span><div className="big" style={{ fontSize: 22 }}>{data.nextHall ? fmtDay(data.nextHall.start) : 'None'}</div><p className="sub">{data.nextHall ? `${data.nextHall.who} · ${data.nextHall.people} guests` : 'Nothing booked'}</p></div>
      </div>
      <div className="d-grid">
        <div className="panel">
          <div className="panel-h"><h2>Hot desks</h2><span className="meta">{used.size} of {data.desks} in use</span></div>
          <div className="deskmap">{Array.from({ length: data.desks }, (_, i) => <span key={i} className={used.has(i + 1) ? 'on' : ''}>{i + 1}</span>)}</div>
          <div className="panel-h" style={{ margin: '22px 0 10px' }}><h2>Bookings today</h2></div>
          {data.bookings.length ? (
            <ul className="list">
              {data.bookings.map((b) => <li key={b.id}><span className="ib"><Icon name="clock" /></span><div><div className="t">{b.room} · {b.user.name}</div><div className="d">{fmtTime(b.start)}–{fmtTime(b.end)} · {b.people} people</div></div><Chip kind={b.status === 'CONFIRMED' ? 'ok' : 'wait'}>{b.status === 'CONFIRMED' ? 'Paid' : 'Not paid'}</Chip></li>)}
            </ul>
          ) : <Empty icon="calendar">No room bookings today.</Empty>}
        </div>
        <div className="panel">
          <div className="panel-h"><h2>In the space now</h2></div>
          {data.inNow.length ? (
            <ul className="list">
              {data.inNow.map((v) => (
                <li key={v.id}><span className="ib" style={{ background: 'var(--blue-mist)', color: 'var(--blue-deep)', font: '600 12px var(--f-mono)' }}>{v.desk}</span><div><div className="t">{v.guestName || v.user.name}</div><div className="d">In at {fmtTime(v.checkedInAt)}{v.guestName ? ` · guest of ${v.user.name}` : ''}</div></div><button className="btn soft sm" onClick={() => out(v)}>Check out</button></li>
              ))}
            </ul>
          ) : <Empty icon="pin">Nobody checked in yet.</Empty>}
        </div>
      </div>
      {checkin && <CheckinModal onClose={() => setCheckin(false)} onDone={reload} />}
    </div>
  );
}

function CheckinModal({ onClose, onDone }) {
  const toast = useToast();
  const [who, setWho] = useState(null);
  const [guest, setGuest] = useState('');
  const [err, setErr] = useState('');
  const [needPass, setNeedPass] = useState(false);
  const go = async () => {
    setErr('');
    try {
      const r = await api('/admin/space/checkin', { method: 'POST', body: { userId: who.id, guestName: guest } });
      toast(`${guest || who.name} checked in at desk ${r.visit.desk}.`);
      onDone();
      onClose();
    } catch (e) {
      setErr(e.message);
      setNeedPass(/pass/i.test(e.message));
    }
  };
  const sellDayPass = async () => {
    try {
      await api('/admin/space/orders', { method: 'POST', body: { userId: who.id, paid: true, order: { type: 'desk', pass: 'day', date: isoDate(), people: 1 } } });
      toast('Day pass sold and marked paid.');
      setNeedPass(false);
      go();
    } catch (e) {
      setErr(e.message);
    }
  };
  return (
    <Modal title="Check someone in" onClose={onClose}>
      <div style={{ marginTop: 14 }}>
        {!who ? <UserSearch onPick={setWho} /> : (
          <>
            <div className="row" style={{ justifyContent: 'space-between' }}><b>{who.name}</b><button className="linkbtn" onClick={() => setWho(null)}>Change</button></div>
            <div className="fields"><div className="field wide"><label htmlFor="g-n">Guest name (only if checking in someone on their pass)</label><input id="g-n" value={guest} onChange={(e) => setGuest(e.target.value)} /></div></div>
            {err && <p className="err" style={{ marginTop: 10 }}>{err}</p>}
            <div className="sheet-foot">
              {needPass && <button className="btn amber" onClick={sellDayPass}>Sell a day pass (paid at desk)</button>}
              <button className="btn blue" onClick={go}>Check in</button>
            </div>
          </>
        )}
        <p className="small" style={{ marginTop: 12 }}>Members can also check in themselves from their dashboard.</p>
      </div>
    </Modal>
  );
}
