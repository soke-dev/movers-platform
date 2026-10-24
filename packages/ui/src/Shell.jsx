import { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { Icon } from './Icon.jsx';
import { Logo } from './Logo.jsx';
import { Modal } from './Modal.jsx';
import { useAuth } from './auth.jsx';
import { Avatar, ThemeToggle } from './theme.jsx';
import { useNotifications, BellButton, NotificationsPanel } from './Notifications.jsx';

/**
 * Dashboard layout: sidebar on desktop, app bar and bottom tabs on phones.
 * nav: [{ to, label, icon, badge, group }]; tabs: [{ to, label, icon, dot }] (max 4, a "More" tab is added).
 * profile: the profile page's path, which the account box links to.
 * site: "learn" or "space" shows the notifications bell for that site.
 */
export function DashShell({ theme = '', word, tone = 'currentColor', nav, tabs, cross, home = '/', profile, site, children }) {
  const { user, logout } = useAuth();
  const notes = useNotifications(site);
  const [bell, setBell] = useState(false);
  const openBell = () => {
    setBell(true);
    notes.markSeen();
  };
  const [more, setMore] = useState(false);
  const [account, setAccount] = useState(false);
  const navigate = useNavigate();
  const out = async () => {
    await logout();
    navigate('/');
  };
  const inTabs = new Set(tabs.map((t) => t.to));
  return (
    <div className={`d-shell has-tabs ${theme}`}>
      <aside className="d-side">
        <div className="d-brandrow">
          <Link className="brand" to={home}><Logo tone={tone} /><span>movers <b>{word}</b></span></Link>
          {site && <BellButton unread={notes.unread} onClick={openBell} />}
        </div>
        <nav className="d-nav">
          {nav.map((n) =>
            n.group ? <span className="grp" key={n.group}>{n.group}</span> : (
              <NavLink key={n.to} to={n.to} end={n.end}>
                <Icon name={n.icon} />{n.label}{n.badge ? <span className="badge">{n.badge}</span> : null}
              </NavLink>
            )
          )}
        </nav>
        {cross}
        <ThemeToggle className="d-theme" label />
        <div className="d-user">
          <Avatar user={user} />
          {profile
            ? <Link className="who" to={profile} title="Your profile"><b>{user?.name}</b><span>{user?.username ? `@${user.username}` : user?.email}</span></Link>
            : <div className="who"><b>{user?.name}</b><span>{user?.email}</span></div>}
          <button className="btn ghost sm" onClick={out} aria-label="Log out" title="Log out"><Icon name="logout" /></button>
        </div>
      </aside>
      <header className="d-appbar">
        <Link className="brand" to={home}><Logo tone={tone} /><span>movers <b>{word}</b></span></Link>
        <span className="row" style={{ gap: 8 }}>
          {site && <BellButton unread={notes.unread} onClick={openBell} />}
          <ThemeToggle variant="switch" />
          <button className="avatar-btn" onClick={() => setAccount(true)} aria-label="Account"><Avatar user={user} /></button>
        </span>
      </header>
      <main className="d-main">{children}</main>
      <nav className="d-tabs" aria-label="Sections">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end}>
            <Icon name={t.icon} />{t.label}{t.dot ? <span className="dot" /> : null}
          </NavLink>
        ))}
        <button onClick={() => setMore(true)}><Icon name="dots" />More</button>
      </nav>
      {more && (
        <Modal title="More" onClose={() => setMore(false)}>
          <div className="sheet-list">
            {nav.filter((n) => !n.group && !inTabs.has(n.to)).map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setMore(false)}><Icon name={n.icon} /><span>{n.label}</span></Link>
            ))}
          </div>
        </Modal>
      )}
      {bell && <NotificationsPanel site={site} items={notes.items} onClose={() => setBell(false)} />}
      {account && (
        <Modal title={user?.name} onClose={() => setAccount(false)}>
          <p className="small" style={{ marginTop: 6 }}>{user?.username ? `@${user.username} · ` : ''}{user?.email}</p>
          <div className="sheet-foot">
            {profile && <Link className="btn soft" to={profile} onClick={() => setAccount(false)}><Icon name="settings" />Profile</Link>}
            <button className="btn ink" onClick={out}><Icon name="logout" />Log out</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
