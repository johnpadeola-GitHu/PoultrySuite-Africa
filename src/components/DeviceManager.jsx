import React, { useCallback, useEffect, useState } from 'react';
import {
  getDeviceUsage, listDevices, removeDevice, createPairingCode, getStoredDeviceToken,
} from '../devices/deviceService.js';
import UpgradeScreen from '../billing/UpgradeScreen.jsx';

const T = {
  ink: '#1F2937', ink2: '#374151', ink3: '#6B7280', ink4: '#9CA3AF',
  line: '#E5E7EB', bg: '#F9FAFB', card: '#FFFFFF', accent: '#1F2937', accentText: '#FFFFFF',
  sky: '#0EA5E9', skyBg: '#E0F2FE', ok: '#15803D', okBg: '#F0FDF4', err: '#B91C1C', errBg: '#FEF2F2',
  warn: '#92400E', warnBg: '#FEF3C7',
};

function fmtDate(iso) {
  if (!iso) return 'never';
  try { return new Date(iso).toLocaleString(); } catch (_) { return iso; }
}

export default function DeviceManager() {
  const [usage, setUsage] = useState({ limit: 0, used: 0 });
  const [devices, setDevices] = useState([]);
  const [code, setCode] = useState(null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const flash = (kind, text) => { setMsg({ kind, text }); if (kind === 'ok') setTimeout(() => setMsg(null), 5000); };

  const refresh = useCallback(async () => {
    const u = await getDeviceUsage();
    if (!u.error) setUsage({ limit: u.limit, used: u.used });
    const d = await listDevices();
    if (!d.error) setDevices(d.devices);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const generate = async () => {
    setBusy(true); setMsg(null); setCode(null);
    const r = await createPairingCode(newName);
    setBusy(false);
    if (r.error) { flash('err', r.error); return; }
    setCode({ value: r.code, expiresAt: r.expiresAt });
    setNewName('');
    await refresh();
  };

  const remove = async (d) => {
    setBusy(true);
    const r = await removeDevice(d.id);
    setBusy(false);
    if (r.error) flash('err', r.error);
    else { flash('ok', `Removed "${d.name}".`); await refresh(); }
  };

  const thisToken = getStoredDeviceToken();
  const atLimit = usage.used >= usage.limit && usage.limit > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.ink, marginBottom: 4 }}>Devices</div>
        <div style={{ fontSize: 13, color: T.ink3, lineHeight: 1.5 }}>
          Register the tablets your team uses. Your plan allows a set number of devices.
          To add a tablet, generate a code here and enter it on that tablet.
        </div>
      </div>

      {msg && (
        <div style={{ padding: '10px 14px', fontSize: 13, lineHeight: 1.5,
          background: msg.kind === 'ok' ? T.okBg : T.errBg, color: msg.kind === 'ok' ? T.ok : T.err,
          border: `1px solid ${msg.kind === 'ok' ? '#BBF7D0' : '#FECACA'}` }}>{msg.text}</div>
      )}

      {/* Usage */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: T.bg, border: `1px solid ${T.line}` }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: atLimit ? T.warn : T.ink }}>{usage.used}<span style={{ fontSize: 16, color: T.ink4 }}> / {usage.limit}</span></div>
        <div style={{ fontSize: 13, color: T.ink3 }}>devices registered{atLimit ? ' — limit reached' : ''}</div>
        <button onClick={() => setShowUpgrade(true)}
          style={{ marginLeft:'auto', background: atLimit ? T.accent : 'transparent', color: atLimit ? '#fff' : T.accent, border:`1px solid ${T.accent}`, padding:'7px 13px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          {atLimit ? 'Upgrade plan' : 'View plans'}
        </button>
      </div>

      {showUpgrade && (
        <div style={{ position:'fixed', inset:0, background:'rgba(17,24,39,0.5)', zIndex:10000, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'40px 16px', overflowY:'auto' }}
          onClick={() => setShowUpgrade(false)}>
          <div onClick={(e)=>e.stopPropagation()} style={{ background:T.card, maxWidth:840, width:'100%', padding:'26px 24px', border:`1px solid ${T.line}` }}>
            <UpgradeScreen onClose={() => { setShowUpgrade(false); refresh(); }} />
          </div>
        </div>
      )}

      {/* Generate code */}
      <div style={{ border: `1px solid ${T.line}`, background: T.card, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, marginBottom: 10 }}>Add a device</div>
        {atLimit ? (
          <div style={{ padding: '10px 14px', background: T.warnBg, border: `1px solid ${T.warn}`, fontSize: 13, color: T.ink2, lineHeight: 1.5 }}>
            You've reached your device limit. Remove a device below, or upgrade your plan to add more.
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.ink2, marginBottom: 6 }}>Device name (optional)</div>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Layer house iPad"
                style={{ padding: '10px 12px', fontSize: 14, border: `1px solid ${T.line}`, width: '100%', fontFamily: 'inherit', minHeight: 42 }} />
            </div>
            <button onClick={generate} disabled={busy}
              style={{ background: T.accent, color: T.accentText, border: 'none', padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: 42 }}>
              {busy ? 'Working…' : 'Generate pairing code'}
            </button>
          </div>
        )}

        {code && (
          <div style={{ marginTop: 14, padding: 16, background: T.skyBg, border: `1px solid ${T.sky}`, textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#0369A1', marginBottom: 6, fontWeight: 600 }}>Enter this code on the new tablet:</div>
            <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: 4, color: '#0C4A6E', fontFamily: 'monospace' }}>{code.value}</div>
            <div style={{ fontSize: 12, color: '#0369A1', marginTop: 6 }}>Expires in 30 minutes</div>
          </div>
        )}
      </div>

      {/* Device list */}
      <div style={{ border: `1px solid ${T.line}`, background: T.card }}>
        <div style={{ display: 'flex', padding: '10px 14px', borderBottom: `1px solid ${T.line}`, background: T.bg, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: T.ink3 }}>
          <div style={{ flex: 2 }}>Device</div>
          <div style={{ flex: 1 }}>Platform</div>
          <div style={{ flex: 2 }}>Last seen</div>
          <div style={{ flex: 1, textAlign: 'right' }}>Action</div>
        </div>
        {devices.length === 0 && (
          <div style={{ padding: '20px 14px', textAlign: 'center', fontSize: 13, color: T.ink4 }}>No devices registered yet.</div>
        )}
        {devices.map((d) => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: `1px solid ${T.line}`, fontSize: 13, color: T.ink2 }}>
            <div style={{ flex: 2, fontWeight: 600 }}>{d.name}</div>
            <div style={{ flex: 1, fontSize: 12, color: T.ink3 }}>{d.platform || '—'}</div>
            <div style={{ flex: 2, fontSize: 12, color: T.ink3 }}>{fmtDate(d.last_seen_at)}</div>
            <div style={{ flex: 1, textAlign: 'right' }}>
              <button onClick={() => remove(d)} disabled={busy}
                style={{ background: 'transparent', border: `1px solid ${T.line}`, color: T.err, padding: '5px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Remove</button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: T.ink4 }}>
        Removing a device frees a slot and signs it out on next use. This device is the one
        you're currently using{thisToken ? '' : ' (not yet registered)'}.
      </div>
    </div>
  );
}
