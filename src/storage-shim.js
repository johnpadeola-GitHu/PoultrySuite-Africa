// PoultrySuite Africa — storage shim
// ─────────────────────────────────────────────────────────────────────
// Provides window.storage with an async get/set/delete/list contract.
//
// Two backends, auto-selected at runtime:
//   1. Electron  — if window.__psaStorage exists (injected by preload),
//                  route to SQLite via IPC. Data persists in a real DB file.
//   2. Web       — otherwise fall back to localStorage (browser / PWA).
//
// The existing 6,000-line app calls window.storage.* and neither knows nor
// cares which backend is active. This is the migration seam: same API,
// SQLite underneath when running as the desktop app.
// ─────────────────────────────────────────────────────────────────────
(function installStorageShim() {
  if (typeof window === 'undefined') return;
  if (window.storage && typeof window.storage.get === 'function') return;

  // ─── Backend 1: Electron (SQLite via IPC bridge) ───
  if (window.__psaStorage && window.__psaStorage.isElectron) {
    window.storage = {
      get: (key) => window.__psaStorage.get(key),
      set: (key, value) => window.__psaStorage.set(key, String(value)),
      delete: (key) => window.__psaStorage.delete(key),
      list: (prefix = '') => window.__psaStorage.list(prefix),
    };
    window.__psaBackend = 'sqlite';
    return;
  }

  // ─── Backend 2: Web (localStorage) ───
  const PREFIX = 'psa::';
  function safeGetItem(k) { try { return window.localStorage.getItem(PREFIX + k); } catch (_) { return null; } }
  function safeSetItem(k, v) { try { window.localStorage.setItem(PREFIX + k, v); return true; } catch (_) { return false; } }
  function safeRemoveItem(k) { try { window.localStorage.removeItem(PREFIX + k); return true; } catch (_) { return false; } }
  function safeListKeys() {
    try {
      const out = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(PREFIX)) out.push(k.slice(PREFIX.length));
      }
      return out;
    } catch (_) { return []; }
  }

  window.storage = {
    async get(key) {
      const v = safeGetItem(key);
      if (v === null || v === undefined) return null;
      return { key, value: v };
    },
    async set(key, value) {
      const ok = safeSetItem(key, String(value));
      return ok ? { key, value: String(value) } : null;
    },
    async delete(key) {
      const existed = safeGetItem(key) !== null;
      safeRemoveItem(key);
      return { key, deleted: existed };
    },
    async list(prefix = '') {
      const all = safeListKeys();
      const keys = prefix ? all.filter((k) => k.startsWith(prefix)) : all;
      return { keys, prefix };
    },
  };
  window.__psaBackend = 'localStorage';
})();
