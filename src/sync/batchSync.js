// ─────────────────────────────────────────────────────────────────────
// Batch sync service — the proven pattern for cross-device data sharing
// ─────────────────────────────────────────────────────────────────────
// Bird batches persist to a farm-scoped Supabase table. Because every device
// in a farm reads/writes the same rows, data is shared automatically. This
// is the template all other data types (mortality, feed, etc.) will follow.
//
// Conflict policy: last-write-wins by updated_at (set server-side on write).
//
// Offline behavior: writes that fail (no connection) are queued in
// localStorage and flushed on the next successful load/connection. Reads fall
// back to the last-known local snapshot when offline.
// ─────────────────────────────────────────────────────────────────────
import { supabase, isSupabaseConfigured } from '../lib/supabase/client.js';

const QUEUE_KEY = 'psa::batch_sync_queue';
const SNAPSHOT_KEY = 'psa::batch_snapshot';

// ── Shape mapping: app (camelCase) <-> table (snake_case) ──
function toRow(b, farmId) {
  return {
    id: b.id,
    farm_id: farmId,
    house_id: b.houseId ?? null,
    name: b.name,
    breed: b.breed ?? null,
    source: b.source ?? null,
    type: b.type ?? null,
    initial_count: Number(b.initialCount) || 0,
    current_count: Number(b.currentCount) || 0,
    start_date: b.startDate ?? null,
    status: b.status ?? 'Active',
    notes: b.notes ?? null,
    deleted: false,
  };
}
function fromRow(r) {
  return {
    id: r.id,
    houseId: r.house_id || '',
    name: r.name,
    breed: r.breed || '',
    source: r.source || '',
    type: r.type || '',
    initialCount: r.initial_count || 0,
    currentCount: r.current_count || 0,
    startDate: r.start_date || '',
    status: r.status || 'Active',
    notes: r.notes || '',
  };
}

// ── Local helpers ──
function readQueue() {
  try { return JSON.parse(window.localStorage.getItem(QUEUE_KEY) || '[]'); } catch (_) { return []; }
}
function writeQueue(q) {
  try { window.localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch (_) {}
}
function saveSnapshot(batches) {
  try { window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(batches)); } catch (_) {}
}
function readSnapshot() {
  try { return JSON.parse(window.localStorage.getItem(SNAPSHOT_KEY) || '[]'); } catch (_) { return []; }
}

// ── Load all batches for a farm (with offline fallback) ──
export async function loadBatches(farmId) {
  if (!isSupabaseConfigured || !farmId) return { batches: readSnapshot(), offline: true };
  try {
    // Flush any queued offline writes first
    await flushQueue(farmId);

    const { data, error } = await supabase
      .from('batches')
      .select('*')
      .eq('farm_id', farmId)
      .eq('deleted', false)
      .order('start_date', { ascending: true });
    if (error) throw error;

    const batches = (data || []).map(fromRow);
    saveSnapshot(batches);
    return { batches, offline: false };
  } catch (err) {
    // Offline or error — return last-known snapshot
    return { batches: readSnapshot(), offline: true, error: String(err?.message || err) };
  }
}

// ── Save (upsert) a batch ──
export async function saveBatch(batch, farmId) {
  if (!farmId) return { ok: false, error: 'No farm' };
  const row = toRow(batch, farmId);
  if (!isSupabaseConfigured) { enqueue('upsert', row); return { ok: true, queued: true }; }
  try {
    const { error } = await supabase.from('batches').upsert(row, { onConflict: 'farm_id,id' });
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    enqueue('upsert', row);
    return { ok: true, queued: true, error: String(err?.message || err) };
  }
}

// ── Soft-delete a batch ──
export async function deleteBatch(batchId, farmId) {
  if (!farmId) return { ok: false };
  if (!isSupabaseConfigured) { enqueue('delete', { id: batchId, farm_id: farmId }); return { ok: true, queued: true }; }
  try {
    const { error } = await supabase.from('batches')
      .update({ deleted: true }).eq('farm_id', farmId).eq('id', batchId);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    enqueue('delete', { id: batchId, farm_id: farmId });
    return { ok: true, queued: true };
  }
}

// ── Offline queue ──
function enqueue(op, payload) {
  const q = readQueue();
  q.push({ op, payload, ts: Date.now() });
  writeQueue(q);
}

export async function flushQueue(farmId) {
  if (!isSupabaseConfigured) return;
  let q = readQueue();
  if (!q.length) return;
  const remaining = [];
  for (const item of q) {
    try {
      if (item.op === 'upsert') {
        const { error } = await supabase.from('batches').upsert(item.payload, { onConflict: 'farm_id,id' });
        if (error) throw error;
      } else if (item.op === 'delete') {
        const { error } = await supabase.from('batches')
          .update({ deleted: true }).eq('farm_id', item.payload.farm_id).eq('id', item.payload.id);
        if (error) throw error;
      }
    } catch (_) {
      remaining.push(item); // keep for next attempt
    }
  }
  writeQueue(remaining);
}

export function hasPendingSync() {
  return readQueue().length > 0;
}
