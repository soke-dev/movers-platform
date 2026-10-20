import { useState } from 'react';
import { useApi, Loading, ErrorBox, Empty, Chip, naira, fmtDay } from '@movers/ui';
import { useLearn } from './Dashboard.jsx';
import Apply from '../Apply.jsx';

const STAGE = { UPCOMING: ['blue', 'Upcoming'], RUNNING: ['ok', 'In progress'], COMPLETED: ['lock', 'Completed'] };

/** Every class they've joined (upcoming, in progress, completed) and the next one open for registration. */
export default function Classes() {
  const { reload: reloadDash } = useLearn();
  const { data, error, loading, reload } = useApi('/learn/classes');
  const [join, setJoin] = useState(false);
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} retry={reload} />;
  const { classes, open } = data;
  return (
    <div className="pg">
      <div className="pg-h"><div><p className="eyebrow">Movers Learn</p><h1>My classes</h1><p className="desc">The classes you’ve joined, and the next one you can sign up for.</p></div></div>

      {open && (
        <div className="panel attn">
          <div className="panel-h"><h2>Open for registration</h2><Chip kind={STAGE[open.stage][0]}>{STAGE[open.stage][1]}</Chip></div>
          <p style={{ font: '700 18px var(--f-body)' }}>{open.name} · {open.code}</p>
          <p className="small" style={{ marginTop: 4 }}>Starts {fmtDay(open.startDate)} · Demo Day {fmtDay(open.demoDate)} · {open.scheduleText} · {open.seatsLeft} of {open.seats} seats left</p>
          <p className="small" style={{ marginTop: 4 }}>{naira(open.fullPrice)} for the full class, or {naira(open.skillPrice)} per skill</p>
          <div className="row" style={{ marginTop: 14 }}><button className="btn pink" onClick={() => setJoin(true)}>Join this class</button></div>
        </div>
      )}

      <div className="panel">
        <div className="panel-h"><h2>Your classes</h2>{classes.length > 0 && <span className="meta">{classes.length}</span>}</div>
        {classes.length ? (
          <ul className="list">
            {classes.map((x) => (
              <li key={x.id}>
                <span className="ib" style={{ font: '600 12px var(--f-mono)' }}>{x.cohort.code.replace(/\D/g, '') || '•'}</span>
                <div>
                  <div className="t">{x.cohort.name} · {x.cohort.code}</div>
                  <div className="d">
                    {fmtDay(x.cohort.startDate)} to Demo Day {fmtDay(x.cohort.demoDate)} · {x.kind === 'FULL' ? `Full class${x.plan === 'TWO' ? ', two payments' : ''}` : `Single skills: ${x.skills.join(', ')}`}
                  </div>
                  <div className="d">{x.paid >= x.total ? `Paid ${naira(x.total)}` : x.secured ? `Paid ${naira(x.paid)} of ${naira(x.total)}` : `Not paid yet · ${naira(x.total)}`}</div>
                </div>
                <Chip kind={STAGE[x.stage][0]}>{STAGE[x.stage][1]}</Chip>
              </li>
            ))}
          </ul>
        ) : <Empty icon="layers">You haven’t joined a class yet.</Empty>}
      </div>
      {join && <Apply onClose={() => setJoin(false)} onSaved={() => { reload(); reloadDash(); }} />}
    </div>
  );
}
