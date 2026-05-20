// ─────────────────────────────────────────────────────────────────────────
// Exchange rate service — pluggable architecture for live or static rates.
//
// All rates are expressed against a base currency (default: USD).
// Rate semantics: rates[CCY] = how many CCY you get for 1 BASE.
//
// To plug in a real API later:
//   import { setRateProvider } from './exchangeRates';
//   setRateProvider({
//     async fetch() {
//       const r = await fetch('https://api.example.com/latest?base=USD');
//       const j = await r.json();
//       return { base: 'USD', rates: j.rates, asOf: new Date().toISOString() };
//     },
//   });
//   await refreshRates();
// ─────────────────────────────────────────────────────────────────────────

// Static fallback rates against USD — used until a provider supplies fresh
// ones. These are approximate Q2 2025 mid-market rates; the app still works
// (with a slight staleness disclaimer) if no provider is ever wired up.
const STATIC_RATES = {
  base: 'USD',
  asOf: '2025-05-01',
  static: true,
  rates: {
    USD: 1,
    EUR: 0.92,
    GBP: 0.79,
    NGN: 1600,
    GHS: 14.5,
    KES: 130,
    ZAR: 18.5,
    UGX: 3700,
    TZS: 2600,
    RWF: 1340,
    ZMW: 27,
    EGP: 49,
    XOF: 605,
    XAF: 605,
    BWP: 13.6,
    NAD: 18.5,
    ETB: 57,
    MAD: 10,
    DZD: 134,
    TND: 3.1,
  },
};

let _currentRates = { ...STATIC_RATES };
let _provider = null;
let _lastFetchAt = 0;
const _listeners = new Set();

function notify() {
  for (const fn of _listeners) {
    try {
      fn(_currentRates);
    } catch (_) {}
  }
}

// Provider contract: { async fetch() → { base, rates, asOf } }
export function setRateProvider(provider) {
  _provider = provider;
}

// Force a refresh. Returns the new rates object. If no provider is set or
// the fetch fails, returns the existing rates unchanged (never throws).
export async function refreshRates() {
  if (!_provider) return _currentRates;
  try {
    const fresh = await _provider.fetch();
    if (
      fresh &&
      fresh.base &&
      fresh.rates &&
      typeof fresh.rates === 'object'
    ) {
      _currentRates = {
        base: String(fresh.base).toUpperCase(),
        asOf: fresh.asOf || new Date().toISOString(),
        static: false,
        rates: fresh.rates,
      };
      _lastFetchAt = Date.now();
      notify();
    }
  } catch (_) {
    // Silently keep stale rates — never break the app over an exchange
    // rate fetch failure.
  }
  return _currentRates;
}

export function getRates() {
  return _currentRates;
}

export function getLastFetchTime() {
  return _lastFetchAt;
}

export function onRatesChange(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

// Convert an amount from one currency to another.
// Returns the converted amount as a number (caller formats with formatMoney).
//
// Identity short-circuit: same currency returns the input unchanged so the
// most common case (no conversion needed) costs almost nothing.
export function convertMoney(amount, fromCurrency, toCurrency, rates) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return NaN;
  const from = String(fromCurrency || '').toUpperCase();
  const to = String(toCurrency || '').toUpperCase();
  if (!from || !to || from === to) return n;

  const r = rates || _currentRates;
  const fromRate = r.rates[from];
  const toRate = r.rates[to];
  if (!fromRate || !toRate) return NaN;

  // Cross-rate via base: amount_to = amount × (toRate / fromRate)
  return n * (toRate / fromRate);
}

// Same as above but throws on unsupported currencies. Use when you'd rather
// crash than silently produce wrong numbers.
export function convertMoneyStrict(amount, fromCurrency, toCurrency, rates) {
  const result = convertMoney(amount, fromCurrency, toCurrency, rates);
  if (!Number.isFinite(result)) {
    throw new Error(
      `convertMoneyStrict: cannot convert ${amount} ${fromCurrency} → ${toCurrency}`
    );
  }
  return result;
}
