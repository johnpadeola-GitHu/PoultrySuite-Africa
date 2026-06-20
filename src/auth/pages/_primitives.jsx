import React from 'react';

export const T = {
  bg: '#F9FAFB', card: '#FFFFFF', ink: '#111827', ink2: '#374151', ink3: '#6B7280',
  line: '#E5E7EB', accent: '#1F2937', accentText: '#FFFFFF',
  err: '#B91C1C', errBg: '#FEF2F2', ok: '#15803D', okBg: '#F0FDF4',
};

export function AuthShell({ children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', background: T.bg }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src="./pwa-192x192.png" alt="PoultrySuite Africa"
            style={{ width: 64, height: 64, margin: '0 auto 12px', display: 'block', objectFit: 'contain' }} />
          <div style={{ fontSize: 20, fontWeight: 700, color: T.ink }}>PoultrySuite Africa</div>
          <div style={{ fontSize: 12, color: T.ink3, marginTop: 2 }}>Farm Management</div>
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.line}`, padding: 'clamp(24px,5vw,36px)' }}>{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: T.ink2 }}>{label}</span>
      {children}
    </label>
  );
}

export function Input(props) {
  return (
    <input {...props} onChange={(e) => props.onChange(e.target.value)}
      style={{ padding: '12px', fontSize: 16, border: `1px solid ${T.line}`, background: '#FFF', color: T.ink, width: '100%', outline: 'none', fontFamily: 'inherit', minHeight: 46 }} />
  );
}

export function Button({ children, onClick, type = 'button', disabled, variant = 'primary' }) {
  const s = variant === 'link'
    ? { background: 'transparent', color: T.accent, border: 'none', padding: 0, fontWeight: 600, width: 'auto', minHeight: 'auto' }
    : variant === 'ghost'
      ? { background: 'transparent', color: T.ink2, border: `1px solid ${T.line}`, padding: '12px 18px', width: '100%', minHeight: 46 }
      : { background: T.accent, color: T.accentText, border: 'none', padding: '12px 18px', width: '100%', minHeight: 46 };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      style={{ ...s, fontSize: 14, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: disabled ? 0.6 : 1 }}>
      {children}
    </button>
  );
}

export function Alert({ kind = 'error', children }) {
  if (!children) return null;
  const p = kind === 'ok' ? { bg: T.okBg, fg: T.ok, b: '#BBF7D0' } : { bg: T.errBg, fg: T.err, b: '#FECACA' };
  return <div style={{ background: p.bg, color: p.fg, border: `1px solid ${p.b}`, padding: '10px 14px', fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>{children}</div>;
}
