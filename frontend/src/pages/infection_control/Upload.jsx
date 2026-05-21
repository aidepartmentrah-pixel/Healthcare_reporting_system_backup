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
    daysKey: 'ventilatorDaysPerDept',
    errorKey: 'enterVentDaysError',
  },
  {
    key: 'clabsi',
    icon: '🦠',
    color: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #1d4ed8 100%)',
    btnColor: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
    apiUrl: API_CLABSI,
    navigateTo: '/clabsi/dashboard',
    daysKey: 'catheterDaysPerDept',
    errorKey: 'enterCatheterDaysError',
  },
  {
    key: 'cauti',
    icon: '🧫',
    color: 'linear-gradient(135deg, #7c2d12 0%, #ea580c 50%, #c2410c 100%)',
    btnColor: 'linear-gradient(135deg, #7c2d12 0%, #ea580c 100%)',
    apiUrl: API_CAUTI,
    navigateTo: '/cauti/dashboard',
    daysKey: 'urinaryCatheterDaysPerDept',
    errorKey: 'enterUrinaryCatheterDaysError',
  },
];

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  border: '1.5px solid #e2e8f0',
  borderRadius: 8,
  fontSize: 14,
  marginTop: 4,
  boxSizing: 'border-box',
};

function UploadForm({ tab }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const navigate = useNavigate();

  // step: 'initial' | 'scanning' | 'floors-ready' | 'processing' | 'done'
  const [step,          setStep]          = useState('initial');
  const [droppedFile,   setDroppedFile]   = useState(null);
  const [quarter,       setQuarter]       = useState('');
  const [year,          setYear]          = useState(new Date().getFullYear());
  const [floors,        setFloors]        = useState([]);
  const [missingFloors, setMissingFloors] = useState([]);
  const [denominators,  setDenominators]  = useState({});
  const [newTargets,    setNewTargets]    = useState({});
  const [error,         setError]         = useState(null);
  const [progress,      setProgress]      = useState(0);

  const reset = () => {
    setStep('initial');
    setDroppedFile(null);
    setFloors([]);
    setMissingFloors([]);
    setDenominators({});
    setNewTargets({});
    setError(null);
    setProgress(0);
  };

  // ── Step 1: drop file → scan floors ────────────────────────────────────────
  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (!quarter) {
      setError(t('selectQuarterError2'));
      return;
    }

    setDroppedFile(file);
    setError(null);
    setStep('scanning');

    const fd = new FormData();
    fd.append('file', file);
    fd.append('quarter', quarter);

    try {
      const { data } = await axios.post(`${tab.apiUrl}/get-floors`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const foundFloors = data.floors || [];
      if (foundFloors.length === 0) {
        setError('No floor data found in this file. Make sure the Excel has a "Floor" column.');
        setStep('initial');
        return;
      }

      setFloors(foundFloors);
      setMissingFloors(data.missing_targets || []);
      setDenominators(Object.fromEntries(foundFloors.map(f => [f, ''])));
      setNewTargets(Object.fromEntries((data.missing_targets || []).map(f => [f, ''])));
      setStep('floors-ready');
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not read floors from file');
      setStep('initial');
    }
  }, [quarter, tab]);

  // ── Step 2: submit ──────────────────────────────────────────────────────────
  const handleProcess = async () => {
    // Validate device days
    for (const floor of floors) {
      const val = denominators[floor];
      if (val === '' || val === null || isNaN(Number(val)) || Number(val) < 0) {
        setError(`${t(tab.errorKey)}: ${floor}`);
        return;
      }
    }
    // Validate new targets
    for (const floor of missingFloors) {
      const val = newTargets[floor];
      if (val === '' || val === null || isNaN(Number(val)) || Number(val) < 0) {
        setError(`Please enter a target rate for new floor: ${floor}`);
        return;
      }
    }

    setStep('processing');
    setError(null);
    setProgress(0);

    const fd = new FormData();
    fd.append('file', droppedFile);
    fd.append('year', year);
    fd.append('quarter', quarter);
    fd.append('denominators', JSON.stringify(
      Object.fromEntries(floors.map(f => [f, Number(denominators[f])]))
    ));
    if (missingFloors.length > 0) {
      fd.append('new_targets', JSON.stringify(
        Object.fromEntries(missingFloors.map(f => [f, Number(newTargets[f])]))
      ));
    }

    try {
      await axios.post(`${tab.apiUrl}/process-data`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: e => setProgress(Math.round((e.loaded * 100) / e.total)),
      });
      setStep('done');
      setTimeout(() => navigate(`${tab.navigateTo}?quarter=${quarter}&year=${year}`), 2000);
    } catch (err) {
      setError(err.response?.data?.detail || t('uploadError'));
      setStep('floors-ready');
      setProgress(0);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    multiple: false,
    disabled: step !== 'initial',
  });

  return (
    <div className={styles.uploadCard}>

      {/* ── Quarter & Year ── */}
      <div className={styles.inputSection}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label className={styles.inputLabel}>📅 {t('quarter')}</label>
            <select
              value={quarter}
              onChange={e => { reset(); setQuarter(Number(e.target.value)); }}
              className={styles.inputField}
              disabled={step === 'processing' || step === 'done'}
            >
              <option value="">{t('selectQuarterShort')}</option>
              {quarters.map(q => (
                <option key={q.value} value={q.value}>{q.label}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label className={styles.inputLabel}>📆 {t('year')}</label>
            <input
              type="number" min="2020" max={new Date().getFullYear()}
              value={year}
              onChange={e => { reset(); setYear(e.target.value); }}
              onWheel={e => e.target.blur()}
              className={styles.inputField}
              disabled={step === 'processing' || step === 'done'}
            />
          </div>
        </div>
      </div>

      {/* ── Step 1: Dropzone ── */}
      {(step === 'initial' || step === 'scanning') && (
        <div
          {...getRootProps()}
          className={`${styles.dropzone} ${isDragActive ? styles.dropzoneActive : ''} ${step === 'scanning' ? styles.dropzoneUploading : ''}`}
        >
          <input {...getInputProps()} />
          <div className={styles.dropzoneIcon}>📊</div>
          {step === 'scanning' ? (
            <div className={styles.dropzoneContent}>
              <p className={styles.dropzoneTitle}>🔍 Scanning file for floors…</p>
            </div>
          ) : isDragActive ? (
            <div className={styles.dropzoneContent}>
              <p className={styles.dropzoneTitle}>{t('dropFileHere')}</p>
            </div>
          ) : (
            <div className={styles.dropzoneContent}>
              <p className={styles.dropzoneTitle}>{t('dragDropHere')}</p>
              <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0' }}>
                {quarter ? '→ File will be scanned to detect floors automatically' : '⚠ Select a quarter first'}
              </p>
              <p className={styles.dropzoneSeparator}>{t('or')}</p>
              <button className={styles.browseButton} style={{ background: tab.btnColor }}>
                {t('browseFiles')}
              </button>
              <p className={styles.acceptedFormats}>{t('acceptedFormats')}: Excel (.xlsx, .xls)</p>
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: Floors detected → device-days + new targets ── */}
      {(step === 'floors-ready' || step === 'processing') && (
        <div>
          {/* File detected banner */}
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10,
                        padding: '10px 14px', marginBottom: 16, fontSize: 13,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>📄 <strong>{droppedFile?.name}</strong> — {floors.length} floor{floors.length !== 1 ? 's' : ''} detected</span>
            <button
              onClick={reset}
              style={{ background: 'none', border: '1px solid #6b7280', borderRadius: 6,
                       padding: '3px 10px', cursor: 'pointer', fontSize: 12 }}
              disabled={step === 'processing'}
            >
              Change file
            </button>
          </div>

          {/* Device days inputs */}
          <div className={styles.inputSection}>
            <label className={styles.inputLabel}>🏥 {t(tab.daysKey)}</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
              {floors.map(floor => (
                <div key={floor}>
                  <label style={{ fontSize: 13, fontWeight: 600 }}>{floor}</label>
                  <input
                    type="number" min="0" step="1"
                    value={denominators[floor] ?? ''}
                    onChange={e => {
                      const raw = e.target.value.replace(/[^0-9]/g, '');
                      setDenominators(prev => ({ ...prev, [floor]: raw }));
                    }}
                    onWheel={e => e.target.blur()}
                    onKeyDown={e => { if (['e', 'E', '+', '-', '.'].includes(e.key)) e.preventDefault(); }}
                    style={inputStyle}
                    disabled={step === 'processing'}
                    placeholder={t('enterDays')}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* New floor targets (only for floors not yet in config) */}
          {missingFloors.length > 0 && (
            <div className={styles.inputSection}>
              <label className={styles.inputLabel}>
                🎯 New floors detected — enter target rate (‰) for each
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                {missingFloors.map(floor => (
                  <div key={floor}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#b45309' }}>
                      ⚠ {floor} (new)
                    </label>
                    <input
                      type="number" min="0" step="0.1"
                      value={newTargets[floor] ?? ''}
                      onChange={e => setNewTargets(prev => ({ ...prev, [floor]: e.target.value }))}
                      onWheel={e => e.target.blur()}
                      style={{ ...inputStyle, borderColor: '#fbbf24' }}
                      disabled={step === 'processing'}
                      placeholder="e.g. 10.0"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Process button / progress */}
          {step === 'processing' ? (
            <div className={styles.uploadProgress} style={{ marginTop: 16 }}>
              <div className={styles.progressTitle}>{t('processing')}</div>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${progress}%` }} />
              </div>
              <div className={styles.progressText}>{progress}%</div>
            </div>
          ) : (
            <button
              onClick={handleProcess}
              style={{
                width: '100%', marginTop: 16, padding: '12px 0',
                background: tab.btnColor, color: '#fff', border: 'none',
                borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer',
              }}
            >
              ⚙ Process Data
            </button>
          )}
        </div>
      )}

      {/* ── Done ── */}
      {step === 'done' && (
        <div className={`${styles.alert} ${styles.alertSuccess}`}>
          ✅ {t('dataProcessedSuccessfully')}
        </div>
      )}

      {error && <div className={`${styles.alert} ${styles.alertError}`}>❌ {error}</div>}
    </div>
  );
}

function InfectionControlUpload({ language, defaultTab = 'vap' }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const [activeTab, setActiveTab] = useState(defaultTab);

  const currentTab = TABS.find(tb => tb.key === activeTab);

  const tabLabels = {
    vap:    { ar: 'ذات الرئة', en: 'VAP' },
    clabsi: { ar: 'عدوى الدم', en: 'CLABSI' },
    cauti:  { ar: 'عدوى البول', en: 'CAUTI' },
  };

  return (
    <div className={styles.uploadContainer}>
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

      <div style={{
        display: 'flex', gap: '0.5rem',
        padding: '1rem 1.5rem 0',
        borderBottom: '2px solid #e5e7eb',
        background: '#fff',
      }}>
        {TABS.map(tb => (
          <button
            key={tb.key}
            onClick={() => setActiveTab(tb.key)}
            style={{
              padding: '0.6rem 1.5rem', border: 'none',
              borderBottom: activeTab === tb.key ? '3px solid #0f766e' : '3px solid transparent',
              background: 'none',
              fontWeight: activeTab === tb.key ? 700 : 500,
              color: activeTab === tb.key ? '#0f766e' : '#64748b',
              cursor: 'pointer', fontSize: '0.95rem', transition: 'all 0.2s',
            }}
          >
            {tb.icon} {ar ? tabLabels[tb.key].ar : tabLabels[tb.key].en}
          </button>
        ))}
      </div>

      <UploadForm key={activeTab} tab={currentTab} />
    </div>
  );
}

export default InfectionControlUpload;
