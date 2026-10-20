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

export default function Bookings() {
  const { data, reload } = useSpace();
  const toast = useToast();
  const [confirm, setConfirm] = useState(null);
  const now = new Date();
  const upcoming = data.bookings.filter((b) => b.status !== 'CANCELLED' && new Date(b.end) >= now).sort((a, b) => new Date(a.start) - new Date(b.start));
  const past = data.bookings.filter((b) => b.status === 'CANCELLED' || new Date(b.end) < now);
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
        <div><p className="eyebrow">Rooms and hall</p><h1>Bookings</h1><p className="desc">Free cancellation up to 48 hours before. Show your code at the front desk on the day.</p></div>
        <Link className="btn blue" to="/dashboard/book"><Icon name="calendar" />Book a space</Link>
      </div>
      <div className="panel"><div className="panel-h"><h2>Upcoming</h2></div>
        {upcoming.length ? upcoming.map((b) => <BookingRow key={b.id} b={b} onCancel={setConfirm} />) : <Empty icon="calendar">Nothing booked yet.</Empty>}
      </div>
      <div className="panel"><div className="panel-h"><h2>Past and cancelled</h2></div>
        {past.length ? past.map((b) => <BookingRow key={b.id} b={b} past />) : <Empty icon="clock">Nothing here yet.</Empty>}
      </div>
      {confirm && (
        <Modal title="Cancel this booking?" onClose={() => setConfirm(null)}>
          <p style={{ marginTop: 10, color: 'var(--ink-2)' }}>{confirm.room}, {fmtDay(confirm.start)} {fmtTime(confirm.start)}–{fmtTime(confirm.end)}. Paid bookings can only be cancelled up to 48 hours before.</p>
          <div className="sheet-foot"><button className="btn ghost" onClick={() => setConfirm(null)}>Keep it</button><button className="btn ink" onClick={cancel}>Cancel booking</button></div>
        </Modal>
      )}
    </div>
  );
}
