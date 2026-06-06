-- ─────────────────────────────────────────────────────────────────────────────
-- One-time rename of existing instrument categories in the LIVE database.
-- The app reads category names from the database, so renaming them here updates
-- every place they appear (nav, admin table, badges). Safe to re-run.
--
-- Run this in the Supabase dashboard → SQL Editor → New query → Run.
-- ─────────────────────────────────────────────────────────────────────────────

update public.instrument_categories set name = 'Liquid Chromatography' where name = 'HPLC';
update public.instrument_categories set name = 'Gas Chromatography'     where name = 'GC';

-- Order: Elemental → Liquid Chromatography → Gas Chromatography
update public.instrument_categories set display_order = 0 where name = 'Elemental';
update public.instrument_categories set display_order = 1 where name = 'Liquid Chromatography';
update public.instrument_categories set display_order = 2 where name = 'Gas Chromatography';
