import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CreditCard, Store, Sliders, LogOut } from 'lucide-react';
import logoUrl from '../../assets/icon.png';
import '../../Admin.css';

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isLogged, setIsLogged] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    // Check if we have a token
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/admin/login');
    } else {
      setIsLogged(true);
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    navigate('/admin/login');
  };

  if (!isLogged) return null;

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="admin-layout">
      {/* Mobile Sidebar Overlay */}
      <div 
        className={`sidebar-overlay ${isSidebarOpen ? 'open' : ''}`} 
        onClick={() => setIsSidebarOpen(false)}
      ></div>

      <aside className={`admin-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="admin-sidebar-header">
          <img src={logoUrl} alt="Logo" className="admin-sidebar-logo" />
          PragatiBandhu
        </div>
        <nav className="admin-nav">
          <Link 
            to="/admin" 
            className={`admin-nav-item ${location.pathname === '/admin' ? 'active' : ''}`}
          >
            <LayoutDashboard className="admin-nav-icon" /> Dashboard
          </Link>
          <Link 
            to="/admin/payments" 
            className={`admin-nav-item ${location.pathname.includes('/admin/payments') ? 'active' : ''}`}
          >
            <CreditCard className="admin-nav-icon" /> Payments
          </Link>
          <Link 
            to="/admin/shops" 
            className={`admin-nav-item ${location.pathname.includes('/admin/shops') ? 'active' : ''}`}
          >
            <Store className="admin-nav-icon" /> Shops
          </Link>
          <Link 
            to="/admin/settings" 
            className={`admin-nav-item ${location.pathname.includes('/admin/settings') ? 'active' : ''}`}
          >
            <Sliders className="admin-nav-icon" /> App Settings
          </Link>
        </nav>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button className="mobile-menu-btn" onClick={toggleSidebar}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <div className="admin-header-title">
            {location.pathname === '/admin' && 'Overview'}
            {location.pathname.includes('/admin/payments') && 'Payments Management'}
            {location.pathname.includes('/admin/shops') && 'Shop Management'}
            {location.pathname.includes('/admin/settings') && 'App Version & Maintenance Settings'}
            </div>
          </div>
          <div className="admin-header-actions">
            <div className="admin-user-profile">
              <div className="admin-avatar">A</div>
              SuperAdmin
            </div>
            <button className="btn-logout" onClick={handleLogout}>
              <LogOut size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              Logout
            </button>
          </div>
        </header>
        
        <div className="admin-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
