import { useState } from 'react';
import { api, useApi, useToast, Icon, Modal, Table, Chip, Empty, Loading, ErrorBox, naira, fmtDay, fmtTime, isoDate } from '@movers/ui';
import { PageHead, UserSearch } from '../shared.jsx';

const ST = { CONFIRMED: ['ok', 'Confirmed'], HELD: ['wait', 'Being confirmed'], UNPAID: ['due', 'Unpaid'], CANCELLED: ['lock', 'Cancelled'] };

export default function Bookings() {
  const [filter, setFilter] = useState('upcoming');
  const { data, error, loading, reload } = useApi(`/admin/space/bookings?filter=${filter}`);
  const toast = useToast();
  const [add, setAdd] = useState(false);
  const [cancel, setCancel] = useState(null);
  const doCancel = async () => {
    await api(`/admin/space/bookings/${cancel.id}/cancel`, { method: 'POST' });
    toast('Booking cancelled. The slot is free again.');
    setCancel(null);
    reload();
  };
  return (
    <div className="pg">
      <PageHead eyebrow="Movers Space" title="Bookings" desc="Meeting rooms and the event hall. Confirm payments under Payments; cancel to free a slot.">
        <button className="btn ink" onClick={() => setAdd(true)}><Icon name="plus" />Add booking</button>
      </PageHead>
      <div className="tabs" role="tablist">
        {[['upcoming', 'Upcoming'], ['hall', 'Event hall'], ['room', 'Meeting rooms'], ['past', 'Past'], ['cancelled', 'Cancelled']].map(([k, l]) => <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}>{l}</button>)}
      </div>
      <div className="panel">
        {loading ? <Loading /> : error ? <ErrorBox error={error} /> : data.bookings.length ? (
          <Table head={['Date', 'Booked by', 'Space', 'Time', 'Total', 'Status', '']}>
            {data.bookings.map((b) => {
              const [k, l] = ST[b.status] || ['lock', b.status];
              const balance = b.status === 'CONFIRMED' && b.payments.some((p) => p.status === 'UNPAID');
              return (
                <tr key={b.id}>
                  <td>{fmtDay(b.start)}</td>
                  <td><b>{b.user.name}</b><div className="small">{b.user.phone}</div></td>
                  <td>{b.room}{b.layout ? ` · ${b.layout}` : ''}<div className="small">{b.people} {b.roomKind === 'HALL' ? 'guests' : 'people'}</div></td>
                  <td className="tm">{fmtTime(b.start)}–{fmtTime(b.end)}</td>
                  <td className="amt">{naira(b.total)}</td>
                  <td>{balance ? <Chip kind="wait">Balance due</Chip> : <Chip kind={k}>{l}</Chip>}</td>
                  <td>{b.status !== 'CANCELLED' && new Date(b.end) > new Date() && <button className="linkbtn" onClick={() => setCancel(b)}>Cancel</button>}</td>
                </tr>
              );
            })}
          </Table>
        ) : <Empty icon="calendar">No bookings here.</Empty>}
      </div>
      {add && <AddBooking onClose={() => setAdd(false)} onDone={reload} />}
      {cancel && (
        <Modal title="Cancel this booking?" onClose={() => setCancel(null)}>
          <p style={{ marginTop: 10, color: 'var(--ink-2)' }}>{cancel.room} for {cancel.user.name}, {fmtDay(cancel.start)} {fmtTime(cancel.start)}. Any unpaid payments are cancelled too. Refund paid money separately.</p>
          <div className="sheet-foot"><button className="btn ghost" onClick={() => setCancel(null)}>Keep it</button><button className="btn ink" onClick={doCancel}>Cancel booking</button></div>
        </Modal>
      )}
    </div>
  );
}

function AddBooking({ onClose, onDone }) {
  const toast = useToast();
  const space = useApi('/public/space');
  const [who, setWho] = useState(null);
  const [f, setF] = useState({ type: 'room', date: isoDate(new Date(Date.now() + 864e5)), start: 10, hours: 2, people: 4, pkg: 'pm', guests: 30, layout: 'classroom', paid: false });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const s = space.data?.settings;
  const save = async () => {
    setErr('');
    const order = f.type === 'room'
      ? { type: 'room', date: f.date, start: Number(f.start), hours: Number(f.hours), people: Number(f.people) }
      : { type: 'hall', date: f.date, pkg: f.pkg, guests: Number(f.guests), layout: f.layout, addons: {}, deposit: false };
    try {
      const r = await api('/admin/space/orders', { method: 'POST', body: { userId: who.id, order, paid: f.paid } });
      toast(`Booked for ${who.name}. Reference ${r.reference}.`);
      onDone();
      onClose();
    } catch (e) {
      setErr(e.message);
    }
  };
  return (
    <Modal title="Add a booking" onClose={onClose} wide>
      <p className="small" style={{ marginTop: 6 }}>For walk-ins and phone bookings. The person needs a Movers account; create one with them first if they’re new.</p>
      <div style={{ marginTop: 14 }}>
        {!who ? <UserSearch onPick={setWho} /> : !s ? <Loading /> : (
          <>
            <div className="row" style={{ justifyContent: 'space-between' }}><b>{who.name}</b><button className="linkbtn" onClick={() => setWho(null)}>Change</button></div>
            <div className="fields">
              <div className="field"><label htmlFor="ab-t">Space</label><select id="ab-t" value={f.type} onChange={set('type')}><option value="room">Meeting room</option><option value="hall">Event hall</option></select></div>
              <div className="field"><label htmlFor="ab-d">Date</label><input id="ab-d" type="date" min={isoDate()} value={f.date} onChange={set('date')} /></div>
              {f.type === 'room' ? (
                <>
                  <div className="field"><label htmlFor="ab-s">Start</label><select id="ab-s" value={f.start} onChange={set('start')}>{Array.from({ length: 13 }, (_, i) => 8 + i).map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}</select></div>
                  <div className="field"><label htmlFor="ab-h">Hours</label><input id="ab-h" type="number" min="1" max="8" value={f.hours} onChange={set('hours')} /></div>
                  <div className="field"><label htmlFor="ab-p">People</label><input id="ab-p" type="number" min="1" max="12" value={f.people} onChange={set('people')} /></div>
                </>
              ) : (
                <>
                  <div className="field"><label htmlFor="ab-k">Time block</label><select id="ab-k" value={f.pkg} onChange={set('pkg')}>{s.hallPackages.map((p) => <option key={p.id} value={p.id}>{p.name} · {naira(p.price)}</option>)}</select></div>
                  <div className="field"><label htmlFor="ab-l">Layout</label><select id="ab-l" value={f.layout} onChange={set('layout')}>{s.layouts.map((l) => <option key={l.id} value={l.id}>{l.name} · up to {l.capacity}</option>)}</select></div>
                  <div className="field"><label htmlFor="ab-g">Guests</label><input id="ab-g" type="number" min="1" value={f.guests} onChange={set('guests')} /></div>
                </>
              )}
              <div className="field wide"><span className="lbl">Payment</span><div className="checkrow"><label className="tog"><input type="checkbox" checked={f.paid} onChange={set('paid')} />Paid now at the desk</label></div></div>
            </div>
            {err && <p className="err" style={{ marginTop: 10 }}>{err}</p>}
            <div className="sheet-foot"><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn ink" onClick={save}>Add booking</button></div>
          </>
        )}
      </div>
    </Modal>
  );
}
