import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { listPins, setPin, removePin } from '../auth/devicePins.js';

// In-app management of per-user device PINs. Gated to Owner + Manager roles.
// PINs are stored locally on THIS device (hashed) and used to unlock after an
// idle-lock instead of the account email password.
export default function DevicePinManager() {
  const { activeFarm, role } = useAuth();
  const farmId = activeFarm?.id || null;

  const norm = String(role || '').toLowerCase();
  const canManage =
    norm.includes('owner') || norm.includes('manager') ||
    norm.includes('director') || norm === 'super_admin' || norm.includes('admin');

  const [pins, setPins] = useState([]);
  const [name, setName] = useState('');
  const [pin, setPinInput] = useState('');
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  const refresh = () => setPins(listPins(farmId));
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [farmId]);

  if (!canManage) {
    return (
      <div style={box}>
        <div style={title}>Device PINs</div>
        <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6 }}>
          Only the farm owner or a manager can create device PINs. Ask them to set up a PIN for you on this device.
        </div>
      </div>
    );
  }

  const add = async () => {
    setErr(null); setMsg(null);
    if (!name.trim()) { setErr('Enter the user\u2019s name.'); return; }
    if (!/^\d{6}$/.test(pin)) { setErr('PIN must be exactly 6 digits.'); return; }
    const res = await setPin(farmId, name.trim(), pin);
    if (res.ok) {
      setMsg(`PIN set for ${name.trim()}.`);
      setName(''); setPinInput('');
      refresh();
    } else {
      setErr(res.error || 'Could not set PIN.');
    }
  };

  const remove = (userName) => {
    removePin(farmId, userName);
    refresh();
    setMsg(`PIN removed for ${userName}.`);
  };

  return (
    <div style={box}>
      <div style={title}>Device PINs</div>
      <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 14 }}>
        Create a 6-digit PIN for each person who uses this device. After the screen locks, they unlock with their PIN instead of the account password. PINs are stored only on this device.
      </div>

      {err && <div style={{ fontSize: 12, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', padding: '8px 12px', marginBottom: 10 }}>{err}</div>}
      {msg && <div style={{ fontSize: 12, color: '#065F46', background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '8px 12px', marginBottom: 10 }}>{msg}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="User name (e.g. Musa - Farm Hand)"
          style={input}
        />
        <input
          value={pin}
          onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="6-digit PIN"
          inputMode="numeric"
          style={input}
        />
        <button onClick={add} style={btn}>Create / Update PIN</button>
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
        PINs on this device ({pins.length})
      </div>
      {pins.length === 0 ? (
        <div style={{ fontSize: 13, color: '#9CA3AF' }}>No PINs yet. Until one is created, this device unlocks with the account password.</div>
      ) : (
        pins.map((p) => (
          <div key={p.userName} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid #F3F4F6' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1F2937' }}>{p.userName}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF' }}>PIN set {new Date(p.createdAt).toLocaleDateString()}</div>
            </div>
            <button onClick={() => remove(p.userName)} style={{ ...btn, background: 'transparent', color: '#B91C1C', border: '1px solid #FECACA', padding: '6px 12px', minHeight: 0 }}>Remove</button>
          </div>
        ))
      )}
    </div>
  );
}

const box = { background: '#FFFFFF', border: '1px solid #E5E7EB', padding: '16px 18px' };
const title = { fontSize: 13, fontWeight: 700, color: '#1F2937', marginBottom: 6 };
const input = { width: '100%', padding: '11px 13px', fontSize: 14, border: '1px solid #E5E7EB', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' };
const btn = { padding: '11px 14px', background: '#0f5540', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', minHeight: 44 };
