import React, { useState } from 'react';
import { useAuth } from '../AuthProvider.jsx';
import { AuthShell, Field, Input, Button, Alert, T } from './_primitives.jsx';
import { COUNTRIES } from '../../currency/countries.js';

// Pick a sane default currency from country selection
function defaultCurrencyFor(countryCode) {
  const c = COUNTRIES.find(x => x.code === countryCode);
  return c?.currency || 'NGN';
}

export default function OnboardFarmScreen() {
  const { createFarm, user, signOut } = useAuth();
  const [name, setName] = useState('');
  const [country, setCountry] = useState('NG');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async (e) => {
    e?.preventDefault();
    if (!name.trim()) { setErr('Farm name is required.'); return; }
    setBusy(true); setErr(null);
    const { ok, error } = await createFarm({
      name: name.trim(),
      countryCode: country,
      currencyCode: defaultCurrencyFor(country),
      city: city.trim() || null,
      phone: phone.trim() || null,
    });
    setBusy(false);
    if (!ok) setErr(error);
    // On success the AuthProvider re-hydrates and AuthGate switches to the app.
  };

  return (
    <AuthShell>
      <div style={{ fontSize: 22, fontWeight: 700, color: T.ink, marginBottom: 6, letterSpacing: -0.3 }}>
        Set up your farm
      </div>
      <div style={{ fontSize: 13, color: T.ink3, marginBottom: 22, lineHeight: 1.5 }}>
        Signed in as <strong>{user?.email}</strong>. Tell us about your farm so we can configure your workspace.
      </div>
      <Alert kind="error">{err}</Alert>
      <form onSubmit={submit}>
        <Field label="Farm / organization name">
          <Input value={name} onChange={setName} required autoFocus placeholder="e.g. Sunrise Farms" />
        </Field>
        <Field label="Country">
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            style={{
              padding: '11px 12px',
              fontSize: 14,
              border: `1px solid ${T.line}`,
              background: '#FFF',
              color: T.ink,
              width: '100%',
              minHeight: 44,
              fontFamily: 'inherit',
            }}
          >
            {COUNTRIES.map(c => (
              <option key={c.code} value={c.code}>{c.flag} {c.name} — {c.currency}</option>
            ))}
          </select>
        </Field>
        <Field label="City (optional)">
          <Input value={city} onChange={setCity} placeholder="e.g. Ibadan" />
        </Field>
        <Field label="Phone (optional)">
          <Input value={phone} onChange={setPhone} autoComplete="tel" placeholder="+234..." />
        </Field>
        <Button type="submit" disabled={busy}>
          {busy ? 'Creating farm…' : 'Create farm & continue'}
        </Button>
      </form>
      <div style={{ marginTop: 22, textAlign: 'center', fontSize: 12, color: T.ink3 }}>
        <Button variant="link" full={false} onClick={signOut}>Sign out</Button>
      </div>
    </AuthShell>
  );
}
