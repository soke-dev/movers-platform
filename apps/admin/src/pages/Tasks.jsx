import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api, useApi, useToast, Icon, Modal, Table, Chip, Empty, Loading, ErrorBox, fmtDay, isoDate } from '@movers/ui';
import { PageHead, CohortSelect, useCohort, waTo } from '../shared.jsx';

const inDays = (n) => isoDate(new Date(Date.now() + n * 864e5));

export default function Tasks() {
  const { cohort } = useCohort();
  const { refreshCounts } = useOutletContext();
  const { data, error, loading, reload } = useApi(cohort ? `/admin/cohorts/${cohort.id}/assessments` : null);
  const [modal, setModal] = useState(null);
  if (!cohort) return <Empty icon="layers">Create a class first.</Empty>;
  const done = () => { reload(); refreshCounts(); };
  return (
    <div className="pg">
      <PageHead eyebrow={`${cohort.name} · ${cohort.code}`} title="Quizzes & tasks" desc="Set quizzes and projects, grade submissions, and remind anyone who hasn’t handed in.">
        <CohortSelect />
        <button className="btn line" onClick={() => setModal({ newAsg: true })}><Icon name="file" />Set a project</button>
        <button className="btn ink" onClick={() => setModal({ newQuiz: true })}><Icon name="plus" />Set a quiz</button>
      </PageHead>
      {loading ? <Loading /> : error ? <ErrorBox error={error} /> : (
        <>
          <div className="panel">
            <div className="panel-h"><h2>Quizzes</h2><span className="meta">{data.enrolled} students</span></div>
            {data.quizzes.length ? (
              <Table head={['Quiz', 'Closes', 'Taken', 'Average', 'Status', '']}>
                {data.quizzes.map((q) => {
                  const open = new Date(q.closesAt) >= new Date();
                  return (
                    <tr key={q.id}>
                      <td><b>{q.title}</b><div className="small">{q.questions} questions · {q.minutes} min</div></td>
                      <td>{fmtDay(q.closesAt)}</td>
                      <td className="mono">{q.taken}/{data.enrolled}</td>
                      <td className="mono">{q.average == null ? '—' : `${q.average.toFixed(1)} / ${q.questions}`}</td>
                      <td>{open ? <Chip kind="live">Open</Chip> : <Chip>Closed</Chip>}</td>
                      <td><button className="linkbtn" onClick={() => setModal({ results: q.id })}>Results</button></td>
                    </tr>
                  );
                })}
              </Table>
            ) : <Empty icon="quiz">No quizzes yet.</Empty>}
          </div>
          <div className="panel">
            <div className="panel-h"><h2>Projects</h2></div>
            {data.assignments.length ? (
              <Table head={['Project', 'Due', 'Submitted', 'To grade', '']}>
                {data.assignments.map((a) => (
                  <tr key={a.id}>
                    <td><b>{a.title}</b><div className="small">{a.skillName || 'General'} · out of {a.maxScore}</div></td>
                    <td>{fmtDay(a.dueAt)}</td>
                    <td className="mono">{a.submitted}/{data.enrolled}</td>
                    <td>{a.toGrade ? <Chip kind="due">{a.toGrade}</Chip> : <Chip kind="ok">0</Chip>}</td>
                    <td>{a.submitted > 0 && <button className={`btn ${a.toGrade ? 'ink' : 'soft'} sm`} onClick={() => setModal({ grade: a.id })}>{a.toGrade ? 'Grade' : 'View'}</button>}</td>
                  </tr>
                ))}
              </Table>
            ) : <Empty icon="file">No projects yet.</Empty>}
          </div>
        </>
      )}
      {modal?.newQuiz && <QuizBuilder cohort={cohort} onClose={() => setModal(null)} onDone={done} />}
      {modal?.newAsg && <AsgForm cohort={cohort} onClose={() => setModal(null)} onDone={done} />}
      {modal?.grade && <GradeModal id={modal.grade} onClose={() => setModal(null)} onDone={done} />}
      {modal?.results && <ResultsModal id={modal.results} onClose={() => setModal(null)} />}
    </div>
  );
}

function QuizBuilder({ cohort, onClose, onDone }) {
  const toast = useToast();
  const [f, setF] = useState({ title: '', closesAt: inDays(7), minutes: 10 });
  const [qs, setQs] = useState([{ text: '', options: ['', '', '', ''], answer: 0 }]);
  const [err, setErr] = useState('');
  const setQ = (i, patch) => setQs(qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const publish = async () => {
    setErr('');
    try {
      await api('/admin/quizzes', { method: 'POST', body: { cohortId: cohort.id, title: f.title, closesAt: f.closesAt, minutes: Number(f.minutes), questions: qs.map((q) => ({ ...q, options: q.options.filter((o) => o.trim()) })) } });
      toast(`Quiz published to ${cohort.code}. Students see it on their dashboard now.`);
      onDone();
      onClose();
    } catch (e) {
      setErr(e.message);
    }
  };
  return (
    <Modal title="Set a quiz" onClose={onClose} wide>
      <p className="small" style={{ marginTop: 6 }}>Students see it on their dashboard as soon as you publish.</p>
      <div className="fields">
        <div className="field wide"><label htmlFor="qb-t">Quiz title</label><input id="qb-t" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Cybersecurity basics" /></div>
        <div className="field"><label htmlFor="qb-d">Closes</label><input id="qb-d" type="date" min={isoDate()} value={f.closesAt} onChange={(e) => setF({ ...f, closesAt: e.target.value })} /></div>
        <div className="field"><label htmlFor="qb-m">Time limit (minutes)</label><input id="qb-m" type="number" min="1" max="180" value={f.minutes} onChange={(e) => setF({ ...f, minutes: e.target.value })} /></div>
      </div>
      {qs.map((q, i) => (
        <div key={i} className="panel" style={{ marginTop: 12, padding: 14 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Question {i + 1} · tick the right answer</span>{qs.length > 1 && <button className="btn ghost sm" aria-label={`Remove question ${i + 1}`} onClick={() => setQs(qs.filter((_, j) => j !== i))}><Icon name="trash" /></button>}</div>
          <div className="field" style={{ marginTop: 8 }}><input aria-label={`Question ${i + 1}`} value={q.text} onChange={(e) => setQ(i, { text: e.target.value })} placeholder="Type the question" /></div>
          {q.options.map((o, k) => (
            <div key={k} className="row" style={{ marginTop: 8, flexWrap: 'nowrap' }}>
              <input type="radio" name={`ans${i}`} aria-label="Correct answer" checked={q.answer === k} onChange={() => setQ(i, { answer: k })} style={{ width: 18, height: 18, accentColor: 'var(--ok)' }} />
              <div className="field" style={{ flex: 1 }}><input aria-label={`Option ${k + 1}`} value={o} onChange={(e) => setQ(i, { options: q.options.map((x, j) => (j === k ? e.target.value : x)) })} placeholder={`Option ${k + 1}`} /></div>
            </div>
          ))}
        </div>
      ))}
      <button className="btn line sm" style={{ marginTop: 12 }} onClick={() => setQs([...qs, { text: '', options: ['', '', '', ''], answer: 0 }])}><Icon name="plus" />Add question</button>
      {err && <p className="err" style={{ marginTop: 10 }}>{err}</p>}
      <div className="sheet-foot"><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn ink" onClick={publish}>Publish quiz</button></div>
    </Modal>
  );
}

function AsgForm({ cohort, onClose, onDone }) {
  const toast = useToast();
  const skills = useApi('/admin/skills');
  const [f, setF] = useState({ title: '', skillName: '', dueAt: inDays(7), maxScore: 100, instructions: '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    try {
      await api('/admin/assignments', { method: 'POST', body: { ...f, cohortId: cohort.id, maxScore: Number(f.maxScore) } });
      toast(`Project published to ${cohort.code}.`);
      onDone();
      onClose();
    } catch (x) {
      setErr(x.message);
    }
  };
  return (
    <Modal title="Set a project" onClose={onClose} wide>
      <form onSubmit={save}>
        <div className="fields">
          <div className="field wide"><label htmlFor="a-t">Title</label><input id="a-t" required value={f.title} onChange={set('title')} placeholder="e.g. Secure the bookshop API" /></div>
          <div className="field"><label htmlFor="a-s">Skill</label><select id="a-s" value={f.skillName} onChange={set('skillName')}><option value="">General (everyone)</option>{(skills.data?.skills || []).map((s) => <option key={s.id}>{s.name}</option>)}</select></div>
          <div className="field"><label htmlFor="a-d">Due date</label><input id="a-d" type="date" required value={f.dueAt} onChange={set('dueAt')} /></div>
          <div className="field"><label htmlFor="a-m">Marked out of</label><input id="a-m" type="number" min="1" value={f.maxScore} onChange={set('maxScore')} /></div>
          <div className="field wide"><label htmlFor="a-i">Instructions</label><textarea id="a-i" value={f.instructions} onChange={set('instructions')} placeholder="What to build and what to hand in" /></div>
        </div>
        <p className="small" style={{ marginTop: 10 }}>Single-skill students only see projects for their skills, plus general ones.</p>
        {err && <p className="err" style={{ marginTop: 10 }}>{err}</p>}
        <div className="sheet-foot"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn ink">Publish project</button></div>
      </form>
    </Modal>
  );
}

function GradeModal({ id, onClose, onDone }) {
  const toast = useToast();
  const { data, error, loading, reload } = useApi(`/admin/assignments/${id}/submissions`);
  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState({});
  const save = async (s, body) => {
    try {
      await api(`/admin/submissions/${s.id}`, { method: 'PATCH', body });
      toast(body.changesRequested ? `Asked ${s.user.name} for changes.` : `Saved ${s.user.name}’s grade.`);
      reload();
      onDone();
    } catch (e) {
      toast(e.message, true);
    }
  };
  return (
    <Modal title={data ? `Grade: ${data.assignment.title}` : 'Grade'} onClose={onClose} wide>
      {loading ? <Loading /> : error ? <ErrorBox error={error} /> : (
        <ul className="list" style={{ marginTop: 14 }}>
          {[...data.submissions].sort((a, b) => (a.score == null ? 0 : 1) - (b.score == null ? 0 : 1)).map((s) => (
            <li key={s.id} style={{ gridTemplateColumns: 'minmax(0,1fr)', gap: 8 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div><b>{s.user.name}</b> {s.changesRequested ? <Chip kind="due">Changes requested</Chip> : s.score != null ? <Chip kind="ok">{s.score} / {data.assignment.maxScore}</Chip> : <Chip kind="wait">To grade</Chip>}<div className="small"><a href={s.repoUrl} target="_blank" rel="noreferrer">{s.repoUrl}</a>{s.liveUrl && <> · <a href={s.liveUrl} target="_blank" rel="noreferrer">live</a></>}{s.note && ` · “${s.note}”`}</div></div>
              </div>
              <div className="row">
                <div className="field" style={{ width: 110 }}><input type="number" min="0" max={data.assignment.maxScore} aria-label={`Score for ${s.user.name}`} placeholder="Score" value={scores[s.id] ?? s.score ?? ''} onChange={(e) => setScores({ ...scores, [s.id]: e.target.value })} /></div>
                <div className="field" style={{ flex: 1, minWidth: 180 }}><input aria-label={`Feedback for ${s.user.name}`} placeholder="Feedback (optional)" value={notes[s.id] ?? s.feedback ?? ''} onChange={(e) => setNotes({ ...notes, [s.id]: e.target.value })} /></div>
                <button className="btn ink sm" onClick={() => save(s, { score: scores[s.id] === '' || scores[s.id] == null ? s.score : Number(scores[s.id]), feedback: notes[s.id] ?? s.feedback, changesRequested: false })}>Save grade</button>
                <button className="btn soft sm" onClick={() => save(s, { changesRequested: true, feedback: notes[s.id] ?? s.feedback })}>Request changes</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function ResultsModal({ id, onClose }) {
  const { data, error, loading } = useApi(`/admin/quizzes/${id}/results`);
  return (
    <Modal title={data ? `${data.quiz.title}: results` : 'Results'} onClose={onClose} wide>
      {loading ? <Loading /> : error ? <ErrorBox error={error} /> : (
        <>
          <p className="small" style={{ marginTop: 6 }}>{data.attempts.length} taken · {data.notTaken.length} not yet</p>
          <ul className="list" style={{ marginTop: 12 }}>
            {data.attempts.map((a) => <li key={a.user.id}><span className="ib"><Icon name="check" /></span><div><div className="t">{a.user.name}</div><div className="d">{fmtDay(a.at)}</div></div><Chip kind={a.score / a.total >= 0.5 ? 'ok' : 'due'}>{a.score} / {a.total}</Chip></li>)}
            {data.notTaken.map((u) => <li key={u.id}><span className="ib"><Icon name="clock" /></span><div><div className="t">{u.name}</div><div className="d">Not taken</div></div>{u.phone ? <a className="linkbtn" target="_blank" rel="noreferrer" href={waTo(u.phone, `Hello ${u.name.split(' ')[0]}, a reminder from Movers Learn: the quiz “${data.quiz.title}” is open on your dashboard.`)}>Remind</a> : <span />}</li>)}
          </ul>
        </>
      )}
    </Modal>
  );
}
