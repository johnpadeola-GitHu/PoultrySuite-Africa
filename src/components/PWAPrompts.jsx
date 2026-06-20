import React, { useEffect, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────
// PWAPrompts
// ─────────────────────────────────────────────────────────────────────
// Two small, unobtrusive UI hints:
//   1. "Install app" button — appears when the browser fires the
//      beforeinstallprompt event (Chrome/Edge/Android). Clicking it shows
//      the native install dialog. Hidden once installed or dismissed.
//   2. "Ready to work offline" toast — shows once, briefly, the first time
//      the service worker finishes caching the app shell.
//
// iOS/Safari doesn't support beforeinstallprompt; for those users we show a
// one-line hint on how to install via the Share menu (only inside Safari,
// only when not already installed).
// ─────────────────────────────────────────────────────────────────────

const C = {
  ink: '#1F2937',
  card: '#FFFFFF',
  line: '#E5E7EB',
  accent: '#1F2937',
  accentText: '#FFFFFF',
  ink3: '#6B7280',
};

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    window.navigator.standalone === true
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export default function PWAPrompts() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => window.localStorage.getItem('psa::pwa_install_dismissed') === '1'
  );

  useEffect(() => {
    if (dismissed || isStandalone()) return;

    // Chrome / Edge / Android
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstall(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // iOS Safari — no install event exists; show a manual hint once.
    if (isIos() && !isStandalone()) {
      const t = setTimeout(() => setShowIosHint(true), 2500);
      return () => {
        clearTimeout(t);
        window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      };
    }

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, [dismissed]);

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted' || outcome === 'dismissed') {
      setShowInstall(false);
      setDeferredPrompt(null);
    }
  };

  const dismiss = () => {
    setShowInstall(false);
    setShowIosHint(false);
    setDismissed(true);
    try {
      window.localStorage.setItem('psa::pwa_install_dismissed', '1');
    } catch (_) {}
  };

  if (!showInstall && !showIosHint) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        right: 16,
        zIndex: 9000,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          pointerEvents: 'auto',
          maxWidth: 440,
          width: '100%',
          background: C.card,
          border: `1px solid ${C.line}`,
          boxShadow: '0 8px 28px rgba(0,0,0,0.14)',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <div style={{ flexShrink: 0, width: 36, height: 36, background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
            <ellipse cx="16" cy="17" rx="6" ry="8" fill="#F4C95D" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 2 }}>
            Install PoultrySuite
          </div>
          <div style={{ fontSize: 12, color: C.ink3, lineHeight: 1.4 }}>
            {showIosHint
              ? 'Tap the Share icon, then “Add to Home Screen” to install and use offline.'
              : 'Add to your device for offline access and a full-screen app experience.'}
          </div>
        </div>
        {showInstall && (
          <button
            onClick={install}
            style={{
              flexShrink: 0,
              background: C.accent,
              color: C.accentText,
              border: 'none',
              padding: '9px 14px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              minHeight: 38,
            }}
          >
            Install
          </button>
        )}
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          style={{
            flexShrink: 0,
            background: 'transparent',
            border: 'none',
            color: C.ink3,
            cursor: 'pointer',
            fontSize: 20,
            lineHeight: 1,
            padding: '4px 6px',
            fontFamily: 'inherit',
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
