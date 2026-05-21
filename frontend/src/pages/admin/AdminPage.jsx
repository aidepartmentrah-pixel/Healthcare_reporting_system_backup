import { useState, useEffect } from 'react';

const API = 'http://localhost:8000/api/admin';

const MODULE_LABELS = {
  mortality:  { title: 'Mortality',        unit: '%' },
  medication: { title: 'Medication Error', unit: '%' },
  vap:        { title: 'VAP',              unit: '‰ per 1,000 vent-days' },
  clabsi:     { title: 'CLABSI',           unit: '‰ per 1,000 cath-days' },
  cauti:      { title: 'CAUTI',            unit: '‰ per 1,000 cath-days' },
};

const FIELD_LABELS = {
  rate:       'Mortality Rate Target',
  error_rate: 'Error Rate Target',
};

// ─── Spinner-arrow removal (number inputs) ───────────────────────────────────

const SPINNER_CSS = `
  input[type=number]::-webkit-outer-spin-button,
  input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  input[type=number] { -moz-appearance: textfield; }
`;

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  page: {
    minHeight: '100vh', background: '#f8fafc',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '2rem', fontFamily: 'system-ui, sans-serif',
  },
  card: {
    background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    padding: '2.5rem', width: '100%', maxWidth: 640,
  },
  title: { fontSize: 22, fontWeight: 700, color: '#1e293b', marginBottom: 4 },
  sub:   { fontSize: 13, color: '#64748b', marginBottom: '2rem' },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 },
  input: {
    width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0',
    borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box',
  },
  btn: (color = '#2563eb') => ({
    background: color, color: '#fff', border: 'none', borderRadius: 8,
    padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  }),
  btnOutline: {
    background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0',
    borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer',
  },
  section: { borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem', marginTop: '1.5rem' },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: '#334155', marginBottom: '1rem' },
  row: { display: 'flex', gap: 12, marginBottom: 12 },
  fieldGroup: { flex: 1 },
  toast: (type) => ({
    position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
    background: type === 'success' ? '#16a34a' : '#dc2626',
    color: '#fff', borderRadius: 10,
    padding: '12px 20px', fontSize: 14, fontWeight: 500,
    boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
    maxWidth: 320, wordBreak: 'break-word',
    animation: 'fadeInUp 0.25s ease',
  }),
  moduleCard: {
    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10,
    padding: '1rem 1.25rem', marginBottom: 12,
  },
  moduleTitle: { fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' },
  unit: { fontSize: 11, color: '#94a3b8', marginLeft: 4 },
};

// ─── Login form ───────────────────────────────────────────────────────────────

function LoginForm({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res  = await fetch(`${API}/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Login failed');
      onLogin(data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={S.page}>
      <div style={{ ...S.card, maxWidth: 400 }}>
        <div style={S.title}>Admin Login</div>
        <div style={S.sub}>Healthcare Quality Indicators — Admin Panel</div>
        {error && <div style={S.error}>{error}</div>}
        <form onSubmit={submit}>
          <div style={{ marginBottom: 12 }}>
            <label style={S.label}>Username</label>
            <input style={S.input} value={username} onChange={e => setUsername(e.target.value)} autoFocus />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={S.label}>Password</label>
            <input style={S.input} type="password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <button style={{ ...S.btn(), width: '100%' }} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Admin panel ──────────────────────────────────────────────────────────────

function AdminPanel({ token, onLogout }) {
  const [targets,   setTargets]   = useState(null);
  const [draft,     setDraft]     = useState(null);
  const [newUser,   setNewUser]   = useState('');
  const [newPass,   setNewPass]   = useState('');
  const [confirmP,  setConfirmP]  = useState('');
  const [msg,       setMsg]       = useState(null); // {type:'success'|'error', text}
  const [saving,    setSaving]    = useState(false);

  const authHeader = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch(`${API}/targets`).then(r => r.json()).then(data => {
      setTargets(data);
      setDraft(JSON.parse(JSON.stringify(data)));
    });
  }, []);

  const flash = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const saveTargets = async () => {
    setSaving(true);
    try {
      const res  = await fetch(`${API}/targets`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Save failed');
      setTargets(data.targets);
      setDraft(JSON.parse(JSON.stringify(data.targets)));
      flash('success', 'Targets saved successfully.');
    } catch (err) {
      flash('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveCredentials = async () => {
    if (newPass !== confirmP) { flash('error', 'Passwords do not match.'); return; }
    setSaving(true);
    try {
      const res  = await fetch(`${API}/credentials`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ username: newUser, password: newPass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Update failed');
      flash('success', 'Credentials updated. Please log in again.');
      setTimeout(onLogout, 2000);
    } catch (err) {
      flash('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const setField = (module, key, value) => {
    const num = parseFloat(value);
    setDraft(prev => ({ ...prev, [module]: { ...prev[module], [key]: isNaN(num) ? value : num } }));
  };

  if (!draft) return <div style={S.page}><p>Loading…</p></div>;

  return (
    <>
      <style>{SPINNER_CSS + `@keyframes fadeInUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }`}</style>
      {msg && <div style={S.toast(msg.type)}>{msg.text}</div>}
    <div style={S.page}>
      <div style={S.card}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <div style={S.title}>Admin Panel</div>
            <div style={S.sub}>Edit target values and credentials</div>
          </div>
          <button style={S.btnOutline} onClick={onLogout}>Log out</button>
        </div>

        {/* ── Targets section ── */}
        <div style={S.sectionTitle}>Target Values</div>

        {Object.entries(draft).map(([module, values]) => {
          const meta = MODULE_LABELS[module] || { title: module, unit: '' };
          return (
            <div key={module} style={S.moduleCard}>
              <div style={S.moduleTitle}>
                {meta.title}
                <span style={S.unit}>{meta.unit}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {Object.entries(values).map(([key, val]) => (
                  <div key={key} style={{ minWidth: 120, flex: '1 1 120px' }}>
                    <label style={S.label}>{FIELD_LABELS[key] || key}</label>
                    <input
                      style={S.input}
                      type="number"
                      step="any"
                      value={val}
                      onChange={e => setField(module, key, e.target.value)}
                      onWheel={e => e.target.blur()}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div style={{ textAlign: 'right', marginTop: 8 }}>
          <button style={S.btn()} onClick={saveTargets} disabled={saving}>
            {saving ? 'Saving…' : 'Save Targets'}
          </button>
        </div>

        {/* ── Credentials section ── */}
        <div style={S.section}>
          <div style={S.sectionTitle}>Change Credentials</div>
          <div style={S.row}>
            <div style={S.fieldGroup}>
              <label style={S.label}>New Username</label>
              <input style={S.input} value={newUser} onChange={e => setNewUser(e.target.value)} />
            </div>
          </div>
          <div style={S.row}>
            <div style={S.fieldGroup}>
              <label style={S.label}>New Password</label>
              <input style={S.input} type="password" value={newPass} onChange={e => setNewPass(e.target.value)} />
            </div>
            <div style={S.fieldGroup}>
              <label style={S.label}>Confirm Password</label>
              <input style={S.input} type="password" value={confirmP} onChange={e => setConfirmP(e.target.value)} />
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <button style={S.btn('#16a34a')} onClick={saveCredentials} disabled={saving || !newUser || !newPass}>
              {saving ? 'Updating…' : 'Update Credentials'}
            </button>
          </div>
        </div>

      </div>
    </div>
    </>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [token, setToken] = useState(() => sessionStorage.getItem('admin_token') || '');

  const handleLogin  = (t) => { sessionStorage.setItem('admin_token', t); setToken(t); };
  const handleLogout = ()  => { sessionStorage.removeItem('admin_token'); setToken(''); };

  return token
    ? <AdminPanel token={token} onLogout={handleLogout} />
    : <LoginForm  onLogin={handleLogin} />;
}
