import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css';

import Layout from './components/Layout';
import Home from './pages/Home';
import ShopAIRegister from './pages/ShopAIRegister';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import AppFeatures from './pages/AppFeatures';
import HelpCenter from './pages/HelpCenter';
import RenewPlan from './pages/RenewPlan';
import ForgotPassword from './pages/ForgotPassword';
import ChuktaSignup from './pages/ChuktaSignup';
import AdminLayout from './pages/admin/AdminLayout';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminPayments from './pages/admin/AdminPayments';
import AdminShops from './pages/admin/AdminShops';
import AdminSettings from './pages/admin/AdminSettings';

export default function App() {
  return (
    <BrowserRouter basename="/Pragati_Bandhu_Git">
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/shopai" element={<ShopAIRegister />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/features" element={<AppFeatures />} />
          <Route path="/help" element={<HelpCenter />} />
          <Route path="/renew" element={<RenewPlan />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/chukta" element={<ChuktaSignup />} />
        </Route>

        {/* Admin Routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="payments" element={<AdminPayments />} />
          <Route path="shops" element={<AdminShops />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
