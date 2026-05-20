# PoultrySuite Africa

Multi-tenant farm management SaaS for African poultry producers.
React + Vite frontend, Supabase backend, Cloudflare Pages hosting.

## Quick start

```bash
npm install
cp .env.local.example .env.local   # fill in Supabase credentials
npm run dev                         # http://localhost:5173
npm run build                       # production bundle in /dist
npm run preview                     # preview the production build
```

## Deploy

This app deploys to **Cloudflare Pages**:

- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Node version:** `18` or higher

Set these environment variables in Cloudflare Pages → Settings → Environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

`public/_redirects` is already configured for SPA fallback routing.

## Project structure

```
poultrysuite-africa/
├── index.html                              # Vite entry
├── package.json
├── vite.config.js
├── .env.local.example                      # template — copy to .env.local
├── public/
│   └── _redirects                          # SPA fallback for CF Pages
├── supabase/
│   └── 001_init_core.sql                   # Phase 1 schema migration
├── docs/
│   ├── PHASE1_SETUP.md                     # 35-min Supabase setup walkthrough
│   └── ROADMAP.md                          # Phased SaaS plan
└── src/
    ├── main.jsx                            # React 18 entry
    ├── App.jsx                             # Root: ErrorBoundary + Auth + app
    ├── styles.css                          # Base styles + spacing tokens
    ├── storage-shim.js                     # localStorage adapter
    ├── auth/                               # Phase 1: Supabase auth
    │   ├── AuthProvider.jsx                # Global auth state + useAuth hook
    │   ├── AuthGate.jsx                    # Status-based routing
    │   ├── authService.js                  # Sign-in / sign-up / farm CRUD
    │   └── pages/                          # Sign-in, sign-up, verify, reset, onboard
    ├── lib/supabase/
    │   └── client.js                       # Supabase client singleton
    ├── currency/                           # Multi-currency system (NGN/KES/ZAR/+13)
    │   ├── CurrencyContext.jsx
    │   ├── currencies.js
    │   ├── countries.js
    │   ├── format.js
    │   ├── exchangeRates.js
    │   ├── paystack.js
    │   ├── index.js
    │   └── components/
    │       ├── Money.jsx
    │       ├── CountrySelector.jsx
    │       └── CurrencySwitcher.jsx
    └── components/
        ├── PoultrySuiteAfrica.jsx          # Main app (PoultryOS + HatcheryOS + FeedMillOS)
        ├── PoultrySuiteKeyGenerator.jsx    # Admin license-key tool (legacy)
        └── SystemStates.jsx                # Offline banner, error screens, skeletons
```

## Phase status

✅ **Phase 1** — Supabase + Authentication (multi-tenant DB, sign-up, sign-in, email verification, farm onboarding, RLS)
⏳ Phases 2–11 — see `docs/ROADMAP.md`

## Setup guide

For first-time deployment, follow `docs/PHASE1_SETUP.md`. It walks you through Supabase project creation, running the schema migration, configuring auth, and setting Cloudflare env vars.

## Architecture notes

- **Multi-tenant by RLS:** Every operational record (eventually) carries `farm_id`. Postgres Row-Level Security policies guarantee tenant isolation server-side, even with a stolen JWT.
- **Hybrid storage (Option A):** Accounts, farms, subscriptions, and billing live in Supabase. Operational data (flocks, feeds, mortality, finance) is still per-device in localStorage. Cloud sync is Phase 4/8.
- **No CDN React, no in-browser Babel:** Pure Vite + ES modules. Builds to `dist/` for static hosting.
- **Currency-aware:** 16+ African currencies with Intl.NumberFormat locale-aware formatting. Country selection at registration auto-switches currency.
