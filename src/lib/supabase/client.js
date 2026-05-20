// ─────────────────────────────────────────────────────────────────────
// Supabase client (singleton)
// ─────────────────────────────────────────────────────────────────────
// One shared client for the whole app. Built once, exported everywhere.
// Reads credentials from Vite env vars. NEVER hard-code keys here.
//
// Required env vars (set in .env.local for dev, CF Pages dashboard for prod):
//   VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
//   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...   (the public anon key — safe to ship)
//
// The anon key is RLS-protected: it cannot do anything destructive without
// passing the row-level security policies enforced server-side.
// ─────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';

const url     = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Fail loudly if env vars are missing, but only in production builds —
// during local dev the app should still load (so devs can fix .env.local).
export const isSupabaseConfigured = Boolean(url && anonKey);

if (!isSupabaseConfigured && import.meta.env.PROD) {
  // eslint-disable-next-line no-console
  console.error(
    '[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
    'Set them in Cloudflare Pages → Settings → Environment variables.'
  );
}

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        // Persist session in localStorage so refreshes don't sign the user out
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,  // handles email-verify and OAuth redirects
        storageKey: 'psa-auth',
      },
      global: {
        headers: {
          'x-application': 'poultrysuite-africa',
        },
      },
    })
  : null;

// Convenience: throw a clear error if code tries to use Supabase before it's
// configured. Most call sites should check `isSupabaseConfigured` first or
// use the AuthProvider which handles this gracefully.
export function requireSupabase() {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and ' +
      'VITE_SUPABASE_ANON_KEY in your environment.'
    );
  }
  return supabase;
}
