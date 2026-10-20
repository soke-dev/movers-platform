import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from './api.js';
import { useAuth } from './auth.jsx';
import { LoginForm, RegisterForm } from './AuthForms.jsx';
import { Logo } from './Logo.jsx';
import { Icon } from './Icon.jsx';
import { naira } from './format.js';
import { PayChip } from './bits.jsx';

/** Login / sign-up page. Sends people to ?next= (or `home`) afterwards. */
export function AuthPage({ word, tone = '#120D24', home = '/dashboard', staff = false }) {
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get('mode') === 'register' && !staff ? 'register' : 'login');
  const { user } = useAuth();
  const navigate = useNavigate();
  const next = params.get('next') || home;
  useEffect(() => {
    if (user) navigate(next, { replace: true });
  }, [user, next, navigate]);
  return (
    <div style={{ minHeight: '100vh', background: 'var(--mist)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div className="panel" style={{ width: 'min(480px,100%)', padding: 28 }}>
        <Link className="brand" to="/"><Logo tone={tone} /><span>movers <b>{word}</b></span></Link>
        <h1 style={{ font: '900 28px/1.1 var(--f-display)', letterSpacing: '-.03em', marginTop: 24 }}>
          {mode === 'login' ? (staff ? 'Staff login' : 'Welcome back') : 'Create your Movers account'}
        </h1>
        {params.get('error') && <p className="errbox" style={{ marginTop: 14 }}>{params.get('error')}</p>}
        {mode === 'login'
          ? <LoginForm next={next} onDone={() => navigate(next, { replace: true })} switchTo={staff ? null : () => setMode('register')} />
          : <RegisterForm next={next} switchTo={() => setMode('login')} />}
      </div>
    </div>
  );
}

function Card({ word, tone, children }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--mist)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div className="panel" style={{ width: 'min(480px,100%)', padding: 28 }}>
        <Link className="brand" to="/"><Logo tone={tone} /><span>movers <b>{word}</b></span></Link>
        {children}
      </div>
    </div>
  );
}

const h1 = { font: '900 28px/1.1 var(--f-display)', letterSpacing: '-.03em', marginTop: 24 };

/** The link in the confirmation email lands here: /verify-email?token=…&next=… */
export function VerifyEmail({ word, tone = '#120D24', home = '/dashboard' }) {
  const [params] = useSearchParams();
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [err, setErr] = useState('');
  const started = useRef(false);
  const next = params.get('next') || home;
  useEffect(() => {
    // The token only works once, so don't send it twice.
    if (started.current) return;
    started.current = true;
    api('/auth/verify', { method: 'POST', body: { token: params.get('token') || '' } })
      .then(({ user }) => {
        setUser(user);
        navigate(next, { replace: true });
      })
      .catch((e) => setErr(e.message));
  }, [params, next, navigate, setUser]);
  return (
    <Card word={word} tone={tone}>
      <h1 style={h1}>{err ? 'That link didn’t work' : 'Confirming your email…'}</h1>
      {err && <><p className="errbox" style={{ marginTop: 14 }}>{err}</p><Link className="btn ink" style={{ marginTop: 16 }} to="/login">Go to log in</Link></>}
    </Card>
  );
}

/** Choose a new password (also how a new admin sets their first one): /reset-password?token=… */
export function ResetPassword({ word, tone = '#120D24', home = '/dashboard' }) {
  const [params] = useSearchParams();
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ password: '', confirm: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (f.password !== f.confirm) return setErr('The two passwords don’t match.');
    setBusy(true);
    setErr('');
    try {
      const { user } = await api('/auth/reset', { method: 'POST', body: { token: params.get('token') || '', password: f.password } });
      setUser(user);
      navigate(home, { replace: true });
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card word={word} tone={tone}>
      <h1 style={h1}>Choose a password</h1>
      <form onSubmit={submit}>
        <div className="fields" style={{ marginTop: 16 }}>
          <div className="field wide"><label htmlFor="rp-pw">New password</label><input id="rp-pw" type="password" autoComplete="new-password" required minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /><span className="hint">At least 8 characters.</span></div>
          <div className="field wide"><label htmlFor="rp-pw2">Type it again</label><input id="rp-pw2" type="password" autoComplete="new-password" required minLength={8} value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></div>
        </div>
        {err && <p className="err" style={{ marginTop: 10 }}>{err}</p>}
        <div className="sheet-foot" style={{ justifyContent: 'space-between' }}>
          <Link className="linkbtn" to="/login">Back to log in</Link>
          <button className="btn pink" disabled={busy}>{busy ? 'Saving…' : 'Save and log in'}</button>
        </div>
      </form>
    </Card>
  );
}

/** Money Moves sends the customer back here with ?ref=<our reference>. */
export function PaymentReturn({ dashPath = '/dashboard/payments' }) {
  const [params] = useSearchParams();
  const ref = params.get('ref');
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    let tries = 0;
    let stop = false;
    const check = async () => {
      try {
        const { payment } = await api(`/payments/verify?ref=${encodeURIComponent(ref || '')}`);
        if (stop) return;
        setState({ payment });
        // Bank transfers can take a moment to land; check a few more times.
        if (payment.status !== 'PAID' && ++tries < 6) setTimeout(check, 5000);
      } catch (e) {
        if (!stop) setState({ error: e.message });
      }
    };
    check();
    return () => {
      stop = true;
    };
  }, [ref]);
  const p = state.payment;
  return (
    <div style={{ minHeight: '100vh', background: 'var(--mist)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div className="panel done" style={{ width: 'min(480px,100%)', padding: 28 }}>
        {state.loading && <p>Checking your payment…</p>}
        {state.error && <><p className="errbox">{state.error}</p><Link className="btn ink" to={dashPath}>Go to Payments</Link></>}
        {p && p.status === 'PAID' && (
          <>
            <span className="tick"><Icon name="check" /></span>
            <h1 style={{ font: '900 24px var(--f-display)' }}>Payment received</h1>
            <p>{naira(p.amount)} for {p.description}.</p>
            <span className="ref">Ref {p.reference}</span>
            <Link className="btn ink lg" to={dashPath}>Go to my dashboard</Link>
          </>
        )}
        {p && p.status !== 'PAID' && (
          <>
            <span className="tick office"><Icon name="clock" /></span>
            <h1 style={{ font: '900 24px var(--f-display)' }}>Waiting for your payment</h1>
            <p>We haven’t received {naira(p.amount)} yet. If you’ve just paid, it can take a minute. This page checks again on its own.</p>
            <PayChip status={p.status} />
            <Link className="btn line" to={dashPath}>Go to Payments</Link>
          </>
        )}
      </div>
    </div>
  );
}
