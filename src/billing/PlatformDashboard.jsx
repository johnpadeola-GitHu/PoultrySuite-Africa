import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { getOverviewStats, listTenants, listSubscriptions, listTickets, updateTicket } from './platformService.js';

// ── Theme (kept self-contained so this doesn't depend on PoultrySuiteAfrica.jsx's T) ──
const C = {
  bg: '#0B0F0D', surface: '#121815', card: '#161D19', line: '#23302A',
  ink: '#E8EDEA', ink2: '#A8B5AE', ink3: '#6F7E76', accent: '#3FB87F',
  accentBg: 'rgba(63,184,127,0.12)', warn: '#E0A33B', warnBg: 'rgba(224,163,59,0.12)',
  err: '#E0613B', errBg: 'rgba(224,97,59,0.12)',
};

const money = (minor, currency = 'NGN') => {
  const symbol = currency === 'NGN' ? '₦' : currency + ' ';
  return symbol + Number((minor || 0) / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 });
};
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function StatCard({ label, value, sub, tone }) {
  const color = tone === 'warn' ? C.warn : tone === 'err' ? C.err : C.ink;
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, padding: '16px 18px', flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 11, color: C.ink3, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.ink3, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    active: { bg: C.accentBg, fg: C.accent, label: 'Active' },
    trialing: { bg: C.warnBg, fg: C.warn, label: 'Trial' },
    past_due: { bg: C.errBg, fg: C.err, label: 'Past due' },
    canceled: { bg: 'rgba(255,255,255,0.06)', fg: C.ink3, label: 'Canceled' },
    open: { bg: C.errBg, fg: C.err, label: 'Open' },
    in_progress: { bg: C.warnBg, fg: C.warn, label: 'In progress' },
    resolved: { bg: C.accentBg, fg: C.accent, label: 'Resolved' },
    closed: { bg: 'rgba(255,255,255,0.06)', fg: C.ink3, label: 'Closed' },
  };
  const s = map[status] || { bg: 'rgba(255,255,255,0.06)', fg: C.ink3, label: status || '—' };
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', background: s.bg, color: s.fg, letterSpacing: 0.3, textTransform: 'uppercase' }}>{s.label}</span>;
}

// ── Overview ──────────────────────────────────────────────────────────
function PlatformOverview({ stats, tickets }) {
  if (!stats) return <div style={{ color: C.ink3, fontSize: 13 }}>Loading…</div>;
  const recentTickets = (tickets || []).slice(0, 5);
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <StatCard label="Total Tenants" value={stats.total_tenants ?? 0} />
        <StatCard label="Active Subscriptions" value={stats.active_subscriptions ?? 0} />
        <StatCard label="On Trial" value={stats.trial_tenants ?? 0} />
        <StatCard label="At Risk (≤7d)" value={stats.at_risk_tenants ?? 0} tone={stats.at_risk_tenants > 0 ? 'warn' : undefined} />
        <StatCard label="Open Tickets" value={stats.open_tickets ?? 0} tone={stats.open_tickets > 0 ? 'err' : undefined} />
        <StatCard label="Est. MRR" value={money(stats.mrr_minor)} />
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 10 }}>Recent Support Tickets</div>
      {recentTickets.length === 0 ? (
        <div style={{ fontSize: 13, color: C.ink3 }}>No tickets yet.</div>
      ) : (
        <div style={{ border: `1px solid ${C.line}` }}>
          {recentTickets.map((t, i) => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: i > 0 ? `1px solid ${C.line}` : 'none' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{t.subject}</div>
                <div style={{ fontSize: 11, color: C.ink3, marginTop: 2 }}>{t.farm?.name || 'Unknown farm'} · {fmtDate(t.created_at)}</div>
              </div>
              <StatusPill status={t.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tenants ───────────────────────────────────────────────────────────
function PlatformTenants({ tenants, onViewAsTenant }) {
  const [q, setQ] = useState('');
  const filtered = tenants.filter((t) => (t.farm_name || '').toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <input
        value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tenants…"
        style={{ width: '100%', maxWidth: 320, padding: '9px 12px', background: C.surface, border: `1px solid ${C.line}`, color: C.ink, fontSize: 13, marginBottom: 16, fontFamily: 'inherit', boxSizing: 'border-box' }}
      />
      {filtered.length === 0 ? (
        <div style={{ fontSize: 13, color: C.ink3 }}>No tenants found.</div>
      ) : (
        <div style={{ border: `1px solid ${C.line}` }}>
          {filtered.map((t, i) => (
            <div key={t.farm_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderTop: i > 0 ? `1px solid ${C.line}` : 'none', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{t.farm_name}</div>
                <div style={{ fontSize: 11, color: C.ink3, marginTop: 2 }}>
                  {t.plan_name || 'No plan'} · {t.member_count} member{t.member_count === 1 ? '' : 's'} · {t.device_count} device{t.device_count === 1 ? '' : 's'}
                  {t.open_tickets > 0 && <span style={{ color: C.err }}> · {t.open_tickets} open ticket{t.open_tickets === 1 ? '' : 's'}</span>}
                </div>
              </div>
              <StatusPill status={t.subscription_status} />
              <div style={{ fontSize: 11, color: C.ink3, minWidth: 90, textAlign: 'right' }}>{t.subscription_period_end ? `renews ${fmtDate(t.subscription_period_end)}` : '—'}</div>
              <button onClick={() => onViewAsTenant(t)} style={{ background: 'transparent', border: `1px solid ${C.line}`, color: C.ink2, fontSize: 12, fontWeight: 600, padding: '8px 14px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                View as tenant →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Subscriptions ─────────────────────────────────────────────────────
function PlatformSubscriptions({ subscriptions }) {
  if (subscriptions.length === 0) return <div style={{ fontSize: 13, color: C.ink3 }}>No subscriptions yet.</div>;
  return (
    <div style={{ border: `1px solid ${C.line}` }}>
      {subscriptions.map((s, i) => (
        <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderTop: i > 0 ? `1px solid ${C.line}` : 'none', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{s.farm?.name || 'Unknown farm'}</div>
            <div style={{ fontSize: 11, color: C.ink3, marginTop: 2 }}>{s.plan?.name || '—'} · {s.plan ? money(s.plan.annual_price_minor) + '/yr' : '—'}</div>
          </div>
          <StatusPill status={s.status} />
          <div style={{ fontSize: 11, color: C.ink3, minWidth: 110, textAlign: 'right' }}>{s.period_end ? `until ${fmtDate(s.period_end)}` : '—'}</div>
        </div>
      ))}
    </div>
  );
}

// ── Support tickets ───────────────────────────────────────────────────
function PlatformSupport({ tickets, onUpdate }) {
  const [filter, setFilter] = useState('open');
  const filtered = filter === 'all' ? tickets : tickets.filter((t) => t.status === filter);
  const setStatus = async (ticket, status) => {
    await updateTicket(ticket.id, { status, resolved_at: status === 'resolved' ? new Date().toISOString() : null });
    onUpdate();
  };
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {['open', 'in_progress', 'resolved', 'closed', 'all'].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, border: `1px solid ${C.line}`, background: filter === f ? C.accentBg : 'transparent', color: filter === f ? C.accent : C.ink2, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize' }}>
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div style={{ fontSize: 13, color: C.ink3 }}>No tickets in this view.</div>
      ) : (
        <div style={{ border: `1px solid ${C.line}` }}>
          {filtered.map((t, i) => (
            <div key={t.id} style={{ padding: '14px 16px', borderTop: i > 0 ? `1px solid ${C.line}` : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{t.subject}</div>
                  <div style={{ fontSize: 11, color: C.ink3, marginTop: 2 }}>{t.farm?.name || 'Unknown farm'} · {fmtDate(t.created_at)} · priority: {t.priority}</div>
                </div>
                <StatusPill status={t.status} />
              </div>
              {t.description && <div style={{ fontSize: 13, color: C.ink2, marginTop: 8, lineHeight: 1.5 }}>{t.description}</div>}
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                {t.status !== 'in_progress' && <button onClick={() => setStatus(t, 'in_progress')} style={miniBtn}>Mark in progress</button>}
                {t.status !== 'resolved' && <button onClick={() => setStatus(t, 'resolved')} style={miniBtn}>Mark resolved</button>}
                {t.status !== 'closed' && <button onClick={() => setStatus(t, 'closed')} style={miniBtn}>Close</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
const miniBtn = { background: 'transparent', border: `1px solid ${C.line}`, color: C.ink2, fontSize: 11, fontWeight: 600, padding: '6px 10px', cursor: 'pointer', fontFamily: 'inherit' };

// ── Shell ─────────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'tenants', label: 'Tenants' },
  { id: 'subscriptions', label: 'Subscriptions' },
  { id: 'support', label: 'Support' },
];

export default function PlatformDashboard() {
  const { viewAsTenant } = useAuth();
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [o, t, s, tk] = await Promise.all([
      getOverviewStats(), listTenants(), listSubscriptions(), listTickets(),
    ]);
    setStats(o.stats);
    setTenants(t.tenants);
    setSubscriptions(s.subscriptions);
    setTickets(tk.tickets);
    setError(o.error || t.error || s.error || tk.error || null);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.ink, fontFamily: 'inherit' }}>
      <div style={{ borderBottom: `1px solid ${C.line}`, padding: '18px 24px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>AgoroX Technologies</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.ink, letterSpacing: -0.3 }}>Platform Dashboard</div>
      </div>
      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${C.line}`, padding: '0 24px', overflowX: 'auto' }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '12px 16px', background: 'transparent', border: 'none', borderBottom: `2px solid ${tab === t.id ? C.accent : 'transparent'}`, color: tab === t.id ? C.ink : C.ink3, fontWeight: tab === t.id ? 700 : 500, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>
        {error && <div style={{ fontSize: 13, color: C.err, background: C.errBg, border: `1px solid ${C.line}`, padding: '10px 14px', marginBottom: 16 }}>
          {error} — if this is your first time here, make sure 010_platform_admin.sql has been run in Supabase.
        </div>}
        {loading ? (
          <div style={{ fontSize: 13, color: C.ink3 }}>Loading platform data…</div>
        ) : (
          <>
            {tab === 'overview' && <PlatformOverview stats={stats} tickets={tickets} />}
            {tab === 'tenants' && <PlatformTenants tenants={tenants} onViewAsTenant={viewAsTenant} />}
            {tab === 'subscriptions' && <PlatformSubscriptions subscriptions={subscriptions} />}
            {tab === 'support' && <PlatformSupport tickets={tickets} onUpdate={loadAll} />}
          </>
        )}
      </div>
    </div>
  );
}
