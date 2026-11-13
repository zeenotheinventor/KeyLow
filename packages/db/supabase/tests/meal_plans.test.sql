-- Asserts public.meal_plans, public.meal_plan_days, public.meal_plan_items, the functions
-- save_meal_plan, replace_meal_plan_day and confirm_meal_plan_day, and profiles.meal_plan_repeat_limit
-- (ADR 0003, Amendment 22): the shape, every check, the exact privileges, owner-only row level
-- security with the reference checks on insert, the delete rules, the three functions (all or nothing,
-- a confirmed day refused, the entries a confirmation writes) and the bounds of the repeat limit.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so nothing
-- created here persists. Every fixture id starts with 10270000 and every name and email with
-- key1027-. Each actor is entered with `set local role` plus the JWT claims that `auth.uid()` reads,
-- and left with `reset role`.
--
-- Health data: every fixture is made up and no assertion name quotes a value.

begin;

select plan(116);

-- Three users. The on_auth_user_created trigger creates their profiles rows. C is the throwaway user
-- whose account is deleted at the end.
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '10270000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'key1027-user-a@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '10270000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'key1027-user-b@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '10270000-0000-4000-8000-00000000000c', 'authenticated', 'authenticated', 'key1027-user-c@keylow.test');

-- Foods: a global one, a second global one for the cascade, and a private one each for A and B.
insert into public.foods (id, source, source_ref, owner_id, name, basis) values
  ('10270000-0000-4000-8000-000000000101', 'cofid', 'KEY1027-FOOD-1', null, 'key1027-global-one', 'per_100g'),
  ('10270000-0000-4000-8000-000000000102', 'cofid', 'KEY1027-FOOD-2', null, 'key1027-global-two', 'per_100g'),
  ('10270000-0000-4000-8000-0000000001a1', 'user', null, '10270000-0000-4000-8000-00000000000a', 'key1027-a-private-food', 'per_100g'),
  ('10270000-0000-4000-8000-0000000001b1', 'user', null, '10270000-0000-4000-8000-00000000000b', 'key1027-b-private-food', 'per_100g');

insert into public.food_portions (id, food_id, owner_id, label, grams, ml, is_default, position) values
  ('10270000-0000-4000-8000-000000000501', '10270000-0000-4000-8000-000000000101', null, 'key1027-slice', 30, null, true, 0),
  ('10270000-0000-4000-8000-000000000502', '10270000-0000-4000-8000-000000000102', null, 'key1027-cup', 200, null, true, 0),
  ('10270000-0000-4000-8000-000000000503', '10270000-0000-4000-8000-0000000001a1', '10270000-0000-4000-8000-00000000000a', 'key1027-a-private-bowl', 90, null, true, 0);

insert into public.recipes (id, owner_id, name, servings, computed) values
  ('10270000-0000-4000-8000-0000000000f1', '10270000-0000-4000-8000-00000000000a', 'key1027-a-recipe', 2, '{}'),
  ('10270000-0000-4000-8000-0000000000f2', '10270000-0000-4000-8000-00000000000a', 'key1027-a-second-recipe', 2, '{}'),
  ('10270000-0000-4000-8000-0000000000f3', '10270000-0000-4000-8000-00000000000b', 'key1027-b-recipe', 2, '{}');

-- Rows set up as postgres, so row level security does not apply: a plan for each of A and B, each with
-- a day and an item, and a plan for C.
insert into public.meal_plans (id, owner_id, start_date, day_count, rules, source) values
  ('10270000-0000-4000-8000-000000000a01', '10270000-0000-4000-8000-00000000000a', '2026-12-07', 2, '{"maxRepeats":2}', 'app'),
  ('10270000-0000-4000-8000-000000000b01', '10270000-0000-4000-8000-00000000000b', '2026-12-07', 1, '{"maxRepeats":null}', 'assistant'),
  ('10270000-0000-4000-8000-000000000c01', '10270000-0000-4000-8000-00000000000c', '2026-12-07', 1, '{}', 'app');

insert into public.meal_plan_days (id, plan_id, owner_id, local_date, target) values
  ('10270000-0000-4000-8000-000000000a11', '10270000-0000-4000-8000-000000000a01', '10270000-0000-4000-8000-00000000000a', '2026-12-07', '{"kcal":1800}'),
  ('10270000-0000-4000-8000-000000000a12', '10270000-0000-4000-8000-000000000a01', '10270000-0000-4000-8000-00000000000a', '2026-12-08', '{"kcal":1800}'),
  ('10270000-0000-4000-8000-000000000b11', '10270000-0000-4000-8000-000000000b01', '10270000-0000-4000-8000-00000000000b', '2026-12-07', '{"kcal":2000}'),
  ('10270000-0000-4000-8000-000000000c11', '10270000-0000-4000-8000-000000000c01', '10270000-0000-4000-8000-00000000000c', '2026-12-07', '{"kcal":2000}');

insert into public.meal_plan_items (id, day_id, owner_id, position, item_type, food_id, grams, nutrients, snapshot) values
  ('10270000-0000-4000-8000-000000000a21', '10270000-0000-4000-8000-000000000a11', '10270000-0000-4000-8000-00000000000a', 0, 'food', '10270000-0000-4000-8000-000000000101', 100, '{"kcal":100}', '{"name":"key1027-a"}'),
  ('10270000-0000-4000-8000-000000000b21', '10270000-0000-4000-8000-000000000b11', '10270000-0000-4000-8000-00000000000b', 0, 'food', '10270000-0000-4000-8000-000000000101', 100, '{"kcal":100}', '{"name":"key1027-b"}'),
  ('10270000-0000-4000-8000-000000000c21', '10270000-0000-4000-8000-000000000c11', '10270000-0000-4000-8000-00000000000c', 0, 'food', '10270000-0000-4000-8000-000000000101', 100, '{"kcal":100}', '{"name":"key1027-c"}');

-- Somewhere for the tests that run as authenticated to keep an id between statements.
create temp table key1027_ids (name text primary key, id uuid);
grant all on key1027_ids to authenticated;
create temp table key1027_returned (ids uuid[]);
grant all on key1027_returned to authenticated;

-- Shape.
select has_table('public', 'meal_plans', 'meal_plans exists');
select has_table('public', 'meal_plan_days', 'meal_plan_days exists');
select has_table('public', 'meal_plan_items', 'meal_plan_items exists');
select ok(
  (select bool_and(relrowsecurity) from pg_class where oid in ('public.meal_plans'::regclass, 'public.meal_plan_days'::regclass, 'public.meal_plan_items'::regclass)),
  'row level security is enabled on all three tables'
);
select col_default_is('public', 'meal_plans', 'owner_id', 'auth.uid()', 'a plan''s owner_id defaults to the caller');
select col_default_is('public', 'meal_plan_days', 'owner_id', 'auth.uid()', 'a day''s owner_id defaults to the caller');
select col_default_is('public', 'meal_plan_items', 'owner_id', 'auth.uid()', 'an item''s owner_id defaults to the caller');
select col_type_is('public', 'profiles', 'meal_plan_repeat_limit', 'smallint', 'the repeat limit is a smallint');
select col_is_null('public', 'profiles', 'meal_plan_repeat_limit', 'the repeat limit is nullable');
select is(
  (select count(*)::int from public.profiles where meal_plan_repeat_limit is not null),
  0,
  'no profile has a repeat limit until the person chooses one'
);

-- Checks on a plan.
select throws_ok(
  $$insert into public.meal_plans (owner_id, start_date, day_count, rules, source) values ('10270000-0000-4000-8000-00000000000a', '2026-12-14', 0, '{}', 'app')$$,
  '23514', null, 'a plan of no days is refused'
);
select throws_ok(
  $$insert into public.meal_plans (owner_id, start_date, day_count, rules, source) values ('10270000-0000-4000-8000-00000000000a', '2026-12-14', 8, '{}', 'app')$$,
  '23514', null, 'a plan of eight days is refused'
);
select lives_ok(
  $$insert into public.meal_plans (owner_id, start_date, day_count, rules, source) values ('10270000-0000-4000-8000-00000000000a', '2027-01-04', 7, '{}', 'app')$$,
  'a plan of seven days is accepted'
);
select throws_ok(
  $$insert into public.meal_plans (owner_id, start_date, day_count, rules, source) values ('10270000-0000-4000-8000-00000000000a', '2026-12-14', 1, '[]', 'app')$$,
  '23514', null, 'rules that are not a JSON object are refused'
);
select throws_ok(
  $$insert into public.meal_plans (owner_id, start_date, day_count, rules, source) values ('10270000-0000-4000-8000-00000000000a', '2026-12-14', 1, '{}', 'robot')$$,
  '23514', null, 'a source other than assistant or app is refused'
);

-- Checks on a day.
select throws_ok(
  $$update public.meal_plan_days set confirmed_at = now() where id = '10270000-0000-4000-8000-000000000a12'$$,
  '23514', null, 'a day cannot be confirmed without the ids of its entries'
);
select throws_ok(
  $$update public.meal_plan_days set confirmed_entry_ids = '{}' where id = '10270000-0000-4000-8000-000000000a12'$$,
  '23514', null, 'a day cannot hold entry ids without a confirmation time'
);
select throws_ok(
  $$insert into public.meal_plan_days (plan_id, owner_id, local_date, target) values ('10270000-0000-4000-8000-000000000a01', '10270000-0000-4000-8000-00000000000a', '2026-12-07', '{}')$$,
  '23505', null, 'a plan holds one row per local date'
);

-- The item check, in both directions, and the amounts.
select throws_ok(
  $$insert into public.meal_plan_items (day_id, owner_id, position, item_type, food_id, recipe_id, grams, nutrients, snapshot) values ('10270000-0000-4000-8000-000000000a11', '10270000-0000-4000-8000-00000000000a', 5, 'food', '10270000-0000-4000-8000-000000000101', '10270000-0000-4000-8000-0000000000f1', 100, '{}', '{}')$$,
  '23514', null, 'a food item with a recipe id is refused'
);
select throws_ok(
  $$insert into public.meal_plan_items (day_id, owner_id, position, item_type, food_id, recipe_id, servings, nutrients, snapshot) values ('10270000-0000-4000-8000-000000000a11', '10270000-0000-4000-8000-00000000000a', 5, 'recipe', '10270000-0000-4000-8000-000000000101', '10270000-0000-4000-8000-0000000000f1', 1, '{}', '{}')$$,
  '23514', null, 'a recipe item with a food id is refused'
);
select lives_ok(
  $$insert into public.meal_plan_items (day_id, owner_id, position, item_type, food_id, grams, nutrients, snapshot) values ('10270000-0000-4000-8000-000000000a11', '10270000-0000-4000-8000-00000000000a', 5, 'food', null, 100, '{}', '{}')$$,
  'a food item with no food id is accepted, as it is after its food is removed'
);
select throws_ok(
  $$insert into public.meal_plan_items (day_id, owner_id, position, item_type, recipe_id, servings, nutrients, snapshot) values ('10270000-0000-4000-8000-000000000a11', '10270000-0000-4000-8000-00000000000a', 6, 'recipe', '10270000-0000-4000-8000-0000000000f1', 0, '{}', '{}')$$,
  '23514', null, 'a recipe item with no servings above zero is refused'
);
select throws_ok(
  $$insert into public.meal_plan_items (day_id, owner_id, position, item_type, food_id, nutrients, snapshot) values ('10270000-0000-4000-8000-000000000a11', '10270000-0000-4000-8000-00000000000a', 6, 'food', '10270000-0000-4000-8000-000000000101', '{}', '{}')$$,
  '23514', null, 'a food item with no grams is refused'
);
select throws_ok(
  $$insert into public.meal_plan_items (day_id, owner_id, position, item_type, food_id, grams, nutrients, snapshot) values ('10270000-0000-4000-8000-000000000a11', '10270000-0000-4000-8000-00000000000a', -1, 'food', '10270000-0000-4000-8000-000000000101', 100, '{}', '{}')$$,
  '23514', null, 'a negative position is refused'
);
select throws_ok(
  $$insert into public.meal_plan_items (day_id, owner_id, position, item_type, food_id, grams, nutrients, snapshot) values ('10270000-0000-4000-8000-000000000a11', '10270000-0000-4000-8000-00000000000a', 6, 'quick', '10270000-0000-4000-8000-000000000101', 100, '{}', '{}')$$,
  '23514', null, 'an item type other than food or recipe is refused'
);

select throws_ok(
  $$insert into public.meal_plan_items (day_id, owner_id, position, item_type, food_id, grams, nutrients, snapshot) values ('10270000-0000-4000-8000-000000000a11', '10270000-0000-4000-8000-00000000000a', 0, 'food', '10270000-0000-4000-8000-000000000101', 100, '{}', '{}')$$,
  '23505', null, 'a day holds one item at each position'
);

-- Delete rules.
select is(
  (select string_agg(conrelid::regclass::text || ':' || confrelid::regclass::text || ':' || confdeltype::text, ',' order by conrelid::regclass::text, confrelid::regclass::text)
     from pg_constraint
    where contype = 'f' and conrelid in ('public.meal_plans'::regclass, 'public.meal_plan_days'::regclass, 'public.meal_plan_items'::regclass)),
  'meal_plan_days:auth.users:c,meal_plan_days:meal_plans:c,meal_plan_items:auth.users:c,meal_plan_items:food_portions:n,meal_plan_items:foods:n,meal_plan_items:meal_plan_days:c,meal_plan_items:meal_plan_items:n,meal_plan_items:recipes:n,meal_plans:auth.users:c',
  'the plan, day and item references cascade or set null exactly as the amendment says'
);

insert into public.meal_plan_items (id, day_id, owner_id, position, item_type, food_id, recipe_id, grams, servings, portion_id, nutrients, snapshot, leftover_of) values
  ('10270000-0000-4000-8000-000000000a31', '10270000-0000-4000-8000-000000000a12', '10270000-0000-4000-8000-00000000000a', 0, 'food', '10270000-0000-4000-8000-000000000102', null, 150, null, '10270000-0000-4000-8000-000000000502', '{}', '{"name":"key1027-cascade"}', null),
  ('10270000-0000-4000-8000-000000000a32', '10270000-0000-4000-8000-000000000a12', '10270000-0000-4000-8000-00000000000a', 1, 'recipe', null, '10270000-0000-4000-8000-0000000000f2', null, 1, null, '{}', '{"name":"key1027-cascade"}', null),
  ('10270000-0000-4000-8000-000000000a33', '10270000-0000-4000-8000-000000000a12', '10270000-0000-4000-8000-00000000000a', 2, 'recipe', null, '10270000-0000-4000-8000-0000000000f1', null, 1, null, '{}', '{"name":"key1027-cascade"}', null),
  ('10270000-0000-4000-8000-000000000a34', '10270000-0000-4000-8000-000000000a12', '10270000-0000-4000-8000-00000000000a', 3, 'recipe', null, '10270000-0000-4000-8000-0000000000f1', null, 1, null, '{}', '{"name":"key1027-cascade"}', '10270000-0000-4000-8000-000000000a33');

delete from public.food_portions where id = '10270000-0000-4000-8000-000000000502';
select is(
  (select portion_id from public.meal_plan_items where id = '10270000-0000-4000-8000-000000000a31'),
  null,
  'removing a portion clears it on the item'
);
delete from public.foods where id = '10270000-0000-4000-8000-000000000102';
select is(
  (select row(count(*), count(food_id), min(snapshot ->> 'name'))::text from public.meal_plan_items where id = '10270000-0000-4000-8000-000000000a31'),
  row(1, 0, 'key1027-cascade')::text,
  'removing a food keeps the item with its snapshot and clears the food id'
);
delete from public.recipes where id = '10270000-0000-4000-8000-0000000000f2';
select is(
  (select row(count(*), count(recipe_id))::text from public.meal_plan_items where id = '10270000-0000-4000-8000-000000000a32'),
  row(1, 0)::text,
  'removing a recipe keeps the item and clears the recipe id'
);
delete from public.meal_plan_items where id = '10270000-0000-4000-8000-000000000a33';
select is(
  (select row(count(*), count(leftover_of))::text from public.meal_plan_items where id = '10270000-0000-4000-8000-000000000a34'),
  row(1, 0)::text,
  'removing the item that cooked a meal keeps the leftover and clears the link'
);

-- Privileges.
select is(
  (select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants where table_schema = 'public' and table_name = 'meal_plans' and grantee = 'authenticated'),
  'SELECT',
  'authenticated has only table level select on meal_plans, and no delete'
);
select is(
  (select string_agg(column_name, ',' order by column_name) from information_schema.column_privileges where table_schema = 'public' and table_name = 'meal_plans' and grantee = 'authenticated' and privilege_type = 'INSERT'),
  'day_count,owner_id,rules,source,start_date',
  'authenticated inserts the five plan columns and not id or created_at'
);
select is(
  (select string_agg(column_name, ',' order by column_name) from information_schema.column_privileges where table_schema = 'public' and table_name = 'meal_plans' and grantee = 'authenticated' and privilege_type = 'UPDATE'),
  'archived_at,rules',
  'authenticated updates the rules and the archive time of a plan'
);
select is(
  (select string_agg(column_name, ',' order by column_name) from information_schema.column_privileges where table_schema = 'public' and table_name = 'meal_plan_days' and grantee = 'authenticated' and privilege_type = 'UPDATE'),
  'confirmed_at,confirmed_entry_ids,target',
  'authenticated updates the target and the confirmation of a day'
);
select is(
  (select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants where table_schema = 'public' and table_name = 'meal_plan_days' and grantee = 'authenticated'),
  'SELECT',
  'authenticated has only table level select on meal_plan_days, and no delete'
);
select is(
  (select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants where table_schema = 'public' and table_name = 'meal_plan_items' and grantee = 'authenticated'),
  'DELETE,SELECT',
  'authenticated has table level select and delete on meal_plan_items'
);
select is(
  (select count(*)::int from information_schema.column_privileges where table_schema = 'public' and table_name = 'meal_plan_items' and grantee = 'authenticated' and privilege_type = 'UPDATE'),
  0,
  'authenticated updates no column of meal_plan_items'
);
select is(
  (select string_agg(column_name, ',' order by column_name) from information_schema.column_privileges where table_schema = 'public' and table_name = 'meal_plan_items' and grantee = 'authenticated' and privilege_type = 'INSERT'),
  'day_id,food_id,grams,item_type,leftover_of,nutrients,owner_id,portion_id,position,recipe_id,servings,slot_time,snapshot',
  'authenticated inserts every item column except id and created_at'
);
select is(
  (select count(*)::int from information_schema.role_table_grants where table_schema = 'public' and table_name in ('meal_plans', 'meal_plan_days', 'meal_plan_items') and grantee in ('anon', 'service_role', 'public')),
  0,
  'anon, service_role and public hold nothing on the plan tables'
);
select ok(
  has_column_privilege('authenticated', 'public.profiles', 'meal_plan_repeat_limit', 'update')
    and not has_column_privilege('authenticated', 'public.profiles', 'meal_plan_repeat_limit', 'insert')
    and not has_column_privilege('anon', 'public.profiles', 'meal_plan_repeat_limit', 'update'),
  'the repeat limit is updatable by authenticated, not insertable and not updatable by anon'
);
select is(
  (select string_agg(p.proname || ':' || p.prosecdef::text || ':' || coalesce(p.proconfig::text, ''), ',' order by p.proname)
     from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('save_meal_plan', 'replace_meal_plan_day', 'confirm_meal_plan_day')),
  'confirm_meal_plan_day:false:{"search_path=\"\""},replace_meal_plan_day:false:{"search_path=\"\""},save_meal_plan:false:{"search_path=\"\""}',
  'the three functions are security invoker with an empty search_path'
);
select ok(
  has_function_privilege('authenticated', 'public.save_meal_plan(jsonb, jsonb, jsonb)', 'execute')
    and has_function_privilege('authenticated', 'public.replace_meal_plan_day(uuid, jsonb)', 'execute')
    and has_function_privilege('authenticated', 'public.confirm_meal_plan_day(uuid, jsonb)', 'execute'),
  'authenticated can execute the three functions'
);
select ok(
  not has_function_privilege('anon', 'public.save_meal_plan(jsonb, jsonb, jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.replace_meal_plan_day(uuid, jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.confirm_meal_plan_day(uuid, jsonb)', 'execute')
    and not has_function_privilege('service_role', 'public.save_meal_plan(jsonb, jsonb, jsonb)', 'execute')
    and not has_function_privilege('service_role', 'public.replace_meal_plan_day(uuid, jsonb)', 'execute')
    and not has_function_privilege('service_role', 'public.confirm_meal_plan_day(uuid, jsonb)', 'execute'),
  'anon and service_role cannot execute them'
);

-- The repeat limit: the person chooses, including no limit, and nothing outside 0 to 7.
set local role authenticated;
set local request.jwt.claims = '{"sub":"10270000-0000-4000-8000-00000000000a","role":"authenticated"}';
select lives_ok(
  $$update public.profiles set meal_plan_repeat_limit = 0 where id = '10270000-0000-4000-8000-00000000000a'$$,
  'a person can choose no limit (0)'
);
select lives_ok(
  $$update public.profiles set meal_plan_repeat_limit = 7 where id = '10270000-0000-4000-8000-00000000000a'$$,
  'a person can choose 7'
);
select lives_ok(
  $$update public.profiles set meal_plan_repeat_limit = 1 where id = '10270000-0000-4000-8000-00000000000a'$$,
  'a person can choose 1'
);
select throws_ok(
  $$update public.profiles set meal_plan_repeat_limit = 8 where id = '10270000-0000-4000-8000-00000000000a'$$,
  '23514', null, 'a limit of 8 is refused'
);
select throws_ok(
  $$update public.profiles set meal_plan_repeat_limit = -1 where id = '10270000-0000-4000-8000-00000000000a'$$,
  '23514', null, 'a negative limit is refused'
);
select lives_ok(
  $$update public.profiles set meal_plan_repeat_limit = null where id = '10270000-0000-4000-8000-00000000000a'$$,
  'a person can go back to not chosen (null)'
);
select is(
  (select count(*)::int from (select 1 from public.profiles where id = '10270000-0000-4000-8000-00000000000b' and meal_plan_repeat_limit is null) as untouched),
  0,
  'another person''s profile is not visible to A'
);
reset role;

-- save_meal_plan, as A: a plan of two days with a leftover on the second day of an item of the first.
set local role authenticated;
set local request.jwt.claims = '{"sub":"10270000-0000-4000-8000-00000000000a","role":"authenticated"}';
insert into key1027_ids values ('saved', public.save_meal_plan(
  '{"start_date":"2026-12-14","day_count":2,"rules":{"maxRepeats":2,"leftovers":true,"slots":["morning"]},"source":"assistant","owner_id":"10270000-0000-4000-8000-00000000000b"}',
  '[{"local_date":"2026-12-14","target":{"kcal":1800}},{"local_date":"2026-12-15","target":{"kcal":1900}}]',
  '[
    {"local_date":"2026-12-14","position":0,"slot_time":"07:30","item_type":"recipe","recipe_id":"10270000-0000-4000-8000-0000000000f1","servings":1,"nutrients":{"kcal":400},"snapshot":{"name":"key1027-cook"}},
    {"local_date":"2026-12-14","position":1,"slot_time":"12:30","item_type":"food","food_id":"10270000-0000-4000-8000-000000000101","portion_id":"10270000-0000-4000-8000-000000000501","grams":60,"nutrients":{"kcal":150},"snapshot":{"name":"key1027-food"}},
    {"local_date":"2026-12-15","position":0,"slot_time":"07:30","item_type":"recipe","recipe_id":"10270000-0000-4000-8000-0000000000f1","servings":1,"nutrients":{"kcal":400},"snapshot":{"name":"key1027-cook"},"leftover_of_day":"2026-12-14","leftover_of_position":0}
  ]'
));
select is(
  (select count(*)::int from public.meal_plans where id = (select id from key1027_ids where name = 'saved') and owner_id = '10270000-0000-4000-8000-00000000000a'),
  1,
  'save_meal_plan writes the plan for the caller and ignores an owner_id in the input'
);
select is(
  (select row(count(*), min(local_date), max(local_date))::text from public.meal_plan_days where plan_id = (select id from key1027_ids where name = 'saved')),
  row(2, '2026-12-14'::date, '2026-12-15'::date)::text,
  'save_meal_plan writes both days'
);
select is(
  (select count(*)::int from public.meal_plan_items where day_id in (select id from public.meal_plan_days where plan_id = (select id from key1027_ids where name = 'saved'))),
  3,
  'save_meal_plan writes every item'
);
select is(
  (select count(*)::int
     from public.meal_plan_items leftover
     join public.meal_plan_items cooking on cooking.id = leftover.leftover_of
     join public.meal_plan_days leftover_day on leftover_day.id = leftover.day_id
     join public.meal_plan_days cooking_day on cooking_day.id = cooking.day_id
    where leftover_day.plan_id = (select id from key1027_ids where name = 'saved')
      and leftover_day.local_date = '2026-12-15' and cooking_day.local_date = '2026-12-14' and cooking.position = 0),
  1,
  'a leftover is linked to the item that cooked it on the earlier day'
);
select is(
  (select rules ->> 'maxRepeats' from public.meal_plans where id = (select id from key1027_ids where name = 'saved')),
  '2',
  'the rules are stored as given'
);

-- All or nothing: a plan whose last item names B's private food writes nothing at all.
select is(
  (select count(*)::int from public.meal_plans where owner_id = '10270000-0000-4000-8000-00000000000a'),
  3,
  'A has three plans before the failing save'
);
select throws_ok(
  $$select public.save_meal_plan(
    '{"start_date":"2026-12-21","day_count":2,"rules":{},"source":"app"}',
    '[{"local_date":"2026-12-21","target":{}},{"local_date":"2026-12-22","target":{}}]',
    '[
      {"local_date":"2026-12-21","position":0,"item_type":"food","food_id":"10270000-0000-4000-8000-000000000101","grams":50,"nutrients":{},"snapshot":{}},
      {"local_date":"2026-12-22","position":0,"item_type":"food","food_id":"10270000-0000-4000-8000-0000000001b1","grams":50,"nutrients":{},"snapshot":{}}
    ]')$$,
  '42501', null, 'a plan with an item on another person''s private food is refused'
);
select is(
  (select row(count(*), (select count(*) from public.meal_plan_days where local_date between '2026-12-21' and '2026-12-22'), (select count(*) from public.meal_plan_items where owner_id = '10270000-0000-4000-8000-00000000000a' and position = 0 and food_id = '10270000-0000-4000-8000-000000000101' and grams = 50))::text
     from public.meal_plans where owner_id = '10270000-0000-4000-8000-00000000000a'),
  row(3, 0, 0)::text,
  'the refused save left no plan, no day and no item behind'
);
select throws_ok(
  $$select public.save_meal_plan('{"start_date":"2026-12-21","day_count":3,"rules":{},"source":"app"}', '[{"local_date":"2026-12-21","target":{}}]', '[]')$$,
  '22023', 'day_count must equal the number of days', 'a day_count that does not match the days is refused'
);
select throws_ok(
  $$select public.save_meal_plan('{"start_date":"2026-12-21","day_count":1,"rules":{},"source":"app"}', '[{"local_date":"2026-12-21","target":{}}]', '[{"local_date":"2026-12-30","position":0,"item_type":"food","food_id":"10270000-0000-4000-8000-000000000101","grams":50,"nutrients":{},"snapshot":{}}]')$$,
  '22023', 'every item must name a day of the plan', 'an item for a date that is not one of the days is refused'
);
select throws_ok(
  $$select public.save_meal_plan('{"start_date":"2026-12-21","day_count":1,"rules":{},"source":"app"}', '[{"local_date":"2026-12-21","target":{}}]', '[{"local_date":"2026-12-21","position":0,"item_type":"food","food_id":"10270000-0000-4000-8000-000000000101","grams":50,"nutrients":{},"snapshot":{},"leftover_of_position":9}]')$$,
  '22023', 'a leftover must name an item that is already in the plan', 'a leftover that names no item of the plan is refused'
);
select throws_ok(
  $$select public.save_meal_plan('[]', '[]', '[]')$$,
  '22023', 'save_meal_plan needs the plan as a JSON object', 'a plan that is not an object is refused'
);
select throws_ok(
  $$select public.save_meal_plan('{"start_date":"2026-12-21","day_count":1,"rules":{},"source":"app"}', '{}', '[]')$$,
  '22023', 'save_meal_plan needs the days and the items as JSON arrays', 'days that are not an array are refused'
);
select is(
  (select count(*)::int from public.meal_plans where owner_id = '10270000-0000-4000-8000-00000000000a'),
  3,
  'none of the refused saves left a plan'
);

-- replace_meal_plan_day, as A.
insert into key1027_ids select 'first_day', id from public.meal_plan_days where plan_id = (select id from key1027_ids where name = 'saved') and local_date = '2026-12-14';
insert into key1027_ids select 'second_day', id from public.meal_plan_days where plan_id = (select id from key1027_ids where name = 'saved') and local_date = '2026-12-15';
select lives_ok(
  $$select public.replace_meal_plan_day((select id from key1027_ids where name = 'first_day'), '[{"position":0,"slot_time":"08:00","item_type":"food","food_id":"10270000-0000-4000-8000-000000000101","grams":80,"nutrients":{"kcal":200},"snapshot":{"name":"key1027-new"}}]')$$,
  'a day can be replaced'
);
select is(
  (select row(count(*), min(snapshot ->> 'name'))::text from public.meal_plan_items where day_id = (select id from key1027_ids where name = 'first_day')),
  row(1, 'key1027-new')::text,
  'replacing a day swaps its items for the new ones'
);
select is(
  (select count(leftover_of)::int from public.meal_plan_items where day_id = (select id from key1027_ids where name = 'second_day')),
  0,
  'replacing the day of a cooking item clears the leftover that pointed at it'
);
select throws_ok(
  $$select public.replace_meal_plan_day((select id from key1027_ids where name = 'first_day'), '[{"position":0,"item_type":"food","food_id":"10270000-0000-4000-8000-0000000001b1","grams":80,"nutrients":{},"snapshot":{}}]')$$,
  '42501', null, 'a replacement with an item on another person''s private food is refused'
);
select is(
  (select min(snapshot ->> 'name') from public.meal_plan_items where day_id = (select id from key1027_ids where name = 'first_day')),
  'key1027-new',
  'the refused replacement left the day as it was'
);
select throws_ok(
  $$select public.replace_meal_plan_day((select id from key1027_ids where name = 'first_day'), '{}')$$,
  '22023', 'replace_meal_plan_day needs the items as a JSON array', 'items that are not an array are refused'
);
select throws_ok(
  $$select public.replace_meal_plan_day('10270000-0000-4000-8000-000000000999', '[]')$$,
  '22023', 'the day was not found', 'a day that does not exist is refused'
);

-- confirm_meal_plan_day, as A: the entries are what core built, and the ids come back in order.
select lives_ok(
  $$insert into key1027_returned select public.confirm_meal_plan_day(
    (select id from key1027_ids where name = 'first_day'),
    '[
      {"local_date":"2026-12-14","logged_at":"2026-12-14T08:00:00Z","item_type":"food","food_id":"10270000-0000-4000-8000-000000000101","quantity":80,"unit":"g","resolved_grams":80,"snapshot":{"name":"key1027-first"},"nutrients":{"kcal":200,"protein_g":10,"fat_g":5,"carbs_g":20,"fibre_g":2},"user_id":"10270000-0000-4000-8000-00000000000b"},
      {"local_date":"2026-12-14","logged_at":"2026-12-14T12:30:00Z","item_type":"recipe","recipe_id":"10270000-0000-4000-8000-0000000000f1","quantity":1,"unit":"serving","resolved_grams":300,"snapshot":{"name":"key1027-second"},"nutrients":{"kcal":400,"protein_g":30,"fat_g":10,"carbs_g":40,"fibre_g":5}}
    ]'
  )$$,
  'confirming a day writes its entries'
);
select is(
  (select count(*)::int from public.food_log_entries where user_id = '10270000-0000-4000-8000-00000000000a' and local_date = '2026-12-14'),
  2,
  'the day has two diary entries'
);
select is(
  (select string_agg(snapshot ->> 'name', ',' order by logged_at) from public.food_log_entries where user_id = '10270000-0000-4000-8000-00000000000a' and local_date = '2026-12-14'),
  'key1027-first,key1027-second',
  'the entries carry the snapshots core built, for the caller even when the input names another user'
);
select is(
  (select row(item_type::text, kcal, resolved_grams)::text from public.food_log_entries where user_id = '10270000-0000-4000-8000-00000000000a' and snapshot ->> 'name' = 'key1027-second'),
  row('recipe', 400, 300)::text,
  'a recipe entry keeps its figures'
);
select is(
  (select confirmed_entry_ids from public.meal_plan_days where id = (select id from key1027_ids where name = 'first_day')),
  (select array_agg(id order by logged_at) from public.food_log_entries where user_id = '10270000-0000-4000-8000-00000000000a' and local_date = '2026-12-14'),
  'the day holds the ids of its entries in the order given'
);
select is(
  (select ids from key1027_returned),
  (select array_agg(id order by logged_at) from public.food_log_entries where user_id = '10270000-0000-4000-8000-00000000000a' and local_date = '2026-12-14'),
  'the function returns the new entry ids in the order given'
);
select ok(
  (select confirmed_at is not null from public.meal_plan_days where id = (select id from key1027_ids where name = 'first_day')),
  'the day is stamped as confirmed'
);
select throws_ok(
  $$select public.confirm_meal_plan_day((select id from key1027_ids where name = 'first_day'), '[{"local_date":"2026-12-14","logged_at":"2026-12-14T09:00:00Z","item_type":"quick","snapshot":{},"nutrients":{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}}]')$$,
  '22023', 'the day is already confirmed', 'a confirmed day is refused for a second confirmation'
);
select is(
  (select count(*)::int from public.food_log_entries where user_id = '10270000-0000-4000-8000-00000000000a' and local_date = '2026-12-14'),
  2,
  'the second confirmation wrote nothing'
);
select throws_ok(
  $$select public.replace_meal_plan_day((select id from key1027_ids where name = 'first_day'), '[]')$$,
  '22023', 'a confirmed day cannot be replaced', 'a confirmed day is refused for a replacement'
);
select is(
  (select count(*)::int from public.meal_plan_items where day_id = (select id from key1027_ids where name = 'first_day')),
  1,
  'the refused replacement left the items of the confirmed day'
);

-- A confirmation that fails writes nothing and leaves the day open.
select throws_ok(
  $$select public.confirm_meal_plan_day((select id from key1027_ids where name = 'second_day'), '[
    {"local_date":"2026-12-15","logged_at":"2026-12-15T08:00:00Z","item_type":"food","food_id":"10270000-0000-4000-8000-000000000101","quantity":50,"unit":"g","resolved_grams":50,"snapshot":{},"nutrients":{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}},
    {"local_date":"2026-12-15","logged_at":"2026-12-15T09:00:00Z","item_type":"food","food_id":"10270000-0000-4000-8000-0000000001b1","quantity":50,"unit":"g","resolved_grams":50,"snapshot":{},"nutrients":{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}}
  ]')$$,
  '42501', null, 'a confirmation with an entry on another person''s private food is refused'
);
select is(
  (select row((select count(*) from public.food_log_entries where local_date = '2026-12-15'), confirmed_at is null, confirmed_entry_ids is null)::text from public.meal_plan_days where id = (select id from key1027_ids where name = 'second_day')),
  row(0, true, true)::text,
  'the refused confirmation wrote no entry and left the day unconfirmed'
);
select throws_ok(
  $$select public.confirm_meal_plan_day((select id from key1027_ids where name = 'second_day'), '[{"local_date":"2026-12-16","logged_at":"2026-12-16T08:00:00Z","item_type":"quick","snapshot":{},"nutrients":{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}}]')$$,
  '22023', 'an entry must be on the day it confirms', 'an entry on another date is refused'
);
select throws_ok(
  $$select public.confirm_meal_plan_day((select id from key1027_ids where name = 'second_day'), '[]')$$,
  '22023', 'a day is confirmed with at least one entry', 'a confirmation with no entry is refused'
);
select throws_ok(
  $$select public.confirm_meal_plan_day('10270000-0000-4000-8000-000000000999', '[{}]')$$,
  '22023', 'the day was not found', 'confirming a day that does not exist is refused'
);

-- Direct writes to a person's own rows are accepted (Amendment 22, "Direct writes").
select lives_ok(
  $$update public.meal_plans set archived_at = now() where id = (select id from key1027_ids where name = 'saved')$$,
  'a person archives their own plan'
);
select lives_ok(
  $$update public.meal_plan_days set confirmed_at = null, confirmed_entry_ids = null where id = (select id from key1027_ids where name = 'first_day')$$,
  'a person''s direct write to their own confirmed day is accepted'
);

-- Refusals on the tables themselves.
select throws_ok(
  $$delete from public.meal_plans where id = (select id from key1027_ids where name = 'saved')$$,
  '42501', null, 'a plan cannot be deleted by a client'
);
select throws_ok(
  $$delete from public.meal_plan_days where id = (select id from key1027_ids where name = 'second_day')$$,
  '42501', null, 'a day cannot be deleted by a client'
);
select throws_ok(
  $$update public.meal_plans set start_date = '2027-02-01' where id = (select id from key1027_ids where name = 'saved')$$,
  '42501', null, 'the start date of a plan cannot change'
);
select throws_ok(
  $$update public.meal_plan_items set grams = 1 where day_id = (select id from key1027_ids where name = 'second_day')$$,
  '42501', null, 'an item cannot be updated'
);
select throws_ok(
  $$insert into public.meal_plans (id, start_date, day_count, rules, source) values ('10270000-0000-4000-8000-000000000999', '2026-12-28', 1, '{}', 'app')$$,
  '42501', null, 'a client cannot set the id of a plan'
);
select throws_ok(
  $$insert into public.meal_plan_items (day_id, position, item_type, recipe_id, servings, nutrients, snapshot) values ('10270000-0000-4000-8000-000000000a12', 9, 'recipe', '10270000-0000-4000-8000-0000000000f3', 1, '{}', '{}')$$,
  '42501', null, 'an item cannot name another person''s recipe'
);
select throws_ok(
  $$insert into public.meal_plan_items (day_id, position, item_type, food_id, grams, nutrients, snapshot, leftover_of) values ('10270000-0000-4000-8000-000000000a12', 9, 'food', '10270000-0000-4000-8000-000000000101', 5, '{}', '{}', '10270000-0000-4000-8000-000000000b21')$$,
  '23503', null, 'an item cannot name another person''s item as its cooking item'
);
select throws_ok(
  $$insert into public.meal_plan_items (day_id, position, item_type, food_id, grams, nutrients, snapshot) values ('10270000-0000-4000-8000-000000000b11', 9, 'food', '10270000-0000-4000-8000-000000000101', 5, '{}', '{}')$$,
  '42501', null, 'an item cannot be added to another person''s day'
);
select throws_ok(
  $$insert into public.meal_plan_days (plan_id, local_date, target) values ('10270000-0000-4000-8000-000000000b01', '2026-12-09', '{}')$$,
  '42501', null, 'a day cannot be added to another person''s plan'
);
reset role;

-- Two-user isolation: B sees nothing of A's, and cannot change or call anything on it.
set local role authenticated;
set local request.jwt.claims = '{"sub":"10270000-0000-4000-8000-00000000000b","role":"authenticated"}';
select is(
  (select row(count(*), min(owner_id::text))::text from public.meal_plans),
  row(1, '10270000-0000-4000-8000-00000000000b')::text,
  'B reads only B''s own plan'
);
select is(
  (select row(count(*), min(owner_id::text))::text from public.meal_plan_days),
  row(1, '10270000-0000-4000-8000-00000000000b')::text,
  'B reads only B''s own day'
);
select is(
  (select row(count(*), min(owner_id::text))::text from public.meal_plan_items),
  row(1, '10270000-0000-4000-8000-00000000000b')::text,
  'B reads only B''s own item'
);
with changed as (
  update public.meal_plans set archived_at = now() where owner_id = '10270000-0000-4000-8000-00000000000a' returning 1
)
select is((select count(*)::int from changed), 0, 'B''s update of A''s plans reaches no row');
with removed as (
  delete from public.meal_plan_items where owner_id = '10270000-0000-4000-8000-00000000000a' returning 1
)
select is((select count(*)::int from removed), 0, 'B''s delete of A''s items reaches no row');
select throws_ok(
  $$select public.replace_meal_plan_day((select id from key1027_ids where name = 'second_day'), '[]')$$,
  '22023', 'the day was not found', 'B cannot replace A''s day'
);
select throws_ok(
  $$select public.confirm_meal_plan_day((select id from key1027_ids where name = 'second_day'), '[{}]')$$,
  '22023', 'the day was not found', 'B cannot confirm A''s day'
);
select throws_ok(
  $$insert into public.meal_plan_items (day_id, position, item_type, recipe_id, servings, nutrients, snapshot) values ('10270000-0000-4000-8000-000000000b11', 9, 'recipe', '10270000-0000-4000-8000-0000000000f1', 1, '{}', '{}')$$,
  '42501', null, 'B cannot name A''s recipe on an item'
);
select throws_ok(
  $$insert into public.meal_plan_items (day_id, position, item_type, food_id, grams, portion_id, nutrients, snapshot) values ('10270000-0000-4000-8000-000000000b11', 3, 'food', '10270000-0000-4000-8000-000000000101', 5, '10270000-0000-4000-8000-000000000503', '{}', '{}')$$,
  '42501', null, 'B cannot name A''s private portion on an item'
);
select throws_ok(
  $$insert into public.meal_plan_items (day_id, position, item_type, food_id, grams, portion_id, nutrients, snapshot) values ('10270000-0000-4000-8000-000000000b11', 3, 'food', '10270000-0000-4000-8000-000000000101', 5, '10270000-0000-4000-8000-000000000999', '{}', '{}')$$,
  '42501', null, 'a portion id that does not exist is refused the same way, so it cannot be probed'
);
select lives_ok(
  $$insert into public.meal_plan_items (day_id, position, item_type, food_id, grams, portion_id, nutrients, snapshot) values ('10270000-0000-4000-8000-000000000b11', 3, 'food', '10270000-0000-4000-8000-000000000101', 5, '10270000-0000-4000-8000-000000000501', '{}', '{}')$$,
  'B can name a global portion on an item'
);
reset role;
select is(
  (select row(archived_at is null, (select count(*) from public.meal_plan_items where day_id = (select id from key1027_ids where name = 'second_day')))::text from public.meal_plans where id = '10270000-0000-4000-8000-000000000a01'),
  row(true, 1)::text,
  'A''s rows are as A left them after B''s attempts'
);

-- Anon reads nothing and calls nothing.
set local role anon;
select throws_ok($$select count(*) from public.meal_plans$$, '42501', null, 'anon cannot read plans');
select throws_ok(
  $$select public.save_meal_plan('{}', '[]', '[]')$$,
  '42501', null, 'anon cannot call save_meal_plan'
);
reset role;

-- Cascades from the plan and from the account, as postgres. The plan delete is a server side act, since
-- a client has no delete grant.
delete from public.meal_plans where id = '10270000-0000-4000-8000-000000000a01';
select is(
  (select row((select count(*) from public.meal_plan_days where plan_id = '10270000-0000-4000-8000-000000000a01'), (select count(*) from public.meal_plan_items where owner_id = '10270000-0000-4000-8000-00000000000a' and day_id in ('10270000-0000-4000-8000-000000000a11', '10270000-0000-4000-8000-000000000a12')))::text),
  row(0, 0)::text,
  'deleting a plan deletes its days and their items'
);
delete from auth.users where id = '10270000-0000-4000-8000-00000000000c';
select is(
  (select row((select count(*) from public.meal_plans where owner_id = '10270000-0000-4000-8000-00000000000c'), (select count(*) from public.meal_plan_days where owner_id = '10270000-0000-4000-8000-00000000000c'), (select count(*) from public.meal_plan_items where owner_id = '10270000-0000-4000-8000-00000000000c'))::text),
  row(0, 0, 0)::text,
  'deleting an account deletes its plans, days and items'
);
select is(
  (select count(*)::int from public.meal_plans where owner_id = '10270000-0000-4000-8000-00000000000b'),
  1,
  'deleting one account leaves another''s plans'
);

select * from finish();
rollback;
