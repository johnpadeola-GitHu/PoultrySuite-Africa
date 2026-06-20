// ─────────────────────────────────────────────────────────────────────
// Supabase client (singleton)
// ─────────────────────────────────────────────────────────────────────
// Credentials come from Vite env vars, set in:
//   • .env.local           (local dev)
//   • Cloudflare Pages → Settings → Environment variables (production)
//
//   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
//   VITE_SUPABASE_ANON_KEY=eyJ...
//
// The anon key is safe in the browser — Row-Level Security enforces all
// access rules server-side.
// ─────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'psa-auth',
      },
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
  return supabase;
}
