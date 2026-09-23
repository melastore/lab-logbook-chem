-- Admin reviews (approve / reject / comment).
-- Run once in the Supabase SQL editor, after integrity.sql.
--
-- logbook_records can't be updated, so reviews go in their own append-only
-- table. A record's status is its latest Approved/Rejected review, or Pending
-- if there is none. record_hash is the hash of the record when it was reviewed.
-- Reviews are hash-chained like the records, so a forged or edited approval
-- shows up in verify_review_chain().

create table if not exists public.logbook_reviews (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  record_id     uuid not null references public.logbook_records(id),
  record_hash   text not null default '',
  decision      text not null check (decision in ('Approved', 'Rejected', 'Comment')),
  comment       text not null default '',
  reviewer_id   uuid references auth.users(id) on delete no action,
  reviewer_name text not null default '',
  chain_index   bigint,
  prev_hash     text not null default '',
  review_hash   text not null default '',
  constraint logbook_reviews_reject_reason check (decision <> 'Rejected' or length(trim(comment)) > 0),
  constraint logbook_reviews_comment_text check (decision <> 'Comment' or length(trim(comment)) > 0)
);

create index if not exists logbook_reviews_record_idx
  on public.logbook_reviews (record_id, created_at);

alter table public.logbook_reviews enable row level security;

create or replace function public.logbook_reviews_block_change()
returns trigger language plpgsql as $$
begin
  raise exception 'logbook_reviews is append-only: % is not permitted', tg_op
    using errcode = 'check_violation';
end $$;

drop trigger if exists logbook_reviews_no_update on public.logbook_reviews;
create trigger logbook_reviews_no_update
  before update on public.logbook_reviews
  for each row execute function public.logbook_reviews_block_change();

drop trigger if exists logbook_reviews_no_delete on public.logbook_reviews;
create trigger logbook_reviews_no_delete
  before delete on public.logbook_reviews
  for each row execute function public.logbook_reviews_block_change();

-- Hash chain
create sequence if not exists public.logbook_review_chain_seq;

create table if not exists public.logbook_review_chain_state (
  id        boolean primary key default true check (id),
  last_hash text not null default ''
);
insert into public.logbook_review_chain_state (id, last_hash)
  values (true, '') on conflict (id) do nothing;
alter table public.logbook_review_chain_state enable row level security;

create or replace function public.logbook_review_payload(r public.logbook_reviews)
returns text language sql immutable as $$
  select concat_ws('|',
    r.id::text,
    to_char(r.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
    r.record_id::text,
    coalesce(r.record_hash, ''),
    r.decision,
    coalesce(r.comment, ''),
    coalesce(r.reviewer_id::text, ''),
    coalesce(r.reviewer_name, '')
  );
$$;

create or replace function public.logbook_review_seal()
returns trigger language plpgsql as $$
declare
  v_prev text;
begin
  update public.logbook_review_chain_state
     set last_hash = last_hash
   where id = true
   returning last_hash into v_prev;

  new.chain_index := nextval('public.logbook_review_chain_seq');
  new.prev_hash   := coalesce(v_prev, '');
  new.review_hash := public.logbook_compute_hash(public.logbook_review_payload(new), new.prev_hash);

  update public.logbook_review_chain_state set last_hash = new.review_hash where id = true;
  return new;
end $$;

drop trigger if exists logbook_review_seal_trg on public.logbook_reviews;
create trigger logbook_review_seal_trg
  before insert on public.logbook_reviews
  for each row execute function public.logbook_review_seal();

create or replace function public.verify_review_chain()
returns table(ok boolean, checked bigint, first_bad uuid)
language plpgsql stable as $$
declare
  r       public.logbook_reviews;
  running text := '';
  cnt     bigint := 0;
begin
  for r in select * from public.logbook_reviews order by chain_index asc loop
    if r.prev_hash is distinct from running
       or r.review_hash is distinct from public.logbook_compute_hash(public.logbook_review_payload(r), running) then
      ok := false; checked := cnt; first_bad := r.id; return next; return;
    end if;
    running := r.review_hash;
    cnt := cnt + 1;
  end loop;
  ok := true; checked := cnt; first_bad := null; return next;
end $$;

-- Check after applying:  select * from public.verify_review_chain();
