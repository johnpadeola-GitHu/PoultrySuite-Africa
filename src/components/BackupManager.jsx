import React, { useCallback, useEffect, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────
// BackupManager — desktop-only backup & restore panel
// ─────────────────────────────────────────────────────────────────────
// Renders only when running inside Electron (window.__psaBackup present).
// In the web/PWA build it renders a short "desktop only" note instead.
//
// Self-contained: inline styles matching the app's charcoal/sky enterprise
// look, no external deps. Drop <BackupManager/> anywhere (e.g. a Settings
// engine) and it works.
// ─────────────────────────────────────────────────────────────────────

const T = {
  ink: '#1F2937',
  ink2: '#374151',
  ink3: '#6B7280',
  ink4: '#9CA3AF',
  line: '#E5E7EB',
  bg: '#F9FAFB',
  card: '#FFFFFF',
  accent: '#1F2937',
  accentText: '#FFFFFF',
  sky: '#0EA5E9',
  skyBg: '#E0F2FE',
  ok: '#15803D',
  okBg: '#F0FDF4',
  err: '#B91C1C',
  errBg: '#FEF2F2',
  warn: '#92400E',
  warnBg: '#FEF3C7',
};

const api = typeof window !== 'undefined' ? window.__psaBackup : null;

function fmtBytes(n) {
  if (n == null) return '—';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
}
function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch (_) {
    return iso;
  }
}

export default function BackupManager() {
  const [backups, setBackups] = useState([]);
  const [dir, setDir] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { kind, text }
  const [confirmRestore, setConfirmRestore] = useState(null); // backup row

  const flash = (kind, text) => {
    setMsg({ kind, text });
    if (kind === 'ok') setTimeout(() => setMsg(null), 4000);
  };

  const refresh = useCallback(async (useDir) => {
    if (!api) return;
    try {
      const list = await api.list(useDir || undefined);
      setBackups(list);
    } catch (err) {
      flash('err', 'Could not list backups: ' + err.message);
    }
  }, []);

  useEffect(() => {
    if (!api) return;
    (async () => {
      try {
        const d = await api.defaultDir();
        setDir(d);
        await refresh(d);
      } catch (_) {}
    })();
  }, [refresh]);

  if (!api) {
    return (
      <div style={{ padding: 20, background: T.warnBg, border: `1px solid ${T.warn}`, fontSize: 13, color: T.ink2, lineHeight: 1.6 }}>
        <strong>Backups are available in the desktop app.</strong> You're viewing the
        web version, which stores data in this browser. Install the PoultrySuite
        desktop app to enable database backups to disk and external drives.
      </div>
    );
  }

  const doBackup = async (toExternal) => {
    setBusy(true);
    setMsg(null);
    try {
      let target = dir;
      if (toExternal) {
        const picked = await api.pickFolder();
        if (!picked) { setBusy(false); return; } // user cancelled
        target = picked;
        setDir(picked);
      }
      const result = await api.create(target);
      flash('ok', `Backup created: ${result.name} (${fmtBytes(result.size_bytes)})`);
      await refresh(target);
    } catch (err) {
      flash('err', 'Backup failed: ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  const chooseFolder = async () => {
    try {
      const picked = await api.pickFolder();
      if (!picked) return;
      setDir(picked);
      await refresh(picked);
    } catch (err) {
      flash('err', err.message);
    }
  };

  const doVerify = async (b) => {
    setBusy(true);
    try {
      const res = await api.verify(b.path);
      if (res.ok) flash('ok', `"${b.name}" passed integrity check.`);
      else flash('err', `"${b.name}" failed: ${res.reason}`);
    } catch (err) {
      flash('err', err.message);
    } finally {
      setBusy(false);
    }
  };

  const doRestore = async (b) => {
    setBusy(true);
    setConfirmRestore(null);
    setMsg(null);
    try {
      await api.restore(b.path);
      flash('ok', `Restored from "${b.name}". The app now reflects that backup. A safety copy of your previous data was saved.`);
      // Data changed underneath the running app — reload so UI re-reads it.
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      flash('err', 'Restore failed: ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async (b) => {
    setBusy(true);
    try {
      await api.remove(b.path);
      await refresh(dir);
      flash('ok', `Deleted "${b.name}".`);
    } catch (err) {
      flash('err', err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.ink, marginBottom: 4 }}>Backup &amp; Restore</div>
        <div style={{ fontSize: 13, color: T.ink3, lineHeight: 1.5 }}>
          Create a complete, verified copy of your farm database. Store backups on this
          computer or an external/USB drive. Restoring replaces current data (a safety
          copy is saved automatically first).
        </div>
      </div>

      {msg && (
        <div style={{
          padding: '10px 14px', fontSize: 13, lineHeight: 1.5,
          background: msg.kind === 'ok' ? T.okBg : T.errBg,
          color: msg.kind === 'ok' ? T.ok : T.err,
          border: `1px solid ${msg.kind === 'ok' ? '#BBF7D0' : '#FECACA'}`,
        }}>
          {msg.text}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={() => doBackup(false)} disabled={busy}
          style={{ background: T.accent, color: T.accentText, border: 'none', padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit', minHeight: 40, opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Working…' : 'Back up now'}
        </button>
        <button onClick={() => doBackup(true)} disabled={busy}
          style={{ background: 'transparent', color: T.ink2, border: `1px solid ${T.line}`, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit', minHeight: 40 }}>
          Back up to external drive…
        </button>
        <button onClick={chooseFolder} disabled={busy}
          style={{ background: 'transparent', color: T.ink2, border: `1px solid ${T.line}`, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit', minHeight: 40 }}>
          Change folder…
        </button>
      </div>

      {/* Current folder */}
      <div style={{ fontSize: 12, color: T.ink4, wordBreak: 'break-all' }}>
        Backup folder: <span style={{ fontFamily: 'monospace', color: T.ink3 }}>{dir || '—'}</span>
      </div>

      {/* Backup list */}
      <div style={{ border: `1px solid ${T.line}`, background: T.card }}>
        <div style={{ display: 'flex', padding: '10px 14px', borderBottom: `1px solid ${T.line}`, background: T.bg, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: T.ink3 }}>
          <div style={{ flex: 2 }}>Backup</div>
          <div style={{ flex: 1 }}>Size</div>
          <div style={{ flex: 2 }}>Created</div>
          <div style={{ flex: 2, textAlign: 'right' }}>Actions</div>
        </div>
        {backups.length === 0 && (
          <div style={{ padding: '24px 14px', textAlign: 'center', fontSize: 13, color: T.ink4 }}>
            No backups yet. Click “Back up now” to create your first.
          </div>
        )}
        {backups.map((b) => (
          <div key={b.path} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: `1px solid ${T.line}`, fontSize: 13, color: T.ink2 }}>
            <div style={{ flex: 2, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 12 }}>{b.name}</div>
            <div style={{ flex: 1 }}>{fmtBytes(b.size_bytes)}</div>
            <div style={{ flex: 2, fontSize: 12 }}>{fmtDate(b.created_at)}</div>
            <div style={{ flex: 2, display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button onClick={() => doVerify(b)} disabled={busy} title="Verify integrity"
                style={{ background: 'transparent', border: `1px solid ${T.line}`, color: T.ink2, padding: '5px 9px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Verify</button>
              <button onClick={() => setConfirmRestore(b)} disabled={busy}
                style={{ background: T.skyBg, border: `1px solid ${T.sky}`, color: '#0369A1', padding: '5px 9px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Restore</button>
              <button onClick={() => doDelete(b)} disabled={busy}
                style={{ background: 'transparent', border: `1px solid ${T.line}`, color: T.err, padding: '5px 9px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {/* Restore confirmation modal */}
      {confirmRestore && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setConfirmRestore(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: T.card, maxWidth: 440, width: '100%', padding: 24, border: `1px solid ${T.line}` }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: T.ink, marginBottom: 10 }}>Restore this backup?</div>
            <div style={{ fontSize: 13, color: T.ink2, lineHeight: 1.6, marginBottom: 8 }}>
              This will replace <strong>all current data</strong> with the contents of:
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 12, background: T.bg, padding: '8px 10px', border: `1px solid ${T.line}`, marginBottom: 14, wordBreak: 'break-all' }}>{confirmRestore.name}</div>
            <div style={{ fontSize: 12, color: T.ink3, lineHeight: 1.5, marginBottom: 18 }}>
              A safety copy of your current data is saved automatically before the restore,
              so this can be undone. The app will reload afterward.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmRestore(null)} disabled={busy}
                style={{ background: 'transparent', border: `1px solid ${T.line}`, color: T.ink2, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: 40 }}>Cancel</button>
              <button onClick={() => doRestore(confirmRestore)} disabled={busy}
                style={{ background: T.accent, color: T.accentText, border: 'none', padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: 40 }}>
                {busy ? 'Restoring…' : 'Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
