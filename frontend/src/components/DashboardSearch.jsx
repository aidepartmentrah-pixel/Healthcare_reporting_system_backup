import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

function highlight(text, query) {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: '#fef08a', borderRadius: 2, padding: 0 }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function DashboardSearch({ sections = [] }) {
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const [query, setQuery]   = useState('');
  const [open, setOpen]     = useState(false);
  const [active, setActive] = useState(-1);
  const ref                 = useRef(null);
  const inputRef            = useRef(null);

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = sections.filter(s =>
    !query.trim() ||
    s.ar.toLowerCase().includes(query.toLowerCase()) ||
    s.en.toLowerCase().includes(query.toLowerCase())
  );

  const scrollTo = id => {
    const el = document.getElementById(id);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: 'smooth' });
    }
    setQuery('');
    setOpen(false);
    setActive(-1);
  };

  const onKey = e => {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    if (e.key === 'Enter' && active >= 0 && filtered[active]) scrollTo(filtered[active].id);
    if (e.key === 'Escape') { setOpen(false); setActive(-1); }
  };

  return (
    <div ref={ref} dir={ar ? 'rtl' : 'ltr'}
      style={{ position: 'relative', maxWidth: 440, marginBottom: 20 }}>

      {/* ── Input ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: '#fff', border: `1.5px solid ${open ? '#3b82f6' : '#e2e8f0'}`,
        borderRadius: 12, padding: '9px 14px',
        boxShadow: open ? '0 0 0 3px rgba(59,130,246,0.12)' : '0 2px 8px rgba(0,0,0,0.05)',
        transition: 'all 0.15s',
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); setActive(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder={ar ? 'ابحث في أقسام اللوحة...' : 'Search dashboard sections...'}
          style={{
            border: 'none', outline: 'none', flex: 1,
            fontSize: 13, color: '#334155', background: 'transparent',
            direction: ar ? 'rtl' : 'ltr', fontFamily: 'inherit',
          }}
        />
        {query && (
          <button onClick={() => { setQuery(''); setOpen(false); setActive(-1); inputRef.current?.focus(); }}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 18, lineHeight: 1, padding: 0 }}>
            ×
          </button>
        )}
        <span style={{ fontSize: 10, color: '#cbd5e1', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 5, padding: '2px 6px', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {filtered.length} / {sections.length}
        </span>
      </div>

      {/* ── Dropdown ── */}
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)',
          [ar ? 'right' : 'left']: 0, minWidth: '100%',
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
          boxShadow: '0 12px 32px rgba(0,0,0,0.12)', zIndex: 9999,
          maxHeight: 340, overflowY: 'auto',
        }}>
          <div style={{ padding: '6px 12px', fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #f1f5f9' }}>
            {ar ? 'الأقسام' : 'Sections'} — {ar ? 'انقر للانتقال' : 'click to jump'}
          </div>
          {filtered.map((s, i) => (
            <div key={s.id} onClick={() => scrollTo(s.id)}
              style={{
                padding: '10px 16px', cursor: 'pointer',
                borderBottom: i < filtered.length - 1 ? '1px solid #f8fafc' : 'none',
                background: active === i ? '#eff6ff' : '#fff',
                display: 'flex', flexDirection: 'column', gap: 3,
                transition: 'background 0.1s',
              }}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(-1)}>
              <span style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>
                {highlight(s.en, query)}
              </span>
              <span style={{ fontSize: 11, color: '#64748b', direction: 'rtl', textAlign: ar ? 'start' : 'end' }}>
                {highlight(s.ar, query)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
