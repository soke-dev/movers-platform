import { useState } from 'react';
import { api, useApi, useToast, Icon, Empty, Loading, dayNum, monShort } from '@movers/ui';
import { PageHead, useCohort } from '../shared.jsx';

const AUD = { COHORT: 'One class', ALL_STUDENTS: 'All students', SPACE: 'Space members', EVERYONE: 'Everyone' };

export default function Announcements() {
  const { cohorts, cohort } = useCohort();
  const toast = useToast();
  const { data, loading, reload } = useApi('/admin/announcements');
  const [f, setF] = useState({ title: '', body: '', audience: 'COHORT', cohortId: '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const post = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      await api('/admin/announcements', { method: 'POST', body: { ...f, cohortId: f.audience === 'COHORT' ? f.cohortId || cohort?.id : undefined } });
      toast('Posted. It shows on dashboards now.');
      setF({ ...f, title: '', body: '' });
      reload();
    } catch (x) {
      setErr(x.message);
    }
  };
  const remove = async (id) => {
    await api(`/admin/announcements/${id}`, { method: 'DELETE' }).catch(() => {});
    reload();
  };
  return (
    <div className="pg">
      <PageHead eyebrow="Learn and Space" title="Announcements" desc="Posts appear on student dashboards. Use WhatsApp for anything urgent." />
      <div className="d-grid">
        <form className="panel" onSubmit={post}>
          <div className="panel-h"><h2>New announcement</h2></div>
          <div className="fields">
            <div className="field wide"><label htmlFor="an-t">Title</label><input id="an-t" required value={f.title} onChange={set('title')} /></div>
            <div className="field wide"><label htmlFor="an-b">Message</label><textarea id="an-b" required value={f.body} onChange={set('body')} /></div>
            <div className="field"><label htmlFor="an-a">Send to</label><select id="an-a" value={f.audience} onChange={set('audience')}>{Object.entries(AUD).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            {f.audience === 'COHORT' && <div className="field"><label htmlFor="an-c">Class</label><select id="an-c" value={f.cohortId || cohort?.id || ''} onChange={set('cohortId')}>{cohorts.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}</select></div>}
          </div>
          {err && <p className="err" style={{ marginTop: 10 }}>{err}</p>}
          <div className="sheet-foot"><button className="btn ink"><Icon name="send" />Post announcement</button></div>
        </form>
        <div className="panel">
          <div className="panel-h"><h2>Posted</h2></div>
          {loading ? <Loading /> : data?.announcements.length ? (
            <ul className="news">
              {data.announcements.map((a) => (
                <li key={a.id}><span className="dt">{dayNum(a.createdAt)}<small>{monShort(a.createdAt)}</small></span><div><b>{a.title}</b><span>{a.body}</span><div style={{ marginTop: 6 }} className="row"><span className="chip live">{a.audience === 'COHORT' ? a.cohort?.code : AUD[a.audience]}</span><button className="linkbtn" onClick={() => remove(a.id)}>Delete</button></div></div></li>
              ))}
            </ul>
          ) : <Empty icon="megaphone">Nothing posted yet.</Empty>}
        </div>
      </div>
    </div>
  );
}
