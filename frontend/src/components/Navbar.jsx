import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

function Navbar({ language, toggleLanguage, isAuthenticated, onLogout }) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const ar = i18n.language === 'ar';

  const isMortality = location.pathname.startsWith('/mortality');
  const isMedication = location.pathname.startsWith('/medication');
  const isVap    = location.pathname.startsWith('/vap');
  const isClabsi = location.pathname.startsWith('/clabsi');
  const isCauti  = location.pathname.startsWith('/cauti');
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
                  : (isVap || isClabsi || isCauti)
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

          {/* Language Toggle */}
          <button onClick={toggleLanguage} className="language-toggle">
            <span className="globe-icon">🌐</span>
            <span>{ar ? 'EN' : 'ع'}</span>
          </button>

          {/* Settings icon — authenticated only */}
          {isAuthenticated && (
            <button
              onClick={() => navigate('/admin')}
              className="language-toggle"
              style={{ color: '#0f766e' }}
              title={t('navSettings')}
            >
              <span>⚙️</span>
              <span>{t('navSettings')}</span>
            </button>
          )}

          {/* Auth button */}
          {isAuthenticated ? (
            <button
              onClick={onLogout}
              className="language-toggle"
              style={{ color: '#dc2626' }}
              title={t('navLogout')}
            >
              <span>🔓</span>
              <span>{t('navLogout')}</span>
            </button>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="language-toggle"
              style={{ color: '#1e40af' }}
              title={t('navLogin')}
            >
              <span>🔑</span>
              <span>{t('navLogin')}</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
