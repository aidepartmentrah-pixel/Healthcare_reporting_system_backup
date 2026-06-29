import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import styles from '../../styles/Reports.module.css';
import { API_URL } from '../../config/api';

const QUARTER_ORDER = {
  'الفصل الأول': 1, 'الفصل الاول': 1,
  'الفصل الثاني': 2, 'الفصل الثالث': 3, 'الفصل الرابع': 4,
};


function Reports({ selectedQ }) {
  const { t } = useTranslation();
  const [reportType, setReportType]   = useState('summary');
  const [generating, setGenerating]   = useState(false);
  const [reportUrl, setReportUrl]     = useState(null);
  const [history, setHistory]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [fullData, setFullData]       = useState(null);

  useEffect(() => {
    axios.get(`${API_URL}/history`)
      .then(res => {
        const entries = Array.isArray(res.data) ? res.data : [];
        const sorted = [...entries].sort((a, b) => {
          const ya = parseInt(a.year) || 0, yb = parseInt(b.year) || 0;
          if (ya !== yb) return yb - ya;
          return (QUARTER_ORDER[b.quarter] || 0) - (QUARTER_ORDER[a.quarter] || 0);
        });
        setHistory(sorted);
        const preferred = selectedQ;
        const idx = preferred
          ? sorted.findIndex(e => e.quarter === preferred.quarter && String(e.year) === String(preferred.year))
          : -1;
        setSelectedIndex(idx >= 0 ? idx : 0);
      })
      .catch(err => console.error('Failed to load mortality history:', err))
      .finally(() => setLoading(false));
  }, []);

  // Sync when selectedQ changes (user selects a different quarter while on this page)
  useEffect(() => {
    if (!selectedQ || !history.length) return;
    const idx = history.findIndex(e => e.quarter === selectedQ.quarter && String(e.year) === String(selectedQ.year));
    if (idx >= 0) setSelectedIndex(idx);
  }, [selectedQ, history]);

  const entry = history[selectedIndex] || null;

  // Fetch full quarter data (records + statistics) from the per-quarter file
  useEffect(() => {
    if (!entry) { setFullData(null); return; }
    axios.get(`${API_URL}/quarter?q=${encodeURIComponent(entry.quarter)}&year=${entry.year}`)
      .then(r => setFullData(r.data))
      .catch(() => setFullData(null));
  }, [entry?.quarter, entry?.year]);

  const hasRecords = Array.isArray(fullData?.records) && fullData.records.length > 0;

  const handleGenerateReport = async () => {
    if (!entry) return;
    setGenerating(true);
    setReportUrl(null);
    try {
      const response = await axios.post(`${API_URL}/generate-report`, {
        quarter: entry.quarter,
        year: entry.year,
        language: 'ar',
      });
      if (response.data.success) {
        const url = `${API_URL}/download-report?fileName=${encodeURIComponent(response.data.fileName)}`;
        setReportUrl(url);
      }
    } catch (err) {
      console.error('Error generating report:', err);
      alert(t('errorGeneratingReport') || 'Error generating report');
    } finally {
      setGenerating(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={styles.emptyState}>
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

  // ── No data ──────────────────────────────────────────────────────────────────
  if (!entry) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyStateBackground} />
        <div className={styles.emptyStateContent}>
          <div className={styles.emptyStateIconWrapper}>
            <span className={styles.emptyStateIcon}>📄</span>
          </div>
          <h2 className={styles.emptyStateTitle}>{t('noReportsAvailable')}</h2>
          <p className={styles.emptyStateText}>{t('uploadDataToGenerateReports')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.reportsContainer}>

      {/* Header */}
      <div className={styles.reportsHeader}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIconWrapper}>
              <span className={styles.headerIcon}>📊</span>
            </div>
            <div>
              <h1 className={styles.headerTitle}>{t('reports')}</h1>
              <p className={styles.headerSubtitle}>{t('generateAndDownloadReports')}</p>
            </div>
          </div>
          <button
            onClick={handleGenerateReport}
            className={styles.downloadButton}
            disabled={generating}
            style={{ opacity: generating ? 0.7 : 1 }}
          >
            <span className={styles.downloadButtonIcon}>📄</span>
            {generating
              ? (t('generating') || 'Generating...')
              : (t('generateWordReport') || 'Generate Word Report')}
          </button>
        </div>
      </div>

      {/* Download banner */}
      {reportUrl && (
        <div style={{
          backgroundColor: '#2563eb', color: 'white',
          padding: '1rem 1.5rem', borderRadius: '12px', marginBottom: '1.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>✅</span>
            <span style={{ fontWeight: 600 }}>
              {t('reportGenerated') || 'Word Report Generated Successfully!'}
            </span>
          </div>
          <a
            href={reportUrl}
            download
            style={{
              backgroundColor: 'white', color: '#1e3a8a',
              padding: '0.5rem 1.5rem', borderRadius: '8px',
              fontWeight: 'bold', textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}
          >
            <span>⬇️</span>
            {t('downloadWord') || 'Download Word Document'}
          </a>
        </div>
      )}

      {/* Report type tabs */}
      <div className={styles.typeSelector}>
        <div className={styles.typeSelectorButtons}>
          <button
            onClick={() => setReportType('summary')}
            className={`${styles.typeButton} ${styles.typeButtonSummary} ${
              reportType === 'summary' ? styles.typeButtonActive : styles.typeButtonInactive
            }`}
          >
            <span className={styles.typeButtonIcon}>📄</span>
            {t('summaryReport')}
          </button>
          {hasRecords && (
            <button
              onClick={() => setReportType('detailed')}
              className={`${styles.typeButton} ${styles.typeButtonDetailed} ${
                reportType === 'detailed' ? styles.typeButtonActive : styles.typeButtonInactive
              }`}
            >
              <span className={styles.typeButtonIcon}>📋</span>
              {t('detailedReport')}
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      {reportType === 'summary' && (
        <div className={styles.reportCard}>
          <div className={styles.reportCardHeader}>
            <div className={styles.reportCardIcon}>📊</div>
            <h2 className={styles.reportCardTitle}>{t('summaryReport')}</h2>
          </div>

          <div className={styles.statsGrid}>
            {/* Deaths */}
            <div className={styles.statCard}>
              <div className={styles.statCardContent}>
                <div className={styles.statCardHeader}>
                  <div className={styles.statCardIconWrapper}>
                    <span className={styles.statCardIcon}>💀</span>
                  </div>
                  <h3 className={styles.statCardLabel}>{t('totalDeaths')}</h3>
                </div>
                <div className={styles.statCardValue}>{entry.deaths ?? 0}</div>
                <div className={styles.statCardProgress}>
                  <div className={styles.statCardProgressBar} style={{ width: '100%' }} />
                </div>
              </div>
            </div>

            {/* Mortality rate */}
            <div className={styles.statCard}>
              <div className={styles.statCardContent}>
                <div className={styles.statCardHeader}>
                  <div className={styles.statCardIconWrapper}>
                    <span className={styles.statCardIcon}>📉</span>
                  </div>
                  <h3 className={styles.statCardLabel}>
                    {t('mortalityRate') || 'Mortality Rate'}
                  </h3>
                </div>
                <div className={styles.statCardValue}>
                  {entry.rate ?? 0}
                  <span className={styles.statCardSubValue}>%</span>
                </div>
                <div className={styles.statCardProgress}>
                  <div className={styles.statCardProgressBar}
                    style={{ width: `${Math.min((entry.rate ?? 0) * 30, 100)}%` }} />
                </div>
              </div>
            </div>

            {/* Total patients */}
            <div className={styles.statCard}>
              <div className={styles.statCardContent}>
                <div className={styles.statCardHeader}>
                  <div className={styles.statCardIconWrapper}>
                    <span className={styles.statCardIcon}>🏥</span>
                  </div>
                  <h3 className={styles.statCardLabel}>
                    {t('totalPatients') || 'Total Patients'}
                  </h3>
                </div>
                <div className={styles.statCardValue}>
                  {(entry.total_patients ?? 0).toLocaleString()}
                </div>
                <div className={styles.statCardProgress}>
                  <div className={styles.statCardProgressBar} style={{ width: '75%' }} />
                </div>
              </div>
            </div>

            {/* Quarter/year */}
            <div className={styles.statCard}>
              <div className={styles.statCardContent}>
                <div className={styles.statCardHeader}>
                  <div className={styles.statCardIconWrapper}>
                    <span className={styles.statCardIcon}>📅</span>
                  </div>
                  <h3 className={styles.statCardLabel}>
                    {t('quarterYearLabel') || 'Quarter / Year'}
                  </h3>
                </div>
                <div className={styles.statCardValue} style={{ fontSize: '1.05rem' }}>
                  {entry.quarter}
                  <span className={styles.statCardSubValue}>{entry.year}</span>
                </div>
                <div className={styles.statCardProgress}>
                  <div className={styles.statCardProgressBar} style={{ width: '60%' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Departments breakdown */}
          {Object.keys(entry.departments || {}).length > 0 && (
            <div className={styles.summarySection} style={{ marginTop: '1.5rem' }}>
              <div className={styles.summarySectionHeader}>
                <div className={styles.summarySectionIcon}>
                  <span className={styles.summarySectionIconText}>🏥</span>
                </div>
                <h3 className={styles.summarySectionTitle}>
                  {t('departments') || 'Departments'}
                </h3>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
                {Object.entries(entry.departments)
                  .filter(([, count]) => count > 0)
                  .sort(([, a], [, b]) => b - a)
                  .map(([name, count]) => (
                    <span key={name} style={{
                      background: '#eff6ff', border: '1px solid #bfdbfe',
                      borderRadius: '8px', padding: '0.25rem 0.75rem',
                      fontSize: '0.875rem', color: '#1e40af', fontWeight: 500,
                    }}>
                      {name}: <strong>{count}</strong>
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detailed report — only when current session records are available */}
      {reportType === 'detailed' && hasRecords && (
        <div className={styles.reportCard}>
          <div className={styles.reportCardHeader}>
            <div className={styles.reportCardIcon}>📋</div>
            <h2 className={styles.reportCardTitle}>{t('detailedReport')}</h2>
          </div>

          <div className={styles.tableWrapper}>
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead className={styles.tableHead}>
                  <tr className={styles.tableHeadRow}>
                    <th className={styles.tableHeadCell}>
                      <div className={styles.tableHeadCellContent}>
                        <span className={styles.tableHeadCellIcon}>🔢</span>
                        {t('recordNumber')}
                      </div>
                    </th>
                    <th className={styles.tableHeadCell}>
                      <div className={styles.tableHeadCellContent}>
                        <span className={styles.tableHeadCellIcon}>👴</span>
                        {t('age')}
                      </div>
                    </th>
                    <th className={styles.tableHeadCell}>
                      <div className={styles.tableHeadCellContent}>
                        <span className={styles.tableHeadCellIcon}>👥</span>
                        {t('gender')}
                      </div>
                    </th>
                    <th className={styles.tableHeadCell}>
                      <div className={styles.tableHeadCellContent}>
                        <span className={styles.tableHeadCellIcon}>🏥</span>
                        {t('lengthOfStay')}
                      </div>
                    </th>
                    <th className={styles.tableHeadCell}>
                      <div className={styles.tableHeadCellContent}>
                        <span className={styles.tableHeadCellIcon}>📅</span>
                        {t('month')}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className={styles.tableBody}>
                  {fullData.records.slice(0, 50).map((record, index) => (
                    <tr key={index} className={styles.tableBodyRow}>
                      <td className={styles.tableBodyCell}>
                        <div className={styles.tableCellNumber}>
                          <div className={styles.tableCellNumberBadge}>{index + 1}</div>
                        </div>
                      </td>
                      <td className={styles.tableBodyCell}>
                        <span className={styles.tableCellAge}>{record.age}</span>
                      </td>
                      <td className={styles.tableBodyCell}>
                        <span className={`${styles.tableCellGenderBadge} ${
                          record.gender === 'ذكر' || record.gender === 'male'
                            ? styles.tableCellGenderMale
                            : styles.tableCellGenderFemale
                        }`}>
                          {record.gender === 'ذكر' || record.gender === 'male' ? '♂️ ' : '♀️ '}
                          {record.gender}
                        </span>
                      </td>
                      <td className={styles.tableBodyCell}>
                        <span className={styles.tableCellLOS}>
                          {record.length_of_stay_original ?? record.length_of_stay ?? record.los}
                        </span>
                      </td>
                      <td className={styles.tableBodyCell}>
                        <span className={styles.tableCellMonthBadge}>{record.month}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {fullData.records.length > 50 && (
            <div className={styles.tableInfoBanner}>
              <p className={styles.tableInfoText}>
                <span className={styles.tableInfoIcon}>ℹ️</span>
                {t('showingFirst50Records', { total: data.records.length })}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Reports;
