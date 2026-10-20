import { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { Icon } from './Icon.jsx';
import { Logo } from './Logo.jsx';
import { Modal } from './Modal.jsx';
import { useAuth } from './auth.jsx';
import { initials } from './format.js';

/**
 * Dashboard layout: sidebar on desktop, app bar and bottom tabs on phones.
 * nav: [{ to, label, icon, badge, group }]; tabs: [{ to, label, icon, dot }] (max 4, a "More" tab is added).
 */
export function DashShell({ theme = '', word, tone = '#120D24', nav, tabs, cross, home = '/', children }) {
  const { user, logout } = useAuth();
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
        <Link className="brand" to={home}><Logo tone={tone} /><span>movers <b>{word}</b></span></Link>
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
        <div className="d-user">
          <span className="avatar">{initials(user?.name)}</span>
          <div style={{ minWidth: 0 }}><b>{user?.name}</b><span>{user?.email}</span></div>
          <button className="btn ghost sm" onClick={out} aria-label="Log out" title="Log out"><Icon name="logout" /></button>
        </div>
      </aside>
      <header className="d-appbar">
        <Link className="brand" to={home}><Logo tone={tone} /><span>movers <b>{word}</b></span></Link>
        <button className="avatar" onClick={() => setAccount(true)} aria-label="Account">{initials(user?.name)}</button>
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
      {account && (
        <Modal title={user?.name} onClose={() => setAccount(false)}>
          <p className="small" style={{ marginTop: 6 }}>{user?.email} · {user?.phone}</p>
          <div className="sheet-foot"><button className="btn ink" onClick={out}><Icon name="logout" />Log out</button></div>
        </Modal>
      )}
    </div>
  );
}
