import { Link } from 'react-router-dom';
import { Icon, Chip, fmtDay, fmtDate, weekLabel, COLORS } from '@movers/ui';
import { useLearn } from './Dashboard.jsx';
import { weekSpan } from '../Landing.jsx';

export default function Course() {
  const { data, d } = useLearn();
  if (!data.enrollment) return <NotEnrolled />;
  const c = data.cohort;
  const e = data.enrollment;
  const mine = e.kind === 'FULL' ? data.skills : e.skills;
  const status = (s) => (d.week > s.weekEnd ? 'done' : d.week >= s.weekStart ? 'now' : 'later');
  const ordered = [...mine].sort((a, b) => a.weekStart - b.weekStart || a.weekEnd - b.weekEnd);
  return (
    <div className="pg">
      <div className="pg-h">
        <div>
          <p className="eyebrow">{c.code} · {fmtDate(c.startDate)} – {fmtDate(c.demoDate)}</p>
          <h1>{e.kind === 'FULL' ? c.name : 'Your skills'}</h1>
          <p className="desc">{c.scheduleText}, {c.location}. {c.saturdayNote ? `${c.saturdayNote}.` : ''}</p>
        </div>
      </div>
      <div className="stats">
        <div className="card"><span className="k">Progress</span><div className="big">{d.progress}%</div><p className="sub">{d.week > 0 ? `Week ${d.week} of ${c.weeks}` : `Starts ${fmtDay(c.startDate)}`}</p></div>
        <div className="card"><span className="k">Skills done</span><div className="big">{mine.filter((s) => status(s) === 'done').length} / {mine.length}</div><p className="sub">{mine.filter((s) => status(s) === 'now').map((s) => s.name).join(', ') || '—'}</p></div>
        <div className="card"><span className="k">Project average</span><div className="big">{d.average == null ? '—' : `${d.average}%`}</div><p className="sub">{d.graded.length} graded</p></div>
        <div className="card"><span className="k">Demo Day</span><div className="big">{fmtDay(c.demoDate)}</div><p className="sub">Movers Space hall</p></div>
      </div>
      <div className="panel">
        <div className="panel-h"><h2>{e.kind === 'FULL' ? `The ${mine.length} skills` : 'Your skills'}</h2><span className="meta">In the order they’re taught</span></div>
        <ul className="list">
          {ordered.map((s) => {
            const st = status(s);
            const [fg, bg] = COLORS[s.color] || COLORS.violet;
            return (
              <li key={s.id}>
                <span className="ib" style={{ background: bg, color: fg }}><Icon name={s.icon} /></span>
                <div><div className="t">{s.name}</div><div className="d">{weekLabel(s.weekStart, s.weekEnd)} · {weekSpan(c.startDate, s.weekStart, s.weekEnd)} · {s.topics.join(' · ')}</div></div>
                {st === 'done' ? <Chip kind="ok">Done</Chip> : st === 'now' ? <Chip kind="live">This week</Chip> : <Chip kind="lock">{weekLabel(s.weekStart, s.weekEnd)}</Chip>}
              </li>
            );
          })}
          <li><span className="ib" style={{ background: 'var(--lime)' }}><Icon name="award" /></span><div><div className="t">Demo Day</div><div className="d">{fmtDay(c.demoDate)} · Movers Space hall</div></div><Chip kind="lock">Finale</Chip></li>
        </ul>
      </div>
      <div className="panel">
        <div className="panel-h"><h2>Good to know</h2></div>
        <ul className="list">
          <li><span className="ib"><Icon name="laptop" /></span><div><div className="t">Bring your laptop</div><div className="d">{c.laptopNote}</div></div><span /></li>
          {c.supportNote && <li><span className="ib"><Icon name="chat" /></span><div><div className="t">{c.supportNote}</div><div className="d">Ask questions between classes.</div></div><span /></li>}
          {c.mentorshipNote && <li><span className="ib"><Icon name="users" /></span><div><div className="t">{c.mentorshipNote}</div><div className="d">Starts after Demo Day.</div></div><span /></li>}
        </ul>
      </div>
    </div>
  );
}

export function NotEnrolled() {
  return (
    <div className="pg">
      <div className="panel attn">
        <div className="panel-h"><h2>You’re not in a class yet</h2></div>
        <p style={{ color: 'var(--ink-2)' }}>Join the full class or pick single skills to see this page.</p>
        <div className="row" style={{ marginTop: 16 }}><Link className="btn pink" to="/apply?kind=full">Join the class</Link></div>
      </div>
    </div>
  );
}
