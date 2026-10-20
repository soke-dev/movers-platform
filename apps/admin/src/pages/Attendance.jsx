import { useEffect, useState } from 'react';
import { api, useApi, useToast, Table, Empty, Loading, ErrorBox, fmtDay, fmtTime } from '@movers/ui';
import { PageHead, CohortSelect, useCohort } from '../shared.jsx';

const MARKS = [['PRESENT', 'Present', 'var(--violet)'], ['LATE', 'Late', 'var(--amber)'], ['ABSENT', 'Absent', 'var(--pink)']];

export default function Attendance() {
  const { cohort } = useCohort();
  const toast = useToast();
  const sessions = useApi(cohort ? `/admin/cohorts/${cohort.id}/sessions` : null);
  const [sid, setSid] = useState('');
  const list = sessions.data?.sessions || [];
  useEffect(() => {
    if (!list.length) return;
    const today = new Date(new Date().setHours(23, 59, 59));
    const pick = [...list].reverse().find((s) => new Date(s.date) <= today) || list[0];
    setSid(pick.id);
  }, [sessions.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const detail = useApi(sid ? `/admin/sessions/${sid}` : null);
  const [marks, setMarks] = useState({});
  useEffect(() => {
    if (detail.data) setMarks(Object.fromEntries(detail.data.roster.map((r) => [r.user.id, r.status])));
  }, [detail.data]);

  if (!cohort) return <Empty icon="layers">Create a class first.</Empty>;
  const roster = detail.data?.roster || [];
  const counts = { PRESENT: 0, LATE: 0, ABSENT: 0 };
  Object.values(marks).forEach((m) => m && counts[m]++);
  const save = async () => {
    try {
      const body = { marks: Object.entries(marks).filter(([, s]) => s).map(([userId, status]) => ({ userId, status })) };
      const r = await api(`/admin/sessions/${sid}/attendance`, { method: 'PUT', body });
      toast(`Saved attendance for ${r.saved} students.`);
      detail.reload();
      sessions.reload();
    } catch (e) {
      toast(e.message, true);
    }
  };
  return (
    <div className="pg">
      <PageHead eyebrow={`${cohort.name} · ${cohort.code}`} title="Attendance" desc="Mark each class. Late counts as attended; 80% is needed for the certificate.">
        <CohortSelect />
        <select className="select" aria-label="Class session" value={sid} onChange={(e) => setSid(e.target.value)}>
          {list.map((s) => <option key={s.id} value={s.id}>{fmtDay(s.date)}{s.topic ? ` · ${s.topic}` : ''}{s.marked ? ` · ${s.marked} marked` : ''}</option>)}
        </select>
      </PageHead>
      <div className="kpis">
        <div className="card"><span className="k">Present</span><div className="big" style={{ color: 'var(--violet)' }}>{counts.PRESENT}</div></div>
        <div className="card"><span className="k">Late</span><div className="big" style={{ color: 'var(--wait)' }}>{counts.LATE}</div></div>
        <div className="card"><span className="k">Absent</span><div className="big" style={{ color: 'var(--due)' }}>{counts.ABSENT}</div></div>
        <div className="card"><span className="k">Not marked</span><div className="big">{roster.length - counts.PRESENT - counts.LATE - counts.ABSENT}</div></div>
      </div>
      <div className="panel">
        <div className="panel-h">
          <h2>{detail.data ? `${fmtDay(detail.data.session.date)} · week ${detail.data.session.week}` : 'Roster'}</h2>
          <div className="row">
            <button className="btn soft sm" onClick={() => setMarks(Object.fromEntries(roster.map((r) => [r.user.id, marks[r.user.id] || 'PRESENT'])))}>Mark the rest present</button>
            <button className="btn ink sm" onClick={save} disabled={!roster.length}>Save attendance</button>
          </div>
        </div>
        {detail.loading && sid ? <Loading /> : detail.error ? <ErrorBox error={detail.error} /> : roster.length ? (
          <Table head={['Student', 'Enrolled', 'Marked at', 'Mark']}>
            {roster.map((r) => (
              <tr key={r.user.id}>
                <td><b>{r.user.name}</b></td>
                <td>{r.kind === 'FULL' ? 'Full class' : 'Single skill'}</td>
                <td className="tm">{r.checkedInAt ? fmtTime(r.checkedInAt) : '—'}</td>
                <td>
                  <span style={{ display: 'inline-grid', gridTemplateColumns: 'repeat(3,auto)', border: '1.5px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
                    {MARKS.map(([k, l, c]) => (
                      <button key={k} aria-pressed={marks[r.user.id] === k} onClick={() => setMarks({ ...marks, [r.user.id]: k })}
                        style={{ border: 0, borderLeft: k === 'PRESENT' ? 0 : '1.5px solid var(--line)', padding: '7px 10px', font: '700 12px var(--f-body)', cursor: 'pointer', background: marks[r.user.id] === k ? c : 'var(--paper)', color: marks[r.user.id] === k ? (k === 'LATE' ? 'var(--ink)' : '#fff') : 'var(--ink-3)' }}>{l}</button>
                    ))}
                  </span>
                </td>
              </tr>
            ))}
          </Table>
        ) : <Empty icon="users">No students expected in this class.</Empty>}
      </div>
    </div>
  );
}
