import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthModal, PaymentReturn, RequireAuth, ProfilePage, ReferPage } from '@movers/ui';
import Landing from './pages/Landing.jsx';
import Dashboard from './pages/dashboard/Dashboard.jsx';
import Overview from './pages/dashboard/Overview.jsx';
import Visits from './pages/dashboard/Visits.jsx';
import Bookings from './pages/dashboard/Bookings.jsx';
import Book from './pages/dashboard/Book.jsx';
import Payments from './pages/dashboard/Payments.jsx';

export default function App() {
  return (
    <div className="space-ui">
      <Routes>
        {/* Logging in opens as a pop-up over the landing page. */}
        <Route path="/" element={<Landing />}>
          <Route path="login" element={<AuthModal />} />
        </Route>
        <Route path="/payments/callback" element={<RequireAuth><PaymentReturn /></RequireAuth>} />
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>}>
          <Route index element={<Overview />} />
          <Route path="visits" element={<Visits />} />
          <Route path="bookings" element={<Bookings />} />
          <Route path="book" element={<Book />} />
          <Route path="payments" element={<Payments />} />
          <Route path="refer" element={<ReferPage share={(code, link) => `Work from Movers Space in GRA, Benin City. Sign up with my link: ${link} (or use my code ${code})`} />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
