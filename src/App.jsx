import React from 'react';
import PoultrySuiteAfrica from './components/PoultrySuiteAfrica.jsx';
import {
  ErrorScreen,
  OfflineBanner,
  useOnlineStatus,
} from './components/SystemStates.jsx';
import { CurrencyProvider, useCurrency } from './currency/index.js';
import { AuthProvider } from './auth/AuthProvider.jsx';
import AuthGate from './auth/AuthGate.jsx';

// Top-level error boundary — catches anything the inner ErrorBoundary
// inside PoultrySuiteAfrica.jsx misses, plus shows a polished error screen.
class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    try {
      const log = JSON.parse(
        window.localStorage.getItem('psa::error_log') || '[]'
      );
      log.unshift({
        ts: new Date().toISOString(),
        message: String(error?.message || error),
        stack: String(info?.componentStack || '').slice(0, 4000),
      });
      window.localStorage.setItem(
        'psa::error_log',
        JSON.stringify(log.slice(0, 25))
      );
    } catch (_) {}
  }
  render() {
    if (this.state.hasError) {
      const details = [
        this.state.error?.message,
        this.state.error?.stack,
      ]
        .filter(Boolean)
        .join('\n\n');
      return (
        <ErrorScreen
          kind="crash"
          details={details}
          secondaryLabel="Clear local data & reload"
          onSecondary={() => {
            try {
              window.localStorage.removeItem('psa::error_log');
              window.localStorage.removeItem('psa::__psState');
            } catch (_) {}
            window.location.reload();
          }}
        />
      );
    }
    return this.props.children;
  }
}

// Bridge between CurrencyProvider and the rest of the app.
// By calling useCurrency() here, this component subscribes to currency
// changes — so the entire <PoultrySuiteAfrica> subtree re-renders whenever
// the user picks a new currency or country.
function CurrencyBridgedApp() {
  useCurrency();
  return <PoultrySuiteAfrica />;
}

export default function App() {
  const online = useOnlineStatus();
  return (
    <RootErrorBoundary>
      <OfflineBanner visible={!online} />
      <div style={{ paddingTop: online ? 0 : 38 }}>
        {/* AuthProvider wraps the whole app so any component can call useAuth() */}
        <AuthProvider>
          {/* AuthGate decides what to render based on auth status:
              loading → spinner
              unauthenticated → sign-in / sign-up screens
              unverified → "check your email" screen
              authenticated + no farm → onboarding
              authenticated + has farm → the actual app (children) */}
          <AuthGate>
            <CurrencyProvider>
              <CurrencyBridgedApp />
            </CurrencyProvider>
          </AuthGate>
        </AuthProvider>
      </div>
    </RootErrorBoundary>
  );
}
