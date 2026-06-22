import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Navbar';

export default function Login() {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const { login, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  function toggleLanguage() {
    const newLang = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(newLang);
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
  }

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const from = location.state?.from?.pathname || '/';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const ok = await login(username.trim(), password);
    if (ok) {
      navigate(from, { replace: true });
    } else {
      setError(t('loginError'));
    }
    setLoading(false);
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #e0f7f9 0%, #e8f8e8 100%)',
      display: 'flex',
      flexDirection: 'column',
      direction: ar ? 'rtl' : 'ltr',
    }}>
      <Navbar
        language={i18n.language}
        toggleLanguage={toggleLanguage}
        isAuthenticated={isAuthenticated}
        onLogout={logout}
      />
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: '#ffffff',
        borderRadius: '20px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
        overflow: 'hidden',
        border: '1px solid #e2e8f0',
      }}>
        {/* Header */}
        <div style={{
          background: '#ffffff',
          padding: '2rem',
          textAlign: 'center',
          borderBottom: '1px solid #e2e8f0',
        }}>
          <div style={{
            width: '90px', height: '90px',
            borderRadius: '18px',
            overflow: 'hidden',
            margin: '0 auto 1rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          }}>
            <img
              src="/LOGO.png"
              alt="logo"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          <h1 style={{
            margin: 0,
            color: '#0e9aab',
            fontSize: '1.375rem',
            fontWeight: 700,
            lineHeight: 1.3,
          }}>{t('loginTitle')}</h1>
          <p style={{
            margin: '0.5rem 0 0',
            color: '#64748b',
            fontSize: '0.875rem',
          }}>{t('loginSubtitle')}</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '2rem' }}>
          {/* Username */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: 600,
              color: '#374151',
              fontSize: '0.875rem',
            }}>{t('loginUsername')}</label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute',
                [ar ? 'right' : 'left']: '0.875rem',
                top: '50%', transform: 'translateY(-50%)',
                fontSize: '1rem', color: '#9ca3af',
              }}>👤</span>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder={t('loginUsernamePlaceholder')}
                required
                autoFocus
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: ar ? '0.75rem 2.75rem 0.75rem 0.875rem' : '0.75rem 0.875rem 0.75rem 2.75rem',
                  border: '1.5px solid #e5e7eb',
                  borderRadius: '10px',
                  fontSize: '0.9375rem',
                  color: '#1f2937',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = '#3b82f6'}
                onBlur={e => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: 600,
              color: '#374151',
              fontSize: '0.875rem',
            }}>{t('loginPassword')}</label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute',
                [ar ? 'right' : 'left']: '0.875rem',
                top: '50%', transform: 'translateY(-50%)',
                fontSize: '1rem', color: '#9ca3af',
              }}>🔒</span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={t('loginPasswordPlaceholder')}
                required
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: ar
                    ? '0.75rem 2.75rem 0.75rem 2.75rem'
                    : '0.75rem 2.75rem 0.75rem 2.75rem',
                  border: '1.5px solid #e5e7eb',
                  borderRadius: '10px',
                  fontSize: '0.9375rem',
                  color: '#1f2937',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = '#3b82f6'}
                onBlur={e => e.target.style.borderColor = '#e5e7eb'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                style={{
                  position: 'absolute',
                  [ar ? 'left' : 'right']: '0.875rem',
                  top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none',
                  cursor: 'pointer', fontSize: '1rem',
                  color: '#9ca3af', padding: 0,
                }}
              >{showPassword ? '🙈' : '👁️'}</button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              marginBottom: '1.25rem',
              color: '#dc2626',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <span>⚠️</span> {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.875rem',
              background: loading
                ? '#7dd5db'
                : 'linear-gradient(135deg, #0e9aab 0%, #4caf39 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'opacity 0.2s',
            }}
          >
            {loading ? t('loginLoading') : t('loginButton')}
          </button>

          {/* Guest note */}
          <p style={{
            marginTop: '1.25rem',
            textAlign: 'center',
            fontSize: '0.8125rem',
            color: '#6b7280',
            lineHeight: 1.5,
          }}>
            {t('loginGuestNote')}
          </p>
        </form>
      </div>
      </div>
    </div>
  );
}
