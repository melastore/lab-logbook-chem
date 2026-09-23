-- The app now has two roles: admin and analyst. Run once in the Supabase SQL
-- editor to convert any existing supervisor accounts and tighten the check.
update public.profiles set role = 'admin' where role = 'supervisor';

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('analyst', 'admin'));
