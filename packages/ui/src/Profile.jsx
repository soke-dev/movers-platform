import { useRef, useState } from 'react';
import { api } from './api.js';
import { useAuth } from './auth.jsx';
import { useToast } from './Toast.jsx';
import { Password, PhoneNG, phoneDigits, MIN_PASSWORD } from './AuthForms.jsx';
import { displayName, fmtDate } from './format.js';
import { Avatar } from './theme.jsx';
import { Icon } from './Icon.jsx';

const splitName = (name = '') => {
  const [first, ...rest] = name.split(' ');
  return { firstName: first || '', lastName: rest.join(' ') };
};

/** One Movers account for Learn and Space: basic info, name, username, phone and password. */
export function ProfilePage() {
  const { user } = useAuth();
  return (
    <div className="pg">
      <div className="pg-h"><div><p className="eyebrow">Your account</p><h1>Profile</h1><p className="desc">One Movers account for Movers Learn and Movers Space. Changes here show on both.</p></div></div>
      <div className="panel prof-card">
        <Avatar user={user} className="prof-av" />
        <div className="prof-id">
          <h2>{user.name}</h2>
          <p>{user.username ? `@${user.username}` : 'No username yet'} · we call you <b>{displayName(user)}</b></p>
          <PhotoButtons />
        </div>
        <dl className="prof-facts">
          <div><dt>Email</dt><dd>{user.email}</dd></div>
          <div><dt>Phone</dt><dd>{user.phone || 'Not added'}</dd></div>
          <div><dt>Member since</dt><dd>{fmtDate(user.createdAt)}</dd></div>
          <div><dt>Signs in with</dt><dd>{[user.hasPassword && 'Email and password', user.google && 'Google'].filter(Boolean).join(' or ')}</dd></div>
          <div><dt>Referral code</dt><dd className="mono">{user.referralCode}</dd></div>
        </dl>
      </div>
      <div className="d-grid prof-grid">
        <Details />
        <PasswordForm />
      </div>
    </div>
  );
}

/** Crops the middle square of a photo and shrinks it to 256×256 JPEG (about 20–40 KB). */
function squarePhoto(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 256, 256);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.86));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file isn’t a photo we can open. Try a JPG or PNG.'));
    };
    img.src = url;
  });
}

function PhotoButtons() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const { user: u } = await api('/auth/avatar', { method: 'PUT', body: { image: await squarePhoto(file) } });
      setUser(u);
      toast('Photo updated.');
    } catch (x) {
      toast(x.message, true);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      const { user: u } = await api('/auth/avatar', { method: 'DELETE' });
      setUser(u);
      toast('Photo removed.');
    } catch (x) {
      toast(x.message, true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="row" style={{ gap: 8, marginTop: 10 }}>
      <input ref={input} type="file" accept="image/*" hidden onChange={pick} />
      <button type="button" className="btn soft sm" disabled={busy} onClick={() => input.current?.click()}><Icon name="camera" />{busy ? 'Saving…' : user.avatarUrl ? 'Change photo' : 'Add a photo'}</button>
      {user.avatarUrl && <button type="button" className="linkbtn" disabled={busy} onClick={remove}>Remove</button>}
    </div>
  );
}

function Details() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [f, setF] = useState(() => ({ ...splitName(user.name), username: user.username || '', phone: phoneDigits(user.phone) }));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const save = async (e) => {
    e.preventDefault();
    setErr('');
    if (f.phone && f.phone.length !== 10) return setErr('Enter your 10-digit phone number, e.g. 803 123 4567.');
    setBusy(true);
    try {
      const body = { firstName: f.firstName, lastName: f.lastName, username: f.username, ...(f.phone ? { phone: `+234${f.phone}` } : {}) };
      const { user: u } = await api('/auth/me', { method: 'PATCH', body });
      setUser(u);
      toast('Profile saved.');
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="panel">
      <div className="panel-h"><h2>Your details</h2></div>
      <form className="authf" onSubmit={save} style={{ marginTop: 0 }}>
        <div className="authf-two">
          <div className="authf-field"><label className="authf-label" htmlFor="pf-first">First name</label><input id="pf-first" autoComplete="given-name" required value={f.firstName} onChange={(e) => set('firstName')(e.target.value)} /></div>
          <div className="authf-field"><label className="authf-label" htmlFor="pf-last">Last name</label><input id="pf-last" autoComplete="family-name" required value={f.lastName} onChange={(e) => set('lastName')(e.target.value)} /></div>
        </div>
        <div className="authf-field">
          <div className="authf-label"><label htmlFor="pf-user">Username</label><span className="authf-opt">Optional</span></div>
          <div className="authf-phone"><span className="cc">@</span><input id="pf-user" autoComplete="username" placeholder="yourname" maxLength={21} value={f.username} onChange={(e) => set('username')(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} /></div>
          <span className="authf-opt">3–20 letters, numbers or _. We greet you by it instead of your first name.</span>
        </div>
        <div className="authf-field"><label className="authf-label" htmlFor="pf-phone">Phone number</label><PhoneNG id="pf-phone" value={f.phone} onChange={set('phone')} /></div>
        <div className="authf-field"><label className="authf-label" htmlFor="pf-email">Email</label><input id="pf-email" value={user.email} disabled /><span className="authf-opt">Your email is how you log in, so it can’t be changed here. Ask us if you need to.</span></div>
        {err && <p className="authf-err" role="alert">{err}</p>}
        <button className="btn ink authf-go" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      </form>
    </div>
  );
}

function PasswordForm() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const empty = { current: '', password: '', confirm: '' };
  const [f, setF] = useState(empty);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const save = async (e) => {
    e.preventDefault();
    setErr('');
    if (f.password.length < MIN_PASSWORD) return setErr(`Use at least ${MIN_PASSWORD} characters for your password.`);
    if (f.password !== f.confirm) return setErr('The two new passwords don’t match.');
    setBusy(true);
    try {
      const { user: u } = await api('/auth/password', { method: 'POST', body: { current: f.current, password: f.password } });
      setUser(u);
      setF(empty);
      toast(user.hasPassword ? 'Password changed.' : 'Password added. You can now log in with your email too.');
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="panel">
      <div className="panel-h"><h2>{user.hasPassword ? 'Change password' : 'Add a password'}</h2></div>
      {!user.hasPassword && <p className="small" style={{ marginBottom: 12 }}>You sign in with Google. Add a password to also log in with your email.</p>}
      <form className="authf" onSubmit={save} style={{ marginTop: 0 }}>
        {user.hasPassword && <div className="authf-field"><label className="authf-label" htmlFor="pw-cur">Current password</label><Password id="pw-cur" autoComplete="current-password" value={f.current} onChange={set('current')} /></div>}
        <div className="authf-field"><label className="authf-label" htmlFor="pw-new">New password</label><Password id="pw-new" value={f.password} onChange={set('password')} placeholder={`At least ${MIN_PASSWORD} characters`} /></div>
        <div className="authf-field"><label className="authf-label" htmlFor="pw-new2">Confirm new password</label><Password id="pw-new2" value={f.confirm} onChange={set('confirm')} /></div>
        {err && <p className="authf-err" role="alert">{err}</p>}
        <button className="btn ink authf-go" disabled={busy}>{busy ? 'Saving…' : user.hasPassword ? 'Change password' : 'Add password'}</button>
        {user.hasPassword && <p className="authf-fine" style={{ marginTop: 0 }}>Forgot it? Log out and tap “Forgot password?” to get a code by email.</p>}
      </form>
    </div>
  );
}
