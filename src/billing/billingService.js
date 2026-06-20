// ─────────────────────────────────────────────────────────────────────
// Billing service — Paystack checkout for annual subscriptions
// ─────────────────────────────────────────────────────────────────────
// Flow:
//   1. loadPlans()            — read the three plans from Supabase
//   2. createPaymentIntent()  — server creates a pending payment, returns a
//                               reference + the authoritative amount (kobo)
//   3. openPaystack()         — launch Paystack inline checkout with that
//                               reference and amount
//   4. Paystack calls the webhook → subscription activates server-side
//   5. On the browser, after checkout closes, we poll the subscription to
//      reflect the new plan.
//
// The amount always comes from the server (the plan price), never the client,
// so it can't be tampered with. The public key is a Vite env var.
// ─────────────────────────────────────────────────────────────────────
import { supabase, requireSupabase } from '../lib/supabase/client.js';

const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || '';

export const isBillingConfigured = Boolean(PAYSTACK_PUBLIC_KEY);

// Load active plans, ordered for display
export async function loadPlans() {
  requireSupabase();
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  if (error) return { plans: [], error: error.message };
  return { plans: data || [], error: null };
}

// Ask the server to create a pending payment for a plan tier.
export async function createPaymentIntent(planTier) {
  requireSupabase();
  const { data, error } = await supabase.rpc('create_payment_intent', { p_plan_tier: planTier });
  if (error) return { error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  return { reference: row?.reference, amount: row?.amount_minor, email: row?.email, error: null };
}

// Dynamically load the Paystack inline script once.
function loadPaystackScript() {
  return new Promise((resolve, reject) => {
    if (window.PaystackPop) return resolve(window.PaystackPop);
    const existing = document.getElementById('paystack-js');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.PaystackPop));
      return;
    }
    const s = document.createElement('script');
    s.id = 'paystack-js';
    s.src = 'https://js.paystack.co/v1/inline.js';
    s.async = true;
    s.onload = () => resolve(window.PaystackPop);
    s.onerror = () => reject(new Error('Could not load Paystack. Check your connection.'));
    document.body.appendChild(s);
  });
}

// Launch Paystack checkout. Resolves with {status:'success'|'closed', reference}.
export async function openPaystack({ email, amountMinor, reference }) {
  if (!PAYSTACK_PUBLIC_KEY) throw new Error('Billing is not configured (missing Paystack key).');
  await loadPaystackScript();
  return new Promise((resolve) => {
    const handler = window.PaystackPop.setup({
      key: PAYSTACK_PUBLIC_KEY,
      email,
      amount: amountMinor,       // in kobo
      currency: 'NGN',
      ref: reference,
      onClose: () => resolve({ status: 'closed', reference }),
      callback: (resp) => resolve({ status: 'success', reference: resp.reference || reference }),
    });
    handler.openIframe();
  });
}

// Poll the current subscription a few times after checkout, to catch the
// webhook activation. Returns the latest subscription row (or null).
export async function pollSubscription(farmId, tries = 6, delayMs = 1500) {
  requireSupabase();
  for (let i = 0; i < tries; i++) {
    const { data } = await supabase
      .from('subscriptions')
      .select('status, plan_id, period_end, plans(tier, name, max_devices)')
      .eq('farm_id', farmId)
      .in('status', ['active', 'trialing', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data && data.status === 'active') return data;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}
