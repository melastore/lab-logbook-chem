-- ─────────────────────────────────────────────────────────────────────────────
-- CRITICAL FIX: the live database's form_definitions.scope CHECK constraint only
-- allows ('analytical', 'sample'), so the "instrument" (General Information)
-- form cannot be stored. Because the app seeds all default forms in one batch,
-- that one rejected row makes the WHOLE seed fail — leaving form_definitions
-- empty and the General Information tab blank.
--
-- This migration is in schema.sql (lines 251-252) but was never applied here.
-- Run it in Supabase dashboard → SQL Editor → New query → Run. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.form_definitions
  drop constraint if exists form_definitions_scope_check;

alter table public.form_definitions
  add constraint form_definitions_scope_check
  check (scope in ('analytical', 'sample', 'instrument'));
