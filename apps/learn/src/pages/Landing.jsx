import { useMemo, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { Icon, Logo, QR, useApi, useAuth, naira, fmtDay, fmtShort, daysUntil, weekLabel, COLORS, GROUPS, ADDRESS, PHONE_DISPLAY, LEARN_URL, SPACE_URL, Loading, ThemeToggle } from '@movers/ui';

const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const weekSpan = (start, a, b = a) => `${fmtShort(addDays(start, 7 * (a - 1)))} – ${fmtShort(addDays(start, 7 * (b - 1) + 5))}`;
export const skillColors = (s) => COLORS[s.color] || COLORS.violet;

/** The questions people ask about the class, as [question, answer]. */
export const classFaqs = (c) => [
  ['Do I need to know how to code already?', 'No. The class starts from zero. If you can use a phone and a browser, you can start.'],
  ['Do I need my own laptop?', `Yes. ${c.laptopNote}`],
  ['Can I take just one skill?', `Yes. Each skill is ${naira(c.skillPrice)} and you join the class for that skill’s weeks. You still present at Demo Day${c.mentorshipNote ? ` and get the ${c.mentorshipNote.toLowerCase()}` : ''}. Once you pick a few, the full class at ${naira(c.fullPrice)} is the better deal.`],
  ...(c.supportNote ? [['Can I get help outside class?', `Yes. You get ${c.supportNote.toLowerCase()}, on the full class and on single skills.`]] : []),
  ['What if I miss a class?', `${c.saturdayNote || 'Ask your instructor about catching up'}. You need 80% attendance for your certificate.`],
  ['Can I pay later or in parts?', `You can register now and pay later, but your seat is only secured once you pay.${c.allowTwoPayments ? ` The full class can also be paid in two parts of ${naira(Math.round(c.fullPrice / 2))}.` : ''} Single skills are paid in one go.`],
  ['What happens after the class?', `Everyone presents a project at Demo Day on ${fmtDay(c.demoDate)}.${c.mentorshipNote ? ` After that you get ${c.mentorshipNote.toLowerCase()}, whether you took the full class or single skills.` : ''}`],
  ['Do I get a certificate?', 'Yes, after Demo Day, once you’ve met the attendance, project and fee requirements.']
];

/** Places skills on the 8-week plan: each gets the first row where it doesn't overlap another. */
export function planRows(skills, weeks) {
  const rows = [];
  const items = skills
    .map((s) => ({ s, a: Math.min(s.weekStart, weeks), b: Math.min(s.weekEnd, weeks) + 1 }))
    .sort((x, y) => x.a - y.a || x.b - x.a - (y.b - y.a));
  for (const it of items) {
    let r = 0;
    while (rows[r] && rows[r].some((o) => it.a < o.b && it.b > o.a)) r++;
    (rows[r] = rows[r] || []).push(it);
    it.row = r;
  }
  return { items, nrows: Math.max(1, rows.length) };
}

function Header({ cohort }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const links = [['#skills', 'Skills'], ['#plan', '8-week plan'], ['#fees', 'Fees'], ['#faq', 'FAQ'], ['#visit', 'Visit us']];
  return (
    <>
      {cohort && (
        <div className="l-bar"><div className="wrap l-bar-in">
          <span className="dot" />
          <span className="msg">{cohort.name} · {cohort.code} starts <b>{fmtDay(cohort.startDate)}</b><span className="hide-s"> · {cohort.seatsLeft} seats left</span></span>
          <Link to="/apply?kind=full">Reserve a seat <Icon name="arrow" /></Link>
        </div></div>
      )}
      <header className="l-head wrap">
        <Link className="brand" to="/"><Logo /><span>movers <b>learn</b></span></Link>
        <nav className="l-nav" aria-label="Sections">{links.map(([h, l]) => <a key={h} href={h}>{l}</a>)}</nav>
        <div className="head-actions">
          <ThemeToggle />
          {user ? <Link className="btn ghost hide-m" to="/dashboard">My dashboard</Link> : <Link className="btn ghost hide-m" to="/login">Log in</Link>}
          <Link className="btn pink" to="/apply?kind=full">Apply now</Link>
          <button className="menu-btn" aria-expanded={open} aria-label="Open menu" onClick={() => setOpen(!open)}><Icon name="menu" /></button>
        </div>
        {open && (
          <div className="m-menu" onClick={() => setOpen(false)}>
            {links.map(([h, l]) => <a key={h} href={h}>{l} <Icon name="arrow" /></a>)}
            {user ? <Link to="/dashboard">My dashboard <Icon name="arrow" /></Link> : <Link to="/login">Log in <Icon name="arrow" /></Link>}
          </div>
        )}
      </header>
    </>
  );
}

function ClassCard({ c }) {
  const days = daysUntil(c.startDate);
  return (
    <aside className="class-card" aria-label="Next class">
      <div className="cc-row1"><span className="live-dot">{c.seatsLeft > 0 ? 'Enrolling now' : 'Class full'}</span><span className="mono">{c.code}</span></div>
      <h2>{c.name}</h2>
      <dl className="cc-dl">
        <div><dt>Starts</dt><dd>{fmtDay(c.startDate)} {new Date(c.startDate).getFullYear()}{days > 0 ? ` · in ${days} days` : ''}</dd></div>
        <div><dt>Length</dt><dd>{c.weeks} weeks · Demo Day {fmtDay(c.demoDate)}</dd></div>
        <div><dt>Classes</dt><dd>{c.scheduleText}</dd></div>
        {c.saturdayNote && <div><dt>Saturdays</dt><dd>{c.saturdayNote}</dd></div>}
        <div><dt>Where</dt><dd>{c.location}</dd></div>
        <div><dt>Seats</dt><dd>{c.seatsLeft} of {c.seats} left</dd></div>
        <div><dt>Bring</dt><dd>Your own laptop</dd></div>
        {(c.supportNote || c.mentorshipNote) && <div><dt>Included</dt><dd>{[c.supportNote, c.mentorshipNote].filter(Boolean).join(', then ')}</dd></div>}
      </dl>
      <div className="cc-price">
        <div><b>{naira(c.fullPrice)}</b><span>All skills</span></div>
        <div><b>{naira(c.skillPrice)}</b><span>Per single skill</span></div>
      </div>
      <Link className="btn ink full" to="/apply?kind=full">Reserve your seat</Link>
    </aside>
  );
}

function Skills({ c, skills, sel, setSel }) {
  const [f, setF] = useState('all');
  const groups = Object.keys(GROUPS).filter((g) => skills.some((s) => s.group === g));
  const list = skills.filter((s) => f === 'all' || s.group === f);
  const s = list.find((x) => x.id === sel) || list[0];
  if (!s) return null;
  const [fg] = skillColors(s);
  return (
    <section className="sec wrap" id="skills">
      <div className="sec-head">
        <p className="eyebrow">The {skills.length} skills</p>
        <h2>Take them all, or just the ones you need.</h2>
        <p>Every skill is taught inside the {c.name}. {naira(c.fullPrice)} for all {skills.length}, or {naira(c.skillPrice)} for a single skill.</p>
      </div>
      <div className="tx">
        <div>
          <div className="fchips" role="group" aria-label="Filter skills">
            <button aria-pressed={f === 'all'} onClick={() => setF('all')}>All {skills.length}</button>
            {groups.map((g) => <button key={g} aria-pressed={f === g} onClick={() => setF(g)}>{GROUPS[g]}</button>)}
          </div>
          <div className="tx-list" role="tablist">
            {list.map((x) => (
              <button key={x.id} className="tx-item" role="tab" aria-selected={x.id === s.id} onClick={() => setSel(x.id)}>
                <span className="tile" style={{ color: skillColors(x)[0] }}><Icon name={x.icon} /></span>
                <span><b>{x.name}</b><small>{weekLabel(x.weekStart, x.weekEnd)} of the class</small></span>
              </button>
            ))}
          </div>
        </div>
        <article className="tx-detail" aria-live="polite">
          <div className="txd-head"><span className="tile" style={{ color: fg }}><Icon name={s.icon} /></span><div><h3>{s.name}</h3><p>{s.description}</p></div></div>
          <div className="txd-body">
            <div>
              <dl className="txd-meta">
                <div><dt>In the class</dt><dd>{weekLabel(s.weekStart, s.weekEnd)} of {c.weeks}</dd></div>
                <div><dt>{c.code} dates</dt><dd>{weekSpan(c.startDate, s.weekStart, s.weekEnd)}</dd></div>
                <div><dt>Classes</dt><dd>{c.scheduleText}</dd></div>
                <div><dt>Where</dt><dd>{c.location}</dd></div>
              </dl>
              <h4>Your project</h4>
              <p style={{ color: 'var(--ink-2)', fontSize: 15 }}>You choose what to build. Bring an idea of your own, or pick one with your instructor, and use this skill to make it real.</p>
            </div>
            <div>
              <h4>What we cover</h4>
              <ol className="topics">{s.topics.map((t, i) => <li key={i}><span className="wk">Part {i + 1}</span><span>{t}</span></li>)}</ol>
            </div>
          </div>
          <div className="txd-foot">
            <div><span className="eyebrow" style={{ color: 'var(--ink-3)' }}>This skill only</span><b className="price">{naira(c.skillPrice)}</b><span className="small">or all {skills.length} for {naira(c.fullPrice)}</span></div>
            <div className="row"><Link className="btn line" to="/apply?kind=full">Get all {skills.length}</Link><Link className="btn pink" to={`/apply?kind=single&skill=${s.id}`}>Learn just this skill</Link></div>
          </div>
        </article>
      </div>
    </section>
  );
}

function Plan({ c, skills, onPick }) {
  const W = c.weeks;
  const { items, nrows } = useMemo(() => planRows(skills, W), [skills, W]);
  const [wk, setWk] = useState(1);
  const inWeek = items.filter((it) => wk >= it.a && wk < it.b);
  return (
    <section className="sec wrap" id="plan">
      <div className="sec-head">
        <p className="eyebrow">The {W} weeks</p>
        <h2>How the class runs.</h2>
        <p>{c.code} runs {c.scheduleText}, from {fmtDay(c.startDate)} to Demo Day on {fmtDay(c.demoDate)}. Select a skill to see what it covers.</p>
      </div>
      <div className="plan-wrap">
        <div className="plan" style={{ gridTemplateColumns: `repeat(${W}, minmax(96px,1fr)) 120px`, gridTemplateRows: `auto repeat(${nrows}, minmax(60px,auto))`, minWidth: W * 104 + 140 }}>
          {Array.from({ length: W }, (_, i) => (
            <span key={i} className="hd" style={{ gridRow: 1, gridColumn: i + 1 }}>Week {i + 1}<small>{fmtShort(addDays(c.startDate, 7 * i))}</small></span>
          ))}
          <span className="hd" style={{ gridRow: 1, gridColumn: W + 1, color: 'var(--due)' }}>Finale</span>
          {items.map(({ s, a, b, row }) => (
            <button key={s.id} className="cell" style={{ gridColumn: `${a} / ${b}`, gridRow: row + 2 }} onClick={() => onPick(s.id)}>
              <Icon name={s.icon} style={{ color: skillColors(s)[0] }} />{s.name}
            </button>
          ))}
          <span className="cell" style={{ gridColumn: W + 1, gridRow: `2 / span ${nrows}`, cursor: 'default', justifyContent: 'center' }}>
            <Icon name="award" />Demo Day<small>{fmtDay(c.demoDate)}, Movers Space hall</small>
          </span>
        </div>
      </div>
      <div className="plan-m">
        <div className="wk-days" role="tablist" style={{ gridTemplateColumns: `repeat(${W},1fr)` }}>
          {Array.from({ length: W }, (_, i) => <button key={i} role="tab" aria-selected={wk === i + 1} onClick={() => setWk(i + 1)}>W{i + 1}</button>)}
        </div>
        <p className="wk-date">{weekSpan(c.startDate, wk)}{wk === W ? ` · Demo Day ${fmtDay(c.demoDate)}` : ''}</p>
        <ul className="wk-list">
          {inWeek.length ? inWeek.map(({ s }) => (
            <li key={s.id}><span className="tm">{weekLabel(s.weekStart, s.weekEnd)}</span><div><b>{s.name}</b><small>{s.description}</small></div><button className="btn ink sm" onClick={() => onPick(s.id)}>View</button></li>
          )) : <li><span className="tm">—</span><div><b>Project week</b><small>Work on your own project with your instructor</small></div></li>}
        </ul>
      </div>
      <p className="plan-note">{c.saturdayNote ? `${c.saturdayNote}. ` : ''}Single-skill students join for their skill’s weeks.</p>
    </section>
  );
}

function LandingPage() {
  const { data, error, loading } = useApi('/public/class');
  const [sel, setSel] = useState(null);
  if (loading) return <Loading />;
  if (error || !data?.cohort) {
    return (
      <div className="learn"><Header />
        <div className="wrap" style={{ paddingBlock: 60 }}><h1 className="h1">Learn today. <span className="hl">Build tomorrow.</span></h1><p className="lead">{error ? error.message : 'The next class will be announced soon. Call or WhatsApp us on ' + PHONE_DISPLAY + '.'}</p></div>
      </div>
    );
  }
  const c = data.cohort;
  const skills = data.skills;
  const pick = (id) => {
    setSel(id);
    document.getElementById('skills')?.scrollIntoView({ behavior: 'smooth' });
  };
  return (
    <div className="learn">
      <Header cohort={c} />
      <div className="hero wrap">
        <div>
          <p className="eyebrow">In-person tech class · Benin City</p>
          <h1 className="h1">Learn today.<br /><span className="hl">Build tomorrow.</span></h1>
          <p className="lead">An in-person class covering {skills.length} tech skills, from web and mobile to Web3, AI and cybersecurity. Take the whole class, or join for just the skills you need.</p>
          <div className="row">
            <Link className="btn pink lg" to="/apply?kind=full">Reserve a seat</Link>
            <a className="btn line lg" href="#skills">See the {skills.length} skills</a>
          </div>
        </div>
        <ClassCard c={c} />
      </div>
      <div className="facts wrap">
        <div><b>{skills.length} skills</b><span>Web, backend, mobile, Web3, AI, design, cloud, security, data and more</span></div>
        <div><b>{c.weeks} weeks, in person</b><span>{c.scheduleText}</span></div>
        <div><b>Your own laptop</b><span>Bring it to every class. Windows, Mac or Linux all work.</span></div>
        <div><b>{c.mentorshipNote ? 'Mentorship after' : 'Career support'}</b><span>{[c.supportNote, c.mentorshipNote].filter(Boolean).join(', then ') || 'Portfolio, CV and job readiness'}</span></div>
      </div>
      <Skills c={c} skills={skills} sel={sel} setSel={setSel} />
      <Plan c={c} skills={skills} onPick={pick} />

      <section className="sec wrap" id="how">
        <div className="sec-head"><p className="eyebrow">How it works</p><h2>From sign-up to Demo Day.</h2></div>
        <ol className="steps">
          <li><span className="n">01</span><h3>Create your account</h3><p>One Movers account for classes, payments and desk days at Movers Space.</p></li>
          <li><span className="n">02</span><h3>Choose and pay</h3><p>The full class or single skills. Pay online, on WhatsApp, at the office, or register now and pay later.</p></li>
          <li><span className="n">03</span><h3>Learn and track it</h3><p>Your dashboard shows attendance, quizzes, assignments, grades and receipts.</p></li>
          <li><span className="n">04</span><h3>Present at Demo Day</h3><p>Show your project to guests, teachers and fellow students{c.mentorshipNote ? `, then get ${c.mentorshipNote.toLowerCase()}` : ''}.</p></li>
        </ol>
      </section>

      <section className="sec wrap demo">
        <figure><img src="/hall.jpg" alt="The Movers Space hall at 20A Etete Road" /><figcaption>The Movers Space hall at 20A Etete Road.</figcaption></figure>
        <div className="sec-head" style={{ margin: 0 }}>
          <p className="eyebrow">Demo Day</p><h2>Finish on stage.</h2>
          <p>Every class ends with Demo Day in the Movers Space hall. You get five minutes to show what you built to guests, teachers and fellow students. This class presents on {fmtDay(c.demoDate)}.</p>
          <div className="row" style={{ marginTop: 8 }}><a className="btn line" href={SPACE_URL}>See Movers Space <Icon name="arrow" /></a></div>
        </div>
      </section>

      <section className="sec wrap" id="fees">
        <div className="sec-head"><p className="eyebrow">Fees</p><h2>Simple pricing.</h2></div>
        <div className="prices">
          <div className="pcard main">
            <h3>{c.name}</h3>
            <div className="amt">{naira(c.fullPrice)}</div>
            <p className="small muted">Paid in one go</p>
            <ul>
              <li><Icon name="check" /><span>All {skills.length} skills over {c.weeks} weeks</span></li>
              <li><Icon name="laptop" /><span>Bring your own laptop</span></li>
              <li><Icon name="check" /><span>Demo Day and a certificate</span></li>
              {c.supportNote && <li><Icon name="check" /><span>{c.supportNote}</span></li>}
              {c.mentorshipNote && <li><Icon name="check" /><span>{c.mentorshipNote}</span></li>}
            </ul>
            <Link className="btn pink" to="/apply?kind=full">Reserve a seat</Link>
          </div>
          {c.allowTwoPayments && (
            <div className="pcard">
              <h3>Two payments</h3>
              <div className="amt">{naira(Math.round(c.fullPrice / 2))} <small>× 2</small></div>
              <p className="small muted">The same full class, split in two</p>
              <ul>
                <li><Icon name="check" /><span>Pay half now to hold your seat</span></li>
                <li><Icon name="check" /><span>Pay the rest by week 4</span></li>
                <li><Icon name="check" /><span>Everything in the full class</span></li>
                <li><Icon name="laptop" /><span>Bring your own laptop</span></li>
              </ul>
              <Link className="btn line" to="/apply?kind=full&plan=two">Pay in two parts</Link>
            </div>
          )}
          <div className="pcard">
            <h3>Single skill</h3>
            <div className="amt">{naira(c.skillPrice)} <small>per skill</small></div>
            <p className="small muted">Paid in one go</p>
            <ul>
              <li><Icon name="check" /><span>Join the class for that skill’s weeks</span></li>
              <li><Icon name="check" /><span>Demo Day {fmtDay(c.demoDate)}</span></li>
              {c.supportNote && <li><Icon name="check" /><span>{c.supportNote}</span></li>}
              {c.mentorshipNote && <li><Icon name="check" /><span>{c.mentorshipNote}</span></li>}
              <li><Icon name="laptop" /><span>Bring your own laptop</span></li>
              <li><Icon name="check" /><span>Pick as many skills as you like</span></li>
              <li><Icon name="check" /><span>Pick a few and the full class may cost less</span></li>
            </ul>
            <Link className="btn line" to="/apply?kind=single">Choose skills</Link>
          </div>
        </div>
        <p className="pay-line">Pay online through Money Moves (bank transfer, the Money Moves app or stablecoin), on WhatsApp at {PHONE_DISPLAY}, or in person at the office, Mon–Sat 9:00–18:00. You can also register now and pay later.</p>
      </section>

      <section className="sec wrap" id="faq">
        <div className="sec-head"><p className="eyebrow">Questions</p><h2>Things people ask us.</h2></div>
        <div className="faq">
          {classFaqs(c).map(([q, a], i) => (
            <details key={q} open={i === 1}><summary>{q}<span className="pm"><Icon name="plus" /></span></summary><p>{a}</p></details>
          ))}
        </div>
      </section>

      <section className="visit" id="visit">
        <div className="wrap visit-in">
          <div><p className="eyebrow">Visit us</p><h2>Come and see the lab.</h2><p>Walk in for a tour, or call before you come. Registration and enquiries at the front desk.</p></div>
          <dl className="clist">
            <div><dt>Address</dt><dd>{ADDRESS}</dd></div>
            <div><dt>Call or WhatsApp</dt><dd>{PHONE_DISPLAY}</dd></div>
            <div><dt>Open</dt><dd>Mon–Sat, 9:00–18:00</dd></div>
          </dl>
          <div className="qr-box"><QR value={`${LEARN_URL}/apply`} size={104} label="QR code to register" /><span>Scan to register</span></div>
        </div>
      </section>
      <footer className="wrap">
        <div className="foot-cols">
          <div><span className="brand"><Logo /><span>movers <b>learn</b></span></span><p>A Movers Tech company.</p></div>
          <div><h4>Learn</h4><a href="#skills">The skills</a><a href="#plan">8-week plan</a><a href="#fees">Fees</a><a href="#faq">FAQ</a></div>
          <div><h4>Movers Space</h4><a href={SPACE_URL}>Workspace</a><a href={`${SPACE_URL}/#host`}>Event hall</a><a href={`${SPACE_URL}/#book`}>Book a space</a></div>
          <div><h4>Account</h4><Link to="/login">Log in</Link><Link to="/apply?kind=full">Apply now</Link></div>
        </div>
        <div className="foot"><span>© {new Date().getFullYear()} Movers Learn</span><span>{ADDRESS}</span></div>
      </footer>
    </div>
  );
}

/** The page, plus whatever pop-up the address opens over it (log in, apply). */
export default function Landing() {
  return (
    <>
      <LandingPage />
      <Outlet />
    </>
  );
}
