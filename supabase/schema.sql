create extension if not exists pgcrypto;

-- ─── Core Tables ─────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text not null,
  username text unique,
  role text not null default 'analyst' check (role in ('analyst', 'supervisor', 'admin')),
  position text not null default '',
  password_change_required boolean not null default true,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- Existing installs: add the archived flag if it is missing.
alter table public.profiles
  add column if not exists archived boolean not null default false;

-- Existing installs: add the job position field if it is missing.
alter table public.profiles
  add column if not exists position text not null default '';

-- Existing installs: add the instrument metadata field if it is missing.
alter table public.instrument_templates
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.logbook_records (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'Pending' check (status in ('Pending', 'Approved', 'Rejected')),
  supervisor_comment text not null default '',
  reviewed_at timestamptz,
  reviewed_by text,
  submitted_by uuid references auth.users(id) on delete set null,
  laboratory_name text not null default '',
  department text not null default '',
  location text not null default '',
  instrument_name text not null default '',
  instrument_model text not null default '',
  serial_number text not null default '',
  manufacturer text not null default '',
  installation_date date,
  instrument_id text not null default '',
  record_date date,
  analyst text not null default '',
  activity_type text not null default 'OP',
  method_used text not null default '',
  sample_id text not null default '',
  measured_value text not null default '',
  start_time time,
  end_time time,
  metadata jsonb not null default '{}'::jsonb,
  remarks text not null default '',
  analyst_signature text not null default ''
);

-- Existing installs: add columns that newer app versions write but older
-- databases are missing (otherwise inserts fail with PGRST204 / 42703).
alter table public.logbook_records
  add column if not exists activity_type text not null default 'OP';
alter table public.logbook_records
  add column if not exists measured_value text not null default '';
alter table public.logbook_records
  add column if not exists metadata jsonb not null default '{}'::jsonb;

comment on column public.logbook_records.analyst_signature is
  'Stores typed initials/name for legacy records or a sig:v1 JSON payload containing drawn signature image, typed fallback, signer, and timestamp.';

-- ─── App Config ──────────────────────────────────────────────────────────────

create table if not exists public.app_config (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.app_config enable row level security;

-- ─── Instrument Templates ─────────────────────────────────────────────────────

create table if not exists public.instrument_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.instrument_templates (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.instrument_categories(id) on delete cascade,
  instrument_name text not null,
  instrument_model text not null default '',
  serial_number text not null default '',
  manufacturer text not null default 'Thermo Scientific',
  installation_date date,
  instrument_id text not null default '',
  laboratory_name text not null default '',
  department text not null default '',
  location text not null default '',
  desk text not null default '',
  logbook_start_date date,
  logbook_end_date date,
  method_used text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, instrument_name)
);

-- Existing installs: add the instrument detail columns if they are missing.
alter table public.instrument_templates
  add column if not exists desk text not null default '';
alter table public.instrument_templates
  add column if not exists logbook_start_date date;
alter table public.instrument_templates
  add column if not exists logbook_end_date date;

-- ─── Form Definitions (editable log forms) ───────────────────────────────────
-- The data-entry forms (their fields, ordering, etc.) are admin-editable and
-- stored here. The app seeds this table from the built-in defaults the first
-- time it is read, then treats the database as the source of truth.
create table if not exists public.form_definitions (
  id text primary key,
  title text not null,
  activity_type text not null,
  scope text not null default 'analytical' check (scope in ('analytical', 'sample')),
  fields jsonb not null default '[]'::jsonb,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Triggers ────────────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_logbook_records_updated_at on public.logbook_records;
create trigger set_logbook_records_updated_at
  before update on public.logbook_records
  for each row execute function public.set_updated_at();

drop trigger if exists set_instrument_templates_updated_at on public.instrument_templates;
create trigger set_instrument_templates_updated_at
  before update on public.instrument_templates
  for each row execute function public.set_updated_at();

drop trigger if exists set_form_definitions_updated_at on public.form_definitions;
create trigger set_form_definitions_updated_at
  before update on public.form_definitions
  for each row execute function public.set_updated_at();

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.logbook_records enable row level security;
alter table public.instrument_categories enable row level security;
alter table public.instrument_templates enable row level security;
alter table public.form_definitions enable row level security;

-- The app uses SUPABASE_SERVICE_ROLE_KEY in server-side API routes.
-- RLS remains enabled to prevent direct browser access with the anon key.

-- ─── Seed: Instrument Categories ─────────────────────────────────────────────

insert into public.instrument_categories (name, display_order) values
  ('ICP',  1),
  ('Liquid Chromatography', 2),
  ('Gas Chromatography',   3)
on conflict (name) do nothing;

-- ─── Seed: Default Instrument Templates ──────────────────────────────────────
-- All instruments are Thermo Scientific.
-- Update serial numbers, models, lab name, department, location via admin dashboard.

do $$
declare
  cat_icp  uuid;
  cat_hplc uuid;
  cat_gc   uuid;
begin
  select id into cat_icp  from public.instrument_categories where name = 'ICP';
  select id into cat_hplc from public.instrument_categories where name = 'Liquid Chromatography';
  select id into cat_gc   from public.instrument_categories where name = 'Gas Chromatography';

  -- ICP instruments
  insert into public.instrument_templates
    (category_id, instrument_name, instrument_model, instrument_id, manufacturer, method_used, display_order)
  values
    (cat_icp, 'ICP-OES', 'iCAP 7400',         'ICP-OES-001', 'Thermo Scientific', 'Elemental analysis by ICP-OES', 1),
    (cat_icp, 'ICP-MS',  'iCAP TQ',            'ICP-MS-001',  'Thermo Scientific', 'Trace metals analysis by ICP-MS', 2),
    (cat_icp, 'AAS',     'iCE 3500 AA',        'AAS-001',     'Thermo Scientific', 'Atomic absorption spectrometry', 3)
  on conflict (category_id, instrument_name) do nothing;

  -- HPLC instruments
  insert into public.instrument_templates
    (category_id, instrument_name, instrument_model, instrument_id, manufacturer, method_used, display_order)
  values
    (cat_hplc, 'Ultimate 3000', 'Dionex UltiMate 3000', 'HPLC-U3K-001', 'Thermo Scientific', 'Gradient HPLC assay / impurity method', 1),
    (cat_hplc, 'HPLC',         'Dionex UltiMate 3000', 'HPLC-001',     'Thermo Scientific', 'Isocratic HPLC assay / purity method',  2),
    (cat_hplc, 'LCMS',         'Vanquish LC + TSQ',    'LCMS-001',     'Thermo Scientific', 'LC-MS/MS quantitation method',          3)
  on conflict (category_id, instrument_name) do nothing;

  -- GC instruments
  insert into public.instrument_templates
    (category_id, instrument_name, instrument_model, instrument_id, manufacturer, method_used, display_order)
  values
    (cat_gc, 'GC 1310',       'TRACE 1310',       'GC-1310-001',  'Thermo Scientific', 'Residual solvent analysis (USP <467>)',         1),
    (cat_gc, 'GC Trace 1610', 'TRACE 1610',       'GC-T1610-001', 'Thermo Scientific', 'Volatile organic compound analysis',            2),
    (cat_gc, 'GC-MS',         'ISQ 7610 GC-MS',   'GCMS-001',     'Thermo Scientific', 'GC-MS identification and quantitation method', 3)
  on conflict (category_id, instrument_name) do nothing;
end $$;

-- ─── Migration Notes (existing installs) ─────────────────────────────────────
-- If applying to an existing database run:
--
--   alter table public.profiles
--     add column if not exists username text unique,
--     add column if not exists password_change_required boolean not null default true;
--
--   alter table public.logbook_records
--     add column if not exists activity_type text not null default 'SMP' check (activity_type in ('CAL', 'QC', 'SMP', 'PREP', 'MTN', 'BRK')),
--     add column if not exists measured_value text not null default '';
--
-- Then create instrument_categories and instrument_templates tables and
-- run the seed DO block above.
--
--   create table if not exists public.app_config (
--     key text primary key,
--     value text not null default '',
--     updated_at timestamptz not null default now(),
--     updated_by text
--   );
--   alter table public.app_config enable row level security;
--
-- ─── Pre-generated User Accounts ─────────────────────────────────────────────
-- Use the Supervisor Dashboard → Users tab to provision all 18 accounts
-- (3 admins + 15 analysts) into Supabase Auth with one click.

-- Update form_definitions scope check
alter table public.form_definitions drop constraint if exists form_definitions_scope_check;
alter table public.form_definitions add constraint form_definitions_scope_check check (scope in ('analytical', 'sample', 'instrument'));

-- Add info_form_id to instrument_templates
alter table public.instrument_templates add column if not exists info_form_id text;
