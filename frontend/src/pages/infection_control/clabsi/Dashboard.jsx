import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { API_CLABSI as API_URL } from '../../../config/api';

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
        <text x="100" y="98" textAnchor="middle" fontSize="10" fill="#94a3b8">
          {t("vapTarget")} {target}‰
        </text>
      </svg>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: isAbove ? "#fef2f2" : "#f0fdf4", color: isAbove ? RED : GREEN, borderRadius: 20, padding: "5px 16px", fontSize: 12, fontWeight: 700, marginTop: 6 }}>
        {isAbove ? t("vapAboveTarget") : t("vapBelowTarget")}
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 16, fontSize: 12, color: SLATE }}>
        {[
          { label: t("vapActual"),                              value: `${rate.toFixed(2)}‰`, color: isAbove ? RED : GREEN },
          { label: t("vapTargetLabel"),                         value: `${target}‰`,          color: AMBER },
          { label: isAbove ? t("vapOver") : t("vapUnder"),     value: `${Math.abs(rate - target).toFixed(2)}‰`, color: isAbove ? RED : GREEN },
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
function ClabsiDashboard() {
  const { t } = useTranslation();
  const [history,     setHistory]     = useState([]);
  const [currentData, setCurrentData] = useState(null);
  const [targets,     setTargets]     = useState({});
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
      .catch(err => { console.error("Dashboard error:", err); setLoading(false); });
  }, []);

  if (loading) return <div className={styles.emptyState}>{t("clabsiLoadingText")}</div>;

  const latestHistory = (currentData?.quarter && currentData?.year)
    ? (history.find(h => h.quarter === currentData.quarter && String(h.year) === String(currentData.year)) || history[history.length - 1])
    : history[history.length - 1];
  if (!latestHistory?.summary) {
    return <div className={styles.emptyState}><h2>{t("clabsiNoData")}</h2></div>;
  }

  const normalize = g => g?.toLowerCase().trim();

  return (
    <div className={styles.dashboard} dir="ltr">

      {/* ── Page Header ── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{t("clabsiDashboardTitle")}</h1>
          <p className={styles.pageSubtitle}>{t("clabsiDashboardSubtitle")}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1e3a8a", background: "#dbeafe", padding: "6px 14px", borderRadius: 10 }}>
            {qLabel(latestHistory.quarter, latestHistory.year, t)}
          </div>
          <div style={{ fontSize: 11, color: SLATE, marginTop: 4 }}>{t("currentQuarter")}</div>
        </div>
      </div>

      {/* ── Quarterly Performance Table ── */}
      <div style={{ background: "#ffffff", borderRadius: "14px", boxShadow: "0 6px 18px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div style={{ padding: "1rem 1.5rem", background: "linear-gradient(to right, #dbeafe, #ffffff)", borderBottom: "1px solid #e2e8f0" }}>
          <h3 style={{ margin: 0, color: "#1e3a8a" }}>{t("clabsiQuarterlyPerformance")}</h3>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", tableLayout: "fixed" }}>
            <thead style={{ background: "#f1f5f9" }}>
              <tr>
                <th style={thStyle}>{t("clabsiDeptTarget")}</th>
                {history.map((q, i) => (
                  <th key={i} style={thStyle}>{qLabel(q.quarter, q.year, t)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.keys(targets).map((dept, rowIndex) => (
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
                  {history.map((q, colIndex) => {
                    const summary    = q.summary?.[dept];
                    const cases      = summary?.cases ?? null;
                    const days       = summary?.catheter_days ?? null;
                    const rate       = summary?.rate ?? null;
                    const isAbove    = rate !== null && rate > targets[dept];
                    const prevRate   = colIndex > 0 ? history[colIndex - 1].summary?.[dept]?.rate ?? null : null;
                    const trendArrow = prevRate !== null && rate !== null ? (rate > prevRate ? " ↑" : rate < prevRate ? " ↓" : "") : "";
                    return (
                      <td key={colIndex} style={{ ...tdStyle, textAlign: "center", background: isAbove ? "#fee2e2" : "transparent", color: isAbove ? "#b91c1c" : "#0f172a" }}>
                        {rate !== null ? (
                          <>
                            <div style={{ fontSize: 13 }}>
                              <span style={{ fontWeight: 700 }}>{cases ?? "—"}</span>
                              <span style={{ color: "#64748b" }}> / {days ?? "—"}</span>
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>{rate}‰{trendArrow}</div>
                          </>
                        ) : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Department Blocks ── */}
      <div style={{ marginTop: "3rem" }}>
        {Object.keys(targets).map((dept) => {
          const latestSummary = latestHistory.summary?.[dept];
          if (!latestSummary) return null;

          const trendData = history.map(q => ({
            label:  qLabel(q.quarter, q.year, t),
            rate:   q.summary?.[dept]?.rate || 0,
            target: targets[dept],
          }));

          const deptCases = (currentData?.cases || []).filter(c => c.floor === dept);

          /* Germ heatmap — include ALL history quarters, empty germs show as blank */
          const currentGerms = {};
          deptCases.forEach(c => {
            const g = c.germs;
            if (g) currentGerms[g] = (currentGerms[g] || 0) + (c.nb_of_cases || 1);
          });
          const hasCurrentGerms = Object.keys(currentGerms).length > 0;

          const currentQKey = hasCurrentGerms
            ? qLabel(currentData.quarter, currentData.year, t)
            : null;
          const histAllKeys = history.map(q => qLabel(q.quarter, q.year, t));
          const currentAlreadyInHistory = currentQKey && histAllKeys.includes(currentQKey);

          const heatmapQuarters = [
            ...history.map(q => ({
              key:   qLabel(q.quarter, q.year, t),
              germs: q.germs_distribution?.[dept] || {},
              cases: q.summary?.[dept]?.cases || 0,
            })),
            ...(hasCurrentGerms && !currentAlreadyInHistory ? [{
              key:   currentQKey,
              germs: currentGerms,
              cases: deptCases.reduce((s, c) => s + (c.nb_of_cases || 1), 0),
            }] : []),
          ];

          const quarterKeys = heatmapQuarters.map(q => q.key);
          const latestQKey  = quarterKeys[quarterKeys.length - 1];

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
            const s = { r: 219, g: 234, b: 254 };
            const e = { r: 30,  g: 64,  b: 175 };
            let r = Math.round(s.r + (e.r - s.r) * n);
            let g = Math.round(s.g + (e.g - s.g) * n);
            let b = Math.round(s.b + (e.b - s.b) * n);
            if (qk === latestQKey) { r = Math.max(r - 15, 0); g = Math.max(g - 15, 0); b = Math.max(b - 15, 0); }
            return `rgb(${r},${g},${b})`;
          };

          return (
            <div key={dept} style={{ marginBottom: "4rem", background: "#ffffff", borderRadius: "16px", boxShadow: "0 6px 20px rgba(0,0,0,0.05)", padding: "2rem" }}>

              <h2 style={{ marginBottom: "2rem", color: "#1e3a8a" }}>
                {dept} — {qLabel(latestHistory.quarter, latestHistory.year, t)}
              </h2>

              {/* Gauge + Trend */}
              <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "2rem", marginBottom: "2rem" }}>
                <DepartmentGauge name={dept} rate={latestSummary.rate} target={targets[dept]} />

                <div style={{ background: "white", borderRadius: 20, padding: 20, boxShadow: "0 8px 25px rgba(0,0,0,0.05)" }}>
                  <h3 style={{ marginBottom: 16 }}>
                    {t("clabsiQuarterlyRateVsTarget")}
                    <span style={{ color: RED, fontWeight: 600 }}> ({targets[dept]}‰)</span>
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendData} margin={{ top: 30, right: 20, left: 40, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="label" interval={0} angle={-30} textAnchor="end" height={70} tick={{ fontSize: 9 }} />
                      <YAxis hide />
                      <Tooltip {...TS} formatter={(v, n) => [`${v.toFixed(2)}‰`, n === "rate" ? t("vapActual") : t("vapTargetLabel")]} />
                      <Legend verticalAlign="top" height={30} />
                      <Line type="monotone" dataKey="rate" name={t("vapActualRate")} stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4, fill: "#2563eb" }}
                        label={{ position: "top", fontSize: 10, fontWeight: 700, fill: "#2563eb", formatter: v => `${v.toFixed(1)}‰` }} />
                      <Line type="monotone" dataKey="target" name={t("vapTargetLabel")} stroke={RED} strokeDasharray="6 3" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Germ Heatmap */}
              {topGerms.length > 0 && (
                <div style={{ marginBottom: "2rem" }}>
                  <h3 style={{ marginBottom: 16 }}>{t("germDistributionHeatmapClabsi")}</h3>
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
                              <div key={q} style={{ background: getColor(cell.percent, q), borderRadius: 8, padding: 8, textAlign: "center", fontSize: 11, fontWeight: 600, color: cell.percent > 25 ? "#fff" : "#1e293b" }}>
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
              )}


            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ClabsiDashboard;
