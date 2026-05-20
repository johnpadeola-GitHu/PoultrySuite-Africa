# Phase 1 Setup — Supabase & Authentication

This walks you through getting Phase 1 live: a working Supabase project,
the database schema, and the auth system deployed to Cloudflare Pages.

**Estimated time:** 25–35 minutes.

---

## Part A — Create your Supabase project

1. Go to **https://supabase.com** and click **Start your project**.
2. Sign in with GitHub (recommended) or email.
3. Click **New project**.
4. Fill in:
   - **Name:** `poultrysuite-africa` (or whatever you like)
   - **Database password:** Generate a strong one. **Save it somewhere safe** — you can't see it again after this step.
   - **Region:** Choose closest to your users. For Nigeria/West Africa, use `West EU (Ireland)` or `Central EU (Frankfurt)`. South Africa users → `South Africa (Cape Town)`.
   - **Pricing plan:** Free tier is fine for now.
5. Click **Create new project**. Wait ~2 minutes for provisioning.

---

## Part B — Run the database migration

1. In the Supabase dashboard, click **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Open `supabase/001_init_core.sql` from this repo (or the deliverable in `/mnt/user-data/outputs/001_init_core.sql`).
4. **Copy the entire file's contents** into the SQL Editor.
5. Click **Run** (bottom-right, or `Ctrl+Enter`).
6. You should see `Success. No rows returned`.
7. **Verify it worked.** Run this in a new query:
   ```sql
   select count(*) from public.plans;
   select tablename, rowsecurity from pg_tables where schemaname = 'public';
   ```
   - First query: should return `3` (the seeded plans).
   - Second query: every table should have `rowsecurity = true`.

---

## Part C — Configure auth

1. In Supabase dashboard → **Authentication** → **Providers** → click on **Email**.
2. Make sure **Enable Email Signup** is ON.
3. **Confirm email** is ON by default — keep it on. Users must verify before signing in.
4. Click **Save**.

### Set up email templates (optional but recommended)

1. **Authentication** → **Email Templates** in the sidebar.
2. Customize the "Confirm signup" and "Reset password" templates with your branding. The defaults work fine for testing.

### Configure URLs

1. **Authentication** → **URL Configuration**.
2. **Site URL:** Set this to your Cloudflare Pages URL, e.g. `https://poultrysuite.pages.dev`.
3. **Redirect URLs:** Add the same URL plus `http://localhost:5173` for dev.

---

## Part D — Get your API credentials

1. **Project Settings** (gear icon, bottom-left) → **API**.
2. Copy two values:
   - **Project URL** — looks like `https://abcdefghijklmn.supabase.co`
   - **anon / public key** — long string starting with `eyJ...`

⚠️ **Never copy the `service_role` key into the frontend.** That's a backend-only secret. The `anon` key is safe in the browser because RLS policies restrict what it can do.

---

## Part E — Local development

1. In the project root, copy the env template:
   ```bash
   cp .env.local.example .env.local
   ```
2. Open `.env.local` and paste your credentials:
   ```
   VITE_SUPABASE_URL=https://abcdefghijklmn.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
   ```
3. Restart your dev server:
   ```bash
   npm run dev
   ```
4. Visit `http://localhost:5173`. You should see the sign-in screen.
5. Click **Sign up**, create a test account.
6. **Check your email** for the verification link (look in your spam folder if needed).
7. Click the link, then sign in.
8. You should land on the **"Set up your farm"** onboarding screen.

---

## Part F — Cloudflare Pages env vars

For your live deployment, the env vars must also be set on Cloudflare:

1. Go to `dash.cloudflare.com` → **Workers & Pages** → your project.
2. Click **Settings** → **Environment variables**.
3. Click **Add variable** twice — once for each:
   - `VITE_SUPABASE_URL` = your project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon key
4. Choose **Production** environment (and **Preview** if you want preview deploys to work too).
5. Click **Save**.
6. Go to **Deployments** tab → click the three-dot menu on the latest deploy → **Retry deployment**. Env vars only take effect on a fresh build.

---

## Part G — Test the deployment

1. Visit your `.pages.dev` URL.
2. You should see the sign-in screen instead of the old dashboard.
3. Sign up with a test account.
4. Check your inbox for the verification email.
5. Verify, sign in, create a farm.
6. You should now see the original PoultrySuite Africa dashboard, scoped to that farm.

---

## What you have now

✅ A real user account system with verified email
✅ Multi-tenant database with row-level security
✅ Farm creation flow
✅ Session persistence across refreshes and devices
✅ Password reset flow
✅ Existing app preserved — once signed in, users still see the full dashboard

## What you don't have yet

❌ No payments / subscriptions enforcement (Phases 5–7)
❌ Farm operational data (flocks, feed, mortality) is still per-device in localStorage (intentional — Option A)
❌ No team invites yet — only farm_owner role for now (Phase 3)
❌ No super-admin dashboard (Phase 9)

These come in subsequent phases. See `docs/ROADMAP.md` for the plan.

---

## Troubleshooting

**"Supabase isn't connected yet" screen on the live site**
→ Env vars aren't set on Cloudflare Pages, or the deploy hasn't been redone after setting them. See Part F.

**"Email not confirmed" error when signing in**
→ Check your inbox (and spam). Click the verification link. Or use the "Resend verification" button on the verify screen.

**Sign-up succeeds but no email arrives**
→ Supabase free tier sends emails through their default provider with strict rate limits and sometimes spam-folder issues. For production, configure a custom SMTP provider in Authentication → Email Settings (e.g. Resend, Postmark, SendGrid).

**"new row violates row-level security policy" error**
→ The user's auth.users row exists but their public.profiles row is missing. This shouldn't happen because of the `handle_new_auth_user` trigger, but if it does, run this in SQL Editor:
```sql
insert into public.profiles (id) values (auth.uid()) on conflict do nothing;
```
(Replace `auth.uid()` with the user's UUID if running as an admin.)

**Can I delete a test account?**
→ Yes: Supabase Dashboard → Authentication → Users → click the user → Delete user. This cascade-deletes profile, farm memberships, etc.
