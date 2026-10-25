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
  const wholeCap = data.rooms.find((r) => r.kind === 'HALL')?.capacity || 30;
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
            <ThemeToggle variant="switch" />
            {user ? <Link className="btn wline hide-m" to="/dashboard">My dashboard</Link> : <Link className="btn wline hide-m" to="/login">Log in</Link>}
            {/* Phones: a round account button instead (log in, or the dashboard once logged in). */}
            <Link className="m-account" to={user ? '/dashboard' : '/login'} aria-label={user ? 'My dashboard' : 'Log in'} title={user ? 'My dashboard' : 'Log in'}><Icon name="user" /></Link>
            <a className="btn amber" href="#book"><span className="long">Book now</span><span className="short">Book</span></a>
            <button className="menu-btn" aria-expanded={open} aria-label="Open menu" onClick={() => setOpen(!open)}><Icon name="menu" /></button>
          </div>
          {open && (
            <div className="m-menu" onClick={() => setOpen(false)}>
              {nav.map(([h, l]) => <a key={h} href={h}>{l} <Icon name="arrow" /></a>)}
              {user ? <Link to="/dashboard">My dashboard <Icon name="arrow" /></Link> : <Link to="/login">Log in <Icon name="arrow" /></Link>}
              <div className="m-theme" onClick={(e) => e.stopPropagation()}><span>Dark theme</span><ThemeToggle variant="switch" /></div>
            </div>
          )}
        </header>
        <div className="s-hero wrap">
          <h1 className="s-display" aria-label="Work. Meet. Create. Events.">
            <span>Work<i className="sq am" /></span><span>Meet<i className="sq or" /></span><span>Create<i className="sq am" /></span><span>Events<i className="sq or" /></span>
          </h1>
          <div>
            <p className="s-tagline">A modern workspace you can book by the desk, the meeting room or the whole space, for work, training and events.</p>
            <figure className="window">
              <div className="wdots"><i style={{ background: 'var(--blue)' }} /><i style={{ background: 'var(--amber)' }} /><i style={{ background: 'var(--orchid)' }} /></div>
              <img src="/space.jpg" alt="The Movers Space main floor: lounge, chairs and a meeting table" />
              <figcaption>The main floor at {ADDRESS}</figcaption>
            </figure>
          </div>
        </div>
        <ul className="amen wrap">
          <li><Icon name="laptop" style={{ color: 'var(--amber)' }} /><b>Flexible workspaces</b><span>Hot desks by the day, week or month</span></li>
          <li><Icon name="users" style={{ color: 'var(--orchid)' }} /><b>Meeting room</b><span>Round table for {meeting?.capacity}+</span></li>
          <li><Icon name="calendar" style={{ color: 'var(--amber)' }} /><b>Entire space</b><span>Rent the whole space for events</span></li>
          <li><Icon name="clock" style={{ color: 'var(--orchid)' }} /><b>24-hour access</b><span>Monthly members, Monday to Saturday</span></li>
          <li><Icon name="shield" style={{ color: 'var(--amber)' }} /><b>Conducive &amp; private</b><span>Quiet floor, secure entry</span></li>
          <li><Icon name="book" style={{ color: 'var(--orchid)' }} /><b>Trainings &amp; classes</b><span>Run a bootcamp, class or workshop</span></li>
        </ul>
      </div>

      <section className="s-sec" id="pricing">
        <div className="wrap">
          <div className="s-h"><span className="kick">Pricing</span><h2>Come for a day. Stay for the month.</h2><p>Work from a hot desk for a day, a week or a month. Meet clients or your team around the meeting room table, or rent the entire space for a training, workshop, meetup or launch.</p></div>
          <div className="s-plans">
            <div className="s-plan"><span className="nm">Day pass</span><span className="pr">{naira(s.dayPass)}</span><span className="per">per person, per day</span><ul><li><Icon name="check" />Any free hot desk</li><li><Icon name="check" />Check in with a QR code</li></ul><button className="btn soft sm" onClick={() => choose('desk')}>Choose</button></div>
            <div className="s-plan hot"><span className="nm">Weekly pass</span><span className="pr">{naira(s.weekly)}</span><span className="per">per person · 6 days, Mon–Sat</span><ul><li><Icon name="check" />Any free desk, Monday to Saturday</li>{s.dayPass * 6 > s.weekly && <li><Icon name="check" />Save {naira(s.dayPass * 6 - s.weekly)} on day passes</li>}</ul><button className="btn amber sm" onClick={() => choose('desk')}>Choose</button></div>
            <div className="s-plan"><span className="nm">Monthly hot desk</span><span className="pr">{naira(s.monthly)}</span><span className="per">per person, per month</span><ul><li><Icon name="check" />24-hour access, Mon–Sat</li><li><Icon name="check" />Any free desk; closed Sundays</li></ul><button className="btn soft sm" onClick={() => choose('desk')}>Choose</button></div>
            <div className="s-plan"><span className="nm">Meeting room</span><span className="pr">{naira(meeting?.dayRate || 0)}</span><span className="per">per day, 9:00–18:00</span><ul><li><Icon name="check" />Round table for {meeting?.capacity}+</li><li><Icon name="check" />Add {s.addons.map((a) => a.name).join(', ')}</li></ul><button className="btn soft sm" onClick={() => choose('room')}>Choose</button></div>
            <div className="s-plan"><span className="nm">Entire space</span><span className="pr">{naira(hallFrom)}</span><span className="per">per day, up to {wholeCap} guests</span><ul><li><Icon name="check" />The whole space, just for your group</li><li><Icon name="check" />Add {s.addons.map((a) => a.name).join(', ')}</li></ul><button className="btn soft sm" onClick={() => choose('hall')}>Choose</button></div>
          </div>
          <p className="ppl-note"><Icon name="users" /><span><b>Workspace passes are for one person each.</b> Booking for your team? Choose how many people when you book, and days are tracked per person.</span></p>
        </div>
      </section>

      <section className="s-sec tint" id="host">
        <div className="wrap host one">
          <div>
            <div className="s-h"><span className="kick">Host here</span><h2>Rent the entire space.</h2><p>Book the whole of Movers Space for the day, for up to {wholeCap} guests. Tell us what you’re running and how many are coming, and we’ll set it up.</p></div>
            <ul className="host-list">
              <li><span className="ib" style={{ background: 'var(--amber-soft)', color: 'var(--wait)' }}><Icon name="book" /></span><div><b>Workshops &amp; trainings</b><span>Teach a group for the day</span></div></li>
              <li><span className="ib" style={{ background: 'var(--pink-soft)', color: 'var(--due)' }}><Icon name="code" /></span><div><b>Meetups &amp; hackathons</b><span>Bring your community together</span></div></li>
              <li><span className="ib" style={{ background: 'var(--blue-mist)', color: 'var(--blue-deep)' }}><Icon name="zap" /></span><div><b>Product launches</b><span>Add the TV and sound system</span></div></li>
              <li><span className="ib" style={{ background: 'var(--violet-soft)', color: 'var(--violet)' }}><Icon name="briefcase" /></span><div><b>Interviews &amp; assessments</b><span>Quiet room, timed slots</span></div></li>
              <li><span className="ib" style={{ background: 'var(--green-soft)', color: 'var(--ok)' }}><Icon name="gift" /></span><div><b>Game nights &amp; socials</b><span>Board games are on the house</span></div></li>
              <li><span className="ib" style={{ background: 'var(--amber-soft)', color: 'var(--wait)' }}><Icon name="award" /></span><div><b>Demo days &amp; graduations</b><span>Where <a href={LEARN_URL}>Movers Learn</a> classes present</span></div></li>
            </ul>
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
            <div className="v-item"><Icon name="pin" className="ico big-ico" /><div><span className="lbl">For enquiries</span><h3>Walk in:</h3><p>20A Etete Road,<br />GRA Benin City</p></div></div>
            <span className="vr" />
            <div className="v-item"><Icon name="call" className="ico big-ico" /><div><span className="lbl">Or call or text</span><span className="phone">{PHONE_DISPLAY.replace(/\s/g, '')}</span></div></div>
          </div>
        </div>
      </section>
      <footer className="wrap s-footer">
        <div className="s-foot-cols">
          <div><span className="brand"><Logo /><span>movers <b>space</b></span></span><p>A Movers Tech company.</p></div>
          <div><h4>Movers Space</h4><a href="#pricing">Pricing</a><a href="#host">Rent the space</a><a href="#book">Book</a></div>
          <div><h4>Movers Learn</h4><a href={LEARN_URL}>The tech class</a><a href={`${LEARN_URL}/#skills`}>The skills</a><a href={`${LEARN_URL}/#fees`}>Fees</a></div>
          <div><h4>Account</h4>{user ? <Link to="/dashboard">My dashboard</Link> : <Link to="/login">Log in</Link>}<Link to="/login?mode=register">Create an account</Link></div>
        </div>
        <div className="s-foot"><span>© {new Date().getFullYear()} Movers Space</span><span>{ADDRESS}</span></div>
      </footer>
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
