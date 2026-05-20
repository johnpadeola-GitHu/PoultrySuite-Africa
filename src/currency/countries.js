// ─────────────────────────────────────────────────────────────────────────
// Country registry — maps every supported African country to its currency.
//
// When a user selects a country at registration, the currency is set
// automatically from this map. Users can later override via the currency
// switcher if they prefer a different display currency.
//
// Field reference:
//   code     ISO 3166-1 alpha-2 (lowercase for flag CDN compatibility, but
//            display uses uppercase ISO)
//   name     English country name
//   currency Default ISO-4217 currency code (must exist in currencies.js)
//   dialCode International dial code (used by phone-number inputs)
//   flag     Unicode flag emoji
//   region   Same regional grouping used in currencies.js
// ─────────────────────────────────────────────────────────────────────────

export const COUNTRIES = [
  // ─── West Africa ──────────────────────────────────────────
  { code: 'NG', name: 'Nigeria',       currency: 'NGN', dialCode: '+234', flag: '🇳🇬', region: 'West Africa' },
  { code: 'GH', name: 'Ghana',         currency: 'GHS', dialCode: '+233', flag: '🇬🇭', region: 'West Africa' },
  { code: 'SN', name: 'Senegal',       currency: 'XOF', dialCode: '+221', flag: '🇸🇳', region: 'West Africa' },
  { code: 'CI', name: "Côte d'Ivoire", currency: 'XOF', dialCode: '+225', flag: '🇨🇮', region: 'West Africa' },
  { code: 'BF', name: 'Burkina Faso',  currency: 'XOF', dialCode: '+226', flag: '🇧🇫', region: 'West Africa' },
  { code: 'ML', name: 'Mali',          currency: 'XOF', dialCode: '+223', flag: '🇲🇱', region: 'West Africa' },
  { code: 'NE', name: 'Niger',         currency: 'XOF', dialCode: '+227', flag: '🇳🇪', region: 'West Africa' },
  { code: 'BJ', name: 'Benin',         currency: 'XOF', dialCode: '+229', flag: '🇧🇯', region: 'West Africa' },
  { code: 'TG', name: 'Togo',          currency: 'XOF', dialCode: '+228', flag: '🇹🇬', region: 'West Africa' },
  { code: 'GW', name: 'Guinea-Bissau', currency: 'XOF', dialCode: '+245', flag: '🇬🇼', region: 'West Africa' },
  { code: 'LR', name: 'Liberia',       currency: 'USD', dialCode: '+231', flag: '🇱🇷', region: 'West Africa' },
  { code: 'SL', name: 'Sierra Leone',  currency: 'USD', dialCode: '+232', flag: '🇸🇱', region: 'West Africa' },
  { code: 'GM', name: 'Gambia',        currency: 'USD', dialCode: '+220', flag: '🇬🇲', region: 'West Africa' },

  // ─── East Africa ──────────────────────────────────────────
  { code: 'KE', name: 'Kenya',         currency: 'KES', dialCode: '+254', flag: '🇰🇪', region: 'East Africa' },
  { code: 'UG', name: 'Uganda',        currency: 'UGX', dialCode: '+256', flag: '🇺🇬', region: 'East Africa' },
  { code: 'TZ', name: 'Tanzania',      currency: 'TZS', dialCode: '+255', flag: '🇹🇿', region: 'East Africa' },
  { code: 'RW', name: 'Rwanda',        currency: 'RWF', dialCode: '+250', flag: '🇷🇼', region: 'East Africa' },
  { code: 'ET', name: 'Ethiopia',      currency: 'ETB', dialCode: '+251', flag: '🇪🇹', region: 'East Africa' },
  { code: 'BI', name: 'Burundi',       currency: 'USD', dialCode: '+257', flag: '🇧🇮', region: 'East Africa' },
  { code: 'SS', name: 'South Sudan',   currency: 'USD', dialCode: '+211', flag: '🇸🇸', region: 'East Africa' },
  { code: 'SO', name: 'Somalia',       currency: 'USD', dialCode: '+252', flag: '🇸🇴', region: 'East Africa' },
  { code: 'DJ', name: 'Djibouti',      currency: 'USD', dialCode: '+253', flag: '🇩🇯', region: 'East Africa' },
  { code: 'ER', name: 'Eritrea',       currency: 'USD', dialCode: '+291', flag: '🇪🇷', region: 'East Africa' },

  // ─── Southern Africa ──────────────────────────────────────
  { code: 'ZA', name: 'South Africa',  currency: 'ZAR', dialCode: '+27',  flag: '🇿🇦', region: 'Southern Africa' },
  { code: 'ZM', name: 'Zambia',        currency: 'ZMW', dialCode: '+260', flag: '🇿🇲', region: 'Southern Africa' },
  { code: 'BW', name: 'Botswana',      currency: 'BWP', dialCode: '+267', flag: '🇧🇼', region: 'Southern Africa' },
  { code: 'NA', name: 'Namibia',       currency: 'NAD', dialCode: '+264', flag: '🇳🇦', region: 'Southern Africa' },
  { code: 'ZW', name: 'Zimbabwe',      currency: 'USD', dialCode: '+263', flag: '🇿🇼', region: 'Southern Africa' },
  { code: 'MW', name: 'Malawi',        currency: 'USD', dialCode: '+265', flag: '🇲🇼', region: 'Southern Africa' },
  { code: 'MZ', name: 'Mozambique',    currency: 'USD', dialCode: '+258', flag: '🇲🇿', region: 'Southern Africa' },
  { code: 'LS', name: 'Lesotho',       currency: 'ZAR', dialCode: '+266', flag: '🇱🇸', region: 'Southern Africa' },
  { code: 'SZ', name: 'Eswatini',      currency: 'ZAR', dialCode: '+268', flag: '🇸🇿', region: 'Southern Africa' },

  // ─── Central Africa ───────────────────────────────────────
  { code: 'CM', name: 'Cameroon',      currency: 'XAF', dialCode: '+237', flag: '🇨🇲', region: 'Central Africa' },
  { code: 'GA', name: 'Gabon',         currency: 'XAF', dialCode: '+241', flag: '🇬🇦', region: 'Central Africa' },
  { code: 'CG', name: 'Congo',         currency: 'XAF', dialCode: '+242', flag: '🇨🇬', region: 'Central Africa' },
  { code: 'CD', name: 'DR Congo',      currency: 'USD', dialCode: '+243', flag: '🇨🇩', region: 'Central Africa' },
  { code: 'CF', name: 'CAR',           currency: 'XAF', dialCode: '+236', flag: '🇨🇫', region: 'Central Africa' },
  { code: 'TD', name: 'Chad',          currency: 'XAF', dialCode: '+235', flag: '🇹🇩', region: 'Central Africa' },
  { code: 'GQ', name: 'Eq. Guinea',    currency: 'XAF', dialCode: '+240', flag: '🇬🇶', region: 'Central Africa' },

  // ─── North Africa ─────────────────────────────────────────
  { code: 'EG', name: 'Egypt',         currency: 'EGP', dialCode: '+20',  flag: '🇪🇬', region: 'North Africa' },
  { code: 'MA', name: 'Morocco',       currency: 'MAD', dialCode: '+212', flag: '🇲🇦', region: 'North Africa' },
  { code: 'DZ', name: 'Algeria',       currency: 'DZD', dialCode: '+213', flag: '🇩🇿', region: 'North Africa' },
  { code: 'TN', name: 'Tunisia',       currency: 'TND', dialCode: '+216', flag: '🇹🇳', region: 'North Africa' },
  { code: 'LY', name: 'Libya',         currency: 'USD', dialCode: '+218', flag: '🇱🇾', region: 'North Africa' },
  { code: 'SD', name: 'Sudan',         currency: 'USD', dialCode: '+249', flag: '🇸🇩', region: 'North Africa' },
];

// Region-grouped form for organised dropdowns
export const COUNTRIES_BY_REGION = COUNTRIES.reduce((acc, c) => {
  (acc[c.region] = acc[c.region] || []).push(c);
  return acc;
}, {});

// O(1) lookup table
const BY_CODE = COUNTRIES.reduce((acc, c) => {
  acc[c.code] = c;
  return acc;
}, {});

export function getCountry(code) {
  if (!code) return null;
  return BY_CODE[String(code).toUpperCase()] || null;
}

// Resolve the currency that should be used for a given country code.
// Falls back to NGN (the original default) if the country is unknown.
export function getCurrencyForCountry(countryCode, fallback = 'NGN') {
  const c = getCountry(countryCode);
  return c ? c.currency : fallback;
}

// Lookup by country name (case-insensitive, accent-insensitive enough for
// our list). Used to bridge the existing country-name-based registration
// to the new ISO-code-based currency system.
const BY_NAME = COUNTRIES.reduce((acc, c) => {
  acc[c.name.toLowerCase()] = c;
  return acc;
}, {});

export function getCountryByName(name) {
  if (!name) return null;
  return BY_NAME[String(name).toLowerCase().trim()] || null;
}

// Best-effort country detection from the browser. Used at first launch
// to pre-select a country before the user has chosen one explicitly.
// Returns an ISO country code (uppercase) or null.
export function detectBrowserCountry() {
  try {
    const lang = (navigator.language || navigator.userLanguage || '').trim();
    // Examples: "en-NG", "en-US", "fr-CI"
    const m = lang.match(/[-_]([A-Z]{2})\b/i);
    if (m) {
      const code = m[1].toUpperCase();
      if (BY_CODE[code]) return code;
    }
  } catch (_) {}
  return null;
}
