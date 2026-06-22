import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "../../../styles/Dashboard.module.css";
import DashboardSearch from '../../../components/DashboardSearch';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
} from "recharts";
import { API_CAUTI as API_URL } from '../../../config/api';

const GREEN  = "#16a34a";
const RED    = "#dc2626";
const AMBER  = "#f59e0b";
const ORANGE = "#ea580c";
const BORDER = "#e5e7eb";
const SLATE  = "#64748b";

const RISK_COLS = [
  'diabetic','hypertension','dyslipidemia','heart_disease','kidney_disease',
  'copd','smoker','obesity','cardiac_congenital_malformation','advanced_age',
  'length_of_stay','duration_of_catheter',
  'cancer','compromised_immune_system','respiratory_pb',
  'site_of_catheter_femoral',
  'prematurity','neonates','infant','total_parenteral_nutrition',
  'consciousness','head_trauma','burns','malnutrition',
  'prolonged_antibiotic_exposure','reintubation_recatheterization','tracheostomy',
];
const RISK_LABELS_EN = {
  diabetic:'Diabetic', hypertension:'Hypertension', dyslipidemia:'Dyslipidemia',
  heart_disease:'Heart Disease', kidney_disease:'Kidney Disease', copd:'COPD',
  smoker:'Smoker', obesity:'Obesity', cardiac_congenital_malformation:'Cardiac Congenital Malformation',
  advanced_age:'Advanced Age', length_of_stay:'Length of Stay',
  duration_of_catheter:'Duration of Catheter', cancer:'Cancer',
  compromised_immune_system:'Compromised Immune System', respiratory_pb:'Respiratory Problem',
  site_of_catheter_femoral:'Site of Catheter (Femoral)',
  prematurity:'Prematurity', neonates:'Neonates', infant:'Infant',
  total_parenteral_nutrition:'Total Parenteral Nutrition (TPN)',
  consciousness:'Consciousness', head_trauma:'Head Trauma', burns:'Burns',
  malnutrition:'Malnutrition', prolonged_antibiotic_exposure:'Prolonged Antibiotic Exposure',
  reintubation_recatheterization:'Reintubation / Recatheterization', tracheostomy:'Tracheostomy',
};
const getRiskFactors = c =>
  RISK_COLS.filter(k => c[k] === true || c[k] === 'Yes' || c[k] === 'yes')
           .map(k => RISK_LABELS_EN[k]).join(', ') || '—';
const fmtNum = v => v == null ? '—' : String(v).replace(/\.0+$/, '');

const TS = {
  contentStyle: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "10px 14px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
    fontSize: "12px",
  },
};

const thStyle = {
  padding: "12px 10px",
  textAlign: "left",
  fontWeight: 600,
  color: "#334155",
  borderBottom: "1px solid #e2e8f0",
};

const tdStyle = {
  padding: "10px",
  borderBottom: "1px solid #e2e8f0",
};

const QUARTER_KEY_MAP = {
  "الفصل الأول":  "quarterFirst",
  "الفصل الاول":  "quarterFirst",
  "الفصل الثاني": "quarterSecond",
  "الفصل الثالث": "quarterThird",
  "الفصل الرابع": "quarterFourth",
};

function qLabel(q, y, t) {
  const key   = QUARTER_KEY_MAP[q];
  const label = key ? t(key) : q;
  return `${label} ${y}`;
}

const shortQ = (quarter) => {
  const map = {
    "الفصل الأول": "Q1", "الفصل الاول": "Q1",
    "الفصل الثاني": "Q2",
    "الفصل الثالث": "Q3",
    "الفصل الرابع": "Q4",
  };
  return map[quarter] || quarter;
};

/* ── Semicircle Gauge ── */
function DepartmentGauge({ name, rate, target }) {
  const { t } = useTranslation();
  const MAX     = Math.max(rate * 1.5, target * 2, 5);
  const ratePct = Math.min(rate, MAX) / MAX;
  const tgtPct  = Math.min(target, MAX) / MAX;
  const isAbove = rate > target;

  const arc = (pct, radius) => {
    const angle = Math.PI * pct;
    const x = 100 - radius * Math.cos(angle);
    const y = 100 - radius * Math.sin(angle);
    return `M ${100 - radius} 100 A ${radius} ${radius} 0 0 1 ${x} ${y}`;
  };

  return (
    <div style={{ background: "white", borderRadius: 20, padding: 24, boxShadow: "0 8px 25px rgba(0,0,0,0.05)", textAlign: "center" }}>
      <h3 style={{ marginBottom: 12 }}>{name}</h3>
      <svg viewBox="0 0 200 115" width="100%" style={{ maxWidth: 280 }}>
        <path d={arc(1, 70)} fill="none" stroke={BORDER} strokeWidth="16" strokeLinecap="round" />
        <path d={arc(ratePct, 70)} fill="none" stroke={isAbove ? RED : GREEN} strokeWidth="14" strokeLinecap="round" />
        <line
          x1={100 - 62 * Math.cos(Math.PI * tgtPct)} y1={100 - 62 * Math.sin(Math.PI * tgtPct)}
          x2={100 - 80 * Math.cos(Math.PI * tgtPct)} y2={100 - 80 * Math.sin(Math.PI * tgtPct)}
          stroke={AMBER} strokeWidth="4" strokeLinecap="round"
        />
        <text x="100" y="82" textAnchor="middle" fontSize="22" fontWeight="800" fill={isAbove ? RED : GREEN}>
          {rate.toFixed(2)}‰
        </text>
        <text x="100" y="14" textAnchor="middle" fontSize="10" fontWeight="600" fill="#92400e">
          {t("vapTarget")} {target}‰
        </text>
      </svg>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: isAbove ? "#fef2f2" : "#f0fdf4", color: isAbove ? RED : GREEN, borderRadius: 20, padding: "5px 16px", fontSize: 12, fontWeight: 700, marginTop: 6 }}>
        {isAbove ? t("vapAboveTarget") : t("vapBelowTarget")}
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 16, fontSize: 12, color: SLATE }}>
        {[
          { label: "Result",                            value: `${rate.toFixed(2)}‰`, color: isAbove ? RED : GREEN },
          { label: t("vapTargetLabel"),                       value: `${target}‰`,          color: AMBER },
          { label: isAbove ? t("vapOver") : t("vapUnder"),   value: `${Math.abs(rate - target).toFixed(2)}‰`, color: isAbove ? RED : GREEN },
        ].map((item, i, arr) => (
          <React.Fragment key={item.label}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: item.color }}>{item.value}</div>
              <div style={{ marginTop: 2 }}>{item.label}</div>
            </div>
            {i < arr.length - 1 && <div style={{ width: 1, background: BORDER }} />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/* ── Dashboard ── */
function CautiDashboard({ selectedQuarter }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const [history,     setHistory]     = useState([]);
  const [currentData, setCurrentData] = useState(null);
  const [targets,     setTargets]     = useState({});
  const [casesData,   setCasesData]   = useState(null);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/history`).then(r => r.json()),
      fetch(`${API_URL}/targets`).then(r => r.json()),
      fetch(`${API_URL}/current`).then(r => r.json()),
    ])
      .then(([hist, tgts, cur]) => {
        if (Array.isArray(hist) && hist.length > 0) setHistory(hist);
        setTargets(tgts);
        setCurrentData(cur);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedQuarter) return;
    const QUARTER_AR = { '1': 'الفصل الاول', '2': 'الفصل الثاني', '3': 'الفصل الثالث', '4': 'الفصل الرابع' };
    const q = QUARTER_AR[String(selectedQuarter.quarter)] || selectedQuarter.quarter;
    setCasesData(null);
    fetch(`${API_URL}/cases?quarter=${encodeURIComponent(q)}&year=${selectedQuarter.year}`)
      .then(r => r.json())
      .then(data => setCasesData(data))
      .catch(() => {});
  }, [selectedQuarter?.quarter, selectedQuarter?.year]);

  if (loading) return <div className={styles.emptyState}>{t("cautiLoadingText")}</div>;

  const latestHistory = selectedQuarter
    ? (history.find(h => h.quarter === selectedQuarter.quarter && String(h.year) === String(selectedQuarter.year)) || history[history.length - 1])
    : (currentData?.quarter && currentData?.year)
      ? (history.find(h => h.quarter === currentData.quarter && String(h.year) === String(currentData.year)) || history[history.length - 1])
      : history[history.length - 1];
  if (!latestHistory?.summary) {
    return (
      <div className={styles.emptyState}>
        <h2>{t("cautiNoData")}</h2>
        <p>{t("cautiNoDataDesc")}</p>
      </div>
    );
  }

  const normalize = g => g?.toLowerCase().trim();

  const activeFloors    = Object.keys(targets).filter(dept =>
    history.some(q => (q.summary?.[dept]?.cases || 0) > 0)
  );
  const noTargetFloors = (() => {
    const all = new Set();
    history.forEach(q => Object.keys(q.summary || {}).forEach(dept => {
      if ((q.summary[dept]?.cases || 0) > 0) all.add(dept);
    }));
    return [...all].filter(dept => !targets[dept]);
  })();
  const displayHistory  = history.slice(-4);
  const summaryHistory  = history.slice(-6);

  return (
    <div className={styles.dashboard} dir="ltr">

      {/* ── Page Header ── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{t("cautiDashboardTitle")}</h1>
          <p className={styles.pageSubtitle}>{t("cautiDashboardSubtitle")}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#c2410c", background: "#ffedd5", padding: "6px 14px", borderRadius: 10 }}>
            {qLabel(latestHistory.quarter, latestHistory.year, t)}
          </div>
          <div style={{ fontSize: 11, color: SLATE, marginTop: 4 }}>{t("currentQuarter")}</div>
        </div>
      </div>

      {/* ── Section Search ── */}
      <DashboardSearch sections={[
        { id: 'cauti-performance',      ar: 'ملخص الأداء الفصلي لـ CAUTI',    en: 'CAUTI Quarterly Performance Summary' },
        { id: 'cauti-floor-comparison', ar: 'مقارنة معدلات الأقسام',           en: 'Floor Rate Comparison' },
        ...activeFloors.map(dept => ({ id: `cauti-dept-${dept}`, ar: `تفاصيل الحالات — ${dept}`, en: `Detailed Cases — ${dept}` })),
      ]} />

      {/* ── Quarterly Performance Table ── */}
      <div id="cauti-performance" style={{ background: "#ffffff", borderRadius: "14px", boxShadow: "0 6px 18px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div style={{ padding: "1rem 1.5rem", background: "linear-gradient(to right, #ffedd5, #ffffff)", borderBottom: "1px solid #e2e8f0" }}>
          <h3 style={{ margin: 0, color: "#7c2d12" }}>{t("cautiQuarterlyPerformance")}</h3>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", tableLayout: "fixed" }}>
            <thead style={{ background: "#f1f5f9" }}>
              <tr>
                <th style={thStyle}>{t("clabsiDeptTarget")}</th>
                {summaryHistory.map((q, i) => (
                  <th key={i} style={thStyle}>{qLabel(q.quarter, q.year, t)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeFloors.map((dept, rowIndex) => (
                <tr key={dept} style={{ background: rowIndex % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                  <td style={{ ...tdStyle, fontWeight: 600, color: "#1e293b", minWidth: 50 }}>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span>{dept}</span>
                      <span style={{ fontSize: "12px", color: "#64748b", marginTop: 2 }}>
                        {t("clabsiTargetLabel")} {targets[dept]}‰
                      </span>
                      <span style={{ fontSize: "12px", marginTop: 4, fontWeight: 600, color: latestHistory.summary?.[dept]?.rate > targets[dept] ? RED : GREEN }}>
                        {t("clabsiLatestLabel")} {latestHistory.summary?.[dept]?.rate ?? "—"}‰
                      </span>
                    </div>
                  </td>
                  {summaryHistory.map((q, colIndex) => {
                    const summary  = q.summary?.[dept];
                    const cases    = summary?.cases ?? null;
                    const days     = summary?.urinary_catheter_days ?? null;
                    const rate     = summary?.rate ?? null;
                    const isAbove  = rate !== null && rate > targets[dept];
                    const prevRate = colIndex > 0 ? summaryHistory[colIndex - 1].summary?.[dept]?.rate ?? null : null;
                    const trend    = prevRate !== null && rate !== null
                      ? (rate > prevRate ? " ↑" : rate < prevRate ? " ↓" : "")
                      : "";
                    return (
                      <td key={colIndex} style={{ ...tdStyle, textAlign: "center", background: isAbove ? "#fee2e2" : "transparent", color: isAbove ? "#b91c1c" : "#0f172a" }}>
                        {rate !== null ? (
                          <>
                            <div style={{ fontSize: 13 }}>
                              <span style={{ fontWeight: 700 }}>{cases ?? "—"}</span>
                              <span style={{ color: "#64748b" }}> / {days ?? "—"}</span>
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>{rate}‰{trend}</div>
                          </>
                        ) : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {noTargetFloors.map((dept) => (
                <tr key={`nt-${dept}`} style={{ background: "#fffbeb" }}>
                  <td style={{ ...tdStyle, fontWeight: 600, color: "#92400e", minWidth: 50 }}>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span>{dept}</span>
                      <span style={{ fontSize: "12px", color: "#b45309", marginTop: 2 }}>
                        {t('noTargetDefined')}
                      </span>
                    </div>
                  </td>
                  {summaryHistory.map((q, colIndex) => {
                    const cases = q.summary?.[dept]?.cases ?? null;
                    return (
                      <td key={colIndex} style={{ ...tdStyle, textAlign: "center", background: "#fffbeb" }}>
                        {cases != null
                          ? <div style={{ fontWeight: 700, color: "#92400e" }}>{cases}</div>
                          : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}

              <tr style={{ background: "#eff6ff", borderTop: "2px solid #bfdbfe" }}>
                <td style={{ ...tdStyle, fontWeight: 700, color: "#1e3a8a", minWidth: 50 }}>
                  {t('totalCasesRow')}
                </td>
                {summaryHistory.map((q, colIndex) => {
                  const total = Object.values(q.summary || {}).reduce((s, v) => s + (v.cases || 0), 0);
                  return (
                    <td key={colIndex} style={{ ...tdStyle, textAlign: "center", fontWeight: 800, color: "#1e3a8a" }}>
                      {total}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Floor Comparison Chart ── */}
      {activeFloors.length > 0 && (() => {
        const floorBarData = activeFloors
          .map(dept => ({
            floor:  dept,
            rate:   latestHistory.summary?.[dept]?.rate  ?? 0,
            target: targets[dept]                        ?? 0,
            cases:  latestHistory.summary?.[dept]?.cases ?? 0,
          }))
          .filter(d => d.cases > 0);
        if (floorBarData.length === 0) return null;
        const many        = floorBarData.length > 5;
        const chartHeight = Math.max(300, 260 + Math.max(0, floorBarData.length - 5) * 18);
        const xAxisHeight = many ? 70 : 30;
        const maxBarSize  = Math.min(52, Math.floor(560 / (floorBarData.length * 2 + 1)));

        const RateLabel = ({ x, y, width, index }) => {
          if (width < 18) return null;
          const d  = floorBarData[index] ?? {};
          const cx = x + width / 2;
          return (
            <g>
              <text x={cx} y={y - 46} textAnchor="middle" fontSize={10} fontWeight={700} fill="#1e293b">
                {Number(d.rate ?? 0).toFixed(1)}‰
              </text>
              <text x={cx} y={y - 33} textAnchor="middle" fontSize={9} fill="#64748b">
                ({d.cases ?? 0})
              </text>
              <text x={cx} y={y - 18} textAnchor="middle" fontSize={9} fill="#92400e" fontWeight={600}>
                Target: {d.target}‰
              </text>
            </g>
          );
        };

        return (
          <div id="cauti-floor-comparison" dir="ltr" style={{ background: "#ffffff", borderRadius: "14px",
                        boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
                        padding: "1.5rem", marginBottom: "2rem", marginTop: "2rem" }}>
            <h3 style={{ margin: "0 0 1rem", color: "#7c2d12" }}>
              {t('cautiDashboardTitle')} — {t('floorRateComparison')} ({qLabel(latestHistory.quarter, latestHistory.year, t)})
            </h3>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', top: 0, right: 0, zIndex: 1, display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start', background: 'rgba(255,255,255,0.92)', padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                {[
                  { label: 'Favorable', color: GREEN },
                  { label: 'Non Favorable', color: RED },
                  { label: t('vapTargetLabel'), color: '#92400e' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <div style={{ width: 12, height: 12, background: item.color, borderRadius: 2, flexShrink: 0 }} />
                    <span style={{ color: '#374151', fontWeight: 500 }}>{item.label}</span>
                  </div>
                ))}
              </div>
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart data={floorBarData}
                        margin={{ top: 64, right: 20, left: 0, bottom: 8 }}
                        barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="floor"
                       tick={{ fontSize: many ? 10 : 12, fontWeight: 600 }}
                       interval={0}
                       angle={many ? -35 : 0}
                       textAnchor={many ? "end" : "middle"}
                       height={xAxisHeight} />
                <YAxis tickFormatter={v => `${v}‰`} tick={{ fontSize: 11 }} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const rateRow   = payload.find(p => p.dataKey === 'rate');
                    const targetRow = payload.find(p => p.dataKey === 'target');
                    const cases     = rateRow?.payload?.cases ?? 0;
                    const isFavorable = (rateRow?.payload?.rate ?? 0) <= (rateRow?.payload?.target ?? 0);
                    const rateLabel = isFavorable ? 'Favorable' : 'Non Favorable';
                    const rateColor = isFavorable ? GREEN : RED;
                    return (
                      <div style={{ ...TS.contentStyle, minWidth: 170 }}>
                        <div style={{ fontWeight: 700, marginBottom: 6, color: '#1e293b' }}>{label}</div>
                        {rateRow && (
                          <div style={{ color: rateColor, marginBottom: 3 }}>
                            {rateLabel}: {Number(rateRow.value).toFixed(2)}‰
                            <span style={{ color: '#64748b', marginLeft: 6 }}>({cases} cases)</span>
                          </div>
                        )}
                        {targetRow && (
                          <div style={{ color: '#92400e' }}>
                            {t('vapTargetLabel')}: {targetRow.value}‰
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
                <Bar dataKey="rate" name={t('vapActualRate')}
                     radius={[6, 6, 0, 0]} maxBarSize={maxBarSize}>
                  {floorBarData.map(entry => (
                    <Cell key={entry.floor}
                          fill={entry.rate > entry.target ? RED : GREEN} />
                  ))}
                  <LabelList content={RateLabel} />
                </Bar>
                <Bar dataKey="target" name={t('vapTargetLabel')}
                     fill="#92400e" radius={[6, 6, 0, 0]}
                     maxBarSize={maxBarSize} />
              </BarChart>
            </ResponsiveContainer>
            </div>
          </div>
        );
      })()}

      {/* ── Department Blocks ── */}
      <div style={{ marginTop: "3rem" }}>
        {activeFloors.map((dept) => {
          const latestSummary = latestHistory.summary?.[dept];
          if (!latestSummary) return null;

          const trendData = displayHistory.map(q => ({
            label:  qLabel(q.quarter, q.year, t),
            rate:   q.summary?.[dept]?.rate || 0,
            target: targets[dept],
          }));

          /* Germ heatmap — uses casesData (selected Q) for the current extra column */
          const casesQSrc = casesData || currentData;
          const deptCasesForHeatmap = (casesQSrc?.cases || []).filter(c => c.floor === dept);
          const currentGerms = {};
          deptCasesForHeatmap.forEach(c => {
            const g = c.germs;
            if (g) currentGerms[g] = (currentGerms[g] || 0) + (c.nb_of_cases || 1);
          });
          const hasCurrentGerms = Object.keys(currentGerms).length > 0;

          const currentQKey = (hasCurrentGerms && casesQSrc)
            ? qLabel(casesQSrc.quarter, casesQSrc.year, t)
            : null;
          const histAllKeys = displayHistory.map(q => qLabel(q.quarter, q.year, t));
          const currentAlreadyInHistory = currentQKey && histAllKeys.includes(currentQKey);

          const heatmapQuarters = [
            ...displayHistory.map(q => ({
              key:   qLabel(q.quarter, q.year, t),
              germs: q.germs_distribution?.[dept] || {},
              cases: q.summary?.[dept]?.cases || 0,
            })),
            ...(hasCurrentGerms && !currentAlreadyInHistory ? [{
              key:   currentQKey,
              germs: currentGerms,
              cases: deptCasesForHeatmap.reduce((s, c) => s + (c.nb_of_cases || 1), 0),
            }] : []),
          ];

          const quarterKeys = heatmapQuarters.map(q => q.key);
          const selQLabel = selectedQuarter ? qLabel(selectedQuarter.quarter, selectedQuarter.year, t) : null;
          const latestQKey = (selQLabel && quarterKeys.includes(selQLabel))
            ? selQLabel
            : quarterKeys[quarterKeys.length - 1];

          const germMap = new Map();
          heatmapQuarters.forEach(q => {
            Object.keys(q.germs).forEach(g => {
              const k = normalize(g);
              if (!germMap.has(k)) germMap.set(k, g);
            });
          });

          const germData = Array.from(germMap.keys()).map(gk => {
            const row = { germ: germMap.get(gk), values: {} };
            heatmapQuarters.forEach(q => {
              let count = 0;
              Object.entries(q.germs).forEach(([g, n]) => { if (normalize(g) === gk) count += n; });
              row.values[q.key] = { count, percent: q.cases > 0 ? (count / q.cases) * 100 : 0 };
            });
            return row;
          });
          germData.sort((a, b) => (b.values[latestQKey]?.percent || 0) - (a.values[latestQKey]?.percent || 0));
          const topGerms   = germData.slice(0, 6);
          const maxPercent = Math.max(...topGerms.flatMap(r => quarterKeys.map(q => r.values[q]?.percent || 0)), 1);

          const getColor = (pct, qk) => {
            const n = pct / maxPercent;
            const s = { r: 254, g: 237, b: 213 };
            const e = { r: 124, g: 45,  b: 18  };
            let r = Math.round(s.r + (e.r - s.r) * n);
            let g = Math.round(s.g + (e.g - s.g) * n);
            let b = Math.round(s.b + (e.b - s.b) * n);
            if (qk === latestQKey) { r = Math.max(r - 15, 0); g = Math.max(g - 15, 0); b = Math.max(b - 15, 0); }
            return `rgb(${r},${g},${b})`;
          };
          const heatTextColor = (pct) => {
            const n = pct / maxPercent;
            const lum = 0.2126 * (254 + (124 - 254) * n) / 255
                      + 0.7152 * (237 + (45  - 237) * n) / 255
                      + 0.0722 * (213 + (18  - 213) * n) / 255;
            return lum < 0.45 ? '#fff' : '#1e293b';
          };

          return (
            <div key={dept} id={`cauti-dept-${dept}`} style={{ marginBottom: "4rem", background: "#ffffff", borderRadius: "16px", boxShadow: "0 6px 20px rgba(0,0,0,0.05)", padding: "2rem" }}>

              <h2 style={{ marginBottom: "2rem", color: "#7c2d12" }}>
                {dept} — {qLabel(latestHistory.quarter, latestHistory.year, t)}
              </h2>

              {/* Gauge + Trend */}
              <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "2rem", marginBottom: "2rem" }}>
                <DepartmentGauge name={dept} rate={latestSummary.rate} target={targets[dept]} />

                <div style={{ background: "white", borderRadius: 20, padding: 20, boxShadow: "0 8px 25px rgba(0,0,0,0.05)" }}>
                  <h3 style={{ marginBottom: 16 }}>
                    {t("cautiQuarterlyRateVsTarget")}
                    <span style={{ color: RED, fontWeight: 600 }}> ({targets[dept]}‰)</span>
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendData} margin={{ top: 30, right: 60, left: 40, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="label" interval={0} angle={-30} textAnchor="end" height={75} tick={{ fontSize: 9 }} padding={{ right: 30 }} />
                      <YAxis hide />
                      <Tooltip {...TS} formatter={(v, n) => [`${v.toFixed(2)}‰`, n]} />
                      <Legend verticalAlign="top" height={30} />
                      <Line type="monotone" dataKey="rate" name="Result" stroke={ORANGE} strokeWidth={2.5} dot={{ r: 4, fill: ORANGE }}
                        label={{ position: "top", fontSize: 10, fontWeight: 700, fill: ORANGE, formatter: v => `${v.toFixed(1)}‰` }} />
                      <Line type="monotone" dataKey="target" name={t("vapTargetLabel")} stroke="#92400e" strokeDasharray="6 3" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Germ Heatmap */}
              {topGerms.length > 0 && (
                <div style={{ marginBottom: "2rem" }}>
                  <h3 style={{ marginBottom: 16 }}>{t("germDistributionHeatmap")}</h3>
                  <div style={{ overflowX: "auto" }}>
                    <div style={{ display: "grid", gridTemplateColumns: `200px repeat(${quarterKeys.length}, 1fr)`, gap: 6 }}>
                      <div />
                      {quarterKeys.map(q => <div key={q} style={{ textAlign: "center", fontSize: 12 }}>{q}</div>)}
                      {topGerms.map(row => (
                        <React.Fragment key={row.germ}>
                          <div style={{ fontSize: 12 }}>{row.germ}</div>
                          {quarterKeys.map(q => {
                            const cell = row.values[q] || { count: 0, percent: 0 };
                            return (
                              <div key={q} style={{ background: getColor(cell.percent, q), borderRadius: 8, padding: 8, textAlign: "center", fontSize: 13, fontWeight: 700, color: heatTextColor(cell.percent) }}>
                                {cell.count}
                                <div style={{ fontSize: 12 }}>({cell.percent.toFixed(0)}%)</div>
                              </div>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Risk Factor Summary Table ── */}
              {(() => {
                const rfCases = (casesData?.cases || currentData?.cases || []).filter(c => c.floor === dept);
                if (!rfCases.length) return null;
                const total = rfCases.length;
                const rows = RISK_COLS
                  .map(k => ({ label: RISK_LABELS_EN[k], count: rfCases.filter(c => c[k] === true || c[k] === 'Yes' || c[k] === 'yes').length }))
                  .filter(r => r.count > 0)
                  .sort((a, b) => b.count - a.count);
                if (!rows.length) return null;
                const thS = { padding: '9px 10px', textAlign: 'start', fontWeight: 700, color: '#7c2d12', whiteSpace: 'nowrap', borderBottom: '2px solid #fed7aa', background: '#ffedd5' };
                const tdS = { padding: '8px 10px', borderBottom: '1px solid #e2e8f0', verticalAlign: 'middle' };
                return (
                  <div style={{ marginBottom: '2rem' }} dir={ar ? 'rtl' : 'ltr'}>
                    <h3 style={{ marginBottom: 12, color: '#7c2d12' }}>
                      {ar ? `عوامل الخطر — ${dept}` : `Risk Factors — ${dept}`}
                    </h3>
                    <div style={{ overflowX: 'auto', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr>
                            <th style={thS}>{ar ? 'عامل الخطر' : 'Risk Factor'}</th>
                            <th style={{ ...thS, textAlign: 'center' }}>{ar ? 'عدد الحالات' : 'Cases'}</th>
                            <th style={{ ...thS, textAlign: 'center' }}>{ar ? 'النسبة' : 'Percentage'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row, i) => (
                            <tr key={row.label} style={{ background: i % 2 === 0 ? '#fff' : '#fff7ed' }}>
                              <td style={tdS}>{row.label}</td>
                              <td style={{ ...tdS, textAlign: 'center', fontWeight: 700 }}>{row.count}</td>
                              <td style={{ ...tdS, textAlign: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                                    <div style={{ width: `${(row.count / total * 100).toFixed(0)}%`, height: '100%', background: '#c2410c', borderRadius: 4 }} />
                                  </div>
                                  <span style={{ minWidth: 44, textAlign: 'right', fontWeight: 600, color: '#374151' }}>
                                    {(row.count / total * 100).toFixed(1)}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* ── Detailed Cases Table ── */}
              {(() => {
                const tableCases = (casesData?.cases || currentData?.cases || []).filter(c => c.floor === dept);
                const thS = { padding: '9px 10px', textAlign: 'start', fontWeight: 700,
                              color: '#7c2d12', whiteSpace: 'nowrap',
                              borderBottom: '2px solid #fed7aa', background: '#ffedd5' };
                const tdS = { padding: '7px 10px', borderBottom: '1px solid #e2e8f0',
                              verticalAlign: 'top', textAlign: 'start' };
                const hdrs = ar
                  ? ['رقم الحالة','التشخيص','العمر','الجنس','الجرثومة','تاريخ الدخول','تاريخ الإدخال','تاريخ الإصابة','عوامل الخطر']
                  : ['Case #','Diagnosis','Age','Gender','Germs','Admission','Insertion','Infection','Risk Factors'];
                return (
                  <div style={{ marginTop: '2rem' }} dir={ar ? 'rtl' : 'ltr'}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <h3 style={{ margin: 0, color: '#7c2d12' }}>
                        {ar ? `حالات مفصلة — ${dept}` : `Detailed Cases — ${dept}`}
                        {(casesData || currentData) && (
                          <span style={{ fontSize: 13, fontWeight: 400, color: SLATE, marginInlineStart: 8 }}>
                            {(() => { const s = casesData || currentData; return `(${s.quarter} ${s.year})`; })()}
                          </span>
                        )}
                      </h3>
                      <span style={{ marginInlineStart: 'auto', fontSize: 12, color: SLATE }}>
                        {ar ? `${tableCases.length} حالة` : `${tableCases.length} case${tableCases.length !== 1 ? 's' : ''}`}
                      </span>
                    </div>
                    {!tableCases.length ? (
                      <p style={{ color: SLATE, fontSize: 13 }}>
                        {ar ? 'لا توجد حالات لهذا القسم في الفصل المختار.' : 'No cases for this department in the selected quarter.'}
                      </p>
                    ) : (
                    <div style={{ overflowX: 'auto', borderRadius: 10,
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }} dir={ar ? 'rtl' : 'ltr'}>
                        <thead>
                          <tr>
                            {hdrs.map(h => <th key={h} style={thS}>{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {tableCases.map((c, i) => (
                            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fff7ed' }}>
                              <td style={{ ...tdS, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                {fmtNum(c.case_number) !== '—' ? fmtNum(c.case_number) : i + 1}
                              </td>
                              <td style={{ ...tdS, minWidth: 120 }}>{c.diagnosis || '—'}</td>
                              <td style={{ ...tdS, whiteSpace: 'nowrap' }}>{c.age_display || fmtNum(c.age)}</td>
                              <td style={{ ...tdS, whiteSpace: 'nowrap' }}>{c.gender || '—'}</td>
                              <td style={{ ...tdS, minWidth: 100, fontStyle: 'italic', color: '#9a3412' }}>
                                {c.germs || '—'}
                              </td>
                              <td style={{ ...tdS, whiteSpace: 'nowrap' }}>{c.date_of_admission || '—'}</td>
                              <td style={{ ...tdS, whiteSpace: 'nowrap' }}>{c.date_of_insertion || '—'}</td>
                              <td style={{ ...tdS, whiteSpace: 'nowrap' }}>{c.date_of_infection || '—'}</td>
                              <td style={{ ...tdS, minWidth: 160, color: '#991b1b', fontSize: 11 }}>
                                {getRiskFactors(c)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    )}
                  </div>
                );
              })()}

            </div>
          );
        })}
      </div>
    </div>
  );
}

export default CautiDashboard;
