import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthPage, PaymentReturn, RequireAuth, VerifyEmail, ResetPassword } from '@movers/ui';
import Landing from './pages/Landing.jsx';
import Apply from './pages/Apply.jsx';
import Dashboard from './pages/dashboard/Dashboard.jsx';
import Overview from './pages/dashboard/Overview.jsx';
import Course from './pages/dashboard/Course.jsx';
import Tasks from './pages/dashboard/Tasks.jsx';
import Attendance from './pages/dashboard/Attendance.jsx';
import Payments from './pages/dashboard/Payments.jsx';
import Certificate from './pages/dashboard/Certificate.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/apply" element={<Apply />} />
      <Route path="/login" element={<AuthPage word="learn" />} />
      <Route path="/verify-email" element={<VerifyEmail word="learn" />} />
      <Route path="/reset-password" element={<ResetPassword word="learn" />} />
      <Route path="/payments/callback" element={<RequireAuth><PaymentReturn /></RequireAuth>} />
      <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>}>
        <Route index element={<Overview />} />
        <Route path="course" element={<Course />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="payments" element={<Payments />} />
        <Route path="certificate" element={<Certificate />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
