-- Asserts public.food_log_entries (ADR 0003, Amendments 2 and 5): the diary is a
-- timeline by time, so there is no meal slot; an entry is owner-only through
-- row level security and explicit grants; the CHECKs hold the nutrients key set
-- and the item_type and id consistency; kcal is generated from the nutrients;
-- deleting a portion clears portion_id and keeps the entry; and a day's entries
-- read back in time order with same-time entries all kept.
--
-- `supabase test db` runs this file as postgres inside a transaction that is
-- rolled back, so nothing created here persists. Every fixture id starts with
-- 18100000 and every email and label with key181-, so the rows are recognisable
-- as this file's. Each actor is entered with `set local role` plus the JWT
-- claims that `auth.uid()` reads, and left with `reset role`.

begin;

select plan(81);

-- Two users. The on_auth_user_created trigger creates their profiles rows.
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '18100000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'key181-user-a@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '18100000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'key181-user-b@keylow.test');

-- Fixtures, inserted as postgres so row level security does not apply: one
-- food with a portion, a recipe, and one entry for each user.
insert into public.foods (id, source, source_ref, owner_id, name, basis) values
  ('18100000-0000-4000-8000-000000000101', 'cofid', 'KEY181-FOOD-1', null, 'key181-oats', 'per_100g'),
  ('18100000-0000-4000-8000-0000000001a1', 'user', null, '18100000-0000-4000-8000-00000000000a', 'key181-a-private-food', 'per_100g'),
  ('18100000-0000-4000-8000-0000000001b1', 'user', null, '18100000-0000-4000-8000-00000000000b', 'key181-b-private-food', 'per_100g');

insert into public.food_portions (id, food_id, owner_id, label, grams) values
  ('18100000-0000-4000-8000-000000000201', '18100000-0000-4000-8000-000000000101', null, 'key181-bowl', 40),
  ('18100000-0000-4000-8000-000000000202', '18100000-0000-4000-8000-000000000101', null, 'key181-global-spoon', 10),
  ('18100000-0000-4000-8000-0000000002a1', '18100000-0000-4000-8000-0000000001a1', '18100000-0000-4000-8000-00000000000a', 'key181-a-slice', 30),
  ('18100000-0000-4000-8000-0000000002b1', '18100000-0000-4000-8000-0000000001b1', '18100000-0000-4000-8000-00000000000b', 'key181-b-slice', 30);

-- A recipe for user A, which the recipe entries below point at now that recipe_id has a foreign key.
insert into public.recipes (id, owner_id, name, servings, computed) values
  ('18100000-0000-4000-8000-0000000000f1', '18100000-0000-4000-8000-00000000000a', 'key181-a-recipe', 1, '{}');

insert into public.food_log_entries (id, user_id, local_date, logged_at, item_type, food_id, quantity, unit, portion_id, resolved_grams, snapshot, nutrients) values
  ('18100000-0000-4000-8000-0000000003a1', '18100000-0000-4000-8000-00000000000a', '2026-10-15', '2026-10-15 08:05:00+00', 'food', '18100000-0000-4000-8000-000000000101', 1, 'portion', '18100000-0000-4000-8000-000000000201', 40, '{"kind":"food","name":"key181-oats"}', '{"kcal":150,"protein_g":5,"fat_g":3,"carbs_g":25,"fibre_g":4}'),
  ('18100000-0000-4000-8000-0000000003b1', '18100000-0000-4000-8000-00000000000b', '2026-10-15', '2026-10-15 09:00:00+00', 'quick', null, null, null, null, null, '{"kind":"quick","label":"key181-b-quick"}', '{"kcal":300,"protein_g":null,"fat_g":null,"carbs_g":null,"fibre_g":null}');

-- Shape: no meal slot anywhere, the item type enum, and the time columns.
select hasnt_column('public', 'food_log_entries', 'meal_slot', 'food_log_entries has no meal_slot column');
select hasnt_type('public', 'meal_slot', 'there is no meal_slot type');
select enum_has_labels('public', 'log_item_type', array['food', 'recipe', 'quick'], 'log_item_type is food, recipe and quick');
select col_type_is('public', 'food_log_entries', 'logged_at', 'timestamp with time zone', 'logged_at is a timestamptz');
select col_not_null('public', 'food_log_entries', 'logged_at', 'logged_at is not null');
select col_type_is('public', 'food_log_entries', 'local_date', 'date', 'local_date is a date');
select col_not_null('public', 'food_log_entries', 'local_date', 'local_date is not null');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.food_log_entries'::regclass),
  'row level security is enabled on food_log_entries'
);

-- Indexes.
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'food_log_entries' and indexdef like '%(user_id, local_date, logged_at)'),
  'there is an index on (user_id, local_date, logged_at)'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'food_log_entries' and indexdef like '%(user_id, logged_at DESC)'),
  'there is an index on (user_id, logged_at desc)'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'food_log_entries' and indexdef like '%(user_id, food_id)'),
  'there is an index on (user_id, food_id)'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'food_log_entries' and indexdef like '%(portion_id)' and indexdef not like 'CREATE UNIQUE%'),
  'there is a plain index on portion_id'
);
select ok(
  not exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'food_log_entries' and indexdef like '%(user_id, local_date)'),
  'the plain (user_id, local_date) index is not there, the time index replaces it'
);

-- Generated kcal.
select is(
  (select kcal from public.food_log_entries where id = '18100000-0000-4000-8000-0000000003a1'),
  150::numeric,
  'kcal is generated from nutrients kcal'
);
select is(
  (select kcal from public.food_log_entries where id = '18100000-0000-4000-8000-0000000003b1'),
  300::numeric,
  'kcal is generated for a quick entry too'
);
select throws_ok(
  $$update public.food_log_entries set kcal = 1 where id = '18100000-0000-4000-8000-0000000003a1'$$,
  '428C9',
  'column "kcal" can only be updated to DEFAULT',
  'kcal cannot be set by hand'
);
select is(
  (select kcal from public.food_log_entries where id = '18100000-0000-4000-8000-0000000003a1'),
  150::numeric,
  'kcal is unchanged after the rejected write'
);
update public.food_log_entries
  set nutrients = '{"kcal":null,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}'
  where id = '18100000-0000-4000-8000-0000000003a1';
select is(
  (select kcal from public.food_log_entries where id = '18100000-0000-4000-8000-0000000003a1'),
  null,
  'a null kcal in nutrients gives a null generated kcal'
);
update public.food_log_entries
  set nutrients = '{"kcal":150,"protein_g":5,"fat_g":3,"carbs_g":25,"fibre_g":4}'
  where id = '18100000-0000-4000-8000-0000000003a1';

-- CHECK: nutrients is an object holding the five required keys.
select throws_ok(
  $$insert into public.food_log_entries (user_id, local_date, item_type, snapshot, nutrients) values ('18100000-0000-4000-8000-00000000000a', '2026-10-15', 'quick', '{}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1}')$$,
  '23514',
  'new row for relation "food_log_entries" violates check constraint "food_log_entries_nutrients_required_keys"',
  'nutrients without fibre_g is rejected'
);
select throws_ok(
  $$insert into public.food_log_entries (user_id, local_date, item_type, snapshot, nutrients) values ('18100000-0000-4000-8000-00000000000a', '2026-10-15', 'quick', '{}', '{"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}')$$,
  '23514',
  'new row for relation "food_log_entries" violates check constraint "food_log_entries_nutrients_required_keys"',
  'nutrients without kcal is rejected'
);
select throws_ok(
  $$insert into public.food_log_entries (user_id, local_date, item_type, snapshot, nutrients) values ('18100000-0000-4000-8000-00000000000a', '2026-10-15', 'quick', '{}', '["kcal","protein_g","fat_g","carbs_g","fibre_g"]')$$,
  '23514',
  'new row for relation "food_log_entries" violates check constraint "food_log_entries_nutrients_required_keys"',
  'a nutrients array that names the keys is not an object and is rejected'
);
select throws_ok(
  $$insert into public.food_log_entries (user_id, local_date, item_type, snapshot, nutrients) values ('18100000-0000-4000-8000-00000000000a', '2026-10-15', 'quick', '{}', '{}')$$,
  '23514',
  'new row for relation "food_log_entries" violates check constraint "food_log_entries_nutrients_required_keys"',
  'empty nutrients are rejected'
);
select throws_ok(
  $$insert into public.food_log_entries (user_id, local_date, item_type, snapshot, nutrients) values ('18100000-0000-4000-8000-00000000000a', '2026-10-15', 'quick', '{}', '{"kcal":"250","protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}')$$,
  '23514',
  'new row for relation "food_log_entries" violates check constraint "food_log_entries_nutrients_required_keys"',
  'a string kcal is rejected'
);
select throws_ok(
  $$insert into public.food_log_entries (user_id, local_date, item_type, snapshot, nutrients) values ('18100000-0000-4000-8000-00000000000a', '2026-10-15', 'quick', '{}', '{"kcal":1,"protein_g":1,"fat_g":true,"carbs_g":1,"fibre_g":1}')$$,
  '23514',
  'new row for relation "food_log_entries" violates check constraint "food_log_entries_nutrients_required_keys"',
  'a boolean in a macro key is rejected'
);
select lives_ok(
  $$insert into public.food_log_entries (user_id, local_date, item_type, snapshot, nutrients) values ('18100000-0000-4000-8000-00000000000a', '2026-10-15', 'quick', '{}', '{"kcal":1,"protein_g":null,"fat_g":null,"carbs_g":null,"fibre_g":null,"salt_g":0.1}')$$,
  'null values and an optional key are accepted when the five keys are present'
);

-- CHECK: item_type and the ids agree.
select throws_ok(
  $$insert into public.food_log_entries (user_id, local_date, item_type, snapshot, nutrients) values ('18100000-0000-4000-8000-00000000000a', '2026-10-15', 'food', '{}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}')$$,
  '23514',
  'new row for relation "food_log_entries" violates check constraint "food_log_entries_item_type_ids"',
  'a food entry without food_id is rejected'
);
select throws_ok(
  $$insert into public.food_log_entries (user_id, local_date, item_type, food_id, recipe_id, snapshot, nutrients) values ('18100000-0000-4000-8000-00000000000a', '2026-10-15', 'food', '18100000-0000-4000-8000-000000000101', '18100000-0000-4000-8000-0000000000f1', '{}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}')$$,
  '23514',
  'new row for relation "food_log_entries" violates check constraint "food_log_entries_item_type_ids"',
  'a food entry with a recipe_id is rejected'
);
select throws_ok(
  $$insert into public.food_log_entries (user_id, local_date, item_type, food_id, snapshot, nutrients) values ('18100000-0000-4000-8000-00000000000a', '2026-10-15', 'quick', '18100000-0000-4000-8000-000000000101', '{}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}')$$,
  '23514',
  'new row for relation "food_log_entries" violates check constraint "food_log_entries_item_type_ids"',
  'a quick entry with a food_id is rejected'
);
select throws_ok(
  $$insert into public.food_log_entries (user_id, local_date, item_type, recipe_id, snapshot, nutrients) values ('18100000-0000-4000-8000-00000000000a', '2026-10-15', 'quick', '18100000-0000-4000-8000-0000000000f1', '{}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}')$$,
  '23514',
  'new row for relation "food_log_entries" violates check constraint "food_log_entries_item_type_ids"',
  'a quick entry with a recipe_id is rejected'
);
select throws_ok(
  $$insert into public.food_log_entries (user_id, local_date, item_type, snapshot, nutrients) values ('18100000-0000-4000-8000-00000000000a', '2026-10-15', 'recipe', '{}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}')$$,
  '23514',
  'new row for relation "food_log_entries" violates check constraint "food_log_entries_item_type_ids"',
  'a recipe entry without recipe_id is rejected'
);
select lives_ok(
  $$insert into public.food_log_entries (user_id, local_date, item_type, recipe_id, snapshot, nutrients) values ('18100000-0000-4000-8000-00000000000a', '2026-10-15', 'recipe', '18100000-0000-4000-8000-0000000000f1', '{}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}')$$,
  'a recipe entry with the recipe_id of an existing recipe is accepted'
);

-- Defaults: logged_at is the transaction time when the client sends none.
insert into public.food_log_entries (id, user_id, local_date, item_type, snapshot, nutrients) values
  ('18100000-0000-4000-8000-0000000003a9', '18100000-0000-4000-8000-00000000000a', '2026-10-15', 'quick', '{"kind":"quick","label":"key181-default-time"}', '{"kcal":1,"protein_g":null,"fat_g":null,"carbs_g":null,"fibre_g":null}');
select is(
  (select logged_at from public.food_log_entries where id = '18100000-0000-4000-8000-0000000003a9'),
  now(),
  'logged_at defaults to now() when the client sends no time'
);

-- on delete set null: deleting the portion clears portion_id and keeps the entry.
delete from public.food_portions where id = '18100000-0000-4000-8000-000000000201';
select is(
  (select count(*)::int from public.food_log_entries where id = '18100000-0000-4000-8000-0000000003a1'),
  1,
  'the entry survives the delete of its portion'
);
select is(
  (select portion_id from public.food_log_entries where id = '18100000-0000-4000-8000-0000000003a1'),
  null,
  'deleting the portion sets portion_id to null'
);

-- A day's entries read back by logged_at, then created_at, and every entry at
-- the same time is kept. A fresh user keeps the fixture rows out of the way.
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '18100000-0000-4000-8000-00000000000c', 'authenticated', 'authenticated', 'key181-user-c@keylow.test');

insert into public.food_log_entries (id, user_id, local_date, logged_at, created_at, item_type, snapshot, nutrients) values
  ('18100000-0000-4000-8000-000000000c01', '18100000-0000-4000-8000-00000000000c', '2026-10-14', '2026-10-14 23:00:00+00', '2026-10-14 23:00:00+00', 'quick', '{"label":"key181-other-day"}', '{"kcal":1,"protein_g":null,"fat_g":null,"carbs_g":null,"fibre_g":null}'),
  ('18100000-0000-4000-8000-000000000c02', '18100000-0000-4000-8000-00000000000c', '2026-10-15', '2026-10-15 12:00:00+00', '2026-10-15 12:05:00+00', 'quick', '{"label":"key181-noon-saved-second"}', '{"kcal":1,"protein_g":null,"fat_g":null,"carbs_g":null,"fibre_g":null}'),
  ('18100000-0000-4000-8000-000000000c03', '18100000-0000-4000-8000-00000000000c', '2026-10-15', '2026-10-15 08:05:00+00', '2026-10-15 12:30:00+00', 'quick', '{"label":"key181-breakfast-saved-last"}', '{"kcal":1,"protein_g":null,"fat_g":null,"carbs_g":null,"fibre_g":null}'),
  ('18100000-0000-4000-8000-000000000c04', '18100000-0000-4000-8000-00000000000c', '2026-10-15', '2026-10-15 12:00:00+00', '2026-10-15 12:01:00+00', 'quick', '{"label":"key181-noon-saved-first"}', '{"kcal":1,"protein_g":null,"fat_g":null,"carbs_g":null,"fibre_g":null}'),
  ('18100000-0000-4000-8000-000000000c05', '18100000-0000-4000-8000-00000000000c', '2026-10-15', '2026-10-15 12:00:00+00', '2026-10-15 12:05:00+00', 'quick', '{"label":"key181-noon-saved-second-twin"}', '{"kcal":1,"protein_g":null,"fat_g":null,"carbs_g":null,"fibre_g":null}');

select results_eq(
  $$select snapshot ->> 'label' from public.food_log_entries
    where user_id = '18100000-0000-4000-8000-00000000000c' and local_date = '2026-10-15'
    order by logged_at, created_at, id$$,
  $$values ('key181-breakfast-saved-last'), ('key181-noon-saved-first'), ('key181-noon-saved-second'), ('key181-noon-saved-second-twin')$$,
  'a day reads back by logged_at, then created_at, then id, and leaves out the other day'
);
select is(
  (select count(*)::int from public.food_log_entries
    where user_id = '18100000-0000-4000-8000-00000000000c' and logged_at = '2026-10-15 12:00:00+00'),
  3,
  'three entries at the same logged_at are all kept'
);

-- Privileges, read from the catalog.
select ok(
  not has_table_privilege('anon', 'public.food_log_entries', 'select')
    and not has_table_privilege('anon', 'public.food_log_entries', 'insert')
    and not has_table_privilege('anon', 'public.food_log_entries', 'update')
    and not has_table_privilege('anon', 'public.food_log_entries', 'delete'),
  'anon has no privilege on food_log_entries'
);
select ok(
  not has_table_privilege('service_role', 'public.food_log_entries', 'select')
    and not has_table_privilege('service_role', 'public.food_log_entries', 'insert')
    and not has_table_privilege('service_role', 'public.food_log_entries', 'update')
    and not has_table_privilege('service_role', 'public.food_log_entries', 'delete')
    and not has_table_privilege('service_role', 'public.food_log_entries', 'truncate')
    and not has_table_privilege('service_role', 'public.food_log_entries', 'references')
    and not has_table_privilege('service_role', 'public.food_log_entries', 'trigger'),
  'service_role has no privilege on food_log_entries'
);
select ok(
  has_table_privilege('authenticated', 'public.food_log_entries', 'select')
    and not has_table_privilege('authenticated', 'public.food_log_entries', 'delete'),
  'authenticated can select and cannot delete, an entry is removed with deleted_at'
);
select ok(
  has_column_privilege('authenticated', 'public.food_log_entries', 'logged_at', 'insert')
    and has_column_privilege('authenticated', 'public.food_log_entries', 'logged_at', 'update')
    and has_column_privilege('authenticated', 'public.food_log_entries', 'local_date', 'insert')
    and has_column_privilege('authenticated', 'public.food_log_entries', 'local_date', 'update'),
  'logged_at and local_date are in both the insert and the update column lists'
);
select ok(
  not has_column_privilege('authenticated', 'public.food_log_entries', 'created_at', 'insert')
    and not has_column_privilege('authenticated', 'public.food_log_entries', 'created_at', 'update')
    and not has_column_privilege('authenticated', 'public.food_log_entries', 'id', 'insert')
    and not has_column_privilege('authenticated', 'public.food_log_entries', 'id', 'update'),
  'created_at and id are in neither column list'
);
select ok(
  not has_column_privilege('authenticated', 'public.food_log_entries', 'user_id', 'update')
    and not has_column_privilege('authenticated', 'public.food_log_entries', 'item_type', 'update')
    and not has_column_privilege('authenticated', 'public.food_log_entries', 'food_id', 'update'),
  'user_id, item_type and food_id are insert-only'
);

-- Select: each user sees only their own entries.
set local role authenticated;
set local request.jwt.claims = '{"sub":"18100000-0000-4000-8000-00000000000a","role":"authenticated"}';

select is(
  (select count(*)::int from public.food_log_entries where id in ('18100000-0000-4000-8000-0000000003a1', '18100000-0000-4000-8000-0000000003b1')),
  1,
  'user A selects one of the two fixture entries'
);
select is(
  (select user_id from public.food_log_entries where id = '18100000-0000-4000-8000-0000000003a1'),
  '18100000-0000-4000-8000-00000000000a'::uuid,
  'the entry user A can select is their own'
);
select is(
  (select count(*)::int from public.food_log_entries where user_id <> '18100000-0000-4000-8000-00000000000a'),
  0,
  'user A cannot select anyone else''s entries'
);

-- Insert as user A: the owner is filled in from the caller, the client's own id
-- is accepted, another user's id is not, and the audit columns are closed.
select lives_ok(
  $$insert into public.food_log_entries (local_date, item_type, snapshot, nutrients) values ('2026-10-15', 'quick', '{"kind":"quick","label":"key181-a-no-user-id"}', '{"kcal":10,"protein_g":null,"fat_g":null,"carbs_g":null,"fibre_g":null}')$$,
  'user A inserts an entry without sending user_id'
);
select is(
  (select user_id from public.food_log_entries where snapshot ->> 'label' = 'key181-a-no-user-id'),
  '18100000-0000-4000-8000-00000000000a'::uuid,
  'user_id defaults to the caller'
);
select lives_ok(
  $$insert into public.food_log_entries (user_id, local_date, logged_at, item_type, snapshot, nutrients) values ('18100000-0000-4000-8000-00000000000a', '2026-10-14', '2026-10-14 18:30:00+00', 'quick', '{"kind":"quick","label":"key181-a-own-user-id"}', '{"kcal":10,"protein_g":null,"fat_g":null,"carbs_g":null,"fibre_g":null}')$$,
  'user A inserts an entry for themselves at a time they choose'
);
select throws_ok(
  $$insert into public.food_log_entries (user_id, local_date, item_type, snapshot, nutrients) values ('18100000-0000-4000-8000-00000000000b', '2026-10-15', 'quick', '{}', '{"kcal":10,"protein_g":null,"fat_g":null,"carbs_g":null,"fibre_g":null}')$$,
  '42501',
  'new row violates row-level security policy for table "food_log_entries"',
  'user A cannot insert an entry for user B'
);
select throws_ok(
  $$insert into public.food_log_entries (created_at, local_date, item_type, snapshot, nutrients) values ('2020-01-01', '2026-10-15', 'quick', '{}', '{"kcal":10,"protein_g":null,"fat_g":null,"carbs_g":null,"fibre_g":null}')$$,
  '42501',
  'permission denied for table food_log_entries',
  'user A cannot set created_at on insert'
);
select throws_ok(
  $$insert into public.food_log_entries (local_date, item_type, snapshot, nutrients, deleted_at) values ('2026-10-15', 'quick', '{}', '{"kcal":10,"protein_g":null,"fat_g":null,"carbs_g":null,"fibre_g":null}', now())$$,
  '42501',
  'permission denied for table food_log_entries',
  'user A cannot insert an already deleted entry'
);

-- Update as user A: own entries only, time and soft delete allowed, the rest closed.
select lives_ok(
  $$update public.food_log_entries set logged_at = '2026-10-16 00:10:00+00', local_date = '2026-10-16' where snapshot ->> 'label' = 'key181-a-no-user-id'$$,
  'user A changes the time and the day of their own entry'
);
select is(
  (select local_date from public.food_log_entries where snapshot ->> 'label' = 'key181-a-no-user-id'),
  '2026-10-16'::date,
  'the entry moved to the other day'
);
select lives_ok(
  $$update public.food_log_entries set deleted_at = now() where snapshot ->> 'label' = 'key181-a-no-user-id'$$,
  'user A soft deletes their own entry'
);
select is(
  (select count(*)::int from public.food_log_entries where snapshot ->> 'label' = 'key181-a-no-user-id' and deleted_at is not null),
  1,
  'a soft deleted entry stays selectable, the clients filter on deleted_at'
);
select lives_ok(
  $$update public.food_log_entries set portion_id = '18100000-0000-4000-8000-000000000202' where snapshot ->> 'label' = 'key181-a-no-user-id'$$,
  'user A points their entry at a global portion'
);
select lives_ok(
  $$update public.food_log_entries set portion_id = '18100000-0000-4000-8000-0000000002a1' where snapshot ->> 'label' = 'key181-a-no-user-id'$$,
  'user A points their entry at their own portion'
);
select throws_ok(
  $$update public.food_log_entries set portion_id = '18100000-0000-4000-8000-0000000002b1' where snapshot ->> 'label' = 'key181-a-no-user-id'$$,
  '42501',
  'new row violates row-level security policy for table "food_log_entries"',
  'user A cannot point their entry at user B''s private portion'
);
select throws_ok(
  $$update public.food_log_entries set portion_id = '18100000-0000-4000-8000-000000000fff' where snapshot ->> 'label' = 'key181-a-no-user-id'$$,
  '42501',
  'new row violates row-level security policy for table "food_log_entries"',
  'user A cannot point their entry at a portion that does not exist'
);
select lives_ok(
  $$update public.food_log_entries set portion_id = null where snapshot ->> 'label' = 'key181-a-no-user-id'$$,
  'user A clears the portion of their entry'
);
select lives_ok(
  $$update public.food_log_entries set logged_at = '2026-10-15 23:59:00+00' where id = '18100000-0000-4000-8000-0000000003b1'$$,
  'user A updating user B''s entry is filtered, not an error'
);
select throws_ok(
  $$update public.food_log_entries set user_id = '18100000-0000-4000-8000-00000000000b' where id = '18100000-0000-4000-8000-0000000003a1'$$,
  '42501',
  'permission denied for table food_log_entries',
  'user A cannot hand their entry to user B'
);
select throws_ok(
  $$update public.food_log_entries set created_at = '2020-01-01' where id = '18100000-0000-4000-8000-0000000003a1'$$,
  '42501',
  'permission denied for table food_log_entries',
  'user A cannot change created_at'
);
select throws_ok(
  $$update public.food_log_entries set item_type = 'quick' where id = '18100000-0000-4000-8000-0000000003a1'$$,
  '42501',
  'permission denied for table food_log_entries',
  'user A cannot change item_type'
);
select throws_ok(
  $$delete from public.food_log_entries where id = '18100000-0000-4000-8000-0000000003a1'$$,
  '42501',
  'permission denied for table food_log_entries',
  'user A cannot delete an entry'
);

reset role;

select is(
  (select logged_at from public.food_log_entries where id = '18100000-0000-4000-8000-0000000003b1'),
  '2026-10-15 09:00:00+00'::timestamptz,
  'user B''s entry was not changed by user A'
);

-- User B.
set local role authenticated;
set local request.jwt.claims = '{"sub":"18100000-0000-4000-8000-00000000000b","role":"authenticated"}';

select is(
  (select count(*)::int from public.food_log_entries),
  1,
  'user B selects exactly one entry'
);
select is(
  (select user_id from public.food_log_entries),
  '18100000-0000-4000-8000-00000000000b'::uuid,
  'the entry user B can select is their own'
);
select is(
  (select count(*)::int from public.food_log_entries where user_id = '18100000-0000-4000-8000-00000000000a'),
  0,
  'user B cannot select user A''s entries'
);

-- Insert as user B: the food and the portion must be visible to the caller, so
-- another user's private row and an id that does not exist fail the same way.
select throws_ok(
  $$insert into public.food_log_entries (local_date, item_type, food_id, snapshot, nutrients) values ('2026-10-15', 'food', '18100000-0000-4000-8000-0000000001a1', '{}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}')$$,
  '42501',
  'new row violates row-level security policy for table "food_log_entries"',
  'user B cannot log user A''s private food'
);
select throws_ok(
  $$insert into public.food_log_entries (local_date, item_type, food_id, snapshot, nutrients) values ('2026-10-15', 'food', '18100000-0000-4000-8000-000000000fff', '{}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}')$$,
  '42501',
  'new row violates row-level security policy for table "food_log_entries"',
  'user B cannot log a food that does not exist, the same failure as a private one'
);
select lives_ok(
  $$insert into public.food_log_entries (local_date, item_type, food_id, snapshot, nutrients) values ('2026-10-15', 'food', '18100000-0000-4000-8000-000000000101', '{}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}')$$,
  'user B logs a global food'
);
select lives_ok(
  $$insert into public.food_log_entries (local_date, item_type, food_id, snapshot, nutrients) values ('2026-10-15', 'food', '18100000-0000-4000-8000-0000000001b1', '{}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}')$$,
  'user B logs their own private food'
);
select throws_ok(
  $$insert into public.food_log_entries (local_date, item_type, food_id, unit, portion_id, snapshot, nutrients) values ('2026-10-15', 'food', '18100000-0000-4000-8000-000000000101', 'portion', '18100000-0000-4000-8000-0000000002a1', '{}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}')$$,
  '42501',
  'new row violates row-level security policy for table "food_log_entries"',
  'user B cannot log with user A''s private portion'
);
select throws_ok(
  $$insert into public.food_log_entries (local_date, item_type, food_id, unit, portion_id, snapshot, nutrients) values ('2026-10-15', 'food', '18100000-0000-4000-8000-000000000101', 'portion', '18100000-0000-4000-8000-000000000fff', '{}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}')$$,
  '42501',
  'new row violates row-level security policy for table "food_log_entries"',
  'user B cannot log with a portion that does not exist'
);
select lives_ok(
  $$insert into public.food_log_entries (local_date, item_type, food_id, unit, portion_id, snapshot, nutrients) values ('2026-10-15', 'food', '18100000-0000-4000-8000-000000000101', 'portion', '18100000-0000-4000-8000-000000000202', '{}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}')$$,
  'user B logs with a global portion'
);
select lives_ok(
  $$insert into public.food_log_entries (local_date, item_type, food_id, unit, portion_id, snapshot, nutrients) values ('2026-10-15', 'food', '18100000-0000-4000-8000-0000000001b1', 'portion', '18100000-0000-4000-8000-0000000002b1', '{}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}')$$,
  'user B logs with their own portion'
);

reset role;

-- Anon.
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  'select * from public.food_log_entries',
  '42501',
  'permission denied for table food_log_entries',
  'anon cannot select from food_log_entries'
);
select throws_ok(
  $$insert into public.food_log_entries (user_id, local_date, item_type, snapshot, nutrients) values ('18100000-0000-4000-8000-00000000000a', '2026-10-15', 'quick', '{}', '{"kcal":10,"protein_g":null,"fat_g":null,"carbs_g":null,"fibre_g":null}')$$,
  '42501',
  'permission denied for table food_log_entries',
  'anon cannot insert into food_log_entries'
);

reset role;

-- Policies: one per statement the owner may run, and none for delete.
select policies_are(
  'public',
  'food_log_entries',
  array['food_log_entries_select_own', 'food_log_entries_insert_own', 'food_log_entries_update_own'],
  'food_log_entries has exactly the select, insert and update owner policies'
);
select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'food_log_entries' and roles = '{authenticated}'),
  3,
  'every food_log_entries policy is for authenticated only'
);

select * from finish();

rollback;
