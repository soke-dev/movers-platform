import { useState } from 'react';
import { Modal, PayFlow, QR, Receipt, PayChip, Table, Empty, naira, fmtDate, METHOD, ADDRESS } from '@movers/ui';
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
                <td><PayChip status={p.status} /></td>
                <td>
                  {p.status === 'PAID' && <button className="linkbtn" onClick={() => setModal({ receipt: p })}>Receipt</button>}
                  {p.status === 'UNPAID' && <button className="btn blue sm" onClick={() => setModal({ pay: p })}>Pay now</button>}
                  {p.status === 'PENDING' && p.method === 'OFFICE' && <button className="linkbtn" onClick={() => setModal({ code: p })}>Show code</button>}
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
      {modal?.code && (
        <Modal title="Payment code" onClose={() => setModal(null)}>
          <div className="done" style={{ marginTop: 12 }}><span className="paycode">{modal.code.reference}</span><QR value={modal.code.reference} /><p>Show this at the front desk, {ADDRESS}. Cash or POS, Mon–Sat 9:00–18:00.</p></div>
        </Modal>
      )}
    </div>
  );
}
