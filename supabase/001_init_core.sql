-- ════════════════════════════════════════════════════════════════════
-- PoultrySuite Africa — Phase 1 Core Schema
-- ════════════════════════════════════════════════════════════════════
-- Tables: plans, farms, profiles, farm_members, subscriptions
-- Run this in: Supabase Dashboard → SQL Editor → New query → paste → Run
-- ════════════════════════════════════════════════════════════════════

-- ─── Extensions ───────────────────────────────────────────────────────
create extension if not exists "pgcrypto";       -- gen_random_uuid()
create extension if not exists "pg_trgm";        -- fuzzy search on farm names

-- ─── Enums ────────────────────────────────────────────────────────────
do $$ begin
  create type user_role as enum (
    'super_admin',   -- Anthropic / platform staff
    'farm_owner',    -- Account creator / billing-responsible
    'manager',       -- Operational lead
    'staff',         -- Day-to-day data entry
    'viewer'         -- Read-only
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type subscription_status as enum (
    'trialing',      -- Free trial window
    'active',        -- Paid, current
    'past_due',      -- Payment failed, grace period
    'canceled',      -- User canceled, runs until period end
    'expired'        -- Period ended, no renewal
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type plan_tier as enum ('starter', 'professional', 'enterprise');
exception when duplicate_object then null; end $$;

-- ─── plans ────────────────────────────────────────────────────────────
-- Static catalogue of subscription plans. Seeded below.
create table if not exists public.plans (
  id              uuid primary key default gen_random_uuid(),
  tier            plan_tier not null unique,
  name            text not null,
  description     text,
  -- Pricing is stored in minor units (kobo, cents) per currency.
  -- e.g. NGN ₦150,000 = 15000000. ISO 4217 currency code.
  annual_price_minor   bigint not null,
  currency_code        char(3) not null default 'NGN',
  -- Feature flags / limits
  max_flocks      integer,         -- null = unlimited
  max_branches    integer,
  max_staff       integer,
  has_hatchery    boolean not null default false,
  has_feedmill    boolean not null default false,
  has_analytics   boolean not null default false,
  is_active       boolean not null default true,
  display_order   integer not null default 0,
  created_at      timestamptz not null default now()
);

-- ─── farms ────────────────────────────────────────────────────────────
-- The tenant. Every operational record (eventually) carries a farm_id.
create table if not exists public.farms (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text unique,                            -- URL-friendly identifier
  country_code    char(2),                                -- ISO 3166-1 alpha-2
  currency_code   char(3) not null default 'NGN',         -- ISO 4217, drives billing currency
  city            text,
  address         text,
  phone           text,
  logo_url        text,
  -- Single FK to the user who created the farm. They become the farm_owner.
  -- We do NOT cascade-delete farms when this user is deleted; farms persist.
  owner_id        uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_farms_owner on public.farms(owner_id);
create index if not exists idx_farms_name_trgm on public.farms using gin(name gin_trgm_ops);

-- ─── profiles ─────────────────────────────────────────────────────────
-- 1:1 with auth.users. Public-facing user info (name, etc.) lives here, not in
-- auth.users (which is owned by Supabase and shouldn't be modified directly).
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  full_name       text,
  phone           text,
  avatar_url      text,
  country_code    char(2),
  -- The farm the user is currently working in. Switching farms updates this.
  active_farm_id  uuid references public.farms(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_profiles_active_farm on public.profiles(active_farm_id);

-- ─── farm_members ─────────────────────────────────────────────────────
-- Junction table: which users have access to which farms, and at what role.
-- A user can be a member of multiple farms with different roles per farm.
create table if not exists public.farm_members (
  id              uuid primary key default gen_random_uuid(),
  farm_id         uuid not null references public.farms(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            user_role not null default 'staff',
  invited_by      uuid references auth.users(id) on delete set null,
  joined_at       timestamptz not null default now(),
  -- Membership is unique per (farm, user) pair
  unique(farm_id, user_id)
);
create index if not exists idx_farm_members_user on public.farm_members(user_id);
create index if not exists idx_farm_members_farm on public.farm_members(farm_id);

-- ─── subscriptions ────────────────────────────────────────────────────
-- One active subscription per farm. History is preserved by keeping old rows
-- with `status = 'expired'` or 'canceled'.
create table if not exists public.subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  farm_id               uuid not null references public.farms(id) on delete cascade,
  plan_id               uuid not null references public.plans(id),
  status                subscription_status not null default 'trialing',
  -- Period bounds. Annual billing → period_end = period_start + 1 year.
  period_start          timestamptz not null default now(),
  period_end            timestamptz not null,
  trial_ends_at         timestamptz,
  -- Paystack identifiers (populated after first successful payment)
  paystack_customer_code text,
  paystack_subscription_code text,
  cancel_at_period_end  boolean not null default false,
  -- Audit
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists idx_subscriptions_farm on public.subscriptions(farm_id);
create index if not exists idx_subscriptions_status on public.subscriptions(status);
create index if not exists idx_subscriptions_period_end on public.subscriptions(period_end);

-- Enforce: at most ONE active/trialing subscription per farm at a time.
create unique index if not exists idx_subscriptions_one_active_per_farm
  on public.subscriptions(farm_id)
  where status in ('active', 'trialing', 'past_due');

-- ─── updated_at triggers ─────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_farms_touch on public.farms;
create trigger trg_farms_touch before update on public.farms
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_subscriptions_touch on public.subscriptions;
create trigger trg_subscriptions_touch before update on public.subscriptions
  for each row execute function public.touch_updated_at();

-- ─── Auto-create profile when a new auth user signs up ───────────────
-- Without this, new signups have an auth.users row but no public.profiles row,
-- which breaks the RLS policies below.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists trg_auth_user_created on auth.users;
create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ═══════════════════════════════════════════════════════════════════════
-- Row-Level Security (RLS) policies
-- ═══════════════════════════════════════════════════════════════════════
-- RLS is the heart of multi-tenancy. Even if a malicious client crafts a raw
-- Supabase query with a stolen JWT, these policies guarantee they can only
-- read/write rows belonging to farms they're a member of.

alter table public.plans          enable row level security;
alter table public.farms          enable row level security;
alter table public.profiles       enable row level security;
alter table public.farm_members   enable row level security;
alter table public.subscriptions  enable row level security;

-- ─── plans: everyone authenticated can read; only service-role writes ──
drop policy if exists "Plans are readable by all authenticated users" on public.plans;
create policy "Plans are readable by all authenticated users"
  on public.plans for select to authenticated using (true);

-- ─── profiles: users can read/update only their own ────────────────────
drop policy if exists "Profiles: select own" on public.profiles;
create policy "Profiles: select own"
  on public.profiles for select to authenticated
  using (id = auth.uid());

drop policy if exists "Profiles: update own" on public.profiles;
create policy "Profiles: update own"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "Profiles: insert own" on public.profiles;
create policy "Profiles: insert own"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());

-- ─── farm_members: helper function used by other policies ──────────────
-- SECURITY DEFINER + STABLE so it can be called from inside RLS policies
-- without infinite recursion (a select on farm_members from within a
-- farm_members policy).
create or replace function public.is_farm_member(p_farm_id uuid, p_user_id uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists(
    select 1 from public.farm_members
    where farm_id = p_farm_id and user_id = p_user_id
  );
$$;

create or replace function public.user_farm_role(p_farm_id uuid, p_user_id uuid)
returns user_role language sql security definer stable
set search_path = public as $$
  select role from public.farm_members
  where farm_id = p_farm_id and user_id = p_user_id
  limit 1;
$$;

-- ─── farms: members can read; owner/super-admin can write ─────────────
drop policy if exists "Farms: select if member" on public.farms;
create policy "Farms: select if member"
  on public.farms for select to authenticated
  using (public.is_farm_member(id, auth.uid()));

drop policy if exists "Farms: insert by self" on public.farms;
create policy "Farms: insert by self"
  on public.farms for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "Farms: update by owner" on public.farms;
create policy "Farms: update by owner"
  on public.farms for update to authenticated
  using (
    public.user_farm_role(id, auth.uid()) in ('farm_owner', 'super_admin')
  );

-- ─── farm_members: members of a farm can see all members of that farm ─
drop policy if exists "FarmMembers: select if co-member" on public.farm_members;
create policy "FarmMembers: select if co-member"
  on public.farm_members for select to authenticated
  using (public.is_farm_member(farm_id, auth.uid()));

drop policy if exists "FarmMembers: insert by farm owner" on public.farm_members;
create policy "FarmMembers: insert by farm owner"
  on public.farm_members for insert to authenticated
  with check (
    -- Either the user is inserting themselves as the first member (only when
    -- creating a brand-new farm — their farms row would have owner_id=auth.uid())
    -- OR they have farm_owner role on the target farm.
    (user_id = auth.uid() and exists(
       select 1 from public.farms where id = farm_id and owner_id = auth.uid()
     ))
    or public.user_farm_role(farm_id, auth.uid()) in ('farm_owner', 'super_admin')
  );

drop policy if exists "FarmMembers: update by farm owner" on public.farm_members;
create policy "FarmMembers: update by farm owner"
  on public.farm_members for update to authenticated
  using (public.user_farm_role(farm_id, auth.uid()) in ('farm_owner', 'super_admin'));

drop policy if exists "FarmMembers: delete by farm owner" on public.farm_members;
create policy "FarmMembers: delete by farm owner"
  on public.farm_members for delete to authenticated
  using (public.user_farm_role(farm_id, auth.uid()) in ('farm_owner', 'super_admin'));

-- ─── subscriptions: members read; only service-role writes (via Workers) ─
-- We deliberately do NOT allow direct client writes to subscriptions.
-- A signed user can only ever see their own farm's subscription. Writes
-- happen through Cloudflare Workers + service-role key (Phase 6/7).
drop policy if exists "Subscriptions: select if member" on public.subscriptions;
create policy "Subscriptions: select if member"
  on public.subscriptions for select to authenticated
  using (public.is_farm_member(farm_id, auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════
-- Seed: default plans
-- ═══════════════════════════════════════════════════════════════════════
-- Prices in kobo (NGN minor units). 100 kobo = ₦1.
insert into public.plans (tier, name, description, annual_price_minor, currency_code,
                          max_flocks, max_branches, max_staff,
                          has_hatchery, has_feedmill, has_analytics, display_order)
values
  ('starter',
   'Starter',
   'For small farms getting started. Single-module poultry tracking.',
   15000000,        -- ₦150,000 / year
   'NGN',
   3, 1, 2,
   false, false, false,
   1),
  ('professional',
   'Professional',
   'Growing farms running poultry + hatchery operations with team access.',
   45000000,        -- ₦450,000 / year
   'NGN',
   15, 3, 8,
   true, false, true,
   2),
  ('enterprise',
   'Enterprise',
   'Multi-branch operators with poultry, hatchery, and feed-mill integration.',
   120000000,       -- ₦1,200,000 / year
   'NGN',
   null, null, null, -- unlimited
   true, true, true,
   3)
on conflict (tier) do update set
  name                = excluded.name,
  description         = excluded.description,
  annual_price_minor  = excluded.annual_price_minor,
  currency_code       = excluded.currency_code,
  max_flocks          = excluded.max_flocks,
  max_branches        = excluded.max_branches,
  max_staff           = excluded.max_staff,
  has_hatchery        = excluded.has_hatchery,
  has_feedmill        = excluded.has_feedmill,
  has_analytics       = excluded.has_analytics,
  display_order       = excluded.display_order;

-- ═══════════════════════════════════════════════════════════════════════
-- Done. Verify with:
--   select count(*) from public.plans;        -- should be 3
--   select tablename, rowsecurity from pg_tables
--   where schemaname = 'public';              -- rowsecurity should be true for all
-- ═══════════════════════════════════════════════════════════════════════
