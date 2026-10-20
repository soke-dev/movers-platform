import { Chip, Table, Empty, fmtDay, fmtTime } from '@movers/ui';
import { useLearn } from './Dashboard.jsx';
import { NotEnrolled } from './Course.jsx';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Attendance() {
  const { data, d } = useLearn();
  if (!data.enrollment) return <NotEnrolled />;
  const c = data.cohort;
  const sessions = data.sessions;
  const days = c.days;
  const weeks = c.weeks;
  const today = new Date(new Date().setHours(0, 0, 0, 0));
  const byKey = new Map(sessions.map((s) => [`${s.week}-${new Date(s.date).getDay()}`, s]));
  const next = d.nextClass?.id;
  const past = sessions.filter((s) => new Date(s.date) <= new Date()).reverse();

  return (
    <div className="pg">
      <div className="pg-h"><div><p className="eyebrow">{c.code} · {c.scheduleText}</p><h1>Attendance</h1><p className="desc">Marked when you arrive. You need 80% for your certificate. {c.saturdayNote ? `Missed a session? ${c.saturdayNote}.` : ''}</p></div></div>
      <div className="stats">
        <div className="card"><span className="k">Attendance</span><div className="big">{d.attendanceRate == null ? '—' : `${d.attendanceRate}%`}</div><p className="sub">Late counts as attended</p></div>
        <div className="card"><span className="k">Present</span><div className="big" style={{ color: 'var(--violet)' }}>{d.marked.filter((s) => s.status === 'PRESENT').length}</div><p className="sub">On time</p></div>
        <div className="card"><span className="k">Late</span><div className="big" style={{ color: 'var(--wait)' }}>{d.late}</div><p className="sub">After start time</p></div>
        <div className="card"><span className="k">Absent</span><div className="big" style={{ color: 'var(--due)' }}>{d.absent}</div><p className="sub">Catch up on Saturday</p></div>
      </div>
      <div className="panel">
        <div className="panel-h"><h2>Sessions by week</h2><span className="meta">{sessions.length} sessions</span></div>
        <div className="att" style={{ gridTemplateColumns: `40px repeat(${weeks}, minmax(0,1fr))` }}>
          <span />
          {Array.from({ length: weeks }, (_, i) => <span key={i} className="wk">W{i + 1}</span>)}
          {days.map((dow) => [
            <span key={`l${dow}`} className="lab">{DOW[dow]}</span>,
            ...Array.from({ length: weeks }, (_, w) => {
              const s = byKey.get(`${w + 1}-${dow}`);
              if (!s) return <span key={`${dow}-${w}`} className="c none" />;
              const isPast = new Date(s.date) < today;
              const cls = s.status ? s.status : s.id === next ? 'up' : isPast ? 'none' : 'up';
              return <span key={s.id} className={`c ${cls}`} title={`${fmtDay(s.date)}${s.status ? `: ${s.status.toLowerCase()}` : ''}`} style={s.id === next ? { border: '2px solid var(--violet)' } : undefined} />;
            })
          ])}
        </div>
        <div className="legend">
          <span><i style={{ background: 'var(--violet)' }} />Present</span><span><i style={{ background: 'var(--amber)' }} />Late</span><span><i style={{ background: 'var(--pink)' }} />Absent</span><span><i style={{ border: '1.5px dashed var(--ink-3)' }} />Upcoming</span>
        </div>
      </div>
      <div className="panel">
        <div className="panel-h"><h2>Check-in log</h2><span className="meta">Most recent first</span></div>
        {past.length ? (
          <Table head={['Date', 'Topic', 'Checked in', 'Status']}>
            {past.map((s) => (
              <tr key={s.id}>
                <td>{fmtDay(s.date)}</td>
                <td>{s.topic || 'Class'}</td>
                <td className="tm">{s.checkedInAt ? fmtTime(s.checkedInAt) : '—'}</td>
                <td>{s.status === 'PRESENT' ? <Chip kind="ok">Present</Chip> : s.status === 'LATE' ? <Chip kind="wait">Late</Chip> : s.status === 'ABSENT' ? <Chip kind="due">Absent</Chip> : <Chip>Not marked</Chip>}</td>
              </tr>
            ))}
          </Table>
        ) : <Empty icon="calendar">Your first class is on {fmtDay(c.startDate)}.</Empty>}
      </div>
    </div>
  );
}
