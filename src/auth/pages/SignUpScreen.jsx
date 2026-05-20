import React, { useState } from 'react';
import { useAuth } from '../AuthProvider.jsx';
import { AuthShell, Field, Input, Button, Alert, T } from './_primitives.jsx';

export default function SignUpScreen({ onNavigate }) {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e?.preventDefault();
    if (!fullName || !email || !password) {
      setErr('Please complete all fields.');
      return;
    }
    if (password.length < 8) {
      setErr('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    setErr(null);
    const { ok, error } = await signUp({ email, password, fullName });
    setBusy(false);
    if (!ok) {
      setErr(error);
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <AuthShell>
        <div style={{ fontSize: 22, fontWeight: 700, color: T.ink, marginBottom: 8, letterSpacing: -0.3 }}>Almost there</div>
        <div style={{ fontSize: 14, color: T.ink2, lineHeight: 1.6, marginBottom: 18 }}>
          We sent a verification link to <strong>{email}</strong>. Click the link in that email to activate your account, then sign in.
        </div>
        <Alert kind="ok">If you don't see the email in a few minutes, check your spam folder.</Alert>
        <Button onClick={() => onNavigate('signin')}>Back to sign in</Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div style={{ fontSize: 22, fontWeight: 700, color: T.ink, marginBottom: 6, letterSpacing: -0.3 }}>Create your account</div>
      <div style={{ fontSize: 13, color: T.ink3, marginBottom: 22 }}>Start your free trial. No card required.</div>
      <Alert kind="error">{err}</Alert>
      <form onSubmit={submit}>
        <Field label="Full name">
          <Input value={fullName} onChange={setFullName} autoComplete="name" required autoFocus />
        </Field>
        <Field label="Email">
          <Input type="email" value={email} onChange={setEmail} autoComplete="email" required />
        </Field>
        <Field label="Password (8+ characters)">
          <Input type="password" value={password} onChange={setPassword} autoComplete="new-password" required />
        </Field>
        <Button type="submit" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
      <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${T.line}`, textAlign: 'center', fontSize: 13, color: T.ink3 }}>
        Already have an account?{' '}
        <Button variant="link" full={false} onClick={() => onNavigate('signin')}>Sign in</Button>
      </div>
    </AuthShell>
  );
}
