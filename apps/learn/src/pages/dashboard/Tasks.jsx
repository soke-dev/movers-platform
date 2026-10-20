import { useState } from 'react';
import { Icon, Chip, Empty, fmtDay, dueText, daysUntil } from '@movers/ui';
import { useLearn } from './Dashboard.jsx';
import { QuizModal, SubmitModal } from './modals.jsx';
import { NotEnrolled } from './Course.jsx';

export default function Tasks() {
  const { data, d, reload } = useLearn();
  const [modal, setModal] = useState(null);
  if (!data.enrollment) return <NotEnrolled />;
  const taken = data.quizzes.filter((q) => q.attempt);
  const quizAvg = taken.length ? Math.round((taken.reduce((s, q) => s + q.attempt.score / q.attempt.total, 0) / taken.length) * 100) : null;

  const asgState = (a) => {
    const s = a.submission;
    if (s?.changesRequested) return { chip: <Chip kind="due">Changes requested</Chip>, btn: 'Resubmit' };
    if (s?.score != null) return { chip: <Chip kind="ok">{s.score} / {a.maxScore}</Chip> };
    if (s) return { chip: <Chip kind="wait">In review</Chip> };
    if (daysUntil(a.dueAt) < 0) return { chip: <Chip kind="due">Missed</Chip>, btn: 'Submit late' };
    return { chip: <Chip kind={daysUntil(a.dueAt) <= 7 ? 'due' : 'lock'}>{dueText(a.dueAt)}</Chip>, btn: 'Submit' };
  };

  return (
    <div className="pg">
      <div className="pg-h"><div><p className="eyebrow">{data.cohort.code}</p><h1>Quizzes &amp; tasks</h1><p className="desc">Quizzes are timed and marked straight away. Projects are submitted as a GitHub link and a live link, and graded by your instructor.</p></div></div>
      <div className="stats">
        <div className="card"><span className="k">Projects in</span><div className="big">{d.submitted} / {data.assignments.length}</div><p className="sub">All count towards your certificate</p></div>
        <div className="card"><span className="k">Project average</span><div className="big">{d.average == null ? '—' : `${d.average}%`}</div><p className="sub">{d.graded.length} graded</p></div>
        <div className="card"><span className="k">Quizzes taken</span><div className="big">{taken.length} / {data.quizzes.length}</div><p className="sub">{d.openQuizzes.length} open now</p></div>
        <div className="card"><span className="k">Quiz average</span><div className="big">{quizAvg == null ? '—' : `${quizAvg}%`}</div><p className="sub">Across {taken.length} quizzes</p></div>
      </div>
      <div className="panel">
        <div className="panel-h"><h2>Quizzes</h2><span className="meta">Take each one once before it closes</span></div>
        {data.quizzes.length ? (
          <ul className="list">
            {data.quizzes.map((q) => {
              const open = new Date(q.closesAt) >= new Date();
              return (
                <li key={q.id}>
                  <span className="ib"><Icon name="quiz" /></span>
                  <div><div className="t">{q.title}</div><div className="d">{q.questionCount} questions · {q.minutes} min · {open ? 'closes' : 'closed'} {fmtDay(q.closesAt)}</div></div>
                  {q.attempt ? <Chip kind="ok">{q.attempt.score} / {q.attempt.total}</Chip> : open ? <button className="btn ink sm" onClick={() => setModal({ quiz: q.id })}>Start quiz</button> : <Chip kind="due">Missed</Chip>}
                </li>
              );
            })}
          </ul>
        ) : <Empty icon="quiz">No quizzes yet.</Empty>}
      </div>
      <div className="panel">
        <div className="panel-h"><h2>Projects</h2></div>
        {data.assignments.length ? (
          <ul className="list">
            {data.assignments.map((a) => {
              const st = asgState(a);
              return (
                <li key={a.id}>
                  <span className="ib"><Icon name="file" /></span>
                  <div><div className="t">{a.title}</div><div className="d">{a.skillName ? `${a.skillName} · ` : ''}due {fmtDay(a.dueAt)}{a.submission?.feedback ? ` · “${a.submission.feedback}”` : ''}</div></div>
                  <div className="act">{st.chip}{st.btn && <button className={`btn ${st.btn === 'Resubmit' ? 'pink' : 'line'} sm`} onClick={() => setModal({ submit: a })}>{st.btn}</button>}</div>
                </li>
              );
            })}
          </ul>
        ) : <Empty icon="file">No projects set yet.</Empty>}
      </div>
      {modal?.quiz && <QuizModal quizId={modal.quiz} onClose={() => setModal(null)} onDone={reload} />}
      {modal?.submit && <SubmitModal a={modal.submit} onClose={() => setModal(null)} onDone={reload} />}
    </div>
  );
}
