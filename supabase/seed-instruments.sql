-- ─────────────────────────────────────────────────────────────────────────────
-- Authoritative instrument set for the left-hand navigation.
-- Running this makes the database contain EXACTLY these instruments and nothing
-- else — any other instruments/categories are removed. Safe to re-run.
--
-- Existing logbook records are unaffected: they store instrument details as
-- plain columns, not a foreign key to these templates.
--
--   Elemental             → ICP-MS, ICP-OES, AAS
--   Liquid Chromatography → Vanquish, Ultimate 3000, LC-MS/MS
--   Gas Chromatography    → TRACE 1310, TRACE 1610, GC-MS/MS
-- All instruments are Thermo Scientific.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- Wipe the current set (templates cascade-delete with their categories, but we
-- clear both explicitly for clarity) and rebuild from scratch.
delete from public.instrument_templates;
delete from public.instrument_categories;

insert into public.instrument_categories (name, display_order) values
  ('Elemental', 0),
  ('Liquid Chromatography', 1),
  ('Gas Chromatography', 2);

insert into public.instrument_templates
  (category_id, instrument_name, instrument_model, instrument_id, manufacturer, display_order,
   department, desk, laboratory_name, location, metadata, info_form_id)
values
  ((select id from public.instrument_categories where name = 'Elemental'),
   'ICP-MS', 'iCAP TQ', 'ICP-MS-001', 'Thermo Scientific', 0,
   'Chemical Metrology Research Lead Executive',
   'Organic and Inorganic Chemistry Metrology Research Desk',
   'Elemental Analysis Laboratory', 'Block 10 First Floor Room 007', '{}'::jsonb, 'instrument'),
  ((select id from public.instrument_categories where name = 'Elemental'),
   'ICP-OES', 'iCAP PRO', 'ICP-OES-001', 'Thermo Scientific', 1, '', '', '', '', '{"torch_type": "Quartz", "nebulizer": "Concentric"}'::jsonb, 'instrument'),
  ((select id from public.instrument_categories where name = 'Elemental'),
   'AAS', 'iCE 3500 AA', 'AAS-001', 'Thermo Scientific', 2, '', '', '', '', '{"lamp_positions": 6}'::jsonb, 'instrument'),

  ((select id from public.instrument_categories where name = 'Liquid Chromatography'),
   'Vanquish', 'Vanquish Core', 'HPLC-VQ-001', 'Thermo Scientific', 0, '', '', '', '', '{"pump_type": "Quaternary"}'::jsonb, 'instrument'),
  ((select id from public.instrument_categories where name = 'Liquid Chromatography'),
   'Ultimate 3000', 'Dionex UltiMate 3000', 'HPLC-U3K-001', 'Thermo Scientific', 1, '', '', '', '', '{"autosampler_capacity": 120}'::jsonb, 'instrument'),
  ((select id from public.instrument_categories where name = 'Liquid Chromatography'),
   'LC-MS/MS', 'Vanquish LC + TSQ', 'LCMS-001', 'Thermo Scientific', 2, '', '', '', '', '{"ion_source": "H-ESI"}'::jsonb, 'instrument'),

  ((select id from public.instrument_categories where name = 'Gas Chromatography'),
   'TRACE 1310', 'TRACE 1310', 'GC-1310-001', 'Thermo Scientific', 0, '', '', '', '', '{"injector_type": "SSL", "detector": "FID"}'::jsonb, 'instrument'),
  ((select id from public.instrument_categories where name = 'Gas Chromatography'),
   'TRACE 1610', 'TRACE 1610', 'GC-1610-001', 'Thermo Scientific', 1, '', '', '', '', '{"oven_max_temp": 450, "screen_type": "Touch"}'::jsonb, 'instrument'),
  ((select id from public.instrument_categories where name = 'Gas Chromatography'),
   'GC-MS/MS', 'TSQ 9610 GC-MS/MS', 'GC-MSMS-001', 'Thermo Scientific', 2, '', '', '', '', '{"vacuum_system": "Turbo"}'::jsonb, 'instrument');

commit;
