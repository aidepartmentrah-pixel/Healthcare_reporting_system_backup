import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config/api';

const API = `${API_URL}/admin`;

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

const SPINNER_CSS = `
  input[type=number]::-webkit-outer-spin-button,
  input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  input[type=number] { -moz-appearance: textfield; }
  @keyframes fadeInUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
`;

const S = {
  page: {
    minHeight: '80vh', background: '#f8fafc',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    padding: '2rem', fontFamily: 'system-ui, sans-serif',
  },
  card: {
    background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    width: '100%', maxWidth: 680, overflow: 'hidden',
  },
  cardHeader: {
    background: 'linear-gradient(135deg, #1e40af 0%, #0f766e 100%)',
    padding: '1.5rem 2rem',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 20, fontWeight: 700, color: '#fff', margin: 0 },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.7)', margin: '2px 0 0' },
  tabBar: {
    display: 'flex', borderBottom: '1px solid #e2e8f0',
    background: '#f8fafc', padding: '0 2rem',
  },
  tab: (active) => ({
    padding: '0.875rem 1.25rem', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    border: 'none', background: 'none',
    color: active ? '#1e40af' : '#64748b',
    borderBottom: active ? '2px solid #1e40af' : '2px solid transparent',
    display: 'flex', alignItems: 'center', gap: 6, transition: 'color 0.15s',
  }),
  body: { padding: '2rem' },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 },
  input: {
    width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0',
    borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  },
  btn: (color = '#2563eb') => ({
    background: color, color: '#fff', border: 'none', borderRadius: 8,
    padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  }),
  btnGhost: {
    background: 'transparent', color: 'rgba(255,255,255,0.85)',
    border: '1px solid rgba(255,255,255,0.4)',
    borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer',
  },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: '1rem' },
  row: { display: 'flex', gap: 12, marginBottom: 12 },
  fieldGroup: { flex: 1 },
  toast: (type) => ({
    position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
    background: type === 'success' ? '#16a34a' : '#dc2626',
    color: '#fff', borderRadius: 10,
    padding: '12px 20px', fontSize: 14, fontWeight: 500,
    boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
    animation: 'fadeInUp 0.25s ease',
  }),
  moduleCard: {
    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10,
    padding: '1rem 1.25rem', marginBottom: 12,
  },
  moduleTitle: { fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' },
  unit: { fontSize: 11, color: '#94a3b8', marginLeft: 4 },
  divider: { borderTop: '1px solid #f1f5f9', margin: '1.5rem 0' },
  infoBox: (color = '#f0f9ff', border = '#bae6fd', text = '#0369a1') => ({
    background: color, border: `1px solid ${border}`,
    borderRadius: 10, padding: '1rem 1.25rem', marginBottom: '1.5rem',
    display: 'flex', alignItems: 'center', gap: 12,
  }),
};

// ─── Settings tab ─────────────────────────────────────────────────────────────

function SettingsTab({ onFlash }) {
  const { getCurrentUsername, getToken, logout } = useAuth();
  const navigate = useNavigate();

  const [currentUsername] = useState(() => getCurrentUsername());
  const [newUser,  setNewUser]  = useState('');
  const [newPass,  setNewPass]  = useState('');
  const [confirmP, setConfirmP] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [saving,   setSaving]   = useState(false);

  const mismatch = confirmP.length > 0 && newPass !== confirmP;
  const canSave  = newUser.trim().length >= 3 && newPass.length >= 6 && newPass === confirmP;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/credentials`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ username: newUser.trim(), password: newPass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Save failed');
      onFlash('success', 'Credentials updated — please sign in with your new details.');
      setTimeout(() => { logout(); navigate('/login'); }, 1500);
    } catch (err) {
      onFlash('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Current account */}
      <div style={S.infoBox()}>
        <span style={{ fontSize: '1.75rem' }}>👤</span>
        <div>
          <div style={{ fontSize: 12, color: '#0369a1', fontWeight: 600, marginBottom: 2 }}>
            Signed in as
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
            {currentUsername}
          </div>
        </div>
      </div>

      <div style={S.sectionTitle}>Change Login Credentials</div>

      {/* New username */}
      <div style={{ marginBottom: 12 }}>
        <label style={S.label}>New Username</label>
        <input
          style={S.input}
          placeholder="At least 3 characters"
          value={newUser}
          onChange={e => setNewUser(e.target.value)}
          onFocus={e => e.target.style.borderColor = '#3b82f6'}
          onBlur={e => e.target.style.borderColor = '#e2e8f0'}
        />
      </div>

      {/* New password + confirm */}
      <div style={S.row}>
        <div style={S.fieldGroup}>
          <label style={S.label}>New Password</label>
          <div style={{ position: 'relative' }}>
            <input
              style={S.input}
              type={showPass ? 'text' : 'password'}
              placeholder="At least 6 characters"
              value={newPass}
              onChange={e => setNewPass(e.target.value)}
              onFocus={e => e.target.style.borderColor = '#3b82f6'}
              onBlur={e => e.target.style.borderColor = '#e2e8f0'}
            />
            <button
              type="button"
              onClick={() => setShowPass(p => !p)}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#94a3b8',
              }}
            >{showPass ? '🙈' : '👁️'}</button>
          </div>
        </div>
        <div style={S.fieldGroup}>
          <label style={S.label}>Confirm New Password</label>
          <input
            style={{ ...S.input, borderColor: mismatch ? '#fca5a5' : '#e2e8f0' }}
            type={showPass ? 'text' : 'password'}
            placeholder="Repeat new password"
            value={confirmP}
            onChange={e => setConfirmP(e.target.value)}
          />
          {mismatch && (
            <span style={{ fontSize: 11, color: '#dc2626', marginTop: 3, display: 'block' }}>
              Passwords do not match
            </span>
          )}
        </div>
      </div>

      <div style={S.divider} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
          You will be signed out automatically after saving.
        </p>
        <button
          style={{ ...S.btn('#16a34a'), opacity: canSave ? 1 : 0.45, cursor: canSave ? 'pointer' : 'not-allowed' }}
          onClick={save}
          disabled={!canSave || saving}
        >
          {saving ? 'Saving…' : '💾 Save Credentials'}
        </button>
      </div>
    </>
  );
}

// ─── Targets tab ─────────────────────────────────────────────────────────────

function TargetsTab({ onFlash }) {
  const { getToken } = useAuth();
  const token = getToken();
  const [targets, setTargets] = useState(null);
  const [draft,   setDraft]   = useState(null);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    fetch(`${API}/targets`).then(r => r.json()).then(data => {
      setTargets(data);
      setDraft(JSON.parse(JSON.stringify(data)));
    });
  }, []);

  const setField = (module, key, value) => {
    const num = parseFloat(value);
    setDraft(prev => ({ ...prev, [module]: { ...prev[module], [key]: isNaN(num) ? value : num } }));
  };

  const saveTargets = async () => {
    setSaving(true);
    try {
      const res  = await fetch(`${API}/targets`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Save failed');
      setTargets(data.targets);
      setDraft(JSON.parse(JSON.stringify(data.targets)));
      onFlash('success', 'Targets saved successfully.');
    } catch (err) {
      onFlash('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!draft) return <p style={{ color: '#64748b', fontSize: 14 }}>Loading targets…</p>;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ ...S.sectionTitle, margin: 0 }}>Target Values</div>
      </div>
      {Object.entries(draft).map(([module, values]) => {
        const meta = MODULE_LABELS[module] || { title: module, unit: '' };
        return (
          <div key={module} style={S.moduleCard}>
            <div style={S.moduleTitle}>
              {meta.title}<span style={S.unit}>{meta.unit}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {Object.entries(values).map(([key, val]) => (
                <div key={key} style={{ minWidth: 120, flex: '1 1 120px' }}>
                  <label style={S.label}>{FIELD_LABELS[key] || key}</label>
                  <input
                    style={S.input} type="number" step="any"
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
    </>
  );
}

// ─── AdminPage ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('settings');
  const [msg, setMsg] = useState(null);
  const { logout } = useAuth();
  const navigate = useNavigate();

  const flash = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  return (
    <>
      <style>{SPINNER_CSS}</style>
      {msg && <div style={S.toast(msg.type)}>{msg.text}</div>}

      <div style={S.page}>
        <div style={S.card}>
          {/* Header */}
          <div style={S.cardHeader}>
            <div>
              <div style={S.headerTitle}>⚕️ Admin Panel</div>
              <div style={S.headerSub}>Healthcare Quality Indicators</div>
            </div>
            <button
              style={S.btnGhost}
              onClick={() => { logout(); navigate('/login'); }}
            >
              Sign out
            </button>
          </div>

          {/* Tabs */}
          <div style={S.tabBar}>
            <button style={S.tab(activeTab === 'settings')} onClick={() => setActiveTab('settings')}>
              ⚙️ Settings
            </button>
            <button style={S.tab(activeTab === 'targets')} onClick={() => setActiveTab('targets')}>
              📊 Target Values
            </button>
          </div>

          {/* Body */}
          <div style={S.body}>
            {activeTab === 'settings' && <SettingsTab onFlash={flash} />}
            {activeTab === 'targets'  && <TargetsTab  onFlash={flash} />}
          </div>
        </div>
      </div>
    </>
  );
}
