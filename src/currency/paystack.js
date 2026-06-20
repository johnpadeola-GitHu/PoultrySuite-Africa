// ─────────────────────────────────────────────────────────────────────────
// Paystack integration helpers.
//
// Paystack natively accepts NGN, GHS, KES, ZAR, USD. For every other
// African currency, we convert to USD at checkout and store the user's
// local-currency display amount alongside the settled USD amount.
// ─────────────────────────────────────────────────────────────────────────

import { getCurrency, PAYSTACK_NATIVE_CURRENCIES } from './currencies.js';
import { convertMoney } from './exchangeRates.js';

// Currencies billed in their subunit (kobo, pesewa, cents). Paystack
// expects amounts as integers in the smallest unit.
const SUBUNIT_MULTIPLIER = {
  NGN: 100, // 1 NGN = 100 kobo
  GHS: 100, // 1 GHS = 100 pesewa
  KES: 100, // 1 KES = 100 cents
  ZAR: 100, // 1 ZAR = 100 cents
  USD: 100, // 1 USD = 100 cents
};

// Is this currency something Paystack can charge directly?
export function isPaystackNative(currencyCode) {
  return PAYSTACK_NATIVE_CURRENCIES.includes(
    String(currencyCode || '').toUpperCase()
  );
}

// Pick the actual currency to use for the Paystack charge.
// If the display currency is natively supported, charge in that.
// Otherwise fall back to USD and let conversion happen.
export function getPaystackCurrency(displayCurrency) {
  const c = String(displayCurrency || '').toUpperCase();
  return isPaystackNative(c) ? c : 'USD';
}

// Compute the integer subunit amount Paystack expects.
// Handles the display-currency → settle-currency conversion when needed.
//
// Returns { amount, currency, originalAmount, originalCurrency, converted }
// where `amount` is the integer subunit value to pass to Paystack.
export function getPaystackAmount(amount, displayCurrency, rates) {
  const display = String(displayCurrency || 'NGN').toUpperCase();
  const settle = getPaystackCurrency(display);
  const settleAmount =
    display === settle ? Number(amount) : convertMoney(amount, display, settle, rates);

  const multiplier = SUBUNIT_MULTIPLIER[settle] || 100;
  const subunit = Math.round(Number(settleAmount) * multiplier);

  return {
    amount: subunit,             // integer subunit — pass directly to Paystack
    currency: settle,            // what Paystack will charge in
    originalAmount: Number(amount),
    originalCurrency: display,
    converted: display !== settle,
  };
}

// Human-readable disclosure for the checkout UI when conversion happens.
// Example: "You will be charged $12.49 USD (≈ ₦20,000 NGN at today's rate)"
export function getPaystackChargeNotice(amount, displayCurrency, rates) {
  const r = getPaystackAmount(amount, displayCurrency, rates);
  if (!r.converted) return null;
  const settleHuman = r.amount / (SUBUNIT_MULTIPLIER[r.currency] || 100);
  return {
    settleCurrency: r.currency,
    settleAmount: settleHuman,
    displayCurrency: r.originalCurrency,
    displayAmount: r.originalAmount,
  };
}
