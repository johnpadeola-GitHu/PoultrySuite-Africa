import React, { useState } from 'react';
import { useAuth } from '../AuthProvider.jsx';
import { AuthShell, Field, Input, Button, Alert, T } from './_primitives.jsx';

export default function AuthScreen() {
  const { signIn, signUp, requestPasswordReset } = useAuth();
  const [mode, setMode] = useState('signin'); // signin | signup | forgot
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(null);
  const [busy, setBusy] = useState(false);

  const reset = () => { setErr(null); setOk(null); };

  const submit = async (e) => {
    e?.preventDefault();
    reset();
    if (mode === 'forgot') {
      if (!email) { setErr('Enter your email.'); return; }
      setBusy(true);
      const r = await requestPasswordReset(email);
      setBusy(false);
      // Whether or not the email backend is configured, give a calm message and
      // a support fallback rather than a raw technical error.
      if (r.ok) setOk('If an account exists, a reset link has been sent. If you don\'t receive it, contact support@agorox.africa.');
      else setOk('If an account exists, a reset link has been sent. If you don\'t receive it, contact support@agorox.africa.');
      return;
    }
    if (!email || !password || (mode === 'signup' && !fullName)) {
      setErr('Please complete all fields.'); return;
    }
    if (mode === 'signup' && password.length < 8) {
      setErr('Password must be at least 8 characters.'); return;
    }
    setBusy(true);
    const r = mode === 'signup'
      ? await signUp({ email, password, fullName })
      : await signIn({ email, password });
    setBusy(false);
    if (!r.ok) setErr(r.error);
    // On success, AuthProvider's listener takes over and the app renders.
  };

  return (
    <AuthShell>
      <div style={{ fontSize: 22, fontWeight: 700, color: T.ink, marginBottom: 6 }}>
        {mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : 'Reset password'}
      </div>
      <div style={{ fontSize: 13, color: T.ink3, marginBottom: 22 }}>
        {mode === 'signin' ? 'Sign in to your farm.' : mode === 'signup' ? 'Start managing your farm.' : "We'll email you a reset link."}
      </div>
      <Alert kind="error">{err}</Alert>
      <Alert kind="ok">{ok}</Alert>
      <form onSubmit={submit}>
        {mode === 'signup' && (
          <Field label="Full name"><Input type="text" value={fullName} onChange={setFullName} autoComplete="name" /></Field>
        )}
        <Field label="Email"><Input type="email" value={email} onChange={setEmail} autoComplete="email" /></Field>
        {mode !== 'forgot' && (
          <Field label="Password"><Input type="password" value={password} onChange={setPassword} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} /></Field>
        )}
        {mode === 'signin' && (
          <div style={{ marginBottom: 16, textAlign: 'right' }}>
            <Button variant="link" onClick={() => { reset(); setMode('forgot'); }}>Forgot password?</Button>
          </div>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
        </Button>
      </form>
      <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${T.line}`, textAlign: 'center', fontSize: 13, color: T.ink3 }}>
        {mode === 'signin' ? (
          <>No account? <Button variant="link" onClick={() => { reset(); setMode('signup'); }}>Sign up</Button></>
        ) : (
          <><Button variant="link" onClick={() => { reset(); setMode('signin'); }}>Back to sign in</Button></>
        )}
      </div>
    </AuthShell>
  );
}
