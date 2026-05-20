import React, { useState } from 'react';
import { useAuth } from '../AuthProvider.jsx';
import { AuthShell, Field, Input, Button, Alert, T } from './_primitives.jsx';

export default function ForgotPasswordScreen({ onNavigate }) {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async (e) => {
    e?.preventDefault();
    if (!email) { setErr('Enter your email.'); return; }
    setBusy(true); setErr(null);
    const { ok, error } = await requestPasswordReset(email);
    setBusy(false);
    if (!ok) setErr(error);
    else setSent(true);
  };

  if (sent) {
    return (
      <AuthShell>
        <div style={{ fontSize: 22, fontWeight: 700, color: T.ink, marginBottom: 8, letterSpacing: -0.3 }}>Check your email</div>
        <div style={{ fontSize: 14, color: T.ink2, lineHeight: 1.6, marginBottom: 18 }}>
          If an account exists for <strong>{email}</strong>, we've sent a password reset link. Open it to set a new password.
        </div>
        <Button onClick={() => onNavigate('signin')}>Back to sign in</Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div style={{ fontSize: 22, fontWeight: 700, color: T.ink, marginBottom: 6, letterSpacing: -0.3 }}>Reset password</div>
      <div style={{ fontSize: 13, color: T.ink3, marginBottom: 22 }}>Enter your email and we'll send a reset link.</div>
      <Alert kind="error">{err}</Alert>
      <form onSubmit={submit}>
        <Field label="Email">
          <Input type="email" value={email} onChange={setEmail} autoComplete="email" required autoFocus />
        </Field>
        <Button type="submit" disabled={busy}>
          {busy ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
      <div style={{ marginTop: 22, textAlign: 'center', fontSize: 13, color: T.ink3 }}>
        <Button variant="link" full={false} onClick={() => onNavigate('signin')}>Back to sign in</Button>
      </div>
    </AuthShell>
  );
}
