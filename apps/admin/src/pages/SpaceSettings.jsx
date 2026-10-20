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
          desks: Number(f.desks), dayPass: Number(f.dayPass), bundle10: Number(f.bundle10), monthly: Number(f.monthly), dedicated: Number(f.dedicated),
          vatPercent: Number(f.vatPercent), studentDiscount: Number(f.studentDiscount), teaPerPerson: Number(f.teaPerPerson),
          hallPackages: f.hallPackages.map((p) => ({ ...p, price: Number(p.price), start: Number(p.start), end: Number(p.end) })),
          addons: f.addons.map((a) => ({ ...a, price: Number(a.price) })),
          rooms: f.rooms.map((r) => ({ id: r.id, hourlyRate: Number(r.hourlyRate), capacity: Number(r.capacity) }))
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
      <PageHead eyebrow="Movers Space" title="Prices & rooms" desc="Prices exclude VAT. Changes apply to new bookings only.">
        <button className="btn ink">Save changes</button>
      </PageHead>
      <div className="panel">
        <div className="panel-h"><h2>Workspace</h2></div>
        <div className="fields">
          {input('s-desks', 'Hot desks', f.desks, num('desks'))}
          {input('s-day', 'Day pass (₦, per person)', f.dayPass, num('dayPass'))}
          {input('s-bun', '10-day bundle (₦, per person)', f.bundle10, num('bundle10'))}
          {input('s-mon', 'Monthly hot desk (₦)', f.monthly, num('monthly'))}
          {input('s-ded', 'Dedicated desk, monthly (₦)', f.dedicated, num('dedicated'))}
          {input('s-stu', 'Movers Learn student discount (%)', f.studentDiscount, num('studentDiscount'), { max: 100 })}
          {input('s-vat', 'VAT (%)', f.vatPercent, num('vatPercent'), { step: '0.1' })}
          {input('s-tea', 'Tea and water, per person (₦)', f.teaPerPerson, num('teaPerPerson'))}
        </div>
      </div>
      <div className="panel">
        <div className="panel-h"><h2>Meeting rooms</h2></div>
        <div className="fields">
          {f.rooms.filter((r) => r.kind === 'MEETING').map((r) => [
            input(`r-${r.id}-rate`, `${r.name}: price per hour (₦)`, r.hourlyRate, (e) => setF({ ...f, rooms: f.rooms.map((x) => (x.id === r.id ? { ...x, hourlyRate: e.target.value } : x)) }), { key: `${r.id}-rate` }),
            input(`r-${r.id}-cap`, `${r.name}: seats`, r.capacity, (e) => setF({ ...f, rooms: f.rooms.map((x) => (x.id === r.id ? { ...x, capacity: e.target.value } : x)) }), { key: `${r.id}-cap` })
          ])}
        </div>
      </div>
      <div className="panel">
        <div className="panel-h"><h2>Event hall time blocks</h2></div>
        <div className="fields">
          {f.hallPackages.map((p, i) => input(`h-${p.id}`, `${p.name} (${p.start}:00–${p.end}:00), ₦`, p.price, (e) => setF({ ...f, hallPackages: f.hallPackages.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)) }), { key: p.id }))}
        </div>
      </div>
      <div className="panel">
        <div className="panel-h"><h2>Hall add-ons</h2></div>
        <div className="fields">
          {f.addons.map((a, i) => input(`ad-${a.id}`, `${a.name}${a.perGuest ? ' (per guest)' : ''}, ₦`, a.price, (e) => setF({ ...f, addons: f.addons.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)) }), { key: a.id }))}
        </div>
      </div>
    </form>
  );
}
