import { useState, useEffect } from 'react';
import { Users, CreditCard, Activity } from 'lucide-react';
import '../../Admin.css';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default function AdminDashboard() {
  const [stats, setStats] = useState({ totalShops: 0, revenue: 0, pendingApprovals: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const token = localStorage.getItem('adminToken');
      if (!token) return;
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/payments/admin/stats`, {
          headers: { 
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${token}` 
          }
        });
        const data = await res.json();
        if (res.ok) setStats(data);
      } catch (e) {
        console.error('Failed to fetch stats', e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);
  return (
    <div>
      <h1 className="admin-page-title">Overview</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="admin-card" style={{ display: 'flex', alignItems: 'center', margin: 0 }}>
          <div style={{ padding: '1rem', background: '#e0e7ff', borderRadius: '50%', color: '#4f46e5', marginRight: '1rem' }}>
            <Users size={24} />
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: 600 }}>Total Shops</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>
              {isLoading ? '...' : stats.totalShops}
            </div>
          </div>
        </div>

        <div className="admin-card" style={{ display: 'flex', alignItems: 'center', margin: 0 }}>
          <div style={{ padding: '1rem', background: '#dcfce7', borderRadius: '50%', color: '#16a34a', marginRight: '1rem' }}>
            <CreditCard size={24} />
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: 600 }}>Total Revenue</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>
              {isLoading ? '...' : `₹${stats.revenue}`}
            </div>
          </div>
        </div>

        <div className="admin-card" style={{ display: 'flex', alignItems: 'center', margin: 0 }}>
          <div style={{ padding: '1rem', background: '#fef3c7', borderRadius: '50%', color: '#d97706', marginRight: '1rem' }}>
            <Activity size={24} />
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: 600 }}>Pending Approvals</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>
              {isLoading ? '...' : stats.pendingApprovals}
            </div>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <h3 style={{ marginBottom: '1rem', color: '#1e293b' }}>Recent Activity</h3>
        <p style={{ color: '#64748b' }}>More detailed analytics coming soon...</p>
      </div>
    </div>
  );
}
