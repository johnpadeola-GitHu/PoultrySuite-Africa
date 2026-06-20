// ─────────────────────────────────────────────────────────────────────────
// Currency context — global state, persistence, useCurrency hook.
//
// Usage:
//   import { CurrencyProvider, useCurrency } from './currency/CurrencyContext';
//
//   // At the root:
//   <CurrencyProvider><App /></CurrencyProvider>
//
//   // In any component:
//   const { currency, currencyCode, setCurrency, setCountry, format } = useCurrency();
//   <span>{format(25000)}</span>           // "₦25,000.00"
//   setCountry('KE')                        // switches to KES instantly
// ─────────────────────────────────────────────────────────────────────────

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  getCurrency,
  isSupportedCurrency,
  DEFAULT_CURRENCY,
} from './currencies.js';
import {
  getCountry,
  getCurrencyForCountry,
  detectBrowserCountry,
} from './countries.js';
import {
  formatMoney,
  formatMoneyCompact,
  formatNumber,
  formatCount,
  parseMoney,
  getCurrencySymbol,
} from './format.js';
import { convertMoney, getRates, onRatesChange } from './exchangeRates.js';

const STORAGE_KEY = 'psa::currency';
const STORAGE_COUNTRY_KEY = 'psa::country';

const CurrencyContext = createContext(null);

// Read persisted value safely (private / quota-exceeded modes can throw)
function readPersisted(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (_) {
    return null;
  }
}
function writePersisted(key, value) {
  try {
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, String(value));
  } catch (_) {}
}

// Resolve the starting currency at mount.
// Precedence: persisted user choice > persisted country > browser country > default.
function resolveInitialCurrency() {
  const persistedCurrency = readPersisted(STORAGE_KEY);
  if (persistedCurrency && isSupportedCurrency(persistedCurrency)) {
    return persistedCurrency.toUpperCase();
  }
  const persistedCountry = readPersisted(STORAGE_COUNTRY_KEY);
  if (persistedCountry) {
    return getCurrencyForCountry(persistedCountry, DEFAULT_CURRENCY);
  }
  const browserCountry = detectBrowserCountry();
  if (browserCountry) {
    return getCurrencyForCountry(browserCountry, DEFAULT_CURRENCY);
  }
  return DEFAULT_CURRENCY;
}

function resolveInitialCountry() {
  const persisted = readPersisted(STORAGE_COUNTRY_KEY);
  if (persisted && getCountry(persisted)) return persisted.toUpperCase();
  return detectBrowserCountry();
}

export function CurrencyProvider({ children, initialCurrency, initialCountry }) {
  const [currencyCode, setCurrencyCode] = useState(
    () => initialCurrency || resolveInitialCurrency()
  );
  const [countryCode, setCountryCode] = useState(
    () => initialCountry || resolveInitialCountry()
  );
  const [rates, setRates] = useState(() => getRates());

  // Subscribe to live rate updates from the exchange-rate service
  useEffect(() => onRatesChange(setRates), []);

  // Publish active currency to window.__psa so the legacy money formatters
  // inside PoultrySuiteAfrica.jsx (ngn, fmtN — called from reducers and
  // static utilities outside the React tree) can read the current currency
  // without needing access to the hook.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.__psa) window.__psa = {};
    window.__psa.currency = getCurrency(currencyCode);
    window.__psa.country = getCountry(countryCode);
    window.__psa.rates = rates;
    // Custom event so any subscriber can re-render on change
    try {
      window.dispatchEvent(new CustomEvent('psa:currencychange', {
        detail: { currencyCode, countryCode },
      }));
    } catch (_) {}
  }, [currencyCode, countryCode, rates]);

  // Persist on every change
  useEffect(() => {
    writePersisted(STORAGE_KEY, currencyCode);
  }, [currencyCode]);
  useEffect(() => {
    writePersisted(STORAGE_COUNTRY_KEY, countryCode);
  }, [countryCode]);

  // Public setters — guard inputs so consumers can't put the app into a
  // broken state by passing garbage.
  const setCurrency = useCallback((code) => {
    if (isSupportedCurrency(code)) {
      setCurrencyCode(String(code).toUpperCase());
    }
  }, []);

  const setCountry = useCallback((code) => {
    const country = getCountry(code);
    if (!country) return;
    setCountryCode(country.code);
    // Auto-switch the currency to match the country
    setCurrencyCode(country.currency);
  }, []);

  const currency = useMemo(() => getCurrency(currencyCode), [currencyCode]);
  const country = useMemo(() => getCountry(countryCode), [countryCode]);

  // Bound versions of the format/convert utilities that auto-apply the
  // active currency — these are what consumers will call 90% of the time.
  const format = useCallback(
    (amount, options) => formatMoney(amount, currencyCode, options),
    [currencyCode]
  );
  const formatCompact = useCallback(
    (amount) => formatMoneyCompact(amount, currencyCode),
    [currencyCode]
  );
  const formatNum = useCallback(
    (amount, decimals) => formatNumber(amount, currencyCode, decimals),
    [currencyCode]
  );
  const formatCnt = useCallback(
    (amount) => formatCount(amount, currencyCode),
    [currencyCode]
  );
  const parse = useCallback(
    (str) => parseMoney(str, currencyCode),
    [currencyCode]
  );
  const symbol = useMemo(
    () => getCurrencySymbol(currencyCode),
    [currencyCode]
  );

  // Convert an amount from another currency INTO the active display currency.
  // Useful when a record was created in NGN and now needs to render as KES.
  const convertToDisplay = useCallback(
    (amount, fromCurrency) =>
      convertMoney(amount, fromCurrency, currencyCode, rates),
    [currencyCode, rates]
  );

  const value = useMemo(
    () => ({
      // Core state
      currencyCode,
      currency,
      countryCode,
      country,
      rates,
      // Setters
      setCurrency,
      setCountry,
      // Formatters
      format,
      formatCompact,
      formatNum,
      formatCount: formatCnt,
      parse,
      symbol,
      // Conversion
      convertToDisplay,
      convert: (amount, from, to) => convertMoney(amount, from, to, rates),
    }),
    [
      currencyCode,
      currency,
      countryCode,
      country,
      rates,
      setCurrency,
      setCountry,
      format,
      formatCompact,
      formatNum,
      formatCnt,
      parse,
      symbol,
      convertToDisplay,
    ]
  );

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error(
      'useCurrency must be used inside <CurrencyProvider>. Wrap your app at the root.'
    );
  }
  return ctx;
}

// Optional hook variant for code that may render outside the provider
// (e.g., during SSR or in isolated tests). Returns a safe default object
// instead of throwing.
export function useCurrencyOptional() {
  const ctx = useContext(CurrencyContext);
  if (ctx) return ctx;
  return {
    currencyCode: DEFAULT_CURRENCY,
    currency: getCurrency(DEFAULT_CURRENCY),
    countryCode: null,
    country: null,
    rates: getRates(),
    setCurrency: () => {},
    setCountry: () => {},
    format: (a) => formatMoney(a, DEFAULT_CURRENCY),
    formatCompact: (a) => formatMoneyCompact(a, DEFAULT_CURRENCY),
    formatNum: (a, d) => formatNumber(a, DEFAULT_CURRENCY, d),
    formatCount: (a) => formatCount(a, DEFAULT_CURRENCY),
    parse: (s) => parseMoney(s, DEFAULT_CURRENCY),
    symbol: getCurrencySymbol(DEFAULT_CURRENCY),
    convertToDisplay: (a) => a,
    convert: (a) => a,
  };
}
