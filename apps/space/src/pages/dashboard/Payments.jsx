import { useState } from 'react';
import { api, useToast, Modal, PayFlow, QR, Receipt, PayChip, Table, Empty, naira, fmtDate, METHOD, ADDRESS } from '@movers/ui';
import { useSpace } from './Dashboard.jsx';

export default function Payments() {
  const { data, reload } = useSpace();
  const [modal, setModal] = useState(null);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const paidMonth = data.payments.filter((p) => p.status === 'PAID' && new Date(p.paidAt) >= monthStart).reduce((s, p) => s + p.amount, 0);
  const due = data.payments.filter((p) => p.status === 'UNPAID').reduce((s, p) => s + p.amount, 0);
  const pending = data.payments.filter((p) => p.status === 'PENDING').reduce((s, p) => s + p.amount, 0);
  return (
    <div className="pg">
      <div className="pg-h"><div><p className="eyebrow">Movers Space</p><h1>Payments</h1><p className="desc">Pay online through Money Moves, on WhatsApp, or at the front desk. WhatsApp and office payments show as paid once our team confirms them.</p></div></div>
      <div className="stats">
        <div className="card"><span className="k">Paid this month</span><div className="big" style={{ color: 'var(--ok)' }}>{naira(paidMonth)}</div><p className="sub">Receipts below</p></div>
        <div className="card"><span className="k">To pay</span><div className="big" style={{ color: due ? 'var(--due)' : 'var(--ink)' }}>{naira(due)}</div><p className="sub">{due ? 'Unpaid bookings and passes' : 'Nothing due'}</p></div>
        <div className="card"><span className="k">Being confirmed</span><div className="big">{naira(pending)}</div><p className="sub">WhatsApp and office</p></div>
        <div className="card"><span className="k">Payments</span><div className="big">{data.payments.length}</div><p className="sub">All time</p></div>
      </div>
      <div className="panel">
        <div className="panel-h"><h2>History</h2></div>
        {data.payments.length ? (
          <Table head={['Item', 'Date', 'Paid via', 'Amount', 'Status', '']}>
            {data.payments.map((p) => (
              <tr key={p.id}>
                <td>{p.description}</td>
                <td>{fmtDate(p.paidAt || p.dueDate || p.createdAt)}</td>
                <td>{METHOD[p.method] || '—'}</td>
                <td className="amt">{naira(p.amount)}</td>
                <td><PayChip status={p.status} />{p.refunded > 0 && <div className="small">Refunded {naira(p.refunded)}</div>}</td>
                <td>
                  {p.status === 'PAID' && <button className="linkbtn" onClick={() => setModal({ receipt: p })}>Receipt</button>}
                  <span className="row" style={{ gap: 10 }}>
                    {p.status === 'UNPAID' && <button className="btn blue sm" onClick={() => setModal({ pay: p })}>Pay now</button>}
                    {p.status === 'PENDING' && p.method === 'OFFICE' && <button className="linkbtn" onClick={() => setModal({ code: p })}>Show code</button>}
                    {(p.status === 'UNPAID' || p.status === 'PENDING') && <button className="linkbtn" onClick={() => setModal({ cancel: p })}>Cancel</button>}
                  </span>
                </td>
              </tr>
            ))}
          </Table>
        ) : <Empty>No payments yet.</Empty>}
      </div>
      {modal?.pay && (
        <Modal title="Pay now" onClose={() => setModal(null)}>
          <PayFlow payment={modal.pay} lines={[[modal.pay.description, modal.pay.amount]]} finishLabel="Back to payments" onFinish={() => { setModal(null); reload(); }} />
        </Modal>
      )}
      {modal?.receipt && <Modal title="Receipt" onClose={() => setModal(null)}><Receipt p={modal.receipt} /></Modal>}
      {modal?.cancel && <CancelModal payment={modal.cancel} onClose={() => setModal(null)} onDone={reload} />}
      {modal?.code && (
        <Modal title="Payment code" onClose={() => setModal(null)}>
          <div className="done" style={{ marginTop: 12 }}><span className="paycode">{modal.code.reference}</span><QR value={modal.code.reference} /><p>Show this at the front desk, {ADDRESS}. Cash, POS or bank transfer, Mon–Sat 9:00–18:00.</p></div>
        </Modal>
      )}
    </div>
  );
}

/**
 * Unpaid: cancels the pass or booking with it. Being confirmed (WhatsApp or office): back to unpaid,
 * so they can pay another way or cancel it.
 */
function CancelModal({ payment, onClose, onDone }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pending = payment.status === 'PENDING';
  const go = async () => {
    setBusy(true);
    setErr('');
    try {
      await api(pending ? `/payments/${payment.id}/cancel` : `/space/payments/${payment.id}/cancel`, { method: 'POST' });
      toast(pending ? 'Cancelled. It’s back to unpaid, so you can pay another way or cancel it.' : 'Cancelled.');
      onDone?.();
      onClose();
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };
  return (
    <Modal title={pending ? 'Cancel this payment?' : 'Cancel this order?'} onClose={onClose}>
      <p className="small" style={{ marginTop: 8 }}>{payment.description} · {naira(payment.amount)} · {payment.reference}</p>
      <p style={{ marginTop: 10, color: 'var(--ink-2)' }}>
        {pending
          ? 'It goes back to “not paid” so you can choose another way to pay, or cancel the order. If you’ve already sent the money, don’t cancel: call or WhatsApp us and we’ll confirm it.'
          : payment.purpose === 'PASS' ? 'The pass is cancelled and you won’t owe anything for it.' : 'The booking is cancelled, the time is freed for others, and you won’t owe anything for it.'}
      </p>
      {err && <p className="err" style={{ marginTop: 10 }}>{err}</p>}
      <div className="sheet-foot"><button className="btn ghost" onClick={onClose}>Keep it</button><button className="btn ink" disabled={busy} onClick={go}>{busy ? 'Cancelling…' : pending ? 'Cancel payment' : 'Cancel order'}</button></div>
    </Modal>
  );
}
