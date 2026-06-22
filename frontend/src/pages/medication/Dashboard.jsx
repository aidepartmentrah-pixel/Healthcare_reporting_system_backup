import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from '../../styles/Dashboard.module.css';
import DashboardSearch from '../../components/DashboardSearch';

import {
  LineChart, Line,
  AreaChart, Area,
  BarChart, Bar,
  ComposedChart,
  PieChart, Pie, Cell, Sector,
  XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LabelList,
} from 'recharts';

// ─── RTL/LTR + Font fix ───────────────────────────────────────────────────────
// Forces the entire dashboard to render LTR regardless of the app's language dir.
// Also prevents Arabic font fallback from synthesising fake bold (causes "thick" text).
const FONT_FIX_STYLE = `
  .med-dashboard,
  .med-dashboard * {
    direction: ltr !important;
    unicode-bidi: isolate;
    font-synthesis: none !important;
    -webkit-font-smoothing: antialiased;
    font-weight: inherit;
  }
  .med-dashboard h1,
  .med-dashboard h2,
  .med-dashboard h3 {
    font-weight: 700;
  }
  .med-dashboard .kpi-value {
    font-weight: 800;
  }
  /* Arabic text nodes still render correctly — only layout direction is forced LTR */
`;

// ─── Design Tokens ────────────────────────────────────────────────────────────
const BLUE        = '#2563eb';
const BLUE_LIGHT  = '#eff6ff';
const GREEN       = '#10b981';
const AMBER       = '#f59e0b';
const RED         = '#ef4444';
const SLATE       = '#64748b';
const SLATE_LIGHT = '#f8fafc';
const BORDER      = '#e2e8f0';
const PALETTE     = ['#2563eb','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#14b8a6','#ec4899','#84cc16'];

// ─── Shared Tooltip ───────────────────────────────────────────────────────────
const TS = {
  contentStyle: {
    background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12,
    padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', fontSize: 12,
  },
};

// ─── Table styles ─────────────────────────────────────────────────────────────
const TH_STYLE = {
  padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: SLATE,
  fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em',
  borderBottom: `2px solid ${BORDER}`, whiteSpace: 'nowrap', background: SLATE_LIGHT,
};
const TD_STYLE = { padding: '9px 12px', color: '#475569', verticalAlign: 'middle' };

// ─── Section ──────────────────────────────────────────────────────────────────
function Section({ id, title, icon, children }) {
  return (
    <div id={id} style={{ marginBottom: 36, direction: 'ltr' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, direction: 'ltr' }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: 0 }}>{title}</h2>
        <div style={{ flex: 1, height: 1, background: BORDER }} />
      </div>
      {children}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
function Card({ children, style = {} }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: `1px solid ${BORDER}`,
      boxShadow: '0 1px 8px rgba(0,0,0,0.04)', overflow: 'hidden', direction: 'ltr', ...style,
    }}>
      {children}
    </div>
  );
}
function CardHeader({ title, badge }) {
  return (
    <div style={{ padding: '14px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', direction: 'ltr' }}>
      <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{title}</h3>
      {badge && <span style={{ fontSize: 11, color: SLATE, background: SLATE_LIGHT, padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>{badge}</span>}
    </div>
  );
}
function CardBody({ children, style = {} }) {
  return <div style={{ padding: '14px 16px', ...style }}>{children}</div>;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, valueColor, sub, badge, badgeColor, badgeBg }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: `1px solid ${BORDER}`,
      boxShadow: '0 1px 8px rgba(0,0,0,0.04)', padding: '20px 22px',
      display: 'flex', flexDirection: 'column', gap: 6, direction: 'ltr',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: SLATE, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 34, fontWeight: 800, color: valueColor || '#1e293b', lineHeight: 1.1 }}>{value}</div>
      {badge && (
        <div style={{ display: 'inline-flex', alignItems: 'center', background: badgeBg || BLUE_LIGHT, color: badgeColor || BLUE, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, alignSelf: 'flex-start' }}>
          {badge}
        </div>
      )}
      {sub && <div style={{ fontSize: 11, color: SLATE }}>{sub}</div>}
    </div>
  );
}

// ─── Semicircle Gauge ─────────────────────────────────────────────────────────
function MedicationGauge({ rate, target }) {
  const MAX     = Math.max(rate * 1.5, target * 2, 0.05);
  const ratePct = Math.min(rate, MAX) / MAX;
  const tgtPct  = Math.min(target, MAX) / MAX;
  const isAbove = rate > target;
  const arc = (pct, radius) => {
    const a = Math.PI * pct;
    return `M ${100 - radius} 100 A ${radius} ${radius} 0 ${pct > 0.5 ? 1 : 0} 1 ${100 - radius * Math.cos(a)} ${100 - radius * Math.sin(a)}`;
  };
  return (
    <div style={{ textAlign: 'center', padding: '8px 0' }}>
      <svg viewBox="0 0 200 115" width="100%" style={{ maxWidth: 300 }}>
        <path d={arc(1, 70)} fill="none" stroke={BORDER} strokeWidth="16" strokeLinecap="round" />
        <path d={arc(ratePct, 70)} fill="none" stroke={isAbove ? RED : GREEN} strokeWidth="14" strokeLinecap="round" />
        <line x1={100 - 62 * Math.cos(Math.PI * tgtPct)} y1={100 - 62 * Math.sin(Math.PI * tgtPct)}
          x2={100 - 80 * Math.cos(Math.PI * tgtPct)} y2={100 - 80 * Math.sin(Math.PI * tgtPct)}
          stroke={AMBER} strokeWidth="4" strokeLinecap="round" />
        <text x="100" y="82" textAnchor="middle" fontSize="22" fontWeight="800" fill={isAbove ? RED : GREEN}>{rate.toFixed(4)}%</text>
        <text x="100" y="14" textAnchor="middle" fontSize="10" fontWeight="600" fill="#92400e">target {target}%</text>
      </svg>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: isAbove ? '#fef2f2' : '#f0fdf4', color: isAbove ? '#dc2626' : '#16a34a', borderRadius: 20, padding: '5px 16px', fontSize: 12, fontWeight: 700, marginTop: 6 }}>
        {isAbove ? '▲ Above Target' : '▼ Below Target'}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 14, fontSize: 12, color: SLATE }}>
        {[
          { label: 'Result', value: `${rate.toFixed(4)}%`, color: isAbove ? RED : GREEN },
          { label: 'Target', value: `${target}%`, color: AMBER },
          { label: isAbove ? 'Over' : 'Under', value: `${Math.abs(rate - target).toFixed(4)}%`, color: isAbove ? RED : GREEN },
        ].map((item, i, arr) => (
          <React.Fragment key={item.label}>
            <div style={{ textAlign: 'center' }}>
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

// ─── Advanced Donut Chart ─────────────────────────────────────────────────────
// Active slice expands on hover; custom external label lines; inner value
const renderActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 4} outerRadius={outerRadius + 10}
        startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={0.95} />
      <Sector cx={cx} cy={cy} innerRadius={outerRadius + 14} outerRadius={outerRadius + 18}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  );
};

const renderCustomLabel = ({ cx, cy, midAngle, outerRadius, percent, name, value }) => {
  if (percent < 0.04) return null;
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 32;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const lx1 = cx + (outerRadius + 6) * Math.cos(-midAngle * RADIAN);
  const ly1 = cy + (outerRadius + 6) * Math.sin(-midAngle * RADIAN);
  const lx2 = cx + (outerRadius + 22) * Math.cos(-midAngle * RADIAN);
  const ly2 = cy + (outerRadius + 22) * Math.sin(-midAngle * RADIAN);
  return (
    <g>
      <line x1={lx1} y1={ly1} x2={lx2} y2={ly2} stroke="#94a3b8" strokeWidth={1} />
      <text x={x} y={y - 5} textAnchor={x > cx ? 'start' : 'end'} fill="#1e293b" fontSize={11} fontWeight={600}>{name}</text>
      <text x={x} y={y + 9} textAnchor={x > cx ? 'start' : 'end'} fill={SLATE} fontSize={10}>{value} ({(percent * 100).toFixed(0)}%)</text>
    </g>
  );
};

function AdvancedDonut({ data, centerValue, centerLabel, height = 360 }) {
  const [activeIdx, setActiveIdx] = useState(0);
  return (
    <div style={{ position: 'relative' }}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart margin={{ top: 20, right: 40, bottom: 20, left: 40 }}>
          <Pie
            data={data} dataKey="value" nameKey="name"
            cx="50%" cy="46%"
            innerRadius="38%" outerRadius="58%"
            startAngle={90} endAngle={-270}
            activeIndex={activeIdx}
            activeShape={renderActiveShape}
            onMouseEnter={(_, i) => setActiveIdx(i)}
            label={renderCustomLabel}
            labelLine={false}
            isAnimationActive={false}
          >
            {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip {...TS} formatter={v => [`${v} errors`]} />
        </PieChart>
      </ResponsiveContainer>
      {/* Center label */}
      {centerValue !== undefined && (
        <div style={{ position: 'absolute', top: '42%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#1e293b', lineHeight: 1 }}>{centerValue}</div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>{centerLabel}</div>
        </div>
      )}
      {/* Colored legend dots */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', justifyContent: 'center', marginTop: 8, padding: '0 8px' }}>
        {data.map((d, i) => (
          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', opacity: activeIdx === i ? 1 : 0.6 }}
            onMouseEnter={() => setActiveIdx(i)}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: PALETTE[i % PALETTE.length], flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: '#334155', fontWeight: activeIdx === i ? 700 : 400 }}>{d.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Horizontal Bar Chart ─────────────────────────────────────────────────────
function HBarChart({ data, dataKey, nameKey, color = BLUE }) {
  return (
    <div dir="ltr">
      <ResponsiveContainer width="100%" height={Math.max(260, data.length * 46)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
          <XAxis type="number" hide />
          <YAxis type="category" dataKey={nameKey} width={130} tick={{ fontSize: 11, fill: '#334155' }} />
          <Tooltip {...TS} formatter={v => [`${v} errors`]} />
          <Bar dataKey={dataKey} fill={color} radius={[0, 7, 7, 0]} barSize={20}
            label={{ position: 'right', fontSize: 12, fontWeight: 700, fill: '#1e293b' }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Department Table ─────────────────────────────────────────────────────────
function DeptTable({ deptData, totalErrors }) {
  const { t } = useTranslation();
  const max = Math.max(...deptData.map(d => d.count), 1);
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr>
          <th style={{ ...TH_STYLE, width: '5%' }}>#</th>
          <th style={{ ...TH_STYLE, width: '36%' }}>{t('medDeptColumnDepartment')}</th>
          <th style={{ ...TH_STYLE, width: '10%', textAlign: 'center' }}>{t('medDeptColumnErrors')}</th>
          <th style={{ ...TH_STYLE, width: '49%' }}>{t('medDeptColumnShare')}</th>
        </tr>
      </thead>
      <tbody>
        {deptData.map((row, i) => {
          const pct = (row.count / totalErrors) * 100;
          const color = PALETTE[i % PALETTE.length];
          return (
            <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
              <td style={TD_STYLE}><span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 5, background: color, color: '#fff', fontSize: 10, fontWeight: 700 }}>{i + 1}</span></td>
              <td style={{ ...TD_STYLE, fontWeight: 600, color: '#1e293b' }}>{row.dept}</td>
              <td style={{ ...TD_STYLE, fontWeight: 700, textAlign: 'center' }}>{row.count}</td>
              <td style={TD_STYLE}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 7, borderRadius: 4, background: '#f1f5f9', overflow: 'hidden' }}>
                    <div style={{ width: `${(row.count / max) * 100}%`, height: '100%', background: color, borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, minWidth: 40, textAlign: 'right', color: SLATE }}>{pct.toFixed(1)}%</span>
                </div>
              </td>
            </tr>
          );
        })}
        <tr style={{ background: SLATE_LIGHT, fontWeight: 700, borderTop: `2px solid ${BORDER}` }}>
          <td colSpan={2} style={{ ...TD_STYLE, color: '#1e293b' }}>{t('medDeptTotal')}</td>
          <td style={{ ...TD_STYLE, color: '#1e293b', textAlign: 'center' }}>{totalErrors}</td>
          <td style={{ ...TD_STYLE, color: '#1e293b' }}>100%</td>
        </tr>
      </tbody>
    </table>
  );
}

// ─── Cause Distribution ───────────────────────────────────────────────────────
function CauseDistributionChart({ data }) {
  const total  = data.reduce((s, d) => s + d.count, 0);
  const sorted = [...data].sort((a, b) => b.count - a.count);
  const max    = sorted[0]?.count || 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {sorted.map((item, i) => {
        const pct   = (item.count / total) * 100;
        const color = PALETTE[i % PALETTE.length];
        return (
          <div key={item.cause} style={{ display: 'grid', gridTemplateColumns: '200px 1fr 52px 46px', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.cause}>{item.cause}</div>
            <div style={{ height: 22, background: '#f1f5f9', borderRadius: 5, overflow: 'hidden' }}>
              <div style={{ width: `${(item.count / max) * 100}%`, height: '100%', background: color, borderRadius: 5 }} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#1e293b', textAlign: 'right' }}>{item.count}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: SLATE, textAlign: 'right' }}>{pct.toFixed(1)}%</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Heatmap ──────────────────────────────────────────────────────────────────
// rows/cols are label arrays; matrix is { rowKey: { colKey: number } }
function Heatmap({ rows, cols, matrix, rowLabel, colLabel, grandTotal }) {
  const allVals = rows.flatMap(r => cols.map(c => matrix[r]?.[c] ?? 0));
  const max     = Math.max(...allVals, 1);

  const cellBg = (val) => {
    const t = val / max;
    // white → deep blue
    const r = Math.round(255 - t * (255 - 37));
    const g = Math.round(255 - t * (255 - 99));
    const b = Math.round(255 - t * (255 - 235));
    return `rgb(${r},${g},${b})`;
  };
  const cellFg = (val) => (val / max) > 0.45 ? '#fff' : '#1e293b';

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
        <thead>
          <tr>
            <th style={{ padding: '9px 12px', background: SLATE_LIGHT, borderBottom: `2px solid ${BORDER}`, borderRight: `2px solid ${BORDER}`, fontSize: 11, color: SLATE, fontWeight: 700, textAlign: 'left', minWidth: 130 }}>
              {rowLabel} ╲ {colLabel}
            </th>
            {cols.map(col => (
              <th key={col} style={{ padding: '9px 10px', background: SLATE_LIGHT, borderBottom: `2px solid ${BORDER}`, borderRight: `1px solid ${BORDER}`, fontSize: 10, color: SLATE, fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap', minWidth: 80 }}>
                {col}
              </th>
            ))}
            <th style={{ padding: '9px 10px', background: '#dbeafe', borderBottom: `2px solid ${BORDER}`, fontSize: 11, color: BLUE, fontWeight: 800, textAlign: 'center', minWidth: 60 }}>Σ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const rowTotal = cols.reduce((s, c) => s + (matrix[row]?.[c] ?? 0), 0);
            return (
              <tr key={row}>
                <td style={{ padding: '9px 12px', fontWeight: 700, color: '#1e293b', borderBottom: `1px solid ${BORDER}`, borderRight: `2px solid ${BORDER}`, background: SLATE_LIGHT, fontSize: 11, whiteSpace: 'nowrap' }}>{row}</td>
                {cols.map(col => {
                  const val = matrix[row]?.[col] ?? 0;
                  return (
                    <td key={col} title={`${row} × ${col}: ${val}`}
                      style={{ padding: '9px 10px', textAlign: 'center', fontWeight: val > 0 ? 700 : 400, fontSize: 12, borderBottom: `1px solid ${BORDER}`, borderRight: `1px solid ${BORDER}`, background: val > 0 ? cellBg(val) : '#fafafa', color: val > 0 ? cellFg(val) : '#cbd5e1', minWidth: 80 }}>
                      {val > 0 ? val : '—'}
                    </td>
                  );
                })}
                <td style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 800, fontSize: 12, borderBottom: `1px solid ${BORDER}`, background: '#dbeafe', color: BLUE }}>{rowTotal}</td>
              </tr>
            );
          })}
          <tr style={{ background: '#dbeafe' }}>
            <td style={{ padding: '9px 12px', fontWeight: 800, color: BLUE, borderTop: `2px solid ${BORDER}`, borderRight: `2px solid ${BORDER}`, fontSize: 11 }}>Σ Total</td>
            {cols.map(col => {
              const colTotal = rows.reduce((s, r) => s + (matrix[r]?.[col] ?? 0), 0);
              return <td key={col} style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 800, fontSize: 12, borderTop: `2px solid ${BORDER}`, borderRight: `1px solid ${BORDER}`, color: BLUE }}>{colTotal || '—'}</td>;
            })}
            <td style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 800, fontSize: 12, borderTop: `2px solid ${BORDER}`, color: BLUE, background: '#bfdbfe' }}>
              {grandTotal ?? rows.reduce((s, r) => s + cols.reduce((ss, c) => ss + (matrix[r]?.[c] ?? 0), 0), 0)}
            </td>
          </tr>
        </tbody>
      </table>
      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, fontSize: 10, color: SLATE }}>
        <span>Low</span>
        <div style={{ display: 'flex', gap: 2 }}>
          {[0.05, 0.2, 0.4, 0.6, 0.8, 1.0].map((v, i) => (
            <div key={i} style={{ width: 26, height: 12, borderRadius: 2, background: cellBg(v * max) }} />
          ))}
        </div>
        <span>High</span>
        <span style={{ marginLeft: 8, color: '#94a3b8' }}>— = no errors recorded</span>
      </div>
    </div>
  );
}

// ─── Quarter sort ─────────────────────────────────────────────────────────────
const Q_ORDER = { 'الفصل الاول': 1, 'الفصل الأول': 1, 'الفصل الثاني': 2, 'الفصل الثالث': 3, 'الفصل الرابع': 4 };
const sortQuarters = arr => [...arr].sort((a, b) =>
  (parseInt(a.year) * 10 + (Q_ORDER[a.quarter] || 0)) - (parseInt(b.year) * 10 + (Q_ORDER[b.quarter] || 0))
);

// ─── Build cross-tab matrix from two flat dicts ───────────────────────────────
// If the backend provides heatmap_cycle_cause use it directly.
// Otherwise approximate: distribute proportionally using both flat distributions.
// This gives a plausible matrix until the backend supplies real cross-tab data.
function buildCrossTab(rowDict, colDict) {
  const rows   = Object.keys(rowDict).filter(k => rowDict[k] > 0);
  const cols   = Object.keys(colDict).filter(k => colDict[k] > 0);
  const total  = Object.values(rowDict).reduce((s, v) => s + v, 0);
  const matrix = {};
  rows.forEach(r => {
    matrix[r] = {};
    cols.forEach(c => {
      // Distribute using joint probability approximation
      const approx = total > 0 ? Math.round((rowDict[r] * colDict[c]) / total) : 0;
      matrix[r][c] = approx;
    });
  });
  return { matrix, rows, cols };
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═════════════════════════════════════════════════════════════════════════════
function MedicationDashboard({ language, data, medicationTarget = 0.03 }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const ar = i18n.language === 'ar';
  const [history, setHistory]           = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const TARGET = medicationTarget;

  // Fetch lean history for trend charts only
  useEffect(() => {
    fetch(`${window.__RUNTIME_CONFIG__?.apiBaseUrl || window.location.protocol + '//' + window.location.hostname + ':8000'}/api/medication/history`)
      .then(r => r.json())
      .then(result => { setHistory(Array.isArray(result) ? result : []); setHistoryLoading(false); })
      .catch(() => setHistoryLoading(false));
  }, []);

  // Show spinner only while loading AND no current data available yet
  if (!data && historyLoading) return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>⏳</div>
      <h2 className={styles.emptyTitle}>{t('loading')}</h2>
    </div>
  );
  // No current data → prompt upload
  if (!data) return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>💊</div>
      <h2 className={styles.emptyTitle}>{t('noDataAvailable')}</h2>
      <button onClick={() => navigate('/medication/upload')} className={styles.uploadButton}>{t('uploadData')}</button>
    </div>
  );

  // ── Current quarter comes from the data prop (full statistics snapshot) ────
  const stats          = data.statistics || {};
  const summary        = stats.summary   || {};
  const currentQuarter = data.quarter    || '';
  const currentYear    = String(data.year || '');
  const totalErrors    = summary.total_errors || 0;
  const errorRate      = summary.error_rate   || 0;
  const totalDoses     = summary.total_doses  || 0;

  // ── Flat distributions ─────────────────────────────────────────────────────
  // Support both old format (flat {key:count}) and new format ({counts:{...}})
  const counts = (field) => (field && typeof field === 'object' && field.counts ? field.counts : field) || {};

  const cycleData = Object.entries(counts(stats.error_cycle))
    .map(([name, value]) => ({ name, value: Number(value) }))
    .filter(d => d.value > 0).sort((a, b) => b.value - a.value);

  const detectedData = Object.entries(counts(stats.detected_by))
    .map(([name, value]) => ({ name, value: Number(value) }))
    .filter(d => d.value > 0).sort((a, b) => b.value - a.value);

  const shiftData = Object.entries(counts(stats.duty_shift))
    .map(([name, value]) => ({ name, value: Number(value) }))
    .filter(d => d.value > 0);

  const staffData = Object.entries(counts(stats.staff_involved))
    .map(([name, value]) => ({ name, value: Number(value) }))
    .filter(d => d.value > 0).sort((a, b) => b.value - a.value);

  const deptData = Object.entries(counts(stats.departments))
    .map(([dept, count]) => ({ dept, count: Number(count) }))
    .filter(d => d.count > 0).sort((a, b) => b.count - a.count);
  const totalDeptErrors = deptData.reduce((s, d) => s + d.count, 0);

  const causesData = Object.entries(counts(stats.error_causes))
    .map(([cause, count]) => ({ cause, count: Number(count) }))
    .filter(d => d.count > 0).sort((a, b) => b.count - a.count);
  const totalCauses = causesData.reduce((s, d) => s + d.count, 0);

  // ── Heatmaps ───────────────────────────────────────────────────────────────
  const cycleCauseRaw  = stats.heatmap_cycle_cause;
  const causeCycleRaw  = stats.heatmap_cause_cycle;
  const causeUnitRaw   = stats.heatmap_cause_unit || {};

  const cycleDict = Object.fromEntries(cycleData.map(d => [d.name, d.value]));
  const causeDict = Object.fromEntries(causesData.map(d => [d.cause, d.count]));

  const { matrix: hm1, rows: hm1rows, cols: hm1cols } = cycleCauseRaw
    ? { matrix: cycleCauseRaw, rows: Object.keys(cycleCauseRaw), cols: Array.from(new Set(Object.values(cycleCauseRaw).flatMap(Object.keys))) }
    : buildCrossTab(cycleDict, causeDict);

  const { matrix: hm2, rows: hm2rows, cols: hm2cols } = causeCycleRaw
    ? { matrix: causeCycleRaw, rows: Object.keys(causeCycleRaw), cols: Array.from(new Set(Object.values(causeCycleRaw).flatMap(Object.keys))) }
    : buildCrossTab(causeDict, cycleDict);

  // ── Cause × Nursing Unit ───────────────────────────────────────────────────
  const causeUnitCauses = Object.keys(causeUnitRaw);
  const causeUnitUnits  = Array.from(new Set(causeUnitCauses.flatMap(c => Object.keys(causeUnitRaw[c] || {}))));
  // Stacked bar: one entry per nursing unit, fields = each cause
  const causeUnitStackedData = causeUnitUnits.map(unit => {
    const row = { unit };
    causeUnitCauses.forEach(cause => { row[cause] = causeUnitRaw[cause]?.[unit] || 0; });
    return row;
  }).sort((a, b) => {
    const aTotal = causeUnitCauses.reduce((s, c) => s + (a[c] || 0), 0);
    const bTotal = causeUnitCauses.reduce((s, c) => s + (b[c] || 0), 0);
    return bTotal - aTotal;
  });

  // ── Cause × Job Title ──────────────────────────────────────────────────────
  const causeJobRaw    = stats.heatmap_cause_job || {};
  const causeJobCauses = Object.keys(causeJobRaw);
  const causeJobTitles = Array.from(new Set(causeJobCauses.flatMap(c => Object.keys(causeJobRaw[c] || {}))));
  const causeJobStackedData = causeJobTitles.map(title => {
    const row = { title };
    causeJobCauses.forEach(cause => { row[cause] = causeJobRaw[cause]?.[title] || 0; });
    return row;
  }).sort((a, b) => {
    const aTotal = causeJobCauses.reduce((s, c) => s + (a[c] || 0), 0);
    const bTotal = causeJobCauses.reduce((s, c) => s + (b[c] || 0), 0);
    return bTotal - aTotal;
  });

  // ── Cause × Duty Shift ─────────────────────────────────────────────────────
  const causeShiftRaw    = stats.heatmap_cause_shift || {};
  const causeShiftCauses = Object.keys(causeShiftRaw);
  const causeShiftShifts = Array.from(new Set(causeShiftCauses.flatMap(c => Object.keys(causeShiftRaw[c] || {}))));
  const causeShiftStackedData = causeShiftShifts.map(shift => {
    const row = { shift };
    causeShiftCauses.forEach(cause => { row[cause] = causeShiftRaw[cause]?.[shift] || 0; });
    return row;
  }).sort((a, b) => {
    const aTotal = causeShiftCauses.reduce((s, c) => s + (a[c] || 0), 0);
    const bTotal = causeShiftCauses.reduce((s, c) => s + (b[c] || 0), 0);
    return bTotal - aTotal;
  });

  // ── Trend data: lean history + current quarter ─────────────────────────────
  const sortedHistory = sortQuarters(history);
  // Append current quarter if not already in history
  const alreadyInHistory = sortedHistory.some(
    q => q.quarter === currentQuarter && String(q.year) === currentYear
  );
  const trendQuarters = alreadyInHistory
    ? sortedHistory
    : sortQuarters([...sortedHistory, { quarter: currentQuarter, year: currentYear, error_rate: errorRate, total_errors: totalErrors, total_doses: totalDoses }]);

  const trendData = trendQuarters.map(q => ({
    label:  `${q.quarter} ${q.year}`,
    rate:   q.error_rate,
    errors: q.total_errors,
    target: TARGET,
  }));

  return (
    <>
      {/* ── Font weight fix: inject once into <head> ── */}
      <style>{FONT_FIX_STYLE}</style>

      <div className={`${styles.dashboard} med-dashboard`} dir="ltr" style={{ padding: '20px', maxWidth: 1600, margin: '0 auto', direction: 'ltr' }}>

        {/* PAGE HEADER */}
        <div style={{ marginBottom: 28, paddingBottom: 20, borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', direction: 'ltr' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: BLUE_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>💊</div>
              <div>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
                  {t('medDashboardTitle')}
                </h1>
                <p style={{ margin: 0, fontSize: 13, color: SLATE, marginTop: 2 }}>
                  {t('medDashboardSubtitle')}
                </p>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: BLUE, background: BLUE_LIGHT, padding: '6px 14px', borderRadius: 10 }}>
                {currentQuarter} {currentYear}
              </div>
              <div style={{ fontSize: 11, color: SLATE, marginTop: 4 }}>{t('currentQuarter')}</div>
            </div>
          </div>
        </div>

        {/* ── Section Search ── */}
        <DashboardSearch sections={[
          { id: 'med-kpi',          ar: 'مؤشرات الأداء الرئيسية',          en: 'Key Performance Indicators' },
          { id: 'med-performance',  ar: 'أداء الربع الحالي',               en: 'Current Quarter Performance' },
          { id: 'med-cause-dist',   ar: 'توزيع أسباب الأخطاء',             en: 'Error Cause Distribution' },
          { id: 'med-heatmaps',     ar: 'تحليل المصفوفة الحرارية',          en: 'Cross-Analysis Heatmaps' },
          { id: 'med-cause-dept',   ar: 'سبب الخطأ مع القسم',              en: 'Cause of Error by Department' },
          { id: 'med-cause-job',    ar: 'سبب الخطأ مع الكادر المتسبب',     en: 'Cause of Error by Job Title' },
          { id: 'med-cause-shift',  ar: 'سبب الخطأ مع فترة المناوبة',      en: 'Cause of Error by Duty Shift' },
          { id: 'med-error-dist',   ar: 'توزيع الأخطاء',                   en: 'Error Distribution' },
          { id: 'med-dept-analysis',ar: 'تحليل الأقسام',                   en: 'Department Analysis' },
          { id: 'med-trend',        ar: 'تحليل الاتجاهات',                 en: 'Trend Analysis' },
        ]} />

        {/* ═══ SECTION 1 — KPIs ═══ */}
        <Section id="med-kpi" title={t('kpiTitle')} icon="📊">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, direction: 'ltr' }}>
            <KpiCard icon="💊" label={t('totalErrors')} value={totalErrors.toLocaleString()}
              badge={`Q${Q_ORDER[currentQuarter] || '?'} ${currentYear}`} />
            <KpiCard icon="📈" label={t('errorRate')} value={`${errorRate.toFixed(4)}%`}
              valueColor={errorRate > TARGET ? RED : GREEN}
              badge={errorRate > TARGET ? '▲ Above Target' : '▼ Below Target'}
              badgeColor={errorRate > TARGET ? '#dc2626' : '#16a34a'}
              badgeBg={errorRate > TARGET ? '#fef2f2' : '#f0fdf4'} />
            <KpiCard icon="💉" label={t('totalDoses')} value={totalDoses.toLocaleString()} sub="Administered this quarter" />
            <KpiCard icon="🎯" label={t('targetRate')} value={`${TARGET}%`} badge="Clinical Standard" badgeColor={AMBER} badgeBg="#fffbeb" />
          </div>
        </Section>

        {/* ═══ SECTION 2 — CURRENT QUARTER PERFORMANCE ═══ */}
        <Section id="med-performance" title={t('currentQuarterPerformance')} icon="🎯">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, direction: 'ltr' }}>
            <Card>
              <CardHeader title={t('performanceGauge')} badge={`Target: ${TARGET}%`} />
              <CardBody>
                <MedicationGauge rate={errorRate} target={TARGET} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title={t('errorRateVsTarget')} />
              <CardBody style={{ padding: '12px 8px 8px' }}>
                <div dir="ltr">
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={trendData} margin={{ top: 24, right: 16, left: 0, bottom: 44 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="label" interval={0} angle={-30} textAnchor="end" height={60} tick={{ fontSize: 10, fill: '#64748b' }} />
                      <YAxis hide domain={[0, Math.max(...trendQuarters.map(q => q.error_rate), TARGET) * 1.4]} />
                      <Tooltip {...TS} formatter={v => [`${v.toFixed(4)}%`]} />
                      <Legend verticalAlign="top" height={28} />
                      <Line type="monotone" dataKey="rate" name="Result" stroke={BLUE} strokeWidth={2.5}
                        dot={{ r: 4, fill: BLUE }}
                        label={{ position: 'top', fontSize: 10, fontWeight: 700, fill: BLUE, formatter: v => `${v.toFixed(4)}%` }} />
                      <Line type="monotone" dataKey="target" name="Target" stroke="#92400e" strokeDasharray="6 3" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardBody>
            </Card>
          </div>
        </Section>

        {/* ═══ SECTION 3 — CAUSE DISTRIBUTION ═══ */}
        <Section id="med-cause-dist" title={t('causeDistributionTitle')} icon="🔎">
          <Card>
            <CardHeader title={t('causeOfErrorDistribution')} badge={`${causesData.length} causes`} />
            <CardBody>
              {causesData.length === 0
                ? <div style={{ color: SLATE }}>No cause data available</div>
                : <CauseDistributionChart data={causesData} />}
            </CardBody>
          </Card>
        </Section>

        {/* ═══ SECTION 4 — HEATMAPS ═══ */}
        <Section id="med-heatmaps" title={t('crossAnalysisHeatmaps')} icon="🌡️">

          {/* Approximation notice when no real cross-tab from backend */}
          {!cycleCauseRaw && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 12, color: '#92400e', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ flexShrink: 0 }}>⚠️</span>
              <span>
                Showing <strong>approximated values</strong> based on individual distributions.
                For exact counts, add <code style={{ background: '#fef3c7', padding: '1px 5px', borderRadius: 3 }}>heatmap_cycle_cause</code> and <code style={{ background: '#fef3c7', padding: '1px 5px', borderRadius: 3 }}>heatmap_cause_cycle</code> to your API response.
              </span>
            </div>
          )}

          <Card style={{ marginBottom: 16 }}>
            <CardHeader title={t('processStageXCause')} badge="Rows = Process | Cols = Cause" />
            <CardBody style={{ padding: '14px 12px' }}>
              {hm1rows.length === 0
                ? <div style={{ color: SLATE }}>No data available.</div>
                : <Heatmap rows={hm1rows} cols={hm1cols} matrix={hm1} rowLabel="Process" colLabel="Cause" grandTotal={totalErrors} />}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t('causeXProcessStage')} badge="Rows = Cause | Cols = Process" />
            <CardBody style={{ padding: '14px 12px' }}>
              {hm2rows.length === 0
                ? <div style={{ color: SLATE }}>No data available.</div>
                : <Heatmap rows={hm2rows} cols={hm2cols} matrix={hm2} rowLabel="Cause" colLabel="Process" grandTotal={totalErrors} />}
            </CardBody>
          </Card>
        </Section>

        {/* ═══ SECTION 5 — CAUSE × DEPARTMENT ═══ */}
        {causeUnitCauses.length > 0 && (
          <Section id="med-cause-dept" title={ar ? 'سبب الخطأ مع القسم' : 'Cause of Error by Department'} icon="🏥">

            {/* Heatmap */}
            <Card style={{ marginBottom: 16 }}>
              <CardHeader
                title={ar ? 'سبب الخطأ × القسم' : 'Cause of Error × Department — Heatmap'}
                badge={`${causeUnitCauses.length} ${ar ? 'سبب' : 'causes'} · ${causeUnitUnits.length} ${ar ? 'قسم' : 'departments'}`}
              />
              <CardBody style={{ padding: '14px 12px' }}>
                <Heatmap
                  rows={causeUnitCauses}
                  cols={causeUnitUnits}
                  matrix={causeUnitRaw}
                  rowLabel={ar ? 'السبب' : 'Cause'}
                  colLabel={ar ? 'القسم' : 'Department'}
                  grandTotal={totalErrors}
                />
              </CardBody>
            </Card>

            {/* Stacked Bar */}
            <Card>
              <CardHeader
                title={ar ? 'الأخطاء لكل قسم — حسب السبب' : 'Errors per Department — Stacked by Cause'}
                badge={ar ? 'مرتب حسب إجمالي الأخطاء' : 'Sorted by total errors'}
              />
              <CardBody style={{ padding: '12px 8px 8px' }}>
                <div dir="ltr">
                  <ResponsiveContainer
                    width="100%"
                    height={Math.max(340, causeUnitStackedData.length * 42) + 80}
                  >
                    <BarChart
                      data={causeUnitStackedData}
                      layout="vertical"
                      margin={{ top: 4, right: 120, left: 8, bottom: 70 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="unit"
                        width={160}
                        tick={{ fontSize: 11, fill: '#334155' }}
                      />
                      <Tooltip
                        {...TS}
                        formatter={(v, name) => [`${v} errors`, name]}
                      />
                      <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 11, paddingTop: 16 }} />
                      {causeUnitCauses.map((cause, i) => (
                        <Bar
                          key={cause}
                          dataKey={cause}
                          name={cause}
                          stackId="a"
                          fill={PALETTE[i % PALETTE.length]}
                          radius={i === causeUnitCauses.length - 1 ? [0, 5, 5, 0] : [0, 0, 0, 0]}
                        >
                          {i === causeUnitCauses.length - 1 && (
                            <LabelList
                              content={(props) => {
                                const { x, y, width, height, index } = props;
                                const row = causeUnitStackedData[index];
                                if (!row) return null;
                                const rowTotal = causeUnitCauses.reduce((s, c) => s + (row[c] || 0), 0);
                                const grandTotal = causeUnitStackedData.reduce((s, r) => s + causeUnitCauses.reduce((ss, c) => ss + (r[c] || 0), 0), 0);
                                const pct = grandTotal > 0 ? (rowTotal / grandTotal * 100).toFixed(1) : '0';
                                return (
                                  <text x={x + width + 6} y={y + height / 2 + 4} fontSize={11} fontWeight={700} fill="#475569">
                                    {rowTotal} ({pct}%)
                                  </text>
                                );
                              }}
                            />
                          )}
                        </Bar>
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardBody>
            </Card>
          </Section>
        )}

        {/* ═══ SECTION 6 — CAUSE × JOB TITLE ═══ */}
        {causeJobCauses.length > 0 && (
          <Section id="med-cause-job" title={ar ? 'سبب الخطأ مع الكادر المتسبب' : 'Cause of Error by Job Title'} icon="👤">

            {/* Heatmap */}
            <Card style={{ marginBottom: 16 }}>
              <CardHeader
                title={ar ? 'سبب الخطأ × الكادر المتسبب' : 'Cause of Error × Job Title — Heatmap'}
                badge={`${causeJobCauses.length} ${ar ? 'سبب' : 'causes'} · ${causeJobTitles.length} ${ar ? 'فئة' : 'job titles'}`}
              />
              <CardBody style={{ padding: '14px 12px' }}>
                <Heatmap
                  rows={causeJobCauses}
                  cols={causeJobTitles}
                  matrix={causeJobRaw}
                  rowLabel={ar ? 'السبب' : 'Cause'}
                  colLabel={ar ? 'الكادر' : 'Job Title'}
                  grandTotal={totalErrors}
                />
              </CardBody>
            </Card>

            {/* Stacked Bar */}
            <Card>
              <CardHeader
                title={ar ? 'الأخطاء لكل كادر — حسب السبب' : 'Errors per Job Title — Stacked by Cause'}
                badge={ar ? 'مرتب حسب إجمالي الأخطاء' : 'Sorted by total errors'}
              />
              <CardBody style={{ padding: '12px 8px 8px' }}>
                <div dir="ltr">
                  <ResponsiveContainer
                    width="100%"
                    height={Math.max(300, causeJobStackedData.length * 52) + 80}
                  >
                    <BarChart
                      data={causeJobStackedData}
                      layout="vertical"
                      margin={{ top: 4, right: 120, left: 8, bottom: 70 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="title"
                        width={140}
                        tick={{ fontSize: 11, fill: '#334155' }}
                      />
                      <Tooltip {...TS} formatter={(v, name) => [`${v} errors`, name]} />
                      <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 11, paddingTop: 16 }} />
                      {causeJobCauses.map((cause, i) => (
                        <Bar
                          key={cause}
                          dataKey={cause}
                          name={cause}
                          stackId="a"
                          fill={PALETTE[i % PALETTE.length]}
                          radius={i === causeJobCauses.length - 1 ? [0, 5, 5, 0] : [0, 0, 0, 0]}
                        >
                          {i === causeJobCauses.length - 1 && (
                            <LabelList
                              content={(props) => {
                                const { x, y, width, height, index } = props;
                                const row = causeJobStackedData[index];
                                if (!row) return null;
                                const rowTotal = causeJobCauses.reduce((s, c) => s + (row[c] || 0), 0);
                                const grandTotal = causeJobStackedData.reduce((s, r) => s + causeJobCauses.reduce((ss, c) => ss + (r[c] || 0), 0), 0);
                                const pct = grandTotal > 0 ? (rowTotal / grandTotal * 100).toFixed(1) : '0';
                                return (
                                  <text x={x + width + 6} y={y + height / 2 + 4} fontSize={11} fontWeight={700} fill="#475569">
                                    {rowTotal} ({pct}%)
                                  </text>
                                );
                              }}
                            />
                          )}
                        </Bar>
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardBody>
            </Card>
          </Section>
        )}

        {/* ═══ SECTION 7 — CAUSE × DUTY SHIFT ═══ */}
        {causeShiftCauses.length > 0 && (
          <Section id="med-cause-shift" title={ar ? 'سبب الخطأ مع فترة المناوبة' : 'Cause of Error by Duty Shift'} icon="🕐">

            {/* Heatmap */}
            <Card style={{ marginBottom: 16 }}>
              <CardHeader
                title={ar ? 'سبب الخطأ × فترة المناوبة' : 'Cause of Error × Duty Shift — Heatmap'}
                badge={`${causeShiftCauses.length} ${ar ? 'سبب' : 'causes'} · ${causeShiftShifts.length} ${ar ? 'فترة' : 'shifts'}`}
              />
              <CardBody style={{ padding: '14px 12px' }}>
                <Heatmap
                  rows={causeShiftCauses}
                  cols={causeShiftShifts}
                  matrix={causeShiftRaw}
                  rowLabel={ar ? 'السبب' : 'Cause'}
                  colLabel={ar ? 'المناوبة' : 'Shift'}
                  grandTotal={totalErrors}
                />
              </CardBody>
            </Card>

            {/* Stacked Bar */}
            <Card>
              <CardHeader
                title={ar ? 'الأخطاء لكل مناوبة — حسب السبب' : 'Errors per Shift — Stacked by Cause'}
                badge={ar ? 'مرتب حسب إجمالي الأخطاء' : 'Sorted by total errors'}
              />
              <CardBody style={{ padding: '12px 8px 8px' }}>
                <div dir="ltr">
                  <ResponsiveContainer
                    width="100%"
                    height={Math.max(280, causeShiftStackedData.length * 60) + 80}
                  >
                    <BarChart
                      data={causeShiftStackedData}
                      layout="vertical"
                      margin={{ top: 4, right: 120, left: 8, bottom: 70 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="shift"
                        width={120}
                        tick={{ fontSize: 11, fill: '#334155' }}
                      />
                      <Tooltip {...TS} formatter={(v, name) => [`${v} errors`, name]} />
                      <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 11, paddingTop: 16 }} />
                      {causeShiftCauses.map((cause, i) => (
                        <Bar
                          key={cause}
                          dataKey={cause}
                          name={cause}
                          stackId="a"
                          fill={PALETTE[i % PALETTE.length]}
                          radius={i === causeShiftCauses.length - 1 ? [0, 5, 5, 0] : [0, 0, 0, 0]}
                        >
                          {i === causeShiftCauses.length - 1 && (
                            <LabelList
                              content={(props) => {
                                const { x, y, width, height, index } = props;
                                const row = causeShiftStackedData[index];
                                if (!row) return null;
                                const rowTotal = causeShiftCauses.reduce((s, c) => s + (row[c] || 0), 0);
                                const grandTotal = causeShiftStackedData.reduce((s, r) => s + causeShiftCauses.reduce((ss, c) => ss + (r[c] || 0), 0), 0);
                                const pct = grandTotal > 0 ? (rowTotal / grandTotal * 100).toFixed(1) : '0';
                                return (
                                  <text x={x + width + 6} y={y + height / 2 + 4} fontSize={11} fontWeight={700} fill="#475569">
                                    {rowTotal} ({pct}%)
                                  </text>
                                );
                              }}
                            />
                          )}
                        </Bar>
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardBody>
            </Card>
          </Section>
        )}

        {/* ═══ SECTION 8 — ERROR DISTRIBUTION ═══ */}
        <Section id="med-error-dist" title={t('errorDistribution')} icon="🔍">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16, direction: 'ltr' }}>
            <Card>
              <CardHeader title={t('errorsByMedCycle')} badge={`Total: ${totalErrors}`} />
              <CardBody style={{ padding: '8px 12px 12px' }}>
                <AdvancedDonut data={cycleData} centerValue={totalErrors} centerLabel={t('medDeptTotal')} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title={t('errorsByDutyShift')} />
              <CardBody style={{ padding: '8px 12px 12px' }}>
                <AdvancedDonut data={shiftData} centerValue={shiftData.reduce((s, d) => s + d.value, 0)} centerLabel={t('medDeptTotal')} />
              </CardBody>
            </Card>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, direction: 'ltr' }}>
            <Card>
              <CardHeader title={t('errorsByDetectionMethod')} />
              <CardBody style={{ padding: '10px 0 8px' }}>
                <HBarChart data={detectedData} dataKey="value" nameKey="name" color={GREEN} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title={t('errorsByStaffInvolved')} />
              <CardBody style={{ padding: '10px 0 8px' }}>
                <HBarChart data={staffData} dataKey="value" nameKey="name" color="#8b5cf6" />
              </CardBody>
            </Card>
          </div>
        </Section>

        {/* ═══ SECTION 9 — DEPARTMENT ANALYSIS ═══ */}
        <Section id="med-dept-analysis" title={t('departmentAnalysis')} icon="🏥">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, direction: 'ltr' }}>
            <Card>
              <CardHeader title={t('top8Departments')} />
              <CardBody style={{ padding: '10px 0 8px' }}>
                <HBarChart data={deptData.slice(0, 8)} dataKey="count" nameKey="dept" color={BLUE} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title={t('departmentTable')} />
              <div style={{ overflowY: 'auto', maxHeight: 480 }}>
                <DeptTable deptData={deptData} totalErrors={totalDeptErrors} />
              </div>
            </Card>
          </div>
        </Section>

        {/* ═══ SECTION 10 — TREND ANALYSIS ═══ */}
        <Section id="med-trend" title={t('trendAnalysis')} icon="📈">

          {/* All quarters area trend */}
          <Card style={{ marginBottom: 16 }}>
            <CardHeader title={t('totalErrorsTrend')} />
            <CardBody style={{ padding: '12px 8px 8px' }}>
              <div dir="ltr">
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={trendData} margin={{ top: 24, right: 16, left: 0, bottom: 44 }}>
                    <defs>
                      <linearGradient id="errGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={BLUE} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={BLUE} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="label" interval={0} angle={-30} textAnchor="end" height={60} tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis hide />
                    <Tooltip {...TS} formatter={v => [`${v} errors`]} />
                    <Area type="monotone" dataKey="errors" name="Total Errors" stroke={BLUE} strokeWidth={2.5}
                      fill="url(#errGrad)" dot={{ r: 5, fill: BLUE }}
                      label={{ position: 'top', fontSize: 11, fontWeight: 700, fill: BLUE }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>

          {/* ALL quarters comparison: bars + rate line */}
          <Card>
            <CardHeader
              title={t('allQuartersComparison')}
              badge={`${trendQuarters.length} quarters`}
            />
            <CardBody style={{ padding: '12px 8px 8px' }}>
              <div dir="ltr">
                <ResponsiveContainer width="100%" height={380}>
                  <ComposedChart data={trendData} margin={{ top: 24, right: 50, left: 8, bottom: 50 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="label" interval={0} angle={-30} textAnchor="end" height={60} tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={v => `${v.toFixed(3)}%`} tick={{ fontSize: 11, fill: RED }} width={42} />
                    <Tooltip {...TS} formatter={(v, name) => name === 'Error Rate' ? [`${v.toFixed(4)}%`, name] : [v, name]} />
                    <Legend verticalAlign="top" height={32} />
                    <Bar yAxisId="left" dataKey="errors" name="Total Errors" fill={BLUE} radius={[5, 5, 0, 0]} barSize={40}
                      label={{ position: 'top', fontSize: 10, fontWeight: 700, fill: BLUE }} />
                    <Line yAxisId="right" type="monotone" dataKey="rate" name="Error Rate" stroke={RED} strokeWidth={2.5}
                      dot={{ r: 4, fill: RED }} activeDot={{ r: 7 }}
                      label={{ position: 'top', fontSize: 10, fontWeight: 600, fill: RED, formatter: v => `${v.toFixed(4)}%` }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>
        </Section>

      </div>
    </>
  );
}

export default MedicationDashboard;