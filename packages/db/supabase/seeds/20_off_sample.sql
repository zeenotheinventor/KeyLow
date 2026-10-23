-- Open Food Facts sample products for local development. Hand written, never loaded into production
-- (deploy-supabase.yml runs db push without --include-seed).
--
-- Five products so the barcode path and the suspect review gate can be demoed with no network:
-- two ordinary, one with energy in kJ only, one drink per 100 ml and one suspect (protein missing).
-- Each row holds exactly what normaliseOffProduct in @keylow/core returns for the golden fixture named
-- in the comment above it, and its raw payload is that fixture with the code replaced. The barcodes are valid EAN-13
-- numbers in the GS1 restricted circulation range (prefix 2), so they cannot belong to a real product.
-- test/integration/database/off-sample-seed.test.ts compares the database with the normaliser, so the
-- two cannot drift apart silently. Change a fixture or a normaliser rule and that test says what moved.
--
-- fetched_at is fixed, so the products read as fresh to off-product for 90 days from it. After that
-- off-product asks OFF to refresh them, gets not found for the made up code, and keeps what is stored.
-- Foods and source data are upserted. Portions have fixed ids and are left alone when they exist.

begin;

-- Test Oat Crunch (ordinary, with a 40 g portion). Fixture: kcal-present.json with its code replaced.
insert into public.foods (source, source_ref, owner_id, name, brand, barcode, basis, density_g_per_ml, kcal, protein_g, fat_g, sat_fat_g, carbs_g, sugars_g, fibre_g, salt_g, micros, quality, food_group, fetched_at) values ('off', '2000000000015', null, 'Test Oat Crunch', 'Northfield Mills', '2000000000015', 'per_100g', null, 380, 9.5, 7.5, 1.5, 62, 0, 8, 0.25, '{"vitamin-c":0.0012,"calcium":0.06}'::jsonb, '{}'::jsonb, 'breakfast-cereals', '2026-10-07 12:00:00+00')
on conflict (source, source_ref) do update set owner_id = excluded.owner_id, name = excluded.name, brand = excluded.brand, barcode = excluded.barcode, basis = excluded.basis, density_g_per_ml = excluded.density_g_per_ml, kcal = excluded.kcal, protein_g = excluded.protein_g, fat_g = excluded.fat_g, sat_fat_g = excluded.sat_fat_g, carbs_g = excluded.carbs_g, sugars_g = excluded.sugars_g, fibre_g = excluded.fibre_g, salt_g = excluded.salt_g, micros = excluded.micros, quality = excluded.quality, food_group = excluded.food_group, fetched_at = excluded.fetched_at;
insert into public.food_source_data (food_id, import_run_id, raw) values ((select id from public.foods where source = 'off' and source_ref = '2000000000015'), null, '{"code":"2000000000015","product_name":"Oat Crunch","product_name_en":"Test Oat Crunch","brands":"Northfield Mills, Other Brand","quantity":"500 g","serving_size":"40 g","serving_quantity":40,"nutrition_data_per":"100g","countries_tags":["en:united-kingdom"],"categories_tags":["en:breakfast-cereals","en:oat-flakes"],"nutriscore_grade":"b","image_front_url":"https://images.example.test/oat-crunch.jpg","nutriments":{"energy-kcal_100g":380,"energy-kcal_unit":"kcal","energy-kj_100g":1590,"proteins_100g":9.5,"proteins_unit":"g","fat_100g":7.5,"saturated-fat_100g":1.5,"carbohydrates_100g":62,"sugars_100g":0,"fiber_100g":8,"salt_100g":0.25,"sodium_100g":0.1,"vitamin-c_100g":0.0012,"calcium_100g":0.06}}'::jsonb)
on conflict (food_id) do update set import_run_id = excluded.import_run_id, raw = excluded.raw;
insert into public.food_portions (id, food_id, owner_id, label, grams, ml, is_default, position) values ('5eed0020-0000-4000-8000-000000000010', (select id from public.foods where source = 'off' and source_ref = '2000000000015'), null, '40 g', 40, null, true, 0)
on conflict (id) do nothing;
insert into public.food_portions (id, food_id, owner_id, label, grams, ml, is_default, position) values ('5eed0020-0000-4000-8000-000000000011', (select id from public.foods where source = 'off' and source_ref = '2000000000015'), null, '1 pack', 500, null, false, 1)
on conflict (id) do nothing;

-- Savoury Stock Cube (ordinary, salt worked out from sodium, a 1 pack portion and no serving). Fixture: sodium-no-salt.json with its code replaced.
insert into public.foods (source, source_ref, owner_id, name, brand, barcode, basis, density_g_per_ml, kcal, protein_g, fat_g, sat_fat_g, carbs_g, sugars_g, fibre_g, salt_g, micros, quality, food_group, fetched_at) values ('off', '2000000000022', null, 'Savoury Stock Cube', null, '2000000000022', 'per_100g', null, 250, 8, 12, null, 25, null, 1, 1, '{}'::jsonb, '{}'::jsonb, null, '2026-10-07 12:00:00+00')
on conflict (source, source_ref) do update set owner_id = excluded.owner_id, name = excluded.name, brand = excluded.brand, barcode = excluded.barcode, basis = excluded.basis, density_g_per_ml = excluded.density_g_per_ml, kcal = excluded.kcal, protein_g = excluded.protein_g, fat_g = excluded.fat_g, sat_fat_g = excluded.sat_fat_g, carbs_g = excluded.carbs_g, sugars_g = excluded.sugars_g, fibre_g = excluded.fibre_g, salt_g = excluded.salt_g, micros = excluded.micros, quality = excluded.quality, food_group = excluded.food_group, fetched_at = excluded.fetched_at;
insert into public.food_source_data (food_id, import_run_id, raw) values ((select id from public.foods where source = 'off' and source_ref = '2000000000022'), null, '{"code":"2000000000022","product_name":"Savoury Stock Cube","quantity":"100 g","nutrition_data_per":"100g","countries_tags":["en:united-kingdom"],"nutriments":{"energy-kcal_100g":250,"proteins_100g":8,"fat_100g":12,"carbohydrates_100g":25,"fiber_100g":1,"sodium_100g":0.4}}'::jsonb)
on conflict (food_id) do update set import_run_id = excluded.import_run_id, raw = excluded.raw;
insert into public.food_portions (id, food_id, owner_id, label, grams, ml, is_default, position) values ('5eed0020-0000-4000-8000-000000000021', (select id from public.foods where source = 'off' and source_ref = '2000000000022'), null, '1 pack', 100, null, false, 0)
on conflict (id) do nothing;

-- Kilojoule Bar (energy given in kJ only, so kcal is converted). Fixture: kj-only.json with its code replaced.
insert into public.foods (source, source_ref, owner_id, name, brand, barcode, basis, density_g_per_ml, kcal, protein_g, fat_g, sat_fat_g, carbs_g, sugars_g, fibre_g, salt_g, micros, quality, food_group, fetched_at) values ('off', '2000000000039', null, 'Kilojoule Bar', 'Northfield Mills', '2000000000039', 'per_100g', null, 250, 10, 5, null, 20, null, 3, null, '{}'::jsonb, '{}'::jsonb, null, '2026-10-07 12:00:00+00')
on conflict (source, source_ref) do update set owner_id = excluded.owner_id, name = excluded.name, brand = excluded.brand, barcode = excluded.barcode, basis = excluded.basis, density_g_per_ml = excluded.density_g_per_ml, kcal = excluded.kcal, protein_g = excluded.protein_g, fat_g = excluded.fat_g, sat_fat_g = excluded.sat_fat_g, carbs_g = excluded.carbs_g, sugars_g = excluded.sugars_g, fibre_g = excluded.fibre_g, salt_g = excluded.salt_g, micros = excluded.micros, quality = excluded.quality, food_group = excluded.food_group, fetched_at = excluded.fetched_at;
insert into public.food_source_data (food_id, import_run_id, raw) values ((select id from public.foods where source = 'off' and source_ref = '2000000000039'), null, '{"code":"2000000000039","product_name":"Kilojoule Bar","brands":"Northfield Mills","quantity":"200 g","nutrition_data_per":"100g","countries_tags":["en:united-kingdom"],"nutriments":{"energy-kj_100g":1046,"energy_100g":1046,"proteins_100g":10,"fat_100g":5,"carbohydrates_100g":20,"fiber_100g":3}}'::jsonb)
on conflict (food_id) do update set import_run_id = excluded.import_run_id, raw = excluded.raw;
insert into public.food_portions (id, food_id, owner_id, label, grams, ml, is_default, position) values ('5eed0020-0000-4000-8000-000000000031', (select id from public.foods where source = 'off' and source_ref = '2000000000039'), null, '1 pack', 200, null, false, 0)
on conflict (id) do nothing;

-- Sparkling Apple Drink (a drink, per 100 ml, with a 250 ml serving and a 1 pack portion). Fixture: liquid-ml.json with its code replaced.
insert into public.foods (source, source_ref, owner_id, name, brand, barcode, basis, density_g_per_ml, kcal, protein_g, fat_g, sat_fat_g, carbs_g, sugars_g, fibre_g, salt_g, micros, quality, food_group, fetched_at) values ('off', '2000000000046', null, 'Sparkling Apple Drink', 'Orchard Lane', '2000000000046', 'per_100ml', null, 42, 0.5, 0.1, null, 10, 9.5, 0.2, 0.01, '{}'::jsonb, '{}'::jsonb, 'beverages', '2026-10-07 12:00:00+00')
on conflict (source, source_ref) do update set owner_id = excluded.owner_id, name = excluded.name, brand = excluded.brand, barcode = excluded.barcode, basis = excluded.basis, density_g_per_ml = excluded.density_g_per_ml, kcal = excluded.kcal, protein_g = excluded.protein_g, fat_g = excluded.fat_g, sat_fat_g = excluded.sat_fat_g, carbs_g = excluded.carbs_g, sugars_g = excluded.sugars_g, fibre_g = excluded.fibre_g, salt_g = excluded.salt_g, micros = excluded.micros, quality = excluded.quality, food_group = excluded.food_group, fetched_at = excluded.fetched_at;
insert into public.food_source_data (food_id, import_run_id, raw) values ((select id from public.foods where source = 'off' and source_ref = '2000000000046'), null, '{"code":"2000000000046","product_name":"Sparkling Apple Drink","brands":"Orchard Lane","quantity":"1 L","serving_size":"250 ml","serving_quantity":250,"nutrition_data_per":"100g","countries_tags":["en:united-kingdom"],"categories_tags":["en:beverages","en:fruit-juices"],"nutriments":{"energy-kcal_100g":42,"proteins_100g":0.5,"fat_100g":0.1,"carbohydrates_100g":10,"sugars_100g":9.5,"fiber_100g":0.2,"salt_100g":0.01}}'::jsonb)
on conflict (food_id) do update set import_run_id = excluded.import_run_id, raw = excluded.raw;
insert into public.food_portions (id, food_id, owner_id, label, grams, ml, is_default, position) values ('5eed0020-0000-4000-8000-000000000040', (select id from public.foods where source = 'off' and source_ref = '2000000000046'), null, '250 ml', null, 250, true, 0)
on conflict (id) do nothing;
insert into public.food_portions (id, food_id, owner_id, label, grams, ml, is_default, position) values ('5eed0020-0000-4000-8000-000000000041', (select id from public.foods where source = 'off' and source_ref = '2000000000046'), null, '1 pack', null, 1000, false, 1)
on conflict (id) do nothing;

-- Mystery Spread (suspect, protein is missing). Fixture: missing-protein.json with its code replaced.
insert into public.foods (source, source_ref, owner_id, name, brand, barcode, basis, density_g_per_ml, kcal, protein_g, fat_g, sat_fat_g, carbs_g, sugars_g, fibre_g, salt_g, micros, quality, food_group, fetched_at) values ('off', '2000000000053', null, 'Mystery Spread', 'Northfield Mills', '2000000000053', 'per_100g', null, 200, null, 10, null, 20, null, 2, null, '{}'::jsonb, '{"suspect":true,"fields_missing":["protein_g"]}'::jsonb, null, '2026-10-07 12:00:00+00')
on conflict (source, source_ref) do update set owner_id = excluded.owner_id, name = excluded.name, brand = excluded.brand, barcode = excluded.barcode, basis = excluded.basis, density_g_per_ml = excluded.density_g_per_ml, kcal = excluded.kcal, protein_g = excluded.protein_g, fat_g = excluded.fat_g, sat_fat_g = excluded.sat_fat_g, carbs_g = excluded.carbs_g, sugars_g = excluded.sugars_g, fibre_g = excluded.fibre_g, salt_g = excluded.salt_g, micros = excluded.micros, quality = excluded.quality, food_group = excluded.food_group, fetched_at = excluded.fetched_at;
insert into public.food_source_data (food_id, import_run_id, raw) values ((select id from public.foods where source = 'off' and source_ref = '2000000000053'), null, '{"code":"2000000000053","product_name":"Mystery Spread","brands":"Northfield Mills","quantity":"300 g","nutrition_data_per":"100g","countries_tags":["en:united-kingdom"],"nutriments":{"energy-kcal_100g":200,"fat_100g":10,"carbohydrates_100g":20,"fiber_100g":2}}'::jsonb)
on conflict (food_id) do update set import_run_id = excluded.import_run_id, raw = excluded.raw;
insert into public.food_portions (id, food_id, owner_id, label, grams, ml, is_default, position) values ('5eed0020-0000-4000-8000-000000000051', (select id from public.foods where source = 'off' and source_ref = '2000000000053'), null, '1 pack', 300, null, false, 0)
on conflict (id) do nothing;

commit;
