import { useState, useEffect, Component } from 'react';
import { BrowserRouter as Router, Routes, Route, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './i18n/config';
import './App.css';
import { API_URL, API_MEDICATION, API_VAP, API_CLABSI, API_CAUTI } from './config/api';

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err) { console.error('Page error:', err); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#dc2626' }}>
          <h2>Something went wrong on this page.</h2>
          <button onClick={() => this.setState({ hasError: false })}
            style={{ marginTop: '1rem', padding: '0.5rem 1.5rem', cursor: 'pointer' }}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import QuarterSelector from './components/QuarterSelector';
import { AuthProvider, useAuth } from './context/AuthContext';

// Pages
import Home from './pages/Home';
import Dashboard from './pages/mortality/Dashboard';
import Upload from './pages/mortality/Upload';
import Reports from './pages/mortality/Reports';
import MedicationUpload from './pages/medication/Upload';
import MedicationDashboard from './pages/medication/Dashboard';
import MedicationReports from './pages/medication/Reports';
import InfectionControlUpload from './pages/infection_control/Upload';
import InfectionControlReports from './pages/infection_control/Reports';
import VapDashboard from './pages/infection_control/vap/Dashboard';
import ClabsiDashboard from './pages/infection_control/clabsi/Dashboard';
import CautiDashboard from './pages/infection_control/cauti/Dashboard';
import AdminPage from './pages/admin/AdminPage';

// ─── Quarter-selector wrappers ───────────────────────────────────────────────

function MortalityDashboardWrapper({ mortalityData, historyData, mortalityTarget, selectedQ, onSelectQ }) {
  const [quarters, setQuarters] = useState([]);
  const [activeData, setActiveData] = useState(mortalityData);
  const [fetching, setFetching]  = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/available-quarters`)
      .then(r => r.json())
      .then(q => Array.isArray(q) ? setQuarters(q) : null)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedQ === null) setActiveData(mortalityData);
  }, [mortalityData, selectedQ]);

  function handleSelect(q) {
    onSelectQ(q);
    if (!q) { setActiveData(mortalityData); return; }
    setFetching(true);
    fetch(`${API_URL}/quarter?q=${encodeURIComponent(q.quarter)}&year=${q.year}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setActiveData(d); })
      .catch(() => {})
      .finally(() => setFetching(false));
  }

  return (
    <>
      {quarters.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 1rem 0.75rem' }}>
          <QuarterSelector quarters={quarters} selected={selectedQ} onChange={handleSelect} loading={fetching} />
        </div>
      )}
      <Dashboard
        data={activeData}
        totalPatients={activeData?.totalPatients || 0}
        quarter={activeData?.quarter || ''}
        year={activeData?.year || ''}
        historyData={historyData}
        mortalityTarget={mortalityTarget}
      />
    </>
  );
}

function MedicationDashboardWrapper({ medicationData, medicationTarget, language, selectedQ, onSelectQ }) {
  const [quarters, setQuarters] = useState([]);
  const [activeData, setActiveData] = useState(medicationData);
  const [fetching, setFetching]  = useState(false);

  useEffect(() => {
    fetch(`${API_MEDICATION}/available-quarters`)
      .then(r => r.json())
      .then(q => Array.isArray(q) ? setQuarters(q) : null)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedQ === null) setActiveData(medicationData);
  }, [medicationData, selectedQ]);

  function handleSelect(q) {
    onSelectQ(q);
    if (!q) { setActiveData(medicationData); return; }
    setFetching(true);
    fetch(`${API_MEDICATION}/quarter?q=${encodeURIComponent(q.quarter)}&year=${q.year}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setActiveData(d); })
      .catch(() => {})
      .finally(() => setFetching(false));
  }

  return (
    <>
      {quarters.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 1rem 0.75rem' }}>
          <QuarterSelector quarters={quarters} selected={selectedQ} onChange={handleSelect} loading={fetching} />
        </div>
      )}
      <MedicationDashboard language={language} data={activeData} medicationTarget={medicationTarget} />
    </>
  );
}

function IcWrapper({ language, DashboardComponent, apiUrl, selectedQ, onSelectQ }) {
  const [quarters, setQuarters] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();

  // After a successful upload the upload page navigates here with ?quarter=...&year=...
  // Pick those up to auto-select the newly uploaded quarter, then clear the params.
  useEffect(() => {
    const urlQ = searchParams.get('quarter');
    const urlY = searchParams.get('year');
    if (urlQ && urlY) {
      onSelectQ({ quarter: urlQ, year: urlY });
      setSearchParams({}, { replace: true });
    }
  }, []);

  useEffect(() => {
    fetch(`${apiUrl}/history`)
      .then(r => r.json())
      .then(hist => {
        if (Array.isArray(hist) && hist.length > 0) {
          const qs = hist.map(h => ({ quarter: h.quarter, year: String(h.year) }));
          setQuarters(qs.slice(-4));
        }
      })
      .catch(() => {});
  }, [apiUrl]);

  return (
    <>
      {quarters.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 1rem 0.75rem' }}>
          <QuarterSelector quarters={quarters} selected={selectedQ} onChange={onSelectQ} />
        </div>
      )}
      <DashboardComponent language={language} selectedQuarter={selectedQ} />
    </>
  );
}

// ─── Main App ───────────────────────────────────────────────────────────────
function App() {
  const { t, i18n } = useTranslation();
  const [language, setLanguage] = useState('ar');
  const [mortalityData, setMortalityData] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [medicationData, setMedicationData] = useState(null);
  const [targets, setTargets] = useState({});
  // Selected quarters — persist across navigation between dashboard and reports
  const [mortalitySelectedQ,  setMortalitySelectedQ]  = useState(null);
  const [medicationSelectedQ, setMedicationSelectedQ] = useState(null);
  const [vapSelectedQ,        setVapSelectedQ]        = useState(null);
  const [clabsiSelectedQ,     setClabsiSelectedQ]     = useState(null);
  const [cautiSelectedQ,      setCautiSelectedQ]      = useState(null);

  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
    document.body.lang = language;
  }, [language]);

  useEffect(() => {
    fetch(`${API_URL}/history`)
      .then(res => res.json())
      .then(data => setHistoryData(data))
      .catch(err => console.error('Failed to load history:', err));
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/current`)
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setMortalityData(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`${API_MEDICATION}/current`)
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setMedicationData(data); })
      .catch(() => {});
  }, []);

  const refreshTargets = () => {
    fetch(`${API_URL}/admin/targets`)
      .then(res => res.ok ? res.json() : {})
      .then(data => setTargets(data))
      .catch(() => {});
  };

  useEffect(() => { refreshTargets(); }, []);
  useEffect(() => { if (mortalityData) refreshTargets(); }, [mortalityData]);
  useEffect(() => { if (medicationData) refreshTargets(); }, [medicationData]);

  const toggleLanguage = () => {
    const newLang = language === 'ar' ? 'en' : 'ar';
    setLanguage(newLang);
    i18n.changeLanguage(newLang);
  };

  const shellProps = {
    language, toggleLanguage,
    mortalityData, setMortalityData,
    historyData,
    medicationData, setMedicationData,
    targets, t,
    mortalitySelectedQ,  setMortalitySelectedQ,
    medicationSelectedQ, setMedicationSelectedQ,
    vapSelectedQ,        setVapSelectedQ,
    clabsiSelectedQ,     setClabsiSelectedQ,
    cautiSelectedQ,      setCautiSelectedQ,
  };

  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<AppShell {...shellProps} />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

function AppShell({
  language, toggleLanguage,
  mortalityData, setMortalityData,
  historyData,
  medicationData, setMedicationData,
  targets, t,
  mortalitySelectedQ,  setMortalitySelectedQ,
  medicationSelectedQ, setMedicationSelectedQ,
  vapSelectedQ,        setVapSelectedQ,
  clabsiSelectedQ,     setClabsiSelectedQ,
  cautiSelectedQ,      setCautiSelectedQ,
}) {
  const { isAuthenticated, logout } = useAuth();

  return (
    <div className="app">
      <Navbar
        language={language}
        toggleLanguage={toggleLanguage}
        isAuthenticated={isAuthenticated}
        onLogout={logout}
      />

      <main className="main-content">
        <div className="content-wrapper">
          <ErrorBoundary>
            <Routes>
              {/* ── Public: Home ── */}
              <Route path="/" element={<Home language={language} />} />

              {/* ── Public: Dashboards ── */}
              <Route path="/mortality/dashboard" element={
                <MortalityDashboardWrapper
                  mortalityData={mortalityData}
                  historyData={historyData}
                  mortalityTarget={targets?.mortality?.rate ?? 2}
                  selectedQ={mortalitySelectedQ}
                  onSelectQ={setMortalitySelectedQ}
                />
              } />
              <Route path="/vap/dashboard" element={
                <IcWrapper language={language} DashboardComponent={VapDashboard}
                  apiUrl={API_VAP}
                  selectedQ={vapSelectedQ} onSelectQ={setVapSelectedQ} />
              } />
              <Route path="/clabsi/dashboard" element={
                <IcWrapper language={language} DashboardComponent={ClabsiDashboard}
                  apiUrl={API_CLABSI}
                  selectedQ={clabsiSelectedQ} onSelectQ={setClabsiSelectedQ} />
              } />
              <Route path="/cauti/dashboard" element={
                <IcWrapper language={language} DashboardComponent={CautiDashboard}
                  apiUrl={API_CAUTI}
                  selectedQ={cautiSelectedQ} onSelectQ={setCautiSelectedQ} />
              } />
              <Route path="/medication/dashboard" element={
                <MedicationDashboardWrapper
                  medicationData={medicationData}
                  medicationTarget={targets?.medication?.error_rate ?? 0.03}
                  language={language}
                  selectedQ={medicationSelectedQ}
                  onSelectQ={setMedicationSelectedQ}
                />
              } />

              {/* ── Protected: Admin ── */}
              <Route path="/admin" element={
                <ProtectedRoute><AdminPage /></ProtectedRoute>
              } />

              {/* ── Protected: Uploads ── */}
              <Route path="/mortality/upload" element={
                <ProtectedRoute>
                  <Upload onDataLoaded={data => { setMortalityData(data); setMortalitySelectedQ(null); }} />
                </ProtectedRoute>
              } />
              <Route path="/vap/upload" element={
                <ProtectedRoute><InfectionControlUpload defaultTab="vap" language={language} /></ProtectedRoute>
              } />
              <Route path="/clabsi/upload" element={
                <ProtectedRoute><InfectionControlUpload defaultTab="clabsi" language={language} /></ProtectedRoute>
              } />
              <Route path="/cauti/upload" element={
                <ProtectedRoute><InfectionControlUpload defaultTab="cauti" language={language} /></ProtectedRoute>
              } />
              <Route path="/medication/upload" element={
                <ProtectedRoute>
                  <MedicationUpload language={language} onDataLoaded={data => { setMedicationData(data); setMedicationSelectedQ(null); }} />
                </ProtectedRoute>
              } />

              {/* ── Protected: Reports (contain downloads) ── */}
              <Route path="/mortality/reports" element={
                <ProtectedRoute><Reports language={language} selectedQ={mortalitySelectedQ} /></ProtectedRoute>
              } />
              <Route path="/ic/summary" element={
                <InfectionControlReports type="vap" language={language} selectedQ={vapSelectedQ} summaryOnly />
              } />
              <Route path="/vap/reports" element={
                <ProtectedRoute><InfectionControlReports type="vap" language={language} selectedQ={vapSelectedQ} /></ProtectedRoute>
              } />
              <Route path="/clabsi/reports" element={
                <ProtectedRoute><InfectionControlReports type="clabsi" language={language} selectedQ={clabsiSelectedQ} /></ProtectedRoute>
              } />
              <Route path="/cauti/reports" element={
                <ProtectedRoute><InfectionControlReports type="cauti" language={language} selectedQ={cautiSelectedQ} /></ProtectedRoute>
              } />
              <Route path="/medication/reports" element={
                <ProtectedRoute><MedicationReports language={language} selectedQ={medicationSelectedQ} /></ProtectedRoute>
              } />
            </Routes>
          </ErrorBoundary>
        </div>
      </main>

      <footer className="footer">
        <p className="footer-text">{t('footerText')}</p>
      </footer>
    </div>
  );
}

export default App;
