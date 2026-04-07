import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import styles from '../../styles/Reports.module.css';
import { API_BASE } from '../../config/api';

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

function InfectionControlReports({ type }) {
  const { t, i18n } = useTranslation();
  const ar  = i18n.language === 'ar';
  const cfg = TYPE_CONFIG[type];

  const [tab,        setTab]        = useState('summary');
  const [entry,      setEntry]      = useState(null);
  const [targets,    setTargets]    = useState({});
  const [loading,    setLoading]    = useState(true);
  const [generating, setGenerating] = useState(false);
  const [reportUrl,  setReportUrl]  = useState(null);

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
        const cur = curRes.data || {};
        // Default to last uploaded quarter; fallback to last chronological entry
        const matched = cur.quarter
          ? entries.find(e => e.quarter === cur.quarter && String(e.year) === String(cur.year))
          : null;
        setEntry(matched || (entries.length > 0 ? entries[entries.length - 1] : null));
        setTargets(tgtsRes.data || {});
      })
      .catch(err => console.error(`Failed to load ${type} data:`, err))
      .finally(() => setLoading(false));
  }, [type]);

  const handleGenerateReport = async () => {
    setGenerating(true);
    setReportUrl(null);
    try {
      const response = await axios.post(`${cfg.apiBase}/generate-report`);
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

  const summary     = entry.summary || {};
  const totalCases  = Object.values(summary).reduce((s, v) => s + (v.cases || 0), 0);
  const totalDays   = Object.values(summary).reduce((s, v) => s + (v[cfg.daysKey] || 0), 0);
  const overallRate = totalDays > 0
    ? ((totalCases / totalDays) * 1000).toFixed(2)
    : '—';

  const statCards = [
    {
      icon:   '🦠',
      label:  ar ? 'إجمالي الحالات' : 'Total Cases',
      value:  totalCases,
      bg:     'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      border: '#991b1b',
    },
    {
      icon:   cfg.icon,
      label:  ar ? cfg.daysLabel.ar : cfg.daysLabel.en,
      value:  totalDays.toLocaleString(),
      bg:     'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      border: '#1e40af',
    },
    {
      icon:     '📊',
      label:    ar ? `معدل ${cfg.label} الكلي` : `Overall ${cfg.label} Rate`,
      value:    overallRate,
      subValue: '‰',
      bg:       cfg.gradient,
      border:   cfg.dark,
    },
    {
      icon:     '📅',
      label:    t('quarterYearLabel'),
      value:    quarterLabel(entry.quarter, entry.year, ar),
      bg:       'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
      border:   '#5b21b6',
    },
  ];

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
            <div className={styles.reportCardIcon} style={{ background: cfg.gradient }}>📊</div>
            <h2 className={styles.reportCardTitle} style={{
              background: cfg.gradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
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

          <div className={styles.summarySection} style={{
            background: cfg.light,
            borderColor: cfg.dark,
          }}>
            <div className={styles.summarySectionHeader}>
              <div className={styles.summarySectionIcon} style={{ background: cfg.gradient }}>
                <span className={styles.summarySectionIconText}>{cfg.icon}</span>
              </div>
              <h3 className={styles.summarySectionTitle} style={{
                background: cfg.gradient,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                {t('reportSummaryTitle')}
              </h3>
            </div>
            <p className={styles.summarySectionText}>
              {ar
                ? `بناءً على بيانات ${quarterLabel(entry.quarter, entry.year, true)}، تم تسجيل ${totalCases} حالة ${cfg.label} عبر ${totalDays.toLocaleString()} يوم، بمعدل إجمالي ${overallRate}‰.`
                : `Based on ${quarterLabel(entry.quarter, entry.year, false)} data, ${totalCases} ${cfg.label} cases were recorded across ${totalDays.toLocaleString()} days, with an overall rate of ${overallRate}‰.`}
            </p>
          </div>
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
                  const casesV   = data.cases || 0;
                  const daysV    = data[cfg.daysKey] || 0;
                  const rate     = data.rate || 0;
                  const target   = targets[dept] || 0;
                  const isAbove  = rate > target && casesV > 0;
                  const hasData  = casesV > 0 || daysV > 0;
                  return (
                    <tr key={dept} style={{ background: i % 2 === 0 ? cfg.light : 'white' }}>
                      <td style={{ padding: '0.6rem 1rem', fontWeight: 700, color: cfg.dark, textAlign: 'center' }}>
                        {dept}
                      </td>
                      <td style={{ padding: '0.6rem 1rem', textAlign: 'center', fontWeight: 600 }}>
                        {casesV}
                      </td>
                      <td style={{ padding: '0.6rem 1rem', textAlign: 'center' }}>
                        {daysV.toLocaleString()}
                      </td>
                      <td style={{
                        padding: '0.6rem 1rem', textAlign: 'center', fontWeight: 700,
                        color: hasData ? (isAbove ? '#dc2626' : '#16a34a') : '#94a3b8',
                      }}>
                        {hasData ? `${rate}` : '—'}
                      </td>
                      <td style={{ padding: '0.6rem 1rem', textAlign: 'center', color: '#d97706', fontWeight: 600 }}>
                        {target}
                      </td>
                      <td style={{ padding: '0.6rem 1rem', textAlign: 'center' }}>
                        {!hasData ? (
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
