import { Icon, Chip, Empty, useToast, fmtDate, SPACE_URL } from '@movers/ui';
import { useSpace } from './Dashboard.jsx';

export default function Refer() {
  const { data } = useSpace();
  const toast = useToast();
  const link = `${SPACE_URL}/login?mode=register&ref=${data.referralCode}`;
  const copy = (text) => navigator.clipboard?.writeText(text).then(() => toast('Copied')).catch(() => toast('Select the text and copy it.'));
  return (
    <div className="pg">
      <div className="pg-h"><div><p className="eyebrow">Tell a friend</p><h1>Refer a friend</h1><p className="desc">Share your code. When your friend signs up with it, they’re linked to you, and the front desk can reward you both.</p></div></div>
      <div className="d-grid">
        <div className="panel">
          <div className="panel-h"><h2>Your code</h2></div>
          <div className="row"><span className="code">{data.referralCode}</span><button className="btn blue sm" onClick={() => copy(data.referralCode)}>Copy code</button></div>
          <p className="small" style={{ marginTop: 14 }}>Or share this sign-up link:</p>
          <div className="row" style={{ marginTop: 6 }}><span className="code" style={{ overflowWrap: 'anywhere', fontSize: 13 }}>{link}</span><button className="btn soft sm" onClick={() => copy(link)}>Copy link</button></div>
          <a className="btn wa" style={{ marginTop: 14 }} target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`Work from Movers Space in GRA, Benin City. Sign up with my code ${data.referralCode}: ${link}`)}`}><Icon name="chat" />Share on WhatsApp</a>
        </div>
        <div className="panel">
          <div className="panel-h"><h2>Your referrals</h2><span className="meta">{data.referrals.length} signed up</span></div>
          {data.referrals.length ? (
            <ul className="list">
              {data.referrals.map((r, i) => (
                <li key={i}><span className="ib"><Icon name={r.visited ? 'check' : 'clock'} /></span><div><div className="t">{r.name}</div><div className="d">Joined {fmtDate(r.joined)}</div></div>{r.visited ? <Chip kind="ok">Visited</Chip> : <Chip>Not visited yet</Chip>}</li>
              ))}
            </ul>
          ) : <Empty icon="gift">Nobody yet. Share your code to get started.</Empty>}
        </div>
      </div>
    </div>
  );
}
