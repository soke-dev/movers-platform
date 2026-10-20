import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthModal, PaymentReturn, RequireAuth, ProfilePage, ReferPage } from '@movers/ui';
import Landing from './pages/Landing.jsx';
import Apply from './pages/Apply.jsx';
import Dashboard from './pages/dashboard/Dashboard.jsx';
import Overview from './pages/dashboard/Overview.jsx';
import Classes from './pages/dashboard/Classes.jsx';
import Course from './pages/dashboard/Course.jsx';
import Tasks from './pages/dashboard/Tasks.jsx';
import Attendance from './pages/dashboard/Attendance.jsx';
import Payments from './pages/dashboard/Payments.jsx';
import Certificate from './pages/dashboard/Certificate.jsx';

export default function App() {
  return (
    <Routes>
      {/* Signing up and logging in open as pop-ups over the landing page. */}
      <Route path="/" element={<Landing />}>
        <Route path="apply" element={<Apply />} />
        <Route path="login" element={<AuthModal />} />
      </Route>
      <Route path="/payments/callback" element={<RequireAuth><PaymentReturn /></RequireAuth>} />
      <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>}>
        <Route index element={<Overview />} />
        <Route path="classes" element={<Classes />} />
        <Route path="course" element={<Course />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="payments" element={<Payments />} />
        <Route path="certificate" element={<Certificate />} />
        <Route path="refer" element={<ReferPage share={(code, link) => `Learn tech in person at Movers Learn, GRA, Benin City. Sign up with my link: ${link} (or use my code ${code})`} />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
