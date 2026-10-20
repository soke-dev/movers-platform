import { useEffect, useRef, useState } from 'react';
import { api, useToast, Icon, fmtTime, isoDate } from '@movers/ui';
import { PageHead } from '../shared.jsx';
import { Scanner, CodeInput } from '../Scanner.jsx';

const LOOK = {
  in: { bg: 'var(--green-soft)', fg: 'var(--ok)', icon: 'check' },
  out: { bg: 'var(--blue-mist)', fg: 'var(--blue-deep)', icon: 'clock' },
  already: { bg: 'var(--blue-mist)', fg: 'var(--blue-deep)', icon: 'pin' },
  nopass: { bg: 'var(--pink-soft)', fg: 'var(--wait)', icon: 'wallet' },
  full: { bg: 'var(--pink-soft)', fg: 'var(--due)', icon: 'laptop' },
  unknown: { bg: 'var(--pink-soft)', fg: 'var(--due)', icon: 'qr' }
};

function headline(r) {
  const first = r.user?.name.split(' ')[0];
  switch (r.action) {
    case 'in': return [`Welcome, ${first}`, `Desk ${r.visit.desk} · in at ${fmtTime(r.visit.checkedInAt)}`];
    case 'out': return [`Bye, ${first}`, `Checked out at ${fmtTime(r.visit.checkedOutAt)}`];
    case 'already': return [`${first} is already in`, `Desk ${r.visit.desk}. Scan again after two minutes to check out.`];
    case 'nopass': return [`${r.user.name} has no pass for today`, 'Sell them a day pass, or send them to the front desk.'];
    case 'full': return ['Every desk is taken', `${r.user.name} can wait for a free desk or use a room.`];
    default: return ['Code not recognised', r.message || 'Ask them to open their Movers Space dashboard and show the check-in code.'];
  }
}

/** A tablet or phone at the door: members scan their check-in code on the way in and on the way out. */
export default function Door() {
  const toast = useToast();
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(0);
  const last = useRef({ code: '', at: 0 });
  const clear = useRef(null);

  const show = (r) => {
    setResult({ ...r, at: Date.now() });
    clearTimeout(clear.current);
    // Leave "no pass" up until staff act on it; clear the rest for the next person.
    if (r.action !== 'nopass') clear.current = setTimeout(() => setResult(null), 6000);
  };
  useEffect(() => () => clearTimeout(clear.current), []);

  const handle = async (code) => {
    // The camera sees the same code several times a second.
    if (busy || (code === last.current.code && Date.now() - last.current.at < 5000)) return;
    last.current = { code, at: Date.now() };
    setBusy(true);
    try {
      const r = await api('/admin/space/scan', { method: 'POST', body: { code } });
      if (r.action === 'in') setCount((n) => n + 1);
      show({ ...r, code });
      navigator.vibrate?.(r.action === 'in' || r.action === 'out' ? 80 : [60, 60, 60]);
    } catch (e) {
      show({ action: 'unknown', message: e.message });
    } finally {
      setBusy(false);
    }
  };

  const sellDayPass = async () => {
    try {
      await api('/admin/space/orders', { method: 'POST', body: { userId: result.user.id, paid: true, order: { type: 'desk', pass: 'day', date: isoDate(), people: 1 } } });
      toast('Day pass sold and marked paid.');
      last.current = { code: '', at: 0 };
      handle(result.code);
    } catch (e) {
      toast(e.message, true);
    }
  };

  const look = result && (LOOK[result.action] || LOOK.unknown);
  const [title, sub] = result ? headline(result) : [];
  return (
    <div className="pg">
      <PageHead eyebrow="Movers Space" title="Door scanner" desc="Leave this open on a phone or tablet at the door. Members scan the code on their dashboard on the way in, and again on the way out. A handheld scanner works too: tap the box under the camera first.">
        <span className="chip blue">{count} checked in here</span>
      </PageHead>
      <div className="d-grid">
        <div className="panel">
          <Scanner onCode={handle} paused={busy} />
          <CodeInput onCode={handle} />
        </div>
        <div className="panel" aria-live="polite">
          {result ? (
            <div style={{ background: look.bg, color: look.fg, borderRadius: 16, padding: 24, textAlign: 'center' }}>
              <div style={{ display: 'inline-flex', width: 56, height: 56, borderRadius: 28, background: '#fff', alignItems: 'center', justifyContent: 'center' }}><Icon name={look.icon} /></div>
              <h2 style={{ marginTop: 14, fontSize: 26 }}>{title}</h2>
              <p style={{ marginTop: 6 }}>{sub}</p>
              {result.action === 'nopass' && (
                <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
                  <button className="btn amber" onClick={sellDayPass}>Sell a day pass (paid at desk)</button>
                  <button className="btn ghost" onClick={() => setResult(null)}>Dismiss</button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <div style={{ display: 'inline-flex', width: 56, height: 56, borderRadius: 28, background: 'var(--blue-mist)', color: 'var(--blue-deep)', alignItems: 'center', justifyContent: 'center' }}><Icon name="qr" /></div>
              <h2 style={{ marginTop: 14 }}>Ready to scan</h2>
              <p className="small" style={{ marginTop: 6 }}>Hold the check-in code from the Movers Space dashboard up to the camera.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
