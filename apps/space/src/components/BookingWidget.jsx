import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, useApi, useAuth, Modal, PayFlow, LoginForm, RegisterForm, Loading, naira, fmtDay, isoDate } from '@movers/ui';

/** Tomorrow, or Monday if tomorrow is a Sunday (we're closed). */
const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + (d.getDay() === 6 ? 2 : 1));
  return isoDate(d);
};
const hh = (h) => `${String(h).padStart(2, '0')}:00`;
const PASSES = [['day', 'Day pass', 'dayPass'], ['weekly', 'Weekly pass (6 days)', 'weekly'], ['monthly', 'Monthly hot desk', 'monthly']];

/**
 * Book a desk, a meeting room or the event hall. Prices come from the server.
 * Used on the public Space site and inside the member dashboard.
 */
export function BookingWidget({ space, initialType = 'desk', inDashboard = false, onBooked }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const s = space.settings;
  const [type, setType] = useState(initialType);
  const [f, setF] = useState({
    date: tomorrow(), pass: 'day', people: 1,
    rpeople: 4, raddons: {},
    pkg: s.hallPackages[0].id, guests: 20, layout: s.layouts[1]?.id || s.layouts[0].id,
    addons: {}, deposit: true
  });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const [quote, setQuote] = useState(null);
  const [auth, setAuth] = useState(null);
  const [pay, setPay] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const avail = useApi(`/public/availability?date=${f.date}`);

  useEffect(() => {
    if (initialType) setType(initialType);
  }, [initialType]);

  const body = useMemo(() => {
    if (type === 'desk') return { type, pass: f.pass, date: f.date, people: Number(f.people) };
    if (type === 'room') return { type, date: f.date, people: Number(f.rpeople), addons: f.raddons };
    return { type, date: f.date, pkg: f.pkg, guests: Number(f.guests), layout: f.layout, addons: f.addons, deposit: f.deposit };
  }, [type, f]);

  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      api('/public/quote', { method: 'POST', body }).then((q) => live && setQuote(q)).catch((e) => live && setQuote({ error: e.message }));
    }, 200);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [body]);

  const meeting = space.rooms.find((r) => r.kind === 'MEETING');
  const roomSlug = type === 'hall' ? 'hall' : meeting?.slug;
  const busySlots = avail.data?.rooms.find((r) => r.slug === roomSlug)?.busy || [];
  const pkg = s.hallPackages.find((p) => p.id === f.pkg);
  // The meeting room is booked for the whole day, 9:00–18:00.
  const mine = type === 'room' ? [9, 18] : type === 'hall' ? [pkg.start, pkg.end] : null;
  const layout = s.layouts.find((l) => l.id === f.layout);
  const desksShort = type === 'desk' && f.date === isoDate() && avail.data && Number(f.people) > avail.data.desksFree;
  const blocked = !quote || quote.error || quote.clash || desksShort;

  const what = type === 'desk' ? `${PASSES.find((p) => p[0] === f.pass)[1]}${f.people > 1 ? ` · ${f.people} people` : ''}` : type === 'room' ? (quote?.room?.name || 'Meeting room') : `Event hall · ${layout.name}`;
  const when = type === 'desk' ? `From ${fmtDay(f.date)}` : `${fmtDay(f.date)} · ${type === 'room' ? 'full day, ' : ''}${hh(mine[0])}–${hh(mine[1])}`;

  async function book() {
    if (!user) return setAuth('register');
    setBusy(true);
    setErr('');
    try {
      const r = await api('/space/book', { method: 'POST', body });
      setPay({ payment: r.payment, lines: [[what, when], ...quote.lines.map(([a, b]) => [a, b < 0 ? `−${naira(-b)}` : b]), ['Total', quote.total, 'muted']] });
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const pct = (h) => `${(((h - 8) / 14) * 100).toFixed(2)}%`;
  return (
    <div className="book">
      <div className="book-form">
        <div className="seg" role="tablist">
          {[['desk', 'Workspace'], ['room', 'Meeting room'], ['hall', 'Event hall']].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={type === k} onClick={() => setType(k)}>{l}</button>
          ))}
        </div>
        <div className="fields">
          {type === 'desk' && (
            <>
              <div className="field"><label htmlFor="b-pass">Plan</label><select id="b-pass" value={f.pass} onChange={(e) => set('pass', e.target.value)}>{PASSES.map(([k, l, key]) => <option key={k} value={k}>{l} · {naira(s[key])}</option>)}</select></div>
              <div className="field"><label htmlFor="b-date">Start date</label><input id="b-date" type="date" min={isoDate()} value={f.date} onChange={(e) => e.target.value && set('date', e.target.value)} /></div>
              <div className="field wide"><label htmlFor="b-ppl">How many people?</label><input id="b-ppl" type="number" min="1" max="10" value={f.people} onChange={(e) => set('people', Math.max(1, Math.min(10, Number(e.target.value) || 1)))} /><span className="hint">Each pass covers one person. Everyone you add can check in with your code.</span></div>
              {/* The student rate is applied by the server for anyone who has attended a Movers Learn class. */}
              <p className="hint" style={{ gridColumn: '1 / -1' }}>
                {quote?.studentApplied
                  ? `Movers Learn student: ${s.studentDiscount}% off is applied for one person.`
                  : `Movers Learn students who have attended any of our classes get ${s.studentDiscount}% off desk passes${user ? '' : ' once logged in'}.`}
              </p>
            </>
          )}
          {type === 'room' && (
            <>
              <div className="field"><label htmlFor="b-date">Date</label><input id="b-date" type="date" min={isoDate()} value={f.date} onChange={(e) => e.target.value && set('date', e.target.value)} /></div>
              <div className="field"><label htmlFor="b-rp">People</label><input id="b-rp" type="number" min="1" max={meeting?.capacity || 10} value={f.rpeople} onChange={(e) => set('rpeople', Math.max(1, Math.min(meeting?.capacity || 10, Number(e.target.value) || 1)))} /><span className="hint">Round table for up to {meeting?.capacity || 10}. Booked for the full day, 9:00–18:00.</span></div>
              <div className="field wide"><span className="lbl">Add-ons</span><div className="checkrow">
                {s.addons.map((a) => (
                  <label className="tog" key={a.id}><input type="checkbox" checked={Boolean(f.raddons[a.id])} onChange={(e) => set('raddons', { ...f.raddons, [a.id]: e.target.checked })} />{a.name} {naira(a.price)}{a.perGuest ? '/person' : ''}</label>
                ))}
              </div></div>
            </>
          )}
          {type === 'hall' && (
            <>
              <div className="field"><label htmlFor="b-date">Date</label><input id="b-date" type="date" min={isoDate()} value={f.date} onChange={(e) => e.target.value && set('date', e.target.value)} /></div>
              {s.hallPackages.length > 1
                ? <div className="field"><label htmlFor="b-pkg">Time block</label><select id="b-pkg" value={f.pkg} onChange={(e) => set('pkg', e.target.value)}>{s.hallPackages.map((p) => <option key={p.id} value={p.id}>{p.name} · {hh(p.start)}–{hh(p.end)} · {naira(p.price)}</option>)}</select></div>
                : <div className="field"><span className="lbl">Booking</span><p style={{ marginTop: 6 }}>Full day, {hh(pkg.start)}–{hh(pkg.end)} · {naira(pkg.price)}</p></div>}
              <div className="field"><label htmlFor="b-lay">Layout</label><select id="b-lay" value={f.layout} onChange={(e) => set('layout', e.target.value)}>{s.layouts.map((l) => <option key={l.id} value={l.id}>{l.name} · up to {l.capacity}</option>)}</select></div>
              <div className="field"><label htmlFor="b-g">Guests</label><input id="b-g" type="number" min="1" max={layout.capacity} value={f.guests} onChange={(e) => set('guests', Math.max(1, Number(e.target.value) || 1))} /><span className="hint">{layout.name} seats up to {layout.capacity}.</span></div>
              <div className="field wide"><span className="lbl">Add-ons</span><div className="checkrow">
                {s.addons.map((a) => (
                  <label className="tog" key={a.id}><input type="checkbox" checked={Boolean(f.addons[a.id])} onChange={(e) => set('addons', { ...f.addons, [a.id]: e.target.checked })} />{a.name} {naira(a.price)}{a.perGuest ? '/guest' : ''}</label>
                ))}
              </div></div>
              <div className="field wide"><span className="lbl">Payment</span><div className="checkrow"><label className="tog"><input type="checkbox" checked={f.deposit} onChange={(e) => set('deposit', e.target.checked)} />Pay 50% now, balance 7 days before</label></div></div>
            </>
          )}
        </div>
        {type === 'desk' ? (
          <div>
            <div className="avail-h"><span>Hot desks on <b>{fmtDay(f.date)}</b></span><span className="mono">{avail.data ? `${avail.data.desksFree} of ${avail.data.desks} free` : '…'}</span></div>
            {avail.data && <div className="desk-grid">{Array.from({ length: avail.data.desks }, (_, i) => <i key={i} className={i >= avail.data.desksFree ? 'taken' : ''} />)}</div>}
            <p className="small muted" style={{ marginTop: 8 }}>First come, first served. Open Monday to Saturday; check in with your QR code from 8:00.</p>
          </div>
        ) : (
          <div>
            <div className="avail-h"><span>{type === 'room' ? 'Meeting room' : 'Event hall'} on <b>{fmtDay(f.date)}</b></span><span className="legend" style={{ margin: 0 }}><span><i style={{ background: '#C3D2EE' }} />Booked</span><span><i style={{ background: 'var(--blue)' }} />Your pick</span></span></div>
            <div className="timeline">
              {busySlots.map(([a, b], i) => <span key={i} className="blk busy" style={{ left: pct(a), width: `calc(${pct(b)} - ${pct(a)})` }} title={`Booked ${hh(a)}–${hh(b)}`} />)}
              {mine && <span className={`blk mine${quote?.clash ? ' clash' : ''}`} style={{ left: pct(mine[0]), width: `calc(${pct(Math.min(22, mine[1]))} - ${pct(mine[0])})` }} />}
            </div>
            <div className="tl-hours"><span>08:00</span><span>11:00</span><span>15:00</span><span>18:00</span><span>22:00</span></div>
          </div>
        )}
      </div>
      <aside className="book-sum">
        <h3>Your booking</h3>
        <div><b>{what}</b><p className="small">{when}{type === 'hall' ? ` · ${f.guests} guests` : type === 'room' ? ` · ${f.rpeople} people` : ` · ${f.people} ${f.people > 1 ? 'people, one pass each' : 'person'}`}</p></div>
        {!quote ? <Loading text="Pricing…" /> : quote.error ? <p className="warn">{quote.error}</p> : (
          <ul className="lines">
            {quote.lines.map(([a, b], i) => <li key={i}><span>{a}</span><span>{b < 0 ? `−${naira(-b)}` : naira(b)}</span></li>)}
            <li className="tot"><span>Total</span><span>{naira(quote.total)}</span></li>
            {quote.payNow !== quote.total && <li><span>Due now (50%)</span><span>{naira(quote.payNow)}</span></li>}
          </ul>
        )}
        {quote?.clash && <p className="warn">{type === 'room' ? 'The meeting room is already booked that day. Pick another date.' : 'That time overlaps an existing booking. Pick another time block or date.'}</p>}
        {desksShort && <p className="warn">Not enough free desks today. Pick another date or fewer people.</p>}
        {err && <p className="warn">{err}</p>}
        <button className="btn amber lg full" disabled={blocked || busy} onClick={book}>{busy ? 'Saving…' : `Book and pay${quote && !quote.error ? ` ${naira(quote.payNow)}` : ''}`}</button>
        <p className="fine">Pay online, on WhatsApp, at the office, or later. Free cancellation up to 48 hours before.</p>
      </aside>

      {auth && (
        <Modal title={auth === 'register' ? 'Create your account' : 'Log in to book'} onClose={() => setAuth(null)}>
          {auth === 'register'
            ? <RegisterForm cta="Continue" next="/dashboard/book" switchTo={() => setAuth('login')} onDone={() => setAuth(null)} />
            : <LoginForm next="/dashboard/book" switchTo={() => setAuth('register')} onDone={() => setAuth(null)} />}
        </Modal>
      )}
      {pay && (
        <Modal title="Confirm and pay" onClose={() => setPay(null)}>
          <PayFlow
            payment={pay.payment}
            lines={pay.lines}
            allowLater
            hold="We hold your booking for 24 hours."
            laterText="Your booking is saved but not paid yet. Pay from your dashboard, on WhatsApp or at the front desk before the day. Unpaid bookings can be released if someone else pays first."
            finishLabel={inDashboard ? 'Done' : 'See it in my dashboard'}
            onFinish={() => {
              setPay(null);
              onBooked?.();
              navigate(type === 'desk' ? '/dashboard' : '/dashboard/bookings');
            }}
          />
        </Modal>
      )}
    </div>
  );
}
