// ─────────────────────────────────────────────────────────────────────────
// <CountrySelector> — searchable country picker grouped by region.
//
// Use at registration / setup. Selecting a country automatically sets the
// currency via setCountry() in the currency context.
//
// Props:
//   value     ISO country code (controlled) — falls back to context country
//   onChange  (countryCode, country) => void — fired in addition to context update
//   label     optional label
//   required  marker on label
//   compact   smaller variant for inline use
// ─────────────────────────────────────────────────────────────────────────

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useCurrency } from '../CurrencyContext.jsx';
import { COUNTRIES_BY_REGION, getCountry } from '../countries.js';

const STYLES = {
  wrap: { position: 'relative', width: '100%' },
  label: {
    fontSize: 11,
    fontWeight: 600,
    color: '#6B7280',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 6,
    display: 'block',
  },
  trigger: {
    width: '100%',
    minHeight: 42,
    padding: '9px 12px',
    background: '#fff',
    border: '1px solid #D1D5DB',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 14,
    color: '#111827',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    textAlign: 'left',
  },
  triggerCompact: {
    minHeight: 34,
    padding: '6px 10px',
    fontSize: 13,
  },
  flag: { fontSize: 18, lineHeight: 1, flexShrink: 0 },
  caret: { marginLeft: 'auto', color: '#9CA3AF', fontSize: 11 },
  panel: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    maxHeight: 360,
    background: '#fff',
    border: '1px solid #D1D5DB',
    boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
    zIndex: 9100,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  search: {
    padding: '10px 12px',
    border: 'none',
    borderBottom: '1px solid #E5E7EB',
    fontSize: 13,
    outline: 'none',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box',
  },
  list: { overflowY: 'auto', flex: 1 },
  regionHeader: {
    fontSize: 10,
    fontWeight: 700,
    color: '#9CA3AF',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    padding: '8px 12px 4px',
    background: '#F9FAFB',
  },
  option: {
    width: '100%',
    padding: '8px 12px',
    background: 'transparent',
    border: 'none',
    borderTop: '1px solid transparent',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 13,
    color: '#111827',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    textAlign: 'left',
  },
  optionActive: { background: '#EFF6FF' },
  meta: { marginLeft: 'auto', fontSize: 11, color: '#6B7280' },
  empty: {
    padding: '24px 16px',
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
  },
};

export function CountrySelector({
  value,
  onChange,
  label = 'Country',
  required = false,
  compact = false,
  placeholder = 'Select your country',
}) {
  const { countryCode: ctxCountry, setCountry } = useCurrency();
  const selectedCode = value || ctxCountry;
  const selected = getCountry(selectedCode);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef(null);
  const searchRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // Focus search when opening
  useEffect(() => {
    if (open && searchRef.current) {
      const t = setTimeout(() => searchRef.current && searchRef.current.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return COUNTRIES_BY_REGION;
    const q = query.toLowerCase();
    const out = {};
    for (const [region, list] of Object.entries(COUNTRIES_BY_REGION)) {
      const hits = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          c.currency.toLowerCase().includes(q)
      );
      if (hits.length) out[region] = hits;
    }
    return out;
  }, [query]);

  const select = (country) => {
    setCountry(country.code);
    if (onChange) onChange(country.code, country);
    setOpen(false);
    setQuery('');
  };

  const hasResults = Object.keys(filtered).length > 0;

  return (
    <div ref={wrapRef} style={STYLES.wrap}>
      {label && (
        <label style={STYLES.label}>
          {label}
          {required && <span style={{ color: '#DC2626' }}> *</span>}
        </label>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ ...STYLES.trigger, ...(compact ? STYLES.triggerCompact : null) }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected ? (
          <>
            <span style={STYLES.flag}>{selected.flag}</span>
            <span>{selected.name}</span>
            <span style={STYLES.meta}>{selected.currency}</span>
          </>
        ) : (
          <span style={{ color: '#9CA3AF' }}>{placeholder}</span>
        )}
        <span style={STYLES.caret}>▾</span>
      </button>
      {open && (
        <div style={STYLES.panel} role="listbox">
          <input
            ref={searchRef}
            type="text"
            placeholder="Search by country, currency, or code…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={STYLES.search}
          />
          <div style={STYLES.list}>
            {!hasResults && <div style={STYLES.empty}>No countries match "{query}"</div>}
            {Object.entries(filtered).map(([region, list]) => (
              <div key={region}>
                <div style={STYLES.regionHeader}>{region}</div>
                {list.map((c) => {
                  const isActive = c.code === selectedCode;
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => select(c)}
                      style={{
                        ...STYLES.option,
                        ...(isActive ? STYLES.optionActive : null),
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.background = '#F9FAFB';
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <span style={STYLES.flag}>{c.flag}</span>
                      <span>{c.name}</span>
                      <span style={STYLES.meta}>{c.currency}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default CountrySelector;
