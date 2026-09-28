import { useState } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from 'firebase/auth';
import { getFirebaseAuth } from '../lib/firebase';
import '../App.css';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default function ForgotPassword() {
  const [step, setStep] = useState<'phone' | 'otp' | 'password' | 'done'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [idToken, setIdToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const clean = phone.replace(/\D/g, '');

  const sendOtp = async () => {
    setError('');
    if (clean.length !== 10) return setError('Enter a valid 10-digit mobile number');
    setIsLoading(true);
    try {
      const auth = getFirebaseAuth();
      if (!(window as any).recaptchaVerifier) {
        (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
      }
      setConfirmation(await signInWithPhoneNumber(auth, `+91${clean}`, (window as any).recaptchaVerifier));
      setStep('otp');
    } catch (e: any) {
      setError(e?.message ?? 'Could not send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async () => {
    setError('');
    if (!confirmation) return;
    setIsLoading(true);
    try {
      const credential = await confirmation.confirm(otp);
      setIdToken(await credential.user.getIdToken());
      setStep('password');
    } catch (e: any) {
      setError(e?.message ?? 'Invalid OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const savePassword = async () => {
    setError('');
    if (password.length < 6) return setError('Password must be at least 6 characters');
    if (password !== confirmPassword) return setError('Passwords do not match');
    setIsLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ idToken, phone: `+91${clean}`, newPassword: password }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Could not reset password');
      setStep('done');
    } catch (e: any) {
      setError(e?.message ?? 'Could not reset password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="content-wrapper">
      <div className="header-section">
        <h1 className="hero-title">Reset Password</h1>
        <p className="hero-subtitle">One password works for all Pragati Bandhu apps.</p>
      </div>

      <div className="registration-container step-enter" style={{ maxWidth: 450, margin: '0 auto' }}>
        <div className="glass-card">
          {step === 'phone' && (
            <div className="step-container step-enter">
              <div className="step-header">
                <h2>Verify Your Number</h2>
                <p>Enter your registered mobile number</p>
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
              <button className="btn-primary" disabled={isLoading || clean.length < 10} onClick={sendOtp}>
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
              <button className="btn-primary" disabled={isLoading || otp.length < 6} onClick={verifyOtp}>
                {isLoading ? <span className="spinner"></span> : 'Verify OTP'}
              </button>
            </div>
          )}

          {step === 'password' && (
            <div className="step-container step-enter">
              <div className="step-header">
                <h2>Set New Password</h2>
                <p>Choose a new password for your account</p>
              </div>
              <div className="input-group">
                <label>New Password</label>
                <input type="password" placeholder="Min 6 chars" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="input-group">
                <label>Confirm Password</label>
                <input type="password" placeholder="Repeat password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              </div>
              <button className="btn-primary" disabled={isLoading} onClick={savePassword}>
                {isLoading ? <span className="spinner"></span> : 'Save Password'}
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
              <h2>Password Updated!</h2>
              <p>Open the app and log in with your new password.</p>
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

          <div id="recaptcha-container" />
        </div>
      </div>
    </div>
  );
}
