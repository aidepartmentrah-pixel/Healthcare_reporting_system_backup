import { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

function Navbar({ language, toggleLanguage, isAuthenticated, onLogout }) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos]   = useState({ top: 0, right: 0 });
  const menuRef   = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target) &&
          triggerRef.current && !triggerRef.current.contains(e.target))
        setMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const ar = i18n.language === 'ar';

  function openMenu() {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuPos(ar
        ? { top: rect.bottom + 8, left: rect.left,                       right: 'auto' }
        : { top: rect.bottom + 8, right: window.innerWidth - rect.right, left: 'auto' }
      );
    }
    setMenuOpen(o => !o);
  }

  const isMortality = location.pathname.startsWith('/mortality');
  const isMedication = location.pathname.startsWith('/medication');
  const isVap       = location.pathname.startsWith('/vap');
  const isClabsi    = location.pathname.startsWith('/clabsi');
  const isCauti     = location.pathname.startsWith('/cauti');
  const isIcSummary = location.pathname === '/ic/summary';
  const isHome   = location.pathname === '/';

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Logo & Brand — always links to home */}
        <button
          className="navbar-brand"
          onClick={() => navigate('/')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <div className="logo">
            <img src="/LOGO.png" alt="logo" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
          </div>
          <div className="brand-text">
            <h1 className="brand-title">
              {isMortality
                ? t('mortalitySystemTitle')
                : isMedication
                  ? t('medicationSystemTitle')
                  : (isVap || isClabsi || isCauti || isIcSummary)
                    ? t('infectionControlSystemTitle')
                    : t('healthcareSystemTitle')}
            </h1>
            <p className="brand-subtitle">
              {t('advancedMedicalAnalytics')}
            </p>
          </div>
        </button>

        <div className="navbar-menu">
          {/* Home: no section links */}
          {isHome && null}

          {/* IC Summary page links */}
          {isIcSummary && (
            <>
              <NavLink to="/vap/dashboard" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                <span className="nav-icon">🫁</span>
                <span>VAP</span>
              </NavLink>
              <NavLink to="/clabsi/dashboard" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                <span className="nav-icon">🩸</span>
                <span>CLABSI</span>
              </NavLink>
              <NavLink to="/cauti/dashboard" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                <span className="nav-icon">🧬</span>
                <span>CAUTI</span>
              </NavLink>
              <NavLink to="/ic/summary" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                <span className="nav-icon">📋</span>
                <span>{ar ? 'الملخص' : 'Summary'}</span>
              </NavLink>
            </>
          )}

          {/* Mortality section links */}
          {isMortality && (
            <>
              <NavLink to="/mortality/dashboard" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                <span className="nav-icon">📊</span>
                <span>{t('dashboard')}</span>
              </NavLink>
              {isAuthenticated && (
                <>
                  <NavLink to="/mortality/upload" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                    <span className="nav-icon">📤</span>
                    <span>{t('upload')}</span>
                  </NavLink>
                  <NavLink to="/mortality/reports" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                    <span className="nav-icon">📄</span>
                    <span>{t('reports')}</span>
                  </NavLink>
                </>
              )}
            </>
          )}

          {/* VAP / Infection Control section links */}
          {isVap && (
            <>
              <NavLink to="/vap/dashboard" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                <span className="nav-icon">📊</span>
                <span>{t('navDashboard')}</span>
              </NavLink>
              <NavLink to="/ic/summary" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                <span className="nav-icon">📋</span>
                <span>{ar ? 'الملخص' : 'Summary'}</span>
              </NavLink>
              {isAuthenticated && (
                <>
                  <NavLink to="/vap/upload" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                    <span className="nav-icon">📤</span>
                    <span>{t('navUpload')}</span>
                  </NavLink>
                  <NavLink to="/vap/reports" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                    <span className="nav-icon">📄</span>
                    <span>{t('navReports')}</span>
                  </NavLink>
                </>
              )}
            </>
          )}

          {/* CLABSI section links */}
          {isClabsi && (
            <>
              <NavLink to="/clabsi/dashboard" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                <span className="nav-icon">📊</span>
                <span>{t('navDashboard')}</span>
              </NavLink>
              <NavLink to="/ic/summary" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                <span className="nav-icon">📋</span>
                <span>{ar ? 'الملخص' : 'Summary'}</span>
              </NavLink>
              {isAuthenticated && (
                <>
                  <NavLink to="/clabsi/upload" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                    <span className="nav-icon">📤</span>
                    <span>{t('navUpload')}</span>
                  </NavLink>
                  <NavLink to="/clabsi/reports" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                    <span className="nav-icon">📄</span>
                    <span>{t('navReports')}</span>
                  </NavLink>
                </>
              )}
            </>
          )}

          {/* CAUTI section links */}
          {isCauti && (
            <>
              <NavLink to="/cauti/dashboard" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                <span className="nav-icon">📊</span>
                <span>{t('navDashboard')}</span>
              </NavLink>
              <NavLink to="/ic/summary" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                <span className="nav-icon">📋</span>
                <span>{ar ? 'الملخص' : 'Summary'}</span>
              </NavLink>
              {isAuthenticated && (
                <>
                  <NavLink to="/cauti/upload" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                    <span className="nav-icon">📤</span>
                    <span>{t('navUpload')}</span>
                  </NavLink>
                  <NavLink to="/cauti/reports" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                    <span className="nav-icon">📄</span>
                    <span>{t('navReports')}</span>
                  </NavLink>
                </>
              )}
            </>
          )}

          {/* Medication section links */}
          {isMedication && (
            <>
              <NavLink to="/medication/dashboard" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                <span className="nav-icon">📊</span>
                <span>{t('navDashboard')}</span>
              </NavLink>
              {isAuthenticated && (
                <>
                  <NavLink to="/medication/upload" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                    <span className="nav-icon">📤</span>
                    <span>{t('navUpload')}</span>
                  </NavLink>
                  <NavLink to="/medication/reports" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                    <span className="nav-icon">📄</span>
                    <span>{t('navReports')}</span>
                  </NavLink>
                </>
              )}
            </>
          )}

          {/* Collapsed menu trigger */}
          <button
            ref={triggerRef}
            onClick={openMenu}
            className="language-toggle"
            style={{ fontWeight: 700, fontSize: 20 }}
            title="Menu"
          >
            <span>{menuOpen ? '✕' : '☰'}</span>
          </button>

          {/* Dropdown — fixed so it's never clipped by navbar overflow */}
          {menuOpen && (
            <div ref={menuRef} style={{
              position: 'fixed',
              top: menuPos.top,
              right: menuPos.right,
              left: menuPos.left,
              background: '#fff',
              borderRadius: 14,
              boxShadow: '0 12px 32px rgba(0,0,0,0.15)',
              border: '1px solid #e2e8f0',
              minWidth: 200,
              zIndex: 9999,
              overflow: 'hidden',
            }}>
              {/* Language */}
              <button
                onClick={() => { toggleLanguage(); setMenuOpen(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', width: '100%', background: 'none', border: 'none', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontSize: 15, color: '#374151', textAlign: 'start' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <span style={{ fontSize: 20 }}>🌐</span>
                <span>{ar ? 'English' : 'العربية'}</span>
              </button>

              {/* Settings — authenticated only */}
              {isAuthenticated && (
                <button
                  onClick={() => { navigate('/admin'); setMenuOpen(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', width: '100%', background: 'none', border: 'none', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontSize: 15, color: '#0f766e', textAlign: 'start' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <span style={{ fontSize: 20 }}>⚙️</span>
                  <span>{t('navSettings')}</span>
                </button>
              )}

              {/* Auth */}
              {isAuthenticated ? (
                <button
                  onClick={() => { onLogout(); setMenuOpen(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#dc2626', textAlign: 'start' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <span style={{ fontSize: 20 }}>🔓</span>
                  <span>{t('navLogout')}</span>
                </button>
              ) : (
                <button
                  onClick={() => { navigate('/login'); setMenuOpen(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#1e40af', textAlign: 'start' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <span style={{ fontSize: 20 }}>🔑</span>
                  <span>{t('navLogin')}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
