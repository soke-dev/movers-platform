import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthPage, PaymentReturn, RequireAuth, VerifyEmail, ResetPassword } from '@movers/ui';
import Landing from './pages/Landing.jsx';
import Dashboard from './pages/dashboard/Dashboard.jsx';
import Overview from './pages/dashboard/Overview.jsx';
import Visits from './pages/dashboard/Visits.jsx';
import Bookings from './pages/dashboard/Bookings.jsx';
import Book from './pages/dashboard/Book.jsx';
import Payments from './pages/dashboard/Payments.jsx';
import Refer from './pages/dashboard/Refer.jsx';

export default function App() {
  return (
    <div className="space-ui">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<AuthPage word="space" />} />
      <Route path="/verify-email" element={<VerifyEmail word="space" />} />
      <Route path="/reset-password" element={<ResetPassword word="space" />} />
        <Route path="/payments/callback" element={<RequireAuth><PaymentReturn /></RequireAuth>} />
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>}>
          <Route index element={<Overview />} />
          <Route path="visits" element={<Visits />} />
          <Route path="bookings" element={<Bookings />} />
          <Route path="book" element={<Book />} />
          <Route path="payments" element={<Payments />} />
          <Route path="refer" element={<Refer />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
