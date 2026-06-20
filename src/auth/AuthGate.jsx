import React from 'react';
import { useAuth } from './AuthProvider.jsx';
import { isSupabaseConfigured } from '../lib/supabase/client.js';
import AuthScreen from './pages/AuthScreen.jsx';
import IdleLock from './IdleLock.jsx';

const wrap = {
  minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexDirection: 'column', gap: 16, background: '#F9FAFB', color: '#6B7280', padding: '0 20px', textAlign: 'center',
};

function NotConfigured() {
  return (
    <div style={wrap}>
      <div style={{ maxWidth: 460, background: '#FFF', border: '1px solid #E5E7EB', padding: 28 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Setup required</div>
        <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6 }}>
          This deployment is missing its Supabase credentials. Set VITE_SUPABASE_URL and
          VITE_SUPABASE_ANON_KEY in Cloudflare Pages → Settings → Environment variables, then redeploy.
        </div>
      </div>
    </div>
  );
}

export default function AuthGate({ children }) {
  const { status } = useAuth();

  if (!isSupabaseConfigured) return <NotConfigured />;
  if (status === 'loading') {
    return <div style={wrap}><div style={{ fontSize: 14, fontWeight: 500 }}>Loading…</div></div>;
  }
  if (status === 'unauthenticated') return <AuthScreen />;
  // authenticated — the auto-provision trigger guarantees a farm exists
  return <IdleLock>{children}</IdleLock>;
}
