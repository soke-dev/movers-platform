import { useState } from 'react';
import { api } from './api.js';
import { naira } from './format.js';
import { Icon } from './Icon.jsx';
import { QR } from './QR.jsx';
import { PHONE_DISPLAY, ADDRESS } from './config.js';

const MODES = [
  { id: 'ONLINE', icon: 'card', bg: 'var(--violet)', name: 'Pay online', desc: 'Bank transfer, the Money Moves app or stablecoin, through Money Moves. Confirmed automatically.' },
  { id: 'WHATSAPP', icon: 'chat', bg: 'var(--wa)', name: 'Pay on WhatsApp', desc: 'Chat with our accounts team. They send bank details and confirm your proof, usually within 1 working hour.' },
  { id: 'OFFICE', icon: 'store', bg: 'var(--amber)', name: 'Pay at the office', desc: `Cash, POS or bank transfer at ${ADDRESS}. Mon–Sat, 9:00–18:00.` }
];

/**
 * Lets someone pay an existing payment online, on WhatsApp, at the office, or later.
 * `onFinish` runs when they close the result screen.
 */
export function PayFlow({ payment, lines = [], note, allowLater = false, hold = '', returnUrl, onFinish, finishLabel = 'Done', laterText }) {
  const [mode, setMode] = useState('ONLINE');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  async function go(method) {
    setBusy(true);
    setErr('');
    try {
      const r = await api(`/payments/${payment.id}/pay`, { method: 'POST', body: { method, returnUrl: returnUrl || `${window.location.origin}/payments/callback` } });
      if (r.type === 'redirect') {
        window.location.href = r.url;
        return;
      }
      setResult(r);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const finish = <button className="btn ink lg" onClick={() => onFinish?.(result)}>{finishLabel}</button>;
    if (result.type === 'paid') {
      return (
        <div className="done">
          <span className="tick"><Icon name="check" /></span>
          <h3 id="mTitle">Payment received</h3>
          <p>Your receipt is in your email and in Payments.</p>
          <span className="ref">Ref {result.reference}</span>
          {finish}
        </div>
      );
    }
    if (result.type === 'whatsapp') {
      return (
        <div className="done">
          <span className="tick wa"><Icon name="chat" /></span>
          <h3 id="mTitle">Finish on WhatsApp</h3>
          <p>Send this message to our accounts team. They’ll reply with bank details. Send your proof of payment in the same chat.</p>
          <div className="wa-msg">{result.message}</div>
          <div className="row">
            <a className="btn wa" href={result.url} target="_blank" rel="noopener noreferrer"><Icon name="chat" />Open WhatsApp</a>
            <button className="btn soft" onClick={() => navigator.clipboard?.writeText(result.message).then(() => setCopied(true)).catch(() => {})}>{copied ? 'Copied' : 'Copy message'}</button>
          </div>
          <p className="fine">No WhatsApp on this device? Text {PHONE_DISPLAY} with the same message. This shows as “Being confirmed” until our team checks it.</p>
          {finish}
        </div>
      );
    }
    if (result.type === 'office') {
      return (
        <div className="done">
          <span className="tick office"><Icon name="store" /></span>
          <h3 id="mTitle">Your payment code</h3>
          <span className="paycode">{result.reference}</span>
          <QR value={result.reference} />
          <p>Show this at the front desk, {ADDRESS}. Cash, POS or bank transfer, Mon–Sat 9:00–18:00. {hold}</p>
          <p className="fine">The code is saved in your Payments page.</p>
          {finish}
        </div>
      );
    }
    return (
      <div className="done">
        <span className="tick office"><Icon name="clock" /></span>
        <h3 id="mTitle">Saved. Pay later</h3>
        <p>{laterText || 'You can pay any time from your dashboard.'}</p>
        <span className="ref">Ref {result.reference}</span>
        {finish}
      </div>
    );
  }

  const label = mode === 'ONLINE' ? `Pay ${naira(payment.amount)}` : mode === 'WHATSAPP' ? 'Continue on WhatsApp' : 'Get my payment code';
  return (
    <div>
      <ul className="lines" style={{ marginTop: 18 }}>
        {lines.map(([a, b, cls], i) => (
          <li key={i} className={cls || ''}><span>{a}</span><span>{typeof b === 'number' ? naira(b) : b}</span></li>
        ))}
        <li className="tot"><span>To pay</span><span>{naira(payment.amount)}</span></li>
      </ul>
      {note && <div className="note" style={{ marginTop: 14 }}><Icon name="laptop" /><span>{note}</span></div>}
      <p className="lbl-s">How would you like to pay?</p>
      <div className="paymodes" role="radiogroup">
        {MODES.map((m) => (
          <label className="pmode" key={m.id}>
            <input type="radio" name="pmode" value={m.id} checked={mode === m.id} onChange={() => setMode(m.id)} />
            <span className="pm-ico" style={{ background: m.bg, color: m.id === 'OFFICE' ? 'var(--ink)' : '#fff' }}><Icon name={m.icon} /></span>
            <span className="pm-t"><b>{m.name}</b><span>{m.desc}</span></span>
            <span className="radio" />
          </label>
        ))}
      </div>
      {err && <p className="err" style={{ marginTop: 12 }}>{err}</p>}
      <button className="btn pink full lg" style={{ marginTop: 18 }} disabled={busy} onClick={() => go(mode)}>{busy ? 'Please wait…' : label}</button>
      {allowLater && <button className="btn ghost full" style={{ marginTop: 6 }} disabled={busy} onClick={() => go('LATER')}>Skip for now, pay later</button>}
      <p className="fine" style={{ marginTop: 12 }}>
        {mode === 'ONLINE' ? 'You’ll go to a secure Money Moves page, then come back here.' : mode === 'WHATSAPP' ? 'Shows as “Being confirmed” until our team checks your proof of payment.' : `Shows as “Being confirmed” until we receive it. ${hold}`}
      </p>
    </div>
  );
}
