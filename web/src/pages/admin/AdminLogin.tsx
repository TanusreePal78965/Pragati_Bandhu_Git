import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logoUrl from '../../assets/icon.png';
import '../../Admin.css';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username || !password) return setError('Enter username and password');
    
    setIsLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/payments/admin/login`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      
      localStorage.setItem('adminToken', data.token);
      navigate('/admin');
    } catch (e: any) {
      setError(e?.message ?? 'Invalid credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="admin-login-wrapper">
      <div className="admin-login-card">
        <img src={logoUrl} alt="Logo" style={{ width: 64, height: 64, marginBottom: '1rem' }} />
        <h2 style={{ marginBottom: '0.5rem', color: '#0f172a' }}>SuperAdmin Portal</h2>
        <p style={{ color: '#64748b', marginBottom: '2rem' }}>Sign in to manage PragatiBandhu</p>
        
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#334155' }}>Username</label>
            <input 
              type="text" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              style={{ width: '100%', padding: '0.75rem', borderRadius: 6, border: '1px solid #cbd5e1', outline: 'none' }}
              autoFocus
            />
          </div>
          <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#334155' }}>Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              style={{ width: '100%', padding: '0.75rem', borderRadius: 6, border: '1px solid #cbd5e1', outline: 'none' }}
            />
          </div>
          <button 
            type="submit" 
            disabled={isLoading}
            style={{ 
              width: '100%', padding: '0.875rem', background: '#2563eb', color: '#fff', 
              border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: '1rem' 
            }}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        {error && <div style={{ marginTop: '1rem', color: '#ef4444', background: '#fef2f2', padding: '0.75rem', borderRadius: 6, fontSize: '0.875rem' }}>{error}</div>}
      </div>
    </div>
  );
}
