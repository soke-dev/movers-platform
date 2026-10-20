import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from './api.js';
import { useAuth } from './auth.jsx';
import { LoginForm, RegisterForm } from './AuthForms.jsx';
import { Logo } from './Logo.jsx';
import { Modal } from './Modal.jsx';
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
          {mode === 'login' ? (staff ? 'Staff login' : 'Welcome back') : 'Create your account'}
        </h1>
        {params.get('error') && <p className="errbox" style={{ marginTop: 14 }}>{params.get('error')}</p>}
        {mode === 'login'
          ? <LoginForm next={next} onDone={() => navigate(next, { replace: true })} switchTo={staff ? null : () => setMode('register')} />
          : <RegisterForm next={next} onDone={() => navigate(next, { replace: true })} switchTo={() => setMode('login')} />}
      </div>
    </div>
  );
}

/**
 * Log in / sign up as a pop-up over the landing page, at /login (nested under the landing route).
 * Dashboards send people here with ?next=; Google sends ?error= when sign-in fails.
 */
export function AuthModal({ home = '/dashboard' }) {
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get('mode') === 'register' ? 'register' : 'login');
  const { user } = useAuth();
  const navigate = useNavigate();
  const next = params.get('next') || home;
  useEffect(() => {
    if (user) navigate(next, { replace: true });
  }, [user, next, navigate]);
  const close = () => navigate('/', { preventScrollReset: true });
  return (
    <Modal title={mode === 'login' ? 'Welcome back' : 'Create your account'} onClose={close}>
      {params.get('error') && <p className="errbox" style={{ marginTop: 14 }}>{params.get('error')}</p>}
      {mode === 'login'
        ? <LoginForm next={next} onDone={() => navigate(next, { replace: true })} switchTo={() => setMode('register')} />
        : <RegisterForm next={next} onDone={() => navigate(next, { replace: true })} switchTo={() => setMode('login')} />}
    </Modal>
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
