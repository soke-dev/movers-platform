import { Link } from 'react-router-dom';
import { useApi, useAuth, Icon, Loading, ErrorBox, Empty, naira, fmtDay, fmtTime, LEARN_URL, SPACE_URL, displayName } from '@movers/ui';
import { PageHead } from '../shared.jsx';

export default function Overview() {
  const { user } = useAuth();
  const { data: d, error, loading, reload } = useApi('/admin/overview');
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} retry={reload} />;
  const todo = [
    ['/payments', 'wallet', 'var(--amber-soft)', 'var(--wait)', d.pendingCount, 'Payments to confirm', `${naira(d.pendingAmount)} via WhatsApp and office`],
    ['/tasks', 'file', 'var(--violet-soft)', 'var(--violet)', d.toGrade, 'Submissions to grade', 'Projects waiting for a score'],
    ['/tasks', 'quiz', 'var(--pink-soft)', 'var(--due)', d.openQuizzes.length, 'Quizzes open', d.openQuizzes.map((q) => `${q.title}: ${q.taken} taken`).join(' · ') || 'None open'],
    ['/payments?status=UNPAID', 'clock', 'var(--mist)', 'var(--ink-2)', d.unpaidRegistrations, 'Registered, not paid', 'Chose “pay later” for the next class'],
    ['/bookings', 'calendar', 'var(--blue-mist)', 'var(--blue-deep)', d.heldBookings, 'Bookings waiting for payment', 'Unpaid or being confirmed'],
    ['/space', 'laptop', 'var(--blue-mist)', 'var(--blue-deep)', Math.max(0, d.desks - d.inNow), 'Hot desks free', 'Movers Space right now']
  ];
  return (
    <div className="pg">
      <PageHead eyebrow={fmtDay(new Date())} title={`Hello, ${displayName(user)}`}>
        <a className="btn soft sm" href={LEARN_URL} target="_blank" rel="noreferrer">Learn site</a>
        <a className="btn soft sm" href={SPACE_URL} target="_blank" rel="noreferrer">Space site</a>
      </PageHead>
      <div className="kpis">
        <div className="card"><span className="k">Active students</span><div className="big">{d.activeStudents}</div><p className="sub">{d.activeFull} full class · {d.activeSingle} single-skill</p></div>
        <div className="card"><span className="k">Collected this month</span><div className="big" style={{ color: 'var(--ok)' }}>{naira(d.collectedThisMonth)}</div><p className="sub">Learn and Space</p></div>
        <div className="card"><span className="k">Waiting to confirm</span><div className="big" style={{ color: d.pendingCount ? 'var(--wait)' : 'var(--ink)' }}>{d.pendingCount}</div><p className="sub">{naira(d.pendingAmount)}</p></div>
        <div className="card"><span className="k">In the space now</span><div className="big">{d.inNow} / {d.desks}</div><p className="sub">Desks in use</p></div>
      </div>
      {d.cohort && (
        <div className="panel">
          <div className="panel-h"><h2>On the website: {d.cohort.name}, {d.cohort.code}</h2><Link className="more" to="/classes">Edit class <Icon name="arrow" /></Link></div>
          <p className="small">Starts {fmtDay(d.cohort.startDate)} · {d.cohort.seatsLeft} of {d.cohort.seats} full-class seats left · {naira(d.cohort.fullPrice)} or {naira(d.cohort.skillPrice)} per skill</p>
        </div>
      )}
      <div className="panel">
        <div className="panel-h"><h2>Needs action</h2></div>
        <ul className="list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {todo.map(([to, icon, bg, c, n, t, s]) => (
            <li key={t} style={{ border: '1px solid var(--line)', borderRadius: 14, padding: 12, gridTemplateColumns: '44px minmax(0,1fr) auto' }}>
              <span className="ib" style={{ background: bg, color: c }}><Icon name={icon} /></span>
              <Link to={to} style={{ textDecoration: 'none' }}><div className="t">{t}</div><div className="d">{s}</div></Link>
              <span style={{ font: '900 24px var(--f-display)' }}>{n}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="panel">
        <div className="panel-h"><h2>Today and tomorrow</h2></div>
        {d.today.length ? (
          <ul className="list">
            {d.today.map((x, i) => (
              <li key={i}><span className="ib"><Icon name={x.kind === 'class' ? 'book' : 'clock'} /></span><div><div className="t">{x.text}</div><div className="d">{fmtDay(x.at)}{x.kind === 'booking' ? ` · ${fmtTime(x.at)}` : ''}</div></div><span /></li>
            ))}
          </ul>
        ) : <Empty icon="calendar">No classes or bookings today or tomorrow.</Empty>}
      </div>
    </div>
  );
}
