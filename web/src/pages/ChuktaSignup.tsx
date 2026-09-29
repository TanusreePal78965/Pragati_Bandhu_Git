import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from 'firebase/auth';
import { getFirebaseAuth } from '../lib/firebase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

type Step = 'phone' | 'otp' | 'details' | 'existing' | 'done';

async function postJson(path: string, body: unknown): Promise<{ ok: boolean; body: any }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, body: await res.json().catch(() => ({})) };
}

export default function ChuktaSignup() {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [idToken, setIdToken] = useState('');
  const [exists, setExists] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => () => {
    (window as any).recaptchaVerifier?.clear();
    delete (window as any).recaptchaVerifier;
  }, []);

  const e164 = () => `+91${phone.replace(/\D/g, '')}`;

  const handleSendOtp = async () => {
    setError('');
    if (phone.replace(/\D/g, '').length !== 10) {
      setError('Enter a valid 10-digit mobile number');
      return;
    }
    setIsLoading(true);
    try {
      const check = await postJson('register/check-phone', { phone: e164() });
      if (!check.ok) throw new Error(check.body.error ?? 'Could not check phone number');
      if (check.body.apps?.includes('chukta')) {
        setError('This number is already registered for Chukta. Open the Chukta app and log in.');
        return;
      }
      setExists(check.body.exists === true);
      const auth = getFirebaseAuth();
      if (!(window as any).recaptchaVerifier) {
        (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
      }
      setConfirmation(await signInWithPhoneNumber(auth, e164(), (window as any).recaptchaVerifier));
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
      setIdToken(await credential.user.getIdToken());
      setStep(exists ? 'existing' : 'details');
    } catch (e: any) {
      setError(e?.message ?? 'Invalid OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    setError('');
    if (!exists) {
      if (!businessName.trim() || !ownerName.trim()) {
        setError('Business name and owner name are required');
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
    } else if (!password) {
      setError('Enter your existing password');
      return;
    }
    setIsLoading(true);
    try {
      const body: Record<string, unknown> = { idToken, phone: e164(), password, apps: ['chukta'], plan: 'monthly' };
      if (!exists) Object.assign(body, { shopName: businessName.trim(), ownerName: ownerName.trim() });
      const res = await postJson('register', body);
      if (!res.ok) throw new Error(res.body.error ?? 'Registration failed');
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
        <h1 className="hero-title">Chukta</h1>
        <p className="hero-subtitle">Worker pay, advances and wages — one simple diary for your staff.</p>
      </div>

      <div className="registration-container step-enter">
        <div className="glass-card">
          {step === 'phone' && (
            <div className="step-container step-enter">
              <div className="step-header">
                <h2>Register for Chukta</h2>
                <p>Enter your mobile number</p>
              </div>
              <div className="input-group">
                <label>Mobile Number</label>
                <div className="phone-input">
                  <span className="phone-prefix">+91</span>
                  <input type="tel" maxLength={10} value={phone} autoFocus placeholder="10-digit mobile number"
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} />
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
                <input type="text" maxLength={6} value={otp} autoFocus placeholder="Enter 6-digit OTP"
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} />
              </div>
              <button className="btn-primary" disabled={isLoading || otp.length < 6} onClick={handleVerifyOtp}>
                {isLoading ? <span className="spinner"></span> : 'Verify OTP'}
              </button>
            </div>
          )}

          {step === 'details' && (
            <div className="step-container step-enter">
              <div className="step-header">
                <h2>Your details</h2>
                <p>You can add properties and workers in the app</p>
              </div>
              <div className="input-group">
                <label>Business Name</label>
                <input placeholder="e.g. Sharma Hotel" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
              </div>
              <div className="input-group">
                <label>Owner Name</label>
                <input placeholder="e.g. Rahul Sharma" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div className="input-group">
                  <label>Password</label>
                  <input type="password" placeholder="Min 6 chars" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <div className="input-group">
                  <label>Confirm</label>
                  <input type="password" placeholder="Repeat password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                </div>
              </div>
              <button className="btn-primary" disabled={isLoading} onClick={handleSubmit}>
                {isLoading ? <span className="spinner"></span> : 'Create Account'}
              </button>
            </div>
          )}

          {step === 'existing' && (
            <div className="step-container step-enter">
              <div className="step-header">
                <h2>Add Chukta to your account</h2>
                <p>This number already has a Pragati Bandhu account (ShopAI). Enter its password — the same login works in both apps.</p>
              </div>
              <div className="input-group">
                <label>Existing Password</label>
                <input type="password" value={password} autoFocus onChange={(e) => setPassword(e.target.value)} />
              </div>
              <button className="btn-primary" disabled={isLoading || !password} onClick={handleSubmit}>
                {isLoading ? <span className="spinner"></span> : 'Add Chukta'}
              </button>
              <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
                Forgot it? <Link to="/forgot-password">Reset your password</Link>
              </p>
            </div>
          )}

          {step === 'done' && (
            <div className="step-container step-enter success-state">
              <div className="success-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <h2>You're registered for Chukta</h2>
              <p>Install the Chukta app and log in with +91 {phone} and your password.</p>
            </div>
          )}

          {error && <div className="error-msg step-enter">{error}</div>}
        </div>
        <div id="recaptcha-container" />
      </div>
    </div>
  );
}
