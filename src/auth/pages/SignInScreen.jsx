import React, { useState } from 'react';
import { useAuth } from '../AuthProvider.jsx';
import { AuthShell, Field, Input, Button, Alert, T } from './_primitives.jsx';

export default function SignInScreen({ onNavigate }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e?.preventDefault();
    if (!email || !password) {
      setErr('Enter your email and password.');
      return;
    }
    setBusy(true);
    setErr(null);
    const { ok, error } = await signIn({ email, password });
    setBusy(false);
    if (!ok) setErr(error);
  };

  return (
    <AuthShell>
      <div style={{ fontSize: 22, fontWeight: 700, color: T.ink, marginBottom: 6, letterSpacing: -0.3 }}>Welcome back</div>
      <div style={{ fontSize: 13, color: T.ink3, marginBottom: 22 }}>Sign in to your PoultrySuite account.</div>
      <Alert kind="error">{err}</Alert>
      <form onSubmit={submit}>
        <Field label="Email">
          <Input type="email" value={email} onChange={setEmail} autoComplete="email" required autoFocus />
        </Field>
        <Field label="Password">
          <Input type="password" value={password} onChange={setPassword} autoComplete="current-password" required />
        </Field>
        <div style={{ marginBottom: 18, textAlign: 'right' }}>
          <Button variant="link" full={false} onClick={() => onNavigate('forgot')}>
            Forgot password?
          </Button>
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${T.line}`, textAlign: 'center', fontSize: 13, color: T.ink3 }}>
        Don't have an account?{' '}
        <Button variant="link" full={false} onClick={() => onNavigate('signup')}>Sign up</Button>
      </div>
    </AuthShell>
  );
}
