import { Outlet, Link, useLocation } from 'react-router-dom';

export default function Layout() {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="hero-blob-1"></div>
      <div className="hero-blob-2"></div>
      
      {/* Responsive Header */}
      <header style={{
        zIndex: 50,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: '1rem 1.5rem',
        display: 'flex',
        justifyContent: isHome ? 'flex-end' : 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        {!isHome && (
          <Link to="/" style={{ color: 'var(--primary-color)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Back to Home
          </Link>
        )}

        <Link to="/renew" style={{ 
          padding: '0.5rem 1rem', 
          background: 'rgba(79, 70, 229, 0.1)', 
          color: 'var(--primary-color)', 
          borderRadius: '8px', 
          textDecoration: 'none', 
          fontWeight: 600, 
          fontSize: '0.875rem',
          border: '1px solid rgba(79, 70, 229, 0.2)',
          whiteSpace: 'nowrap'
        }}>
          Renew Subscription
        </Link>
      </header>

      <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>
        <Outlet />
      </div>

      <footer style={{
        zIndex: 1,
        width: '100%',
        maxWidth: '1000px',
        padding: '2rem 1rem',
        marginTop: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
        color: 'var(--text-muted)'
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1.5rem', fontSize: '0.9rem' }}>
          <Link to="/features" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>App Features</Link>
          <Link to="/help" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Help Center</Link>
          <Link to="/privacy" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Privacy Policy</Link>
          <Link to="/terms" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Terms of Service</Link>
        </div>
        <div style={{ fontSize: '0.8rem' }}>
          &copy; {new Date().getFullYear()} Pragati Bandhu. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
