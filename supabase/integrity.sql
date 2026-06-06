-- ============================================================================
--  ISO/IEC 17025 RECORD INTEGRITY  —  apply ONCE in the Supabase SQL editor
-- ----------------------------------------------------------------------------
--  This migration turns `logbook_records` into an APPEND-ONLY, TAMPER-EVIDENT
--  table:
--    * UPDATE and DELETE are blocked for EVERYONE (including the service-role
--      key the app uses and the Supabase dashboard) by database triggers.
--    * Every row is sealed at insert time with a SHA-256 hash chained to the
--      previous row, so any out-of-band alteration is cryptographically
--      detectable via verify_logbook_chain().
--    * Corrections are made as APPEND-ONLY AMENDMENTS (new rows that reference
--      the original via `amends`), never by editing the original.
--    * A companion append-only `audit_log` records security-relevant events.
--
--  Order matters: we backfill existing rows BEFORE installing the block
--  triggers, otherwise the backfill UPDATEs would themselves be rejected.
-- ============================================================================

create extension if not exists pgcrypto;

-- ─── 1. Integrity + amendment columns ────────────────────────────────────────
alter table public.logbook_records
  add column if not exists chain_index      bigint,
  add column if not exists prev_hash        text not null default '',
  add column if not exists record_hash      text not null default '',
  add column if not exists amends           uuid references public.logbook_records(id),
  add column if not exists amendment_reason text not null default '';

create sequence if not exists public.logbook_chain_seq;

-- Single-row table that holds the head of the hash chain. Locking this row
-- serialises concurrent inserts so the chain stays strictly linear.
create table if not exists public.logbook_chain_state (
  id        boolean primary key default true check (id),
  last_hash text not null default ''
);
insert into public.logbook_chain_state (id, last_hash)
  values (true, '') on conflict (id) do nothing;
alter table public.logbook_chain_state enable row level security;

-- ─── 2. Canonical payload + hash helpers (shared by seal AND verify) ──────────
-- created_at is rendered in UTC so the hash is independent of session timezone.
create or replace function public.logbook_payload(r public.logbook_records)
returns text language sql immutable as $$
  select concat_ws('|',
    r.id::text,
    to_char(r.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
    coalesce(r.submitted_by::text, ''),
    coalesce(r.laboratory_name, ''),
    coalesce(r.department, ''),
    coalesce(r.location, ''),
    coalesce(r.instrument_name, ''),
    coalesce(r.instrument_model, ''),
    coalesce(r.serial_number, ''),
    coalesce(r.manufacturer, ''),
    coalesce(r.installation_date::text, ''),
    coalesce(r.instrument_id, ''),
    coalesce(r.record_date::text, ''),
    coalesce(r.analyst, ''),
    coalesce(r.activity_type, ''),
    coalesce(r.method_used, ''),
    coalesce(r.sample_id, ''),
    coalesce(r.measured_value, ''),
    coalesce(r.start_time::text, ''),
    coalesce(r.end_time::text, ''),
    coalesce(r.metadata::text, '{}'),
    coalesce(r.remarks, ''),
    coalesce(r.analyst_signature, ''),
    coalesce(r.amends::text, ''),
    coalesce(r.amendment_reason, '')
  );
$$;

create or replace function public.logbook_compute_hash(payload text, prev text)
returns text language sql immutable as $$
  select encode(digest(coalesce(prev, '') || '|' || payload, 'sha256'), 'hex');
$$;

-- ─── 3. Backfill any pre-existing rows (runs while UPDATE is still allowed) ───
do $$
declare
  r       public.logbook_records;
  running text;
begin
  select last_hash into running from public.logbook_chain_state where id = true;
  running := coalesce(running, '');
  for r in
    select * from public.logbook_records
    where coalesce(record_hash, '') = ''
    order by created_at asc, id asc
  loop
    update public.logbook_records
       set chain_index = nextval('public.logbook_chain_seq'),
           prev_hash   = running,
           record_hash = public.logbook_compute_hash(public.logbook_payload(r), running)
     where id = r.id
     returning record_hash into running;
  end loop;
  update public.logbook_chain_state set last_hash = running where id = true;
end $$;

-- ─── 4. Seal new rows at INSERT time ─────────────────────────────────────────
create or replace function public.logbook_seal()
returns trigger language plpgsql as $$
declare
  v_prev text;
begin
  -- Lock + read the chain head (serialises concurrent / multi-row inserts).
  update public.logbook_chain_state
     set last_hash = last_hash
   where id = true
   returning last_hash into v_prev;

  new.chain_index := nextval('public.logbook_chain_seq');
  new.prev_hash   := coalesce(v_prev, '');
  new.record_hash := public.logbook_compute_hash(public.logbook_payload(new), new.prev_hash);

  update public.logbook_chain_state set last_hash = new.record_hash where id = true;
  return new;
end $$;

drop trigger if exists logbook_seal_trg on public.logbook_records;
create trigger logbook_seal_trg
  before insert on public.logbook_records
  for each row execute function public.logbook_seal();

-- ─── 5. Block ALL updates and deletes (append-only enforcement) ──────────────
create or replace function public.logbook_block_change()
returns trigger language plpgsql as $$
begin
  raise exception
    'logbook_records is append-only (ISO/IEC 17025): % is not permitted. Submit a correction as an amendment instead.', tg_op
    using errcode = 'check_violation';
end $$;

drop trigger if exists logbook_no_update on public.logbook_records;
create trigger logbook_no_update
  before update on public.logbook_records
  for each row execute function public.logbook_block_change();

drop trigger if exists logbook_no_delete on public.logbook_records;
create trigger logbook_no_delete
  before delete on public.logbook_records
  for each row execute function public.logbook_block_change();

-- The updated_at auto-touch trigger can never fire now (updates are blocked).
drop trigger if exists set_logbook_records_updated_at on public.logbook_records;

-- ─── 6. Preserve attribution: never NULL submitted_by via user deletion ──────
-- The old FK used ON DELETE SET NULL, which would attempt a (now-blocked)
-- UPDATE when a user is deleted. Switch to NO ACTION so a user who has
-- submitted records cannot be hard-deleted — archive them instead.
alter table public.logbook_records
  drop constraint if exists logbook_records_submitted_by_fkey;
alter table public.logbook_records
  add constraint logbook_records_submitted_by_fkey
  foreign key (submitted_by) references auth.users(id) on delete no action;

-- ─── 7. Integrity verification (walk the chain, recompute, compare) ──────────
create or replace function public.verify_logbook_chain()
returns table(ok boolean, checked bigint, first_bad uuid)
language plpgsql stable as $$
declare
  r       public.logbook_records;
  running text := '';
  cnt     bigint := 0;
begin
  for r in select * from public.logbook_records order by chain_index asc loop
    if r.prev_hash is distinct from running
       or r.record_hash is distinct from public.logbook_compute_hash(public.logbook_payload(r), running) then
      ok := false; checked := cnt; first_bad := r.id; return next; return;
    end if;
    running := r.record_hash;
    cnt := cnt + 1;
  end loop;
  ok := true; checked := cnt; first_bad := null; return next;
end $$;

-- ─── 8. Append-only audit log (security events) ──────────────────────────────
create table if not exists public.audit_log (
  id       uuid primary key default gen_random_uuid(),
  at       timestamptz not null default now(),
  actor    text not null default '',
  actor_id uuid,
  action   text not null,
  target   text not null default '',
  detail   jsonb not null default '{}'::jsonb
);
alter table public.audit_log enable row level security;

create or replace function public.audit_block_change()
returns trigger language plpgsql as $$
begin
  raise exception 'audit_log is append-only: % is not permitted', tg_op
    using errcode = 'check_violation';
end $$;

drop trigger if exists audit_no_update on public.audit_log;
create trigger audit_no_update
  before update on public.audit_log
  for each row execute function public.audit_block_change();

drop trigger if exists audit_no_delete on public.audit_log;
create trigger audit_no_delete
  before delete on public.audit_log
  for each row execute function public.audit_block_change();

-- ============================================================================
--  Verify after applying:   select * from public.verify_logbook_chain();
--  Expected:                 ok = true,  first_bad = null
-- ============================================================================
