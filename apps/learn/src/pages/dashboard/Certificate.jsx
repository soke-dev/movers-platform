import { Icon, Chip, Logo, useAuth, fmtDate } from '@movers/ui';
import { useLearn } from './Dashboard.jsx';
import { NotEnrolled } from './Course.jsx';

export default function Certificate() {
  const { data, d } = useLearn();
  const { user } = useAuth();
  if (!data.enrollment) return <NotEnrolled />;
  const c = data.cohort;
  const demoDone = new Date(c.demoDate) < new Date();
  const checks = [
    ['Attendance of 80% or more', d.attendanceRate == null ? 'No classes marked yet' : `You are at ${d.attendanceRate}%`, (d.attendanceRate ?? 0) >= 80],
    ['All projects submitted', `${d.submitted} of ${data.assignments.length} so far`, data.assignments.length > 0 && d.submitted >= data.assignments.length],
    ['Project presented at Demo Day', fmtDate(c.demoDate), demoDone],
    ['Fees fully paid', d.feesCleared ? 'Cleared' : 'Something is still due', d.feesCleared]
  ];
  const done = checks.filter((x) => x[2]).length;
  return (
    <div className="pg">
      <div className="pg-h"><div><p className="eyebrow">Issued after Demo Day</p><h1>Certificate</h1><p className="desc">Tick off all four and your certificate unlocks after Demo Day on {fmtDate(c.demoDate)}.</p></div></div>
      <div className="d-grid">
        <div className="panel">
          <div className="panel-h"><h2>Checklist</h2><span className="meta">{done} of 4 done</span></div>
          <ul className="checks">
            {checks.map(([t, s, ok]) => (
              <li key={t} className={ok ? 'done' : ''}><span className="bx"><Icon name="check" /></span><div><b>{t}</b><span>{s}</span></div></li>
            ))}
          </ul>
        </div>
        <div className="cert">
          <span style={{ position: 'absolute', right: 16, top: 16 }}><Chip kind={done === 4 ? 'ok' : 'lock'}>{done === 4 ? 'Earned' : 'Locked'}</Chip></span>
          <span className="brand"><Logo /><span>movers <b>learn</b></span></span>
          <p className="ct">Certificate of Completion</p>
          <p className="small" style={{ marginTop: 12 }}>This certifies that</p>
          <p className="nm">{user.name}</p>
          <p className="small" style={{ marginTop: 8 }}>completed {data.enrollment.kind === 'FULL' ? `the ${c.name}` : data.enrollment.skills.map((s) => s.name).join(', ')}, {c.code}, and presented a project at Demo Day.</p>
          <p className="small muted" style={{ marginTop: 20 }}>Benin City · {fmtDate(c.demoDate)}</p>
        </div>
      </div>
    </div>
  );
}
