-- Asserts the row level security, column grants and check constraints on
-- public.foods (ADR 0003 and its Amendment 1): global rows are readable by
-- everyone signed in and written only by the service role, user rows belong to
-- their owner, a user can change only the columns they were granted, nobody
-- but the service role can delete, and the table's own rules reject bad data.
--
-- `supabase test db` runs this file as postgres inside a transaction that is
-- rolled back, so nothing created here persists. Each actor is entered with
-- `set local role` plus the JWT claims that `auth.uid()` reads, and left with
-- `reset role`.

begin;

select plan(65);

-- Two users. The on_auth_user_created trigger creates their profiles rows.
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '36000001-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'foods-user-a@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '36000001-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'foods-user-b@keylow.test');

-- Fixture rows, inserted as postgres so row level security does not apply.
-- Two global rows, two foods for user A (two user rows with a null source_ref
-- must coexist) and one for user B.
insert into public.foods (id, source, source_ref, owner_id, name, brand, basis, kcal, fetched_at) values
  ('36000001-0000-4000-8000-000000000101', 'cofid', 'CF-FIXTURE-1', null, 'Fixture porridge oats', null, 'per_100g', 372, null),
  ('36000001-0000-4000-8000-000000000102', 'off', '5000000000017', null, 'Fixture cola', 'Fixture Brand', 'per_100ml', 42, '2026-10-01 12:00:00+00'),
  ('36000001-0000-4000-8000-0000000001a1', 'user', null, '36000001-0000-4000-8000-00000000000a', 'Fixture A bread', null, 'per_100g', 250, null),
  ('36000001-0000-4000-8000-0000000001a2', 'user', null, '36000001-0000-4000-8000-00000000000a', 'Fixture A soup', null, 'per_100g', 60, null),
  ('36000001-0000-4000-8000-0000000001b1', 'user', null, '36000001-0000-4000-8000-00000000000b', 'Fixture B cake', null, 'per_100g', 400, null);

-- Table level facts.
select ok(
  (select relrowsecurity from pg_class where oid = 'public.foods'::regclass),
  'row level security is enabled on foods'
);

select is(
  (select micros::text || quality::text from public.foods where id = '36000001-0000-4000-8000-0000000001a1'),
  '{}{}',
  'micros and quality default to the neutral empty object'
);

select ok(
  (select search @@ to_tsquery('english', 'oats') from public.foods where id = '36000001-0000-4000-8000-000000000101'),
  'the generated search column matches a word from the food name'
);

-- Check constraints, exercised as postgres so only the table's own rules fire.
select throws_ok(
  $$insert into public.foods (source, owner_id, name, basis, barcode) values ('user', '36000001-0000-4000-8000-00000000000a', 'Bad barcode', 'per_100g', '12345abc90123')$$,
  '23514',
  'new row for relation "foods" violates check constraint "foods_barcode_check"',
  'a barcode with a non-digit character is rejected'
);

select throws_ok(
  $$insert into public.foods (source, owner_id, name, basis, barcode) values ('user', '36000001-0000-4000-8000-00000000000a', 'Short barcode', 'per_100g', '1234567')$$,
  '23514',
  'new row for relation "foods" violates check constraint "foods_barcode_check"',
  'a barcode shorter than 8 digits is rejected'
);

select lives_ok(
  $$insert into public.foods (source, owner_id, name, basis, barcode) values ('user', '36000001-0000-4000-8000-00000000000a', 'Good barcode', 'per_100g', '5000000000017')$$,
  'a 13 digit barcode is accepted'
);

select is(
  (select barcode from public.foods where name = 'Good barcode'),
  '5000000000017',
  'the accepted barcode is stored unchanged'
);

select throws_ok(
  $$insert into public.foods (source, source_ref, owner_id, name, basis) values ('user', 'SOMETHING', '36000001-0000-4000-8000-00000000000a', 'Ref on user row', 'per_100g')$$,
  '23514',
  'new row for relation "foods" violates check constraint "foods_source_ref_matches_source"',
  'a user row with a source_ref is rejected'
);

select throws_ok(
  $$insert into public.foods (source, source_ref, name, basis) values ('cofid', null, 'Global without ref', 'per_100g')$$,
  '23514',
  'new row for relation "foods" violates check constraint "foods_source_ref_matches_source"',
  'a global row without a source_ref is rejected'
);

select throws_ok(
  $$insert into public.foods (source, name, basis) values ('user', 'User without owner', 'per_100g')$$,
  '23514',
  'new row for relation "foods" violates check constraint "foods_owner_matches_source"',
  'a user row without an owner_id is rejected'
);

select throws_ok(
  $$insert into public.foods (source, source_ref, owner_id, name, basis) values ('cofid', 'CF-OWNED', '36000001-0000-4000-8000-00000000000a', 'Owned global', 'per_100g')$$,
  '23514',
  'new row for relation "foods" violates check constraint "foods_owner_matches_source"',
  'a global row with an owner_id is rejected'
);

select throws_ok(
  $$insert into public.foods (source, source_ref, name, basis) values ('off', '5000000000024', 'OFF without fetch time', 'per_100g')$$,
  '23514',
  'new row for relation "foods" violates check constraint "foods_fetched_at_matches_source"',
  'an off row without fetched_at is rejected'
);

select throws_ok(
  $$insert into public.foods (source, source_ref, name, basis, fetched_at) values ('cofid', 'CF-FETCHED', 'CoFID with fetch time', 'per_100g', now())$$,
  '23514',
  'new row for relation "foods" violates check constraint "foods_fetched_at_matches_source"',
  'a cofid row with fetched_at is rejected'
);

select throws_ok(
  $$insert into public.foods (source, owner_id, name, basis, kcal) values ('user', '36000001-0000-4000-8000-00000000000a', 'Negative kcal', 'per_100g', -1)$$,
  '23514',
  'new row for relation "foods" violates check constraint "foods_kcal_check"',
  'a negative nutrient value is rejected'
);

select lives_ok(
  $$insert into public.foods (source, owner_id, name, basis, kcal, protein_g) values ('user', '36000001-0000-4000-8000-00000000000a', 'Unknown macros', 'per_100g', null, null)$$,
  'a food can be inserted with missing nutrient data'
);

select is(
  (select (kcal is null)::text || '/' || (protein_g is null)::text from public.foods where name = 'Unknown macros'),
  'true/true',
  'missing nutrient data is stored as null, never 0'
);

select throws_ok(
  $$insert into public.foods (source, owner_id, name, basis, fetched_at) values ('user', '36000001-0000-4000-8000-00000000000a', 'User with fetch time', 'per_100g', now())$$,
  '23514',
  'new row for relation "foods" violates check constraint "foods_fetched_at_matches_source"',
  'a user row with fetched_at is rejected'
);

-- Column privileges. The set of columns authenticated can write is exactly the
-- ADR's list. id, source_ref, quality, fetched_at, search and created_at are
-- never writable, and owner_id and source can be set on insert only.
select is(
  (select string_agg(column_name::text, ',' order by column_name::text collate "C") from information_schema.columns
    where table_schema = 'public' and table_name = 'foods'
      and has_column_privilege('authenticated', 'public.foods', column_name, 'INSERT')),
  'barcode,basis,brand,carbs_g,deleted_at,density_g_per_ml,fat_g,fibre_g,food_group,kcal,micros,name,owner_id,protein_g,salt_g,sat_fat_g,source,sugars_g',
  'authenticated can insert exactly the granted columns, never id, source_ref, quality, fetched_at, search or created_at'
);

select is(
  (select string_agg(column_name::text, ',' order by column_name::text collate "C") from information_schema.columns
    where table_schema = 'public' and table_name = 'foods'
      and has_column_privilege('authenticated', 'public.foods', column_name, 'UPDATE')),
  'barcode,basis,brand,carbs_g,deleted_at,density_g_per_ml,fat_g,fibre_g,food_group,kcal,micros,name,protein_g,salt_g,sat_fat_g,sugars_g',
  'authenticated can update exactly the granted columns, never owner_id or source and never the unlisted ones'
);

select throws_ok(
  $$insert into public.foods (source, owner_id, name, basis, density_g_per_ml) values ('user', '36000001-0000-4000-8000-00000000000a', 'Zero density', 'per_100ml', 0)$$,
  '23514',
  'new row for relation "foods" violates check constraint "foods_density_g_per_ml_check"',
  'a density of zero is rejected'
);

select throws_ok(
  $$insert into public.foods (source, source_ref, name, basis) values ('cofid', 'CF-FIXTURE-1', 'Duplicate CoFID code', 'per_100g')$$,
  '23505',
  'duplicate key value violates unique constraint "foods_source_source_ref_key"',
  'a second cofid row with the same source_ref fails on the unique constraint'
);

select is(
  (select count(*)::int from public.foods where source = 'user' and source_ref is null and owner_id = '36000001-0000-4000-8000-00000000000a' and name like 'Fixture A %'),
  2,
  'two user rows with a null source_ref coexist'
);

-- Anon: nothing at all.
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  'select * from public.foods',
  '42501',
  'permission denied for table foods',
  'anon cannot select from foods'
);

select throws_ok(
  $$insert into public.foods (source, owner_id, name, basis) values ('user', '36000001-0000-4000-8000-00000000000a', 'Anon food', 'per_100g')$$,
  '42501',
  'permission denied for table foods',
  'anon cannot insert into foods'
);

reset role;

-- User A: reads.
set local role authenticated;
set local request.jwt.claims = '{"sub":"36000001-0000-4000-8000-00000000000a","role":"authenticated"}';

select is(
  (select count(*)::int from public.foods where id = '36000001-0000-4000-8000-000000000101'),
  1,
  'user A can select a global cofid row'
);

select is(
  (select count(*)::int from public.foods where id = '36000001-0000-4000-8000-000000000102'),
  1,
  'user A can select a global off row'
);

select is(
  (select count(*)::int from public.foods where id = '36000001-0000-4000-8000-0000000001a1'),
  1,
  'user A can select their own food'
);

select is(
  (select count(*)::int from public.foods where id = '36000001-0000-4000-8000-0000000001b1'),
  0,
  'user A cannot select user B''s food'
);

select is(
  (select quality::text || coalesce(source_ref, 'none') || coalesce(fetched_at::text, 'none') from public.foods where id = '36000001-0000-4000-8000-000000000102'),
  '{}50000000000172026-10-01 12:00:00+00',
  'user A can read quality, source_ref and fetched_at, which are not hidden by column grants'
);

-- User A: inserts.
select lives_ok(
  $$insert into public.foods (source, owner_id, name, brand, barcode, basis, density_g_per_ml, kcal, protein_g, fat_g, sat_fat_g, carbs_g, sugars_g, fibre_g, salt_g, micros, food_group, deleted_at)
    values ('user', '36000001-0000-4000-8000-00000000000a', 'A flapjack', 'Home', '5000000000024', 'per_100g', null, 450, 6, 20, 8, 55, 25, 4, 0.2, '{"iron_mg": 2}', 'baking', null)$$,
  'user A can insert their own food using every column they are granted'
);

select is(
  (select owner_id::text || '|' || source::text || '|' || kcal::text || '|' || micros::text from public.foods where name = 'A flapjack'),
  '36000001-0000-4000-8000-00000000000a|user|450|{"iron_mg": 2}',
  'the inserted food has user A as owner, source user, and the kcal and micros that were sent'
);

select throws_ok(
  $$insert into public.foods (source, owner_id, name, basis) values ('user', '36000001-0000-4000-8000-00000000000b', 'Spoofed owner', 'per_100g')$$,
  '42501',
  'new row violates row-level security policy for table "foods"',
  'user A cannot insert a food owned by user B'
);

select throws_ok(
  $$insert into public.foods (source, name, basis) values ('user', 'Ownerless user food', 'per_100g')$$,
  '42501',
  'new row violates row-level security policy for table "foods"',
  'user A cannot insert a user food with no owner_id'
);

select throws_ok(
  $$insert into public.foods (source, name, basis) values ('cofid', 'Forged CoFID', 'per_100g')$$,
  '42501',
  'new row violates row-level security policy for table "foods"',
  'user A cannot insert a cofid row, the insert policy rejects any source but user'
);

select throws_ok(
  $$insert into public.foods (source, name, basis) values ('off', 'Forged OFF', 'per_100g')$$,
  '42501',
  'new row violates row-level security policy for table "foods"',
  'user A cannot insert an off row, the insert policy rejects any source but user'
);

select throws_ok(
  $$insert into public.foods (source, owner_id, name, basis, quality) values ('user', '36000001-0000-4000-8000-00000000000a', 'With quality', 'per_100g', '{"suspect": true}')$$,
  '42501',
  'permission denied for table foods',
  'user A cannot set quality on insert, the column is not granted'
);

select throws_ok(
  $$insert into public.foods (source, owner_id, name, basis, fetched_at) values ('user', '36000001-0000-4000-8000-00000000000a', 'With fetch time', 'per_100g', now())$$,
  '42501',
  'permission denied for table foods',
  'user A cannot set fetched_at on insert, the column is not granted'
);

select throws_ok(
  $$insert into public.foods (source, source_ref, owner_id, name, basis) values ('user', 'REF', '36000001-0000-4000-8000-00000000000a', 'With ref', 'per_100g')$$,
  '42501',
  'permission denied for table foods',
  'user A cannot set source_ref on insert, the column is not granted'
);

-- User A: updates.
select lives_ok(
  $$update public.foods set name = 'Fixture A bread, sliced', kcal = 245, deleted_at = '2026-10-02 00:00:00+00' where id = '36000001-0000-4000-8000-0000000001a1'$$,
  'user A can update the granted columns on their own food'
);

select is(
  (select name from public.foods where id = '36000001-0000-4000-8000-0000000001a1'),
  'Fixture A bread, sliced',
  'user A sees the updated name on their own food'
);

select is(
  (select kcal::text || '|' || deleted_at::text from public.foods where id = '36000001-0000-4000-8000-0000000001a1'),
  '245|2026-10-02 00:00:00+00',
  'user A sees the updated kcal and deleted_at on their own food'
);

select throws_ok(
  $$update public.foods set source = 'cofid' where id = '36000001-0000-4000-8000-0000000001a1'$$,
  '42501',
  'permission denied for table foods',
  'user A cannot change source on their own food'
);

select throws_ok(
  $$update public.foods set owner_id = '36000001-0000-4000-8000-00000000000b' where id = '36000001-0000-4000-8000-0000000001a1'$$,
  '42501',
  'permission denied for table foods',
  'user A cannot hand their food to another owner'
);

select throws_ok(
  $$update public.foods set quality = '{"suspect": false}' where id = '36000001-0000-4000-8000-0000000001a1'$$,
  '42501',
  'permission denied for table foods',
  'user A cannot change quality on their own food'
);

select throws_ok(
  $$update public.foods set fetched_at = now() where id = '36000001-0000-4000-8000-0000000001a1'$$,
  '42501',
  'permission denied for table foods',
  'user A cannot change fetched_at on their own food'
);

select throws_ok(
  $$update public.foods set source_ref = 'REF' where id = '36000001-0000-4000-8000-0000000001a1'$$,
  '42501',
  'permission denied for table foods',
  'user A cannot change source_ref on their own food'
);

select lives_ok(
  $$update public.foods set name = 'Hijacked' where id = '36000001-0000-4000-8000-0000000001b1'$$,
  'user A updating user B''s food is silently filtered, not an error'
);

select lives_ok(
  $$update public.foods set name = 'Hijacked' where id = '36000001-0000-4000-8000-000000000101'$$,
  'user A updating a global food is silently filtered, not an error'
);

select lives_ok(
  $$update public.foods set deleted_at = now() where id = '36000001-0000-4000-8000-0000000001a2'$$,
  'user A can soft delete their own food by setting deleted_at'
);

select is(
  (select deleted_at is not null from public.foods where id = '36000001-0000-4000-8000-0000000001a2'),
  true,
  'a soft deleted food stays selectable by its owner'
);

-- User A: deletes.
select throws_ok(
  $$delete from public.foods where id = '36000001-0000-4000-8000-0000000001a1'$$,
  '42501',
  'permission denied for table foods',
  'user A cannot delete their own food, only soft delete it'
);

select throws_ok(
  $$delete from public.foods where id = '36000001-0000-4000-8000-000000000101'$$,
  '42501',
  'permission denied for table foods',
  'user A cannot delete a global food'
);

reset role;

-- Postgres sees what user A's statements actually did.
select is(
  (select name || '/' || kcal::text from public.foods where id = '36000001-0000-4000-8000-0000000001b1'),
  'Fixture B cake/400',
  'user B''s food is unchanged after user A tried to update it'
);

select is(
  (select name from public.foods where id = '36000001-0000-4000-8000-000000000101'),
  'Fixture porridge oats',
  'the global food is unchanged after user A tried to update it'
);

select is(
  (select count(*)::int from public.foods where id in ('36000001-0000-4000-8000-0000000001a1', '36000001-0000-4000-8000-000000000101')),
  2,
  'both foods user A tried to delete still exist'
);

-- User B: reads.
set local role authenticated;
set local request.jwt.claims = '{"sub":"36000001-0000-4000-8000-00000000000b","role":"authenticated"}';

select is(
  (select count(*)::int from public.foods where id in ('36000001-0000-4000-8000-0000000001a1', '36000001-0000-4000-8000-0000000001a2')),
  0,
  'user B cannot select user A''s foods'
);

select is(
  (select count(*)::int from public.foods where id in ('36000001-0000-4000-8000-000000000101', '36000001-0000-4000-8000-000000000102', '36000001-0000-4000-8000-0000000001b1')),
  3,
  'user B can select the global rows and their own food'
);

select lives_ok(
  $$update public.foods set name = 'Hijacked by B' where id = '36000001-0000-4000-8000-0000000001a1'$$,
  'user B updating user A''s food is silently filtered, not an error'
);

reset role;

select is(
  (select name from public.foods where id = '36000001-0000-4000-8000-0000000001a1'),
  'Fixture A bread, sliced',
  'user A''s food is unchanged after user B tried to update it'
);

-- Service role: the only writer of global rows.
set local role service_role;

select lives_ok(
  $$insert into public.foods (source, source_ref, name, basis, quality, fetched_at) values ('off', '5000000000031', 'Service OFF row', 'per_100g', '{"suspect": true}', now())$$,
  'service_role can insert a global off row, including quality and fetched_at'
);

select is(
  (select quality::text || '|' || (fetched_at is not null)::text || '|' || (owner_id is null)::text from public.foods where source_ref = '5000000000031'),
  '{"suspect": true}|true|true',
  'the service role row is global and keeps the quality and fetched_at it was given'
);

select lives_ok(
  $$update public.foods set kcal = 100, quality = '{"kcal_derived": true}' where source_ref = '5000000000031'$$,
  'service_role can update a global row'
);

select is(
  (select kcal::text || '|' || quality::text from public.foods where source_ref = '5000000000031'),
  '100|{"kcal_derived": true}',
  'the service role update changed kcal and quality on the global row'
);

select lives_ok(
  $$delete from public.foods where source_ref = '5000000000031'$$,
  'service_role can delete a global row'
);

select is(
  (select count(*)::int from public.foods where source_ref = '5000000000031'),
  0,
  'the global row is gone after the service role deleted it'
);

reset role;

select * from finish();

rollback;
