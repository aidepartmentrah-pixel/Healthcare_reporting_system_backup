import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import styles from '../../styles/Reports.module.css';
import { API_BASE } from '../../config/api';

const RISK_COLS = [
  'diabetic','hypertension','dyslipidemia','heart_disease','kidney_disease',
  'copd','smoker','obesity','cardiac_congenital_malformation','advanced_age',
  'length_of_stay','duration_of_catheter','cancer','compromised_immune_system',
  'respiratory_pb','site_of_catheter_femoral',
  'prematurity','neonates','infant','total_parenteral_nutrition',
  'consciousness','head_trauma','burns','malnutrition',
  'prolonged_antibiotic_exposure','reintubation_recatheterization','tracheostomy',
];
const RISK_LABELS = {
  diabetic:'Diabetic', hypertension:'Hypertension', dyslipidemia:'Dyslipidemia',
  heart_disease:'Heart Disease', kidney_disease:'Kidney Disease', copd:'COPD',
  smoker:'Smoker', obesity:'Obesity',
  cardiac_congenital_malformation:'Cardiac Congenital Malformation',
  advanced_age:'Advanced Age', length_of_stay:'Length of Stay',
  duration_of_catheter:'Duration of Catheter', cancer:'Cancer',
  compromised_immune_system:'Compromised Immune System', respiratory_pb:'Respiratory Problem',
  site_of_catheter_femoral:'Site of Catheter (Femoral)',
  prematurity:'Prematurity', neonates:'Neonates', infant:'Infant',
  total_parenteral_nutrition:'Total Parenteral Nutrition (TPN)',
  consciousness:'Consciousness', head_trauma:'Head Trauma', burns:'Burns',
  malnutrition:'Malnutrition', prolonged_antibiotic_exposure:'Prolonged Antibiotic Exposure',
  reintubation_recatheterization:'Reintubation / Recatheterization',
  tracheostomy:'Tracheostomy',
};

const QUARTER_AR = {
  "الفصل الأول":  { ar: "الفصل الأول",  en: "First Quarter"  },
  "الفصل الاول":  { ar: "الفصل الأول",  en: "First Quarter"  },
  "الفصل الثاني": { ar: "الفصل الثاني", en: "Second Quarter" },
  "الفصل الثالث": { ar: "الفصل الثالث", en: "Third Quarter"  },
  "الفصل الرابع": { ar: "الفصل الرابع", en: "Fourth Quarter" },
};

function quarterLabel(q, y, ar) {
  const map = QUARTER_AR[q];
  return map ? `${map[ar ? 'ar' : 'en']} ${y}` : `${q} ${y}`;
}

const TYPE_CONFIG = {
  clabsi: {
    apiBase:      `${API_BASE}/api/clabsi`,
    label:        'CLABSI',
    fullName:     'Central Line-Associated Bloodstream Infection',
    icon:         '🩸',
    daysKey:      'catheter_days',
    daysLabel:    { ar: 'أيام القسطرة', en: 'Catheter Days' },
    gradient:     'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    dark:         '#1e40af',
    light:        '#eff6ff',
    insertionCol: 'Date of insertion Central line',
  },
  cauti: {
    apiBase:      `${API_BASE}/api/cauti`,
    label:        'CAUTI',
    fullName:     'Catheter-Associated Urinary Tract Infection',
    icon:         '🧬',
    daysKey:      'urinary_catheter_days',
    daysLabel:    { ar: 'أيام القسطرة البولية', en: 'Urinary Catheter Days' },
    gradient:     'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
    dark:         '#7c2d12',
    light:        '#fff7ed',
    insertionCol: 'Date of foley insertion',
  },
  vap: {
    apiBase:      `${API_BASE}/api/vap`,
    label:        'VAP',
    fullName:     'Ventilator-Associated Pneumonia',
    icon:         '🫁',
    daysKey:      'ventilator_days',
    daysLabel:    { ar: 'أيام التنفس الاصطناعي', en: 'Ventilator Days' },
    gradient:     'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)',
    dark:         '#164e63',
    light:        '#ecfeff',
    insertionCol: 'Date of intubation',
  },
};

function InfectionControlReports({ type, selectedQ }) {
  const { t, i18n } = useTranslation();
  const ar  = i18n.language === 'ar';
  const cfg = TYPE_CONFIG[type];

  const [tab,            setTab]           = useState('summary');
  const [entry,          setEntry]          = useState(null);
  const [allEntries,     setAllEntries]     = useState([]);
  const [targets,        setTargets]        = useState({});
  const [loading,        setLoading]        = useState(true);
  const [generating,     setGenerating]     = useState(false);
  const [reportUrl,      setReportUrl]      = useState(null);
  const [crossTypeGerms, setCrossTypeGerms] = useState(null);
  const [casesEntry,     setCasesEntry]     = useState(null);

  useEffect(() => {
    setLoading(true);
    setEntry(null);
    setTargets({});
    setTab('summary');
    setReportUrl(null);
    Promise.all([
      axios.get(`${cfg.apiBase}/history`),
      axios.get(`${cfg.apiBase}/targets`),
      axios.get(`${cfg.apiBase}/current`).catch(() => ({ data: {} })),
    ])
      .then(([histRes, tgtsRes, curRes]) => {
        const entries = Array.isArray(histRes.data) ? histRes.data : [];
        setAllEntries(entries);
        const cur = curRes.data || {};
        // Prefer the top-of-page selected quarter, then last uploaded, then last entry
        const preferred = selectedQ || (cur.quarter ? { quarter: cur.quarter, year: String(cur.year) } : null);
        const matched = preferred
          ? entries.find(e => e.quarter === preferred.quarter && String(e.year) === String(preferred.year))
          : null;
        setEntry(matched || (entries.length > 0 ? entries[entries.length - 1] : null));
        setTargets(tgtsRes.data || {});
      })
      .catch(err => console.error(`Failed to load ${type} data:`, err))
      .finally(() => setLoading(false));
  }, [type]);

  // Sync when selectedQ changes (user picks different quarter from top selector)
  useEffect(() => {
    if (!selectedQ || !allEntries.length) return;
    const matched = allEntries.find(e => e.quarter === selectedQ.quarter && String(e.year) === String(selectedQ.year));
    if (matched) { setEntry(matched); setReportUrl(null); }
  }, [selectedQ, allEntries]);

  // Fetch raw cases for all 3 IC types for the active entry quarter
  useEffect(() => {
    if (!entry?.quarter || !entry?.year) return;
    const q = encodeURIComponent(entry.quarter);
    const y = entry.year;
    Promise.allSettled([
      axios.get(`${API_BASE}/api/cauti/cases?quarter=${q}&year=${y}`).then(r => ({ type: 'CAUTI',  cases: r.data?.cases || [] })),
      axios.get(`${API_BASE}/api/clabsi/cases?quarter=${q}&year=${y}`).then(r => ({ type: 'CLABSI', cases: r.data?.cases || [] })),
      axios.get(`${API_BASE}/api/vap/cases?quarter=${q}&year=${y}`).then(r =>   ({ type: 'VAP',    cases: r.data?.cases || [] })),
    ])
      .then(results => {
        const map = { CAUTI: [], CLABSI: [], VAP: [] };
        results.forEach(r => { if (r.status === 'fulfilled') map[r.value.type] = r.value.cases; });
        setCasesEntry(map);
      });
  }, [entry?.quarter, entry?.year]);

  // Fetch all 3 IC type histories for cross-indicator germ table.
  // Re-fetch whenever the active quarter changes so newly uploaded data appears immediately.
  useEffect(() => {
    const IC_TYPES = [
      { label: 'CAUTI',  url: `${API_BASE}/api/cauti/history`  },
      { label: 'CLABSI', url: `${API_BASE}/api/clabsi/history` },
      { label: 'VAP',    url: `${API_BASE}/api/vap/history`    },
    ];
    Promise.allSettled(IC_TYPES.map(ic =>
      axios.get(ic.url).then(r => ({ label: ic.label, entries: Array.isArray(r.data) ? r.data : [] }))
    ))
      .then(results => {
        const data = results
          .filter(r => r.status === 'fulfilled')
          .map(r => r.value);
        if (data.length) setCrossTypeGerms(data);
      });
  }, [entry?.quarter, entry?.year]);

  const handleGenerateReport = async () => {
    setGenerating(true);
    setReportUrl(null);
    try {
      const response = await axios.post(`${cfg.apiBase}/generate-report`, {
        quarter: entry?.quarter,
        year:    entry?.year ? String(entry.year) : undefined,
      });
      if (response.data.success) {
        const url = `${cfg.apiBase}/download-report?fileName=${encodeURIComponent(response.data.fileName)}`;
        setReportUrl(url);
      }
    } catch (err) {
      console.error(`${type} report error:`, err);
      alert(t('errorGeneratingReport'));
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.emptyState} style={{ background: cfg.gradient }}>
        <div className={styles.emptyStateBackground} />
        <div className={styles.emptyStateContent}>
          <div className={styles.emptyStateIconWrapper}>
            <span className={styles.emptyStateIcon}>⏳</span>
          </div>
          <h2 className={styles.emptyStateTitle}>{t('loading')}</h2>
        </div>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className={styles.emptyState} style={{ background: cfg.gradient }}>
        <div className={styles.emptyStateBackground} />
        <div className={styles.emptyStateContent}>
          <div className={styles.emptyStateIconWrapper}>
            <span className={styles.emptyStateIcon}>{cfg.icon}</span>
          </div>
          <h2 className={styles.emptyStateTitle}>
            {ar ? `لا توجد بيانات ${cfg.label}` : `No ${cfg.label} Data Available`}
          </h2>
          <p className={styles.emptyStateText}>
            {ar
              ? 'يرجى رفع بيانات أولاً لتتمكن من إنشاء التقرير'
              : 'Please upload data first to generate a report'}
          </p>
        </div>
      </div>
    );
  }

  const summary        = entry.summary || {};
  const totalCases     = Object.values(summary).reduce((s, v) => s + (v.cases || 0), 0);
  // Only targeted floors contribute to rate / days (no-target floors are case-count only)
  const targetedFloorEntries  = Object.entries(summary).filter(([dept]) => dept in targets);
  const noTargetEntries       = Object.entries(summary).filter(([dept]) => !(dept in targets) && (summary[dept]?.cases || 0) > 0);
  const totalDays      = targetedFloorEntries.reduce((s, [, v]) => s + (v[cfg.daysKey] || 0), 0);
  const targetedCases  = targetedFloorEntries.reduce((s, [, v]) => s + (v.cases || 0), 0);
  const noTargetCases  = noTargetEntries.reduce((s, [, v]) => s + (v.cases || 0), 0);
  const overallRate    = totalDays > 0
    ? ((targetedCases / totalDays) * 1000).toFixed(2)
    : '—';

  // Per-indicator stats — each indicator uses its OWN latest entry so all 3 always show
  // even when they were uploaded for different quarters.
  const indicatorStats = crossTypeGerms
    ? ['CAUTI', 'CLABSI', 'VAP'].map(label => {
        const icCfg = TYPE_CONFIG[label.toLowerCase()];
        const found = crossTypeGerms.find(d => d.label === label);
        if (!found?.entries.length) return { label, cases: 0, rate: '—', icCfg, quarterLabel: '' };
        // Prefer the current page's quarter; fall back to the indicator's own latest entry
        const matched =
          found.entries.find(e => e.quarter === entry.quarter && String(e.year) === String(entry.year))
          || found.entries[found.entries.length - 1];
        const sum = matched.summary || {};
        const cases = Object.values(sum).reduce((s, v) => s + (v.cases || 0), 0);
        const days  = Object.values(sum).reduce((s, v) => s + (v[icCfg.daysKey] || 0), 0);
        const rate  = days > 0 ? ((cases / days) * 1000).toFixed(2) : '—';
        const ql    = quarterLabel(matched.quarter, matched.year, false);
        return { label, cases, rate, icCfg, ql };
      })
    : [];

  const summaryTheme = {
    gradient: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    dark:     '#1e3a8a',
    light:    '#eff6ff',
  };

  const statCards = [];

  const tabs = [
    { key: 'summary', icon: '📄', label: t('statisticsSummary') },
    { key: 'floors',  icon: '🏥', label: ar ? 'معدلات الأقسام' : 'Floor Rates' },
    { key: 'germs',   icon: '🧫', label: ar ? 'توزيع الجراثيم' : 'Germ Distribution' },
  ];

  return (
    <div className={styles.reportsContainer}>

      {/* Header */}
      <div className={styles.reportsHeader} style={{ background: cfg.gradient }}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIconWrapper}>
              <span className={styles.headerIcon}>{cfg.icon}</span>
            </div>
            <div>
              <h1 className={styles.headerTitle}>
                {ar ? `تقارير ${cfg.label}` : `${cfg.label} Reports`}
              </h1>
              <p className={styles.headerSubtitle}>
                {ar
                  ? 'توليد وتحميل التقرير التفصيلي'
                  : 'Generate and download the detailed report'}
              </p>
            </div>
          </div>
          <button
            onClick={handleGenerateReport}
            className={styles.downloadButton}
            disabled={generating}
            style={{ opacity: generating ? 0.7 : 1, color: cfg.dark }}
          >
            <span className={styles.downloadButtonIcon}>📄</span>
            {generating ? t('generating') : t('generateWordReport')}
          </button>
        </div>
      </div>

      {/* Download banner */}
      {reportUrl && (
        <div style={{
          backgroundColor: cfg.dark, color: 'white', padding: '1rem 1.5rem',
          borderRadius: '12px', marginBottom: '1.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>✅</span>
            <span style={{ fontWeight: 600 }}>{t('reportGeneratedSuccess')}</span>
          </div>
          <a
            href={reportUrl}
            download
            style={{
              backgroundColor: 'white', color: cfg.dark,
              padding: '0.5rem 1.5rem', borderRadius: '8px',
              fontWeight: 'bold', textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}
          >
            <span>⬇️</span>
            {t('downloadWordDoc')}
          </a>
        </div>
      )}

      {/* Tab selector */}
      <div className={styles.typeSelector}>
        <div className={styles.typeSelectorButtons}>
          {tabs.map(tabItem => (
            <button
              key={tabItem.key}
              onClick={() => setTab(tabItem.key)}
              className={`${styles.typeButton} ${
                tab === tabItem.key ? styles.typeButtonActive : styles.typeButtonInactive
              }`}
              style={tab === tabItem.key ? { background: cfg.gradient } : {}}
            >
              <span className={styles.typeButtonIcon}>{tabItem.icon}</span>
              {tabItem.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Summary ── */}
      {tab === 'summary' && (
        <div className={styles.reportCard}>
          <div className={styles.reportCardHeader}>
            <div className={styles.reportCardIcon} style={{ background: summaryTheme.gradient }}>📊</div>
            <h2 className={styles.reportCardTitle} style={{ background: 'none', WebkitTextFillColor: summaryTheme.dark, WebkitBackgroundClip: 'unset' }}>
              {t('statisticsSummary')}
            </h2>
          </div>

          <div className={styles.statsGrid}>
            {statCards.map((card, i) => (
              <div key={i} className={styles.statCard}
                   style={{ background: card.bg, borderLeftColor: card.border }}>
                <div className={styles.statCardContent}>
                  <div className={styles.statCardHeader}>
                    <div className={styles.statCardIconWrapper}>
                      <span className={styles.statCardIcon}>{card.icon}</span>
                    </div>
                    <h3 className={styles.statCardLabel}>{card.label}</h3>
                  </div>
                  <div className={styles.statCardValue}>
                    {card.value}
                    {card.subValue && (
                      <span className={styles.statCardSubValue}>{card.subValue}</span>
                    )}
                  </div>
                  <div className={styles.statCardProgress}>
                    <div className={styles.statCardProgressBar} style={{ width: '60%' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Per-Indicator Cards (CAUTI / CLABSI / VAP) ── */}
          {indicatorStats.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '1rem' }}>
              {indicatorStats.map(({ label, cases, rate, icCfg, ql }) => (
                <div key={label} style={{ background: icCfg.gradient, borderRadius: 12, padding: '1rem 1.25rem', color: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 20 }}>{icCfg.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{label}</span>
                  </div>
                  {ql && <div style={{ fontSize: 10, opacity: 0.75, marginBottom: 8 }}>{ql}</div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                      <div style={{ fontSize: 11, opacity: 0.85 }}>{ar ? 'عدد الحالات' : 'Cases'}</div>
                      <div style={{ fontSize: 24, fontWeight: 800 }}>{cases}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, opacity: 0.85 }}>{ar ? 'المعدل' : 'Rate'}</div>
                      <div style={{ fontSize: 24, fontWeight: 800 }}>{rate}<span style={{ fontSize: 13, marginLeft: 2 }}>‰</span></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}


          {/* ── Table 1: Germ Distribution by Floor — All Indicators ── */}
          {['CAUTI', 'CLABSI', 'VAP'].map(label => {
            const icCfg = TYPE_CONFIG[label.toLowerCase()];
            const found = crossTypeGerms?.find(d => d.label === label);
            const matched =
              found?.entries.find(e => e.quarter === entry.quarter && String(e.year) === String(entry.year))
              || found?.entries[found.entries.length - 1];
            const germsByFloor = matched?.germs_distribution || {};
            const floors = Object.keys(germsByFloor).filter(f => Object.keys(germsByFloor[f] || {}).length > 0);
            if (!floors.length) return null;
            const allGerms = [...new Set(floors.flatMap(f => Object.keys(germsByFloor[f] || {})))];
            allGerms.sort((a, b) => {
              const totA = floors.reduce((s, f) => s + (germsByFloor[f]?.[a] || 0), 0);
              const totB = floors.reduce((s, f) => s + (germsByFloor[f]?.[b] || 0), 0);
              return totB - totA;
            });
            const thS = { padding: '8px 12px', fontWeight: 700, color: 'white', textAlign: 'center', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.2)' };
            const tdS = { padding: '7px 12px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' };
            return (
              <div key={label} style={{ marginTop: '1.5rem' }}>
                <h4 style={{ margin: '0 0 10px', color: summaryTheme.dark, fontSize: '0.95rem', fontWeight: 700 }}>
                  🧫 {ar ? `توزيع الجراثيم حسب القسم — ${label}` : `Germ Distribution by Floor — ${label}`}
                </h4>
                <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: summaryTheme.gradient }}>
                        <th style={{ ...thS, textAlign: 'start' }}>{ar ? 'الجرثومة' : 'Germ'}</th>
                        {floors.map(f => <th key={f} style={thS}>{f}</th>)}
                        <th style={{ ...thS, borderRight: 'none' }}>{ar ? 'الإجمالي' : 'Total'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allGerms.map((germ, i) => {
                        const total = floors.reduce((s, f) => s + (germsByFloor[f]?.[germ] || 0), 0);
                        return (
                          <tr key={germ} style={{ background: i % 2 === 0 ? summaryTheme.light : '#fff' }}>
                            <td style={{ ...tdS, textAlign: 'start', fontWeight: 600, fontStyle: 'italic', color: summaryTheme.dark }}>{germ}</td>
                            {floors.map(f => (
                              <td key={f} style={{ ...tdS, color: germsByFloor[f]?.[germ] ? '#0f172a' : '#94a3b8' }}>
                                {germsByFloor[f]?.[germ] || '—'}
                              </td>
                            ))}
                            <td style={{ ...tdS, fontWeight: 700, borderRight: 'none', color: summaryTheme.dark }}>{total}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {/* ── Table 2: Germ Distribution by Infection Type (CAUTI / CLABSI / VAP) ── */}
          {(() => {
            if (!crossTypeGerms) return null;
            // For the displayed quarter/year, find the matching entry per IC type
            const q = entry.quarter;
            const y = String(entry.year);
            const IC_TYPES = ['CAUTI', 'CLABSI', 'VAP'];
            // Build germ → { CAUTI: n, CLABSI: n, VAP: n } from germs_distribution (per floor → sum)
            const germMap = {};
            crossTypeGerms.forEach(({ label, entries }) => {
              const matched = entries.find(e => e.quarter === q && String(e.year) === y);
              if (!matched) return;
              const dist = matched.germs_distribution || {};
              Object.values(dist).forEach(floorGerms => {
                Object.entries(floorGerms).forEach(([germ, count]) => {
                  if (!germ) return;
                  if (!germMap[germ]) germMap[germ] = {};
                  germMap[germ][label] = (germMap[germ][label] || 0) + count;
                });
              });
            });
            const allGerms = Object.keys(germMap).sort((a, b) => {
              const totA = IC_TYPES.reduce((s, tp) => s + (germMap[a]?.[tp] || 0), 0);
              const totB = IC_TYPES.reduce((s, tp) => s + (germMap[b]?.[tp] || 0), 0);
              return totB - totA;
            });
            if (!allGerms.length) return null;
            const thS = { padding: '8px 12px', fontWeight: 700, color: 'white', textAlign: 'center', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.2)' };
            const tdS = { padding: '7px 12px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' };
            return (
              <div style={{ marginTop: '1.5rem' }}>
                <h4 style={{ margin: '0 0 10px', color: summaryTheme.dark, fontSize: '0.95rem', fontWeight: 700 }}>
                  🔬 {ar ? 'توزيع الجراثيم حسب نوع الإصابة (CAUTI / CLABSI / VAP)' : 'Germ Distribution by Infection Type (CAUTI / CLABSI / VAP)'}
                </h4>
                <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: summaryTheme.gradient }}>
                        <th style={{ ...thS, textAlign: 'start' }}>{ar ? 'الجرثومة' : 'Germ'}</th>
                        {IC_TYPES.map(tp => <th key={tp} style={thS}>{tp}</th>)}
                        <th style={{ ...thS, borderRight: 'none' }}>{ar ? 'الإجمالي' : 'Total'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allGerms.map((germ, i) => {
                        const total = IC_TYPES.reduce((s, tp) => s + (germMap[germ]?.[tp] || 0), 0);
                        return (
                          <tr key={germ} style={{ background: i % 2 === 0 ? summaryTheme.light : '#fff' }}>
                            <td style={{ ...tdS, textAlign: 'start', fontWeight: 600, fontStyle: 'italic', color: summaryTheme.dark }}>{germ}</td>
                            {IC_TYPES.map(tp => (
                              <td key={tp} style={{ ...tdS, color: germMap[germ]?.[tp] ? '#0f172a' : '#94a3b8' }}>
                                {germMap[germ]?.[tp] || '—'}
                              </td>
                            ))}
                            <td style={{ ...tdS, fontWeight: 700, borderRight: 'none', color: summaryTheme.dark }}>{total}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* ── Table 3: Risk Factors — Per Indicator ── */}
          {(() => {
            const cautiCases  = casesEntry?.CAUTI  || [];
            const clabsiCases = casesEntry?.CLABSI || [];
            const vapCases    = casesEntry?.VAP    || [];
            const allCases    = [...cautiCases, ...clabsiCases, ...vapCases];
            if (!allCases.length) return null;
            const countYes = (list, k) => list.filter(c => c[k] === true || c[k] === 'Yes' || c[k] === 'yes').length;
            const pct = (n, total) => total > 0 ? (n / total * 100).toFixed(1) : null;
            const rows = RISK_COLS
              .map(k => ({
                label:  RISK_LABELS[k],
                cauti:  countYes(cautiCases,  k),
                clabsi: countYes(clabsiCases, k),
                vap:    countYes(vapCases,    k),
              }))
              .filter(r => r.cauti + r.clabsi + r.vap > 0)
              .sort((a, b) => (b.cauti + b.clabsi + b.vap) - (a.cauti + a.clabsi + a.vap));
            if (!rows.length) return null;
            const thS = { padding: '8px 12px', fontWeight: 700, color: 'white', textAlign: 'center', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.2)' };
            const tdS = { padding: '7px 12px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', textAlign: 'center' };
            const renderCell = (count, total, last) => (
              <td style={{ ...tdS, ...(last ? { borderRight: 'none' } : {}) }}>
                {count > 0
                  ? <span><strong>{count}</strong> <span style={{ color: '#64748b', fontSize: 11 }}>({pct(count, total)}%)</span></span>
                  : <span style={{ color: '#cbd5e1' }}>—</span>}
              </td>
            );
            return (
              <div style={{ marginTop: '1.5rem' }}>
                <h4 style={{ margin: '0 0 10px', color: summaryTheme.dark, fontSize: '0.95rem', fontWeight: 700 }}>
                  ⚠️ {ar ? 'عوامل الخطر — جميع المؤشرات والأقسام' : 'Risk Factors — All Indicators & Floors'}
                </h4>
                <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: summaryTheme.gradient }}>
                        <th style={{ ...thS, textAlign: 'start' }}>{ar ? 'عامل الخطر' : 'Risk Factor'}</th>
                        <th style={thS}>🧬 CAUTI</th>
                        <th style={thS}>🩸 CLABSI</th>
                        <th style={{ ...thS, borderRight: 'none' }}>🫁 VAP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={row.label} style={{ background: i % 2 === 0 ? summaryTheme.light : '#fff' }}>
                          <td style={{ ...tdS, textAlign: 'start', fontWeight: 600, color: summaryTheme.dark }}>{row.label}</td>
                          {renderCell(row.cauti,  cautiCases.length,  false)}
                          {renderCell(row.clabsi, clabsiCases.length, false)}
                          {renderCell(row.vap,    vapCases.length,    true)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* ── No-target Departments ── */}
          {noTargetEntries.length > 0 && (
            <div style={{
              marginTop: '1.5rem',
              border: '1px solid #fde68a',
              borderRadius: 12,
              overflow: 'hidden',
            }}>
              <div style={{
                background: 'linear-gradient(to right, #fffbeb, #fef3c7)',
                padding: '0.75rem 1.25rem',
                borderBottom: '1px solid #fde68a',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <h4 style={{ margin: 0, color: '#92400e', fontSize: '0.95rem', fontWeight: 700 }}>
                  ⚠ {ar ? 'أقسام بدون هدف محدد' : 'Departments without a target'}
                </h4>
                <span style={{
                  background: '#f59e0b', color: '#fff',
                  borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 700,
                }}>
                  {noTargetCases} {ar ? 'حالة' : 'cases'}
                </span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#fef9c3' }}>
                    <th style={{ padding: '8px 14px', textAlign: 'start', fontWeight: 600, color: '#78350f', borderBottom: '1px solid #fde68a' }}>
                      {ar ? 'القسم' : 'Department'}
                    </th>
                    <th style={{ padding: '8px 14px', textAlign: 'center', fontWeight: 600, color: '#78350f', borderBottom: '1px solid #fde68a' }}>
                      {ar ? 'عدد الحالات' : 'Cases'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {noTargetEntries.map(([dept, data], i) => (
                    <tr key={dept} style={{ background: i % 2 === 0 ? '#fffbeb' : '#fff' }}>
                      <td style={{ padding: '8px 14px', fontWeight: 600, color: '#92400e', borderBottom: '1px solid #fef3c7' }}>
                        {dept}
                      </td>
                      <td style={{ padding: '8px 14px', textAlign: 'center', fontWeight: 700, color: '#b45309', borderBottom: '1px solid #fef3c7' }}>
                        {data.cases || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Floor Rates ── */}
      {tab === 'floors' && (
        <div className={styles.reportCard}>
          <div className={styles.reportCardHeader}>
            <div className={styles.reportCardIcon} style={{ background: cfg.gradient }}>🏥</div>
            <h2 className={styles.reportCardTitle} style={{
              background: cfg.gradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              {ar ? 'معدلات الأقسام' : 'Floor Rates'}
            </h2>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: cfg.gradient, color: 'white' }}>
                  {[
                    ar ? 'القسم' : 'Department',
                    ar ? 'الحالات' : 'Cases',
                    ar ? cfg.daysLabel.ar : cfg.daysLabel.en,
                    ar ? 'المعدل (‰)' : 'Rate (‰)',
                    ar ? 'الهدف (‰)' : 'Target (‰)',
                    ar ? 'الحالة' : 'Status',
                  ].map(h => (
                    <th key={h} style={{ padding: '0.7rem 1rem', textAlign: 'center', fontWeight: 700 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(summary).map(([dept, data], i) => {
                  const casesV    = data.cases || 0;
                  const daysV     = data[cfg.daysKey] || 0;
                  const rate      = data.rate || 0;
                  const hasTarget = dept in targets;
                  const target    = hasTarget ? targets[dept] : null;
                  const isAbove   = hasTarget && rate > target && casesV > 0;
                  const rowBg     = !hasTarget ? '#fffbeb' : i % 2 === 0 ? cfg.light : 'white';
                  return (
                    <tr key={dept} style={{ background: rowBg }}>
                      <td style={{ padding: '0.6rem 1rem', fontWeight: 700, color: hasTarget ? cfg.dark : '#92400e', textAlign: 'center' }}>
                        {dept}
                        {!hasTarget && (
                          <div style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 600 }}>
                            {ar ? 'لا يوجد هدف' : 'No target'}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.6rem 1rem', textAlign: 'center', fontWeight: 600 }}>
                        {casesV}
                      </td>
                      <td style={{ padding: '0.6rem 1rem', textAlign: 'center' }}>
                        {hasTarget ? daysV.toLocaleString() : <span style={{ color: '#94a3b8' }}>—</span>}
                      </td>
                      <td style={{ padding: '0.6rem 1rem', textAlign: 'center', fontWeight: 700, color: isAbove ? '#dc2626' : '#16a34a' }}>
                        {hasTarget && casesV > 0 ? `${rate}` : <span style={{ color: '#94a3b8' }}>—</span>}
                      </td>
                      <td style={{ padding: '0.6rem 1rem', textAlign: 'center', color: '#d97706', fontWeight: 600 }}>
                        {hasTarget ? target : <span style={{ color: '#94a3b8' }}>—</span>}
                      </td>
                      <td style={{ padding: '0.6rem 1rem', textAlign: 'center' }}>
                        {!hasTarget || !casesV ? (
                          <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>—</span>
                        ) : (
                          <span style={{
                            background: isAbove ? '#fef2f2' : '#f0fdf4',
                            color:      isAbove ? '#dc2626' : '#16a34a',
                            padding: '0.25rem 0.75rem', borderRadius: '999px',
                            fontSize: '0.8rem', fontWeight: 700,
                          }}>
                            {isAbove
                              ? (ar ? '▲ فوق الهدف' : '▲ Above Target')
                              : (ar ? '▼ تحت الهدف' : '▼ Below Target')}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Germs ── */}
      {tab === 'germs' && (
        <div className={styles.reportCard}>
          <div className={styles.reportCardHeader}>
            <div className={styles.reportCardIcon} style={{ background: cfg.gradient }}>🧫</div>
            <h2 className={styles.reportCardTitle} style={{
              background: cfg.gradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              {ar ? 'توزيع الجراثيم' : 'Germ Distribution'}
            </h2>
          </div>

          <GermTable
            title={ar ? 'الجراثيم الكلية' : 'Overall Germs'}
            data={Object.values(entry.germs_distribution || {}).reduce((acc, deptGerms) => {
              Object.entries(deptGerms).forEach(([g, c]) => { acc[g] = (acc[g] || 0) + c; });
              return acc;
            }, {})}
            gradient={cfg.gradient}
            dark={cfg.dark}
            light={cfg.light}
            ar={ar}
          />

          {Object.entries(entry.germs_distribution || {}).map(([dept, germs]) =>
            germs && Object.keys(germs).length > 0 ? (
              <GermTable
                key={dept}
                title={ar ? `جراثيم قسم ${dept}` : `${dept} Germs`}
                data={germs}
                gradient={cfg.gradient}
                dark={cfg.dark}
                light={cfg.light}
                ar={ar}
              />
            ) : null
          )}
        </div>
      )}

    </div>
  );
}

function GermTable({ title, data, gradient, dark, light, ar }) {
  const { t } = useTranslation();
  const rows = Object.entries(data || {})
    .map(([k, v]) => [k, Number(v)])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((s, [, v]) => s + v, 0);
  if (!rows.length) return null;

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <h3 style={{ color: dark, fontWeight: 700, marginBottom: '0.75rem' }}>{title}</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ background: gradient, color: 'white' }}>
              <th style={{ padding: '0.6rem 1rem', textAlign: ar ? 'right' : 'left' }}>
                {t('germColumn')}
              </th>
              <th style={{ padding: '0.6rem 1rem', textAlign: 'center' }}>{t('countColumn')}</th>
              <th style={{ padding: '0.6rem 1rem', textAlign: 'center' }}>{t('percentColumn')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([key, val], i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? light : 'white' }}>
                <td style={{ padding: '0.5rem 1rem', color: '#374151' }}>{key}</td>
                <td style={{ padding: '0.5rem 1rem', textAlign: 'center', fontWeight: 600 }}>{val}</td>
                <td style={{ padding: '0.5rem 1rem', textAlign: 'center', color: dark }}>
                  {total > 0 ? ((val / total) * 100).toFixed(1) : '0'}%
                </td>
              </tr>
            ))}
            <tr style={{ fontWeight: 700 }}>
              <td style={{ padding: '0.5rem 1rem', color: dark }}>{t('totalRow')}</td>
              <td style={{ padding: '0.5rem 1rem', textAlign: 'center', color: dark }}>{total}</td>
              <td style={{ padding: '0.5rem 1rem', textAlign: 'center', color: dark }}>100%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default InfectionControlReports;
