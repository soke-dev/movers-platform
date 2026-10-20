import { useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { api, useApi, useAuth, useToast, Icon, Modal, Table, Empty, Loading, ErrorBox, Chip, PayChip, naira, fmtDate, fmtTime, METHOD } from '@movers/ui';
import { PageHead, UserSearch, waTo } from '../shared.jsx';

const TABS = [['PENDING', 'Waiting to confirm'], ['UNPAID', 'Not paid yet'], ['PAID', 'Paid'], ['CANCELLED', 'Cancelled'], ['REFUNDS', 'Refunds']];

export default function Payments() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || 'PENDING';
  const [q, setQ] = useState('');
  const { data, error, loading, reload } = useApi(status === 'REFUNDS' ? null : `/admin/payments?status=${status}&q=${encodeURIComponent(q)}`);
  const { refreshCounts } = useOutletContext();
  const { user } = useAuth();
  const toast = useToast();
  const [record, setRecord] = useState(false);
  const [refund, setRefund] = useState(null);
  const [busy, setBusy] = useState('');

  const act = async (p, action) => {
    setBusy(p.id);
    try {
      await api(`/admin/payments/${p.id}/${action}`, { method: 'POST' });
      toast(action === 'confirm' ? `Confirmed ${naira(p.amount)} from ${p.user.name}.` : action === 'reject' ? `Marked not received. Let ${p.user.name} know.` : 'Cancelled.');
      reload();
      refreshCounts();
    } catch (e) {
      toast(e.message, true);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="pg">
      <PageHead eyebrow="Learn and Space" title="Payments" desc="Confirm WhatsApp transfers and office payments here. The person sees “Paid” as soon as you confirm. Online payments through Money Moves confirm themselves.">
        <button className="btn ink" onClick={() => setRecord(true)}><Icon name="plus" />Record a payment</button>
      </PageHead>
      <div className="toolbar">
        <div className="tabs" role="tablist">{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={status === k} onClick={() => setParams({ status: k })}>{l}</button>)}</div>
        {status !== 'REFUNDS' && <label className="search"><Icon name="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, reference or item" aria-label="Search payments" /></label>}
      </div>
      {status === 'REFUNDS' ? <Refunds /> : <div className="panel">
        {loading ? <Loading /> : error ? <ErrorBox error={error} retry={reload} /> : data.payments.length ? (
          <Table head={['Person', 'Item', 'Reference', 'Via', 'Amount', 'Status', '']}>
            {data.payments.map((p) => (
              <tr key={p.id}>
                <td><b>{p.user.name}</b><div className="small">{p.user.phone || p.user.email}</div></td>
                <td>{p.description}{p.dueDate && p.status === 'UNPAID' ? <div className="small">Due {fmtDate(p.dueDate)}</div> : null}</td>
                <td className="tm">{p.reference}</td>
                <td>{METHOD[p.method] || '—'}</td>
                <td className="amt">{naira(p.amount)}</td>
                <td><PayChip status={p.status} />{p.refunded > 0 && <div className="small">Refunded {naira(p.refunded)}</div>}{p.refundDue && <div className="small err">Booking cancelled · refund due</div>}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {(p.status === 'PENDING' || p.status === 'UNPAID') && <button className="btn ink sm" disabled={busy === p.id} onClick={() => act(p, 'confirm')}>{p.method === 'OFFICE' || p.status === 'UNPAID' ? 'Mark paid' : 'Confirm received'}</button>}{' '}
                  {p.status === 'PENDING' && <button className="btn soft sm" disabled={busy === p.id} onClick={() => act(p, 'reject')}>Not received</button>}{' '}
                  {p.status === 'UNPAID' && p.user.phone && <a className="linkbtn" target="_blank" rel="noreferrer" href={waTo(p.user.phone, `Hello ${p.user.name.split(' ')[0]}, a reminder from Movers: ${naira(p.amount)} for ${p.description} is still unpaid (ref ${p.reference}). You can pay online from your dashboard, on WhatsApp, or at the office.`)}>Remind</a>}
                  {p.status === 'PAID' && <span className="small">{fmtDate(p.paidAt)}</span>}{' '}
                  {p.status === 'PAID' && user?.role === 'ADMIN' && p.refundable > 0 && !p.refundWaiting && <button className="linkbtn" onClick={() => setRefund(p)}>Refund</button>}
                </td>
              </tr>
            ))}
          </Table>
        ) : <Empty>{status === 'PENDING' ? 'Nothing waiting. Every WhatsApp and office payment is confirmed.' : 'Nothing here.'}</Empty>}
      </div>}
      {record && <RecordModal onClose={() => setRecord(false)} onDone={() => { reload(); refreshCounts(); }} />}
      {refund && <RefundModal p={refund} onClose={() => setRefund(null)} onDone={() => { reload(); refreshCounts(); }} />}
    </div>
  );
}

function RecordModal({ onClose, onDone }) {
  const toast = useToast();
  const [who, setWho] = useState(null);
  const [f, setF] = useState({ description: '', amount: '', method: 'OFFICE' });
  const [err, setErr] = useState('');
  const open = useApi(who ? `/admin/payments?status=UNPAID&q=${encodeURIComponent(who.name)}` : null);
  const pending = useApi(who ? `/admin/payments?status=PENDING&q=${encodeURIComponent(who.name)}` : null);
  const owed = [...(open.data?.payments || []), ...(pending.data?.payments || [])].filter((p) => p.user.id === who?.id);

  const markExisting = async (p) => {
    try {
      await api(`/admin/payments/${p.id}/confirm`, { method: 'POST' });
      toast(`Recorded ${naira(p.amount)} from ${who.name}.`);
      onDone();
      onClose();
    } catch (e) {
      setErr(e.message);
    }
  };
  const save = async (e) => {
    e.preventDefault();
    try {
      await api('/admin/payments/record', { method: 'POST', body: { userId: who.id, description: f.description, amount: Number(f.amount), method: f.method } });
      toast(`Recorded ${naira(f.amount)} from ${who.name}.`);
      onDone();
      onClose();
    } catch (x) {
      setErr(x.message);
    }
  };
  return (
    <Modal title="Record a payment" onClose={onClose} wide>
      <p className="small" style={{ marginTop: 6 }}>For cash or POS at the front desk, or a transfer you’ve checked yourself.</p>
      <div style={{ marginTop: 14 }}>
        {!who ? <UserSearch onPick={setWho} /> : (
          <>
            <div className="row" style={{ justifyContent: 'space-between' }}><b>{who.name} · {who.phone}</b><button className="linkbtn" onClick={() => setWho(null)}>Change person</button></div>
            {owed.length > 0 && (
              <>
                <p className="lbl-s">What they owe</p>
                <ul className="list" style={{ marginTop: 8 }}>
                  {owed.map((p) => <li key={p.id}><span className="ib"><Icon name="wallet" /></span><div><div className="t">{p.description}</div><div className="d">{naira(p.amount)} · {p.reference}</div></div><button className="btn ink sm" onClick={() => markExisting(p)}>Mark paid</button></li>)}
                </ul>
              </>
            )}
            <p className="lbl-s">Or record something else</p>
            <form onSubmit={save}>
              <div className="fields" style={{ marginTop: 8 }}>
                <div className="field wide"><label htmlFor="r-d">What for</label><input id="r-d" required value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="e.g. Day pass, printing" /></div>
                <div className="field"><label htmlFor="r-a">Amount (₦)</label><input id="r-a" type="number" min="1" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
                <div className="field"><label htmlFor="r-m">Paid via</label><select id="r-m" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}><option value="OFFICE">At the office (cash/POS)</option><option value="WHATSAPP">Transfer (WhatsApp)</option></select></div>
              </div>
              {err && <p className="err" style={{ marginTop: 10 }}>{err}</p>}
              <div className="sheet-foot"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn ink">Record payment</button></div>
            </form>
          </>
        )}
      </div>
    </Modal>
  );
}

const REFUND_ST = { AWAITING_FUNDS: ['due', 'Waiting for your transfer'], PROCESSING: ['wait', 'On its way'], COMPLETED: ['ok', 'Refunded'], CANCELLED: ['lock', 'Cancelled'] };

/** Where to send the money so Money Moves can refund the customer. */
function Funding({ f }) {
  if (!f) return <p className="small" style={{ marginTop: 10 }}>Money Moves is refunding this from money it’s still holding. Nothing to transfer.</p>;
  return (
    <div className="receipt" style={{ marginTop: 10 }}>
      <div><span>Transfer exactly</span><b>{naira(f.amount)}</b></div>
      <div><span>Bank</span><span>{f.bank}</span></div>
      <div><span>Account number</span><b className="tm">{f.accountNumber}</b></div>
      <div><span>Account name</span><span>{f.accountName}</span></div>
      {f.expiresAt && <div><span>Use it before</span><span>{fmtDate(f.expiresAt)}, {fmtTime(f.expiresAt)}</span></div>}
    </div>
  );
}

function RefundModal({ p, onClose, onDone }) {
  const toast = useToast();
  const [f, setF] = useState({ amount: String(p.refundable), reason: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState(null);
  const save = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const amount = Number(f.amount);
      const { refund } = await api(`/admin/payments/${p.id}/refund`, { method: 'POST', body: { amount: amount === p.refundable ? undefined : amount, reason: f.reason } });
      onDone();
      if (refund.status === 'AWAITING_FUNDS') setMade(refund);
      else {
        toast(refund.viaMoneyMoves ? `Refund of ${naira(refund.amount)} is on its way to ${p.user.name}.` : `Recorded a refund of ${naira(refund.amount)} to ${p.user.name}.`);
        onClose();
      }
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  };
  if (made) {
    return (
      <Modal title="Fund the refund" onClose={onClose}>
        <p className="small" style={{ marginTop: 6 }}>Send this from the business bank account. Once it arrives, Money Moves pays {p.user.name} back the way they paid and they get an email. Money Moves returns its fee, so you send a little less than the refund.</p>
        <Funding f={made.funding} />
        <p className="small" style={{ marginTop: 10 }}>You’ll find it later under Payments → Refunds.</p>
        <div className="sheet-foot"><button className="btn ink" onClick={onClose}>Done</button></div>
      </Modal>
    );
  }
  return (
    <Modal title={`Refund ${p.user.name}`} onClose={onClose}>
      <p className="small" style={{ marginTop: 6 }}>{p.description} · {p.reference} · paid {naira(p.amount)}{p.refunded > 0 ? `, ${naira(p.refunded)} already refunded` : ''}</p>
      <p className="small" style={{ marginTop: 8 }}>
        {p.refundViaMoneyMoves
          ? 'This was paid online, so Money Moves sends the money back the way they paid. You’ll get an account to transfer the amount into first.'
          : 'This wasn’t paid through Money Moves. Pay them back yourself (cash or transfer), then record it here. They get an email.'}
      </p>
      <form onSubmit={save}>
        <div className="fields" style={{ marginTop: 12 }}>
          <div className="field"><label htmlFor="rf-a">Amount (₦)</label><input id="rf-a" type="number" min="1" max={p.refundable} required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
          <div className="field wide"><label htmlFor="rf-r">Reason (optional)</label><input id="rf-r" maxLength={280} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="e.g. Booking cancelled" /></div>
        </div>
        {err && <p className="err" style={{ marginTop: 10 }}>{err}</p>}
        <div className="sheet-foot"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn ink" disabled={busy}>{p.refundViaMoneyMoves ? 'Start refund' : 'Record refund'}</button></div>
      </form>
    </Modal>
  );
}

function Refunds() {
  const { data, error, loading, reload } = useApi('/admin/refunds');
  const { user } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState('');
  const act = async (x, action) => {
    setBusy(x.id);
    try {
      const { refund } = await api(`/admin/refunds/${x.id}/${action}`, { method: 'POST' });
      toast(action === 'cancel' ? 'Refund cancelled.' : refund.status === x.status ? 'No change yet. Money Moves hasn’t seen the transfer.' : `Now: ${REFUND_ST[refund.status][1]}.`);
      reload();
    } catch (e) {
      toast(e.message, true);
    } finally {
      setBusy('');
    }
  };
  if (loading) return <div className="panel"><Loading /></div>;
  if (error) return <div className="panel"><ErrorBox error={error} retry={reload} /></div>;
  return (
    <div className="panel">
      {data.refunds.length ? (
        <Table head={['Person', 'Item', 'Refund', 'How', 'Status', '']}>
          {data.refunds.map((x) => (
            <tr key={x.id}>
              <td><b>{x.payment.user.name}</b><div className="small">{x.payment.user.phone || x.payment.user.email}</div></td>
              <td>{x.payment.description}<div className="small">{x.payment.reference}{x.reason ? ` · ${x.reason}` : ''}</div></td>
              <td className="amt">{naira(x.amount)}<div className="small">{fmtDate(x.createdAt)}</div></td>
              <td>{x.viaMoneyMoves ? 'Money Moves' : 'Paid back by staff'}</td>
              <td><Chip kind={REFUND_ST[x.status][0]}>{REFUND_ST[x.status][1]}</Chip></td>
              <td style={{ whiteSpace: 'nowrap' }}>
                {x.status === 'AWAITING_FUNDS' && <button className="btn ink sm" onClick={() => setOpen(x)}>Transfer details</button>}{' '}
                {x.viaMoneyMoves && (x.status === 'AWAITING_FUNDS' || x.status === 'PROCESSING') && <button className="btn soft sm" disabled={busy === x.id} onClick={() => act(x, 'check')}>Check now</button>}{' '}
                {x.status === 'AWAITING_FUNDS' && user?.role === 'ADMIN' && <button className="linkbtn" disabled={busy === x.id} onClick={() => act(x, 'cancel')}>Cancel</button>}
              </td>
            </tr>
          ))}
        </Table>
      ) : <Empty>No refunds yet. Refund a payment from the Paid tab.</Empty>}
      {open && (
        <Modal title="Fund the refund" onClose={() => setOpen(null)}>
          <p className="small" style={{ marginTop: 6 }}>{naira(open.amount)} to {open.payment.user.name}. Send this from the business bank account; Money Moves pays them once it arrives.</p>
          <Funding f={open.funding} />
          <div className="sheet-foot"><button className="btn ink" onClick={() => setOpen(null)}>Done</button></div>
        </Modal>
      )}
    </div>
  );
}
