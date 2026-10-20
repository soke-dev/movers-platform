import { useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { api, useApi, useToast, Icon, Modal, Table, Empty, Loading, ErrorBox, PayChip, naira, fmtDate, METHOD } from '@movers/ui';
import { PageHead, UserSearch, waTo } from '../shared.jsx';

const TABS = [['PENDING', 'Waiting to confirm'], ['UNPAID', 'Not paid yet'], ['PAID', 'Paid'], ['CANCELLED', 'Cancelled']];

export default function Payments() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || 'PENDING';
  const [q, setQ] = useState('');
  const { data, error, loading, reload } = useApi(`/admin/payments?status=${status}&q=${encodeURIComponent(q)}`);
  const { refreshCounts } = useOutletContext();
  const toast = useToast();
  const [record, setRecord] = useState(false);
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
        <label className="search"><Icon name="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, reference or item" aria-label="Search payments" /></label>
      </div>
      <div className="panel">
        {loading ? <Loading /> : error ? <ErrorBox error={error} retry={reload} /> : data.payments.length ? (
          <Table head={['Person', 'Item', 'Reference', 'Via', 'Amount', 'Status', '']}>
            {data.payments.map((p) => (
              <tr key={p.id}>
                <td><b>{p.user.name}</b><div className="small">{p.user.phone || p.user.email}</div></td>
                <td>{p.description}{p.dueDate && p.status === 'UNPAID' ? <div className="small">Due {fmtDate(p.dueDate)}</div> : null}</td>
                <td className="tm">{p.reference}</td>
                <td>{METHOD[p.method] || '—'}</td>
                <td className="amt">{naira(p.amount)}</td>
                <td><PayChip status={p.status} /></td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {(p.status === 'PENDING' || p.status === 'UNPAID') && <button className="btn ink sm" disabled={busy === p.id} onClick={() => act(p, 'confirm')}>{p.method === 'OFFICE' || p.status === 'UNPAID' ? 'Mark paid' : 'Confirm received'}</button>}{' '}
                  {p.status === 'PENDING' && <button className="btn soft sm" disabled={busy === p.id} onClick={() => act(p, 'reject')}>Not received</button>}{' '}
                  {p.status === 'UNPAID' && p.user.phone && <a className="linkbtn" target="_blank" rel="noreferrer" href={waTo(p.user.phone, `Hello ${p.user.name.split(' ')[0]}, a reminder from Movers: ${naira(p.amount)} for ${p.description} is still unpaid (ref ${p.reference}). You can pay online from your dashboard, on WhatsApp, or at the office.`)}>Remind</a>}
                  {p.status === 'PAID' && <span className="small">{fmtDate(p.paidAt)}</span>}
                </td>
              </tr>
            ))}
          </Table>
        ) : <Empty>{status === 'PENDING' ? 'Nothing waiting. Every WhatsApp and office payment is confirmed.' : 'Nothing here.'}</Empty>}
      </div>
      {record && <RecordModal onClose={() => setRecord(false)} onDone={() => { reload(); refreshCounts(); }} />}
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
