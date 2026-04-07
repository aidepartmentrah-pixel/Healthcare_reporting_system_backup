import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import styles from '../../styles/Upload.module.css';
import { API_VAP, API_CLABSI, API_CAUTI } from '../../config/api';

const quarters = [
  { value: 1, label: 'الفصل الأول / Q1' },
  { value: 2, label: 'الفصل الثاني / Q2' },
  { value: 3, label: 'الفصل الثالث / Q3' },
  { value: 4, label: 'الفصل الرابع / Q4' },
];

const TABS = [
  {
    key: 'vap',
    icon: '🫁',
    color: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 50%, #0d9488 100%)',
    btnColor: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)',
    apiUrl: API_VAP,
    navigateTo: '/vap/dashboard',
    departments: ['ICU', 'CCU', 'CSU', 'ICN', 'Pediatric', 'ITU'],
    daysKey: 'ventilatorDaysPerDept',
    errorKey: 'enterVentDaysError',
    formDataBuilder: (denominators) => {
      const fd = new FormData();
      fd.append('icu_days', Number(denominators.ICU));
      fd.append('ccu_days', Number(denominators.CCU));
      fd.append('csu_days', Number(denominators.CSU));
      fd.append('ped_days', Number(denominators.Pediatric));
      fd.append('icn_days', Number(denominators.ICN));
      fd.append('itu_days', Number(denominators.ITU));
      return fd;
    },
  },
  {
    key: 'clabsi',
    icon: '🦠',
    color: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #1d4ed8 100%)',
    btnColor: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
    apiUrl: API_CLABSI,
    navigateTo: '/clabsi/dashboard',
    departments: ['ICU', 'CCU', 'CSU', 'ICN', 'Pediatric', 'ITU'],
    daysKey: 'catheterDaysPerDept',
    errorKey: 'enterCatheterDaysError',
    formDataBuilder: (denominators) => {
      const fd = new FormData();
      fd.append('denominators', JSON.stringify(
        Object.fromEntries(Object.entries(denominators).map(([k, v]) => [k, Number(v)]))
      ));
      return fd;
    },
  },
  {
    key: 'cauti',
    icon: '🧫',
    color: 'linear-gradient(135deg, #7c2d12 0%, #ea580c 50%, #c2410c 100%)',
    btnColor: 'linear-gradient(135deg, #7c2d12 0%, #ea580c 100%)',
    apiUrl: API_CAUTI,
    navigateTo: '/cauti/dashboard',
    departments: ['ICU', 'CCU', 'CSU', 'Ped', 'ICN', '3rd West', 'ITU'],
    daysKey: 'urinaryCatheterDaysPerDept',
    errorKey: 'enterUrinaryCatheterDaysError',
    formDataBuilder: (denominators) => {
      const fd = new FormData();
      fd.append('denominators', JSON.stringify(
        Object.fromEntries(Object.entries(denominators).map(([k, v]) => [k, Number(v)]))
      ));
      return fd;
    },
  },
];

function UploadForm({ tab }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const navigate = useNavigate();

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [error, setError]         = useState(null);
  const [success, setSuccess]     = useState(false);
  const [fileName, setFileName]   = useState('');
  const [quarter, setQuarter]     = useState('');
  const [year, setYear]           = useState(new Date().getFullYear());
  const [denominators, setDenominators] = useState(
    Object.fromEntries(tab.departments.map((d) => [d, '']))
  );

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (!quarter) { setError(t('selectQuarterError2')); return; }

    for (const dept of tab.departments) {
      const val = denominators[dept];
      if (val === '' || val === null || val === undefined || isNaN(Number(val)) || Number(val) < 0) {
        setError(`${t(tab.errorKey)} ${dept}`);
        return;
      }
    }

    setFileName(file.name);
    setUploading(true);
    setError(null);
    setSuccess(false);
    setProgress(0);

    const formData = tab.formDataBuilder(denominators);
    formData.append('file', file);
    formData.append('year', year);
    formData.append('quarter', quarter);

    try {
      await axios.post(`${tab.apiUrl}/process-data`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => setProgress(Math.round((e.loaded * 100) / e.total)),
      });
      setSuccess(true);
      setUploading(false);
      setTimeout(() => navigate(`${tab.navigateTo}?quarter=${quarter}&year=${year}`), 2000);
    } catch (err) {
      setError(err.response?.data?.detail || t('uploadError'));
      setUploading(false);
      setProgress(0);
    }
  }, [quarter, year, denominators, tab, navigate, t]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    multiple: false,
    disabled: uploading,
  });

  return (
    <div className={styles.uploadCard}>
      {/* Quarter & Year */}
      <div className={styles.inputSection}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label className={styles.inputLabel}>📅 {t('quarter')}</label>
            <select
              value={quarter}
              onChange={(e) => setQuarter(Number(e.target.value))}
              className={styles.inputField}
              disabled={uploading}
            >
              <option value="">{t('selectQuarterShort')}</option>
              {quarters.map((q) => (
                <option key={q.value} value={q.value}>{q.label}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label className={styles.inputLabel}>📆 {t('year')}</label>
            <input
              type="number" min="2020" max={new Date().getFullYear()}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              onWheel={(e) => e.target.blur()}
              className={styles.inputField}
              disabled={uploading}
            />
          </div>
        </div>
      </div>

      {/* Days per department */}
      <div className={styles.inputSection}>
        <label className={styles.inputLabel}>🏥 {t(tab.daysKey)}</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
          {tab.departments.map((dept) => (
            <div key={dept}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>{dept}</label>
              <input
                type="number" min="0" step="1"
                value={denominators[dept]}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, '');
                  setDenominators({ ...denominators, [dept]: raw });
                }}
                onWheel={(e) => e.target.blur()}
                onKeyDown={(e) => {
                  if (['e', 'E', '+', '-', '.'].includes(e.key)) e.preventDefault();
                }}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData('text');
                  if (!/^\d+$/.test(pasted)) e.preventDefault();
                }}
                className={styles.inputField}
                disabled={uploading}
                placeholder={t('enterDays')}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`${styles.dropzone} ${isDragActive ? styles.dropzoneActive : ''} ${uploading ? styles.dropzoneUploading : ''}`}
      >
        <input {...getInputProps()} />
        <div className={styles.dropzoneIcon}>📊</div>
        {uploading ? (
          <div className={styles.uploadProgress}>
            <div className={styles.progressTitle}>{t('processing')}</div>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${progress}%` }} />
            </div>
            <div className={styles.progressText}>{progress}%</div>
            {fileName && <div className={styles.fileName}>{fileName}</div>}
          </div>
        ) : isDragActive ? (
          <div className={styles.dropzoneContent}>
            <p className={styles.dropzoneTitle}>{t('dropFileHere')}</p>
          </div>
        ) : (
          <div className={styles.dropzoneContent}>
            <p className={styles.dropzoneTitle}>{t('dragDropHere')}</p>
            <p className={styles.dropzoneSeparator}>{t('or')}</p>
            <button className={styles.browseButton} style={{ background: tab.btnColor }}>
              {t('browseFiles')}
            </button>
            <p className={styles.acceptedFormats}>{t('acceptedFormats')}: Excel (.xlsx, .xls)</p>
          </div>
        )}
      </div>

      {error   && <div className={`${styles.alert} ${styles.alertError}`}>❌ {error}</div>}
      {success && <div className={`${styles.alert} ${styles.alertSuccess}`}>✅ {t('dataProcessedSuccessfully')}</div>}
    </div>
  );
}

function InfectionControlUpload({ language, defaultTab = 'vap' }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const [activeTab, setActiveTab] = useState(defaultTab);

  const currentTab = TABS.find((tb) => tb.key === activeTab);

  const tabLabels = {
    vap:    { ar: 'ذات الرئة', en: 'VAP' },
    clabsi: { ar: 'عدوى الدم', en: 'CLABSI' },
    cauti:  { ar: 'عدوى البول', en: 'CAUTI' },
  };

  return (
    <div className={styles.uploadContainer}>
      {/* Header */}
      <div
        className={styles.uploadHeader}
        style={{ background: currentTab.color, transition: 'background 0.3s ease' }}
      >
        <div className={styles.headerContent}>
          <div className={styles.headerIcon}>{currentTab.icon}</div>
          <div className={styles.headerText}>
            <h2>{t('infectionControlUploadTitle')}</h2>
            <p>{t('infectionControlUploadSubtitle')}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        padding: '1rem 1.5rem 0',
        borderBottom: '2px solid #e5e7eb',
        background: '#fff',
      }}>
        {TABS.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setActiveTab(tb.key)}
            style={{
              padding: '0.6rem 1.5rem',
              border: 'none',
              borderBottom: activeTab === tb.key ? '3px solid #0f766e' : '3px solid transparent',
              background: 'none',
              fontWeight: activeTab === tb.key ? 700 : 500,
              color: activeTab === tb.key ? '#0f766e' : '#64748b',
              cursor: 'pointer',
              fontSize: '0.95rem',
              transition: 'all 0.2s',
            }}
          >
            {tb.icon} {ar ? tabLabels[tb.key].ar : tabLabels[tb.key].en}
          </button>
        ))}
      </div>

      {/* Form — re-mounts on tab change to reset state */}
      <UploadForm key={activeTab} tab={currentTab} />
    </div>
  );
}

export default InfectionControlUpload;
