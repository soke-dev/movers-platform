import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, useApi, useAuth, Icon, Logo, LoginForm, RegisterForm, PayFlow, Loading, ErrorBox, naira, fmtDay, weekLabel } from '@movers/ui';
import { weekSpan } from './Landing.jsx';

export default function Apply() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, error, loading } = useApi('/public/class');
  const [authMode, setAuthMode] = useState('register');
  const [kind, setKind] = useState(params.get('kind') === 'single' ? 'SINGLE' : 'FULL');
  const [plan, setPlan] = useState(params.get('plan') === 'two' ? 'TWO' : 'FULL');
  const [picked, setPicked] = useState(() => new Set(params.get('skill') ? [params.get('skill')] : []));
  const [payment, setPayment] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (loading || user === undefined) return <Loading />;
  if (error) return <div className="wrap" style={{ paddingBlock: 40 }}><ErrorBox error={error} /></div>;
  const c = data.cohort;
  const skills = data.skills;
  if (!c) return <div className="wrap" style={{ paddingBlock: 40 }}><p className="errbox">Registration isn’t open right now. Check back soon.</p></div>;

  const step = !user ? 1 : payment ? 3 : 2;
  const two = kind === 'FULL' && plan === 'TWO' && c.allowTwoPayments;
  const singleTotal = picked.size * c.skillPrice;
  const toggle = (id) => {
    const n = new Set(picked);
    n.has(id) ? n.delete(id) : n.add(id);
    setPicked(n);
  };

  async function enroll() {
    setErr('');
    if (kind === 'SINGLE' && !picked.size) return setErr('Pick at least one skill.');
    setBusy(true);
    try {
      const r = await api('/learn/enroll', { method: 'POST', body: { kind, plan: two ? 'TWO' : 'FULL', skillIds: [...picked] } });
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

  return (
    <div className="apply-page">
      <Link className="brand" to="/" style={{ maxWidth: 720, margin: '0 auto', display: 'flex' }}><Logo /><span>movers <b>learn</b></span></Link>
      <div className="apply-card">
        <div className="stepper" aria-label={`Step ${step} of 3`}>{[1, 2, 3].map((i) => <i key={i} className={i <= step ? 'on' : ''} />)}</div>

        {step === 1 && (
          <>
            <h1>{authMode === 'register' ? 'Create your Movers account' : 'Log in to continue'}</h1>
            {authMode === 'register'
              ? <RegisterForm cta="Continue" switchTo={() => setAuthMode('login')} />
              : <LoginForm switchTo={() => setAuthMode('register')} />}
          </>
        )}

        {step === 2 && (
          <>
            <h1>What do you want to learn?</h1>
            <p className="small" style={{ marginTop: 6 }}>{c.code} · starts {fmtDay(c.startDate)} · {c.scheduleText} · in person</p>
            <div className="note" style={{ marginTop: 14 }}><Icon name="laptop" /><span><b>You need your own laptop.</b> {c.laptopNote}</span></div>
            <div className="opts" style={{ marginTop: 14 }}>
              <label className="opt"><input type="radio" name="kind" checked={kind === 'FULL'} onChange={() => setKind('FULL')} /><div><b>{c.name}</b><span>All {skills.length} skills · Demo Day {fmtDay(c.demoDate)}{c.mentorshipNote ? ` · ${c.mentorshipNote}` : ''}</span></div><span className="amt">{naira(c.fullPrice)}</span></label>
              <label className="opt"><input type="radio" name="kind" checked={kind === 'SINGLE'} onChange={() => setKind('SINGLE')} /><div><b>Single skills</b><span>Join the class for just the skills you pick</span></div><span className="amt">{naira(c.skillPrice)} each</span></label>
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
              <Link className="btn ghost" to="/">Back</Link>
              <button className="btn pink" disabled={busy} onClick={enroll}>{busy ? 'Saving…' : 'Continue to payment'}</button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1>{kind === 'FULL' ? 'Reserve your seat' : 'Book your skills'}</h1>
            <PayFlow
              payment={payment}
              lines={lines}
              note={<><b>Bring your own laptop.</b> {c.laptopNote}</>}
              allowLater
              hold="We hold your seat for 48 hours."
              laterText={`Your registration is saved. Pay before ${fmtDay(c.startDate)} from your dashboard, on WhatsApp or at the office to secure your seat. Seats go to people who pay first.`}
              finishLabel="Open my dashboard"
              onFinish={() => navigate('/dashboard')}
            />
          </>
        )}
      </div>
    </div>
  );
}
