import { Outlet, useOutletContext } from 'react-router-dom';
import { DashShell, useApi, Loading, ErrorBox, SPACE_URL } from '@movers/ui';
import { derive } from './derive.js';

export const useLearn = () => useOutletContext();

export default function Dashboard() {
  const { data, error, loading, reload } = useApi('/learn/me');
  const d = data ? derive(data) : null;
  const nav = [
    { to: '/dashboard', end: true, label: 'Overview', icon: 'home' },
    { to: '/dashboard/classes', label: 'My classes', icon: 'layers' },
    { to: '/dashboard/course', label: 'My course', icon: 'book' },
    { to: '/dashboard/tasks', label: 'Quizzes & tasks', icon: 'quiz', badge: d?.todo.length ? `${d.todo.length} to do` : null },
    { to: '/dashboard/attendance', label: 'Attendance', icon: 'calendar' },
    { to: '/dashboard/payments', label: 'Payments', icon: 'wallet', badge: d?.owing.length ? `${d.owing.length} due` : null },
    { to: '/dashboard/certificate', label: 'Certificate', icon: 'award' }
  ];
  const tabs = [
    { to: '/dashboard', end: true, label: 'Home', icon: 'home' },
    { to: '/dashboard/tasks', label: 'Tasks', icon: 'quiz', dot: Boolean(d?.todo.length) },
    { to: '/dashboard/attendance', label: 'Attendance', icon: 'calendar' },
    { to: '/dashboard/payments', label: 'Payments', icon: 'wallet', dot: Boolean(d?.owing.length) }
  ];
  const cross = (
    <div className="d-cross">
      Students get a discount on desk days at Movers Space.
      <a className="btn sm soft" href={`${SPACE_URL}/dashboard/book`}>Book a desk</a>
    </div>
  );
  return (
    <DashShell word="learn" nav={nav} tabs={tabs} cross={cross} home="/dashboard">
      {loading && !data ? <Loading /> : error ? <ErrorBox error={error} retry={reload} /> : <Outlet context={{ data, d, reload }} />}
    </DashShell>
  );
}
