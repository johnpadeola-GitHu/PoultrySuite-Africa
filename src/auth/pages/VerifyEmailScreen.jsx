import React, { useState } from 'react';
import { useAuth } from '../AuthProvider.jsx';
import { resendVerification } from '../authService.js';
import { AuthShell, Button, Alert, T } from './_primitives.jsx';

export default function VerifyEmailScreen({ email }) {
  const { signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState(null);

  const resend = async () => {
    setBusy(true); setErr(null);
    const { error } = await resendVerification(email);
    setBusy(false);
    if (error) setErr(error);
    else setSent(true);
  };

  return (
    <AuthShell>
      <div style={{ fontSize: 22, fontWeight: 700, color: T.ink, marginBottom: 8, letterSpacing: -0.3 }}>Verify your email</div>
      <div style={{ fontSize: 14, color: T.ink2, lineHeight: 1.6, marginBottom: 18 }}>
        We sent a verification link to <strong>{email}</strong>. Open it and click the link to activate your account.
      </div>
      <Alert kind="error">{err}</Alert>
      {sent && <Alert kind="ok">Verification email sent again. Check your inbox.</Alert>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Button onClick={resend} disabled={busy}>
          {busy ? 'Sending…' : 'Resend verification email'}
        </Button>
        <Button variant="ghost" onClick={signOut}>Sign out</Button>
      </div>
    </AuthShell>
  );
}
