import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Icon, Chip, Empty, Modal, useToast, fmtDay, fmtTime, dayNum, monShort, naira } from '@movers/ui';
import { useSpace } from './Dashboard.jsx';

const STATUS = { CONFIRMED: ['ok', 'Confirmed'], HELD: ['wait', 'Held · being confirmed'], UNPAID: ['due', 'Unpaid'], CANCELLED: ['lock', 'Cancelled'] };

export function BookingRow({ b, past, onCancel }) {
  const [k, l] = STATUS[b.status] || ['lock', b.status];
  const balance = b.payments.find((p) => p.status === 'UNPAID' && b.status === 'CONFIRMED');
  return (
    <div className={`booking${past ? ' past' : ''}`}>
      <span className="dt">{dayNum(b.start)}<small>{monShort(b.start)}</small></span>
      <div><b>{b.room}{b.layout ? ` · ${b.layout}` : ''}</b><span>{fmtDay(b.start)} · {fmtTime(b.start)}–{fmtTime(b.end)} · {b.people} {b.roomKind === 'HALL' ? 'guests' : 'people'} · {naira(b.total)}</span></div>
      <div className="row" style={{ gap: 8 }}>
        {balance ? <Chip kind="wait">Balance due</Chip> : <Chip kind={k}>{l}</Chip>}
        {onCancel && b.status !== 'CANCELLED' && <button className="linkbtn" onClick={() => onCancel(b)}>Cancel</button>}
      </div>
    </div>
  );
}

const PASS_STATUS = { ACTIVE: ['ok', 'Paid'], HELD: ['wait', 'Being confirmed'], UNPAID: ['due', 'Unpaid'], CANCELLED: ['lock', 'Cancelled'], EXPIRED: ['lock', 'Ended'] };
const lastDay = (p) => new Date(new Date(p.validUntil).getTime() - 864e5);

/** A desk pass: day, weekly or monthly. */
function PassRow({ p, past, onCancel }) {
  const [k, l] = PASS_STATUS[p.status] || ['lock', p.status];
  const oneDay = new Date(p.validUntil) - new Date(p.validFrom) <= 864e5;
  const unpaid = p.payments.find((x) => x.status === 'UNPAID');
  return (
    <div className={`booking${past ? ' past' : ''}`}>
      <span className="dt">{dayNum(p.validFrom)}<small>{monShort(p.validFrom)}</small></span>
      <div>
        <b>{p.label}{p.people > 1 ? ` · ${p.people} people` : ''}</b>
        <span>{oneDay ? fmtDay(p.validFrom) : `${fmtDay(p.validFrom)} – ${fmtDay(lastDay(p))}`} · hot desk · {naira(p.price)}{p.daysTotal > 1 ? ` · ${p.daysLeft} of ${p.daysTotal} days left` : ''}</span>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <Chip kind={k}>{l}</Chip>
        {onCancel && unpaid && p.status === 'UNPAID' && <button className="linkbtn" onClick={() => onCancel({ pass: p, payment: unpaid })}>Cancel</button>}
      </div>
    </div>
  );
}

export default function Bookings() {
  const { data, reload } = useSpace();
  const toast = useToast();
  const [confirm, setConfirm] = useState(null);
  const now = new Date();
  // Rooms, the hall and desk passes together, by date.
  const items = [
    ...data.bookings.map((b) => ({ kind: 'booking', b, at: new Date(b.start), done: b.status === 'CANCELLED' || new Date(b.end) < now })),
    ...data.passes.map((p) => ({ kind: 'pass', p, at: new Date(p.validFrom), done: ['CANCELLED', 'EXPIRED'].includes(p.status) || new Date(p.validUntil) < now }))
  ];
  const upcoming = items.filter((x) => !x.done).sort((a, b) => a.at - b.at);
  const past = items.filter((x) => x.done).sort((a, b) => b.at - a.at);
  const [passCancel, setPassCancel] = useState(null);
  const cancelPass = async () => {
    try {
      await api(`/space/payments/${passCancel.payment.id}/cancel`, { method: 'POST' });
      toast('Pass cancelled.');
      setPassCancel(null);
      reload();
    } catch (e) {
      toast(e.message, true);
    }
  };
  const row = (x, isPast) => (x.kind === 'pass'
    ? <PassRow key={x.p.id} p={x.p} past={isPast} onCancel={isPast ? null : setPassCancel} />
    : <BookingRow key={x.b.id} b={x.b} past={isPast} onCancel={isPast ? null : setConfirm} />);
  const cancel = async () => {
    try {
      const r = await api(`/space/bookings/${confirm.id}/cancel`, { method: 'POST' });
      toast(r.refundDue ? 'Cancelled. We’ll contact you about your refund.' : 'Booking cancelled.');
      setConfirm(null);
      reload();
    } catch (e) {
      toast(e.message, true);
    }
  };
  return (
    <div className="pg">
      <div className="pg-h">
        <div><p className="eyebrow">Desk passes, meeting room and hall</p><h1>Bookings</h1><p className="desc">Everything you’ve booked. Rooms and the hall can be cancelled free up to 48 hours before. Show your code at the front desk on the day.</p></div>
        <Link className="btn blue" to="/dashboard/book"><Icon name="calendar" />Book a space</Link>
      </div>
      <div className="panel"><div className="panel-h"><h2>Upcoming</h2></div>
        {upcoming.length ? upcoming.map((x) => row(x, false)) : <Empty icon="calendar">Nothing booked yet.</Empty>}
      </div>
      <div className="panel"><div className="panel-h"><h2>Past and cancelled</h2></div>
        {past.length ? past.map((x) => row(x, true)) : <Empty icon="clock">Nothing here yet.</Empty>}
      </div>
      {passCancel && (
        <Modal title="Cancel this pass?" onClose={() => setPassCancel(null)}>
          <p style={{ marginTop: 10, color: 'var(--ink-2)' }}>{passCancel.pass.label}, from {fmtDay(passCancel.pass.validFrom)}. It isn’t paid yet, so you won’t owe anything.</p>
          <div className="sheet-foot"><button className="btn ghost" onClick={() => setPassCancel(null)}>Keep it</button><button className="btn ink" onClick={cancelPass}>Cancel pass</button></div>
        </Modal>
      )}
      {confirm && (
        <Modal title="Cancel this booking?" onClose={() => setConfirm(null)}>
          <p style={{ marginTop: 10, color: 'var(--ink-2)' }}>{confirm.room}, {fmtDay(confirm.start)} {fmtTime(confirm.start)}–{fmtTime(confirm.end)}. Paid bookings can only be cancelled up to 48 hours before.</p>
          <div className="sheet-foot"><button className="btn ghost" onClick={() => setConfirm(null)}>Keep it</button><button className="btn ink" onClick={cancel}>Cancel booking</button></div>
        </Modal>
      )}
    </div>
  );
}
