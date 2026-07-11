import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from 'firebase/auth';
import { getFirebaseAuth } from './lib/firebase';
import logoUrl from './assets/icon.png';
import './App.css';

import Layout from './components/Layout';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import AppFeatures from './pages/AppFeatures';
import HelpCenter from './pages/HelpCenter';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

type Step = 'plans' | 'phone' | 'otp' | 'details' | 'done';
type PlanType = 'basic' | 'standard' | null;

const BUSINESS_CATEGORIES = [
  'Kirana / Grocery',
  'Medical / Chemist',
  'Stationery / Book Shop',
  'Hardware Store',
  'Salon / Beauty',
  'Clothing / Textile',
  'Restaurant / Dhaba',
  'Other',
];

function RegistrationPage() {
  const [step, setStep] = useState<Step>('plans');
  const [selectedPlan, setSelectedPlan] = useState<PlanType>(null);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [idToken, setIdToken] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [businessCategory, setBusinessCategory] = useState(BUSINESS_CATEGORIES[0]);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSelectPlan = (plan: PlanType) => {
    setSelectedPlan(plan);
    setStep('phone');
  };

  const handleChangePlan = () => {
    setStep('plans');
    setSelectedPlan(null);
  };

  const handleSendOtp = async () => {
    setError('');
    const clean = phone.replace(/\D/g, '');
    if (clean.length !== 10) {
      setError('Enter a valid 10-digit mobile number');
      return;
    }
    setIsLoading(true);
    try {
      const auth = getFirebaseAuth();
      if (!(window as any).recaptchaVerifier) {
        (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
      }
      const verifier = (window as any).recaptchaVerifier;
      const result = await signInWithPhoneNumber(auth, `+91${clean}`, verifier);
      setConfirmation(result);
      setStep('otp');
    } catch (e: any) {
      setError(e?.message ?? 'Could not send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError('');
    if (!confirmation) return;
    setIsLoading(true);
    try {
      const credential = await confirmation.confirm(otp);
      const token = await credential.user.getIdToken();
      setIdToken(token);
      setStep('details');
    } catch (e: any) {
      setError(e?.message ?? 'Invalid OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    setError('');
    if (!shopName || !ownerName) {
      setError('Shop name and owner name are required');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/register-shop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          idToken,
          phone: `+91${phone.replace(/\D/g, '')}`,
          password,
          shopName,
          ownerName,
          businessCategory,
          whatsappNumber,
          plan: selectedPlan,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Registration failed');
      setStep('done');
    } catch (e: any) {
      setError(e?.message ?? 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="content-wrapper">
      <div className="header-section">
        <div className="hero-logo">
          <img src={logoUrl} alt="Pragati Bandhu Logo" className="hero-logo-img" />
          PragatiBandhu
        </div>
        <h1 className="hero-title">
          Start tracking smartly.
        </h1>
        <p className="hero-subtitle">
          Stock khatam hone se pehle, ShopAI bata dega. Choose the perfect plan for your shop.
        </p>
      </div>

      {step === 'plans' && (
        <div className="pricing-grid step-enter">
          {/* Basic Plan */}
          <div className="pricing-card" onClick={() => handleSelectPlan('basic')}>
            <h3 className="plan-name">Basic</h3>
            <div className="plan-price">₹99<span>/mo</span></div>
            <p className="plan-desc">For shops starting to digitise their billing.</p>

            <ul className="feature-list">
              <li>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Stock tracking & live dashboard
              </li>
              <li>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Create bills in seconds
              </li>
              <li>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Customer Udhar management
              </li>
              <li>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Offline-first (No internet needed)
              </li>
              <li className="missing">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                Cloud backup & sync
              </li>
            </ul>

            <button className="btn-outline">Select Basic</button>
          </div>

          {/* Standard Plan (Upsell) */}
          <div className="pricing-card standard" onClick={() => handleSelectPlan('standard')}>
            <div className="popular-badge">Most Popular</div>
            <h3 className="plan-name">Standard</h3>
            <div className="plan-price">₹159<span>/mo</span></div>
            <p className="plan-desc">Everything you need to grow your shop with AI.</p>

            <ul className="feature-list">
              <li>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Everything in Basic
              </li>
              <li>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Cloud backup & multi-device restore
              </li>
              <li>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                PDF Receipt Generation
              </li>
              <li>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Reports & Analytics (Profit, Sales)
              </li>
              <li>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                WhatsApp PDF sharing
              </li>
            </ul>

            <button className="btn-primary">Start 30-Day Free Trial</button>
          </div>
        </div>
      )}

      {step !== 'plans' && (
        <div className="registration-container step-enter">
          <div className="glass-card">
            <div className="selected-plan-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
              {selectedPlan === 'standard' ? 'Standard Plan' : 'Basic Plan'} Selected
              <button className="change-plan-btn" onClick={handleChangePlan}>Change</button>
            </div>

            {step === 'phone' && (
              <div className="step-container step-enter">
                <div className="step-header">
                  <h2>Get Started</h2>
                  <p>Enter your mobile number to register</p>
                </div>
                <div className="input-group">
                  <label>Mobile Number</label>
                  <div className="phone-input">
                    <span className="phone-prefix">+91</span>
                    <input
                      type="tel"
                      maxLength={10}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="10-digit mobile number"
                      autoFocus
                    />
                  </div>
                </div>
                <button className="btn-primary" disabled={isLoading || phone.length < 10} onClick={handleSendOtp}>
                  {isLoading ? <span className="spinner"></span> : 'Send OTP'}
                </button>
              </div>
            )}

            {step === 'otp' && (
              <div className="step-container step-enter">
                <div className="step-header">
                  <h2>Verify Number</h2>
                  <p>We sent a 6-digit code to +91 {phone}</p>
                </div>
                <div className="input-group">
                  <label>One Time Password</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit OTP"
                    autoFocus
                  />
                </div>
                <button className="btn-primary" disabled={isLoading || otp.length < 6} onClick={handleVerifyOtp}>
                  {isLoading ? <span className="spinner"></span> : 'Verify OTP'}
                </button>
              </div>
            )}

            {step === 'details' && (
              <div className="step-container step-enter">
                <div className="step-header">
                  <h2>Shop Details</h2>
                  <p>Set up your business profile</p>
                </div>

                <div className="input-group">
                  <label>Shop Name</label>
                  <input
                    placeholder="e.g. Sharma Kirana Store"
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                  />
                </div>

                <div className="input-group">
                  <label>Owner Name</label>
                  <input
                    placeholder="e.g. Rahul Sharma"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                  />
                </div>

                <div className="input-group">
                  <label>Business Category</label>
                  <div className="input-wrapper">
                    <select value={businessCategory} onChange={(e) => setBusinessCategory(e.target.value)}>
                      {BUSINESS_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="input-group">
                  <label>WhatsApp Number (optional)</label>
                  <div className="phone-input">
                    <span className="phone-prefix">+91</span>
                    <input
                      type="tel"
                      maxLength={10}
                      placeholder="Same as mobile"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="input-group">
                    <label>Password</label>
                    <input type="password" placeholder="Min 6 chars" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <div className="input-group">
                    <label>Confirm</label>
                    <input type="password" placeholder="Repeat password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                  </div>
                </div>

                <button className="btn-primary" disabled={isLoading} onClick={handleRegister}>
                  {isLoading ? <span className="spinner"></span> : 'Create Account'}
                </button>
              </div>
            )}

            {step === 'done' && (
              <div className="step-container step-enter success-state">
                <div className="success-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <h2>Registration Complete!</h2>
                <p>
                  Your shop account has been created on the {selectedPlan === 'standard' ? 'Standard' : 'Basic'} plan. Open the PragatiBandhu app on your Android device and log in with your phone number and password.
                </p>
              </div>
            )}

            {error && (
              <div className="error-msg step-enter">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                {error}
              </div>
            )}
          </div>

          {/* Invisible ReCaptcha Container */}
          <div id="recaptcha-container" />
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/Pragati_Bandhu_Git">
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<RegistrationPage />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/features" element={<AppFeatures />} />
          <Route path="/help" element={<HelpCenter />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
