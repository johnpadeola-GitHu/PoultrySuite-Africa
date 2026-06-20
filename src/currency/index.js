// ─────────────────────────────────────────────────────────────────────────
// Currency module — barrel export.
//
// Single import path for everything:
//   import {
//     CurrencyProvider, useCurrency, Money,
//     CountrySelector, CurrencySwitcher,
//     formatMoney, parseMoney, convertMoney,
//     CURRENCIES, COUNTRIES,
//   } from './currency';
// ─────────────────────────────────────────────────────────────────────────

// Config
export {
  CURRENCIES,
  CURRENCY_LIST,
  CURRENCIES_BY_REGION,
  DEFAULT_CURRENCY,
  PAYSTACK_NATIVE_CURRENCIES,
  getCurrency,
  isSupportedCurrency,
} from './currencies.js';

export {
  COUNTRIES,
  COUNTRIES_BY_REGION,
  getCountry,
  getCountryByName,
  getCurrencyForCountry,
  detectBrowserCountry,
} from './countries.js';

// Formatting
export {
  formatMoney,
  formatMoneyCompact,
  formatNumber,
  formatCount,
  parseMoney,
  getCurrencySymbol,
} from './format.js';

// Exchange rates
export {
  setRateProvider,
  refreshRates,
  getRates,
  getLastFetchTime,
  onRatesChange,
  convertMoney,
  convertMoneyStrict,
} from './exchangeRates.js';

// Paystack helpers
export {
  isPaystackNative,
  getPaystackCurrency,
  getPaystackAmount,
  getPaystackChargeNotice,
} from './paystack.js';

// React context and hook
export {
  CurrencyProvider,
  useCurrency,
  useCurrencyOptional,
} from './CurrencyContext.jsx';

// Components
export { Money } from './components/Money.jsx';
export { CountrySelector } from './components/CountrySelector.jsx';
export { CurrencySwitcher } from './components/CurrencySwitcher.jsx';
