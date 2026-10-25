import { useState } from 'react';
import { api, useToast, Icon, Modal, Table, Empty, Chip, naira, fmtDay, isoDate } from '@movers/ui';
import { PageHead, useCohort } from '../shared.jsx';

const DAYS = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [0, 'Sun']];
const BLANK = {
  name: 'Full-Stack Tech Class', code: '', startDate: '', demoDate: '', weeks: 8, days: [1, 3, 5, 6],
  scheduleText: 'Mon, Wed, Fri 10:00–15:00 · Sat 10:00–17:00', saturdayNote: 'Saturday’s class also covers revision for missed sessions',
  location: 'Movers Hub, 20A Etete Road, GRA, Benin City', seats: 25, fullPrice: 250000, skillPrice: 50000, allowTwoPayments: true,
  supportNote: 'Online support while you learn', mentorshipNote: '3 months of mentorship after the class',
  laptopNote: 'Bring your own laptop to every class, charged, with its charger. Windows, Mac or Linux all work.'
};

export default function Classes() {
  const { cohorts, reload } = useCohort();
  const toast = useToast();
  const [edit, setEdit] = useState(null);
  const makeCurrent = async (c) => {
    try {
      await api(`/admin/cohorts/${c.id}/make-current`, { method: 'POST' });
      toast(`${c.code} is now shown on the website.`);
      reload();
    } catch (e) {
      toast(e.message, true);
    }
  };
  return (
    <div className="pg">
      <PageHead eyebrow="Movers Learn" title="Classes" desc="Each run of the class, with its dates, schedule, seats and prices. The one marked “On website” is what people see and sign up for.">
        <button className="btn ink" onClick={() => setEdit({ ...BLANK })}><Icon name="plus" />New class</button>
      </PageHead>
      <div className="panel">
        {cohorts.length ? (
          <Table head={['Class', 'Dates', 'Schedule', 'Full-class seats', 'Single-skill', 'Prices', '']}>
            {cohorts.map((c) => (
              <tr key={c.id}>
                <td><b>{c.name}</b><div className="small">{c.code} {c.isCurrent && <Chip kind="live">On website</Chip>}</div></td>
                <td>{fmtDay(c.startDate)} – {fmtDay(c.demoDate)}</td>
                <td>{c.scheduleText}</td>
                <td className="mono">{c.seats - c.seatsLeft}/{c.seats} paid · {c.fullCount} signed up</td>
                <td className="mono">{c.singleCount}</td>
                <td>{naira(c.fullPrice)} · {naira(c.skillPrice)}/skill</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn soft sm" onClick={() => setEdit({ ...c, startDate: isoDate(c.startDate), demoDate: isoDate(c.demoDate) })}>Edit</button>{' '}
                  {!c.isCurrent && <button className="linkbtn" onClick={() => makeCurrent(c)}>Show on website</button>}
                </td>
              </tr>
            ))}
          </Table>
        ) : <Empty icon="layers">No classes yet. Create the first one.</Empty>}
      </div>
      {edit && <ClassForm initial={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
    </div>
  );
}

function ClassForm({ initial, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState(initial);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const toggleDay = (d) => setF({ ...f, days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d].sort() });
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const body = {
      name: f.name, code: f.code, startDate: f.startDate, demoDate: f.demoDate, weeks: Number(f.weeks), days: f.days,
      scheduleText: f.scheduleText, saturdayNote: f.saturdayNote, location: f.location, seats: Number(f.seats),
      fullPrice: Number(f.fullPrice), skillPrice: Number(f.skillPrice), allowTwoPayments: f.allowTwoPayments,
      supportNote: f.supportNote, mentorshipNote: f.mentorshipNote, laptopNote: f.laptopNote
    };
    try {
      await api(initial.id ? `/admin/cohorts/${initial.id}` : '/admin/cohorts', { method: initial.id ? 'PATCH' : 'POST', body });
      toast(initial.id ? 'Saved. The website is updated.' : 'Class created. Use “Show on website” to open sign-ups.');
      onSaved();
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  };
  const field = (k, label, props = {}) => <div className={`field${props.wide ? ' wide' : ''}`}><label htmlFor={`c-${k}`}>{label}</label><input id={`c-${k}`} value={f[k]} onChange={set(k)} required={props.required !== false} type={props.type || 'text'} min={props.min} /></div>;
  return (
    <Modal title={initial.id ? `Edit ${initial.code}` : 'New class'} onClose={onClose} wide>
      <form onSubmit={save}>
        <div className="fields">
          {field('name', 'Class name')}
          {field('code', 'Cohort name', {})}
          {field('startDate', 'First class', { type: 'date' })}
          {field('demoDate', 'Demo Day', { type: 'date' })}
          {field('weeks', 'Length in weeks', { type: 'number', min: 1 })}
          {field('seats', 'Full-class seats', { type: 'number', min: 1 })}
          <div className="field wide"><span className="lbl">Class days (used for attendance)</span><div className="checkrow">{DAYS.map(([d, l]) => <label className="tog" key={d}><input type="checkbox" checked={f.days.includes(d)} onChange={() => toggleDay(d)} />{l}</label>)}</div></div>
          {field('scheduleText', 'Days and times, as shown on the website', { wide: true })}
          {field('saturdayNote', 'Saturday note', { wide: true, required: false })}
          {field('location', 'Where', { wide: true })}
          {field('fullPrice', 'Full class price (₦)', { type: 'number', min: 1 })}
          {field('skillPrice', 'Price per skill (₦)', { type: 'number', min: 1 })}
          <div className="field wide"><span className="lbl">Payment options</span><div className="checkrow"><label className="tog"><input type="checkbox" checked={f.allowTwoPayments} onChange={set('allowTwoPayments')} />Allow the full class in two payments</label></div></div>
          {field('supportNote', 'Support during the class', { wide: true, required: false })}
          {field('mentorshipNote', 'After the class', { wide: true, required: false })}
          <div className="field wide"><label htmlFor="c-lap">Laptop note (shown on the website, at sign-up and at payment)</label><textarea id="c-lap" value={f.laptopNote} onChange={set('laptopNote')} /></div>
        </div>
        {err && <p className="err" style={{ marginTop: 10 }}>{err}</p>}
        <div className="sheet-foot"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn ink" disabled={busy}>{busy ? 'Saving…' : 'Save class'}</button></div>
      </form>
    </Modal>
  );
}
