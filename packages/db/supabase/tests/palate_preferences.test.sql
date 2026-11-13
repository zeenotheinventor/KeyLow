-- Asserts public.palate_preferences and public.palate_food_stats (ADR 0003, Amendment 22): the table,
-- its checks, the unique index that really collides, the exact privileges, owner-only row level
-- security with the food and recipe visibility check on insert, the cascades, and the view's figures
-- on a known fixture (counts, days, first and last day, median grams, the three hour bands in the
-- owner's timezone, the 90 day window, soft deleted and quick entries, and two-user isolation).
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so nothing
-- created here persists. Every fixture id starts with 10230000 and every name and email with
-- key1023-. Each actor is entered with `set local role` plus the JWT claims that `auth.uid()` reads,
-- and left with `reset role`.
--
-- Health data: every fixture is made up and no assertion name quotes a value.

begin;

select plan(78);

-- Three users. The on_auth_user_created trigger creates their profiles rows. C is the throwaway user
-- whose account is deleted at the end.
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '10230000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'key1023-user-a@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '10230000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'key1023-user-b@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '10230000-0000-4000-8000-00000000000c', 'authenticated', 'authenticated', 'key1023-user-c@keylow.test');

-- A has a timezone with no daylight saving shift and a half hour offset, so a fixture time means the
-- same wall clock all year. B keeps the default of UTC.
update public.profiles set timezone = 'Asia/Kolkata' where id = '10230000-0000-4000-8000-00000000000a';

-- Fixtures, inserted as postgres so row level security does not apply: a global food, a private food
-- for each of A, B and C, a second global food for the timezone case and an unused one for the food
-- cascade, and a recipe for each of A and B.
insert into public.foods (id, source, source_ref, owner_id, name, basis) values
  ('10230000-0000-4000-8000-000000000101', 'cofid', 'KEY1023-FOOD-1', null, 'key1023-global-one', 'per_100g'),
  ('10230000-0000-4000-8000-000000000102', 'cofid', 'KEY1023-FOOD-2', null, 'key1023-global-two', 'per_100g'),
  ('10230000-0000-4000-8000-000000000103', 'cofid', 'KEY1023-FOOD-3', null, 'key1023-global-three', 'per_100g'),
  ('10230000-0000-4000-8000-0000000001a1', 'user', null, '10230000-0000-4000-8000-00000000000a', 'key1023-a-private-food', 'per_100g'),
  ('10230000-0000-4000-8000-0000000001a2', 'user', null, '10230000-0000-4000-8000-00000000000a', 'key1023-a-unused-food', 'per_100g'),
  ('10230000-0000-4000-8000-0000000001b1', 'user', null, '10230000-0000-4000-8000-00000000000b', 'key1023-b-private-food', 'per_100g'),
  ('10230000-0000-4000-8000-0000000001c1', 'user', null, '10230000-0000-4000-8000-00000000000c', 'key1023-c-private-food', 'per_100g');

insert into public.recipes (id, owner_id, name, servings, computed) values
  ('10230000-0000-4000-8000-0000000000f1', '10230000-0000-4000-8000-00000000000a', 'key1023-a-recipe', 1, '{}'),
  ('10230000-0000-4000-8000-0000000000f2', '10230000-0000-4000-8000-00000000000a', 'key1023-a-unused-recipe', 1, '{}'),
  ('10230000-0000-4000-8000-0000000000f3', '10230000-0000-4000-8000-00000000000b', 'key1023-b-recipe', 1, '{}');

-- A row of each kind for A and one for B, so the isolation checks have something to hide.
insert into public.palate_preferences (id, owner_id, kind, food_id, recipe_id, label) values
  ('10230000-0000-4000-8000-0000000004a1', '10230000-0000-4000-8000-00000000000a', 'dislike', null, null, 'key1023-a-word'),
  ('10230000-0000-4000-8000-0000000004a2', '10230000-0000-4000-8000-00000000000a', 'not_usual', '10230000-0000-4000-8000-000000000101', null, null),
  ('10230000-0000-4000-8000-0000000004b1', '10230000-0000-4000-8000-00000000000b', 'allergy', null, null, 'key1023-b-word');

-- Shape.
select has_table('public', 'palate_preferences', 'palate_preferences exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.palate_preferences'::regclass),
  'row level security is enabled on palate_preferences'
);
select col_is_pk('public', 'palate_preferences', 'id', 'the primary key is id');
select col_default_is('public', 'palate_preferences', 'owner_id', 'auth.uid()', 'owner_id defaults to the caller');
select col_not_null('public', 'palate_preferences', 'owner_id', 'owner_id is not null');
select col_not_null('public', 'palate_preferences', 'kind', 'kind is not null');
select col_is_null('public', 'palate_preferences', 'food_id', 'food_id is nullable');
select col_is_null('public', 'palate_preferences', 'recipe_id', 'recipe_id is nullable');
select col_is_null('public', 'palate_preferences', 'label', 'label is nullable');
select col_default_is('public', 'palate_preferences', 'created_at', 'now()', 'created_at defaults to now()');

-- Foreign keys: the delete rule of each.
select is(
  (select confdeltype::text from pg_constraint where conrelid = 'public.palate_preferences'::regclass and contype = 'f' and confrelid = 'auth.users'::regclass),
  'c',
  'deleting the owner deletes their rows'
);
select is(
  (select confdeltype::text from pg_constraint where conrelid = 'public.palate_preferences'::regclass and contype = 'f' and confrelid = 'public.foods'::regclass),
  'c',
  'deleting a food deletes the rows about it'
);
select is(
  (select confdeltype::text from pg_constraint where conrelid = 'public.palate_preferences'::regclass and contype = 'f' and confrelid = 'public.recipes'::regclass),
  'c',
  'deleting a recipe deletes the rows about it'
);

-- Indexes.
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'palate_preferences' and indexdef like '%(owner_id, kind)' and indexdef not like 'CREATE UNIQUE%'),
  'there is an index on palate_preferences (owner_id, kind)'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'palate_preferences' and indexdef like '%(food_id)' and indexdef not like 'CREATE UNIQUE%'),
  'there is a plain index on palate_preferences.food_id'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'palate_preferences' and indexdef like '%(recipe_id)' and indexdef not like 'CREATE UNIQUE%'),
  'there is a plain index on palate_preferences.recipe_id'
);
select ok(
  (select i.indnullsnotdistinct and i.indisunique from pg_index i where i.indexrelid = 'public.palate_preferences_unique_idx'::regclass),
  'the unique index treats nulls as equal'
);

-- Privileges. anon and service_role hold nothing at all, on the table or a column.
select ok(
  not has_any_column_privilege('anon', 'public.palate_preferences', 'select,insert,update,references')
    and not has_table_privilege('anon', 'public.palate_preferences', 'delete,truncate,trigger'),
  'anon has no privilege on palate_preferences'
);
select ok(
  not has_any_column_privilege('service_role', 'public.palate_preferences', 'select,insert,update,references')
    and not has_table_privilege('service_role', 'public.palate_preferences', 'delete,truncate,trigger'),
  'service_role has no privilege on palate_preferences'
);
select is(
  (select array_agg(privilege_type::text order by privilege_type::text) from information_schema.table_privileges where table_schema = 'public' and table_name = 'palate_preferences' and grantee = 'authenticated'),
  array['DELETE', 'SELECT'],
  'authenticated holds select and delete on palate_preferences as a table'
);
select is(
  (select array_agg(column_name::text order by column_name::text collate "C") from information_schema.column_privileges where table_schema = 'public' and table_name = 'palate_preferences' and grantee = 'authenticated' and privilege_type = 'INSERT'),
  array['food_id', 'kind', 'label', 'owner_id', 'recipe_id'],
  'authenticated can insert exactly these columns of palate_preferences'
);
select ok(
  not has_any_column_privilege('authenticated', 'public.palate_preferences', 'update'),
  'authenticated can update no column of palate_preferences'
);

-- Policies, as predicates.
select is(
  (select array_agg(policyname || ':' || cmd || ':' || roles::text order by policyname) from pg_policies where schemaname = 'public' and tablename = 'palate_preferences'),
  array['palate_preferences_delete_own:DELETE:{authenticated}', 'palate_preferences_insert_own:INSERT:{authenticated}', 'palate_preferences_select_own:SELECT:{authenticated}'],
  'palate_preferences has exactly an owner-only select, insert and delete policy'
);
select ok(
  (select qual like '%SELECT auth.uid() AS uid%' from pg_policies where tablename = 'palate_preferences' and policyname = 'palate_preferences_select_own')
    and (select with_check like '%SELECT auth.uid() AS uid%' from pg_policies where tablename = 'palate_preferences' and policyname = 'palate_preferences_insert_own')
    and (select qual like '%SELECT auth.uid() AS uid%' from pg_policies where tablename = 'palate_preferences' and policyname = 'palate_preferences_delete_own'),
  'the palate policies evaluate auth.uid() once per statement'
);
select ok(
  (select with_check like '%foods%' and with_check like '%recipes%' from pg_policies where tablename = 'palate_preferences' and policyname = 'palate_preferences_insert_own'),
  'the insert policy checks the food and the recipe'
);

-- As user A: own inserts work and the database gives the row its owner.
set local role authenticated;
set local request.jwt.claims = '{"sub":"10230000-0000-4000-8000-00000000000a","role":"authenticated"}';

select lives_ok(
  $$insert into public.palate_preferences (kind, label) values ('allergy', 'key1023-a-nuts')$$,
  'a user adds an allergy with a label'
);
select is(
  (select count(*)::int from public.palate_preferences where label = 'key1023-a-nuts' and owner_id = '10230000-0000-4000-8000-00000000000a'),
  1,
  'owner_id was defaulted to the caller'
);
select lives_ok(
  $$insert into public.palate_preferences (kind, recipe_id) values ('not_usual', '10230000-0000-4000-8000-0000000000f1')$$,
  'a user marks their own recipe as not usual'
);
select lives_ok(
  $$insert into public.palate_preferences (kind, food_id) values ('not_usual', '10230000-0000-4000-8000-0000000001a1')$$,
  'a user marks their own private food as not usual'
);
select lives_ok(
  $$insert into public.palate_preferences (kind, label) values ('not_usual', 'key1023-a-label-item')$$,
  'a user marks a label item as not usual'
);

-- Refusals on insert.
select throws_ok(
  $$insert into public.palate_preferences (id, kind, label) values ('10230000-0000-4000-8000-000000000001', 'dislike', 'key1023-a-id')$$,
  '42501',
  'permission denied for table palate_preferences',
  'a user cannot set id'
);
select throws_ok(
  $$insert into public.palate_preferences (created_at, kind, label) values (now() - interval '2 days', 'dislike', 'key1023-a-time')$$,
  '42501',
  'permission denied for table palate_preferences',
  'a user cannot set created_at'
);
select throws_ok(
  $$insert into public.palate_preferences (owner_id, kind, label) values ('10230000-0000-4000-8000-00000000000b', 'dislike', 'key1023-a-for-b')$$,
  '42501',
  'new row violates row-level security policy for table "palate_preferences"',
  'a user cannot add a row for another user'
);
select throws_ok(
  $$insert into public.palate_preferences (kind, food_id) values ('not_usual', '10230000-0000-4000-8000-0000000001b1')$$,
  '42501',
  'new row violates row-level security policy for table "palate_preferences"',
  'a user cannot point a row at another user''s private food'
);
select throws_ok(
  $$insert into public.palate_preferences (kind, recipe_id) values ('not_usual', '10230000-0000-4000-8000-0000000000f3')$$,
  '42501',
  'new row violates row-level security policy for table "palate_preferences"',
  'a user cannot point a row at another user''s recipe'
);

-- Bounds: the kind, the label and the references.
select throws_ok(
  $$insert into public.palate_preferences (kind, label) values ('hate', 'key1023-a-kind')$$,
  '23514',
  'new row for relation "palate_preferences" violates check constraint "palate_preferences_kind_check"',
  'a kind outside the three is refused'
);
select throws_ok(
  $$insert into public.palate_preferences (kind, label) values ('dislike', '   ')$$,
  '23514',
  'new row for relation "palate_preferences" violates check constraint "palate_preferences_label_check"',
  'a blank label is refused'
);
select throws_ok(
  $$insert into public.palate_preferences (kind, label) values ('dislike', repeat('k', 101))$$,
  '23514',
  'new row for relation "palate_preferences" violates check constraint "palate_preferences_label_check"',
  'a label of 101 characters is refused'
);
select lives_ok(
  $$insert into public.palate_preferences (kind, label) values ('dislike', repeat('k', 100))$$,
  'a label of 100 characters is accepted'
);
select throws_ok(
  $$insert into public.palate_preferences (kind) values ('dislike')$$,
  '23514',
  'new row for relation "palate_preferences" violates check constraint "palate_preferences_references_check"',
  'a dislike with no label is refused'
);
select throws_ok(
  $$insert into public.palate_preferences (kind) values ('allergy')$$,
  '23514',
  'new row for relation "palate_preferences" violates check constraint "palate_preferences_references_check"',
  'an allergy with no label is refused'
);
select throws_ok(
  $$insert into public.palate_preferences (kind) values ('not_usual')$$,
  '23514',
  'new row for relation "palate_preferences" violates check constraint "palate_preferences_references_check"',
  'a not_usual row with no reference is refused'
);
select throws_ok(
  $$insert into public.palate_preferences (kind, food_id, label) values ('not_usual', '10230000-0000-4000-8000-000000000101', 'key1023-a-two')$$,
  '23514',
  'new row for relation "palate_preferences" violates check constraint "palate_preferences_references_check"',
  'a not_usual row with a food and a label is refused'
);
select throws_ok(
  $$insert into public.palate_preferences (kind, food_id, recipe_id) values ('not_usual', '10230000-0000-4000-8000-000000000101', '10230000-0000-4000-8000-0000000000f1')$$,
  '23514',
  'new row for relation "palate_preferences" violates check constraint "palate_preferences_references_check"',
  'a not_usual row with a food and a recipe is refused'
);

-- The unique index really collides: a null label and a null reference count as values, and the label
-- is compared without regard to case.
select throws_ok(
  $$insert into public.palate_preferences (kind, food_id) values ('not_usual', '10230000-0000-4000-8000-000000000101')$$,
  '23505',
  'duplicate key value violates unique constraint "palate_preferences_unique_idx"',
  'the same food correction cannot be stored twice'
);
select throws_ok(
  $$insert into public.palate_preferences (kind, recipe_id) values ('not_usual', '10230000-0000-4000-8000-0000000000f1')$$,
  '23505',
  'duplicate key value violates unique constraint "palate_preferences_unique_idx"',
  'the same recipe correction cannot be stored twice'
);
select throws_ok(
  $$insert into public.palate_preferences (kind, label) values ('allergy', 'KEY1023-A-NUTS')$$,
  '23505',
  'duplicate key value violates unique constraint "palate_preferences_unique_idx"',
  'the same label cannot be stored twice, whatever its case'
);
select lives_ok(
  $$insert into public.palate_preferences (kind, label) values ('dislike', 'key1023-a-nuts')$$,
  'the same label under another kind is a different row'
);

-- Reads see own rows only, and an update is refused.
select is(
  (select count(*)::int from public.palate_preferences where label = 'key1023-b-word'),
  0,
  'A cannot read B''s rows'
);
select throws_ok(
  $$update public.palate_preferences set label = 'key1023-a-changed' where label = 'key1023-a-word'$$,
  '42501',
  'permission denied for table palate_preferences',
  'a user cannot update a row'
);
select lives_ok(
  $$delete from public.palate_preferences where id = '10230000-0000-4000-8000-0000000004b1'$$,
  'deleting another user''s row is not an error'
);
select lives_ok(
  $$delete from public.palate_preferences where id = '10230000-0000-4000-8000-0000000004a1'$$,
  'a user deletes their own row'
);

reset role;
select is(
  (select count(*)::int from public.palate_preferences where id = '10230000-0000-4000-8000-0000000004b1'),
  1,
  'B''s row survived A''s delete'
);
select is(
  (select count(*)::int from public.palate_preferences where id = '10230000-0000-4000-8000-0000000004a1'),
  0,
  'A''s own row is gone'
);

-- As user B: sees only B's row.
set local role authenticated;
set local request.jwt.claims = '{"sub":"10230000-0000-4000-8000-00000000000b","role":"authenticated"}';
select is(
  (select array_agg(label) from public.palate_preferences),
  array['key1023-b-word'],
  'B reads exactly B''s row'
);
reset role;

-- The cascades, as postgres: a food, a recipe and then an account.
select lives_ok(
  $$delete from public.foods where id = '10230000-0000-4000-8000-0000000001a1'$$,
  'a food that a row names can be deleted'
);
select is(
  (select count(*)::int from public.palate_preferences where food_id = '10230000-0000-4000-8000-0000000001a1'),
  0,
  'deleting a food deletes the rows about it, and none is left half made'
);
insert into public.palate_preferences (owner_id, kind, food_id) values
  ('10230000-0000-4000-8000-00000000000a', 'not_usual', '10230000-0000-4000-8000-0000000001a2');
insert into public.palate_preferences (owner_id, kind, recipe_id) values
  ('10230000-0000-4000-8000-00000000000a', 'not_usual', '10230000-0000-4000-8000-0000000000f2');
delete from public.foods where id = '10230000-0000-4000-8000-0000000001a2';
delete from public.recipes where id = '10230000-0000-4000-8000-0000000000f2';
select is(
  (select count(*)::int from public.palate_preferences where food_id = '10230000-0000-4000-8000-0000000001a2' or recipe_id = '10230000-0000-4000-8000-0000000000f2'),
  0,
  'deleting a food and a recipe deletes the rows about them'
);
insert into public.palate_preferences (owner_id, kind, label) values
  ('10230000-0000-4000-8000-00000000000c', 'dislike', 'key1023-c-word');
delete from auth.users where id = '10230000-0000-4000-8000-00000000000c';
select is(
  (select count(*)::int from public.palate_preferences where owner_id = '10230000-0000-4000-8000-00000000000c'),
  0,
  'deleting an account deletes its rows'
);

-- The view. Privileges and options first.
select ok(
  (select 'security_invoker=true' = any (reloptions) from pg_class where oid = 'public.palate_food_stats'::regclass),
  'palate_food_stats is a security invoker view'
);
select ok(
  not has_table_privilege('anon', 'public.palate_food_stats', 'select')
    and not has_table_privilege('service_role', 'public.palate_food_stats', 'select')
    and has_table_privilege('authenticated', 'public.palate_food_stats', 'select')
    and not has_table_privilege('authenticated', 'public.palate_food_stats', 'insert,update,delete'),
  'only authenticated can read palate_food_stats, and only read'
);

-- A known fixture for A, whose timezone is Asia/Kolkata, relative to A's own local today (`t`).
-- Food one: five entries inside the window, two outside it and one soft deleted.
--   t     08:00 100 g (before eleven)      t     12:30 200 g (eleven to sixteen)
--   t-1   16:00 300 g (sixteen or later)   t-1   10:59 400 g (before eleven)
--   t-89  15:59 500 g (eleven to sixteen, the oldest day inside the window)
--   t-90  09:00 900 g (outside the window) t-2   09:00 900 g (soft deleted)
-- Food two: one entry at 04:00 local, which is 22:30 UTC the day before, so a timezone shows.
-- Recipe: two entries at 23:30 local, one of them with no resolved grams.
-- A quick entry names nothing, so it has no row.
create function pg_temp.at_local(day_offset integer, wall_clock time)
returns timestamptz language sql as $$
  select ((now() at time zone 'Asia/Kolkata')::date + day_offset + wall_clock) at time zone 'Asia/Kolkata'
$$;

insert into public.food_log_entries (user_id, local_date, logged_at, item_type, food_id, recipe_id, quantity, unit, resolved_grams, snapshot, nutrients, deleted_at) values
  ('10230000-0000-4000-8000-00000000000a', (now() at time zone 'Asia/Kolkata')::date, pg_temp.at_local(0, '08:00'), 'food', '10230000-0000-4000-8000-000000000101', null, 1, 'g', 100, '{}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}', null),
  ('10230000-0000-4000-8000-00000000000a', (now() at time zone 'Asia/Kolkata')::date, pg_temp.at_local(0, '12:30'), 'food', '10230000-0000-4000-8000-000000000101', null, 1, 'g', 200, '{}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}', null),
  ('10230000-0000-4000-8000-00000000000a', (now() at time zone 'Asia/Kolkata')::date - 1, pg_temp.at_local(-1, '16:00'), 'food', '10230000-0000-4000-8000-000000000101', null, 1, 'g', 300, '{}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}', null),
  ('10230000-0000-4000-8000-00000000000a', (now() at time zone 'Asia/Kolkata')::date - 1, pg_temp.at_local(-1, '10:59'), 'food', '10230000-0000-4000-8000-000000000101', null, 1, 'g', 400, '{}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}', null),
  ('10230000-0000-4000-8000-00000000000a', (now() at time zone 'Asia/Kolkata')::date - 89, pg_temp.at_local(-89, '15:59'), 'food', '10230000-0000-4000-8000-000000000101', null, 1, 'g', 500, '{}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}', null),
  ('10230000-0000-4000-8000-00000000000a', (now() at time zone 'Asia/Kolkata')::date - 90, pg_temp.at_local(-90, '09:00'), 'food', '10230000-0000-4000-8000-000000000101', null, 1, 'g', 900, '{}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}', null),
  ('10230000-0000-4000-8000-00000000000a', (now() at time zone 'Asia/Kolkata')::date - 2, pg_temp.at_local(-2, '09:00'), 'food', '10230000-0000-4000-8000-000000000101', null, 1, 'g', 900, '{}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}', now()),
  ('10230000-0000-4000-8000-00000000000a', (now() at time zone 'Asia/Kolkata')::date, pg_temp.at_local(0, '04:00'), 'food', '10230000-0000-4000-8000-000000000102', null, 1, 'g', 50, '{}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}', null),
  ('10230000-0000-4000-8000-00000000000a', (now() at time zone 'Asia/Kolkata')::date, pg_temp.at_local(0, '23:30'), 'recipe', null, '10230000-0000-4000-8000-0000000000f1', 1, 'serving', 250, '{}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}', null),
  ('10230000-0000-4000-8000-00000000000a', (now() at time zone 'Asia/Kolkata')::date - 3, pg_temp.at_local(-3, '23:30'), 'recipe', null, '10230000-0000-4000-8000-0000000000f1', 1, 'serving', null, '{}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}', null),
  ('10230000-0000-4000-8000-00000000000a', (now() at time zone 'Asia/Kolkata')::date, pg_temp.at_local(0, '13:00'), 'quick', null, null, null, null, null, '{}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}', null),
  ('10230000-0000-4000-8000-00000000000b', (now() at time zone 'UTC')::date, now(), 'food', '10230000-0000-4000-8000-000000000101', null, 1, 'g', 77, '{}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}', null);

set local role authenticated;
set local request.jwt.claims = '{"sub":"10230000-0000-4000-8000-00000000000a","role":"authenticated"}';

select is(
  (select count(*)::int from public.palate_food_stats),
  3,
  'A has a row for two foods and one recipe, and none for the quick entry'
);
select is(
  (select row(entry_count, distinct_days, median_resolved_grams, before_eleven_count, eleven_to_sixteen_count, sixteen_or_later_count)::text
     from public.palate_food_stats where food_id = '10230000-0000-4000-8000-000000000101'),
  row(5, 3, 300, 2, 2, 1)::text,
  'food one: five entries on three days, median 300 g, two before eleven, two midday and one from sixteen'
);
select is(
  (select first_local_date from public.palate_food_stats where food_id = '10230000-0000-4000-8000-000000000101'),
  (now() at time zone 'Asia/Kolkata')::date - 89,
  'food one: the first day is the oldest day inside the window'
);
select is(
  (select last_local_date from public.palate_food_stats where food_id = '10230000-0000-4000-8000-000000000101'),
  (now() at time zone 'Asia/Kolkata')::date,
  'food one: the last day is the local today'
);
select is(
  (select row(entry_count, distinct_days, median_resolved_grams, before_eleven_count, eleven_to_sixteen_count, sixteen_or_later_count)::text
     from public.palate_food_stats where recipe_id = '10230000-0000-4000-8000-0000000000f1'),
  row(2, 2, 250, 0, 0, 2)::text,
  'the recipe: two entries on two days, the median ignores the entry with no grams'
);
select is(
  (select food_id from public.palate_food_stats where recipe_id = '10230000-0000-4000-8000-0000000000f1'),
  null,
  'a recipe row has no food_id'
);
select is(
  (select row(before_eleven_count, eleven_to_sixteen_count, sixteen_or_later_count)::text
     from public.palate_food_stats where food_id = '10230000-0000-4000-8000-000000000102'),
  row(1, 0, 0)::text,
  'an entry at 04:00 in Asia/Kolkata is banded before eleven, though it is 22:30 UTC'
);
select is(
  (select array_agg(distinct owner_id) from public.palate_food_stats),
  array['10230000-0000-4000-8000-00000000000a'::uuid],
  'A reads only A''s figures'
);

-- B reads B's own figures and none of A's.
set local request.jwt.claims = '{"sub":"10230000-0000-4000-8000-00000000000b","role":"authenticated"}';
select is(
  (select row(count(*), min(entry_count), min(median_resolved_grams))::text from public.palate_food_stats),
  row(1, 1, 77)::text,
  'B reads one row of its own, and nothing of A''s entries of the same food'
);
reset role;

-- palate_logged_days, read while A is still in Asia/Kolkata. A's logged days are t, t-1, t-3 and t-89.
-- t-2 holds a soft deleted entry only and t-90 is outside the window. The quick entry on t adds no day.
select ok(
  (select 'security_invoker=true' = any (reloptions) from pg_class where oid = 'public.palate_logged_days'::regclass),
  'palate_logged_days is a security invoker view'
);
select ok(
  not has_table_privilege('anon', 'public.palate_logged_days', 'select')
    and not has_table_privilege('service_role', 'public.palate_logged_days', 'select')
    and has_table_privilege('authenticated', 'public.palate_logged_days', 'select')
    and not has_table_privilege('authenticated', 'public.palate_logged_days', 'insert,update,delete'),
  'only authenticated can read palate_logged_days, and only read'
);
set local role authenticated;
set local request.jwt.claims = '{"sub":"10230000-0000-4000-8000-00000000000a","role":"authenticated"}';
select is(
  (select logged_days from public.palate_logged_days),
  4,
  'A has four logged days in the window, with the soft deleted day and the day outside it left out'
);
select is(
  (select count(*)::int from public.palate_logged_days),
  1,
  'A reads one row, their own'
);
reset role;

-- A day with only a quick entry counts: it names no food, so the stats view has no row for it.
insert into public.food_log_entries (user_id, local_date, logged_at, item_type, quantity, unit, snapshot, nutrients) values
  ('10230000-0000-4000-8000-00000000000a', (now() at time zone 'Asia/Kolkata')::date - 10, pg_temp.at_local(-10, '13:00'), 'quick', null, null, '{}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}');
set local role authenticated;
set local request.jwt.claims = '{"sub":"10230000-0000-4000-8000-00000000000a","role":"authenticated"}';
select is(
  (select logged_days from public.palate_logged_days),
  5,
  'a day with only a quick entry counts as a logged day'
);
set local request.jwt.claims = '{"sub":"10230000-0000-4000-8000-00000000000b","role":"authenticated"}';
select is(
  (select logged_days from public.palate_logged_days),
  1,
  'B reads B''s own count, one day, and none of A''s'
);
reset role;
select is(
  (select count(*)::int from public.palate_logged_days where owner_id = '10230000-0000-4000-8000-00000000000c'),
  0,
  'an owner with nothing logged has no row'
);

-- A person who changes timezone sees their past entries re-banded: the same 04:00 Kolkata entry is
-- 22:30 UTC, which is the evening band in UTC.
update public.profiles set timezone = 'UTC' where id = '10230000-0000-4000-8000-00000000000a';
set local role authenticated;
set local request.jwt.claims = '{"sub":"10230000-0000-4000-8000-00000000000a","role":"authenticated"}';
select is(
  (select row(before_eleven_count, eleven_to_sixteen_count, sixteen_or_later_count)::text
     from public.palate_food_stats where food_id = '10230000-0000-4000-8000-000000000102'),
  row(0, 0, 1)::text,
  'after the timezone changes to UTC the same entry is banded from sixteen'
);
reset role;

select * from finish();
rollback;
