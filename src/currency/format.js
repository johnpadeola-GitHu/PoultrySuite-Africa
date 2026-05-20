// ─────────────────────────────────────────────────────────────────────────
// Money formatting utilities — Intl.NumberFormat with caching.
//
// Why cache: Intl.NumberFormat construction is expensive (~50-200µs per
// instance). At the size of this app — hundreds of money values per render
// in the dashboard — uncached use measurably degrades scroll performance.
// ─────────────────────────────────────────────────────────────────────────

import { getCurrency } from './currencies.js';

const _formatterCache = new Map();

function getFormatter(currencyCode, options = {}) {
  const c = getCurrency(currencyCode);
  const key =
    c.code +
    '|' +
    (options.compact ? 'c' : 'f') +
    '|' +
    (options.symbol === false ? '0' : '1') +
    '|' +
    (options.decimals != null ? options.decimals : 'd');
  let f = _formatterCache.get(key);
  if (f) return f;
  const opts = {
    style: options.symbol === false ? 'decimal' : 'currency',
    currency: c.code,
    currencyDisplay: 'symbol',
    minimumFractionDigits: options.decimals != null ? options.decimals : c.decimals,
    maximumFractionDigits: options.decimals != null ? options.decimals : c.decimals,
  };
  if (options.compact) {
    opts.notation = 'compact';
    opts.compactDisplay = 'short';
  }
  try {
    f = new Intl.NumberFormat(c.locale, opts);
  } catch (_) {
    // Some browsers/locales reject certain currency codes; fall back to en
    f = new Intl.NumberFormat('en', opts);
  }
  _formatterCache.set(key, f);
  return f;
}

// Primary public API — format a numeric amount in the given currency.
// Examples:
//   formatMoney(25000, 'NGN')                 → "₦25,000.00"
//   formatMoney(12500, 'KES')                 → "KSh 12,500.00"
//   formatMoney(3400, 'ZAR')                  → "R 3,400.00"
//   formatMoney(25000, 'NGN', {decimals: 0})  → "₦25,000"
//   formatMoney(2500000, 'NGN', {compact: 1}) → "₦2.5M"
//   formatMoney(25000, 'NGN', {symbol: false})→ "25,000.00"
export function formatMoney(amount, currencyCode, options = {}) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  try {
    return getFormatter(currencyCode, options).format(n);
  } catch (_) {
    // Last-resort fallback: never crash a render over a formatting error
    const c = getCurrency(currencyCode);
    return `${c.symbol} ${n.toFixed(c.decimals)}`;
  }
}

// Compact form: 1,234,567 → "1.2M". Use in tight tiles / charts.
export function formatMoneyCompact(amount, currencyCode) {
  return formatMoney(amount, currencyCode, { compact: true, decimals: 1 });
}

// Just the number — no symbol. Used in input fields and CSV exports.
export function formatNumber(amount, currencyCode, decimals) {
  return formatMoney(amount, currencyCode, {
    symbol: false,
    decimals: decimals != null ? decimals : getCurrency(currencyCode).decimals,
  });
}

// Format an integer count (birds, eggs, etc.) — no currency, locale grouping.
// Uses the locale of the active currency so grouping matches expectation.
export function formatCount(amount, currencyCode = 'NGN') {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  const c = getCurrency(currencyCode);
  try {
    return new Intl.NumberFormat(c.locale, {
      maximumFractionDigits: 0,
    }).format(n);
  } catch (_) {
    return String(Math.round(n));
  }
}

// Parse a money string (user input) back to a number.
// Tolerates the currency symbol, thousands separators, and whitespace.
// Returns NaN on garbage so callers can validate.
export function parseMoney(str, currencyCode) {
  if (str == null) return NaN;
  if (typeof str === 'number') return str;
  const c = getCurrency(currencyCode);

  // Strip currency symbol/code, NBSP, and regular whitespace
  let cleaned = String(str)
    .replace(c.symbol, '')
    .replace(c.symbolNative, '')
    .replace(c.code, '')
    .replace(/\u00A0/g, '')
    .replace(/\s+/g, '');

  // Locale-aware separator detection. Most locales use "," for thousands
  // and "." for decimal; French/Arabic use "." or " " for thousands and
  // "," for decimal. We detect by the LAST separator.
  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');
  if (lastDot > -1 && lastComma > -1) {
    if (lastDot > lastComma) {
      cleaned = cleaned.replace(/,/g, ''); // commas are thousands
    } else {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    }
  } else if (lastComma > -1) {
    // Only commas. Decide: 1,234 = thousands? 1,23 = decimal?
    const after = cleaned.length - lastComma - 1;
    if (after === 3 && cleaned.split(',').length === 2 && cleaned.length > 4) {
      cleaned = cleaned.replace(',', '');
    } else {
      cleaned = cleaned.replace(',', '.');
    }
  }

  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

// Get just the symbol for a currency — useful for input prefixes
export function getCurrencySymbol(currencyCode) {
  return getCurrency(currencyCode).symbol;
}
