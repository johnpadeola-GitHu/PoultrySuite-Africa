import React, { useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { redeemPairingCode, registerOwnDevice } from './deviceService.js';
import { AuthShell, Field, Input, Button, Alert, T } from '../auth/pages/_primitives.jsx';

// Shown when an authenticated user's device is not yet bound. Offers two paths:
//   • This is my first device → register it directly (if the farm has room)
//   • This is an additional device → enter the pairing code the owner generated
export default function PairingScreen({ onBound, diag, activeFarm }) {
  const { signOut, role } = useAuth();
  const isOwnerLike = role === 'farm_owner' || role === 'super_admin';
  const [mode, setMode] = useState(isOwnerLike ? 'choose' : 'code');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const doOwnDevice = async () => {
    setBusy(true); setErr(null);
    const r = await registerOwnDevice(name);
    setBusy(false);
    if (r.error) setErr(r.error);
    else onBound();
  };

  const doRedeem = async () => {
    if (!code.trim()) { setErr('Enter the pairing code.'); return; }
    setBusy(true); setErr(null);
    const r = await redeemPairingCode(code);
    setBusy(false);
    if (r.error) setErr(r.error);
    else onBound();
  };

  return (
    <AuthShell>
      <div style={{ fontSize: 22, fontWeight: 700, color: T.ink, marginBottom: 6 }}>Set up this device</div>
      <div style={{ fontSize: 13, color: T.ink3, marginBottom: 22, lineHeight: 1.5 }}>
        This tablet needs to be registered to your farm before you can use the app.
      </div>
      <Alert kind="error">{err}</Alert>

      {/* Temporary diagnostics — remove once device setup confirmed working */}
      {diag && (
        <div style={{ fontSize: 11, fontFamily: 'monospace', background: '#F3F4F6', border: '1px solid #E5E7EB', padding: '8px 10px', marginBottom: 14, color: '#374151', lineHeight: 1.6, wordBreak: 'break-word' }}>
          <div><strong>Diagnostics</strong></div>
          <div>role: {String(role)}</div>
          <div>ownerLike: {String(isOwnerLike)}</div>
          <div>farm: {activeFarm?.id ? activeFarm.id.slice(0, 8) + '…' : 'none'}</div>
          <div>usage: {diag.usage ? `used ${diag.usage.used} / limit ${diag.usage.limit}${diag.usage.error ? ' ERR:' + diag.usage.error : ''}` : '—'}</div>
          <div>regError: {diag.regError ? String(diag.regError) : 'none'}</div>
          <div>step: {diag.step}</div>
        </div>
      )}

      {mode === 'choose' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Name this device (optional)">
            <Input type="text" value={name} onChange={setName} placeholder="e.g. Office iPad" />
          </Field>
          <Button onClick={doOwnDevice} disabled={busy}>
            {busy ? 'Registering…' : 'Register this as my device'}
          </Button>
          <Button variant="ghost" onClick={() => { setErr(null); setMode('code'); }}>
            I have a pairing code instead
          </Button>
        </div>
      )}

      {mode === 'code' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Pairing code">
            <Input type="text" value={code} onChange={(v) => setCode(v.toUpperCase())} placeholder="FARM-XXXX" />
          </Field>
          <Button onClick={doRedeem} disabled={busy}>
            {busy ? 'Joining…' : 'Join farm'}
          </Button>
          {isOwnerLike && (
            <Button variant="ghost" onClick={() => { setErr(null); setMode('choose'); }}>
              Back
            </Button>
          )}
        </div>
      )}

      <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${T.line}`, textAlign: 'center', fontSize: 12, color: T.ink3 }}>
        <Button variant="link" onClick={signOut}>Sign out</Button>
      </div>
    </AuthShell>
  );
}
