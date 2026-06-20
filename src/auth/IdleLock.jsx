import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './AuthProvider.jsx';
import { hasAnyPin, verifyPin, onLockNow } from './devicePins.js';

const IDLE_MS = 60 * 60 * 1000; // 1 hour
const CHECK_MS = 30 * 1000;
const LS_KEY = 'psa::last_activity';

const C = {
  bg:'#0f5540', card:'#FFFFFF', ink:'#1F2937', ink3:'#6B7280', ink4:'#9CA3AF',
  line:'#E5E7EB', accent:'#0f5540', err:'#B91C1C', errBg:'#FEF2F2',
};

const padBtn = {
  padding:'16px 0', fontSize:20, fontWeight:600, background:'#F9FAFB',
  border:'1px solid #E5E7EB', color:'#1F2937', cursor:'pointer',
  fontFamily:'inherit', minHeight:54,
};

export default function IdleLock({ children }) {
  const { user, activeFarm, signIn, signOut } = useAuth();
  const farmId = activeFarm?.id || null;

  const [locked, setLocked] = useState(false);
  const [mode, setMode] = useState('pin');
  const [pin, setPinVal] = useState('');
  const [pwd, setPwd] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const lastActivity = useRef(Date.now());

  const email = user?.email || '';

  const markActivity = useCallback(() => {
    lastActivity.current = Date.now();
    try { localStorage.setItem(LS_KEY, String(lastActivity.current)); } catch (_) {}
  }, []);

  useEffect(() => {
    try {
      const stored = Number(localStorage.getItem(LS_KEY));
      if (stored && !Number.isNaN(stored)) {
        lastActivity.current = stored;
        if (Date.now() - stored >= IDLE_MS) setLocked(true);
      } else { markActivity(); }
    } catch (_) { markActivity(); }
  }, [markActivity]);

  useEffect(() => {
    if (locked) {
      setMode(hasAnyPin(farmId) ? 'pin' : 'email');
      setErr(null); setPinVal(''); setPwd('');
    }
  }, [locked, farmId]);

  useEffect(() => {
    if (locked) return;
    const events = ['mousedown', 'keydown', 'touchstart', 'pointerdown', 'scroll', 'visibilitychange'];
    const onActivity = () => { if (!document.hidden) markActivity(); };
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, onActivity));
  }, [locked, markActivity]);

  useEffect(() => {
    if (locked) return;
    const id = setInterval(() => {
      if (Date.now() - lastActivity.current >= IDLE_MS) setLocked(true);
    }, CHECK_MS);
    return () => clearInterval(id);
  }, [locked]);

  // Manual lock (e.g. the "Lock" button in the top bar).
  useEffect(() => onLockNow(() => setLocked(true)), []);

  const submitPin = async (value) => {
    const code = value !== undefined ? value : pin;
    setErr(null);
    if (!/^\d{6}$/.test(code)) { setErr('Enter your 6-digit PIN.'); return; }
    setBusy(true);
    const userName = await verifyPin(farmId, code);
    setBusy(false);
    if (userName) {
      setPinVal('');
      markActivity();
      setLocked(false);
    } else {
      setErr('Incorrect PIN. Try again or use owner login.');
      setPinVal('');
    }
  };

  const unlockEmail = async () => {
    setErr(null);
    if (!pwd) { setErr('Enter the account password.'); return; }
    setBusy(true);
    const res = await signIn({ email, password: pwd });
    setBusy(false);
    if (res?.ok) { setPwd(''); markActivity(); setLocked(false); }
    else { setErr(res?.error?.message || 'Incorrect password. Please try again.'); }
  };

  const switchAccount = async () => {
    setPinVal(''); setPwd(''); setErr(null);
    setLocked(false);
    await signOut();
  };

  const pressDigit = (d) => {
    if (pin.length >= 6) return;
    const next = pin + d;
    setPinVal(next);
    if (next.length === 6) submitPin(next);
  };
  const backspace = () => setPinVal((p) => p.slice(0, -1));

  if (!locked) return children;

  return (
    <div style={{ position:'fixed', inset:0, zIndex:99999, background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
      <div style={{ background:C.card, width:'100%', maxWidth:380, padding:'30px 26px', boxShadow:'0 10px 40px rgba(0,0,0,0.25)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
          <div style={{ width:38, height:38, background:C.accent, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <div>
            <div style={{ fontSize:16, fontWeight:800, color:C.ink, letterSpacing:-0.3 }}>Session locked</div>
            <div style={{ fontSize:12, color:C.ink4 }}>Locked after 1 hour of inactivity</div>
          </div>
        </div>

        {err && (
          <div style={{ fontSize:12, color:C.err, background:C.errBg, border:'1px solid #FECACA', padding:'8px 12px', margin:'14px 0', lineHeight:1.4 }}>{err}</div>
        )}

        {mode === 'pin' ? (
          <>
            <div style={{ fontSize:13, color:C.ink3, lineHeight:1.5, margin:'14px 0 16px' }}>
              Enter your 6-digit device PIN to continue.
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'center', marginBottom:18 }}>
              {[0,1,2,3,4,5].map((i) => (
                <div key={i} style={{ width:14, height:14, borderRadius:'50%', background: i < pin.length ? C.accent : '#fff', border:`2px solid ${i < pin.length ? C.accent : C.line}` }}/>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
              {['1','2','3','4','5','6','7','8','9'].map((d) => (
                <button key={d} onClick={() => pressDigit(d)} disabled={busy} style={padBtn}>{d}</button>
              ))}
              <button onClick={switchAccount} style={{ ...padBtn, fontSize:12, fontWeight:600, color:C.ink4 }}>Switch</button>
              <button onClick={() => pressDigit('0')} disabled={busy} style={padBtn}>0</button>
              <button onClick={backspace} disabled={busy} style={{ ...padBtn, fontSize:18 }}>{'\u232B'}</button>
            </div>
            <button
              onClick={() => { setMode('email'); setErr(null); }}
              style={{ width:'100%', marginTop:14, padding:'8px', background:'transparent', color:C.ink4, border:'none', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
              Forgot PIN? Owner login
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize:13, color:C.ink3, lineHeight:1.5, margin:'14px 0 16px' }}>
              {hasAnyPin(farmId) ? 'Owner login \u2014 ' : 'Set up this device \u2014 '}enter the account password for {email && <strong style={{ color:C.ink }}>{email}</strong>}.
            </div>
            <input
              type="password"
              value={pwd}
              autoFocus
              onChange={(e) => setPwd(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') unlockEmail(); }}
              placeholder="Account password"
              style={{ width:'100%', padding:'12px 14px', fontSize:14, border:`1px solid ${C.line}`, outline:'none', fontFamily:'inherit', boxSizing:'border-box', marginBottom:12 }}
            />
            <button
              onClick={unlockEmail}
              disabled={busy}
              style={{ width:'100%', padding:'12px', background:C.accent, color:'#fff', border:'none', fontSize:14, fontWeight:700, cursor: busy ? 'wait' : 'pointer', fontFamily:'inherit', minHeight:46, opacity: busy ? 0.7 : 1 }}>
              {busy ? 'Unlocking\u2026' : 'Unlock'}
            </button>
            {hasAnyPin(farmId) && (
              <button
                onClick={() => { setMode('pin'); setErr(null); setPwd(''); }}
                style={{ width:'100%', marginTop:10, padding:'8px', background:'transparent', color:C.ink4, border:'none', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                Back to PIN entry
              </button>
            )}
            <button
              onClick={switchAccount}
              style={{ width:'100%', marginTop:4, padding:'8px', background:'transparent', color:C.ink4, border:'none', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
              Sign in as a different user
            </button>
          </>
        )}
      </div>
    </div>
  );
}
