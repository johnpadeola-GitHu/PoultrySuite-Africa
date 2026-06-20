// ─────────────────────────────────────────────────────────────────────
// Generic collection sync — works for any farm-scoped data collection
// ─────────────────────────────────────────────────────────────────────
// Stores records as JSON in the farm_records table, keyed by
// (farm_id, collection, record_id). One implementation handles houses,
// mortalityLogs, feedLogs, vaccinations, healthLogs, financialLogs, and any
// future collection.
//
// Same guarantees as the batch sync:
//   • Cross-device sharing (all farm devices read/write the same rows)
//   • Last-write-wins (updated_at set server-side)
//   • Offline-tolerant (failed writes queue locally, flush on reconnect)
// ─────────────────────────────────────────────────────────────────────
import { supabase, isSupabaseConfigured } from '../lib/supabase/client.js';

const QUEUE_KEY = 'psa::records_sync_queue';
const SNAP_PREFIX = 'psa::records_snap::';

function readQueue() {
  try { return JSON.parse(window.localStorage.getItem(QUEUE_KEY) || '[]'); } catch (_) { return []; }
}
function writeQueue(q) {
  try { window.localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch (_) {}
}
function saveSnap(farmId, collection, records) {
  try { window.localStorage.setItem(SNAP_PREFIX + farmId + '::' + collection, JSON.stringify(records)); } catch (_) {}
}
function readSnap(farmId, collection) {
  try { return JSON.parse(window.localStorage.getItem(SNAP_PREFIX + farmId + '::' + collection) || '[]'); } catch (_) { return []; }
}

// Load all records for a collection. Returns the array of record objects.
export async function loadCollection(farmId, collection) {
  if (!isSupabaseConfigured || !farmId) return { records: readSnap(farmId, collection), offline: true };
  try {
    await flushQueue(farmId);
    const { data, error } = await supabase
      .from('farm_records')
      .select('data')
      .eq('farm_id', farmId)
      .eq('collection', collection)
      .eq('deleted', false);
    if (error) throw error;
    const records = (data || []).map((r) => r.data);
    saveSnap(farmId, collection, records);
    return { records, offline: false };
  } catch (err) {
    return { records: readSnap(farmId, collection), offline: true, error: String(err?.message || err) };
  }
}

// Upsert one record. The record must have an `id` field.
export async function saveRecord(farmId, collection, record) {
  if (!farmId || !record?.id) return { ok: false };
  const row = { farm_id: farmId, collection, record_id: String(record.id), data: record, deleted: false };
  if (!isSupabaseConfigured) { enqueue('upsert', row); return { ok: true, queued: true }; }
  try {
    const { error } = await supabase.from('farm_records').upsert(row, { onConflict: 'farm_id,collection,record_id' });
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    enqueue('upsert', row);
    return { ok: true, queued: true };
  }
}

// Soft-delete one record.
export async function deleteRecord(farmId, collection, recordId) {
  if (!farmId) return { ok: false };
  const key = { farm_id: farmId, collection, record_id: String(recordId) };
  if (!isSupabaseConfigured) { enqueue('delete', key); return { ok: true, queued: true }; }
  try {
    const { error } = await supabase.from('farm_records').update({ deleted: true })
      .eq('farm_id', farmId).eq('collection', collection).eq('record_id', String(recordId));
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    enqueue('delete', key);
    return { ok: true, queued: true };
  }
}

// Sync a whole collection by diffing against last-known signatures.
// `prev` and `next` are arrays; we upsert changed/new records.
export async function syncCollectionDiff(farmId, collection, records, sigCache) {
  for (const rec of records) {
    if (!rec?.id) continue;
    const sig = JSON.stringify(rec);
    if (sigCache[rec.id] !== sig) {
      await saveRecord(farmId, collection, rec);
      sigCache[rec.id] = sig;
    }
  }
}

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
        const { error } = await supabase.from('farm_records').upsert(item.payload, { onConflict: 'farm_id,collection,record_id' });
        if (error) throw error;
      } else if (item.op === 'delete') {
        const { error } = await supabase.from('farm_records').update({ deleted: true })
          .eq('farm_id', item.payload.farm_id).eq('collection', item.payload.collection).eq('record_id', item.payload.record_id);
        if (error) throw error;
      }
    } catch (_) {
      remaining.push(item);
    }
  }
  writeQueue(remaining);
}
