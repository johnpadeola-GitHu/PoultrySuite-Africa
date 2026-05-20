import React from 'react';

// ───────────────────────────────────────────────────────────
// Reusable system-state UI: offline banner, error screens,
// skeleton loaders. Used app-wide for graceful failure modes.
// ───────────────────────────────────────────────────────────

const C = {
  bg: '#F9FAFB',
  card: '#FFFFFF',
  ink: '#111827',
  ink2: '#374151',
  ink3: '#6B7280',
  ink4: '#9CA3AF',
  line: '#E5E7EB',
  err: '#B91C1C',
  errBg: '#FEF2F2',
  warn: '#92400E',
  warnBg: '#FEF3C7',
  accent: '#1F2937',
};

const wrap = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  padding: '40px 20px',
  background: C.bg,
};

const card = {
  background: C.card,
  border: `1px solid ${C.line}`,
  maxWidth: 520,
  width: '100%',
  padding: '40px 36px 32px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 14,
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};

const eyebrow = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 2,
  textTransform: 'uppercase',
};

const h1 = {
  fontSize: 24,
  fontWeight: 700,
  color: C.ink,
  letterSpacing: -0.3,
  lineHeight: 1.2,
};

const body = {
  fontSize: 14,
  color: C.ink3,
  lineHeight: 1.6,
};

const btn = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  background: C.accent,
  color: '#fff',
  border: 'none',
  padding: '11px 20px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
  minHeight: 42,
};

const btnGhost = {
  ...btn,
  background: 'transparent',
  color: C.ink2,
  border: `1px solid ${C.line}`,
};

// ─── Skeleton primitive ───
export function Skeleton({ width = '100%', height = 14, style = {} }) {
  return (
    <div
      className="ps-skel"
      style={{
        width,
        height,
        ...style,
      }}
      aria-hidden="true"
    />
  );
}

// ─── Dashboard skeleton (rendered while module data loads) ───
export function DashboardSkeleton() {
  return (
    <div style={{ padding: '24px 20px', background: C.bg, minHeight: 400 }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 22 }}>
        <Skeleton width={140} height={32} />
        <Skeleton width={90} height={32} />
        <Skeleton width={90} height={32} />
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))',
          gap: 14,
          marginBottom: 22,
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              background: C.card,
              border: `1px solid ${C.line}`,
              padding: '18px 18px 22px',
            }}
          >
            <Skeleton width="60%" height={11} style={{ marginBottom: 14 }} />
            <Skeleton width="42%" height={26} style={{ marginBottom: 8 }} />
            <Skeleton width="80%" height={10} />
          </div>
        ))}
      </div>
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.line}`,
          padding: '20px',
          marginBottom: 14,
        }}
      >
        <Skeleton width="35%" height={14} style={{ marginBottom: 16 }} />
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 12,
              padding: '10px 0',
              borderTop: i > 0 ? `1px solid ${C.line}` : 'none',
            }}
          >
            <Skeleton width={28} height={28} />
            <div style={{ flex: 1 }}>
              <Skeleton width="50%" height={12} style={{ marginBottom: 6 }} />
              <Skeleton width="80%" height={10} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Generic error screen (used by ErrorBoundary and route guards) ───
export function ErrorScreen({
  kind = 'crash', // 'crash' | 'offline' | 'session' | 'permission' | 'network'
  title,
  message,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  details,
}) {
  const presets = {
    crash: {
      eyebrowColor: C.err,
      eyebrowText: 'Application Error',
      title: 'Something went wrong',
      message:
        "An unexpected error occurred. Your data is safe — it's stored locally and was not lost. Try reloading the page to recover.",
      primary: 'Reload application',
      onPrimary: () => window.location.reload(),
    },
    offline: {
      eyebrowColor: C.warn,
      eyebrowText: 'You are offline',
      title: 'No internet connection',
      message:
        "You can keep working — PoultrySuite stores your data locally on this device. Changes will sync when your connection returns.",
      primary: 'Retry connection',
      onPrimary: () => window.location.reload(),
    },
    session: {
      eyebrowColor: C.warn,
      eyebrowText: 'Session expired',
      title: "You've been logged out",
      message:
        'Your session ended due to inactivity. Please sign in again to continue where you left off. Your data is unchanged.',
      primary: 'Sign in again',
      onPrimary: () => window.location.reload(),
    },
    permission: {
      eyebrowColor: C.err,
      eyebrowText: 'Access denied',
      title: 'You cannot view this page',
      message:
        "Your role doesn't have permission to access this resource. Contact your farm administrator if you believe this is a mistake.",
      primary: 'Go to dashboard',
      onPrimary: () => window.location.reload(),
    },
    network: {
      eyebrowColor: C.err,
      eyebrowText: 'Request failed',
      title: "We couldn't complete that action",
      message:
        'The request failed because of a network problem. Check your connection and try again — no data was changed.',
      primary: 'Try again',
      onPrimary: () => window.location.reload(),
    },
  };
  const p = presets[kind] || presets.crash;
  return (
    <div style={wrap}>
      <div style={card} role="alert">
        <div style={{ ...eyebrow, color: p.eyebrowColor }}>{p.eyebrowText}</div>
        <div style={h1}>{title || p.title}</div>
        <div style={body}>{message || p.message}</div>
        {details && (
          <details
            style={{
              fontSize: 12,
              color: C.ink4,
              background: C.bg,
              padding: '10px 14px',
              border: `1px solid ${C.line}`,
              width: '100%',
              fontFamily: 'JetBrains Mono, SF Mono, Menlo, monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: 220,
              overflow: 'auto',
            }}
          >
            <summary
              style={{
                cursor: 'pointer',
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, sans-serif',
                fontWeight: 600,
                color: C.ink2,
                marginBottom: 8,
              }}
            >
              Technical details
            </summary>
            {details}
          </details>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
          <button onClick={onPrimary || p.onPrimary} style={btn}>
            {primaryLabel || p.primary}
          </button>
          {secondaryLabel && onSecondary && (
            <button onClick={onSecondary} style={btnGhost}>
              {secondaryLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Offline banner (renders at top of screen when offline) ───
export function OfflineBanner({ visible }) {
  if (!visible) return null;
  return (
    <div className="ps-offline-banner" role="status" aria-live="polite">
      <span className="ps-offline-banner-dot" aria-hidden="true" />
      <span>
        You are offline — changes are saved locally and will continue working.
      </span>
    </div>
  );
}

// ─── Hook to track navigator.onLine ───
export function useOnlineStatus() {
  const [online, setOnline] = React.useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  React.useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}
