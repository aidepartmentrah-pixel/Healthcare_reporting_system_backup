import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import styles from '../../styles/Upload.module.css';
import { API_URL } from '../../config/api';

function Upload({ onDataLoaded }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [fileName, setFileName] = useState('');
  const [totalPatients, setTotalPatients] = useState('');
  const [quarter, setQuarter] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());

  const quarters = [
    { value: 'الفصل الأول', label: 'الفصل الأول / Q1' },
    { value: 'الفصل الثاني', label: 'الفصل الثاني / Q2' },
    { value: 'الفصل الثالث', label: 'الفصل الثالث / Q3' },
    { value: 'الفصل الرابع', label: 'الفصل الرابع / Q4' },
  ];

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Validate required fields
    if (!quarter) {
      setError(t('selectQuarter', 'يرجى اختيار الفصل / Please select a quarter'));
      return;
    }
    if (!totalPatients || parseInt(totalPatients) <= 0) {
      setError(t('enterTotalPatients', 'يرجى إدخال عدد المرضى الإجمالي / Please enter total patients'));
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
    formData.append('total_patients', parseInt(totalPatients));

    try {
      const response = await axios.post(`${API_URL}/process-data`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProgress(percentCompleted);
        }
      });

      console.log('✅ Upload successful:', response.data);

      // Store data in parent component
      onDataLoaded({
      ...response.data.data,
      totalPatients: parseInt(totalPatients),
      quarter,
      year,
    });

      setSuccess(true);
      setUploading(false);

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        navigate('/mortality/dashboard');
      }, 2000);

    } catch (err) {
      console.error('❌ Upload error:', err);
      setError(err.response?.data?.detail || 'حدث خطأ أثناء رفع الملف / Upload error occurred');
      setUploading(false);
      setProgress(0);
    }
  }, [onDataLoaded, navigate, totalPatients, quarter, year, t]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false,
    disabled: uploading
  });

  return (
    <div className={styles.uploadContainer}>
      {/* Header Card */}
      <div className={styles.uploadHeader}>
        <div className={styles.headerContent}>
          <div className={styles.headerIcon}>📤</div>
          <div className={styles.headerText}>
            <h2>{t('uploadTitle')}</h2>
            <p>{t('dragDropOrBrowse')}</p>
          </div>
        </div>
      </div>

      <div className={styles.uploadCard}>
        {/* Quarter & Year Selection */}
        <div className={styles.inputSection}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label className={styles.inputLabel}>
                <span className={styles.inputIcon}>📅</span>
                <span>{t('quarterLabel', 'الفصل / Quarter')}</span>
              </label>
              <select
                value={quarter}
                onChange={(e) => setQuarter(e.target.value)}
                className={styles.inputField}
                disabled={uploading}
              >
                <option value="">{t('selectQuarterPlaceholder', '-- اختر الفصل / Select Quarter --')}</option>
                {quarters.map(q => (
                  <option key={q.value} value={q.value}>{q.label}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label className={styles.inputLabel}>
                <span className={styles.inputIcon}>📆</span>
                <span>{t('yearLabel', 'السنة / Year')}</span>
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

        {/* Total Patients Input */}
        <div className={styles.inputSection}>
          <label className={styles.inputLabel}>
            <span className={styles.inputIcon}>👥</span>
            <span>
              {t('totalPatientsLabel', 'إجمالي المرضى المدخلين / Total Patients Admitted')}
            </span>
          </label>
          <input
            type="number"
            min="1"
            placeholder={t('totalPatientsPlaceholder', 'أدخل عدد المرضى الإجمالي / Enter total patients')}
            value={totalPatients}
            onChange={(e) => setTotalPatients(e.target.value)}
            onWheel={(e) => e.target.blur()}
            className={styles.inputField}
            disabled={uploading}
          />
        </div>

        {/* Upload Area */}
        <div
          {...getRootProps()}
          className={`${styles.dropzone} ${
            isDragActive ? styles.dropzoneActive : ''
          } ${uploading ? styles.dropzoneUploading : ''}`}
        >
          <input {...getInputProps()} />

          <div className={styles.dropzoneIcon}>📊</div>

          {uploading ? (
            <div className={styles.uploadProgress}>
              <div className={styles.progressTitle}>
                {t('processing')}
              </div>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className={styles.progressText}>{progress}%</div>
              {fileName && <div className={styles.fileName}>{fileName}</div>}
            </div>
          ) : isDragActive ? (
            <div className={styles.dropzoneContent}>
              <p className={styles.dropzoneTitle}>{t('dropHere')}</p>
            </div>
          ) : (
            <div className={styles.dropzoneContent}>
              <p className={styles.dropzoneTitle}>{t('dragDrop')}</p>
              <p className={styles.dropzoneSeparator}>{t('or')}</p>
              <button className={styles.browseButton}>
                {t('browse')}
              </button>
              <p className={styles.acceptedFormats}>
                {t('acceptedFormats')}: Excel (.xlsx, .xls)
              </p>
            </div>
          )}
        </div>

        {/* Error Message */}
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

        {/* Success Message */}
        {success && (
          <div className={`${styles.alert} ${styles.alertSuccess}`}>
            <div className={styles.alertContent}>
              <div className={styles.alertIcon}>✅</div>
              <div className={styles.alertText}>
                <p className={styles.alertTitle}>{t('success')}</p>
                <p className={styles.alertDescription}>{t('dataProcessedSuccessfully')}</p>
                <p className={styles.alertSubtext}>
                  <span className={styles.redirectSpinner}>⏳</span>
                  {t('redirectingToDashboard')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className={styles.instructions}>
          <div className={styles.instructionsHeader}>
            <div className={styles.instructionsIcon}>💡</div>
            <h3 className={styles.instructionsTitle}>
              {t('instructions')}
            </h3>
          </div>
          <div className={styles.instructionsList}>
            <div className={styles.instructionItem}>
              <div className={styles.instructionNumber}>1</div>
              <p className={styles.instructionText}>
                {t('instruction1SelectQuarter', 'اختر الفصل والسنة وأدخل عدد المرضى / Select quarter, year and enter total patients')}
              </p>
            </div>
            <div className={styles.instructionItem}>
              <div className={styles.instructionNumber}>2</div>
              <p className={styles.instructionText}>{t('instruction1')}</p>
            </div>
            <div className={styles.instructionItem}>
              <div className={styles.instructionNumber}>3</div>
              <p className={styles.instructionText}>{t('instruction3')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Upload;
