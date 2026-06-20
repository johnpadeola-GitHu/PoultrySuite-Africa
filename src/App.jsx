import React from 'react';
import PoultrySuiteAfrica from './components/PoultrySuiteAfrica.jsx';
import { ErrorScreen, OfflineBanner, useOnlineStatus } from './components/SystemStates.jsx';
import PWAPrompts from './components/PWAPrompts.jsx';
import { CurrencyProvider, useCurrency } from './currency/index.js';
import { AuthProvider, useAuth } from './auth/AuthProvider.jsx';
import AuthGate from './auth/AuthGate.jsx';
import DeviceGate from './devices/DeviceGate.jsx';
import PlatformDashboard from './billing/PlatformDashboard.jsx';

class RootErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) {
    try {
      const log = JSON.parse(window.localStorage.getItem('psa::error_log') || '[]');
      log.unshift({ ts: new Date().toISOString(), message: String(error?.message || error), stack: String(info?.componentStack || '').slice(0, 4000) });
      window.localStorage.setItem('psa::error_log', JSON.stringify(log.slice(0, 25)));
    } catch (_) {}
  }
  render() {
    if (this.state.hasError) {
      const details = [this.state.error?.message, this.state.error?.stack].filter(Boolean).join('\n\n');
      return (
        <ErrorScreen kind="crash" details={details} secondaryLabel="Clear local data & reload"
          onSecondary={() => { try { window.localStorage.removeItem('psa::error_log'); window.localStorage.removeItem('psa::__psState'); } catch (_) {} window.location.reload(); }} />
      );
    }
    return this.props.children;
  }
}

function CurrencyBridgedApp() {
  useCurrency();
  return <PoultrySuiteAfrica />;
}

// "Viewing as tenant" banner — shown only when a platform admin has drilled
// into a specific farm from the Platform > Tenants screen. Lets them get
// back to their own dashboard without signing out.
function ViewingAsBanner() {
  const { viewingFarm, exitTenantView } = useAuth();
  if (!viewingFarm) return null;
  return (
    <div style={{ background: '#1A2420', color: '#E8EDEA', borderBottom: '1px solid #3FB87F', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 12, fontFamily: 'inherit' }}>
      <span>👁 Viewing as tenant: <strong>{viewingFarm.name}</strong></span>
      <button onClick={exitTenantView} style={{ background: 'transparent', border: '1px solid #3FB87F', color: '#3FB87F', fontSize: 11, fontWeight: 700, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
        ← Back to platform
      </button>
    </div>
  );
}

// Decides between the Platform Admin dashboard and the normal tenant app,
// based on the authenticated user's role and current view mode. Device
// pairing and farm currency only make sense for the tenant view (they're
// about a specific farm's device fleet), so platform mode bypasses both.
//
// IMPORTANT SCOPE NOTE: "View as tenant" from the platform side shows a
// read-only summary (from platform_tenants_summary), NOT the full live
// module UI. Dropping a platform admin straight into PoultryOS/etc. would
// either have to bypass DeviceGate (risking them registering as a device
// on a customer's farm) or build a parallel read-only data path for every
// module — neither is safe to do as a quick addition. This keeps the
// feature honest about what it does today; a full read-through tenant
// view is a larger follow-up if you want it.
function ViewRouter() {
  const { isPlatformAdmin, viewMode, viewingFarm } = useAuth();

  if (isPlatformAdmin && viewMode === 'platform') {
    return <PlatformDashboard />;
  }

  if (isPlatformAdmin && viewMode === 'tenant' && viewingFarm) {
    return (
      <>
        <ViewingAsBanner />
        <TenantReadOnlySummary />
      </>
    );
  }

  return (
    <DeviceGate>
      <CurrencyProvider>
        <CurrencyBridgedApp />
      </CurrencyProvider>
    </DeviceGate>
  );
}

// Minimal read-only detail screen shown while a platform admin is "viewing"
// a tenant. Pulls the same row already loaded in the Tenants list rather
// than re-fetching, kept deliberately simple — see scope note above.
function TenantReadOnlySummary() {
  const { viewingFarm } = useAuth();
  return (
    <div style={{ minHeight: '100vh', background: '#0B0F0D', color: '#E8EDEA', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'inherit' }}>
      <div style={{ maxWidth: 420, textAlign: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>{viewingFarm?.name}</div>
        <div style={{ fontSize: 13, color: '#A8B5AE', lineHeight: 1.6 }}>
          Full read-through into this tenant's live modules isn't built yet —
          use the Tenants and Subscriptions tabs in the Platform dashboard for
          their account details. Tap "Back to platform" above to return.
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const online = useOnlineStatus();
  return (
    <RootErrorBoundary>
      <OfflineBanner visible={!online} />
      <div style={{ paddingTop: online ? 0 : 38 }}>
        <AuthProvider>
          <AuthGate>
            <ViewRouter />
          </AuthGate>
        </AuthProvider>
      </div>
      <PWAPrompts />
    </RootErrorBoundary>
  );
}
