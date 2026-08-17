import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import '../../Admin.css';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

type Payment = {
  id: string;
  merchant_transaction_id: string;
  amount: number;
  plan_type: string;
  status: string;
  created_at: string;
  shops: {
    id: string;
    shop_name: string;
    phone: string;
    owner_name: string;
  };
};

export default function AdminPayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (token) fetchPendingPayments(token);
  }, []);

  const fetchPendingPayments = async (token: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/payments/admin/pending`, {
        headers: { 
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}` 
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch payments');
      setPayments(data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    if (!confirm('Are you sure you want to APPROVE this payment and extend the subscription?')) return;
    setIsLoading(true);
    const token = localStorage.getItem('adminToken')!;
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/payments/admin/approve/${id}`, {
        method: 'POST',
        headers: { 
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}` 
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to approve');
      alert(`Approved! New expiry date: ${new Date(data.newExpiry).toLocaleDateString()}`);
      fetchPendingPayments(token);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm('Are you sure you want to REJECT this payment?')) return;
    setIsLoading(true);
    const token = localStorage.getItem('adminToken')!;
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/payments/admin/reject/${id}`, {
        method: 'POST',
        headers: { 
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}` 
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reject');
      fetchPendingPayments(token);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPayments = payments.filter(p => p.merchant_transaction_id.includes(searchQuery));

  return (
    <div>
      <div className="admin-page-header-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="admin-page-title" style={{ margin: 0 }}>Pending Approvals</h1>
        
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input 
            type="text" 
            placeholder="Search by UTR..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '0.625rem 1rem 0.625rem 2.5rem', borderRadius: 6, border: '1px solid #cbd5e1', outline: 'none' }}
          />
        </div>
      </div>

      {error && <div style={{ marginBottom: '1rem', color: '#ef4444', background: '#fef2f2', padding: '0.75rem', borderRadius: 6 }}>{error}</div>}

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Shop Info</th>
              <th>Plan</th>
              <th>Amount</th>
              <th>UTR</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayments.map(p => (
              <tr key={p.id}>
                <td>
                  <div style={{ fontWeight: 500 }}>{new Date(p.created_at).toLocaleDateString()}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{new Date(p.created_at).toLocaleTimeString()}</div>
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{p.shops?.shop_name}</div>
                  <div style={{ fontSize: '0.85rem', color: '#475569' }}>{p.shops?.phone}</div>
                </td>
                <td><span className="badge badge-warning">{p.plan_type}</span></td>
                <td style={{ fontWeight: 700 }}>₹{p.amount}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '1rem', background: '#f1f5f9', padding: '0.25rem 0.5rem', borderRadius: 4, display: 'inline-block' }}>
                  {p.merchant_transaction_id}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      onClick={() => handleApprove(p.id)} 
                      disabled={isLoading}
                      style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: 6, cursor: 'pointer', fontWeight: 500 }}>
                      Approve
                    </button>
                    <button 
                      onClick={() => handleReject(p.id)} 
                      disabled={isLoading}
                      style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: 6, cursor: 'pointer', fontWeight: 500 }}>
                      Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredPayments.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                  <div style={{ marginBottom: '1rem' }}><Search size={32} style={{ opacity: 0.5 }} /></div>
                  No pending payments found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
