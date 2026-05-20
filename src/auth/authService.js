// ─────────────────────────────────────────────────────────────────────
// Auth service
// ─────────────────────────────────────────────────────────────────────
// All auth-related Supabase calls go through this module. Components never
// call supabase.auth.* directly — they call these helpers, which:
//   1. Centralize error handling
//   2. Auto-load the user's profile + farms after sign-in
//   3. Return consistent shapes the UI can render
// ─────────────────────────────────────────────────────────────────────
import { supabase, requireSupabase } from '../lib/supabase/client.js';

// ─── Error normalization ────────────────────────────────────────────
// Supabase error messages are sometimes opaque. Map common ones to
// user-friendly text so the UI doesn't have to.
const ERROR_MAP = {
  'Invalid login credentials':
    'That email and password don\'t match. Check your details or reset your password.',
  'Email not confirmed':
    'Please check your email and click the verification link before signing in.',
  'User already registered':
    'An account with that email already exists. Try signing in instead.',
  'Password should be at least 6 characters':
    'Password must be at least 6 characters long.',
};

function friendlyError(err) {
  if (!err) return null;
  const msg = err.message || String(err);
  return ERROR_MAP[msg] || msg;
}

// ─── Sign up ────────────────────────────────────────────────────────
// Creates auth.users row → trigger creates profiles row.
// Does NOT create a farm yet — the user will do that on the onboarding
// screen after their first sign-in.
export async function signUp({ email, password, fullName }) {
  requireSupabase();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      // After email verification, return user here. CF Pages root works.
      emailRedirectTo: window.location.origin,
    },
  });
  if (error) return { user: null, error: friendlyError(error) };
  return { user: data.user, error: null };
}

// ─── Sign in ────────────────────────────────────────────────────────
export async function signIn({ email, password }) {
  requireSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { session: null, error: friendlyError(error) };
  return { session: data.session, error: null };
}

// ─── Sign out ───────────────────────────────────────────────────────
export async function signOut() {
  requireSupabase();
  const { error } = await supabase.auth.signOut();
  return { error: friendlyError(error) };
}

// ─── Password reset ─────────────────────────────────────────────────
export async function requestPasswordReset(email) {
  requireSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/?reset=1`,
  });
  return { error: friendlyError(error) };
}

export async function updatePassword(newPassword) {
  requireSupabase();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return { error: friendlyError(error) };
}

// ─── Resend verification email ─────────────────────────────────────
export async function resendVerification(email) {
  requireSupabase();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  return { error: friendlyError(error) };
}

// ─── Load profile + memberships in one go ───────────────────────────
// Called after sign-in. Returns:
//   { profile, memberships: [{ farm, role }], activeFarm }
// `activeFarm` is the one the user is currently working in (from
// profiles.active_farm_id). If null, the UI should show an onboarding
// flow to create or join a farm.
export async function loadAuthContext(userId) {
  requireSupabase();

  // Profile
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (profileErr) return { error: friendlyError(profileErr) };

  // Memberships → farm rows
  const { data: memberships, error: memErr } = await supabase
    .from('farm_members')
    .select('role, farm:farms(*)')
    .eq('user_id', userId);
  if (memErr) return { error: friendlyError(memErr) };

  let activeFarm = null;
  if (profile?.active_farm_id && memberships?.length) {
    activeFarm = memberships.find((m) => m.farm?.id === profile.active_farm_id)?.farm || null;
  }
  // Fall back to the first farm the user is a member of, if any
  if (!activeFarm && memberships?.length) {
    activeFarm = memberships[0].farm;
  }

  return {
    profile,
    memberships: memberships || [],
    activeFarm,
    error: null,
  };
}

// ─── Switch active farm ─────────────────────────────────────────────
export async function setActiveFarm(userId, farmId) {
  requireSupabase();
  const { error } = await supabase
    .from('profiles')
    .update({ active_farm_id: farmId })
    .eq('id', userId);
  return { error: friendlyError(error) };
}

// ─── Create farm (during onboarding) ────────────────────────────────
// Creates the farm, then creates the farm_members row making the creator
// the farm_owner, then sets active_farm_id on their profile.
// All three must succeed; if any fail the user can retry.
export async function createFarm({ userId, name, countryCode, currencyCode, city, phone }) {
  requireSupabase();

  // 1. Insert farm with owner_id = current user (RLS allows because
  //    `owner_id = auth.uid()`).
  const { data: farm, error: farmErr } = await supabase
    .from('farms')
    .insert({
      name,
      country_code: countryCode || null,
      currency_code: currencyCode || 'NGN',
      city: city || null,
      phone: phone || null,
      owner_id: userId,
    })
    .select()
    .single();
  if (farmErr) return { farm: null, error: friendlyError(farmErr) };

  // 2. Add the creator as a farm_owner member. RLS allows because the
  //    farms row was just created with owner_id = auth.uid().
  const { error: memberErr } = await supabase
    .from('farm_members')
    .insert({
      farm_id: farm.id,
      user_id: userId,
      role: 'farm_owner',
    });
  if (memberErr) return { farm: null, error: friendlyError(memberErr) };

  // 3. Set as active farm on the user's profile.
  await setActiveFarm(userId, farm.id);

  return { farm, error: null };
}
