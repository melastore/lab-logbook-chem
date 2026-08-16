# Lab Logbook

A web-based electronic logbook for analytical instrument laboratories. It replaces paper instrument logbooks with tamper-evident, append-only digital records suitable for ISO/IEC 17025 environments.

> **Proprietary software.** Copyright © 2026 melastore. All rights reserved. This source is published for reference only — see [LICENSE](./LICENSE). It may not be copied, modified, redistributed, or used without the author's written permission.

## Overview

Analysts select an instrument, fill in a structured log entry, and sign it. Each submitted record is sealed into a cryptographic hash chain in the database, so any later alteration is detectable. Corrections are made as append-only amendments, never by editing the original.

## Features

- **Instrument-driven entry** — choose an instrument and an activity type; the form adapts to that activity.
- **No-code Form Builder** — every analyst-filled field is configurable from the admin UI; nothing is hardcoded.
- **Tamper-evident records** — append-only `logbook_records` table with a per-row SHA-256 hash chained to the previous row, verifiable on demand.
- **Drawn signatures** — captured fresh per submission and bound into the record hash.
- **Role-based access** — analyst, supervisor, and admin roles; analysts see only their own entries, and archived users are blocked from signing in.
- **Admin dashboard** — searchable/filterable records, filter-aware CSV and Excel export, user management, and integrity verification.
- **Two-factor authentication** — optional TOTP per account, with the seed encrypted at rest.
- **Light/dark themes** and adjustable interface font size.

## Tech stack

- [Next.js](https://nextjs.org/) (App Router) + React + TypeScript
- [Supabase](https://supabase.com/) (Postgres + Auth) accessed via REST
- Vitest for tests

## Getting started

### Prerequisites

- Node.js 22.x
- A Supabase project

### 1. Install

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env.local` and fill in your own values:

```bash
cp .env.example .env.local
```

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key (client auth) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (server-side data access) — **keep secret** |
| `APP_ENCRYPTION_KEY` | Base64 of 32 random bytes (`openssl rand -base64 32`), used to encrypt two-factor seeds at rest — **keep secret** |
| `LAB_INITIAL_PASSWORD` | Initial password for provisioned accounts, 10+ characters (users must change it on first login) |
| `NEXT_PUBLIC_APP_URL` | Base URL of the app |

`.env.local` is git-ignored and must never be committed.

### 3. Set up the database

In the Supabase SQL editor, run in order:

1. `supabase/schema.sql` — base tables and profiles.
2. `supabase/integrity.sql` — makes `logbook_records` append-only and tamper-evident, and adds the append-only audit log.

(The remaining files in `supabase/` are incremental migrations; apply any that your project needs.)

If the install predates encrypted two-factor seeds, re-encrypt the existing ones once:

```bash
node --env-file=.env.local scripts/encrypt-totp-secrets.mjs --dry-run   # preview
node --env-file=.env.local scripts/encrypt-totp-secrets.mjs            # apply
```

New enrollments are encrypted on write and plaintext rows keep working, so this is cleanup rather than a blocker.

### 4. Run

```bash
npm run dev      # http://localhost:3000
npm run build    # production build
npm test         # run tests
```

### 5. Create the first admin

Open `/setup` and run it once. It provisions the admin accounts listed in
`src/lib/generated-users.ts` using `LAB_INITIAL_PASSWORD`, and then closes
itself — once an admin profile exists the endpoint refuses to run again, so it
is safe to leave reachable. Everyone else is created from the admin dashboard.

Each account must change the shared initial password at first login before it
can do anything else.

## Deployment

The app runs anywhere Next.js does; [SUPABASE_VERCEL_SETUP.md](./SUPABASE_VERCEL_SETUP.md)
walks through Supabase + Vercel step by step.

Set the same variables as the table above in the host's environment — all of
them, including `APP_ENCRYPTION_KEY`. Two are worth calling out:

- **`APP_ENCRYPTION_KEY` is required.** Generate a separate one per environment
  and store it with the same care as a database credential. The app starts and
  signs users in without it, and accounts already enrolled in two-factor keep
  working, but new enrollments fail until it is set. **Losing or rotating this
  key makes existing two-factor seeds unreadable**, and every enrolled user has
  to re-enrol — so back it up, and never regenerate it casually.
- **`LAB_INITIAL_PASSWORD` must be at least 10 characters**, or provisioning
  refuses to run.

Two operational limits to know about:

- **Rate limiting is in-process** (`src/lib/rate-limit.ts`). On a single
  instance it is accurate; across several instances or on scale-to-zero
  serverless each one keeps its own counters, so the effective limit multiplies.
  Move it to a shared store before running more than one instance.
- **Sessions are cookie-based** with a 1-hour access token and a rolling 12-hour
  idle window, so users re-authenticate at least daily.

## Operations

| Task | How |
|---|---|
| Verify record integrity | Admin dashboard → integrity check, or `GET /api/logbook/verify` (supervisor+) |
| Export a backup | Admin dashboard → backup (admin only). Credential values are redacted and cannot be restored from the file |
| Review the audit trail | Admin dashboard → audit log (supervisor+); covers sign-in, user management, amendments and backup exports |
| Correct a record | Amend it from the dashboard — the original stays locked and the correction is chained to it |

## Security & privacy

- **No secrets in the repository.** All credentials live in `.env.local` (git-ignored); the committed `.env.example` holds placeholders only.
- **Append-only, hash-chained records.** The database blocks `UPDATE`/`DELETE` on logbook records; integrity can be re-verified at any time.
- **Records are scoped server-side.** An analyst is served only their own entries — including the signature images bound to them. Supervisors and admins see the whole book.
- **Two-factor seeds are encrypted at rest** (AES-256-GCM) and are redacted from admin backup exports, so a backup file cannot be used to bypass anyone's second factor.
- **Password changes require the current password**, so an unattended session cannot be used to take an account over. Passwords are 10+ characters, and cannot reuse the shared initial password or contain the username.
- **Disabled accounts cannot authenticate.** Archived users are rejected at login, and an archived profile invalidates any live session on its next request.
- **Sign-in is rate limited** per account and per source address; two-factor code checks are limited too.
- **Sessions time out.** The access cookie lasts an hour and the refresh cookie a rolling 12 hours of inactivity; signing out revokes the refresh token at Supabase rather than only dropping the cookie.
- **Hardened responses.** A per-request nonce CSP, `frame-ancestors 'none'`, HSTS, `Referrer-Policy: no-referrer`, and `no-store` on every API response. The app is marked `noindex`.
- **Errors don't leak internals.** Database and infrastructure failures are logged server-side and returned as a generic message.
- **Least exposure.** Internal lab document templates and working notes are excluded from version control.

## License

Proprietary — all rights reserved. See [LICENSE](./LICENSE).
