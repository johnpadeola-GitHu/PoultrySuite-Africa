# PoultrySuite Africa — SaaS Transformation Roadmap

Phase 1 (Supabase + Auth) is shipped. This document tracks the remaining phases
and recommended order. Each phase should be **its own delivery turn** — they're
too big to bundle.

---

## ✅ Phase 1 — Supabase & Authentication

**Status:** Complete

- Supabase project + 5-table schema with RLS
- Sign up / sign in / sign out / password reset / email verification
- AuthProvider, useAuth hook, protected routes
- Farm onboarding flow
- Cloudflare Pages env var setup

**Files:** `src/auth/**`, `src/lib/supabase/**`, `supabase/001_init_core.sql`, `docs/PHASE1_SETUP.md`

---

## ⏳ Phase 2 — Profile & Settings UI

Add user-facing pages for managing their account and farm settings (not strictly needed for billing to work, but high UX value).

- Profile screen (edit name, phone, change password)
- Farm settings screen (edit name, country, currency)
- Sign-out button wired into existing dashboard header
- Account deletion flow

**Estimate:** 1 chat turn.

---

## ⏳ Phase 3 — Team management

Currently every farm has only its creator as a `farm_owner`. Phase 3 adds:

- Invite team members by email (sends invite via Supabase)
- Team management page: list members, change roles, remove
- The 5 roles (`super_admin`, `farm_owner`, `manager`, `staff`, `viewer`) need permission gates wired into the existing 6,000-line app
- The legacy `role` system in PoultrySuiteAfrica.jsx must read from `useFarmRole()` instead of hardcoded

**Estimate:** 1–2 chat turns. Permissions audit across the existing app is the bulk of the work.

---

## ⏳ Phase 4 — Operational data schema (deferred under Option A)

Under **Option A**, operational data (flocks, batches, feed logs, mortality, finance, etc.) stays in localStorage for now. Phase 4 only happens when we want true cloud sync. The schema design is:

- `flocks`, `breeds`, `mortality_records`, `egg_production`, `feed_inventory`, `medication_records`, `staff`, `notifications`, `activity_logs`
- Every operational row has `farm_id` (FK to farms)
- RLS: members of farm X can read/write only rows where `farm_id = X`

**Estimate:** 2–3 chat turns when we decide to do it. The schema design is fast; the data-access refactor of every dispatch in PoultrySuiteAfrica.jsx is the bulk.

---

## ⏳ Phase 5 — Subscription billing UI

Even before Paystack integration:

- Plans / billing screen (shows current plan, period end, upgrade options)
- A *manual* subscription override for super-admins (so we can test plan-tier gates without payment first)
- Plan-tier feature gates: e.g. hatchery module is hidden for `starter` users
- "Subscription expired" banner + grace period UX

**Estimate:** 1 chat turn.

---

## ⏳ Phase 6 — Paystack integration (frontend)

- Inline Paystack popup from billing screen
- Initialize payment → server-side `verify-payment` round-trip
- Success/failure handling, idempotency by reference

**Requires:** Paystack test account, public key in env vars.

**Estimate:** 1 chat turn.

---

## ⏳ Phase 7 — Cloudflare Workers backend

The backend APIs that handle payments and webhooks. Cannot live in the frontend.

- `/api/initialize-payment` — creates Paystack transaction, returns access_code
- `/api/verify-payment` — verifies and activates subscription
- `/api/paystack-webhook` — signature-verified webhook for charge.success / subscription.disable / invoice.payment_failed
- `/api/subscription-status` — reads subscription state for current user
- `/api/renew-subscription`
- `/api/billing-history`

Each Worker uses the Supabase **service role key** (server-only) to write to subscriptions table without RLS interference.

**Requires:** Wrangler installed locally, Workers deployed alongside Pages.

**Estimate:** 1–2 chat turns.

---

## ⏳ Phase 8 — Operational data foundation

Only needed if/when we move off Option A. See Phase 4. Includes:

- Real-time sync of flocks/feeds/mortality across devices via Supabase Realtime
- Conflict resolution strategy (last-write-wins, or per-field merging)
- Offline-first PWA support so the app keeps working without internet
- Data migration from existing localStorage records into Supabase

**Estimate:** 3–4 chat turns. This is the biggest single phase.

---

## ⏳ Phase 9 — Super-admin dashboard

A separate route (`/admin`) gated to `super_admin` role.

- Farms list with search, filter by plan, filter by subscription status
- Suspend / reactivate farms
- Manual subscription edits (extend trial, comp a free month, etc.)
- Revenue analytics (MRR, ARR, churn, plan distribution)
- Payment history across all farms

**Estimate:** 1 chat turn for v1.

---

## ⏳ Phase 10 — Notifications & email

- Server-side notification generation (cron Worker that runs daily)
- Email digests for farm-level alerts
- In-app notifications synced to Supabase (replaces current localStorage-only notification system)

**Estimate:** 1 chat turn.

---

## ⏳ Phase 11 — Production hardening

- Rate limiting on all Worker endpoints
- Audit logging for sensitive actions (role changes, subscription edits)
- Backup / disaster recovery runbook
- Security review: RLS policies, secret rotation, CORS config
- Performance: query indexes audit, Supabase connection pooling, Worker cold-start optimization

**Estimate:** 1 chat turn.

---

## Recommended sequence

If you're going to ship this incrementally, this order minimizes risk:

1. ✅ Phase 1 (done) — Auth foundation, can ship to test users now
2. **Phase 2** — Settings UI so users can manage their account
3. **Phase 5** — Billing UI with manual override so we can test plan gates
4. **Phase 7** — Workers backend skeleton (can deploy with no endpoints active)
5. **Phase 6** — Paystack on top of Phase 7
6. **Phase 9** — Admin dashboard so you can manage live customers
7. **Phase 3** — Team management once you have multiple farms
8. **Phase 10** — Server notifications
9. **Phase 11** — Production hardening
10. **Phase 4 + 8** — Cloud sync, only when you outgrow localStorage

---

## Decision log

- **2026-05-19** — Chose Option A (hybrid: Supabase for accounts/billing, localStorage for ops data) to accelerate time-to-first-paying-customer.
- **2026-05-19** — Phase 1 schema uses email/password auth only. OAuth (Google, etc.) deferred.
- **2026-05-19** — Plans seeded with NGN prices. International billing currency handling deferred to Phase 5.
