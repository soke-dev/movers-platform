import { useApi } from './api.js';
import { useToast } from './Toast.jsx';
import { Icon } from './Icon.jsx';
import { Chip, Empty, Loading, ErrorBox } from './bits.jsx';
import { fmtDate } from './format.js';

/**
 * Refer a friend, on Learn and Space. The link opens the site they're on with ?ref=CODE, and sign-up
 * fills the code in for the friend. `share(code, link)` is the WhatsApp message.
 */
export function ReferPage({ share }) {
  const { data, error, loading, reload } = useApi('/auth/referrals');
  const toast = useToast();
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} retry={reload} />;
  const link = `${window.location.origin}/?ref=${data.code}`;
  const copy = (text, what) => navigator.clipboard?.writeText(text).then(() => toast(`${what} copied`)).catch(() => toast('Select it and copy it.', true));
  return (
    <div className="pg">
      <div className="pg-h"><div><p className="eyebrow">Tell a friend</p><h1>Refer a friend</h1><p className="desc">Share your link or code. When a friend signs up with it, they’re linked to you, on Movers Learn and Movers Space.</p></div></div>
      <div className="d-grid">
        <div className="panel">
          <div className="panel-h"><h2>Your link</h2></div>
          <div className="ref-box"><span>{link}</span><button className="btn ink sm" onClick={() => copy(link, 'Link')}>Copy link</button></div>
          <p className="small" style={{ marginTop: 14 }}>Or they can type your code when they sign up:</p>
          <div className="ref-box"><b className="mono">{data.code}</b><button className="btn soft sm" onClick={() => copy(data.code, 'Code')}>Copy code</button></div>
          <a className="btn wa" style={{ marginTop: 16 }} target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(share(data.code, link))}`}><Icon name="chat" />Share on WhatsApp</a>
          <ol className="ref-steps">
            <li>Send your link to a friend.</li>
            <li>They sign up. Your code is filled in for them; with the code alone they type it in.</li>
            <li>They show up here, and you can see when they join the class or visit the space.</li>
          </ol>
        </div>
        <div className="panel">
          <div className="panel-h"><h2>People you referred</h2><span className="meta">{data.referrals.length} signed up</span></div>
          {data.referrals.length ? (
            <ul className="list">
              {data.referrals.map((r, i) => (
                <li key={i}>
                  <span className="ib"><Icon name={r.joinedClass || r.visitedSpace ? 'check' : 'clock'} /></span>
                  <div><div className="t">{r.name}</div><div className="d">Signed up {fmtDate(r.joined)}</div></div>
                  <span className="row" style={{ gap: 6 }}>
                    {r.joinedClass && <Chip kind="ok">Joined the class</Chip>}
                    {r.visitedSpace && <Chip kind="blue">Visited the space</Chip>}
                    {!r.joinedClass && !r.visitedSpace && <Chip>Signed up</Chip>}
                  </span>
                </li>
              ))}
            </ul>
          ) : <Empty icon="gift">Nobody yet. Share your link to get started.</Empty>}
        </div>
      </div>
    </div>
  );
}
