import { useState } from 'react';
import { Icon, Modal, QR, Receipt, PayChip, Table, Empty, naira, fmtDate, METHOD, ADDRESS, PHONE_DISPLAY } from '@movers/ui';
import { useLearn } from './Dashboard.jsx';
import { PayModal, CancelPayModal } from './modals.jsx';
import { NotEnrolled } from './Course.jsx';
import { planChange } from './derive.js';
import Apply from '../Apply.jsx';

export default function Payments() {
  const { data, d, reload } = useLearn();
  const [modal, setModal] = useState(null);
  if (!data.enrollment) return <NotEnrolled />;
  const e = data.enrollment;
  const payments = e.payments;
  const paid = d.paid.reduce((s, p) => s + p.amount, 0);
  const owed = d.owing.reduce((s, p) => s + p.amount, 0);
  const change = planChange(payments, data.cohort.startDate);
  return (
    <div className="pg">
      <div className="pg-h"><div><p className="eyebrow">{data.cohort.code} · {e.kind === 'FULL' ? (e.plan === 'TWO' ? 'Two payments' : 'Paid in one go') : 'Single skills'}</p><h1>Payments</h1><p className="desc">Pay online through Money Moves, on WhatsApp, or in person at the office. Every payment gets a receipt here.</p></div>
        {change.can && <button className="btn line" onClick={() => setModal({ plan: true })}>Change plan or skills</button>}
      </div>
      <div className="stats">
        <div className="card"><span className="k">Total</span><div className="big">{naira(e.total)}</div><p className="sub">{e.kind === 'FULL' ? 'Full class' : `${e.skills.length} skill${e.skills.length > 1 ? 's' : ''}`}</p></div>
        <div className="card"><span className="k">Paid</span><div className="big" style={{ color: 'var(--ok)' }}>{naira(paid)}</div><p className="sub">{d.paid.length} payment{d.paid.length === 1 ? '' : 's'}</p></div>
        <div className="card"><span className="k">Outstanding</span><div className="big" style={{ color: owed ? 'var(--due)' : 'var(--ink)' }}>{naira(owed)}</div><p className="sub">{owed ? 'Pay any time before it’s due' : 'Nothing to pay'}</p></div>
        <div className="card"><span className="k">Seat</span><div className="big" style={{ fontSize: 22 }}>{d.secured ? 'Secured' : 'Not yet'}</div><p className="sub">{d.secured ? 'Your place is held' : 'Secured once you pay'}</p></div>
      </div>
      <div className="panel">
        <div className="panel-h"><h2>Your payments</h2></div>
        {payments.length ? (
          <Table head={['Item', 'Due', 'Paid via', 'Amount', 'Status', '']}>
            {payments.map((p) => (
              <tr key={p.id}>
                <td>{p.description}</td>
                <td>{p.status === 'PAID' ? fmtDate(p.paidAt) : p.dueDate ? fmtDate(p.dueDate) : '—'}</td>
                <td>{METHOD[p.method] || '—'}</td>
                <td className="amt">{naira(p.amount)}</td>
                <td><PayChip status={p.status} />{p.refunded > 0 && <div className="small">Refunded {naira(p.refunded)}</div>}</td>
                <td>
                  {p.status === 'PAID' && <button className="linkbtn" onClick={() => setModal({ receipt: p })}>Receipt</button>}
                  {p.status === 'UNPAID' && <button className="btn pink sm" onClick={() => setModal({ pay: p })}>Pay now</button>}
                  {p.status === 'PENDING' && p.method === 'OFFICE' && <button className="linkbtn" onClick={() => setModal({ code: p })}>Show code</button>}{' '}
                  {p.status === 'PENDING' && <button className="linkbtn" onClick={() => setModal({ cancel: p })}>Cancel</button>}
                </td>
              </tr>
            ))}
          </Table>
        ) : <Empty>No payments yet.</Empty>}
      </div>
      <div className="panel">
        <div className="panel-h"><h2>Ways to pay</h2></div>
        <ul className="list">
          <li><span className="ib" style={{ background: 'var(--violet)', color: '#fff' }}><Icon name="card" /></span><div><div className="t">Online with Money Moves</div><div className="d">Bank transfer, the Money Moves app or stablecoin. Confirmed automatically.</div></div><span /></li>
          <li><span className="ib" style={{ background: 'var(--wa)', color: '#fff' }}><Icon name="chat" /></span><div><div className="t">WhatsApp</div><div className="d">{PHONE_DISPLAY}. Confirmed within 1 working hour.</div></div><span /></li>
          <li><span className="ib" style={{ background: 'var(--amber)' }}><Icon name="store" /></span><div><div className="t">At the office</div><div className="d">Cash, POS or bank transfer at {ADDRESS}, Mon–Sat 9:00–18:00.</div></div><span /></li>
        </ul>
      </div>
      {modal?.pay && <PayModal payment={modal.pay} onClose={() => setModal(null)} onDone={reload} />}
      {modal?.cancel && <CancelPayModal payment={modal.cancel} onClose={() => setModal(null)} onDone={reload} />}
      {modal?.plan && <Apply current={e} onClose={() => setModal(null)} onSaved={reload} />}
      {modal?.receipt && <Modal title="Receipt" onClose={() => setModal(null)}><Receipt p={modal.receipt} /></Modal>}
      {modal?.code && (
        <Modal title="Payment code" onClose={() => setModal(null)}>
          <div className="done" style={{ marginTop: 12 }}>
            <span className="paycode">{modal.code.reference}</span>
            <QR value={modal.code.reference} />
            <p>Show this at the front desk, {ADDRESS}. Cash, POS or bank transfer, Mon–Sat 9:00–18:00.</p>
          </div>
        </Modal>
      )}
    </div>
  );
}
