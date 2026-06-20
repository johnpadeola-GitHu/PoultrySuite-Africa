// ─────────────────────────────────────────────────────────────────────
// Platform service — RPCs for the Platform Admin dashboard.
// All of these are backed by `is_platform_admin()` checks in Postgres
// (see supabase/010_platform_admin.sql), so a non-admin caller simply
// gets an empty result, not an error.
// ─────────────────────────────────────────────────────────────────────
import { supabase, requireSupabase } from '../lib/supabase/client.js';

function friendly(err) {
  if (!err) return null;
  return err.message || String(err);
}

// Platform-wide KPI numbers for the Overview screen.
export async function getOverviewStats() {
  requireSupabase();
  const { data, error } = await supabase.rpc('platform_overview_stats');
  if (error) return { stats: null, error: friendly(error) };
  const row = Array.isArray(data) ? data[0] : data;
  return { stats: row || null, error: null };
}

// All tenants (farms) with plan, subscription, device and ticket counts.
export async function listTenants() {
  requireSupabase();
  const { data, error } = await supabase.rpc('platform_list_tenants');
  if (error) return { tenants: [], error: friendly(error) };
  return { tenants: data || [], error: null };
}

// All subscriptions across every farm (joined with plan + farm name).
export async function listSubscriptions() {
  requireSupabase();
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*, farm:farms(name), plan:plans(name, tier, annual_price_minor)')
    .order('period_end', { ascending: true });
  if (error) return { subscriptions: [], error: friendly(error) };
  return { subscriptions: data || [], error: null };
}

// Support tickets across every farm.
export async function listTickets({ status } = {}) {
  requireSupabase();
  let q = supabase
    .from('support_tickets')
    .select('*, farm:farms(name)')
    .order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return { tickets: [], error: friendly(error) };
  return { tickets: data || [], error: null };
}

export async function updateTicket(ticketId, patch) {
  requireSupabase();
  const { error } = await supabase
    .from('support_tickets')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', ticketId);
  return { error: friendly(error) };
}

// A tenant raises a new ticket (used from the tenant side, not platform).
export async function createTicket({ farmId, subject, description, priority }) {
  requireSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('support_tickets').insert({
    farm_id: farmId,
    raised_by: user?.id || null,
    subject,
    description: description || null,
    priority: priority || 'normal',
  });
  return { error: friendly(error) };
}
