import { useState } from 'react';
import { useApi, Icon, Table, Chip, Empty, Loading, ErrorBox, naira } from '@movers/ui';
import { PageHead, CohortSelect, useCohort, waTo } from '../shared.jsx';

export default function Students() {
  const { cohort } = useCohort();
  const { data, error, loading } = useApi(cohort ? `/admin/cohorts/${cohort.id}/students` : null);
  const [q, setQ] = useState('');
  const [f, setF] = useState('all');
  if (!cohort) return <Empty icon="layers">Create a class first.</Empty>;
  const rows = (data?.students || []).filter((s) =>
    (f === 'all' || (f === 'owing' && s.owed > 0) || (f === 'low' && s.attendance != null && s.attendance < 80) || (f === 'single' && s.kind === 'SINGLE') || (f === 'unsecured' && !s.secured)) &&
    `${s.user.name} ${s.user.email} ${s.user.phone}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="pg">
      <PageHead eyebrow="Movers Learn" title="Students"><CohortSelect /></PageHead>
      <div className="toolbar">
        <label className="search"><Icon name="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name" aria-label="Search students" /></label>
        <div className="tabs" role="tablist">
          {[['all', 'All'], ['owing', 'Owing'], ['unsecured', 'Not paid yet'], ['low', 'Below 80%'], ['single', 'Single-skill']].map(([k, l]) => <button key={k} role="tab" aria-selected={f === k} onClick={() => setF(k)}>{l}</button>)}
        </div>
      </div>
      <div className="panel">
        {loading ? <Loading /> : error ? <ErrorBox error={error} /> : rows.length ? (
          <Table head={['Student', 'Enrolled in', 'Attendance', 'Projects', 'Paid', 'Owes', '']}>
            {rows.map((s) => (
              <tr key={s.enrollmentId}>
                <td><b>{s.user.name}</b><div className="small">{s.user.phone || s.user.email}</div></td>
                <td>{s.kind === 'FULL' ? `Full class${s.plan === 'TWO' ? ' · two payments' : ''}` : s.skills.join(', ')}</td>
                <td>{s.attendance == null ? '—' : <span className="mono" style={{ color: s.attendance < 80 ? 'var(--due)' : 'inherit' }}>{s.attendance}%</span>}</td>
                <td className="mono">{s.projects} / {s.projectsTotal}</td>
                <td className="amt">{naira(s.paid)}</td>
                <td>{s.owed ? (s.pendingConfirmation ? <Chip kind="wait">{naira(s.owed)} · confirming</Chip> : <Chip kind="due">{naira(s.owed)}</Chip>) : <Chip kind="ok">Paid up</Chip>}</td>
                <td>{s.user.phone && <a className="linkbtn" target="_blank" rel="noreferrer" href={waTo(s.user.phone, `Hello ${s.user.name.split(' ')[0]}, this is Movers Learn.`)}>WhatsApp</a>}</td>
              </tr>
            ))}
          </Table>
        ) : <Empty icon="users">No students match.</Empty>}
      </div>
    </div>
  );
}
