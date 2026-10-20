import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, Loading, ErrorBox, Empty, Chip, Icon, naira, fmtDay, weekLabel } from '@movers/ui';
import { useLearn } from './Dashboard.jsx';
import { PayModal } from './modals.jsx';
import { planChange } from './derive.js';
import Apply from '../Apply.jsx';

const STAGE = { UPCOMING: ['blue', 'Upcoming'], RUNNING: ['ok', 'In progress'], COMPLETED: ['lock', 'Completed'] };

const Facts = ({ rows }) => (
  <dl className="cls-facts">{rows.filter(Boolean).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
);

/** Every class they've joined (upcoming, in progress, completed) and the next one open for registration. */
export default function Classes() {
  const { reload: reloadDash } = useLearn();
  const { data, error, loading, reload } = useApi('/learn/classes');
  const [modal, setModal] = useState(null);
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} retry={reload} />;
  const { classes, open } = data;
  const refresh = () => {
    reload();
    reloadDash();
  };
  return (
    <div className="pg">
      <div className="pg-h"><div><p className="eyebrow">Movers Learn</p><h1>Class</h1><p className="desc">Your class, and the next one you can sign up for.</p></div></div>

      {open && (
        <div className="panel cls">
          <div className="cls-h">
            <span className="cls-no">{open.code.replace(/\D/g, '') || '•'}</span>
            <div><p className="eyebrow">Open for registration</p><h2>{open.name} · {open.code}</h2></div>
            <Chip kind="ok">{open.seatsLeft} of {open.seats} seats left</Chip>
          </div>
          <Facts rows={[
            ['Starts', fmtDay(open.startDate)],
            ['Demo Day', fmtDay(open.demoDate)],
            ['Classes', open.scheduleText],
            ['Where', open.location],
            ['Price', `${naira(open.fullPrice)} for all skills, or ${naira(open.skillPrice)} per skill`],
            (open.supportNote || open.mentorshipNote) && ['Included', [open.supportNote, open.mentorshipNote].filter(Boolean).join(', then ')]
          ]} />
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn pink" onClick={() => setModal({ join: 'FULL' })}>Join the full class</button>
            <button className="btn line" onClick={() => setModal({ join: 'SINGLE' })}>Pick single skills</button>
          </div>
        </div>
      )}

      {classes.length ? classes.map((x) => {
        const c = x.cohort;
        const owing = x.payments.filter((p) => p.status === 'UNPAID' || p.status === 'PENDING');
        const nextToPay = x.payments.find((p) => p.status === 'UNPAID');
        const change = planChange(x.payments, c.startDate, c.isCurrent);
        return (
          <div className="panel cls" key={x.id}>
            <div className="cls-h">
              <span className="cls-no">{c.code.replace(/\D/g, '') || '•'}</span>
              <div><p className="eyebrow">{x.kind === 'FULL' ? 'Full class' : 'Single skills'}{x.plan === 'TWO' ? ' · two payments' : ''}</p><h2>{c.name} · {c.code}</h2></div>
              <Chip kind={STAGE[x.stage][0]}>{STAGE[x.stage][1]}</Chip>
            </div>
            <Facts rows={[
              ['Starts', fmtDay(c.startDate)],
              ['Demo Day', fmtDay(c.demoDate)],
              ['Classes', c.scheduleText],
              ['Where', c.location],
              ['Fees', x.paid >= x.total ? `${naira(x.total)}, all paid` : `${naira(x.paid)} paid of ${naira(x.total)}${owing.length ? ` · ${naira(owing.reduce((s, p) => s + p.amount, 0))} to pay` : ''}`],
              ['Seat', x.secured ? 'Secured' : 'Secured once you pay'],
              (c.supportNote || c.mentorshipNote) && ['Included', [c.supportNote, c.mentorshipNote].filter(Boolean).join(', then ')]
            ]} />
            {x.kind === 'SINGLE' && (
              <>
                <p className="lbl-s" style={{ margin: '16px 0 8px' }}>Your skills</p>
                <div className="cls-skills">{x.skills.map((s) => <span key={s.id}><b>{s.name}</b><small>{weekLabel(s.weekStart, s.weekEnd)}</small></span>)}</div>
              </>
            )}
            <div className="row" style={{ marginTop: 16 }}>
              {nextToPay && <button className="btn pink" onClick={() => setModal({ pay: nextToPay })}>Pay {naira(nextToPay.amount)}</button>}
              {change.can && <button className="btn line" onClick={() => setModal({ change: x })}>{x.kind === 'SINGLE' ? 'Change skills or plan' : 'Change plan or pick skills'}</button>}
              {x.stage !== 'COMPLETED' && <Link className="btn soft" to="/dashboard/course">Course outline <Icon name="arrow" /></Link>}
              {x.stage === 'COMPLETED' && <Link className="btn soft" to="/dashboard/certificate">Certificate <Icon name="arrow" /></Link>}
              {owing.length > 0 && <Link className="linkbtn" to="/dashboard/payments">All payments</Link>}
            </div>
            {change.why && <p className="small" style={{ marginTop: 10 }}>{change.why}</p>}
          </div>
        );
      }) : !open && <div className="panel"><Empty icon="layers">You haven’t joined a class yet. We’ll show the next one here when registration opens.</Empty></div>}

      {modal?.join && <Apply startKind={modal.join} onClose={() => setModal(null)} onSaved={refresh} />}
      {modal?.change && <Apply current={modal.change} onClose={() => setModal(null)} onSaved={refresh} />}
      {modal?.pay && <PayModal payment={modal.pay} onClose={() => setModal(null)} onDone={refresh} />}
    </div>
  );
}
