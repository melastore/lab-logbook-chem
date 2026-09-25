-- Form categories made by admins (e.g. Certificate), shown next to
-- Analytical Logs / Sample Prep / General Info on the Forms page.
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- A form in one of these categories stores the category id in
-- form_definitions.scope, so the old check on that column has to go.

create table if not exists public.form_categories (
  id            text primary key,
  name          text not null unique,
  display_order int not null default 0,
  created_at    timestamptz not null default now()
);

alter table public.form_categories enable row level security;

alter table public.form_definitions
  drop constraint if exists form_definitions_scope_check;
