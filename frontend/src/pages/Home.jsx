import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from '../styles/Home.module.css';

function Home({ language }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const ar = i18n.language === 'ar';

  return (
    <div className={styles.homeContainer}>
      {/* Hero Header */}
      <div className={styles.hero}>
        <div className={styles.heroIcon}>
          <img src="/LOGO_ICON.png" alt="logo" style={{ width: '110px', height: '110px', objectFit: 'contain' }} />
        </div>
        <h1 className={styles.heroTitle}>
          {t('homeTitle')}
        </h1>
        <p className={styles.heroSubtitle}>
          {t('homeSubtitle')}
        </p>
      </div>

      {/* System Cards */}
      <div className={styles.cardsGrid}>

        {/* Mortality Card */}
        <button
          className={`${styles.systemCard} ${styles.mortalityCard}`}
          onClick={() => navigate('/mortality/dashboard')}
        >
          <div className={styles.cardGlow} />
          <div className={styles.cardIcon}>🏥</div>
          <h2 className={styles.cardTitle}>
            {t('mortalityCardTitle')}
          </h2>
          <p className={styles.cardDescription}>
            {t('mortalityCardDesc')}
          </p>
          <div className={styles.cardFeatures}>
            <span className={styles.feature}>📊 {t('featureDashboard')}</span>
            <span className={styles.feature}>📈 {t('featureAnalysis')}</span>
            <span className={styles.feature}>📄 {t('featureReports')}</span>
          </div>
          <div className={styles.cardCta}>
            <span>{t('getStarted')}</span>
            <span className={styles.ctaArrow}>{ar ? t('ctaArrowAr') : t('ctaArrowEn')}</span>
          </div>
        </button>

        {/* Medication Error Card */}
        <button
          className={`${styles.systemCard} ${styles.medicationCard}`}
          onClick={() => navigate('/medication/dashboard')}
        >
          <div className={styles.cardGlow} />
          <div className={styles.cardIcon}>💊</div>
          <h2 className={styles.cardTitle}>
            {t('medicationCardTitle')}
          </h2>
          <p className={styles.cardDescription}>
            {t('medicationCardDesc')}
          </p>
          <div className={styles.cardFeatures}>
            <span className={styles.feature}>📊 {t('featureDashboard')}</span>
            <span className={styles.feature}>📉 {t('featureErrorRate')}</span>
            <span className={styles.feature}>📄 {t('featureReports')}</span>
          </div>
          <div className={styles.cardCta}>
            <span>{t('getStarted')}</span>
            <span className={styles.ctaArrow}>{ar ? t('ctaArrowAr') : t('ctaArrowEn')}</span>
          </div>
        </button>

        {/* Infection Control Card */}
        <div className={`${styles.systemCard} ${styles.infectionCard}`}>
          <div className={styles.cardGlow} />
          <div className={styles.cardIcon}>🦠</div>
          <h2 className={styles.cardTitle}>
            {t('infectionCardTitle')}
          </h2>
          <p className={styles.cardDescription}>
            {t('infectionCardDesc')}
          </p>
          <div className={styles.cardFeatures}>
            <button
              className={styles.indicatorBtn}
              onClick={() => navigate('/vap/dashboard')}
            >
              🫁 VAP
            </button>
            <button
              className={styles.indicatorBtn}
              onClick={() => navigate('/clabsi/dashboard')}
            >
              🩸 CLABSI
            </button>
            <button
              className={styles.indicatorBtn}
              onClick={() => navigate('/cauti/dashboard')}
            >
              🧫 CAUTI
            </button>
          </div>
        </div>

      </div>

      {/* Footer note */}
      <p className={styles.homeNote}>
        {t('homeNote')}
      </p>
    </div>
  );
}

export default Home;
