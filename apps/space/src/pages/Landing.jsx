import { useMemo, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { Icon, Logo, useApi, useAuth, Loading, ErrorBox, naira, ADDRESS, PHONE_DISPLAY, LEARN_URL, ThemeToggle } from '@movers/ui';
import { BookingWidget } from '../components/BookingWidget.jsx';

/** Soft topographic rings, like the flier. */
function Contour({ className, cx, cy, rings, base, step, seed, sx, w, h }) {
  const paths = useMemo(() => {
    const out = [];
    for (let i = 0; i < rings; i++) {
      const r = base + i * step;
      let d = '';
      for (let a = 0; a <= 72; a++) {
        const t = (a / 72) * Math.PI * 2;
        const k = 1 + 0.13 * Math.sin(3 * t + seed + i * 0.32) + 0.07 * Math.cos(5 * t + seed * 2 - i * 0.21);
        d += `${a ? 'L' : 'M'}${(cx + Math.cos(t) * r * k * sx).toFixed(1)} ${(cy + Math.sin(t) * r * k).toFixed(1)}`;
      }
      out.push(d + 'Z');
    }
    return out;
  }, [cx, cy, rings, base, step, seed, sx]);
  return <svg className={`contour ${className}`} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">{paths.map((d, i) => <path key={i} d={d} />)}</svg>;
}

function LayoutDots({ id }) {
  const dots = [];
  if (id === 'theatre') for (let r = 0; r < 5; r++) for (let c = 0; c < 10; c++) dots.push(<circle key={`${r}${c}`} cx={17 + c * 14.5} cy={26 + r * 11} r="3.6" fill="#2E84FF" />);
  if (id === 'classroom') for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) { const x = 14 + c * 48, y = 24 + r * 11; dots.push(<rect key={`t${r}${c}`} x={x} y={y} width="36" height="5" rx="2" fill="#9DBEF5" />, <circle key={`a${r}${c}`} cx={x + 9} cy={y + 8.5} r="3" fill="#2E84FF" />, <circle key={`b${r}${c}`} cx={x + 27} cy={y + 8.5} r="3" fill="#2E84FF" />); }
  if (id === 'board') { dots.push(<rect key="t" x="30" y="30" width="100" height="22" rx="8" fill="#9DBEF5" />); for (let i = 0; i < 7; i++) dots.push(<circle key={`u${i}`} cx={40 + i * 13.3} cy="23" r="4" fill="#2E84FF" />, <circle key={`d${i}`} cx={40 + i * 13.3} cy="59" r="4" fill="#2E84FF" />); }
  if (id === 'mixer') [[30, 24], [80, 20], [130, 26], [45, 56], [95, 58], [138, 60]].forEach(([x, y], j) => { dots.push(<circle key={`m${j}`} cx={x} cy={y} r="6" fill="#9DBEF5" />); for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + 0.3; dots.push(<circle key={`m${j}${k}`} cx={x + Math.cos(a) * 12} cy={y + Math.sin(a) * 11} r="2.8" fill="#2E84FF" />); } });
  const stage = id === 'theatre' || id === 'classroom' ? <rect x="40" y="8" width="80" height="6" rx="3" fill="#1A5BD1" /> : null;
  return <svg viewBox="0 0 160 78" aria-hidden="true">{stage}{dots}</svg>;
}

function LandingPage() {
  const { user } = useAuth();
  const { data, error, loading } = useApi('/public/space');
  const [open, setOpen] = useState(false);
  const [bookType, setBookType] = useState('desk');
  if (loading) return <Loading />;
  if (error) return <div className="wrap" style={{ paddingBlock: 40 }}><ErrorBox error={error} /></div>;
  const s = data.settings;
  const meeting = data.rooms.find((r) => r.kind === 'MEETING');
  const hallFrom = Math.min(...s.hallPackages.map((p) => p.price));
  const choose = (t) => {
    setBookType(t);
    document.getElementById('book')?.scrollIntoView({ behavior: 'smooth' });
  };
  const nav = [['#pricing', 'Pricing'], ['#host', 'Host an event'], ['#book', 'Book']];
  return (
    <>
      <div className="s-band">
        <Contour className="a" cx={300} cy={240} rings={11} base={14} step={19} seed={1.2} sx={1.25} w={620} h={520} />
        <Contour className="b" cx={260} cy={260} rings={9} base={30} step={22} seed={4.1} sx={0.8} w={520} h={520} />
        <header className="s-head wrap">
          <Link className="brand" to="/"><Logo tone="#fff" /><span>movers <b>space</b></span></Link>
          <nav className="s-nav">{nav.map(([h, l]) => <a key={h} href={h}>{l}</a>)}</nav>
          <div className="s-actions">
            <ThemeToggle />
            {user ? <Link className="btn wline hide-m" to="/dashboard">My dashboard</Link> : <Link className="btn wline hide-m" to="/login">Log in</Link>}
            <a className="btn amber" href="#book">Book now</a>
            <button className="menu-btn" aria-expanded={open} aria-label="Open menu" onClick={() => setOpen(!open)}><Icon name="menu" /></button>
          </div>
          {open && (
            <div className="m-menu" onClick={() => setOpen(false)}>
              {nav.map(([h, l]) => <a key={h} href={h}>{l} <Icon name="arrow" /></a>)}
              {user ? <Link to="/dashboard">My dashboard <Icon name="arrow" /></Link> : <Link to="/login">Log in <Icon name="arrow" /></Link>}
            </div>
          )}
        </header>
        <div className="s-hero wrap">
          <h1 className="s-display" aria-label="Work. Meet. Create. Events.">
            <span>Work<i className="sq am" /></span><span>Meet<i className="sq or" /></span><span>Create<i className="sq am" /></span><span>Events<i className="sq or" /></span>
          </h1>
          <div>
            <p className="s-tagline">A modern workspace and event hall built for productivity, collaboration, training and unforgettable experiences.</p>
            <figure className="window">
              <div className="wdots"><i style={{ background: 'var(--blue)' }} /><i style={{ background: 'var(--amber)' }} /><i style={{ background: 'var(--orchid)' }} /></div>
              <img src="/space.jpg" alt="The Movers Space main floor: lounge, chairs and a meeting table" />
              <figcaption>The main floor at {ADDRESS}</figcaption>
            </figure>
          </div>
        </div>
        <ul className="amen wrap">
          <li><Icon name="laptop" style={{ color: 'var(--amber)' }} /><b>Flexible workspaces</b><span>Hot desks by the day, week or month</span></li>
          <li><Icon name="users" style={{ color: 'var(--orchid)' }} /><b>Meeting room</b><span>Round table for {meeting?.capacity}</span></li>
          <li><Icon name="calendar" style={{ color: 'var(--amber)' }} /><b>Event hall</b><span>Meetings, trainings, conferences</span></li>
          <li><Icon name="wifi" style={{ color: 'var(--orchid)' }} /><b>24-hour access</b><span>Monthly members, Monday to Saturday</span></li>
          <li><Icon name="shield" style={{ color: 'var(--amber)' }} /><b>Conducive &amp; private</b><span>Quiet floor, secure entry</span></li>
          <li><Icon name="bulb" style={{ color: 'var(--orchid)' }} /><b>Reliable light</b><span>Inverter and solar backup</span></li>
        </ul>
      </div>

      <section className="s-sec" id="pricing">
        <div className="wrap">
          <div className="s-h"><span className="kick">Pricing</span><h2>Come for a day. Stay for the month.</h2><p>Every plan includes fast Wi-Fi, steady power, drinking water and a seat you can actually work from.</p></div>
          <div className="s-plans">
            <div className="s-plan"><span className="nm">Day pass</span><span className="pr">{naira(s.dayPass)}</span><span className="per">per person, per day</span><ul><li><Icon name="check" />Any free hot desk</li><li><Icon name="check" />Check in with a QR code</li></ul><button className="btn soft sm" onClick={() => choose('desk')}>Choose</button></div>
            <div className="s-plan hot"><span className="nm">Weekly pass</span><span className="pr">{naira(s.weekly)}</span><span className="per">per person · 6 days, Mon–Sat</span><ul><li><Icon name="check" />Any free desk, Monday to Saturday</li>{s.dayPass * 6 > s.weekly && <li><Icon name="check" />Save {naira(s.dayPass * 6 - s.weekly)} on day passes</li>}</ul><button className="btn amber sm" onClick={() => choose('desk')}>Choose</button></div>
            <div className="s-plan"><span className="nm">Monthly hot desk</span><span className="pr">{naira(s.monthly)}</span><span className="per">per person, per month</span><ul><li><Icon name="check" />24-hour access, Mon–Sat</li><li><Icon name="check" />Any free desk; closed Sundays</li></ul><button className="btn soft sm" onClick={() => choose('desk')}>Choose</button></div>
            <div className="s-plan"><span className="nm">Meeting room</span><span className="pr">{naira(meeting?.dayRate || 0)}</span><span className="per">per day, 9:00–18:00</span><ul><li><Icon name="check" />Round table for up to {meeting?.capacity}</li><li><Icon name="check" />Screen and HDMI</li></ul><button className="btn soft sm" onClick={() => choose('room')}>Choose</button></div>
            <div className="s-plan"><span className="nm">Event hall</span><span className="pr">{naira(hallFrom)}</span><span className="per">{s.hallPackages.length > 1 ? 'from' : 'per day'}, up to {Math.max(...s.layouts.map((l) => l.capacity))} guests</span><ul><li><Icon name="check" />{s.layouts.length} seating layouts</li><li><Icon name="check" />{s.addons.map((a) => a.name).join(', ')}</li></ul><button className="btn soft sm" onClick={() => choose('hall')}>Choose</button></div>
          </div>
          <p className="ppl-note"><Icon name="users" /><span><b>Workspace passes are for one person each.</b> Booking for your team? Choose how many people when you book, and days are tracked per person. Prices exclude {s.vatPercent}% VAT.</span></p>
        </div>
      </section>

      <section className="s-sec tint" id="host">
        <div className="wrap host">
          <div>
            <div className="s-h"><span className="kick">Host here</span><h2>What you can run in the hall.</h2><p>Tell us the format and headcount. We set the room, test the sound and keep the lights on.</p></div>
            <ul className="host-list">
              <li><span className="ib" style={{ background: 'var(--amber-soft)', color: 'var(--wait)' }}><Icon name="book" /></span><div><b>Workshops &amp; trainings</b><span>Classroom layout</span></div></li>
              <li><span className="ib" style={{ background: 'var(--pink-soft)', color: 'var(--due)' }}><Icon name="code" /></span><div><b>Meetups &amp; hackathons</b><span>Mixer or theatre</span></div></li>
              <li><span className="ib" style={{ background: 'var(--blue-mist)', color: 'var(--blue-deep)' }}><Icon name="zap" /></span><div><b>Product launches</b><span>Stage, screen and PA</span></div></li>
              <li><span className="ib" style={{ background: 'var(--violet-soft)', color: 'var(--violet)' }}><Icon name="briefcase" /></span><div><b>Interviews &amp; assessments</b><span>Quiet room, timed slots</span></div></li>
              <li><span className="ib" style={{ background: 'var(--green-soft)', color: 'var(--ok)' }}><Icon name="gift" /></span><div><b>Game nights &amp; socials</b><span>Board games are on the house</span></div></li>
              <li><span className="ib" style={{ background: 'var(--amber-soft)', color: 'var(--wait)' }}><Icon name="award" /></span><div><b>Demo days &amp; graduations</b><span>Where <a href={LEARN_URL}>Movers Learn</a> classes present</span></div></li>
            </ul>
          </div>
          <div>
            <p className="eyebrow" style={{ marginBottom: 12 }}>Hall layouts</p>
            <div className="layouts">
              {s.layouts.map((l) => (
                <div className="layout" key={l.id}><LayoutDots id={l.id} /><span className="lt"><b>{l.name}</b><span className="cap">up to {l.capacity}</span></span></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="s-sec" id="book">
        <div className="wrap">
          <div className="s-h"><span className="kick">Book</span><h2>Check a date. Book and pay.</h2><p>See what is free and price it as you go. Pay online through Money Moves, on WhatsApp, at the office, or later.</p></div>
          <BookingWidget space={data} initialType={bookType} />
        </div>
      </section>

      <section className="s-visit">
        <div className="wrap">
          <div className="v-card">
            <div className="v-item"><Icon name="pin" className="ico big-ico" /><div><span className="lbl">For inquiry &amp; registration</span><h3>Walk in:</h3><p>20A Etete Road,<br />GRA Benin City</p></div></div>
            <span className="vr" />
            <div className="v-item"><Icon name="call" className="ico big-ico" /><div><span className="lbl">Or call or text</span><span className="phone">{PHONE_DISPLAY.replace(/\s/g, '')}</span></div></div>
          </div>
        </div>
      </section>
      <footer className="wrap s-foot"><span>© {new Date().getFullYear()} Movers Space, a Movers Tech company</span><a href={LEARN_URL}>Movers Learn: tech classes</a></footer>
    </>
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
