// ─────────────────────────────────────────────────────────────────────
// AuthProvider + useAuth
// ─────────────────────────────────────────────────────────────────────
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase/client.js';
import {
  signIn as svcSignIn,
  signUp as svcSignUp,
  signOut as svcSignOut,
  requestPasswordReset as svcReset,
  loadAuthContext,
} from './authService.js';

const AuthContext = createContext(null);

const initial = {
  status: 'loading', // loading | unauthenticated | authenticated
  user: null,
  session: null,
  profile: null,
  memberships: [],
  activeFarm: null,
  role: null,
  isPlatformAdmin: false,
  // viewMode: 'platform' (platform admin's own dashboard) or 'tenant'
  // (viewing a specific farm — either their own, or "viewing as" a tenant
  // while in platform-admin override). Regular tenant users are always
  // 'tenant'. Platform admins default to 'platform' on login.
  viewMode: 'tenant',
  // When a platform admin clicks "View as tenant" on a farm they don't
  // belong to, this holds that farm so the UI can show it read-through
  // without altering the admin's real farm_members rows.
  viewingFarm: null,
  error: null,
};

export function AuthProvider({ children }) {
  const [state, setState] = useState(initial);
  const mounted = useRef(true);
  const set = useCallback((u) => { if (mounted.current) setState(u); }, []);

  const hydrate = useCallback(async (user) => {
    if (!user) { set({ ...initial, status: 'unauthenticated' }); return; }
    const ctx = await loadAuthContext(user.id);
    if (ctx.error) {
      set((s) => ({ ...s, status: 'authenticated', user, error: ctx.error }));
      return;
    }
    set((s) => ({
      ...s, status: 'authenticated', user,
      profile: ctx.profile, memberships: ctx.memberships,
      activeFarm: ctx.activeFarm, role: ctx.role,
      isPlatformAdmin: ctx.isPlatformAdmin,
      viewMode: ctx.isPlatformAdmin ? 'platform' : 'tenant',
      viewingFarm: null,
      error: null,
    }));
    // Expose the active farm id for the data-sync layer (read by modules).
    try { if (typeof window !== 'undefined') window.__psaActiveFarmId = ctx.activeFarm?.id || null; } catch (_) {}
  }, [set]);

  useEffect(() => {
    mounted.current = true;
    if (!isSupabaseConfigured) { set({ ...initial, status: 'unauthenticated' }); return; }

    supabase.auth.getSession().then(({ data: { session } }) => {
      set((s) => ({ ...s, session }));
      hydrate(session?.user || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      set((s) => ({ ...s, session }));
      hydrate(session?.user || null);
    });

    return () => { mounted.current = false; subscription.unsubscribe(); };
  }, [hydrate, set]);

  const signIn = useCallback(async (creds) => {
    set((s) => ({ ...s, error: null }));
    const { error } = await svcSignIn(creds);
    if (error) { set((s) => ({ ...s, error })); return { ok: false, error }; }
    return { ok: true };
  }, [set]);

  const signUp = useCallback(async (creds) => {
    set((s) => ({ ...s, error: null }));
    const { error } = await svcSignUp(creds);
    if (error) { set((s) => ({ ...s, error })); return { ok: false, error }; }
    return { ok: true };
  }, [set]);

  const signOut = useCallback(async () => {
    await svcSignOut();
    set({ ...initial, status: 'unauthenticated' });
  }, [set]);

  const requestPasswordReset = useCallback(async (email) => {
    const { error } = await svcReset(email);
    return { ok: !error, error };
  }, []);

  const refreshContext = useCallback(() => {
    if (state.user) return hydrate(state.user);
  }, [state.user, hydrate]);

  // Platform admin enters a specific tenant's view (read-through, doesn't
  // change their own farm_members rows). `farm` is a row from
  // platform_list_tenants() / platform_tenants_summary (has farm_id, farm_name...).
  const viewAsTenant = useCallback((farm) => {
    if (!state.isPlatformAdmin || !farm) return;
    const normalized = { id: farm.farm_id || farm.id, name: farm.farm_name || farm.name };
    set((s) => ({ ...s, viewMode: 'tenant', viewingFarm: normalized }));
    try { if (typeof window !== 'undefined') window.__psaActiveFarmId = normalized.id; } catch (_) {}
  }, [state.isPlatformAdmin, set]);

  // Return to the platform dashboard.
  const exitTenantView = useCallback(() => {
    set((s) => ({ ...s, viewMode: 'platform', viewingFarm: null }));
    try { if (typeof window !== 'undefined') window.__psaActiveFarmId = state.activeFarm?.id || null; } catch (_) {}
  }, [set, state.activeFarm]);

  const value = {
    ...state, isSupabaseConfigured,
    signIn, signUp, signOut, requestPasswordReset, refreshContext,
    viewAsTenant, exitTenantView,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
