-- ─────────────────────────────────────────────────────────────────────
-- Migration: Platform Admin layer (010_platform_admin.sql)
-- ─────────────────────────────────────────────────────────────────────
-- Adds a platform-level admin layer, separate from any single farm's
-- role. A platform admin can see ALL tenants (farms), their
-- subscriptions, and support tickets — mirroring the LabOS pattern.
--
-- Run this once in the Supabase SQL Editor. Safe to re-run (uses
-- `if not exists` / `on conflict`).
-- ─────────────────────────────────────────────────────────────────────

-- 1. Platform admins table ----------------------------------------------
-- A short allow-list of user ids who get platform-wide visibility.
-- Intentionally separate from farm_members.role — platform access is
-- NOT tied to any single farm.
create table if not exists public.platform_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  granted_at  timestamptz not null default now(),
  notes       text
);

alter table public.platform_admins enable row level security;

-- Only a platform admin can see the platform_admins list (avoids leaking
-- who has platform access to regular tenant users).
drop policy if exists "platform_admins_self_read" on public.platform_admins;
create policy "platform_admins_self_read" on public.platform_admins
  for select using (
    auth.uid() in (select user_id from public.platform_admins)
  );

-- 2. Helper function: is the current user a platform admin? ------------
create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists(
    select 1 from public.platform_admins where user_id = auth.uid()
  );
$$;

-- 3. Support tickets table ----------------------------------------------
do $$ begin
  create type ticket_status as enum ('open','in_progress','resolved','closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ticket_priority as enum ('low','normal','high','urgent');
exception when duplicate_object then null; end $$;

create table if not exists public.support_tickets (
  id            uuid primary key default gen_random_uuid(),
  farm_id       uuid references public.farms(id) on delete cascade,
  raised_by     uuid references auth.users(id),
  subject       text not null,
  description   text,
  status        ticket_status not null default 'open',
  priority      ticket_priority not null default 'normal',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  resolved_at   timestamptz
);

alter table public.support_tickets enable row level security;

-- Tenants can see/create their own farm's tickets.
drop policy if exists "tickets_tenant_select" on public.support_tickets;
create policy "tickets_tenant_select" on public.support_tickets
  for select using (
    farm_id in (select farm_id from public.farm_members where user_id = auth.uid())
    or public.is_platform_admin()
  );

drop policy if exists "tickets_tenant_insert" on public.support_tickets;
create policy "tickets_tenant_insert" on public.support_tickets
  for insert with check (
    farm_id in (select farm_id from public.farm_members where user_id = auth.uid())
    or public.is_platform_admin()
  );

-- Only platform admins can update ticket status/priority.
drop policy if exists "tickets_platform_update" on public.support_tickets;
create policy "tickets_platform_update" on public.support_tickets
  for update using (public.is_platform_admin());

-- 4. Platform tenants summary view ---------------------------------------
-- One row per farm with the data the Platform > Tenants screen needs.
-- Access is restricted at the RPC layer below, not on the view itself
-- (views don't support RLS directly), so we wrap it in a function.
create or replace view public.platform_tenants_summary as
select
  f.id                                   as farm_id,
  f.name                                 as farm_name,
  f.created_at                           as farm_created_at,
  p.tier                                 as plan_tier,
  p.name                                 as plan_name,
  s.status                               as subscription_status,
  s.period_end                           as subscription_period_end,
  (select count(*) from public.farm_members fm where fm.farm_id = f.id) as member_count,
  (select count(*) from public.devices d where d.farm_id = f.id and d.revoked = false) as device_count,
  (select count(*) from public.support_tickets t where t.farm_id = f.id and t.status in ('open','in_progress')) as open_tickets
from public.farms f
left join public.subscriptions s on s.farm_id = f.id
left join public.plans p on p.id = s.plan_id;

-- 5. RPC: list all tenants (platform admin only) -------------------------
create or replace function public.platform_list_tenants()
returns setof public.platform_tenants_summary
language sql
security definer
stable
as $$
  select * from public.platform_tenants_summary
  where public.is_platform_admin();
$$;

-- 6. RPC: platform-wide overview stats (platform admin only) -------------
create or replace function public.platform_overview_stats()
returns table (
  total_tenants       bigint,
  active_subscriptions bigint,
  trial_tenants       bigint,
  at_risk_tenants     bigint,
  open_tickets        bigint,
  mrr_minor           bigint
)
language sql
security definer
stable
as $$
  select
    (select count(*) from public.farms) as total_tenants,
    (select count(*) from public.subscriptions where status = 'active') as active_subscriptions,
    (select count(*) from public.subscriptions where status = 'trialing') as trial_tenants,
    (select count(*) from public.subscriptions
       where status = 'active' and period_end < now() + interval '7 days') as at_risk_tenants,
    (select count(*) from public.support_tickets where status in ('open','in_progress')) as open_tickets,
    (select coalesce(sum(p.annual_price_minor) / 12, 0)
       from public.subscriptions s
       join public.plans p on p.id = s.plan_id
       where s.status = 'active') as mrr_minor
  where public.is_platform_admin();
$$;

-- 7. Grant yourself platform admin ---------------------------------------
-- Replace the email below if different. This looks up your auth.users id
-- by email and inserts it. Safe to re-run.
insert into public.platform_admins (user_id, email, notes)
select id, email, 'Initial platform owner'
from auth.users
where email = 'johnpadeola@hotmail.com'
on conflict (user_id) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- Done. Verify with:
--   select * from public.platform_admins;
--   select public.is_platform_admin();   -- run while logged in as that user
-- ─────────────────────────────────────────────────────────────────────
