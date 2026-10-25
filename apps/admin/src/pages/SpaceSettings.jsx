import { useEffect, useState } from 'react';
import { api, useApi, useToast, Loading, ErrorBox } from '@movers/ui';
import { PageHead } from '../shared.jsx';

export default function SpaceSettings() {
  const { data, error, loading, reload } = useApi('/admin/space/settings');
  const toast = useToast();
  const [f, setF] = useState(null);
  useEffect(() => {
    if (data) setF({ ...data.settings, rooms: data.rooms });
  }, [data]);
  if (loading || !f) return error ? <ErrorBox error={error} /> : <Loading />;
  const num = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    try {
      await api('/admin/space/settings', {
        method: 'PATCH',
        body: {
          desks: Number(f.desks), dayPass: Number(f.dayPass), weekly: Number(f.weekly), monthly: Number(f.monthly),
          studentDiscount: Number(f.studentDiscount),
          hallPackages: f.hallPackages.map((p) => ({ ...p, price: Number(p.price), start: Number(p.start), end: Number(p.end) })),
          addons: f.addons.map((a) => ({ ...a, price: Number(a.price) })),
          rooms: f.rooms.map((r) => ({ id: r.id, dayRate: Number(r.dayRate), capacity: Number(r.capacity) }))
        }
      });
      toast('Saved. New prices show on the Space site and in bookings now.');
      reload();
    } catch (x) {
      toast(x.message, true);
    }
  };
  const input = (id, label, value, onChange, extra = {}) => {
    const { key, ...rest } = extra;
    return <div className="field" key={key || id}><label htmlFor={id}>{label}</label><input id={id} type="number" min="0" value={value} onChange={onChange} {...rest} /></div>;
  };
  return (
    <form className="pg" onSubmit={save}>
      <PageHead eyebrow="Movers Space" title="Prices & rooms" desc="These are the full prices people pay. Changes apply to new bookings only.">
        <button className="btn ink">Save changes</button>
      </PageHead>
      <div className="panel">
        <div className="panel-h"><h2>Workspace</h2></div>
        <div className="fields">
          {input('s-desks', 'Hot desks', f.desks, num('desks'))}
          {input('s-day', 'Day pass (₦, per person)', f.dayPass, num('dayPass'))}
          {input('s-week', 'Weekly pass, 6 days Mon–Sat (₦, per person)', f.weekly, num('weekly'))}
          {input('s-mon', 'Monthly hot desk (₦)', f.monthly, num('monthly'))}
          {input('s-stu', 'Movers Learn student discount (%)', f.studentDiscount, num('studentDiscount'), { max: 100 })}
        </div>
      </div>
      <div className="panel">
        <div className="panel-h"><h2>Meeting room</h2></div>
        <div className="fields">
          {f.rooms.filter((r) => r.kind === 'MEETING').map((r) => [
            input(`r-${r.id}-rate`, `${r.name}: price per day (₦)`, r.dayRate, (e) => setF({ ...f, rooms: f.rooms.map((x) => (x.id === r.id ? { ...x, dayRate: e.target.value } : x)) }), { key: `${r.id}-rate` }),
            input(`r-${r.id}-cap`, `${r.name}: seats`, r.capacity, (e) => setF({ ...f, rooms: f.rooms.map((x) => (x.id === r.id ? { ...x, capacity: e.target.value } : x)) }), { key: `${r.id}-cap` })
          ])}
        </div>
      </div>
      <div className="panel">
        <div className="panel-h"><h2>Entire space</h2></div>
        <div className="fields">
          {f.hallPackages.map((p, i) => input(`h-${p.id}`, `${f.hallPackages.length === 1 ? 'Price per day' : p.name} (${p.start}:00–${p.end}:00), ₦`, p.price, (e) => setF({ ...f, hallPackages: f.hallPackages.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)) }), { key: p.id }))}
        </div>
      </div>
      <div className="panel">
        <div className="panel-h"><h2>Add-ons, for the meeting room and entire space</h2></div>
        <div className="fields">
          {f.addons.map((a, i) => input(`ad-${a.id}`, `${a.name}${a.perGuest ? ' (per guest)' : ''}, ₦`, a.price, (e) => setF({ ...f, addons: f.addons.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)) }), { key: a.id }))}
        </div>
      </div>
    </form>
  );
}
