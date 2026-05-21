import { useState, useEffect, Component } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './i18n/config';
import './App.css';
import { API_URL, API_MEDICATION } from './config/api';

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

// ─── Main App ───────────────────────────────────────────────────────────────
function App() {
  const { t, i18n } = useTranslation();
  const [language, setLanguage] = useState('ar');
  const [mortalityData, setMortalityData] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [medicationData, setMedicationData] = useState(null);
  const [targets, setTargets] = useState({});

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
    fetch('http://localhost:8000/api/admin/targets')
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

  return (
    <Router>
      <div className="app">
        <Navbar language={language} toggleLanguage={toggleLanguage} />

        <main className="main-content">
          <div className="content-wrapper">
            <ErrorBoundary>
            <Routes>
              {/* ── Admin ── */}
              <Route path="/admin" element={<AdminPage />} />

              {/* ── Home: system selector ── */}
              <Route path="/" element={<Home language={language} />} />

              {/* ── Mortality system ── */}
              <Route path="/mortality/dashboard" element={
                <Dashboard
                  data={mortalityData}
                  totalPatients={mortalityData?.totalPatients || 0}
                  quarter={mortalityData?.quarter || ''}
                  year={mortalityData?.year || ''}
                  historyData={historyData}
                  mortalityTarget={targets?.mortality?.rate ?? 2}
                />
              } />
              <Route path="/mortality/upload" element={
                <Upload onDataLoaded={setMortalityData} />
              } />
              <Route path="/mortality/reports" element={
                <Reports data={mortalityData} language={language} />
              } />

              {/* ── Infection Control / VAP ── */}
              <Route path="/vap/upload"     element={<InfectionControlUpload defaultTab="vap" language={language} />} />
              <Route path="/vap/dashboard"  element={<VapDashboard language={language} />} />
              <Route path="/vap/reports"    element={<InfectionControlReports type="vap" language={language} />} />

              {/* ── Infection Control / CLABSI ── */}
              <Route path="/clabsi/upload"    element={<InfectionControlUpload defaultTab="clabsi" language={language} />} />
              <Route path="/clabsi/dashboard" element={<ClabsiDashboard language={language} />} />
              <Route path="/clabsi/reports"   element={<InfectionControlReports type="clabsi" language={language} />} />

              {/* ── Infection Control / CAUTI ── */}
              <Route path="/cauti/upload"    element={<InfectionControlUpload defaultTab="cauti" language={language} />} />
              <Route path="/cauti/dashboard" element={<CautiDashboard language={language} />} />
              <Route path="/cauti/reports"   element={<InfectionControlReports type="cauti" language={language} />} />

              {/* ── Medication Error system ── */}
              <Route path="/medication/upload" element={
                  <MedicationUpload language={language} onDataLoaded={setMedicationData} />
                } />

                <Route path="/medication/dashboard" element={
                  <MedicationDashboard language={language} data={medicationData} medicationTarget={targets?.medication?.error_rate ?? 0.03} />
                } />

                <Route path="/medication/reports" element={
                  <MedicationReports language={language} currentData={medicationData} />
                } />
              </Routes>
            </ErrorBoundary>
          </div>
        </main>

        <footer className="footer">
          <p className="footer-text">
            {t('footerText')}
          </p>
        </footer>
      </div>
    </Router>
  );
}

export default App;
