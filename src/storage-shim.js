// PoultrySuite Africa — storage shim
// The original codebase (PoultrySuiteAfrica.jsx) was authored for the Anthropic
// artifact runtime which provides a `window.storage` async key/value API.
// This shim implements the same contract on top of `localStorage` so the app
// works unchanged in any browser (Vite dev, production build, Cloudflare Pages).

(function installStorageShim() {
  if (typeof window === 'undefined') return;
  if (window.storage && typeof window.storage.get === 'function') return; // already installed

  const PREFIX = 'psa::';

  function safeGetItem(k) {
    try {
      return window.localStorage.getItem(PREFIX + k);
    } catch (_) {
      return null;
    }
  }
  function safeSetItem(k, v) {
    try {
      window.localStorage.setItem(PREFIX + k, v);
      return true;
    } catch (_) {
      return false;
    }
  }
  function safeRemoveItem(k) {
    try {
      window.localStorage.removeItem(PREFIX + k);
      return true;
    } catch (_) {
      return false;
    }
  }
  function safeListKeys() {
    try {
      const out = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(PREFIX)) out.push(k.slice(PREFIX.length));
      }
      return out;
    } catch (_) {
      return [];
    }
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
})();
