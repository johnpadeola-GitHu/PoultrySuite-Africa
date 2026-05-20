// ─────────────────────────────────────────────────────────────────────
// AuthProvider + useAuth
// ─────────────────────────────────────────────────────────────────────
// Global auth state. Wraps the app and exposes:
//   - status: 'loading' | 'unauthenticated' | 'unverified' | 'authenticated'
//   - user: Supabase user object | null
//   - profile: row from public.profiles | null
//   - memberships: [{ role, farm }] | []
//   - activeFarm: farm object | null
//   - signIn / signUp / signOut / refreshContext (action methods)
//
// Behavior:
//   - On mount: read existing session from Supabase (resumed from storage)
//   - Listen for auth state changes (login/logout in another tab, token refresh)
//   - Auto-load profile + memberships whenever the user changes
// ─────────────────────────────────────────────────────────────────────
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase/client.js';
import {
  signIn as svcSignIn,
  signUp as svcSignUp,
  signOut as svcSignOut,
  loadAuthContext,
  setActiveFarm as svcSetActiveFarm,
  createFarm as svcCreateFarm,
  requestPasswordReset as svcRequestPasswordReset,
} from './authService.js';

const AuthContext = createContext(null);

const initialState = {
  status: 'loading',  // 'loading' | 'unauthenticated' | 'unverified' | 'authenticated'
  user: null,
  session: null,
  profile: null,
  memberships: [],
  activeFarm: null,
  error: null,
};

export function AuthProvider({ children }) {
  const [state, setState] = useState(initialState);
  const mountedRef = useRef(true);

  // Helper that's safe to call from async code — bails if unmounted
  const safeSet = useCallback((updater) => {
    if (mountedRef.current) setState(updater);
  }, []);

  // ─── Hydrate the user's profile + memberships from Supabase ───
  const hydrateContext = useCallback(async (user) => {
    if (!user) {
      safeSet({ ...initialState, status: 'unauthenticated' });
      return;
    }
    // If email is not yet confirmed, hold them in 'unverified' state.
    // Email confirmation is enabled by default in Supabase; users see a
    // "check your email" screen until they click the link.
    if (!user.email_confirmed_at && !user.confirmed_at) {
      safeSet((s) => ({ ...s, status: 'unverified', user, profile: null, memberships: [], activeFarm: null }));
      return;
    }

    const ctx = await loadAuthContext(user.id);
    if (ctx.error) {
      safeSet((s) => ({ ...s, status: 'authenticated', user, error: ctx.error, profile: null, memberships: [], activeFarm: null }));
      return;
    }
    safeSet((s) => ({
      ...s,
      status: 'authenticated',
      user,
      profile: ctx.profile,
      memberships: ctx.memberships,
      activeFarm: ctx.activeFarm,
      error: null,
    }));
  }, [safeSet]);

  // ─── On mount: pick up any existing session, subscribe to changes ───
  useEffect(() => {
    mountedRef.current = true;

    if (!isSupabaseConfigured) {
      safeSet({ ...initialState, status: 'unauthenticated' });
      return () => { mountedRef.current = false; };
    }

    // 1. Read current session synchronously from storage
    supabase.auth.getSession().then(({ data: { session } }) => {
      safeSet((s) => ({ ...s, session }));
      hydrateContext(session?.user || null);
    });

    // 2. Subscribe to auth state changes (sign-in in another tab, token refresh,
    //    password recovery, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        safeSet((s) => ({ ...s, session }));
        // PASSWORD_RECOVERY events arrive with a session — let the consumer
        // (the reset-password screen) handle them via the session.
        hydrateContext(session?.user || null);
      }
    );

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [hydrateContext, safeSet]);

  // ─── Public action methods ──────────────────────────────────────
  const signIn = useCallback(async ({ email, password }) => {
    safeSet((s) => ({ ...s, error: null }));
    const { session, error } = await svcSignIn({ email, password });
    if (error) {
      safeSet((s) => ({ ...s, error }));
      return { ok: false, error };
    }
    // onAuthStateChange will fire and hydrate; we just return success
    return { ok: true, session };
  }, [safeSet]);

  const signUp = useCallback(async ({ email, password, fullName }) => {
    safeSet((s) => ({ ...s, error: null }));
    const { user, error } = await svcSignUp({ email, password, fullName });
    if (error) {
      safeSet((s) => ({ ...s, error }));
      return { ok: false, error };
    }
    return { ok: true, user };
  }, [safeSet]);

  const signOut = useCallback(async () => {
    await svcSignOut();
    safeSet({ ...initialState, status: 'unauthenticated' });
  }, [safeSet]);

  const requestPasswordReset = useCallback(async (email) => {
    const { error } = await svcRequestPasswordReset(email);
    if (error) safeSet((s) => ({ ...s, error }));
    return { ok: !error, error };
  }, [safeSet]);

  const createFarm = useCallback(async (input) => {
    if (!state.user) return { ok: false, error: 'Not signed in' };
    const { farm, error } = await svcCreateFarm({ userId: state.user.id, ...input });
    if (error) {
      safeSet((s) => ({ ...s, error }));
      return { ok: false, error };
    }
    // Re-hydrate so memberships + activeFarm pick up the new farm
    await hydrateContext(state.user);
    return { ok: true, farm };
  }, [state.user, safeSet, hydrateContext]);

  const switchFarm = useCallback(async (farmId) => {
    if (!state.user) return { ok: false };
    await svcSetActiveFarm(state.user.id, farmId);
    await hydrateContext(state.user);
    return { ok: true };
  }, [state.user, hydrateContext]);

  const refreshContext = useCallback(() => {
    if (state.user) return hydrateContext(state.user);
  }, [state.user, hydrateContext]);

  const value = {
    ...state,
    isSupabaseConfigured,
    signIn,
    signUp,
    signOut,
    requestPasswordReset,
    createFarm,
    switchFarm,
    refreshContext,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be called inside <AuthProvider>');
  return ctx;
}

// Convenience hook for components that need the active farm
export function useActiveFarm() {
  const { activeFarm } = useAuth();
  return activeFarm;
}

// Convenience hook for role checks
export function useFarmRole() {
  const { memberships, activeFarm } = useAuth();
  if (!activeFarm) return null;
  return memberships.find((m) => m.farm?.id === activeFarm.id)?.role || null;
}
