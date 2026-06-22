import { useTranslation } from 'react-i18next';

/**
 * Reusable quarter selector shown on public dashboards.
 *
 * Props:
 *   quarters   — array of { quarter, year } objects (oldest → newest)
 *   selected   — { quarter, year } currently selected, or null for latest
 *   onChange   — called with { quarter, year } or null (for latest)
 *   loading    — bool, disables while fetching
 */
export default function QuarterSelector({ quarters = [], selected, onChange, loading = false }) {
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';

  if (!quarters.length) return null;

  // Latest = last item in the sorted array
  const latest = quarters[quarters.length - 1];

  const isLatest = !selected ||
    (selected.quarter === latest.quarter && selected.year === latest.year);

  const selectedKey = isLatest
    ? '__latest__'
    : `${selected.quarter}__${selected.year}`;

  function handleChange(e) {
    const val = e.target.value;
    if (val === '__latest__') {
      onChange(null);
    } else {
      const [quarter, year] = val.split('__');
      onChange({ quarter, year });
    }
  }

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      background: '#fff',
      border: '1.5px solid #e2e8f0',
      borderRadius: '10px',
      padding: '0.4rem 0.75rem',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      direction: ar ? 'rtl' : 'ltr',
    }}>
      <span style={{ fontSize: '1rem' }}>📅</span>
      <select
        value={selectedKey}
        onChange={handleChange}
        disabled={loading}
        style={{
          border: 'none',
          outline: 'none',
          fontSize: '0.875rem',
          fontWeight: 600,
          color: '#1e293b',
          background: 'transparent',
          cursor: loading ? 'not-allowed' : 'pointer',
          direction: ar ? 'rtl' : 'ltr',
        }}
      >
        {/* Newest → oldest in the dropdown */}
        {[...quarters].reverse().map(({ quarter, year }) => {
          const key = `${quarter}__${year}`;
          const isLatestItem = quarter === latest.quarter && year === latest.year;
          return (
            <option key={key} value={key}>
              {quarter} {year}{isLatestItem ? (ar ? ' (الأحدث)' : ' (Latest)') : ''}
            </option>
          );
        })}
      </select>
      {loading && (
        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
          {ar ? 'جاري التحميل...' : 'Loading...'}
        </span>
      )}
    </div>
  );
}
