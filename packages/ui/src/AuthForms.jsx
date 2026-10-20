import { useEffect, useState } from 'react';
import { api } from './api.js';
import { API_URL } from './config.js';
import { useAuth } from './auth.jsx';
import { Icon } from './Icon.jsx';

const here = () => window.location.pathname + window.location.search;
const appUrl = () => window.location.origin;

/** "Continue with Google / Apple". Only shows the ones set up on the server. */
export function SocialButtons({ next }) {
  const [p, setP] = useState({ google: false, apple: false });
  useEffect(() => {
    api('/auth/providers').then(setP).catch(() => {});
  }, []);
  if (!p.google && !p.apple) return null;
  const ret = encodeURIComponent(`${appUrl()}${next || '/dashboard'}`);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
      {p.google && (
        <a className="btn line full" href={`${API_URL}/auth/google?return=${ret}`}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>
          Continue with Google
        </a>
      )}
      {p.apple && (
        <a className="btn ink full" href={`${API_URL}/auth/apple?return=${ret}`}>
          <svg width="16" height="18" viewBox="0 0 814 1000" aria-hidden="true"><path fill="#fff" d="M788 341c-6 4-108 62-108 190 0 148 130 200 134 202-1 3-21 72-69 142-43 62-88 123-156 123s-86-40-164-40c-77 0-104 41-167 41s-106-57-156-128C44 788 0 663 0 544 0 354 124 253 245 253c65 0 118 42 159 42 39 0 100-45 174-45 28 0 129 3 196 99zM554 160c31-37 53-88 53-139 0-7-1-14-2-20-51 2-111 34-147 76-28 32-55 84-55 135 0 8 1 15 2 18 3 1 8 1 13 1 46 0 103-31 136-71z" /></svg>
          Continue with Apple
        </a>
      )}
      <div className="row" style={{ gap: 10, color: 'var(--ink-3)', fontSize: 13, marginTop: 4 }}><span style={{ flex: 1, height: 1, background: 'var(--line)' }} />or with email<span style={{ flex: 1, height: 1, background: 'var(--line)' }} /></div>
    </div>
  );
}

/** Shown after sign-up, and when someone tries to log in before confirming. */
export function CheckEmail({ email, next }) {
  const [state, setState] = useState('');
  const resend = async () => {
    setState('sending');
    await api('/auth/resend-verification', { method: 'POST', body: { email, appUrl: appUrl(), next: next || here() } }).catch(() => {});
    setState('sent');
  };
  return (
    <div className="done" style={{ marginTop: 16 }}>
      <span className="tick office"><Icon name="send" /></span>
      <h3 style={{ padding: 0 }}>Check your email</h3>
      <p>We sent a link to <b>{email}</b>. Tap it to confirm your email, and you’ll be signed in. The link works for 24 hours.</p>
      <p className="small">Can’t find it? Check spam or promotions.</p>
      <button className="btn soft" disabled={state === 'sending'} onClick={resend}>{state === 'sent' ? 'Sent again' : state === 'sending' ? 'Sending…' : 'Send the link again'}</button>
    </div>
  );
}

export function LoginForm({ onDone, switchTo, next }) {
  const { setUser } = useAuth();
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      if (mode === 'forgot') {
        await api('/auth/forgot', { method: 'POST', body: { email: f.email, appUrl: appUrl() } });
        setMode('forgot-sent');
        return;
      }
      const { user } = await api('/auth/login', { method: 'POST', body: f });
      setUser(user);
      onDone?.(user);
    } catch (x) {
      if (x.code === 'EMAIL_NOT_VERIFIED') setMode('verify');
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  };
  if (mode === 'verify') return <CheckEmail email={f.email} next={next} />;
  if (mode === 'forgot-sent') {
    return (
      <div className="done" style={{ marginTop: 16 }}>
        <span className="tick office"><Icon name="send" /></span>
        <h3 style={{ padding: 0 }}>Check your email</h3>
        <p>If there’s a Movers account for <b>{f.email}</b>, we’ve sent a link to choose a new password. It works for 1 hour.</p>
        <button className="btn soft" onClick={() => setMode('login')}>Back to log in</button>
      </div>
    );
  }
  return (
    <form onSubmit={submit}>
      {mode === 'login' && <SocialButtons next={next} />}
      <div className="fields" style={{ marginTop: 16 }}>
        <div className="field wide"><label htmlFor="li-email">Email</label><input id="li-email" type="email" autoComplete="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        {mode === 'login' && (
          <div className="field wide">
            <label htmlFor="li-pw">Password</label>
            <input id="li-pw" type="password" autoComplete="current-password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
            <button type="button" className="linkbtn" style={{ alignSelf: 'flex-start' }} onClick={() => { setMode('forgot'); setErr(''); }}>Forgot your password?</button>
          </div>
        )}
      </div>
      {mode === 'forgot' && <p className="small" style={{ marginTop: 10 }}>Enter your email and we’ll send you a link to choose a new password.</p>}
      {err && <p className="err" style={{ marginTop: 10 }}>{err}</p>}
      <div className="sheet-foot" style={{ justifyContent: 'space-between' }}>
        {mode === 'forgot'
          ? <button type="button" className="linkbtn" onClick={() => setMode('login')}>Back to log in</button>
          : switchTo ? <button type="button" className="linkbtn" onClick={switchTo}>New here? Create an account</button> : <span />}
        <button className="btn pink" disabled={busy}>{busy ? 'Please wait…' : mode === 'forgot' ? 'Send reset link' : 'Log in'}</button>
      </div>
    </form>
  );
}

export function RegisterForm({ switchTo, cta = 'Create account', next }) {
  const ref = new URLSearchParams(window.location.search).get('ref') || '';
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', referral: ref });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const r = await api('/auth/register', { method: 'POST', body: { ...f, referral: f.referral || undefined, appUrl: appUrl(), next: next || here() } });
      setSent(r.email);
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  };
  if (sent) return <CheckEmail email={sent} next={next} />;
  return (
    <form onSubmit={submit}>
      <p className="small" style={{ marginTop: 6 }}>One Movers account works for Movers Learn and Movers Space.</p>
      <SocialButtons next={next} />
      <div className="fields" style={{ marginTop: 16 }}>
        <div className="field wide"><label htmlFor="rg-name">Full name</label><input id="rg-name" autoComplete="name" required value={f.name} onChange={set('name')} /></div>
        <div className="field"><label htmlFor="rg-email">Email</label><input id="rg-email" type="email" autoComplete="email" required value={f.email} onChange={set('email')} /></div>
        <div className="field"><label htmlFor="rg-phone">Phone (WhatsApp)</label><input id="rg-phone" type="tel" autoComplete="tel" required value={f.phone} onChange={set('phone')} /></div>
        <div className="field wide"><label htmlFor="rg-pw">Password</label><input id="rg-pw" type="password" autoComplete="new-password" required minLength={8} value={f.password} onChange={set('password')} /><span className="hint">At least 8 characters. We’ll email you a link to confirm your address.</span></div>
        {ref && <div className="field wide"><label htmlFor="rg-ref">Referral code</label><input id="rg-ref" value={f.referral} onChange={set('referral')} /></div>}
      </div>
      {err && <p className="err" style={{ marginTop: 10 }}>{err}</p>}
      <div className="sheet-foot" style={{ justifyContent: 'space-between' }}>
        {switchTo ? <button type="button" className="linkbtn" onClick={switchTo}>Already have an account? Log in</button> : <span />}
        <button className="btn pink" disabled={busy}>{busy ? 'Creating…' : cta}</button>
      </div>
    </form>
  );
}
