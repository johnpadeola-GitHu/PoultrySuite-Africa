import React, { useState } from 'react';
import { updatePassword } from '../authService.js';
import { AuthShell, Field, Input, Button, Alert, T } from './_primitives.jsx';

export default function ResetPasswordScreen({ onNavigate }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async (e) => {
    e?.preventDefault();
    if (pw.length < 8) { setErr('Password must be at least 8 characters.'); return; }
    if (pw !== pw2)    { setErr('Passwords don\'t match.'); return; }
    setBusy(true); setErr(null);
    const { error } = await updatePassword(pw);
    setBusy(false);
    if (error) setErr(error);
    else setDone(true);
  };

  if (done) {
    return (
      <AuthShell>
        <Alert kind="ok">Password updated. You can now sign in with your new password.</Alert>
        <Button onClick={() => { window.location.hash = ''; onNavigate('signin'); }}>Sign in</Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div style={{ fontSize: 22, fontWeight: 700, color: T.ink, marginBottom: 6, letterSpacing: -0.3 }}>Set a new password</div>
      <div style={{ fontSize: 13, color: T.ink3, marginBottom: 22 }}>Choose a strong password (8+ characters).</div>
      <Alert kind="error">{err}</Alert>
      <form onSubmit={submit}>
        <Field label="New password">
          <Input type="password" value={pw} onChange={setPw} autoComplete="new-password" required autoFocus />
        </Field>
        <Field label="Confirm new password">
          <Input type="password" value={pw2} onChange={setPw2} autoComplete="new-password" required />
        </Field>
        <Button type="submit" disabled={busy}>
          {busy ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </AuthShell>
  );
}
