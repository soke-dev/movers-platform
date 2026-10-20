import { useEffect, useState } from 'react';
import { api } from './api.js';
import { API_URL } from './config.js';
import { useAuth } from './auth.jsx';
import { Icon } from './Icon.jsx';

const appUrl = () => window.location.origin;

/** "Continue with Google". Only shows once it's set up on the server. */
export function SocialButtons({ next }) {
  const [p, setP] = useState({ google: false });
  useEffect(() => {
    api('/auth/providers').then(setP).catch(() => {});
  }, []);
  if (!p.google) return null;
  const ret = encodeURIComponent(`${appUrl()}${next || '/dashboard'}`);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
      <a className="btn line full" href={`${API_URL}/auth/google?return=${ret}`}>
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>
        Continue with Google
      </a>
      <div className="row" style={{ gap: 10, color: 'var(--ink-3)', fontSize: 13, marginTop: 4 }}><span style={{ flex: 1, height: 1, background: 'var(--line)' }} />or with email<span style={{ flex: 1, height: 1, background: 'var(--line)' }} /></div>
    </div>
  );
}

const CodeField = ({ id, value, onChange }) => (
  <div className="field wide">
    <label htmlFor={id}>6-digit code</label>
    <input id={id} inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))} style={{ font: '700 22px var(--f-mono)', letterSpacing: '.3em' }} />
  </div>
);

function Resend({ path, email }) {
  const [state, setState] = useState('');
  const send = async () => {
    setState('sending');
    await api(path, { method: 'POST', body: { email } }).catch(() => {});
    setState('sent');
  };
  return <button type="button" className="linkbtn" disabled={state === 'sending'} onClick={send}>{state === 'sent' ? 'New code sent' : state === 'sending' ? 'Sending…' : 'Send a new code'}</button>;
}

/** After signing up, or logging in before confirming: the code from the email confirms it and logs them in. */
export function VerifyCode({ email, onDone, onBack }) {
  const { setUser } = useAuth();
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const { user } = await api('/auth/verify', { method: 'POST', body: { email, code } });
      setUser(user);
      onDone?.(user);
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit}>
      <div className="note" style={{ marginTop: 16 }}><Icon name="send" /><span>We sent a 6-digit code to <b>{email}</b>. Enter it to confirm your email. It works for 10 minutes; check spam if you can’t find it.</span></div>
      <div className="fields" style={{ marginTop: 14 }}><CodeField id="vc-code" value={code} onChange={setCode} /></div>
      {err && <p className="err" style={{ marginTop: 10 }}>{err}</p>}
      <div className="sheet-foot" style={{ justifyContent: 'space-between' }}>
        <span className="row">{onBack && <button type="button" className="linkbtn" onClick={onBack}>Back</button>}<Resend path="/auth/resend-verification" email={email} /></span>
        <button className="btn pink" disabled={busy || code.length !== 6}>{busy ? 'Checking…' : 'Confirm'}</button>
      </div>
    </form>
  );
}

export function LoginForm({ onDone, switchTo, next }) {
  const { setUser } = useAuth();
  const [mode, setMode] = useState('login'); // login | verify | forgot | reset
  const [f, setF] = useState({ email: '', password: '', code: '', confirm: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const go = (m) => {
    setMode(m);
    setErr('');
  };
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      if (mode === 'forgot') {
        await api('/auth/forgot', { method: 'POST', body: { email: f.email } });
        setF({ ...f, code: '', password: '', confirm: '' });
        return go('reset');
      }
      if (mode === 'reset') {
        if (f.password !== f.confirm) throw new Error('The two passwords don’t match.');
        const { user } = await api('/auth/reset', { method: 'POST', body: { email: f.email, code: f.code, password: f.password } });
        setUser(user);
        return onDone?.(user);
      }
      const { user } = await api('/auth/login', { method: 'POST', body: { email: f.email, password: f.password } });
      setUser(user);
      onDone?.(user);
    } catch (x) {
      if (x.code === 'EMAIL_NOT_VERIFIED') return go('verify');
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  };
  if (mode === 'verify') return <VerifyCode email={f.email} onDone={onDone} onBack={() => go('login')} />;
  return (
    <form onSubmit={submit}>
      {mode === 'login' && <SocialButtons next={next} />}
      {mode === 'forgot' && <p className="small" style={{ marginTop: 14 }}>Enter your email and we’ll send you a 6-digit code to choose a new password.</p>}
      {mode === 'reset' && <div className="note" style={{ marginTop: 16 }}><Icon name="send" /><span>If there’s a Movers account for <b>{f.email}</b>, we’ve sent it a 6-digit code. It works for 10 minutes.</span></div>}
      <div className="fields" style={{ marginTop: 16 }}>
        {mode !== 'reset' && <div className="field wide"><label htmlFor="li-email">Email</label><input id="li-email" type="email" autoComplete="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>}
        {mode === 'login' && (
          <div className="field wide">
            <label htmlFor="li-pw">Password</label>
            <input id="li-pw" type="password" autoComplete="current-password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
            <button type="button" className="linkbtn" style={{ alignSelf: 'flex-start' }} onClick={() => go('forgot')}>Forgot your password?</button>
          </div>
        )}
        {mode === 'reset' && (
          <>
            <CodeField id="rs-code" value={f.code} onChange={(code) => setF({ ...f, code })} />
            <div className="field wide"><label htmlFor="rs-pw">New password</label><input id="rs-pw" type="password" autoComplete="new-password" required minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /><span className="hint">At least 8 characters.</span></div>
            <div className="field wide"><label htmlFor="rs-pw2">Type it again</label><input id="rs-pw2" type="password" autoComplete="new-password" required minLength={8} value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></div>
          </>
        )}
      </div>
      {err && <p className="err" style={{ marginTop: 10 }}>{err}</p>}
      <div className="sheet-foot" style={{ justifyContent: 'space-between' }}>
        {mode === 'login'
          ? switchTo ? <button type="button" className="linkbtn" onClick={switchTo}>New here? Create an account</button> : <span />
          : <span className="row"><button type="button" className="linkbtn" onClick={() => go('login')}>Back to log in</button>{mode === 'reset' && <Resend path="/auth/forgot" email={f.email} />}</span>}
        <button className="btn pink" disabled={busy}>{busy ? 'Please wait…' : mode === 'forgot' ? 'Send code' : mode === 'reset' ? 'Save and log in' : 'Log in'}</button>
      </div>
    </form>
  );
}

export function RegisterForm({ switchTo, cta = 'Create account', next, onDone }) {
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
      const r = await api('/auth/register', { method: 'POST', body: { ...f, referral: f.referral || undefined } });
      setSent(r.email);
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  };
  if (sent) return <VerifyCode email={sent} onDone={onDone} onBack={() => setSent('')} />;
  return (
    <form onSubmit={submit}>
      <p className="small" style={{ marginTop: 6 }}>One Movers account works for Movers Learn and Movers Space.</p>
      <SocialButtons next={next} />
      <div className="fields" style={{ marginTop: 16 }}>
        <div className="field wide"><label htmlFor="rg-name">Full name</label><input id="rg-name" autoComplete="name" required value={f.name} onChange={set('name')} /></div>
        <div className="field"><label htmlFor="rg-email">Email</label><input id="rg-email" type="email" autoComplete="email" required value={f.email} onChange={set('email')} /></div>
        <div className="field"><label htmlFor="rg-phone">Phone (WhatsApp)</label><input id="rg-phone" type="tel" autoComplete="tel" required value={f.phone} onChange={set('phone')} /></div>
        <div className="field wide"><label htmlFor="rg-pw">Password</label><input id="rg-pw" type="password" autoComplete="new-password" required minLength={8} value={f.password} onChange={set('password')} /><span className="hint">At least 8 characters. We’ll email you a code to confirm your address.</span></div>
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
