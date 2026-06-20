// ─────────────────────────────────────────────────────────────────────
// Auth service — all Supabase auth calls go through here
// ─────────────────────────────────────────────────────────────────────
import { supabase, requireSupabase } from '../lib/supabase/client.js';

const ERROR_MAP = {
  'Invalid login credentials':
    "That email and password don't match. Check your details or reset your password.",
  'User already registered':
    'An account with that email already exists. Try signing in instead.',
};

function friendly(err) {
  if (!err) return null;
  const m = err.message || String(err);
  return ERROR_MAP[m] || m;
}

export async function signUp({ email, password, fullName }) {
  requireSupabase();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) return { user: null, error: friendly(error) };
  return { user: data.user, error: null };
}

export async function signIn({ email, password }) {
  requireSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { session: null, error: friendly(error) };
  return { session: data.session, error: null };
}

export async function signOut() {
  requireSupabase();
  const { error } = await supabase.auth.signOut();
  return { error: friendly(error) };
}

export async function requestPasswordReset(email) {
  requireSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/?reset=1`,
  });
  return { error: friendly(error) };
}

export async function updatePassword(newPassword) {
  requireSupabase();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return { error: friendly(error) };
}

// Load the signed-in user's profile, farm membership, active farm, and the
// farm's subscription + device limit/count — everything the app needs to
// know "who am I and what can I do." Also checks platform-admin status,
// which is independent of any single farm's role.
export async function loadAuthContext(userId) {
  requireSupabase();

  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (pErr) return { error: friendly(pErr) };

  const { data: memberships, error: mErr } = await supabase
    .from('farm_members')
    .select('role, farm:farms(*)')
    .eq('user_id', userId);
  if (mErr) return { error: friendly(mErr) };

  let activeFarm = null;
  if (profile?.active_farm_id && memberships?.length) {
    activeFarm = memberships.find((m) => m.farm?.id === profile.active_farm_id)?.farm || null;
  }
  if (!activeFarm && memberships?.length) activeFarm = memberships[0].farm;

  const role = activeFarm
    ? memberships.find((m) => m.farm?.id === activeFarm.id)?.role || null
    : null;

  // Platform-admin check. Failure here should never block normal tenant
  // login — if the RPC errors (e.g. migration not yet run), default to false.
  let isPlatformAdmin = false;
  try {
    const { data: pa, error: paErr } = await supabase.rpc('is_platform_admin');
    if (!paErr) isPlatformAdmin = !!pa;
  } catch (_) { /* non-fatal */ }

  return { profile, memberships: memberships || [], activeFarm, role, isPlatformAdmin, error: null };
}
