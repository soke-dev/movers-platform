import { useEffect, useRef } from 'react';
import { Icon } from './Icon.jsx';
import { PAY_STATUS, naira, fmtDate, METHOD } from './format.js';

export const Chip = ({ kind = 'lock', children }) => <span className={`chip ${kind}`}>{children}</span>;

export function PayChip({ status, dueDate }) {
  const [kind, label] = PAY_STATUS[status] || ['lock', status];
  if (status === 'UNPAID' && dueDate && new Date(dueDate) > new Date()) return <span className="chip due">Due {fmtDate(dueDate)}</span>;
  return <span className={`chip ${kind}`}>{label}</span>;
}

export const Loading = ({ text = 'Loading…' }) => <div className="loading">{text}</div>;

export const ErrorBox = ({ error, retry }) => (
  <div className="errbox">
    {error?.message || String(error)} {retry && <button className="linkbtn" onClick={retry}>Try again</button>}
  </div>
);

export const Empty = ({ children, icon = 'check' }) => (
  <div className="empty"><span className="ib"><Icon name={icon} /></span><span>{children}</span></div>
);

export function Field({ id, label, hint, wide, children }) {
  return (
    <div className={`field${wide ? ' wide' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function Receipt({ p }) {
  return (
    <div className="receipt">
      <div><span>Movers Tech Ltd</span><span>{p.reference}</span></div>
      <div><span>Date</span><span>{fmtDate(p.paidAt || p.createdAt)}</span></div>
      <div><span>Item</span><span style={{ textAlign: 'right' }}>{p.description}</span></div>
      <div><span>Paid via</span><span>{METHOD[p.method] || '—'}</span></div>
      <div style={{ borderTop: '1px dashed var(--line)', paddingTop: 8, fontWeight: 600 }}><span>Amount</span><span>{naira(p.amount)}</span></div>
    </div>
  );
}

/** Labels table cells so tables can show as cards on phones. */
export function useTableLabels(dep) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const heads = [...el.querySelectorAll('thead th')].map((th) => th.textContent.trim());
    el.querySelectorAll('tbody tr').forEach((tr) => [...tr.children].forEach((td, i) => td.setAttribute('data-l', heads[i] || '')));
  });
  return ref;
}

export function Table({ head, children }) {
  const ref = useTableLabels();
  return (
    <div className="tbl" ref={ref}>
      <table>
        <thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
