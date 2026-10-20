import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthPage, RequireAuth, DashShell, useApi, useAuth } from '@movers/ui';
import { CohortProvider } from './shared.jsx';
import Overview from './pages/Overview.jsx';
import Payments from './pages/Payments.jsx';
import Classes from './pages/Classes.jsx';
import Skills from './pages/Skills.jsx';
import Students from './pages/Students.jsx';
import Tasks from './pages/Tasks.jsx';
import Attendance from './pages/Attendance.jsx';
import Announcements from './pages/Announcements.jsx';
import SpaceToday from './pages/SpaceToday.jsx';
import Door from './pages/Door.jsx';
import Bookings from './pages/Bookings.jsx';
import Members from './pages/Members.jsx';
import SpaceSettings from './pages/SpaceSettings.jsx';
import Team from './pages/Team.jsx';

function Shell() {
  const { user } = useAuth();
  const ov = useApi('/admin/overview');
  const pending = ov.data?.pendingCount || 0;
  const toGrade = ov.data?.toGrade || 0;
  const nav = [
    { group: 'Today' },
    { to: '/', end: true, label: 'Overview', icon: 'home' },
    { to: '/payments', label: 'Payments', icon: 'wallet', badge: pending || null },
    { group: 'Movers Learn' },
    { to: '/classes', label: 'Classes', icon: 'layers' },
    { to: '/skills', label: 'Skills', icon: 'pen' },
    { to: '/students', label: 'Students', icon: 'users' },
    { to: '/tasks', label: 'Quizzes & tasks', icon: 'quiz', badge: toGrade ? `${toGrade} to grade` : null },
    { to: '/attendance', label: 'Attendance', icon: 'calendar' },
    { to: '/announcements', label: 'Announcements', icon: 'megaphone' },
    { group: 'Movers Space' },
    { to: '/space', label: 'Space today', icon: 'laptop' },
    { to: '/door', label: 'Door scanner', icon: 'qr' },
    { to: '/bookings', label: 'Bookings', icon: 'clock' },
    { to: '/members', label: 'Members', icon: 'pin' },
    { to: '/space-settings', label: 'Prices & rooms', icon: 'settings' },
    ...(user?.role === 'ADMIN' ? [{ group: 'Account' }, { to: '/team', label: 'Team', icon: 'shield' }] : [])
  ];
  const tabs = [
    { to: '/', end: true, label: 'Home', icon: 'home' },
    { to: '/payments', label: 'Payments', icon: 'wallet', dot: pending > 0 },
    { to: '/tasks', label: 'Tasks', icon: 'quiz' },
    { to: '/space', label: 'Space', icon: 'laptop' }
  ];
  return (
    <CohortProvider>
      <DashShell theme="theme-admin" word="admin" tone="#fff" nav={nav} tabs={tabs} home="/">
        <Outlet context={{ refreshCounts: ov.reload }} />
      </DashShell>
    </CohortProvider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage word="admin" home="/" staff />} />
      <Route element={<RequireAuth staff><Shell /></RequireAuth>}>
        <Route index element={<Overview />} />
        <Route path="payments" element={<Payments />} />
        <Route path="classes" element={<Classes />} />
        <Route path="skills" element={<Skills />} />
        <Route path="students" element={<Students />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="space" element={<SpaceToday />} />
        <Route path="door" element={<Door />} />
        <Route path="bookings" element={<Bookings />} />
        <Route path="members" element={<Members />} />
        <Route path="space-settings" element={<SpaceSettings />} />
        <Route path="team" element={<Team />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
