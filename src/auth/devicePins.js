// Device-level PIN store for shared farm tablets.
//
// Model: a device is authenticated to a farm ONCE with email+password (the
// Supabase session is kept alive). After that, each user has their own 6-digit
// PIN on THIS device, used to unlock after an idle-lock. PINs never leave the
// device and are stored hashed (SHA-256). This is a convenience lock, not a
// hard security boundary — the underlying session stays valid in the
// background. PINs are scoped per-device + per-farm so switching farms or
// devices keeps separate lists.

const KEY_PREFIX = 'psa::device_pins::';

// Stable per-device id so PIN lists are device-scoped.
function deviceId() {
  try {
    let id = localStorage.getItem('psa::device_id');
    if (!id) {
      id = 'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('psa::device_id', id);
    }
    return id;
  } catch (_) {
    return 'dev-fallback';
  }
}

function storeKey(farmId) {
  return KEY_PREFIX + deviceId() + '::' + (farmId || 'nofarm');
}

// SHA-256 hash of a salted PIN. Async (uses Web Crypto).
async function hashPin(pin, salt) {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomSalt() {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Returns [{userName, salt, hash, createdAt}, …]
export function listPins(farmId) {
  try {
    const raw = localStorage.getItem(storeKey(farmId));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (_) {
    return [];
  }
}

export function hasAnyPin(farmId) {
  return listPins(farmId).length > 0;
}

function savePins(farmId, pins) {
  try {
    localStorage.setItem(storeKey(farmId), JSON.stringify(pins));
    return true;
  } catch (_) {
    return false;
  }
}

// Create or replace a user's PIN on this device.
export async function setPin(farmId, userName, pin) {
  if (!userName || !/^\d{6}$/.test(String(pin))) {
    return { ok: false, error: 'PIN must be 6 digits and a name is required.' };
  }
  const salt = randomSalt();
  const hash = await hashPin(String(pin), salt);
  const pins = listPins(farmId).filter((p) => p.userName.toLowerCase() !== userName.toLowerCase());
  pins.push({ userName, salt, hash, createdAt: new Date().toISOString() });
  savePins(farmId, pins);
  return { ok: true };
}

export function removePin(farmId, userName) {
  const pins = listPins(farmId).filter((p) => p.userName.toLowerCase() !== userName.toLowerCase());
  savePins(farmId, pins);
  return { ok: true };
}

// Verify a PIN against all stored PINs on this device.
// Returns the matching userName, or null.
export async function verifyPin(farmId, pin) {
  const pins = listPins(farmId);
  for (const p of pins) {
    const h = await hashPin(String(pin), p.salt);
    if (h === p.hash) return p.userName;
  }
  return null;
}

// ── Manual lock signal ──
// Lets any part of the app trigger the idle-lock immediately (e.g. a "Lock"
// button) without prop-drilling. IdleLock subscribes; callers invoke lockNow().
const LOCK_EVENT = 'psa::lock-now';

export function lockNow() {
  try { window.dispatchEvent(new Event(LOCK_EVENT)); } catch (_) {}
}

export function onLockNow(handler) {
  try {
    window.addEventListener(LOCK_EVENT, handler);
    return () => window.removeEventListener(LOCK_EVENT, handler);
  } catch (_) {
    return () => {};
  }
}
