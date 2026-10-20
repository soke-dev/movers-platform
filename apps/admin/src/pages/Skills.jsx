import { useState } from 'react';
import { api, useApi, useToast, Icon, Modal, Table, Chip, Loading, ErrorBox, GROUPS, COLORS, weekLabel } from '@movers/ui';
import { PageHead } from '../shared.jsx';

const ICONS = ['code', 'db', 'phone', 'cube', 'brain', 'pen', 'cloud', 'chart', 'briefcase', 'shield', 'layers', 'zap', 'bulb', 'laptop'];

export default function Skills() {
  const { data, error, loading, reload } = useApi('/admin/skills');
  const toast = useToast();
  const [edit, setEdit] = useState(null);
  const toggle = async (s) => {
    try {
      await api(`/admin/skills/${s.id}`, { method: 'PATCH', body: { visible: !s.visible } });
      toast(s.visible ? `${s.name} is hidden from the website.` : `${s.name} is back on the website.`);
      reload();
    } catch (e) {
      toast(e.message, true);
    }
  };
  return (
    <div className="pg">
      <PageHead eyebrow="Movers Learn website" title="Skills" desc="The skills listed on the website and in sign-up. Weeks place each skill on the 8-week plan.">
        <button className="btn ink" onClick={() => setEdit({ name: '', description: '', weekStart: 1, weekEnd: 1, group: 'code', icon: 'bulb', color: 'violet', topics: [''], visible: true })}><Icon name="plus" />Add skill</button>
      </PageHead>
      <div className="panel">
        {loading ? <Loading /> : error ? <ErrorBox error={error} /> : (
          <Table head={['Skill', 'Weeks', 'Group', 'On website', '']}>
            {data.skills.map((s) => (
              <tr key={s.id}>
                <td><span style={{ display: 'inline-flex', gap: 10, alignItems: 'center' }}><span className="ib" style={{ width: 30, height: 30, color: (COLORS[s.color] || COLORS.violet)[0] }}><Icon name={s.icon} /></span><b>{s.name}</b></span></td>
                <td>{weekLabel(s.weekStart, s.weekEnd)}</td>
                <td>{GROUPS[s.group]}</td>
                <td>{s.visible ? <Chip kind="ok">Shown</Chip> : <Chip>Hidden</Chip>}</td>
                <td style={{ whiteSpace: 'nowrap' }}><button className="btn soft sm" onClick={() => setEdit(s)}>Edit</button> <button className="linkbtn" onClick={() => toggle(s)}>{s.visible ? 'Hide' : 'Show'}</button></td>
              </tr>
            ))}
          </Table>
        )}
      </div>
      {edit && <SkillForm initial={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
    </div>
  );
}

function SkillForm({ initial, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({ ...initial, topicsText: initial.topics.join('\n') });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const save = async (e) => {
    e.preventDefault();
    const body = { name: f.name, description: f.description, weekStart: Number(f.weekStart), weekEnd: Number(f.weekEnd), group: f.group, icon: f.icon, color: f.color, topics: f.topicsText.split('\n').map((t) => t.trim()).filter(Boolean), visible: f.visible };
    try {
      await api(initial.id ? `/admin/skills/${initial.id}` : '/admin/skills', { method: initial.id ? 'PATCH' : 'POST', body });
      toast(initial.id ? 'Skill saved. The website is updated.' : 'Skill added to the website.');
      onSaved();
    } catch (x) {
      setErr(x.message);
    }
  };
  return (
    <Modal title={initial.id ? 'Edit skill' : 'Add a skill'} onClose={onClose} wide>
      <form onSubmit={save}>
        <div className="fields">
          <div className="field wide"><label htmlFor="s-n">Skill name</label><input id="s-n" required value={f.name} onChange={set('name')} placeholder="e.g. Game Development" /></div>
          <div className="field wide"><label htmlFor="s-d">Short description</label><input id="s-d" value={f.description} onChange={set('description')} placeholder="Tools and topics, e.g. Unity, C#" /></div>
          <div className="field"><label htmlFor="s-a">First week</label><input id="s-a" type="number" min="1" required value={f.weekStart} onChange={set('weekStart')} /></div>
          <div className="field"><label htmlFor="s-b">Last week</label><input id="s-b" type="number" min="1" required value={f.weekEnd} onChange={set('weekEnd')} /></div>
          <div className="field"><label htmlFor="s-g">Group</label><select id="s-g" value={f.group} onChange={set('group')}>{Object.entries(GROUPS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          <div className="field"><label htmlFor="s-c">Colour</label><select id="s-c" value={f.color} onChange={set('color')}>{Object.keys(COLORS).map((c) => <option key={c}>{c}</option>)}</select></div>
          <div className="field wide"><span className="lbl">Icon</span><div className="checkrow">{ICONS.map((i) => <label className="tog" key={i} title={i}><input type="radio" name="icon" checked={f.icon === i} onChange={() => setF({ ...f, icon: i })} /><Icon name={i} /></label>)}</div></div>
          <div className="field wide"><label htmlFor="s-t">What we cover (one per line)</label><textarea id="s-t" value={f.topicsText} onChange={set('topicsText')} /></div>
          <div className="field wide"><span className="lbl">Website</span><div className="checkrow"><label className="tog"><input type="checkbox" checked={f.visible} onChange={set('visible')} />Show this skill on the website</label></div></div>
        </div>
        {err && <p className="err" style={{ marginTop: 10 }}>{err}</p>}
        <div className="sheet-foot"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn ink">{initial.id ? 'Save skill' : 'Add skill'}</button></div>
      </form>
    </Modal>
  );
}
