# Supabase and Vercel Setup Guide

This guide deploys the laboratory logbook app with:

- Vercel for Next.js hosting
- Supabase Auth for login
- Supabase Postgres for logbook records
- Telegram Bot API for supervisor notifications

## 1. Requirements

- GitHub account
- Vercel account
- Supabase account
- Telegram account for the supervisor/boss
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
4. Open this local file:

```text
supabase/schema.sql
```

5. Copy the full SQL.
6. Paste it into Supabase SQL Editor.
7. Click **Run**.

This creates:

- `public.profiles`
- `public.logbook_records`
- role constraints
- update timestamp trigger
- Row Level Security enabled

## 4. Create Users in Supabase Auth

For a 10-person lab, create users manually.

1. In Supabase, go to **Authentication**.
2. Open **Users**.
3. Click **Add user**.
4. Enter the user's email and password.
5. Confirm the user if Supabase asks.
6. Copy the user's UUID.

Create users for:

- Analysts
- Supervisor/boss
- Optional admin

## 5. Add User Profiles and Roles

After creating Auth users, insert matching rows into `public.profiles`.

Go to **SQL Editor** and run:

```sql
insert into public.profiles (id, email, full_name, role)
values
  ('PASTE_ANALYST_USER_UUID', 'analyst1@example.com', 'Analyst One', 'analyst'),
  ('PASTE_BOSS_USER_UUID', 'boss@example.com', 'Boss Name', 'supervisor');
```

Allowed roles:

```text
analyst
supervisor
admin
```

Use:

- `analyst` for people who submit instrument records
- `supervisor` for the boss who reviews and approves
- `admin` for full internal management access

## 6. Get Supabase Environment Variables

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

## 7. Create Telegram Bot

1. Open Telegram.
2. Search for `@BotFather`.
3. Send:

```text
/newbot
```

4. Follow the prompts.
5. Copy the bot token.

Set:

```bash
TELEGRAM_BOT_TOKEN=123456789:your_bot_token
```

## 8. Get Supervisor Telegram Chat ID

For one supervisor:

1. Ask the supervisor to open your bot.
2. Ask them to send any message to the bot.
3. In a browser, open:

```text
https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates
```

4. Find:

```json
"chat":{"id":123456789}
```

Set:

```bash
TELEGRAM_CHAT_ID=123456789
```

For a Telegram group:

1. Add the bot to the group.
2. Send a message in the group.
3. Open `getUpdates`.
4. Use the group `chat.id`.

Group chat IDs are often negative numbers.

## 9. Local Environment File

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
LAB_INITIAL_PASSWORD=replace_with_a_strong_temporary_password
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

Run locally:

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

Test:

1. Go to `/login`.
2. Sign in as an analyst.
3. Submit one logbook record.
4. Confirm Telegram receives a notification.
5. Sign in as supervisor.
6. Open `/admin`.
7. Approve or reject the record.

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
LAB_INITIAL_PASSWORD=replace_with_a_strong_temporary_password
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
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

This makes Telegram messages link to the hosted dashboard.

## 13. Supabase Security Checklist

Confirm:

- RLS is enabled on `profiles`.
- RLS is enabled on `logbook_records`.
- `SUPABASE_SERVICE_ROLE_KEY` is only in Vercel environment variables.
- `.env.local` is not pushed to GitHub.
- Only trusted people have Vercel project access.
- Only trusted admins have Supabase project access.
- Analyst users have role `analyst`.
- Boss/supervisor has role `supervisor` or `admin`.

## 14. Vercel Security Checklist

Confirm:

- Environment variables are set in Vercel.
- `SUPABASE_SERVICE_ROLE_KEY` is not exposed with `NEXT_PUBLIC_`.
- Production deployment uses Node 22 from `package.json`.
- GitHub repository is private if the project is internal.

## 15. Common Problems

### Login says invalid login or missing profile

Cause:

- User exists in Supabase Auth but not in `public.profiles`.

Fix:

```sql
insert into public.profiles (id, email, full_name, role)
values ('AUTH_USER_UUID', 'user@example.com', 'User Name', 'analyst');
```

### Analyst submits but Telegram is not sent

Check:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- The supervisor has sent at least one message to the bot
- The bot is still active

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
- Telegram Bot API `sendMessage`: `https://core.telegram.org/bots/api#sendmessage`
