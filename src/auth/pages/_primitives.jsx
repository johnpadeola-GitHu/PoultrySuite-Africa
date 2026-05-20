// Shared visual primitives for auth screens.
// Plain JSX, inline styles to match the rest of the codebase.
import React from 'react';

export const T = {
  bg: '#F9FAFB',
  card: '#FFFFFF',
  ink: '#111827',
  ink2: '#374151',
  ink3: '#6B7280',
  ink4: '#9CA3AF',
  line: '#E5E7EB',
  accent: '#1F2937',
  accentText: '#FFFFFF',
  err: '#B91C1C',
  errBg: '#FEF2F2',
  ok: '#15803D',
  okBg: '#F0FDF4',
};

export function AuthShell({ children }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 20px',
      background: T.bg,
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <Brand />
        <div style={{
          background: T.card,
          border: `1px solid ${T.line}`,
          padding: 'clamp(24px, 5vw, 36px)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div style={{ textAlign: 'center', marginBottom: 28 }}>
      <div style={{
        width: 48, height: 48, margin: '0 auto 12px',
        background: T.accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
          <path d="M16 6c-4 0-7 5-7 11a7 7 0 0 0 14 0c0-6-3-11-7-11z" fill="#F4C95D"/>
          <path d="M14 14c0-1.5 1-3 2.5-3" stroke="#B8893B" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: T.ink, letterSpacing: -0.3 }}>PoultrySuite Africa</div>
      <div style={{ fontSize: 12, color: T.ink3, marginTop: 2 }}>Farm Management for African Producers</div>
    </div>
  );
}

export function Field({ label, error, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: T.ink2, letterSpacing: 0.2 }}>{label}</span>
      {children}
      {error && <span style={{ fontSize: 12, color: T.err }}>{error}</span>}
    </label>
  );
}

export function Input({ value, onChange, type = 'text', placeholder, autoComplete, required, autoFocus }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      required={required}
      autoFocus={autoFocus}
      style={{
        padding: '11px 12px',
        fontSize: 14,
        border: `1px solid ${T.line}`,
        background: '#FFF',
        color: T.ink,
        width: '100%',
        outline: 'none',
        fontFamily: 'inherit',
        minHeight: 44,
      }}
      onFocus={(e) => (e.target.style.borderColor = T.accent)}
      onBlur={(e) => (e.target.style.borderColor = T.line)}
    />
  );
}

export function Button({ children, onClick, type = 'button', disabled, variant = 'primary', full = true }) {
  const styles = {
    primary: { background: T.accent, color: T.accentText, border: 'none' },
    ghost:   { background: 'transparent', color: T.ink2, border: `1px solid ${T.line}` },
    link:    { background: 'transparent', color: T.accent, border: 'none', padding: 0, fontWeight: 600 },
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...styles,
        padding: variant === 'link' ? 0 : '12px 18px',
        fontSize: 14,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        width: full && variant !== 'link' ? '100%' : 'auto',
        minHeight: variant === 'link' ? 'auto' : 44,
        opacity: disabled ? 0.6 : 1,
        transition: 'opacity 0.15s',
      }}
    >
      {children}
    </button>
  );
}

export function Alert({ kind = 'error', children }) {
  if (!children) return null;
  const palette = {
    error: { bg: T.errBg, fg: T.err, border: '#FECACA' },
    ok:    { bg: T.okBg,  fg: T.ok,  border: '#BBF7D0' },
  }[kind];
  return (
    <div style={{
      background: palette.bg,
      color: palette.fg,
      border: `1px solid ${palette.border}`,
      padding: '10px 14px',
      fontSize: 13,
      lineHeight: 1.5,
      marginBottom: 16,
    }}>
      {children}
    </div>
  );
}
