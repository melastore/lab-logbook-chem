# Supabase and Vercel Setup Guide

This guide deploys the laboratory logbook app with:

- Vercel for Next.js hosting
- Supabase Auth for login
- Supabase Postgres for logbook records

## 1. Requirements

- GitHub account
- Vercel account
- Supabase account
- Node.js 22 locally

Check local Node:

```bash
node -v
```

It should print `v22.x`.

On Arch/CachyOS:

```bash
sudo pacman -S nodejs-lts-jod npm
```

## 2. Create Supabase Project

1. Go to `https://supabase.com/dashboard`.
2. Click **New project**.
3. Choose your organization.
4. Enter a project name, for example `lab-logbook`.
5. Set a strong database password.
6. Choose the region closest to your users.
7. Click **Create new project**.
8. Wait until the project is ready.

Keep the database password somewhere safe.

## 3. Create Database Tables

1. Open the Supabase project.
2. Go to **SQL Editor**.
3. Click **New query**.
4. Run these two files, in order, pasting each into a new query:

```text
supabase/schema.sql
supabase/integrity.sql
```

`schema.sql` creates:

- `public.profiles`
- `public.logbook_records`
- `public.app_config`, `public.instrument_categories`, `public.instrument_templates`, `public.form_definitions`
- role constraints
- update timestamp trigger
- Row Level Security enabled

`integrity.sql` is what makes the logbook trustworthy, so do not skip it:

- blocks `UPDATE` and `DELETE` on `logbook_records`
- adds the per-row SHA-256 hash chain and the `verify_logbook_chain` function
- adds the append-only `audit_log` table

Row Level Security is enabled with no policies. That is deliberate: every read
and write goes through the server using the service-role key, so nothing is
reachable from a browser holding only the anon key.

## 4. Get Supabase Environment Variables

In Supabase:

1. Open **Project Settings**.
2. Open **API Keys** or **Connect**.
3. Copy the project URL.
4. Copy the public/anon key.
5. Copy the secret/service role key.

For this app, set:

```bash
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your_anon_or_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_or_secret_key
```

Important:

- `SUPABASE_ANON_KEY` is used for login.
- `SUPABASE_SERVICE_ROLE_KEY` is used only inside server API routes.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend/browser code.
- Never commit `.env.local`.

## 5. Generate the Application Encryption Key

This key encrypts secrets the app stores in the database — currently two-factor
authentication seeds.

```bash
openssl rand -base64 32
```

Set:

```bash
APP_ENCRYPTION_KEY=the_generated_value
```

Use a different key for local and production. Treat it like a database
password:

- Back it up somewhere safe.
- **Losing or changing it makes existing two-factor seeds unreadable**, and every
  enrolled user must re-enrol.
- Without it the app still runs and existing two-factor logins still work, but
  new enrollments fail.

## 6. Local Environment File

In the project folder:

```bash
cd ~/Documents/gc/lab-logbook
cp .env.example .env.local
```

Edit `.env.local`:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your_anon_or_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_or_secret_key
APP_ENCRYPTION_KEY=output_of_openssl_rand_base64_32
LAB_INITIAL_PASSWORD=replace_with_a_strong_temporary_password
```

`LAB_INITIAL_PASSWORD` must be at least 10 characters or provisioning refuses
to run.

Run locally:

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

The app should load and send you to `/login`. Create the accounts next.

## 7. Create the First Admin Accounts

Do not create users by hand in Supabase Auth — the app provisions them, so the
Auth user and its `profiles` row are always created together.

With the app running, open:

```text
http://localhost:3000/setup
```

Click through it once. It creates the admin accounts listed in
`src/lib/generated-users.ts`, each with `LAB_INITIAL_PASSWORD` and a forced
password change on first login. Signing in as `admin01` sends you straight to
that change — it asks for the temporary password as well as the new one, and
the new password must be 10+ characters and cannot reuse the temporary one.

The page then closes itself: as soon as one admin profile exists, `/setup`
refuses to run again, so it is safe to leave reachable.

## 8. Create Everyone Else

Sign in as an admin and use **Admin dashboard → Users**.

Roles:

- `analyst` — submits instrument records, and can only see their own
- `supervisor` — sees every record, amends them, manages analyst accounts
- `admin` — everything, including creating supervisors/admins and exporting backups

A supervisor cannot create or manage supervisor/admin accounts; that is
admin-only, so a supervisor cannot promote themselves.

## 9. Check It End to End

Before deploying, confirm the whole flow works locally:

1. Sign in as `admin01`.
2. Add an instrument under **Admin → Instruments**.
3. Sign in as an analyst, submit one logbook record and sign it.
4. Confirm the analyst's own logs show that record — and only their own.
5. Sign back in as the admin, open `/admin` and confirm the record is listed.
6. Run the integrity check and confirm the chain verifies.

## 10. Push Project to GitHub

From the project folder:

```bash
git init
git add .
git commit -m "Initial lab logbook app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/lab-logbook.git
git push -u origin main
```

Before pushing, confirm `.env.local` is not included:

```bash
git status --short
```

`.env.local` should not appear.

## 11. Deploy to Vercel

1. Go to `https://vercel.com/dashboard`.
2. Click **Add New**.
3. Click **Project**.
4. Import the GitHub repository.
5. Select framework preset **Next.js**.
6. Keep build command as:

```bash
npm run build
```

7. Keep output settings default.
8. Add environment variables.

Add these in Vercel project settings:

```bash
NEXT_PUBLIC_APP_URL=https://your-vercel-domain.vercel.app
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your_anon_or_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_or_secret_key
APP_ENCRYPTION_KEY=a_different_key_from_your_local_one
LAB_INITIAL_PASSWORD=replace_with_a_strong_temporary_password
```

Apply them to:

- Production
- Preview
- Development, if you use `vercel dev`

9. Click **Deploy**.

## 12. Update App URL After First Deploy

After Vercel deploys:

1. Copy the Vercel URL.
2. Go to Vercel project **Settings**.
3. Open **Environment Variables**.
4. Change:

```bash
NEXT_PUBLIC_APP_URL=https://your-real-vercel-url.vercel.app
```

5. Redeploy.

## 13. Supabase Security Checklist

Confirm:

- RLS is enabled on `profiles`.
- RLS is enabled on `logbook_records`.
- `integrity.sql` has been run, so `logbook_records` rejects `UPDATE`/`DELETE`.
- `SUPABASE_SERVICE_ROLE_KEY` is only in Vercel environment variables.
- `.env.local` is not pushed to GitHub.
- Only trusted people have Vercel project access.
- Only trusted admins have Supabase project access.
- Analyst users have role `analyst`.
- Boss/supervisor has role `supervisor` or `admin`.
- Every account has changed the shared initial password.

## 14. Vercel Security Checklist

Confirm:

- Environment variables are set in Vercel.
- `SUPABASE_SERVICE_ROLE_KEY` is not exposed with `NEXT_PUBLIC_`.
- `APP_ENCRYPTION_KEY` is set, backed up, and different from the local one.
- Production deployment uses Node 22 from `package.json`.
- GitHub repository is private if the project is internal.
- The deployment is served over HTTPS — session cookies are `secure` in
  production and will not be sent over plain HTTP.

Note on scaling: rate limiting is held in each instance's memory. Running
several instances multiplies the effective limit. Keep it to one instance, or
move the limiter to a shared store first.

## 15. Common Problems

### Login says invalid login or missing profile

Cause:

- User exists in Supabase Auth but not in `public.profiles`.

Fix:

```sql
insert into public.profiles (id, email, full_name, role)
values ('AUTH_USER_UUID', 'user@example.com', 'User Name', 'analyst');
```

### Setting up two-factor fails

Cause:

- `APP_ENCRYPTION_KEY` is missing, or is not the base64 of exactly 32 bytes.

Fix:

Generate one with `openssl rand -base64 32`, set it in the environment and
redeploy. Accounts already enrolled keep working without it; only new
enrollments need it.

### Two-factor codes stopped being accepted for everyone

Cause:

- `APP_ENCRYPTION_KEY` was changed or lost, so the stored seeds cannot be
  decrypted. The server log shows a "could not read the seed" line per account.

Fix:

Restore the original key. If it is gone, an admin must disable two-factor for
the affected accounts (delete their `totp:<username>` rows in `app_config`) and
have them enrol again.

### An analyst cannot see another analyst's records

This is intended. Analysts are served only their own entries; supervisors and
admins see everything.

### Login says too many attempts

Sign-in is rate limited per account and per source address. Wait for the window
to pass — 15 minutes — or restart the instance, since the counters are held in
memory.

### Admin dashboard says login required

Fix:

- Go to `/login`.
- Sign in with a Supabase Auth user.
- Make sure that user has a profile row.

### Admin dashboard says supervisor access required

Fix:

```sql
update public.profiles
set role = 'supervisor'
where email = 'boss@example.com';
```

### Vercel build fails with Node version problem

Confirm `package.json` contains:

```json
"engines": {
  "node": "22.x"
}
```

Then redeploy.

### Records disappear locally

The app no longer uses local JSON storage. Records should be in Supabase. Confirm your `.env.local` points to the correct Supabase project.

## 16. Official Documentation

- Supabase Auth: `https://supabase.com/docs/guides/auth`
- Supabase API keys: `https://supabase.com/docs/guides/getting-started/api-keys`
- Supabase REST API: `https://supabase.com/docs/guides/api`
- Vercel environment variables: `https://vercel.com/docs/environment-variables`
