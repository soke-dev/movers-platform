import { useState } from 'react';
import { Icon } from './Icon.jsx';
import { initials } from './format.js';

// Light or dark. Kept in localStorage and in a cookie on .moverstech.xyz, so one choice covers
// learn., space. and admin. Each index.html applies it before the page paints.
const KEY = 'mv-theme';

export const getTheme = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

export function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch { /* private mode */ }
  const shared = /(^|\.)moverstech\.xyz$/.test(location.hostname) ? '; domain=.moverstech.xyz' : '';
  document.cookie = `${KEY}=${theme}; path=/; max-age=31536000; samesite=lax${shared}`;
}

/**
 * Sun / moon button. `label` shows the words next to the icon. `variant="switch"` is a sliding
 * switch (used in the phone top bar): a white knob that moves across and swaps sun for moon.
 */
export function ThemeToggle({ className = 'theme-btn', label = false, variant }) {
  const [theme, set] = useState(getTheme);
  const next = theme === 'dark' ? 'light' : 'dark';
  const flip = () => {
    setTheme(next);
    set(next);
  };
  if (variant === 'switch') {
    return (
      <button type="button" role="switch" aria-checked={theme === 'dark'} className="theme-switch" onClick={flip} aria-label="Dark theme" title={`Switch to ${next} theme`}>
        <span className="knob"><Icon name={theme === 'dark' ? 'moon' : 'sun'} /></span>
      </button>
    );
  }
  return (
    <button type="button" className={className} onClick={flip} aria-label={`Switch to ${next} theme`} title={`Switch to ${next} theme`}>
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} />{label && <span>{theme === 'dark' ? 'Light theme' : 'Dark theme'}</span>}
    </button>
  );
}

/** Profile photo, or initials when there isn't one. */
export function Avatar({ user, className = 'avatar' }) {
  const [broken, setBroken] = useState(false);
  if (user?.avatarUrl && !broken) return <img className={className} src={user.avatarUrl} alt="" onError={() => setBroken(true)} />;
  return <span className={className}>{initials(user?.name)}</span>;
}
