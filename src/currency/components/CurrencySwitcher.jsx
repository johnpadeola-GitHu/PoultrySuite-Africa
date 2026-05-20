// ─────────────────────────────────────────────────────────────────────────
// <CurrencySwitcher> — compact dropdown for the app header.
//
// Lets users override their display currency mid-session without changing
// their country. Useful for traders / users who work across borders.
//
// <CurrencySelector> is the full labeled variant for forms (registration,
// settings, etc.). The switcher is the bare control for the header.
// ─────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useCurrency } from '../CurrencyContext.jsx';
import { CURRENCIES_BY_REGION } from '../currencies.js';

const STYLES = {
  wrap: { position: 'relative', display: 'inline-block' },
  trigger: {
    height: 32,
    padding: '0 10px',
    background: '#F3F4F6',
    border: '1px solid #E5E7EB',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 12,
    fontWeight: 600,
    color: '#111827',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    minWidth: 80,
  },
  symbol: { fontSize: 13, color: '#374151' },
  caret: { color: '#9CA3AF', fontSize: 10 },
  panel: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    right: 0,
    width: 240,
    maxHeight: 380,
    background: '#fff',
    border: '1px solid #D1D5DB',
    boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
    zIndex: 9100,
    overflowY: 'auto',
  },
  regionHeader: {
    fontSize: 10,
    fontWeight: 700,
    color: '#9CA3AF',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    padding: '8px 12px 4px',
    background: '#F9FAFB',
    position: 'sticky',
    top: 0,
  },
  option: {
    width: '100%',
    padding: '8px 12px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 13,
    color: '#111827',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    textAlign: 'left',
  },
  optionActive: { background: '#EFF6FF' },
  code: {
    fontWeight: 700,
    color: '#1F2937',
    minWidth: 38,
    fontFamily: 'JetBrains Mono, SF Mono, Menlo, monospace',
    fontSize: 11,
  },
  name: { color: '#374151', flex: 1, fontSize: 12 },
  symbolCol: {
    fontWeight: 600,
    color: '#6B7280',
    fontFamily: 'JetBrains Mono, SF Mono, Menlo, monospace',
    fontSize: 12,
  },
};

export function CurrencySwitcher({ align = 'right' }) {
  const { currencyCode, currency, setCurrency } = useCurrency();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const grouped = CURRENCIES_BY_REGION;

  return (
    <div ref={wrapRef} style={STYLES.wrap}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={STYLES.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={`Display currency: ${currency.name}`}
      >
        <span style={STYLES.symbol}>{currency.symbol}</span>
        <span>{currencyCode}</span>
        <span style={STYLES.caret}>▾</span>
      </button>
      {open && (
        <div
          style={{
            ...STYLES.panel,
            ...(align === 'left' ? { left: 0, right: 'auto' } : null),
          }}
          role="listbox"
        >
          {Object.entries(grouped).map(([region, list]) => (
            <div key={region}>
              <div style={STYLES.regionHeader}>{region}</div>
              {list.map((c) => {
                const isActive = c.code === currencyCode;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => {
                      setCurrency(c.code);
                      setOpen(false);
                    }}
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
                    <span style={STYLES.code}>{c.code}</span>
                    <span style={STYLES.name}>{c.name}</span>
                    <span style={STYLES.symbolCol}>{c.symbol}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CurrencySwitcher;
