import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon, Empty, PayChip, useAuth, naira, fmtDay, fmtTime, dueText, dayNum, monShort, SPACE_URL } from '@movers/ui';
import { useLearn } from './Dashboard.jsx';
import { PayModal, QuizModal, SubmitModal, CancelPayModal } from './modals.jsx';

export default function Overview() {
  const { data, d, reload } = useLearn();
  const { user } = useAuth();
  const [modal, setModal] = useState(null);
  const first = user.name.split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  if (!data.enrollment) {
    return (
      <div className="pg">
        <div className="pg-h"><div><p className="eyebrow">Movers Learn</p><h1>{greeting}, {first}</h1></div></div>
        <div className="panel attn">
          <div className="panel-h"><h2>You’re not in a class yet</h2></div>
          <p style={{ color: 'var(--ink-2)' }}>Choose the full class or single skills to get started. You can pay now or later.</p>
          <div className="row" style={{ marginTop: 16 }}><Link className="btn pink" to="/apply?kind=full">Join the class</Link><Link className="btn line" to="/apply?kind=single">Pick single skills</Link></div>
        </div>
        <News items={data.announcements} />
      </div>
    );
  }

  const c = data.cohort;
  const items = [
    ...d.owing.map((p) => ({
      key: p.id, bg: p.status === 'PENDING' ? 'var(--amber-soft)' : 'var(--pink-soft)', color: p.status === 'PENDING' ? 'var(--wait)' : 'var(--due)', icon: 'wallet',
      t: p.status === 'PENDING' ? `Payment being confirmed: ${naira(p.amount)}` : `Pending payment: ${naira(p.amount)}`,
      d: p.status === 'PENDING' ? `${p.method === 'OFFICE' ? `Pay at the office with code ${p.reference}` : 'Sent on WhatsApp. Our team usually confirms within 1 working hour.'}` : `${p.description}${p.dueDate ? ` · due ${fmtDay(p.dueDate)}` : ''}`,
      act: p.status === 'PENDING'
        ? <span className="row" style={{ gap: 10 }}><PayChip status="PENDING" /><button className="linkbtn" onClick={() => setModal({ cancel: p })}>Cancel</button></span>
        : <button className="btn pink sm" onClick={() => setModal({ pay: p })}>Pay now</button>
    })),
    ...d.openQuizzes.map((q) => ({
      key: q.id, bg: 'var(--violet-soft)', color: 'var(--violet)', icon: 'quiz', t: `Pending quiz: ${q.title}`,
      d: `${q.questionCount} questions · ${q.minutes} min · closes ${fmtDay(q.closesAt)}, 23:59`,
      act: <button className="btn ink sm" onClick={() => setModal({ quiz: q.id })}>Start quiz</button>
    })),
    ...d.dueTasks.map((a) => ({
      key: a.id, bg: a.submission?.changesRequested ? 'var(--pink-soft)' : 'var(--amber-soft)', color: a.submission?.changesRequested ? 'var(--due)' : 'var(--wait)', icon: 'file',
      t: a.submission?.changesRequested ? `Resubmit: ${a.title}` : `Assignment due: ${a.title}`,
      d: a.submission?.changesRequested ? 'Your instructor asked for changes.' : `${dueText(a.dueAt)} · ${fmtDay(a.dueAt)}, 23:59`,
      act: <button className={`btn ${a.submission?.changesRequested ? 'pink' : 'line'} sm`} onClick={() => setModal({ submit: a })}>{a.submission?.changesRequested ? 'Resubmit' : 'Submit'}</button>
    }))
  ];
  const balance = d.owing.reduce((s, p) => s + p.amount, 0);
  const upcoming = data.sessions.filter((s) => new Date(s.date) >= new Date(new Date().setHours(0, 0, 0, 0))).slice(0, 4);
  const pct = d.progress;

  return (
    <div className="pg">
      <div className="pg-h">
        <div><p className="eyebrow">{fmtDay(new Date())} · {c.code}{d.week > 0 ? ` · Week ${d.week} of ${c.weeks}` : ` · starts ${fmtDay(c.startDate)}`}</p><h1>{greeting}, {first}</h1></div>
      </div>
      <div className="quick">
        <Link to="/dashboard/payments"><span className="qi" style={{ background: 'var(--pink)', color: '#fff' }}><Icon name="wallet" /></span>Pay fees</Link>
        <Link to="/dashboard/tasks"><span className="qi" style={{ background: 'var(--violet)', color: '#fff' }}><Icon name="quiz" /></span>Quizzes</Link>
        <Link to="/dashboard/attendance"><span className="qi" style={{ background: 'var(--lime)' }}><Icon name="calendar" /></span>Attendance</Link>
        <a href={`${SPACE_URL}/dashboard/book`}><span className="qi" style={{ background: 'var(--amber)' }}><Icon name="laptop" /></span>Book a desk</a>
      </div>
      <div className="panel attn">
        <div className="panel-h"><h2>Needs your attention</h2>{items.length > 0 && <span className="count">{items.length} to do</span>}</div>
        {items.length ? (
          <ul className="list">
            {items.map((x) => (
              <li key={x.key}>
                <span className="ib" style={{ background: x.bg, color: x.color }}><Icon name={x.icon} /></span>
                <div><div className="t">{x.t}</div><div className="d">{x.d}</div></div>
                <div className="act">{x.act}</div>
              </li>
            ))}
          </ul>
        ) : <Empty><b>You’re all caught up.</b> Nothing is due right now.</Empty>}
      </div>
      <div className="d-cards">
        <div className="card feature">
          <span className="k">Next class</span>
          {d.nextClass ? (
            <>
              <h3>{d.nextClass.topic || 'Class'}</h3>
              <p className="sub">{fmtDay(d.nextClass.date)} · {c.scheduleText}<br />{c.location}</p>
            </>
          ) : <h3>No more classes. See you at Demo Day!</h3>}
        </div>
        <div className="card">
          <span className="k">Course progress</span>
          <div className="ring-wrap">
            <svg className="ring" viewBox="0 0 42 42" aria-hidden="true"><circle cx="21" cy="21" r="17" fill="none" stroke="var(--mist)" strokeWidth="6" /><circle cx="21" cy="21" r="17" fill="none" stroke="var(--violet)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(pct / 100) * 106.8} 106.8`} transform="rotate(-90 21 21)" /></svg>
            <div><div className="big">{pct}%</div><p className="sub">{d.week > 0 ? `Week ${d.week} of ${c.weeks}` : 'Not started yet'}</p></div>
          </div>
          <Link className="more" to="/dashboard/course">Open course <Icon name="arrow" /></Link>
        </div>
        <div className="card">
          <span className="k">Attendance</span>
          <div className="big">{d.attendanceRate == null ? '—' : `${d.attendanceRate}%`}</div>
          <p className="sub">{d.marked.length ? `${d.attended} of ${d.marked.length} sessions${d.late ? ` · ${d.late} late` : ''}` : 'No classes marked yet'}</p>
          <Link className="more" to="/dashboard/attendance">See attendance <Icon name="arrow" /></Link>
        </div>
        <div className="card span2">
          <span className="k">Fees balance</span>
          <div className="big">{naira(balance)}</div>
          <p className="sub">{balance ? `${d.owing.length} payment${d.owing.length > 1 ? 's' : ''} left` : 'All paid. Thank you.'}</p>
          <Link className="more" to="/dashboard/payments">Payments <Icon name="arrow" /></Link>
        </div>
      </div>
      <div className="d-grid">
        <div className="panel">
          <div className="panel-h"><h2>Coming up</h2></div>
          {upcoming.length ? (
            <ul className="list">
              {upcoming.map((s) => (
                <li key={s.id}><span className="ib"><Icon name="calendar" /></span><div><div className="t">{s.topic || 'Class'}</div><div className="d">{fmtDay(s.date)} · {new Date(s.date).getDay() === 6 ? 'Saturday class and revision' : 'Class'}</div></div><span /></li>
              ))}
            </ul>
          ) : <Empty icon="calendar">No classes scheduled.</Empty>}
        </div>
        <News items={data.announcements} />
      </div>
      {modal?.pay && <PayModal payment={modal.pay} onClose={() => setModal(null)} onDone={reload} />}
      {modal?.cancel && <CancelPayModal payment={modal.cancel} onClose={() => setModal(null)} onDone={reload} />}
      {modal?.quiz && <QuizModal quizId={modal.quiz} onClose={() => setModal(null)} onDone={reload} />}
      {modal?.submit && <SubmitModal a={modal.submit} onClose={() => setModal(null)} onDone={reload} />}
    </div>
  );
}

export function News({ items = [] }) {
  return (
    <div className="panel">
      <div className="panel-h"><h2>Announcements</h2></div>
      {items.length ? (
        <ul className="news">
          {items.slice(0, 5).map((a) => (
            <li key={a.id}><span className="dt">{dayNum(a.createdAt)}<small>{monShort(a.createdAt)}</small></span><div><b>{a.title}</b><span>{a.body}</span><br /><span className="muted" style={{ fontSize: 12 }}>{fmtTime(a.createdAt)}</span></div></li>
          ))}
        </ul>
      ) : <Empty icon="megaphone">No announcements yet.</Empty>}
    </div>
  );
}
