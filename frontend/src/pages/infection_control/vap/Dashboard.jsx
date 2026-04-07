import React, { useEffect, useState } from "react";
import { useTranslation } from 'react-i18next';
import styles from "../../../styles/Dashboard.module.css";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts";
import { API_VAP as API_URL } from '../../../config/api';

const GREEN  = "#16a34a";
const RED    = "#dc2626";
const AMBER  = "#f59e0b";
const BORDER = "#e5e7eb";
const SLATE  = "#64748b";

const TS = {
  contentStyle: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "10px 14px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
    fontSize: "12px"
  }
};

const thStyle = {
  padding: "12px 10px",
  textAlign: "left",
  fontWeight: 600,
  color: "#334155",
  borderBottom: "1px solid #e2e8f0"
};

const tdStyle = {
  padding: "10px",
  borderBottom: "1px solid #e2e8f0"
};

// Targets are fetched from /api/vap/targets on mount

const QUARTER_AR = {
  1: 'الفصل الأول',
  2: 'الفصل الثاني',
  3: 'الفصل الثالث',
  4: 'الفصل الرابع',
};

const shortQ = (quarter) => {
  const map = {
    "الفصل الأول":  "Q1",
    "الفصل الثاني": "Q2",
    "الفصل الثالث": "Q3",
    "الفصل الرابع": "Q4"
  };
  return map[quarter] || quarter;
};

const QUARTER_KEY_MAP = {
  "الفصل الأول":  "quarterFirst",
  "الفصل الثاني": "quarterSecond",
  "الفصل الثالث": "quarterThird",
  "الفصل الرابع": "quarterFourth",
};

function qLabel(q, y, t) {
  const key = QUARTER_KEY_MAP[q];
  return `${key ? t(key) : q} ${y}`;
}

function DepartmentGauge({ name, rate, target, ar }) {
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
    <div style={{ background: "white", borderRadius: 20, padding: 24,
                  boxShadow: "0 8px 25px rgba(0,0,0,0.05)", textAlign: "center" }}>
      <h3 style={{ marginBottom: 12 }}>{name}</h3>

      <svg viewBox="0 0 200 115" width="100%" style={{ maxWidth: 280 }}>
        <path d={arc(1, 70)} fill="none" stroke={BORDER}
              strokeWidth="16" strokeLinecap="round" />
        <path d={arc(ratePct, 70)} fill="none"
              stroke={isAbove ? RED : GREEN}
              strokeWidth="14" strokeLinecap="round" />
        <line
          x1={100 - 62 * Math.cos(Math.PI * tgtPct)}
          y1={100 - 62 * Math.sin(Math.PI * tgtPct)}
          x2={100 - 80 * Math.cos(Math.PI * tgtPct)}
          y2={100 - 80 * Math.sin(Math.PI * tgtPct)}
          stroke={AMBER} strokeWidth="4" strokeLinecap="round"
        />
        <text x="100" y="82" textAnchor="middle" fontSize="22"
              fontWeight="800" fill={isAbove ? RED : GREEN}>
          {rate.toFixed(2)}‰
        </text>
        <text x="100" y="98" textAnchor="middle" fontSize="10" fill="#94a3b8">
          {t('vapTargetLabel')} {target}‰
        </text>
      </svg>

      <div style={{ display: "inline-flex", alignItems: "center", gap: 6,
                    background: isAbove ? "#fef2f2" : "#f0fdf4",
                    color: isAbove ? RED : GREEN, borderRadius: 20,
                    padding: "5px 16px", fontSize: 12, fontWeight: 700, marginTop: 6 }}>
        {isAbove ? t('vapAboveTarget') : t('vapBelowTarget')}
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 16,
                    marginTop: 16, fontSize: 12, color: SLATE }}>
        {[
          { label: t('vapActual'),                                                              value: `${rate.toFixed(2)}‰`,                      color: isAbove ? RED : GREEN },
          { label: t('vapTargetLabel'),                                                         value: `${target}‰`,                               color: AMBER },
          { label: isAbove ? t('vapOver') : t('vapUnder'),  value: `${Math.abs(rate - target).toFixed(2)}‰`, color: isAbove ? RED : GREEN }
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

function VapDashboard({ language }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const [history,     setHistory]     = useState([]);
  const [targets,     setTargets]     = useState({});
  const [currentData, setCurrentData] = useState(null);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/history`).then(r => r.json()),
      fetch(`${API_URL}/targets`).then(r => r.json()),
      fetch(`${API_URL}/current`).then(r => r.json()).catch(() => null),
    ])
      .then(([hist, tgts, cur]) => {
        if (Array.isArray(hist) && hist.length > 0) setHistory(hist);
        setTargets(tgts);
        if (cur && cur.quarter) setCurrentData(cur);
        setLoading(false);
      })
      .catch(err => {
        console.error("VAP dashboard error:", err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className={styles.emptyState}>{t('vapLoadingText')}</div>;

  if (!history.length) {
    return (
      <div className={styles.emptyState}>
        <h2>{t('noVapData')}</h2>
        <p>{t('noVapDataDesc')}</p>
      </div>
    );
  }

  const params   = new URLSearchParams(window.location.search);
  const pQ       = params.get('quarter');
  const pY       = params.get('year');
  const matchIdx = pQ && pY
    ? history.findIndex(e => String(e.year) === String(pY) && e.quarter === QUARTER_AR[Number(pQ)])
    : -1;
  const latest = matchIdx >= 0
    ? history[matchIdx]
    : (currentData?.quarter && currentData?.year)
      ? (history.find(e => e.quarter === currentData.quarter && String(e.year) === String(currentData.year)) || history[history.length - 1])
      : history[history.length - 1];

  const SummaryTable = () => (
    <div style={{ background: "#ffffff", borderRadius: "14px",
                  boxShadow: "0 6px 18px rgba(0,0,0,0.06)", overflow: "hidden",
                  marginBottom: "2rem" }}>
      <div style={{ padding: "1rem 1.5rem",
                    background: "linear-gradient(to right, #dbeafe, #ffffff)",
                    borderBottom: "1px solid #e2e8f0" }}>
        <h3 style={{ margin: 0, color: "#1e3a8a" }}>{t('vapQuarterlyPerformance')}</h3>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse",
                        fontSize: "14px", tableLayout: "fixed" }}>
          <thead style={{ background: "#f1f5f9" }}>
            <tr>
              <th style={thStyle}>{t('vapDeptTarget')}</th>
              {history.map((q, i) => (
                <th key={i} style={thStyle}>{shortQ(q.quarter)} {q.year}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {Object.keys(targets).map((dept, rowIdx) => {
              const latestRate = latest.summary?.[dept]?.rate;
              return (
                <tr key={dept} style={{ background: rowIdx % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                  <td style={{ ...tdStyle, fontWeight: 600, color: "#1e293b", minWidth: 50 }}>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span>{dept}</span>
                      <span style={{ fontSize: "12px", color: "#64748b", marginTop: 2 }}>
                        {t('vapTarget')} {targets[dept]}‰
                      </span>
                      {latestRate != null && (
                        <span style={{ fontSize: "12px", marginTop: 4, fontWeight: 600,
                                       color: latestRate > targets[dept] ? RED : GREEN }}>
                          {t('vapLatest')} {latestRate}‰
                        </span>
                      )}
                    </div>
                  </td>

                  {history.map((q, colIdx) => {
                    const floor      = q.summary?.[dept];
                    const cases      = floor?.cases ?? null;
                    const days       = floor?.ventilator_days ?? null;
                    const rate       = floor?.rate ?? null;
                    const isAbove    = rate !== null && rate > targets[dept];
                    const prevRate   = colIdx > 0 ? history[colIdx - 1].summary?.[dept]?.rate ?? null : null;
                    const arrow      = prevRate !== null && rate !== null
                      ? rate > prevRate ? " ↑" : rate < prevRate ? " ↓" : ""
                      : "";

                    return (
                      <td key={colIdx} style={{ ...tdStyle, textAlign: "center",
                                                background: isAbove ? "#fee2e2" : "transparent",
                                                color: isAbove ? "#b91c1c" : "#0f172a" }}>
                        {rate !== null ? (
                          <>
                            <div style={{ fontSize: 13 }}>
                              <span style={{ fontWeight: 700 }}>{cases}</span>
                              <span style={{ color: "#64748b" }}> / {days}</span>
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>
                              {rate}‰{arrow}
                            </div>
                          </>
                        ) : "—"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const DeptSection = ({ dept }) => {
    const latestFloor = latest.summary?.[dept];
    if (!latestFloor) return null;

    const trendData = history.map(q => ({
      label:  `${shortQ(q.quarter)} ${q.year}`,
      rate:   q.summary?.[dept]?.rate  || 0,
      target: targets[dept]
    }));

    const validQuarters = history.filter(
      q => q.germs_distribution?.[dept] &&
           Object.keys(q.germs_distribution[dept] || {}).length > 0
    );

    const GermHeatmap = () => {
      if (!validQuarters.length) return null;

      const quarterKeys = validQuarters.map(q => `${shortQ(q.quarter)} ${q.year}`);
      const latestKey   = quarterKeys[quarterKeys.length - 1];

      const germSet = new Set();
      validQuarters.forEach(q => {
        Object.keys(q.germs_distribution[dept]).forEach(g => germSet.add(g));
      });
      const germs = Array.from(germSet);

      const data = germs.map(germ => {
        const row = { germ, values: {} };
        validQuarters.forEach((q, qi) => {
          const qKey       = quarterKeys[qi];
          const count      = q.germs_distribution[dept][germ] || 0;
          const totalCases = q.summary?.[dept]?.cases || 0;
          row.values[qKey] = {
            count,
            percent: totalCases > 0 ? (count / totalCases) * 100 : 0
          };
        });
        return row;
      });

      data.sort((a, b) => (b.values[latestKey]?.percent || 0) - (a.values[latestKey]?.percent || 0));
      const top6 = data.slice(0, 6);

      const maxPct = Math.max(...top6.flatMap(r => quarterKeys.map(k => r.values[k]?.percent || 0)), 1);

      const cellColor = (pct, qKey) => {
        const n = pct / maxPct;
        const r = Math.round(219 + (30  - 219) * n);
        const g = Math.round(234 + (64  - 234) * n);
        const b = Math.round(254 + (175 - 254) * n);
        return `rgb(${qKey === latestKey ? Math.max(r-15,0) : r},`
             + `${qKey === latestKey ? Math.max(g-15,0) : g},`
             + `${qKey === latestKey ? Math.max(b-15,0) : b})`;
      };

      return (
        <div style={{ marginBottom: "2rem" }}>
          <h3 style={{ marginBottom: 16 }}>{t('germDistributionHeatmap')}</h3>
          <div style={{ overflowX: "auto" }}>
            <div style={{ display: "grid",
                          gridTemplateColumns: `200px repeat(${quarterKeys.length}, 1fr)`,
                          gap: 6 }}>
              <div />
              {quarterKeys.map(k => (
                <div key={k} style={{ textAlign: "center", fontSize: 12 }}>{k}</div>
              ))}
              {top6.map(row => (
                <React.Fragment key={row.germ}>
                  <div style={{ fontSize: 12 }}>{row.germ}</div>
                  {quarterKeys.map(k => {
                    const cell = row.values[k] || { count: 0, percent: 0 };
                    return (
                      <div key={k} style={{ background: cellColor(cell.percent, k),
                                            borderRadius: 8, padding: 8, textAlign: "center",
                                            fontSize: 11, fontWeight: 600,
                                            color: cell.percent > 25 ? "#fff" : "#1e293b" }}>
                        {cell.count}
                        <div style={{ fontSize: 10 }}>({cell.percent.toFixed(0)}%)</div>
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      );
    };

    return (
      <div key={dept} style={{ marginBottom: "4rem", background: "#ffffff",
                                borderRadius: "16px",
                                boxShadow: "0 6px 20px rgba(0,0,0,0.05)",
                                padding: "2rem" }}>
        <h2 style={{ marginBottom: "2rem", color: "#1e3a8a" }}>
          {dept} — {latest.quarter} {latest.year}
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr",
                      gap: "2rem", marginBottom: "2rem" }}>
          <DepartmentGauge name={dept} rate={latestFloor.rate} target={targets[dept]} ar={ar} />

          <div style={{ background: "white", borderRadius: 20, padding: 20,
                        boxShadow: "0 8px 25px rgba(0,0,0,0.05)" }}>
            <h3 style={{ marginBottom: 16 }}>
              {t('vapQuarterlyRateVsTarget')}
              <span style={{ color: RED, fontWeight: 600 }}> ({targets[dept]}‰)</span>
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}
                         margin={{ top: 30, right: 20, left: 40, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" interval={0} angle={-30} textAnchor="end"
                       height={60} tick={{ fontSize: 10 }} />
                <YAxis hide />
                <Tooltip {...TS}
                  formatter={(v, name) => [
                    `${v.toFixed(2)}‰`,
                    name === "rate" ? t('vapActual') : t('vapTargetLabel')
                  ]} />
                <Legend verticalAlign="top" height={30} />
                <Line type="monotone" dataKey="rate" name={t('vapActualRate')}
                      stroke="#2563eb" strokeWidth={2.5}
                      dot={{ r: 4, fill: "#2563eb" }}
                      label={{ position: "top", fontSize: 10, fontWeight: 700,
                               fill: "#2563eb", formatter: v => `${v.toFixed(1)}‰` }} />
                <Line type="monotone" dataKey="target" name={t('vapTargetLabel')}
                      stroke={RED} strokeDasharray="6 3"
                      strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <GermHeatmap />
      </div>
    );
  };

  return (
    <div className={styles.dashboard} dir={ar ? "rtl" : "ltr"}>

      {/* ── Page Header ── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{t("vapDashboardTitle")}</h1>
          <p className={styles.pageSubtitle}>{t("vapDashboardSubtitle")}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1e3a8a", background: "#dbeafe", padding: "6px 14px", borderRadius: 10 }}>
            {qLabel(latest.quarter, latest.year, t)}
          </div>
          <div style={{ fontSize: 11, color: SLATE, marginTop: 4 }}>{t("currentQuarter")}</div>
        </div>
      </div>

      <SummaryTable />
      <div style={{ marginTop: "1rem" }}>
        {Object.keys(targets).map(dept => (
          <DeptSection key={dept} dept={dept} />
        ))}
      </div>
    </div>
  );
}

export default VapDashboard;
