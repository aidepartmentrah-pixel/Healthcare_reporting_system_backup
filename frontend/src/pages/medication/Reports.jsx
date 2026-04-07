import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import styles from '../../styles/Reports.module.css';
import { API_MEDICATION as API_URL } from '../../config/api';

const TEAL = 'linear-gradient(135deg, #0d9488 0%, #0891b2 100%)';
const TEAL_DARK = '#0f766e';

function MedicationReports({ language, currentData }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const [reportType, setReportType] = useState('summary');
  const [generating, setGenerating] = useState(false);
  const [reportUrl, setReportUrl] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    axios.get(`${API_URL}/history`)
      .then(res => {
        const entries = Array.isArray(res.data) ? res.data : [];
        setHistory(entries);
        setSelectedIndex(entries.length > 0 ? entries.length - 1 : 0);
      })
      .catch(err => console.error('Failed to load medication history:', err))
      .finally(() => setLoading(false));
  }, []);

  // Sync selected index to last uploaded quarter whenever currentData or history changes
  useEffect(() => {
    if (!currentData?.quarter || history.length === 0) return;
    const idx = history.findIndex(
      e => e.quarter === currentData.quarter && String(e.year) === String(currentData.year)
    );
    if (idx >= 0) setSelectedIndex(idx);
  }, [currentData, history]);

  const entry = history[selectedIndex] || null;

  // If the selected quarter matches the saved current snapshot, use its full
  // statistics (contains cause_stage_matrix, type_stage_matrix, heatmaps, etc.)
  // instead of the lean history fields.
  const isCurrentEntry =
    entry &&
    currentData &&
    entry.quarter === currentData.quarter &&
    String(entry.year) === String(currentData.year);

  const data = entry
    ? {
        quarter: entry.quarter,
        year: entry.year,
        statistics: isCurrentEntry
          ? currentData.statistics
          : {
              summary: {
                total_errors: entry.total_errors,
                total_doses:  entry.total_doses,
                error_rate:   entry.error_rate,
              },
              error_cycle:        {},
              detected_by:        {},
              duty_shift:         {},
              staff_involved:     {},
              error_causes:       {},
              departments:        {},
              ncc_merp:           {},
              cause_stage_matrix: {},
              type_stage_matrix:  {},
              departments_all:    {},
            },
      }
    : null;

  const handleGenerateReport = async () => {
    if (!data) return;
    setGenerating(true);
    setReportUrl(null);
    try {
      const response = await axios.post(`${API_URL}/generate-report`, {
        data: { statistics: data.statistics },
        quarter: data.quarter,
        year: data.year,
      });
      if (response.data.success) {
        const url = `${API_URL}/download-report?fileName=${encodeURIComponent(response.data.fileName)}`;
        setReportUrl(url);
      }
    } catch (err) {
      console.error('Report generation error:', err);
      alert(t('errorGeneratingReport'));
    } finally {
      setGenerating(false);
    }
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={styles.emptyState} style={{ background: TEAL }}>
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

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!data) {
    return (
      <div className={styles.emptyState} style={{ background: TEAL }}>
        <div className={styles.emptyStateBackground} />
        <div className={styles.emptyStateContent}>
          <div className={styles.emptyStateIconWrapper}>
            <span className={styles.emptyStateIcon}>💊</span>
          </div>
          <h2 className={styles.emptyStateTitle}>{t('medNoDataTitle')}</h2>
          <p className={styles.emptyStateText}>{t('medNoDataText')}</p>
        </div>
      </div>
    );
  }

  const sm = data.statistics?.summary || {};
  const totalErrors = sm.total_errors ?? 0;
  const totalDoses  = (sm.total_doses ?? 0).toLocaleString();
  const errorRate   = sm.error_rate != null ? Number(sm.error_rate).toFixed(4) : '—';

  const statCards = [
    {
      icon: '⚠️',
      label: t('totalErrors'),
      value: totalErrors,
      subValue: null,
      progress: 100,
      bg: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      border: '#991b1b',
    },
    {
      icon: '💉',
      label: t('totalDoses'),
      value: totalDoses,
      subValue: null,
      progress: 75,
      bg: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      border: '#1e40af',
    },
    {
      icon: '📉',
      label: t('errorRate'),
      value: errorRate,
      subValue: '%',
      progress: 50,
      bg: TEAL,
      border: TEAL_DARK,
    },
    {
      icon: '📅',
      label: t('quarterYearLabel'),
      value: data.quarter,
      subValue: data.year,
      progress: 60,
      bg: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
      border: '#5b21b6',
    },
  ];

  return (
    <div className={styles.reportsContainer}>

      {/* Header */}
      <div className={styles.reportsHeader} style={{ background: TEAL }}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIconWrapper}>
              <span className={styles.headerIcon}>💊</span>
            </div>
            <div>
              <h1 className={styles.headerTitle}>{t('medReportsTitle')}</h1>
              <p className={styles.headerSubtitle}>{t('medReportsSubtitle')}</p>
            </div>
          </div>
          <button
            onClick={handleGenerateReport}
            className={styles.downloadButton}
            disabled={generating}
            style={{ opacity: generating ? 0.7 : 1, color: TEAL_DARK }}
          >
            <span className={styles.downloadButtonIcon}>📄</span>
            {generating ? t('generatingBtn') : t('generateWordReportBtn')}
          </button>
        </div>
      </div>

      {/* Download link banner */}
      {reportUrl && (
        <div style={{
          backgroundColor: '#0d9488',
          color: 'white',
          padding: '1rem 1.5rem',
          borderRadius: '12px',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 4px 12px rgba(13,148,136,0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>✅</span>
            <span style={{ fontWeight: 600 }}>{t('reportGeneratedSuccess')}</span>
          </div>
          <a
            href={reportUrl}
            download
            style={{
              backgroundColor: 'white',
              color: '#0d9488',
              padding: '0.5rem 1.5rem',
              borderRadius: '8px',
              fontWeight: 'bold',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>⬇️</span>
            {t('downloadDocument')}
          </a>
        </div>
      )}

      {/* Report type selector */}
      <div className={styles.typeSelector}>
        <div className={styles.typeSelectorButtons}>
          <button
            onClick={() => setReportType('summary')}
            className={`${styles.typeButton} ${styles.typeButtonSummary} ${
              reportType === 'summary' ? styles.typeButtonActive : styles.typeButtonInactive
            }`}
            style={reportType === 'summary' ? { background: TEAL } : {}}
          >
            <span className={styles.typeButtonIcon}>📄</span>
            {t('statisticsSummary')}
          </button>
          <button
            onClick={() => setReportType('detailed')}
            className={`${styles.typeButton} ${styles.typeButtonDetailed} ${
              reportType === 'detailed' ? styles.typeButtonActive : styles.typeButtonInactive
            }`}
            style={reportType === 'detailed' ? { background: TEAL } : {}}
          >
            <span className={styles.typeButtonIcon}>📋</span>
            {t('errorDistributionTab')}
          </button>
        </div>
      </div>

      {/* ── Summary view ── */}
      {reportType === 'summary' && (
        <div className={styles.reportCard}>
          <div className={styles.reportCardHeader}>
            <div className={styles.reportCardIcon} style={{ background: TEAL }}>📊</div>
            <h2 className={styles.reportCardTitle} style={{
              background: TEAL,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              {t('statisticsSummary')}
            </h2>
          </div>

          <div className={styles.statsGrid}>
            {statCards.map((card, i) => (
              <div
                key={i}
                className={styles.statCard}
                style={{ background: card.bg, borderLeftColor: card.border }}
              >
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
                    <div
                      className={styles.statCardProgressBar}
                      style={{ width: `${card.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.summarySection} style={{
            background: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 50%, #cffafe 100%)',
            borderColor: '#0d9488',
          }}>
            <div className={styles.summarySectionHeader}>
              <div className={styles.summarySectionIcon} style={{ background: TEAL }}>
                <span className={styles.summarySectionIconText}>💊</span>
              </div>
              <h3 className={styles.summarySectionTitle} style={{
                background: TEAL,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                {t('reportSummaryTitle')}
              </h3>
            </div>
            <p className={styles.summarySectionText}>
              {t('medSummaryText', {
                quarter: data.quarter,
                year: data.year,
                errors: totalErrors,
                doses: totalDoses,
                rate: errorRate,
              })}
            </p>
          </div>
        </div>
      )}

      {/* ── Error distribution view ── */}
      {reportType === 'detailed' && (
        <div className={styles.reportCard}>
          <div className={styles.reportCardHeader}>
            <div className={styles.reportCardIcon} style={{ background: TEAL }}>📋</div>
            <h2 className={styles.reportCardTitle} style={{
              background: TEAL,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              {t('errorDistributionTab')}
            </h2>
          </div>

          <DistributionTable
            title={t('medProcessStageLabel')}
            data={entry.error_cycle}
            teal={TEAL} tealDark={TEAL_DARK} ar={ar}
          />
          <DistributionTable
            title={t('detectedByLabel')}
            data={entry.detected_by}
            teal={TEAL} tealDark={TEAL_DARK} ar={ar}
          />
          <DistributionTable
            title={t('dutyShiftLabel')}
            data={entry.duty_shift}
            teal={TEAL} tealDark={TEAL_DARK} ar={ar}
          />
        </div>
      )}
    </div>
  );
}

function DistributionTable({ title, data, teal, tealDark, ar }) {
  const { t } = useTranslation();
  const countsDict = (data && typeof data === 'object' && data.counts) ? data.counts : (data || {});
  const rows = Object.entries(countsDict)
    .map(([k, v]) => [k, Number(v)])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((s, [, v]) => s + v, 0);
  if (rows.length === 0) return null;

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <h3 style={{ color: tealDark, fontWeight: 700, marginBottom: '0.75rem' }}>{title}</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ background: teal, color: 'white' }}>
              <th style={{ padding: '0.6rem 1rem', textAlign: ar ? 'right' : 'left' }}>
                {t('tableCategory')}
              </th>
              <th style={{ padding: '0.6rem 1rem', textAlign: 'center' }}>
                {t('tableCount')}
              </th>
              <th style={{ padding: '0.6rem 1rem', textAlign: 'center' }}>
                {t('tablePercent')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([key, val], i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#f0fdfa' : 'white' }}>
                <td style={{ padding: '0.5rem 1rem', color: '#374151' }}>{key}</td>
                <td style={{ padding: '0.5rem 1rem', textAlign: 'center', fontWeight: 600 }}>{val}</td>
                <td style={{ padding: '0.5rem 1rem', textAlign: 'center', color: tealDark }}>
                  {total > 0 ? ((val / total) * 100).toFixed(1) : '0'}%
                </td>
              </tr>
            ))}
            <tr style={{ background: '#ccfbf1', fontWeight: 700 }}>
              <td style={{ padding: '0.5rem 1rem', color: tealDark }}>{t('tableTotal')}</td>
              <td style={{ padding: '0.5rem 1rem', textAlign: 'center', color: tealDark }}>{total}</td>
              <td style={{ padding: '0.5rem 1rem', textAlign: 'center', color: tealDark }}>100%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default MedicationReports;
