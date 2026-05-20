// ─────────────────────────────────────────────────────────────────────
// AuthGate — top-level routing based on auth status
// ─────────────────────────────────────────────────────────────────────
// Renders the right screen based on the auth state machine:
//   loading           → spinner
//   unauthenticated   → sign-in / sign-up
//   unverified        → "check your email" screen
//   authenticated     → either onboarding (no farm yet) or the main app
//
// This replaces React Router for now. Phase 2 of full SaaS will introduce
// React Router for nested routes; for Phase 1, top-level state machine is
// sufficient and avoids the extra dependency.
//
// Also handles password-recovery flow: when Supabase fires the
// PASSWORD_RECOVERY event (after the user clicks the email link), we
// route to the reset-password screen instead of the app.
// ─────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider.jsx';
import { supabase, isSupabaseConfigured } from '../lib/supabase/client.js';
import SignInScreen from './pages/SignInScreen.jsx';
import SignUpScreen from './pages/SignUpScreen.jsx';
import VerifyEmailScreen from './pages/VerifyEmailScreen.jsx';
import ResetPasswordScreen from './pages/ResetPasswordScreen.jsx';
import ForgotPasswordScreen from './pages/ForgotPasswordScreen.jsx';
import OnboardFarmScreen from './pages/OnboardFarmScreen.jsx';

function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 18,
      background: '#F9FAFB',
      color: '#6B7280',
    }}>
      <div className="loading-mark" aria-hidden="true" />
      <div style={{ fontSize: 14, fontWeight: 500 }}>Loading your session…</div>
    </div>
  );
}

function SupabaseNotConfiguredScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, background: '#F9FAFB' }}>
      <div style={{ maxWidth: 560, background: '#FFF', border: '1px solid #E5E7EB', padding: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#B91C1C', marginBottom: 10 }}>Setup required</div>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}>Supabase isn't connected yet</div>
        <div style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6, marginBottom: 16 }}>
          This deployment is missing <code style={{ background: '#F3F4F6', padding: '2px 6px' }}>VITE_SUPABASE_URL</code> and{' '}
          <code style={{ background: '#F3F4F6', padding: '2px 6px' }}>VITE_SUPABASE_ANON_KEY</code> environment variables.
        </div>
        <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>
          See <code style={{ background: '#F3F4F6', padding: '2px 6px' }}>docs/PHASE1_SETUP.md</code> for the full setup guide.
        </div>
      </div>
    </div>
  );
}

export default function AuthGate({ children }) {
  const { status, user, memberships, error } = useAuth();
  const [route, setRoute] = useState('signin'); // 'signin' | 'signup' | 'forgot' | 'reset'

  // Listen for the PASSWORD_RECOVERY event so we can show the reset screen.
  // Supabase fires this when the user opens the reset link from email.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRoute('reset');
    });
    // Also check the URL: Supabase sometimes lands on #access_token=... after reset
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) setRoute('reset');
    return () => subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured) return <SupabaseNotConfiguredScreen />;
  if (status === 'loading') return <LoadingScreen />;

  if (status === 'unverified') {
    return <VerifyEmailScreen email={user?.email} />;
  }

  if (status === 'unauthenticated') {
    if (route === 'signup')   return <SignUpScreen onNavigate={setRoute} />;
    if (route === 'forgot')   return <ForgotPasswordScreen onNavigate={setRoute} />;
    if (route === 'reset')    return <ResetPasswordScreen onNavigate={setRoute} />;
    return <SignInScreen onNavigate={setRoute} error={error} />;
  }

  // Authenticated. If the user has no farms yet, show onboarding.
  if (status === 'authenticated') {
    if (route === 'reset') return <ResetPasswordScreen onNavigate={setRoute} />;
    if (!memberships || memberships.length === 0) {
      return <OnboardFarmScreen />;
    }
    return children;
  }

  return <LoadingScreen />;
}
