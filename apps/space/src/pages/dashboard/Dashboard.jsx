import { Outlet, useOutletContext } from 'react-router-dom';
import { DashShell, useApi, Loading, ErrorBox, LEARN_URL } from '@movers/ui';

export const useSpace = () => useOutletContext();

export default function Dashboard() {
  const { data, error, loading, reload } = useApi('/space/me');
  const due = data ? data.payments.filter((p) => p.status === 'UNPAID').length : 0;
  const nav = [
    { to: '/dashboard', end: true, label: 'Overview', icon: 'home' },
    { to: '/dashboard/book', label: 'Book a space', icon: 'plus' },
    { to: '/dashboard/visits', label: 'Visits', icon: 'calendar' },
    { to: '/dashboard/bookings', label: 'Bookings', icon: 'clock' },
    { to: '/dashboard/payments', label: 'Payments', icon: 'wallet', badge: due ? `${due} due` : null },
    { group: 'Account' },
    { to: '/dashboard/refer', label: 'Refer a friend', icon: 'gift' },
    { to: '/dashboard/profile', label: 'Profile', icon: 'settings' }
  ];
  const tabs = [
    { to: '/dashboard', end: true, label: 'Home', icon: 'home' },
    { to: '/dashboard/book', label: 'Book', icon: 'plus' },
    { to: '/dashboard/bookings', label: 'Bookings', icon: 'clock' },
    { to: '/dashboard/payments', label: 'Payments', icon: 'wallet', dot: due > 0 }
  ];
  const cross = (
    <div className="d-cross">
      Learning tech? Movers Learn runs an in-person class here.
      <a className="btn sm white" href={LEARN_URL}>See the class</a>
    </div>
  );
  return (
    <DashShell theme="theme-member" word="space" tone="#fff" nav={nav} tabs={tabs} cross={cross} home="/dashboard" profile="/dashboard/profile">
      {loading && !data ? <Loading /> : error ? <ErrorBox error={error} retry={reload} /> : <Outlet context={{ data, reload }} />}
    </DashShell>
  );
}
