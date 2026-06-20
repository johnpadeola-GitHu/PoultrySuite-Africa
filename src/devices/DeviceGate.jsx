import React, { useEffect, useState } from 'react';
import { isDeviceBound, touchThisDevice, registerOwnDevice, getDeviceUsage } from './deviceService.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import PairingScreen from './PairingScreen.jsx';

// Sits inside AuthGate (so the user is already authenticated). Ensures THIS
// physical device is registered to the farm before the app renders.
//   • Token already stored → straight through, ping last_seen in background.
//   • Owner's FIRST device (farm has 0 devices) → auto-register silently.
//   • Otherwise → show PairingScreen (enter a code, or self-register).
export default function DeviceGate({ children }) {
  const { role, activeFarm } = useAuth();
  const [bound, setBound] = useState(() => isDeviceBound());
  const [checking, setChecking] = useState(!isDeviceBound());
  const [diag, setDiag] = useState({ role: null, usage: null, regError: null, step: 'init' });

  useEffect(() => {
    let cancelled = false;
    if (bound) { touchThisDevice(); return; }

    // Not bound yet. If this is the farm owner or a super admin, register this
    // device with no friction (their own farm — no pairing code needed), as
    // long as the farm is under its device limit.
    (async () => {
      const isOwnerLike = role === 'farm_owner' || role === 'super_admin';
      setDiag((d) => ({ ...d, role, step: 'checking-role', isOwnerLike }));
      if (isOwnerLike) {
        const u = await getDeviceUsage();
        setDiag((d) => ({ ...d, usage: u, step: 'got-usage' }));
        if (!cancelled && !u.error && (u.limit === 0 || u.used < u.limit)) {
          const r = await registerOwnDevice('Owner device');
          setDiag((d) => ({ ...d, regError: r.error || null, step: 'after-register' }));
          if (!cancelled && !r.error) {
            setBound(true);
            setChecking(false);
            return;
          }
        }
      }
      if (!cancelled) setChecking(false);
    })();

    return () => { cancelled = true; };
  }, [bound, role]);

  if (bound) return children;
  if (checking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', color: '#6B7280', fontSize: 14 }}>
        Setting up this device…
      </div>
    );
  }
  return (
    <PairingScreen
      onBound={() => setBound(true)}
      diag={diag}
      activeFarm={activeFarm}
    />
  );
}

