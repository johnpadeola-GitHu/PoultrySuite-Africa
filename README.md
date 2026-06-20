# PoultrySuite Africa

A tablet-first farm management PWA for African poultry, hatchery, and feed
mill operations, by AgoroX Technologies.

## ⚠️ Important — read before relying on this folder

This is a **reconstructed** project scaffold. The dev environment used to
build recent features was reset mid-session, and the original
`package.json` / `vite.config.js` / `index.html` were lost. What you're
looking at now:

- **`src/`** — your real, current application code. Not reconstructed.
- **`package.json`, `vite.config.js`, `index.html`, `.gitignore`** — REBUILT
  from scratch by inspecting what `src/` actually imports and expects.
  They should work, but they are NOT guaranteed to byte-for-byte match
  your original config (e.g. exact dependency versions, PWA icon paths).

**Before treating this as your source of truth**, ideally diff it against
your real project folder on your Surface (the one with `node_modules/`
already installed) and confirm nothing real was lost. If your local folder
is intact, prefer copying just the `src/` changes into it rather than
replacing the whole project with this one.

## What's inside

```
src/             → application source (current, real)
supabase/        → SQL migrations to run in Supabase SQL Editor
package.json     → reconstructed dependency list (React 18, Supabase JS, Vite)
vite.config.js   → reconstructed build config (React + PWA plugin)
index.html       → reconstructed HTML entry point
.gitignore       → excludes node_modules/, dist/, .env
.env.example     → documents required environment variables
```

## First-time setup (if running this fresh)

```bash
npm install
cp .env.example .env.local
# edit .env.local with your real Supabase + Paystack keys
npm run dev
```

## What's NEW in src/ (platform admin feature)

- `src/App.jsx` — routes platform admins to a separate dashboard
- `src/auth/AuthProvider.jsx` — adds isPlatformAdmin, viewMode, viewAsTenant()
- `src/auth/authService.js` — checks platform admin status on login
- `src/billing/platformService.js` — NEW FILE — fetches tenants/subscriptions/tickets
- `src/billing/PlatformDashboard.jsx` — NEW FILE — the Platform Overview/Tenants/Subscriptions/Support UI

## Deploy steps (updating your EXISTING Cloudflare-deployed project)

### 1. Database (do this FIRST)
Open `supabase/010_platform_admin.sql`, copy all, paste into Supabase SQL Editor, Run.
Verify with:
```sql
select * from public.platform_admins;
select * from public.platform_tenants_summary;
```

### 2. Code — choose ONE method

**Git (recommended for this multi-file change):**
```powershell
cd path\to\your\EXISTING\project   # the one with node_modules already installed
# copy this folder's src/ over your project's src/, overwriting existing files
git add .
git commit -m "Add platform admin dashboard"
git push origin main
```

**GitHub web uploader:**
Upload every file under `src/` — pay special attention to the 2 NEW files
(`billing/platformService.js`, `billing/PlatformDashboard.jsx`), since new
files are the ones most likely to be missed by the web uploader. After
uploading, open each on GitHub.com and confirm the content matches.

### 3. Verify
- Sign in as `johnpadeola@hotmail.com` (or whichever email was granted
  platform admin in the SQL)
- You should land on a dark "Platform Dashboard" screen instead of the
  normal farm app
- Tabs: Overview, Tenants, Subscriptions, Support

## Known limitation (by design, not a bug)

"View as tenant" from the Tenants tab shows a read-only summary card, not
the full live module UI. See the comment block in `App.jsx` (`ViewRouter`)
for why — building a safe full read-through is a separate follow-up task.

## Still outstanding from before this feature

- "Buy License" button — was unresponsive due to a CSS transform issue on
  a parent container; a fix was applied but never confirmed working after
  deploy. Worth retesting once this platform admin work is confirmed stable.
