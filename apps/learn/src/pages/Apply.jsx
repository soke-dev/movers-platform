import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, useApi, useAuth, Icon, Modal, LoginForm, RegisterForm, PayFlow, Loading, ErrorBox, naira, fmtDay, weekLabel } from '@movers/ui';
import { weekSpan, classFaqs } from './Landing.jsx';

/**
 * Sign-up for the class, as a pop-up over the landing page (/apply?kind=full|single&plan=two&skill=…).
 * The dashboard also opens it to change the plan: pass `current` (their enrolment), `onClose` and `onSaved`.
 */
export default function Apply({ current, onClose, onSaved }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, error, loading } = useApi('/public/class');
  const [authMode, setAuthMode] = useState('register');
  const [kind, setKind] = useState(current?.kind || (params.get('kind') === 'single' ? 'SINGLE' : 'FULL'));
  const [plan, setPlan] = useState(current?.plan || (params.get('plan') === 'two' ? 'TWO' : 'FULL'));
  const [picked, setPicked] = useState(() => new Set(current ? current.skills.map((s) => s.id) : params.get('skill') ? [params.get('skill')] : []));
  const [payment, setPayment] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const close = onClose || (() => navigate('/', { preventScrollReset: true }));
  const finish = () => (onClose ? onClose() : navigate('/dashboard'));
  const pendingNow = current?.payments.some((p) => p.status === 'PENDING');
  // Narrow while they log in or sign up, wide for choosing skills and paying.
  const shell = (children, wide = true) => <Modal wide={wide} onClose={close} labelledBy="applyTitle"><div className="apply-modal">{children}</div></Modal>;

  if (loading || user === undefined) return shell(<Loading />);
  if (error) return shell(<ErrorBox error={error} />);
  const c = data.cohort;
  const skills = data.skills;
  if (!c) return shell(<p className="errbox" style={{ marginTop: 30 }}>Registration isn’t open right now. Check back soon.</p>);

  const step = !user ? 1 : payment ? 3 : 2;
  const two = kind === 'FULL' && plan === 'TWO' && c.allowTwoPayments;
  const singleTotal = picked.size * c.skillPrice;
  const toggle = (id) => {
    const n = new Set(picked);
    n.has(id) ? n.delete(id) : n.add(id);
    setPicked(n);
  };

  /** Saves the registration. "later" skips paying now and goes to the dashboard, where they can pay any time. */
  async function enroll(later = false) {
    setErr('');
    if (kind === 'SINGLE' && !picked.size) return setErr('Pick at least one skill.');
    setBusy(later ? 'later' : 'pay');
    try {
      const r = await api('/learn/enroll', { method: 'POST', body: { kind, plan: two ? 'TWO' : 'FULL', skillIds: [...picked] } });
      onSaved?.();
      if (later) return finish();
      setPayment(r.payment);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const lines = kind === 'FULL'
    ? [['Class', `${c.name}, ${c.code}`], ['Starts', `${fmtDay(c.startDate)} · Demo Day ${fmtDay(c.demoDate)}`], ['Plan', two ? 'Two payments' : 'Pay in full'], ['Class total', c.fullPrice, 'muted']]
    : [['Skills', skills.filter((s) => picked.has(s.id)).map((s) => s.name).join(', ')], ['Price', `${picked.size} × ${naira(c.skillPrice)}`, 'muted']];

  return shell(
    <>
      <div>
        <div className="stepper" aria-label={`Step ${step} of 3`}>{[1, 2, 3].map((i) => <i key={i} className={i <= step ? 'on' : ''} />)}</div>

        {step === 1 && (
          <>
            <h1 id="applyTitle">{authMode === 'register' ? 'Create your account' : 'Log in to continue'}</h1>
            {authMode === 'register'
              ? <RegisterForm cta="Continue" switchTo={() => setAuthMode('login')} />
              : <LoginForm switchTo={() => setAuthMode('register')} />}
          </>
        )}

        {step === 2 && (
          <>
            <h1 id="applyTitle">{current ? 'Change your plan' : 'What do you want to learn?'}</h1>
            <p className="small" style={{ marginTop: 6 }}>{c.code} · starts {fmtDay(c.startDate)} · {c.scheduleText} · in person</p>
            {pendingNow && <p className="warn" style={{ marginTop: 14 }}>Changing your plan cancels the payment we’re waiting to confirm. If you’ve already sent money, call or WhatsApp us first.</p>}
            <details className="apply-faq">
              <summary>Questions about the class<Icon name="plus" /></summary>
              <dl>{classFaqs(c).map(([q, a]) => <div key={q}><dt>{q}</dt><dd>{a}</dd></div>)}</dl>
            </details>
            <div className="opts" style={{ marginTop: 14 }}>
              <label className="opt"><input type="radio" name="kind" checked={kind === 'FULL'} onChange={() => setKind('FULL')} /><div><b>{c.name}</b><span>All {skills.length} skills · Demo Day {fmtDay(c.demoDate)}{c.mentorshipNote ? ` · ${c.mentorshipNote}` : ''}</span></div><span className="amt">{naira(c.fullPrice)}</span></label>
              <label className="opt"><input type="radio" name="kind" checked={kind === 'SINGLE'} onChange={() => setKind('SINGLE')} /><div><b>Single skills</b><span>Just the skills you pick · Demo Day {fmtDay(c.demoDate)}{c.mentorshipNote ? ` · ${c.mentorshipNote}` : ''}</span></div><span className="amt">{naira(c.skillPrice)} each</span></label>
            </div>

            {kind === 'FULL' && c.allowTwoPayments && (
              <>
                <p className="lbl-s" style={{ margin: '18px 0 8px' }}>How would you like to pay?</p>
                <div className="opts">
                  <label className="opt"><input type="radio" name="plan" checked={plan === 'FULL'} onChange={() => setPlan('FULL')} /><div><b>Pay in full</b><span>One payment</span></div><span className="amt">{naira(c.fullPrice)}</span></label>
                  <label className="opt"><input type="radio" name="plan" checked={plan === 'TWO'} onChange={() => setPlan('TWO')} /><div><b>Two payments</b><span>Half now to hold your seat, the rest by week 4</span></div><span className="amt">{naira(Math.round(c.fullPrice / 2))} × 2</span></label>
                </div>
              </>
            )}

            {kind === 'SINGLE' && (
              <>
                <p className="lbl-s" style={{ margin: '18px 0 8px' }}>Pick your skills</p>
                <div className="skillpick">
                  {skills.map((s) => (
                    <label className="sk" key={s.id}>
                      <input type="checkbox" checked={picked.has(s.id)} onChange={() => toggle(s.id)} />
                      <span><b>{s.name}</b><small>{weekLabel(s.weekStart, s.weekEnd)} · {weekSpan(c.startDate, s.weekStart, s.weekEnd)}</small></span>
                    </label>
                  ))}
                </div>
                <div className="sk-total"><span>{picked.size} {picked.size === 1 ? 'skill' : 'skills'} × {naira(c.skillPrice)}</span><b>{naira(singleTotal)}</b></div>
                {singleTotal >= c.fullPrice && (
                  <div className="warn" style={{ background: 'var(--lime-soft)', color: 'var(--ink)', marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ flex: 1, minWidth: 200 }}>{picked.size} skills cost {naira(singleTotal)}. The full class gives you all {skills.length} for {naira(c.fullPrice)}.</span>
                    <button className="btn ink sm" onClick={() => setKind('FULL')}>Switch to the full class</button>
                  </div>
                )}
              </>
            )}
            {err && <p className="err" style={{ marginTop: 12 }}>{err} {err.includes('already registered') && <Link className="linkbtn" to="/dashboard">Open my dashboard</Link>}</p>}
            <div className="sheet-foot">
              <button className="btn ghost" onClick={close}>Back</button>
              <button className="btn line" disabled={!!busy} onClick={() => enroll(true)}>{busy === 'later' ? 'Saving…' : 'Pay later'}</button>
              <button className="btn pink" disabled={!!busy} onClick={() => enroll()}>{busy === 'pay' ? 'Saving…' : 'Continue to payment'}</button>
            </div>
            <p className="small" style={{ textAlign: 'right', marginTop: 8 }}>Pay later saves your registration. Your seat is secured once you pay, from your dashboard.</p>
          </>
        )}

        {step === 3 && (
          <>
            <h1 id="applyTitle">{kind === 'FULL' ? 'Reserve your seat' : 'Book your skills'}</h1>
            <PayFlow
              payment={payment}
              lines={lines}
              allowLater
              hold="We hold your seat for 48 hours."
              laterText={`Your registration is saved. Pay before ${fmtDay(c.startDate)} from your dashboard, on WhatsApp or at the office to secure your seat. Seats go to people who pay first.`}
              finishLabel="Open my dashboard"
              onFinish={finish}
            />
          </>
        )}
      </div>
    </>,
    step !== 1
  );
}
