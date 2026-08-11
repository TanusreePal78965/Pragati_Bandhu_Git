import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CreditCard, Store, LogOut } from 'lucide-react';
import logoUrl from '../../assets/icon.png';
import '../../Admin.css';

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isLogged, setIsLogged] = useState(false);

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

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
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
        </nav>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div className="admin-header-title">
            {location.pathname === '/admin' && 'Overview'}
            {location.pathname.includes('/admin/payments') && 'Payments Management'}
            {location.pathname.includes('/admin/shops') && 'Shop Management'}
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
