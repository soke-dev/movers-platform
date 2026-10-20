import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from './api.js';
import { Icon } from './Icon.jsx';
import { Modal } from './Modal.jsx';
import { Empty } from './bits.jsx';
import { fmtDay, fmtTime } from './format.js';
import { LEARN_URL, SPACE_URL } from './config.js';

/** "Just now", "12 min ago", "3 h ago", "Yesterday, 14:05", "Mon 26 Oct". */
function ago(at) {
  const t = new Date(at);
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60 && t.getDate() === new Date().getDate()) return `${Math.round(mins / 60)} h ago`;
  if (mins < 48 * 60) return `Yesterday, ${fmtTime(t)}`;
  return fmtDay(t);
}

/** Loads the bell for this site ("learn" or "space") and checks again every minute. */
export function useNotifications(site) {
  const [data, setData] = useState({ items: [], unread: 0 });
  useEffect(() => {
    if (!site) return undefined;
    let live = true;
    const load = () => api(`/notifications?site=${site}`).then((d) => live && setData(d)).catch(() => {});
    load();
    const t = setInterval(load, 60e3);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [site]);
  const markSeen = () => {
    if (!data.unread) return;
    setData((d) => ({ ...d, unread: 0 }));
    api('/notifications/seen', { method: 'POST' }).catch(() => {});
  };
  return { ...data, markSeen };
}

export function BellButton({ unread, onClick, className = 'bell-btn' }) {
  return (
    <button type="button" className={className} onClick={onClick} aria-label={unread ? `Notifications, ${unread} new` : 'Notifications'} title="Notifications">
      <Icon name="bell" />
      {unread > 0 && <span className="bell-n">{unread > 9 ? '9+' : unread}</span>}
    </button>
  );
}

/** The list. Items keep their "new" mark while open; the count clears as soon as it opens. */
export function NotificationsPanel({ site, items, onClose }) {
  const navigate = useNavigate();
  const go = (n) => {
    if (!n.path) return;
    onClose();
    if (!n.site || n.site === site) navigate(n.path);
    else window.location.href = `${n.site === 'learn' ? LEARN_URL : SPACE_URL}${n.path}`;
  };
  return (
    <Modal title="Notifications" onClose={onClose}>
      {items.length ? (
        <ul className="notes">
          {items.map((n) => (
            <li key={`${n.kind}-${n.id}`} className={n.unread ? 'new' : ''}>
              <button type="button" onClick={() => go(n)} disabled={!n.path}>
                <span className={`ib ${n.kind}`}><Icon name={n.kind === 'announcement' ? 'megaphone' : 'bell'} /></span>
                <span className="nb">
                  <b>{n.title}</b>
                  {n.body && <span>{n.body}</span>}
                  <small>{n.kind === 'announcement' ? 'Announcement · ' : ''}{ago(n.at)}</small>
                </span>
                {n.unread && <i className="dot" aria-label="New" />}
              </button>
            </li>
          ))}
        </ul>
      ) : <Empty icon="bell">Nothing yet. Payments, grades, new quizzes and announcements show up here.</Empty>}
    </Modal>
  );
}
