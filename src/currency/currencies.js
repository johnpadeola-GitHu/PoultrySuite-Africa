// ─────────────────────────────────────────────────────────────────────────
// Currency registry — single source of truth for every supported currency.
//
// To add a currency: append a new entry. Nothing else needs to change.
// The shape is locked so consumers can rely on every field being present.
//
// Field reference:
//   code         ISO-4217 three-letter code, uppercase
//   symbol       Display symbol (₦, ₵, KSh, etc.)
//   symbolNative What locals actually see — sometimes differs from symbol
//   name         English name
//   nameNative   Local-language name (for selector display)
//   locale       BCP-47 locale used by Intl.NumberFormat
//   decimals     Number of fractional digits (most are 2; some are 0)
//   thousandsSep / decimalSep — for display only; Intl handles real formatting
//   paystack     true if Paystack natively accepts charges in this currency
//   region       For grouping in selectors ("West Africa", "East Africa", …)
// ─────────────────────────────────────────────────────────────────────────

export const CURRENCIES = {
  // ─── West Africa ──────────────────────────────────────────
  NGN: {
    code: 'NGN',
    symbol: '₦',
    symbolNative: '₦',
    name: 'Nigerian Naira',
    nameNative: 'Naira',
    locale: 'en-NG',
    decimals: 2,
    paystack: true,
    region: 'West Africa',
  },
  GHS: {
    code: 'GHS',
    symbol: 'GH₵',
    symbolNative: '₵',
    name: 'Ghanaian Cedi',
    nameNative: 'Cedi',
    locale: 'en-GH',
    decimals: 2,
    paystack: true,
    region: 'West Africa',
  },
  XOF: {
    code: 'XOF',
    symbol: 'CFA',
    symbolNative: 'CFA',
    name: 'West African CFA Franc',
    nameNative: 'Franc CFA',
    locale: 'fr-SN',
    decimals: 0,
    paystack: false,
    region: 'West Africa',
  },

  // ─── East Africa ──────────────────────────────────────────
  KES: {
    code: 'KES',
    symbol: 'KSh',
    symbolNative: 'KSh',
    name: 'Kenyan Shilling',
    nameNative: 'Shilingi',
    locale: 'en-KE',
    decimals: 2,
    paystack: true,
    region: 'East Africa',
  },
  UGX: {
    code: 'UGX',
    symbol: 'USh',
    symbolNative: 'USh',
    name: 'Ugandan Shilling',
    nameNative: 'Shilling',
    locale: 'en-UG',
    decimals: 0,
    paystack: false,
    region: 'East Africa',
  },
  TZS: {
    code: 'TZS',
    symbol: 'TSh',
    symbolNative: 'TSh',
    name: 'Tanzanian Shilling',
    nameNative: 'Shilingi',
    locale: 'sw-TZ',
    decimals: 0,
    paystack: false,
    region: 'East Africa',
  },
  RWF: {
    code: 'RWF',
    symbol: 'FRw',
    symbolNative: 'FRw',
    name: 'Rwandan Franc',
    nameNative: 'Franc',
    locale: 'rw-RW',
    decimals: 0,
    paystack: false,
    region: 'East Africa',
  },
  ETB: {
    code: 'ETB',
    symbol: 'Br',
    symbolNative: 'ብር',
    name: 'Ethiopian Birr',
    nameNative: 'Birr',
    locale: 'am-ET',
    decimals: 2,
    paystack: false,
    region: 'East Africa',
  },

  // ─── Southern Africa ──────────────────────────────────────
  ZAR: {
    code: 'ZAR',
    symbol: 'R',
    symbolNative: 'R',
    name: 'South African Rand',
    nameNative: 'Rand',
    locale: 'en-ZA',
    decimals: 2,
    paystack: true,
    region: 'Southern Africa',
  },
  ZMW: {
    code: 'ZMW',
    symbol: 'ZK',
    symbolNative: 'ZK',
    name: 'Zambian Kwacha',
    nameNative: 'Kwacha',
    locale: 'en-ZM',
    decimals: 2,
    paystack: false,
    region: 'Southern Africa',
  },
  BWP: {
    code: 'BWP',
    symbol: 'P',
    symbolNative: 'P',
    name: 'Botswana Pula',
    nameNative: 'Pula',
    locale: 'en-BW',
    decimals: 2,
    paystack: false,
    region: 'Southern Africa',
  },
  NAD: {
    code: 'NAD',
    symbol: 'N$',
    symbolNative: 'N$',
    name: 'Namibian Dollar',
    nameNative: 'Dollar',
    locale: 'en-NA',
    decimals: 2,
    paystack: false,
    region: 'Southern Africa',
  },

  // ─── Central Africa ───────────────────────────────────────
  XAF: {
    code: 'XAF',
    symbol: 'FCFA',
    symbolNative: 'FCFA',
    name: 'Central African CFA Franc',
    nameNative: 'Franc CFA',
    locale: 'fr-CM',
    decimals: 0,
    paystack: false,
    region: 'Central Africa',
  },

  // ─── North Africa ─────────────────────────────────────────
  EGP: {
    code: 'EGP',
    symbol: 'E£',
    symbolNative: 'ج.م',
    name: 'Egyptian Pound',
    nameNative: 'Pound',
    locale: 'ar-EG',
    decimals: 2,
    paystack: false,
    region: 'North Africa',
  },
  MAD: {
    code: 'MAD',
    symbol: 'DH',
    symbolNative: 'د.م.',
    name: 'Moroccan Dirham',
    nameNative: 'Dirham',
    locale: 'ar-MA',
    decimals: 2,
    paystack: false,
    region: 'North Africa',
  },
  DZD: {
    code: 'DZD',
    symbol: 'DA',
    symbolNative: 'د.ج',
    name: 'Algerian Dinar',
    nameNative: 'Dinar',
    locale: 'ar-DZ',
    decimals: 2,
    paystack: false,
    region: 'North Africa',
  },
  TND: {
    code: 'TND',
    symbol: 'DT',
    symbolNative: 'د.ت',
    name: 'Tunisian Dinar',
    nameNative: 'Dinar',
    locale: 'ar-TN',
    decimals: 3,
    paystack: false,
    region: 'North Africa',
  },

  // ─── International (fallback / settlement) ────────────────
  USD: {
    code: 'USD',
    symbol: '$',
    symbolNative: '$',
    name: 'US Dollar',
    nameNative: 'Dollar',
    locale: 'en-US',
    decimals: 2,
    paystack: true,
    region: 'International',
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    symbolNative: '€',
    name: 'Euro',
    nameNative: 'Euro',
    locale: 'en-IE',
    decimals: 2,
    paystack: false,
    region: 'International',
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    symbolNative: '£',
    name: 'British Pound',
    nameNative: 'Pound',
    locale: 'en-GB',
    decimals: 2,
    paystack: false,
    region: 'International',
  },
};

// Default when nothing else is known — Nigeria has the largest poultry
// industry in Africa and is the original target market.
export const DEFAULT_CURRENCY = 'NGN';

// Currencies Paystack accepts directly (no conversion needed).
export const PAYSTACK_NATIVE_CURRENCIES = Object.values(CURRENCIES)
  .filter((c) => c.paystack)
  .map((c) => c.code);

// Convenience: array form for iteration in selectors
export const CURRENCY_LIST = Object.values(CURRENCIES);

// Grouped form for region-organised selectors
export const CURRENCIES_BY_REGION = CURRENCY_LIST.reduce((acc, c) => {
  (acc[c.region] = acc[c.region] || []).push(c);
  return acc;
}, {});

// Safe lookup with fallback to default
export function getCurrency(code) {
  if (!code) return CURRENCIES[DEFAULT_CURRENCY];
  const c = CURRENCIES[String(code).toUpperCase()];
  return c || CURRENCIES[DEFAULT_CURRENCY];
}

export function isSupportedCurrency(code) {
  return !!CURRENCIES[String(code || '').toUpperCase()];
}
