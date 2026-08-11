import { useState } from 'react';
import logoUrl from '../assets/icon.png';
import qrUrl from '../assets/phonepe-qr.jpg';
import '../App.css';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default function RenewPlan() {
  const [step, setStep] = useState<'auth' | 'pay' | 'done'>('auth');
  const [phone, setPhone] = useState('');
  
  const [planType, setPlanType] = useState('monthly');
  const [utr, setUtr] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleVerifyPhone = async () => {
    setError('');
    const clean = phone.replace(/\D/g, '');
    if (clean.length !== 10) {
      setError('Enter a valid 10-digit mobile number');
      return;
    }
    setIsLoading(true);
    try {
      // Check if phone number is actually registered
      const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/shops?phone=eq.%2B91${clean}&select=id`, {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      });
      const checkBody = await checkRes.json();
      if (!checkBody || checkBody.length === 0) {
        setError('This phone number is not registered. Check the number and try again.');
        setIsLoading(false);
        return;
      }

      setStep('pay');
    } catch (e: any) {
      setError(e?.message ?? 'Could not verify phone number. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitUtr = async () => {
    setError('');
    if (utr.length !== 12) {
      setError('UTR must be exactly 12 digits');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/payments/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          phone: `+91${phone.replace(/\D/g, '')}`,
          utr,
          amount: planType === 'yearly' ? 999 : 99,
          planType
        })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to submit payment');
      
      setStep('done');
    } catch (e: any) {
      setError(e.message ?? 'An error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="content-wrapper">
      <div className="header-section" style={{ paddingBottom: '2rem' }}>
        <div className="hero-logo">
          <img src={logoUrl} alt="Pragati Bandhu Logo" className="hero-logo-img" />
          PragatiBandhu
        </div>
        <h1 className="hero-title">Renew Your Shop Plan</h1>
      </div>

      <div className="registration-container step-enter" style={{ maxWidth: 450, margin: '0 auto' }}>
        <div className="glass-card">
          {step === 'auth' && (
            <div className="step-container step-enter">
              <div className="step-header">
                <h2>Log In to Renew</h2>
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
              <button className="btn-primary" disabled={isLoading || phone.length < 10} onClick={handleVerifyPhone}>
                {isLoading ? <span className="spinner"></span> : 'Continue'}
              </button>
            </div>
          )}

          {step === 'pay' && (
            <div className="step-container step-enter">
              <div className="step-header">
                <h2>Complete Payment</h2>
                <p>Scan the QR code to pay via any UPI App</p>
              </div>
              
              <div className="input-group" style={{ marginBottom: '1.5rem' }}>
                <label>Select Plan to Renew</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.25rem' }}>
                  <div
                    onClick={() => setPlanType('monthly')}
                    style={{
                      padding: '0.875rem 0.5rem',
                      borderRadius: 12,
                      border: planType === 'monthly' ? '2px solid var(--primary-color)' : '1px solid #cbd5e1',
                      background: planType === 'monthly' ? 'var(--primary-light)' : '#fff',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.2s ease',
                      boxShadow: planType === 'monthly' ? '0 2px 8px rgba(79,70,229,0.15)' : 'none'
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>Monthly</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary-color)', marginTop: '2px' }}>₹99</div>
                  </div>

                  <div
                    onClick={() => setPlanType('yearly')}
                    style={{
                      padding: '0.875rem 0.5rem',
                      borderRadius: 12,
                      border: planType === 'yearly' ? '2px solid var(--primary-color)' : '1px solid #cbd5e1',
                      background: planType === 'yearly' ? 'var(--primary-light)' : '#fff',
                      cursor: 'pointer',
                      textAlign: 'center',
                      position: 'relative',
                      transition: 'all 0.2s ease',
                      boxShadow: planType === 'yearly' ? '0 2px 8px rgba(79,70,229,0.15)' : 'none'
                    }}
                  >
                    <span style={{
                      position: 'absolute',
                      top: '-9px',
                      right: '8px',
                      background: 'var(--accent-color)',
                      color: '#fff',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: 8,
                      textTransform: 'uppercase'
                    }}>Save ₹189</span>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>Yearly</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary-color)', marginTop: '2px' }}>₹999</div>
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'center', padding: '1.5rem', background: '#f5f5f5', borderRadius: 12, marginBottom: '1.5rem' }}>
                <p style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '1rem', color: '#333' }}>
                  Scan & Pay exactly ₹{planType === 'yearly' ? '999' : '99'}
                </p>
                {/* Actual merchant QR code */}
                <div style={{ width: 220, height: 220, background: '#fff', border: '2px solid #ddd', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', padding: '0.5rem', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                  <img src={qrUrl} alt="Payment QR Code" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 8 }} />
                </div>
              </div>

              <div className="input-group">
                <label>12-Digit UPI Transaction ID (UTR)</label>
                <input
                  type="text"
                  maxLength={12}
                  value={utr}
                  onChange={(e) => setUtr(e.target.value.replace(/\D/g, '').slice(0, 12))}
                  placeholder="e.g. 301294857210"
                />
                <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>Find this in your UPI app's transaction history.</p>
              </div>

              <button className="btn-primary" disabled={isLoading || utr.length !== 12} onClick={handleSubmitUtr}>
                {isLoading ? <span className="spinner"></span> : 'Submit Payment Proof'}
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
              <h2>Payment Submitted!</h2>
              <p>Your payment proof has been submitted successfully. An admin will verify the UTR and activate your subscription shortly.</p>
            </div>
          )}

          {error && (
            <div className="error-msg step-enter" style={{ marginTop: '1rem' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
