-- ─────────────────────────────────────────────────────────────────────────────
-- CRITICAL FIX: the live database is missing the `info_form_id` column on
-- instrument_templates. The app writes this column on every instrument
-- create/edit, so without it ALL instrument add/edit operations fail with:
--   PGRST204 "Could not find the 'info_form_id' column ... in the schema cache"
--
-- This migration is already in schema.sql (line ~255) but was never applied to
-- this database. Run it in Supabase dashboard → SQL Editor → New query → Run.
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.instrument_templates
  add column if not exists info_form_id text;
