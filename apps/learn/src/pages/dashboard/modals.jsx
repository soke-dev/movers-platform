import { useEffect, useRef, useState } from 'react';
import { api, Modal, PayFlow, Icon, Loading, ErrorBox, fmtDay, useToast } from '@movers/ui';

export function PayModal({ payment, onClose, onDone }) {
  return (
    <Modal title="Pay now" onClose={onClose}>
      <PayFlow
        payment={payment}
        lines={[[payment.description, payment.amount]]}
        returnUrl={`${window.location.origin}/payments/callback`}
        finishLabel="Back to payments"
        onFinish={() => {
          onDone?.();
          onClose();
        }}
      />
    </Modal>
  );
}

export function SubmitModal({ a, onClose, onDone }) {
  const toast = useToast();
  const s = a.submission;
  const [f, setF] = useState({ repoUrl: s?.repoUrl || '', liveUrl: s?.liveUrl || '', note: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await api(`/learn/assignments/${a.id}/submit`, { method: 'POST', body: f });
      toast('Submitted. Your instructor has been notified.');
      onDone();
      onClose();
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={`${s?.changesRequested ? 'Resubmit' : 'Submit'}: ${a.title}`} onClose={onClose}>
      <p className="small" style={{ marginTop: 6 }}>{a.skillName ? `${a.skillName} · ` : ''}due {fmtDay(a.dueAt)}, 23:59 · out of {a.maxScore}</p>
      {s?.feedback && <div className="note" style={{ marginTop: 12 }}><Icon name="chat" /><span><b>Your instructor:</b> {s.feedback}</span></div>}
      {a.instructions && <p style={{ marginTop: 12, color: 'var(--ink-2)' }}>{a.instructions}</p>}
      <form onSubmit={submit}>
        <div className="fields">
          <div className="field wide"><label htmlFor="sb-repo">GitHub repository</label><input id="sb-repo" type="url" required placeholder="https://github.com/you/project" value={f.repoUrl} onChange={(e) => setF({ ...f, repoUrl: e.target.value })} /></div>
          <div className="field wide"><label htmlFor="sb-live">Live link (optional)</label><input id="sb-live" type="url" placeholder="https://your-project.vercel.app" value={f.liveUrl} onChange={(e) => setF({ ...f, liveUrl: e.target.value })} /></div>
          <div className="field wide"><label htmlFor="sb-note">Note for your instructor (optional)</label><input id="sb-note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Anything you got stuck on" /></div>
        </div>
        {err && <p className="err" style={{ marginTop: 10 }}>{err}</p>}
        <div className="sheet-foot"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn pink" disabled={busy}>{busy ? 'Submitting…' : 'Submit project'}</button></div>
      </form>
    </Modal>
  );
}

export function QuizModal({ quizId, onClose, onDone }) {
  const [quiz, setQuiz] = useState(null);
  const [error, setError] = useState(null);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [left, setLeft] = useState(0);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const submitted = useRef(false);

  useEffect(() => {
    api(`/learn/quizzes/${quizId}`).then(({ quiz }) => {
      setQuiz(quiz);
      setAnswers(quiz.questions.map(() => -1));
      setLeft(quiz.minutes * 60);
    }).catch(setError);
  }, [quizId]);

  async function finish(final = answers) {
    if (submitted.current) return;
    submitted.current = true;
    setBusy(true);
    try {
      setResult(await api(`/learn/quizzes/${quizId}/attempt`, { method: 'POST', body: { answers: final } }));
      onDone();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!quiz || result) return;
    if (left <= 0) {
      finish();
      return;
    }
    const t = setTimeout(() => setLeft((x) => x - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, quiz, result]);

  if (error) return <Modal title="Quiz" onClose={onClose}><div style={{ marginTop: 14 }}><ErrorBox error={error} /></div></Modal>;
  if (!quiz) return <Modal onClose={onClose}><Loading /></Modal>;
  if (result) {
    const r = result.score / result.total;
    return (
      <Modal onClose={onClose}>
        <div className="done">
          <span className="tick"><Icon name="award" /></span>
          <h3 id="mTitle">You scored {result.score} / {result.total}</h3>
          <p>{r >= 0.8 ? 'Great work.' : r >= 0.5 ? 'Good effort. Review the ones you missed.' : 'Bring your questions to the Saturday class.'}</p>
          <ul className="qres">
            {result.review.map((q, k) => (
              <li key={k}><span className="bx" style={{ background: q.chosen === q.answer ? 'var(--ok)' : 'var(--pink)' }}><Icon name={q.chosen === q.answer ? 'check' : 'x'} /></span><span>{q.text}<small>Answer: {q.options[q.answer]}</small></span></li>
            ))}
          </ul>
          <button className="btn ink lg" onClick={onClose}>Done</button>
        </div>
      </Modal>
    );
  }
  const q = quiz.questions[i];
  const last = i === quiz.questions.length - 1;
  return (
    <Modal onClose={onClose}>
      <div className="qprog">{quiz.questions.map((_, k) => <i key={k} className={k <= i ? 'on' : ''} />)}</div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow">{quiz.title} · question {i + 1} of {quiz.questions.length}</span>
        <span className="timer">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')} left</span>
      </div>
      <p className="qtext" id="mTitle">{q.text}</p>
      <div className="opts" style={{ marginTop: 14 }}>
        {q.options.map((o, k) => (
          <label className="opt" key={k} style={{ gridTemplateColumns: 'auto minmax(0,1fr)' }}>
            <input type="radio" name={`q${i}`} checked={answers[i] === k} onChange={() => setAnswers(answers.map((a, j) => (j === i ? k : a)))} />
            <div><b style={{ fontWeight: 600 }}>{o}</b></div>
          </label>
        ))}
      </div>
      <div className="sheet-foot">
        {i > 0 && <button className="btn ghost" onClick={() => setI(i - 1)}>Back</button>}
        <button className={`btn ${last ? 'pink' : 'ink'}`} disabled={answers[i] < 0 || busy} onClick={() => (last ? finish() : setI(i + 1))}>{last ? (busy ? 'Marking…' : 'Submit quiz') : 'Next'}</button>
      </div>
    </Modal>
  );
}
