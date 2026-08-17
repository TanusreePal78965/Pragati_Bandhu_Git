import { useState, useEffect, useRef } from 'react';
import { Search, MoreVertical, Power, CalendarPlus, FileText, X } from 'lucide-react';
import '../../Admin.css';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

type Shop = {
  id: string;
  shop_name: string;
  owner_name: string;
  phone: string;
  plan_type: string;
  plan_expires_at: string | null;
  is_active: boolean;
  created_at: string;
};

export default function AdminShops() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Action Menu State
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Modal State
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [shopDetails, setShopDetails] = useState<any>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    fetchShops();
  }, []);

  const fetchShops = async () => {
    setIsLoading(true);
    setError('');
    const token = localStorage.getItem('adminToken');
    if (!token) return;

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/payments/admin/shops`, {
        headers: { 
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}` 
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch shops');
      setShops(data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStatus = async (shopId: string, currentStatus: boolean) => {
    setActiveMenu(null);
    const action = currentStatus ? 'SUSPEND' : 'ACTIVATE';
    if (!confirm(`Are you sure you want to ${action} this shop?`)) return;

    const token = localStorage.getItem('adminToken')!;
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/payments/admin/shops/${shopId}/toggle-status`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to toggle status');
      setShops(prev => prev.map(s => s.id === shopId ? { ...s, is_active: data.is_active } : s));
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleExtendPlan = async (shopId: string) => {
    setActiveMenu(null);
    if (!confirm('Are you sure you want to manually add 30 days to this shop\'s plan?')) return;

    const token = localStorage.getItem('adminToken')!;
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/payments/admin/shops/${shopId}/extend-plan`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to extend plan');
      alert(`Success! New expiry date: ${new Date(data.newExpiry).toLocaleDateString()}`);
      fetchShops();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleViewDetails = async (shopId: string) => {
    setActiveMenu(null);
    setSelectedShopId(shopId);
    setIsLoadingDetails(true);
    setShopDetails(null);

    const token = localStorage.getItem('adminToken')!;
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/payments/admin/shops/${shopId}`, {
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch details');
      setShopDetails(data);
    } catch (e: any) {
      alert(e.message);
      setSelectedShopId(null);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const filteredShops = shops.filter(s => 
    s.shop_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.phone?.includes(searchQuery)
  );

  return (
    <div>
      <div className="admin-page-header-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="admin-page-title" style={{ margin: 0 }}>Registered Shops</h1>
        
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input 
            type="text" 
            placeholder="Search by name or phone..." 
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
              <th>Shop Info</th>
              <th>Owner</th>
              <th>Plan Type</th>
              <th>Expiry Date</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                  Loading shops...
                </td>
              </tr>
            ) : filteredShops.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                  No shops found matching your search.
                </td>
              </tr>
            ) : (
              filteredShops.map(shop => {
                const isExpired = shop.plan_expires_at ? new Date(shop.plan_expires_at) < new Date() : true;
                return (
                  <tr key={shop.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{shop.shop_name}</div>
                      <div style={{ fontSize: '0.85rem', color: '#475569' }}>{shop.phone}</div>
                    </td>
                    <td>{shop.owner_name}</td>
                    <td>
                      {shop.plan_type ? (
                        <span className="badge badge-warning">{shop.plan_type}</span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>None</span>
                      )}
                    </td>
                    <td>
                      {shop.plan_expires_at ? (
                        <div style={{ color: isExpired ? '#ef4444' : '#0f172a', fontWeight: isExpired ? 600 : 400 }}>
                          {new Date(shop.plan_expires_at).toLocaleDateString()}
                          {isExpired && <span style={{ display: 'block', fontSize: '0.75rem' }}>(Expired)</span>}
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>-</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${shop.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {shop.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', position: 'relative' }}>
                      <button 
                        onClick={() => setActiveMenu(activeMenu === shop.id ? null : shop.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '0.5rem' }}>
                        <MoreVertical size={18} />
                      </button>
                      
                      {activeMenu === shop.id && (
                        <div ref={menuRef} style={{
                          position: 'absolute', right: '2.5rem', top: '1rem', background: '#fff',
                          border: '1px solid #e2e8f0', borderRadius: '6px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                          zIndex: 50, minWidth: '160px', textAlign: 'left', overflow: 'hidden'
                        }}>
                          <button 
                            onClick={() => handleViewDetails(shop.id)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.75rem 1rem', 
                              border: 'none', background: 'none', color: '#334155', cursor: 'pointer', fontSize: '0.875rem', 
                              fontWeight: 500, borderBottom: '1px solid #f1f5f9'
                            }}
                          >
                            <FileText size={14} /> View Details
                          </button>
                          <button 
                            onClick={() => handleToggleStatus(shop.id, shop.is_active)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.75rem 1rem', 
                              border: 'none', background: 'none', color: shop.is_active ? '#ef4444' : '#16a34a', cursor: 'pointer', 
                              fontSize: '0.875rem', fontWeight: 500, borderBottom: '1px solid #f1f5f9'
                            }}
                          >
                            <Power size={14} /> {shop.is_active ? 'Suspend Shop' : 'Activate Shop'}
                          </button>
                          <button 
                            onClick={() => handleExtendPlan(shop.id)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.75rem 1rem', 
                              border: 'none', background: 'none', color: '#334155', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500
                            }}
                          >
                            <CalendarPlus size={14} /> Extend Plan (30d)
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Shop Details Modal */}
      {selectedShopId && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '90%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            
            {isLoadingDetails ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading analytics...</div>
            ) : shopDetails ? (
              <>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h2 style={{ margin: '0 0 0.25rem 0', color: '#0f172a' }}>{shopDetails.shop.shop_name}</h2>
                    <div style={{ color: '#64748b', fontSize: '0.875rem' }}>
                      {shopDetails.shop.business_category} • {shopDetails.shop.phone}
                    </div>
                  </div>
                  <button onClick={() => setSelectedShopId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                    <X size={24} />
                  </button>
                </div>

                <div style={{ padding: '1.5rem' }}>
                  <h3 style={{ margin: '0 0 1rem 0', color: '#334155', fontSize: '1rem' }}>Shop Analytics</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                    <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Products</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>{shopDetails.metrics.products}</div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Customers</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>{shopDetails.metrics.customers}</div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Sales</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>{shopDetails.metrics.sales}</div>
                    </div>
                  </div>

                  <h3 style={{ margin: '0 0 1rem 0', color: '#334155', fontSize: '1rem' }}>Payment History</h3>
                  {shopDetails.payments.length > 0 ? (
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                        <thead style={{ background: '#f8fafc' }}>
                          <tr>
                            <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600 }}>Date</th>
                            <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600 }}>Amount</th>
                            <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600 }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {shopDetails.payments.map((p: any) => (
                            <tr key={p.id}>
                              <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>{new Date(p.created_at).toLocaleDateString()}</td>
                              <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', fontWeight: 500 }}>₹{p.amount}</td>
                              <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>
                                <span className={`badge ${p.status === 'success' ? 'badge-success' : p.status === 'pending' ? 'badge-warning' : 'badge-danger'}`}>
                                  {p.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', color: '#64748b', border: '1px dashed #cbd5e1' }}>
                      No subscription payments found.
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
