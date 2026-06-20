// ─────────────────────────────────────────────────────────────────────
// Device service
// ─────────────────────────────────────────────────────────────────────
// Wraps the Supabase device RPCs and manages the device token stored on
// THIS tablet (in localStorage). The token identifies this physical device
// to the backend for sync and last-seen tracking.
// ─────────────────────────────────────────────────────────────────────
import { supabase, requireSupabase } from '../lib/supabase/client.js';

const TOKEN_KEY = 'psa::device_token';
const NAME_KEY = 'psa::device_name';

export function getStoredDeviceToken() {
  try { return window.localStorage.getItem(TOKEN_KEY); } catch (_) { return null; }
}
export function storeDeviceToken(token, name) {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
    if (name) window.localStorage.setItem(NAME_KEY, name);
  } catch (_) {}
}
export function clearStoredDeviceToken() {
  try { window.localStorage.removeItem(TOKEN_KEY); window.localStorage.removeItem(NAME_KEY); } catch (_) {}
}

// Detect platform for the device record
export function detectPlatform() {
  const ua = navigator.userAgent || '';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  if (/android/i.test(ua)) return 'android';
  if (/windows/i.test(ua)) return 'windows';
  if (/mac/i.test(ua)) return 'mac';
  return 'web';
}

// Is this tablet already bound (has a token)?
export function isDeviceBound() {
  return !!getStoredDeviceToken();
}

// Register the caller's OWN device (no code). For the owner's first device.
export async function registerOwnDevice(name) {
  requireSupabase();
  const { data, error } = await supabase.rpc('register_own_device', {
    p_name: name || defaultDeviceName(),
    p_platform: detectPlatform(),
  });
  if (error) return { error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  if (row?.device_token) storeDeviceToken(row.device_token, row.device_name);
  return { token: row?.device_token, error: null };
}

// Redeem a pairing code on a NEW device.
export async function redeemPairingCode(code) {
  requireSupabase();
  const { data, error } = await supabase.rpc('redeem_pairing_code', {
    p_code: code.trim(),
    p_platform: detectPlatform(),
  });
  if (error) return { error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  if (row?.device_token) storeDeviceToken(row.device_token, row.device_name);
  return { token: row?.device_token, farmId: row?.farm_id, error: null };
}

// Owner generates a pairing code for an additional device.
export async function createPairingCode(deviceName) {
  requireSupabase();
  const { data, error } = await supabase.rpc('create_pairing_code', {
    p_device_name: deviceName || 'New device',
  });
  if (error) return { error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  return { code: row?.out_code, expiresAt: row?.out_expires_at, error: null };
}

// Device usage {limit, used}
export async function getDeviceUsage() {
  requireSupabase();
  const { data, error } = await supabase.rpc('farm_device_usage');
  if (error) return { error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  return { limit: row?.device_limit ?? 0, used: row?.device_used ?? 0, error: null };
}

// List the farm's devices
export async function listDevices() {
  requireSupabase();
  const { data, error } = await supabase
    .from('devices')
    .select('id, name, platform, last_seen_at, revoked, created_at')
    .eq('revoked', false)
    .order('created_at', { ascending: true });
  if (error) return { devices: [], error: error.message };
  return { devices: data || [], error: null };
}

// Remove (revoke) a device — frees a slot
export async function removeDevice(deviceId) {
  requireSupabase();
  const { error } = await supabase.from('devices').update({ revoked: true }).eq('id', deviceId);
  return { error: error?.message || null };
}

// Mark this device seen
export async function touchThisDevice() {
  const token = getStoredDeviceToken();
  if (!token) return;
  try { await supabase.rpc('touch_device', { p_token: token }); } catch (_) {}
}

function defaultDeviceName() {
  const p = detectPlatform();
  const label = { ios: 'iPad', android: 'Android tablet', windows: 'Windows PC', mac: 'Mac', web: 'Device' }[p] || 'Device';
  return label;
}
