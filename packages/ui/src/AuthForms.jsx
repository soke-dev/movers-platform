import { useEffect, useState } from 'react';
import { api } from './api.js';
import { API_URL } from './config.js';
import { useAuth, storedRef } from './auth.jsx';

const appUrl = () => window.location.origin;
export const MIN_PASSWORD = 6;

/** "Continue with Google". Only shows once it's set up on the server. */
export function SocialButtons({ next }) {
  const [p, setP] = useState({ google: false });
  useEffect(() => {
    api('/auth/providers').then(setP).catch(() => {});
  }, []);
  if (!p.google) return null;
  const ret = encodeURIComponent(`${appUrl()}${next || '/dashboard'}`);
  const ref = storedRef();
  return (
    <>
      <a className="authf-google" href={`${API_URL}/auth/google?return=${ret}${ref ? `&ref=${encodeURIComponent(ref)}` : ''}`}>
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>
        Continue with Google
      </a>
      <div className="authf-or"><span>or</span></div>
    </>
  );
}

/** Label and input, with optional bits on the right of the label (e.g. "Forgot password?"). */
function Field({ id, label, aside, children }) {
  return (
    <div className="authf-field">
      <div className="authf-label"><label htmlFor={id}>{label}</label>{aside}</div>
      {children}
    </div>
  );
}

export function Password({ id, value, onChange, autoComplete = 'new-password', placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="authf-pw">
      <input id={id} type={show ? 'text' : 'password'} autoComplete={autoComplete} required value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button>
    </div>
  );
}

const NigeriaFlag = () => (
  <svg width="22" height="15" viewBox="0 0 3 2" aria-hidden="true"><path fill="#008751" d="M0 0h3v2H0z" /><path fill="#fff" d="M1 0h1v2H1z" /></svg>
);

/** Nigerian numbers only: +234 is fixed, they type the 10 digits (a leading 0 is dropped). */
export const phoneDigits = (s) => {
  let d = String(s || '').replace(/\D/g, '');
  if (d.startsWith('234')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  return d.slice(0, 10);
};
const spaced = (d) => [d.slice(0, 3), d.slice(3, 6), d.slice(6)].filter(Boolean).join(' ');

export function PhoneNG({ id, value, onChange }) {
  return (
    <div className="authf-phone">
      <span className="cc"><NigeriaFlag />+234</span>
      <input id={id} type="tel" inputMode="numeric" autoComplete="tel-national" required placeholder="803 123 4567" value={spaced(value)} onChange={(e) => onChange(phoneDigits(e.target.value))} />
    </div>
  );
}

const CodeInput = ({ id, value, onChange }) => (
  <input id={id} className="authf-code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus placeholder="000000" value={value}
    onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))} />
);

function Resend({ path, email }) {
  const [state, setState] = useState('');
  const send = async () => {
    setState('sending');
    try {
      await api(path, { method: 'POST', body: { email } });
      setState('sent');
    } catch {
      setState('failed');
    }
  };
  const label = { sent: 'New code sent', sending: 'Sending…', failed: 'Couldn’t send, try again' }[state] || 'Send a new code';
  return <button type="button" className="authf-link" disabled={state === 'sending'} onClick={send}>{label}</button>;
}

const Err = ({ children }) => (children ? <p className="authf-err" role="alert">{children}</p> : null);

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
    <form className="authf" onSubmit={submit}>
      <p className="authf-lead">We sent a 6-digit code to <b>{email}</b>. Enter it below to confirm your email. It works for 10 minutes.</p>
      <Field id="vc-code" label="Code"><CodeInput id="vc-code" value={code} onChange={setCode} /></Field>
      <Err>{err}</Err>
      <button className="btn pink full authf-go" disabled={busy || code.length !== 6}>{busy ? 'Checking…' : 'Confirm email'}</button>
      <p className="authf-switch">Can’t find it? Check spam, or <Resend path="/auth/resend-verification" email={email} />{onBack && <> · <button type="button" className="authf-link" onClick={onBack}>Change email</button></>}</p>
    </form>
  );
}

export function LoginForm({ onDone, switchTo, next }) {
  const { setUser } = useAuth();
  const [mode, setMode] = useState('login'); // login | verify | forgot | reset
  const [f, setF] = useState({ email: '', password: '', code: '', confirm: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const go = (m) => {
    setMode(m);
    setErr('');
  };
  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (mode === 'reset') {
      if (f.password.length < MIN_PASSWORD) return setErr(`Use at least ${MIN_PASSWORD} characters for your password.`);
      if (f.password !== f.confirm) return setErr('The two passwords don’t match.');
    }
    setBusy(true);
    try {
      if (mode === 'forgot') {
        await api('/auth/forgot', { method: 'POST', body: { email: f.email } });
        setF((x) => ({ ...x, code: '', password: '', confirm: '' }));
        return go('reset');
      }
      if (mode === 'reset') {
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

  if (mode === 'forgot' || mode === 'reset') {
    return (
      <form className="authf" onSubmit={submit}>
        <p className="authf-lead">
          {mode === 'forgot'
            ? 'Enter the email you signed up with and we’ll send you a 6-digit code to choose a new password.'
            : <>If there’s an account for <b>{f.email}</b>, we’ve sent it a 6-digit code. It works for 10 minutes.</>}
        </p>
        {mode === 'forgot' ? (
          <Field id="fg-email" label="Email"><input id="fg-email" type="email" autoComplete="email" required autoFocus value={f.email} onChange={(e) => set('email')(e.target.value)} /></Field>
        ) : (
          <>
            <Field id="rs-code" label="Code"><CodeInput id="rs-code" value={f.code} onChange={set('code')} /></Field>
            <Field id="rs-pw" label="New password"><Password id="rs-pw" value={f.password} onChange={set('password')} placeholder={`At least ${MIN_PASSWORD} characters`} /></Field>
            <Field id="rs-pw2" label="Confirm new password"><Password id="rs-pw2" value={f.confirm} onChange={set('confirm')} /></Field>
          </>
        )}
        <Err>{err}</Err>
        <button className="btn pink full authf-go" disabled={busy}>{busy ? 'Please wait…' : mode === 'forgot' ? 'Send code' : 'Save password and log in'}</button>
        <p className="authf-switch">
          <button type="button" className="authf-link" onClick={() => go('login')}>Back to log in</button>
          {mode === 'reset' && <> · <Resend path="/auth/forgot" email={f.email} /></>}
        </p>
      </form>
    );
  }

  return (
    <form className="authf" onSubmit={submit}>
      <p className="authf-lead">One Movers account works on Movers Learn and Movers Space.</p>
      <SocialButtons next={next} />
      <Field id="li-email" label="Email"><input id="li-email" type="email" autoComplete="email" required value={f.email} onChange={(e) => set('email')(e.target.value)} /></Field>
      <Field id="li-pw" label="Password" aside={<button type="button" className="authf-link" onClick={() => go('forgot')}>Forgot password?</button>}>
        <Password id="li-pw" value={f.password} onChange={set('password')} autoComplete="current-password" />
      </Field>
      <Err>{err}</Err>
      <button className="btn pink full authf-go" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      {switchTo && <p className="authf-switch">New to Movers? <button type="button" className="authf-link" onClick={switchTo}>Create an account</button></p>}
    </form>
  );
}

export function RegisterForm({ switchTo, cta = 'Create account', next, onDone }) {
  // From a friend's link (?ref=, remembered while they browse), so they don't have to type it.
  const ref = (new URLSearchParams(window.location.search).get('ref') || storedRef()).toUpperCase();
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '', confirm: '', referral: ref });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState('');
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (f.phone.length !== 10) return setErr('Enter your 10-digit phone number, e.g. 803 123 4567.');
    if (f.password.length < MIN_PASSWORD) return setErr(`Use at least ${MIN_PASSWORD} characters for your password.`);
    if (f.password !== f.confirm) return setErr('The two passwords don’t match.');
    setBusy(true);
    try {
      const r = await api('/auth/register', { method: 'POST', body: { firstName: f.firstName, lastName: f.lastName, email: f.email, phone: `+234${f.phone}`, password: f.password, referral: f.referral.trim() || undefined } });
      setSent(r.email);
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  };
  if (sent) return <VerifyCode email={sent} onDone={onDone} onBack={() => setSent('')} />;
  return (
    <form className="authf" onSubmit={submit}>
      <p className="authf-lead">One account for Movers Learn and Movers Space.</p>
      <SocialButtons next={next} />
      <div className="authf-two">
        <Field id="rg-first" label="First name"><input id="rg-first" autoComplete="given-name" required value={f.firstName} onChange={(e) => set('firstName')(e.target.value)} /></Field>
        <Field id="rg-last" label="Last name"><input id="rg-last" autoComplete="family-name" required value={f.lastName} onChange={(e) => set('lastName')(e.target.value)} /></Field>
      </div>
      <Field id="rg-email" label="Email"><input id="rg-email" type="email" autoComplete="email" required value={f.email} onChange={(e) => set('email')(e.target.value)} /></Field>
      <Field id="rg-phone" label="Phone number"><PhoneNG id="rg-phone" value={f.phone} onChange={set('phone')} /></Field>
      <Field id="rg-pw" label="Password"><Password id="rg-pw" value={f.password} onChange={set('password')} placeholder={`At least ${MIN_PASSWORD} characters`} /></Field>
      <Field id="rg-pw2" label="Confirm password"><Password id="rg-pw2" value={f.confirm} onChange={set('confirm')} /></Field>
      <Field id="rg-ref" label="Referral code" aside={<span className="authf-opt">{ref && f.referral === ref ? 'From your friend’s link' : 'Optional'}</span>}>
        <input id="rg-ref" autoComplete="off" placeholder="e.g. MV-7K2Q9P" value={f.referral} onChange={(e) => set('referral')(e.target.value.toUpperCase())} />
      </Field>
      <Err>{err}</Err>
      <button className="btn pink full authf-go" disabled={busy}>{busy ? 'Creating your account…' : cta}</button>
      <p className="authf-fine">We’ll email you a 6-digit code to confirm your email.</p>
      {switchTo && <p className="authf-switch">Already have an account? <button type="button" className="authf-link" onClick={switchTo}>Log in</button></p>}
    </form>
  );
}
