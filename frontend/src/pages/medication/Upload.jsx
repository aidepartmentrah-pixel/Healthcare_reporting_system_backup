import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import styles from '../../styles/Upload.module.css';
import { API_MEDICATION as API_URL } from '../../config/api';

const quarters = [
  { value: 'الفصل الأول', label: 'الفصل الأول / Q1' },
  { value: 'الفصل الثاني', label: 'الفصل الثاني / Q2' },
  { value: 'الفصل الثالث', label: 'الفصل الثالث / Q3' },
  { value: 'الفصل الرابع', label: 'الفصل الرابع / Q4' },
];

function MedicationUpload({ language, onDataLoaded }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const ar = i18n.language === 'ar';

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [fileName, setFileName] = useState('');
  const [quarter, setQuarter] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [totalDoses, setTotalDoses] = useState('');

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (!quarter) {
      setError(t('selectQuarterError'));
      return;
    }
    if (!totalDoses || parseInt(totalDoses) <= 0) {
      setError(t('enterTotalDosesError'));
      return;
    }

    setFileName(file.name);
    setUploading(true);
    setError(null);
    setSuccess(false);
    setProgress(0);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('quarter', quarter);
    formData.append('year', year);
    if (totalDoses && parseInt(totalDoses) > 0) {
      formData.append('total_doses', parseInt(totalDoses));
    }

    try {
      const res = await axios.post(`${API_URL}/process-data`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          setProgress(Math.round((e.loaded * 100) / e.total));
        },
      });

      if (onDataLoaded && res.data?.data) {
        onDataLoaded({
          quarter:    res.data.data.quarter,
          year:       res.data.data.year,
          statistics: res.data.data.statistics,
          records:    res.data.data.records,
          total_records: res.data.data.total_records,
        });
      }

      setSuccess(true);
      setUploading(false);
      setTimeout(() => navigate('/medication/dashboard'), 2000);
    } catch (err) {
      setError(err.response?.data?.detail || t('uploadError'));
      setUploading(false);
      setProgress(0);
    }
  }, [navigate, quarter, year, totalDoses, t, onDataLoaded]);

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
    <div className={styles.uploadContainer}>
      {/* Header */}
      <div className={styles.uploadHeader} style={{ background: 'linear-gradient(135deg, #0d9488 0%, #0891b2 50%, #0e7490 100%)' }}>
        <div className={styles.headerContent}>
          <div className={styles.headerIcon}>💊</div>
          <div className={styles.headerText}>
            <h2>{t('medUploadTitle')}</h2>
            <p>{t('medUploadSubtitle')}</p>
          </div>
        </div>
      </div>

      <div className={styles.uploadCard}>
        {/* Quarter & Year */}
        <div className={styles.inputSection}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label className={styles.inputLabel}>
                <span className={styles.inputIcon}>📅</span>
                <span>{t('quarterSlashLabel')}</span>
              </label>
              <select
                value={quarter}
                onChange={(e) => setQuarter(e.target.value)}
                className={styles.inputField}
                disabled={uploading}
              >
                <option value="">{t('selectQuarterShortDash')}</option>
                {quarters.map((q) => (
                  <option key={q.value} value={q.value}>{q.label}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label className={styles.inputLabel}>
                <span className={styles.inputIcon}>📆</span>
                <span>{t('yearSlashLabel')}</span>
              </label>
              <input
                type="number"
                min="2020"
                max={new Date().getFullYear()}
                value={year}
                onChange={(e) => setYear(e.target.value)}
                onWheel={(e) => e.target.blur()}
                className={styles.inputField}
                disabled={uploading}
              />
            </div>
          </div>
        </div>

        {/* Total Doses */}
        <div className={styles.inputSection}>
          <label className={styles.inputLabel}>
            <span className={styles.inputIcon}>💉</span>
            <span>{t('totalDosesLabel')}</span>
          </label>
          <input
            type="number"
            min="1"
            placeholder={t('totalDosesPlaceholder')}
            value={totalDoses}
            onChange={(e) => setTotalDoses(e.target.value)}
            onWheel={(e) => e.target.blur()}
            className={styles.inputField}
            disabled={uploading}
          />
          <p className={styles.inputHint}>
            {t('totalDosesHint')}
          </p>
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
              <div className={styles.progressTitle}>{t('processingEllipsis')}</div>
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
              <button className={styles.browseButton} style={{ background: 'linear-gradient(135deg, #0d9488 0%, #0891b2 100%)' }}>
                {t('browseFiles')}
              </button>
              <p className={styles.acceptedFormats}>{t('acceptedFormats')}: Excel (.xlsx, .xls)</p>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className={`${styles.alert} ${styles.alertError}`}>
            <div className={styles.alertContent}>
              <div className={styles.alertIcon}>❌</div>
              <div className={styles.alertText}>
                <p className={styles.alertTitle}>{t('error')}</p>
                <p className={styles.alertDescription}>{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className={`${styles.alert} ${styles.alertSuccess}`}>
            <div className={styles.alertContent}>
              <div className={styles.alertIcon}>✅</div>
              <div className={styles.alertText}>
                <p className={styles.alertTitle}>{t('successTitle')}</p>
                <p className={styles.alertDescription}>{t('dataProcessedSuccessfully')}</p>
                <p className={styles.alertSubtext}>
                  <span className={styles.redirectSpinner}>⏳</span>
                  {t('redirectingToDashboardEllipsis')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className={styles.instructions} style={{ background: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 50%, #cffafe 100%)', borderColor: '#5eead4' }}>
          <div className={styles.instructionsHeader}>
            <div className={styles.instructionsIcon} style={{ background: 'linear-gradient(135deg, #0d9488 0%, #0891b2 100%)' }}>💡</div>
            <h3 className={styles.instructionsTitle} style={{ color: '#0f766e' }}>
              {t('instructionsTitle')}
            </h3>
          </div>
          <div className={styles.instructionsList}>
            {[
              t('medInstruction1'),
              t('medInstruction2'),
              t('medInstruction3'),
              t('medInstruction4'),
            ].map((text, i) => (
              <div key={i} className={styles.instructionItem}>
                <div className={styles.instructionNumber}>{i + 1}</div>
                <p className={styles.instructionText}>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MedicationUpload;
