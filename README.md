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
- **Role-based access** — analyst, supervisor, and admin roles; archived users are blocked from signing in.
- **Admin dashboard** — searchable/filterable records, filter-aware CSV and Excel export, user management, and integrity verification.
- **Light/dark themes** and adjustable interface font size.
- **Optional Telegram notifications** to a supervisor on each submission.

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
| `LAB_INITIAL_PASSWORD` | Initial password for provisioned accounts (users must change it on first login) |
| `NEXT_PUBLIC_APP_URL` | Base URL of the app |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Optional submission notifications |

`.env.local` is git-ignored and must never be committed.

### 3. Set up the database

In the Supabase SQL editor, run in order:

1. `supabase/schema.sql` — base tables and profiles.
2. `supabase/integrity.sql` — makes `logbook_records` append-only and tamper-evident, and adds the append-only audit log.

(The remaining files in `supabase/` are incremental migrations; apply any that your project needs.)

### 4. Run

```bash
npm run dev      # http://localhost:3000
npm run build    # production build
npm test         # run tests
```

## Security & privacy

- **No secrets in the repository.** All credentials live in `.env.local` (git-ignored); the committed `.env.example` holds placeholders only.
- **Append-only, hash-chained records.** The database blocks `UPDATE`/`DELETE` on logbook records; integrity can be re-verified at any time.
- **Disabled accounts cannot authenticate.** Archived users are rejected at login.
- **Least exposure.** Internal lab document templates and working notes are excluded from version control.

## License

Proprietary — all rights reserved. See [LICENSE](./LICENSE).
