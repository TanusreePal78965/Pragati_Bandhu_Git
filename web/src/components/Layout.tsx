import { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import logoUrl from '../assets/icon.png';
import '../landing.css';

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="page-container lp-page" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="hero-blob-1"></div>
      <div className="hero-blob-2"></div>

      <header className="lp-header">
        <Link to="/" className="lp-brand" onClick={closeMenu}>
          <img src={logoUrl} alt="" />
          Pragati Bandhu
        </Link>
        <button
          type="button"
          className="lp-menu-btn"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <nav className={menuOpen ? 'lp-nav lp-nav-open' : 'lp-nav'}>
          <Link to={{ pathname: '/', hash: '#shopai' }} onClick={closeMenu}>ShopAI</Link>
          <Link to={{ pathname: '/', hash: '#chukta' }} onClick={closeMenu}>Chukta</Link>
          <Link to="/renew" className="lp-nav-renew" onClick={closeMenu}>Renew Subscription</Link>
        </nav>
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
          <Link to="/shopai" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Register ShopAI</Link>
          <Link to="/chukta" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Chukta</Link>
          <Link to="/features" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>App Features</Link>
          <Link to="/help" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Help Center</Link>
          <Link to="/renew" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Renew Subscription</Link>
          <Link to="/forgot-password" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Forgot Password</Link>
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
