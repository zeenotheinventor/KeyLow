-- Asserts recipes (ADR 0003, Amendment 8): the two tables, their checks, indexes and exact
-- privileges, owner-only row level security, the foreign key and insert policy on
-- food_log_entries.recipe_id, the cascade from the account, portion delete, name search and
-- public.save_recipe (every refusal, the atomic save and the order of ingredients and steps).
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so
-- nothing created here persists. Every fixture id starts with 28300000 and every name and email
-- with key283-, so the rows are recognisable as this file's, and nothing asserts a whole-table
-- count. Each actor is entered with `set local role` plus the JWT claims that `auth.uid()` reads,
-- and left with `reset role`.
--
-- Health data: no assertion or fixture here is a real recipe, and the refusal messages asserted
-- below state a rule and never a value.

begin;

select plan(189);

-- Three users. The on_auth_user_created trigger creates their profiles rows. C is the throwaway
-- user whose account is deleted at the end.
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '28300000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'key283-user-a@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '28300000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'key283-user-b@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '28300000-0000-4000-8000-00000000000c', 'authenticated', 'authenticated', 'key283-user-c@keylow.test');

-- Fixtures, inserted as postgres so row level security does not apply: a global food and a private
-- food for A, B and C, each with a portion, a live and an archived recipe for A, a recipe for B, a
-- recipe for C, and a few ingredients and entries.
insert into public.foods (id, source, source_ref, owner_id, name, basis) values
  ('28300000-0000-4000-8000-000000000101', 'cofid', 'KEY283-FOOD-1', null, 'key283-global-oats', 'per_100g'),
  ('28300000-0000-4000-8000-0000000001a1', 'user', null, '28300000-0000-4000-8000-00000000000a', 'key283-a-private-food', 'per_100g'),
  ('28300000-0000-4000-8000-0000000001b1', 'user', null, '28300000-0000-4000-8000-00000000000b', 'key283-b-private-food', 'per_100g'),
  ('28300000-0000-4000-8000-0000000001c1', 'user', null, '28300000-0000-4000-8000-00000000000c', 'key283-c-private-food', 'per_100g');

insert into public.food_portions (id, food_id, owner_id, label, grams) values
  ('28300000-0000-4000-8000-000000000201', '28300000-0000-4000-8000-000000000101', null, 'key283-global-bowl', 40),
  ('28300000-0000-4000-8000-0000000002a1', '28300000-0000-4000-8000-0000000001a1', '28300000-0000-4000-8000-00000000000a', 'key283-a-slice', 30),
  ('28300000-0000-4000-8000-0000000002b1', '28300000-0000-4000-8000-0000000001b1', '28300000-0000-4000-8000-00000000000b', 'key283-b-slice', 30),
  ('28300000-0000-4000-8000-0000000002c1', '28300000-0000-4000-8000-0000000001c1', '28300000-0000-4000-8000-00000000000c', 'key283-c-slice', 30);

insert into public.recipes (id, owner_id, name, servings, computed, is_archived) values
  ('28300000-0000-4000-8000-000000000401', '28300000-0000-4000-8000-00000000000a', 'key283-a-stew', 2, '{}', false),
  ('28300000-0000-4000-8000-000000000402', '28300000-0000-4000-8000-00000000000a', 'key283-a-archived', 2, '{}', true),
  ('28300000-0000-4000-8000-0000000004b1', '28300000-0000-4000-8000-00000000000b', 'key283-b-curry', 4, '{}', false),
  ('28300000-0000-4000-8000-0000000004c1', '28300000-0000-4000-8000-00000000000c', 'key283-c-pie', 4, '{}', false);

insert into public.recipe_ingredients (id, recipe_id, owner_id, position, food_id, quantity, unit, portion_id, resolved_grams, snapshot) values
  ('28300000-0000-4000-8000-000000000501', '28300000-0000-4000-8000-000000000401', '28300000-0000-4000-8000-00000000000a', 0, '28300000-0000-4000-8000-000000000101', 100, 'g', null, 100, '{"kind":"food"}'),
  ('28300000-0000-4000-8000-000000000502', '28300000-0000-4000-8000-000000000401', '28300000-0000-4000-8000-00000000000a', 1, '28300000-0000-4000-8000-0000000001a1', 1, 'portion', '28300000-0000-4000-8000-0000000002a1', 30, '{"kind":"food"}'),
  ('28300000-0000-4000-8000-0000000005b1', '28300000-0000-4000-8000-0000000004b1', '28300000-0000-4000-8000-00000000000b', 0, '28300000-0000-4000-8000-0000000001b1', 100, 'g', null, 100, '{"kind":"food"}');

-- A recipe entry on A's archived recipe, so the recipe is referenced from the diary.
insert into public.food_log_entries (id, user_id, local_date, item_type, recipe_id, snapshot, nutrients) values
  ('28300000-0000-4000-8000-0000000003a1', '28300000-0000-4000-8000-00000000000a', '2026-10-17', 'recipe', '28300000-0000-4000-8000-000000000402', '{"kind":"recipe"}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}');

-- Payload builders for save_recipe. They live in the temporary schema, so nothing persists, and
-- are callable under the API roles.
create function pg_temp.ingredient(food uuid, grams numeric default 100, portion uuid default null)
returns jsonb language sql as $$
  select jsonb_build_object(
    'food_id', food, 'quantity', grams, 'unit', 'g', 'portion_id', portion,
    'resolved_grams', grams, 'snapshot', jsonb_build_object('kind', 'food', 'ref', food)
  )
$$;

create function pg_temp.recipe(recipe_name text, steps jsonb default '[]')
returns jsonb language sql as $$
  select jsonb_build_object(
    'name', recipe_name, 'servings', 2, 'yield_grams', 500, 'instructions', steps,
    'computed', '{"total":{"kcal":null},"engineVersion":1}'::jsonb
  )
$$;

-- Shape.
select has_table('public', 'recipes', 'recipes exists');
select has_table('public', 'recipe_ingredients', 'recipe_ingredients exists');
select hasnt_column('public', 'recipes', 'notes', 'recipes has no notes column, the instructions take its place');
select col_type_is('public', 'recipes', 'instructions', 'text[]', 'instructions is a text array');
select col_not_null('public', 'recipes', 'instructions', 'instructions is not null');
select col_has_default('public', 'recipes', 'instructions', 'instructions has a default');
select col_not_null('public', 'recipes', 'computed', 'computed is not null');
select col_hasnt_default('public', 'recipes', 'computed', 'computed has no default');
select col_default_is('public', 'recipes', 'is_archived', 'false', 'is_archived defaults to false');
select col_is_null('public', 'recipes', 'yield_grams', 'yield_grams is nullable');
select col_has_default('public', 'recipes', 'owner_id', 'recipes.owner_id defaults to the caller');
select col_has_default('public', 'recipe_ingredients', 'owner_id', 'recipe_ingredients.owner_id defaults to the caller');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.recipes'::regclass),
  'row level security is enabled on recipes'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.recipe_ingredients'::regclass),
  'row level security is enabled on recipe_ingredients'
);

-- Foreign keys: the delete rule of each, and that none is deferrable.
select is(
  (select confdeltype::text from pg_constraint where conrelid = 'public.recipes'::regclass and contype = 'f' and conkey = array[(select attnum from pg_attribute where attrelid = 'public.recipes'::regclass and attname = 'owner_id')]),
  'c',
  'deleting the owner deletes their recipes'
);
select is(
  (select confdeltype::text from pg_constraint where conrelid = 'public.recipe_ingredients'::regclass and contype = 'f' and confrelid = 'public.recipes'::regclass),
  'c',
  'deleting a recipe deletes its ingredients'
);
select is(
  (select confdeltype::text from pg_constraint where conrelid = 'public.recipe_ingredients'::regclass and contype = 'f' and confrelid = 'public.foods'::regclass),
  'a',
  'an ingredient food has no cascade'
);
select is(
  (select confdeltype::text from pg_constraint where conrelid = 'public.recipe_ingredients'::regclass and contype = 'f' and confrelid = 'public.food_portions'::regclass),
  'n',
  'deleting a portion sets the ingredient portion_id to null'
);
select is(
  (select confdeltype::text from pg_constraint where conrelid = 'public.recipe_ingredients'::regclass and contype = 'f' and confrelid = 'auth.users'::regclass),
  'c',
  'deleting the owner deletes the ingredients'
);
select is(
  (select confdeltype::text || '/' || condeferrable::text from pg_constraint where conname = 'food_log_entries_recipe_id_fkey' and conrelid = 'public.food_log_entries'::regclass),
  'a/false',
  'food_log_entries.recipe_id references recipes with no action and is not deferrable'
);

-- Indexes.
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'recipes' and indexdef like '%(owner_id, name)'),
  'there is an index on recipes (owner_id, name)'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'recipes' and indexdef like '%USING gin (name%gin_trgm_ops)'),
  'there is a trigram index on recipes.name'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'recipe_ingredients' and indexdef like 'CREATE UNIQUE INDEX%(recipe_id, "position")'),
  'recipe_ingredients is unique on (recipe_id, position)'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'recipe_ingredients' and indexdef like '%(food_id)' and indexdef not like 'CREATE UNIQUE%'),
  'there is a plain index on recipe_ingredients.food_id'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'recipe_ingredients' and indexdef like '%(portion_id)' and indexdef not like 'CREATE UNIQUE%'),
  'there is a plain index on recipe_ingredients.portion_id'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'food_log_entries' and indexdef like '%(recipe_id) WHERE (recipe_id IS NOT NULL)'),
  'there is a partial index on food_log_entries.recipe_id'
);

-- Privileges. anon and service_role hold nothing at all, on a table or a column.
select ok(
  not has_any_column_privilege('anon', 'public.recipes', 'select,insert,update,references')
    and not has_table_privilege('anon', 'public.recipes', 'delete,truncate,trigger'),
  'anon has no privilege on recipes'
);
select ok(
  not has_any_column_privilege('anon', 'public.recipe_ingredients', 'select,insert,update,references')
    and not has_table_privilege('anon', 'public.recipe_ingredients', 'delete,truncate,trigger'),
  'anon has no privilege on recipe_ingredients'
);
select ok(
  not has_any_column_privilege('service_role', 'public.recipes', 'select,insert,update,references')
    and not has_table_privilege('service_role', 'public.recipes', 'delete,truncate,trigger'),
  'service_role has no privilege on recipes'
);
select ok(
  not has_any_column_privilege('service_role', 'public.recipe_ingredients', 'select,insert,update,references')
    and not has_table_privilege('service_role', 'public.recipe_ingredients', 'delete,truncate,trigger'),
  'service_role has no privilege on recipe_ingredients'
);
select is(
  (select array_agg(privilege_type::text order by privilege_type::text) from information_schema.table_privileges where table_schema = 'public' and table_name = 'recipes' and grantee = 'authenticated'),
  array['SELECT'],
  'authenticated holds only select on recipes as a table, so there is no delete'
);
select is(
  (select array_agg(privilege_type::text order by privilege_type::text) from information_schema.table_privileges where table_schema = 'public' and table_name = 'recipe_ingredients' and grantee = 'authenticated'),
  array['DELETE', 'SELECT'],
  'authenticated holds select and delete on recipe_ingredients as a table'
);
select is(
  (select array_agg(column_name::text order by column_name::text collate "C") from information_schema.column_privileges where table_schema = 'public' and table_name = 'recipes' and grantee = 'authenticated' and privilege_type = 'INSERT'),
  array['computed', 'instructions', 'name', 'owner_id', 'servings', 'yield_grams'],
  'authenticated can insert exactly these columns of recipes'
);
select is(
  (select array_agg(column_name::text order by column_name::text collate "C") from information_schema.column_privileges where table_schema = 'public' and table_name = 'recipes' and grantee = 'authenticated' and privilege_type = 'UPDATE'),
  array['computed', 'instructions', 'is_archived', 'name', 'servings', 'yield_grams'],
  'authenticated can update exactly these columns of recipes'
);
select is(
  (select array_agg(column_name::text order by column_name::text collate "C") from information_schema.column_privileges where table_schema = 'public' and table_name = 'recipe_ingredients' and grantee = 'authenticated' and privilege_type = 'INSERT'),
  array['food_id', 'owner_id', 'portion_id', 'position', 'quantity', 'recipe_id', 'resolved_grams', 'snapshot', 'unit'],
  'authenticated can insert exactly these columns of recipe_ingredients'
);
select is(
  (select count(*)::int from information_schema.column_privileges where table_schema = 'public' and table_name = 'recipe_ingredients' and grantee = 'authenticated' and privilege_type = 'UPDATE'),
  0,
  'authenticated can update no column of recipe_ingredients'
);

-- Policies, as predicates.
select is(
  (select array_agg(policyname || ':' || cmd || ':' || roles::text order by policyname) from pg_policies where schemaname = 'public' and tablename = 'recipes'),
  array['recipes_insert_own:INSERT:{authenticated}', 'recipes_select_own:SELECT:{authenticated}', 'recipes_update_own:UPDATE:{authenticated}'],
  'recipes has exactly an owner-only select, insert and update policy, and no delete policy'
);
select is(
  (select array_agg(policyname || ':' || cmd || ':' || roles::text order by policyname) from pg_policies where schemaname = 'public' and tablename = 'recipe_ingredients'),
  array['recipe_ingredients_delete_own:DELETE:{authenticated}', 'recipe_ingredients_insert_own:INSERT:{authenticated}', 'recipe_ingredients_select_own:SELECT:{authenticated}'],
  'recipe_ingredients has exactly an owner-only select, insert and delete policy, and no update policy'
);
select ok(
  (select qual like '%SELECT auth.uid() AS uid%' from pg_policies where tablename = 'recipes' and policyname = 'recipes_select_own')
    and (select with_check like '%SELECT auth.uid() AS uid%' from pg_policies where tablename = 'recipes' and policyname = 'recipes_insert_own')
    and (select qual like '%SELECT auth.uid() AS uid%' and with_check like '%SELECT auth.uid() AS uid%' from pg_policies where tablename = 'recipes' and policyname = 'recipes_update_own')
    and (select qual like '%SELECT auth.uid() AS uid%' from pg_policies where tablename = 'recipe_ingredients' and policyname = 'recipe_ingredients_select_own')
    and (select qual like '%SELECT auth.uid() AS uid%' from pg_policies where tablename = 'recipe_ingredients' and policyname = 'recipe_ingredients_delete_own'),
  'the recipe policies evaluate auth.uid() once per statement'
);
select ok(
  (select with_check like '%recipes%' and with_check like '%foods%' and with_check like '%food_portions%' from pg_policies where tablename = 'recipe_ingredients' and policyname = 'recipe_ingredients_insert_own'),
  'the ingredient insert policy checks the recipe, the food and the portion'
);
select ok(
  (select with_check like '%recipes%' and with_check like '%foods%' and with_check like '%food_portions%' from pg_policies where tablename = 'food_log_entries' and policyname = 'food_log_entries_insert_own'),
  'the entry insert policy checks the food, the portion and now the recipe'
);

-- save_recipe: security invoker, a fixed search path, and execute for authenticated alone.
select ok(
  (select not prosecdef and provolatile = 'v' from pg_proc where oid = 'public.save_recipe(uuid, jsonb, jsonb)'::regprocedure),
  'save_recipe is security invoker and volatile'
);
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc where oid = 'public.save_recipe(uuid, jsonb, jsonb)'::regprocedure),
  'save_recipe has an empty search_path'
);
select ok(
  has_function_privilege('authenticated', 'public.save_recipe(uuid, jsonb, jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.save_recipe(uuid, jsonb, jsonb)', 'execute')
    and not has_function_privilege('service_role', 'public.save_recipe(uuid, jsonb, jsonb)', 'execute')
    and (select not exists (select 1 from aclexplode(proacl) as privilege where privilege.grantee = 0) from pg_proc where oid = 'public.save_recipe(uuid, jsonb, jsonb)'::regprocedure),
  'only authenticated can execute save_recipe, and public cannot'
);
select ok(
  has_function_privilege('authenticated', 'public.recipe_instructions_are_valid(text[])', 'execute')
    and not has_function_privilege('anon', 'public.recipe_instructions_are_valid(text[])', 'execute')
    and not has_function_privilege('service_role', 'public.recipe_instructions_are_valid(text[])', 'execute')
    and (select not exists (select 1 from aclexplode(proacl) as privilege where privilege.grantee = 0) from pg_proc where oid = 'public.recipe_instructions_are_valid(text[])'::regprocedure),
  'only authenticated can execute the step helper, and public cannot'
);

-- Anon.
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  $$ select * from public.recipes $$,
  '42501',
  'permission denied for table recipes',
  'anon cannot select from recipes'
);
select throws_ok(
  $$ insert into public.recipes (name, servings, computed) values ('key283-anon', 1, '{}') $$,
  '42501',
  'permission denied for table recipes',
  'anon cannot insert into recipes'
);
select throws_ok(
  $$ select * from public.recipe_ingredients $$,
  '42501',
  'permission denied for table recipe_ingredients',
  'anon cannot select from recipe_ingredients'
);
select throws_ok(
  $$ select public.save_recipe(null, pg_temp.recipe('key283-anon'), '[]') $$,
  '42501',
  'permission denied for function save_recipe',
  'anon cannot call save_recipe'
);

reset role;

-- service_role.
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';

select throws_ok(
  $$ select * from public.recipes $$,
  '42501',
  'permission denied for table recipes',
  'service_role cannot select from recipes'
);
select throws_ok(
  $$ select public.save_recipe(null, pg_temp.recipe('key283-service'), '[]') $$,
  '42501',
  'permission denied for function save_recipe',
  'service_role cannot call save_recipe'
);

reset role;

-- User A: owner-only reads.
set local role authenticated;
set local request.jwt.claims = '{"sub":"28300000-0000-4000-8000-00000000000a","role":"authenticated"}';

select is(
  (select array_agg(name order by name) from public.recipes where name like 'key283-%'),
  array['key283-a-archived', 'key283-a-stew'],
  'user A sees their own recipes, the archived one included, and none of the others'
);
select is(
  (select count(*)::int from public.recipe_ingredients where id = '28300000-0000-4000-8000-0000000005b1'),
  0,
  'user A does not see user B''s ingredient'
);
select is(
  (select count(*)::int from public.recipe_ingredients where recipe_id = '28300000-0000-4000-8000-000000000401'),
  2,
  'user A sees the ingredients of their own recipe'
);

-- User A: inserting recipes.
select lives_ok(
  $$ insert into public.recipes (name, servings, computed) values ('key283-a-no-owner', 1, '{}') $$,
  'user A inserts a recipe without sending owner_id'
);
select is(
  (select owner_id from public.recipes where name = 'key283-a-no-owner'),
  '28300000-0000-4000-8000-00000000000a'::uuid,
  'owner_id defaults to the caller'
);
select is(
  (select is_archived from public.recipes where name = 'key283-a-no-owner'),
  false,
  'a new recipe starts live'
);
select throws_ok(
  $$ insert into public.recipes (owner_id, name, servings, computed) values ('28300000-0000-4000-8000-00000000000b', 'key283-a-for-b', 1, '{}') $$,
  '42501',
  'new row violates row-level security policy for table "recipes"',
  'user A cannot insert a recipe for user B'
);
select throws_ok(
  $$ insert into public.recipes (name, servings, computed, is_archived) values ('key283-a-archived-at-birth', 1, '{}', true) $$,
  '42501',
  'permission denied for table recipes',
  'user A cannot insert an archived recipe'
);
select throws_ok(
  $$ insert into public.recipes (id, name, servings, computed) values ('28300000-0000-4000-8000-0000000004ff', 'key283-a-chosen-id', 1, '{}') $$,
  '42501',
  'permission denied for table recipes',
  'user A cannot choose the id of a recipe'
);

-- User A: bounds on the recipe row.
select lives_ok(
  format($$ insert into public.recipes (name, servings, yield_grams, instructions, computed) values (%L, 1000, 100000, %L, '{}') $$,
    'key283-edge-' || repeat('n', 188), (select array_agg(repeat('s', 1000)) from generate_series(1, 50))),
  'a name of 200 characters, 1000 servings, a yield of 100000 and 50 steps of 1000 characters are accepted'
);
select lives_ok(
  $$ insert into public.recipes (name, servings, instructions, computed) values ('key283-fraction', 0.5, '{}', '{}') $$,
  'fractional servings and no steps are accepted'
);
select throws_ok(
  $$ insert into public.recipes (name, servings, computed) values ('   ', 1, '{}') $$,
  '23514',
  'new row for relation "recipes" violates check constraint "recipes_name_not_blank"',
  'a blank name is refused'
);
select throws_ok(
  $$ insert into public.recipes (name, servings, computed) values (E'\t\n', 1, '{}') $$,
  '23514',
  'new row for relation "recipes" violates check constraint "recipes_name_not_blank"',
  'a name of tabs and new lines is refused'
);
select throws_ok(
  format($$ insert into public.recipes (name, servings, computed) values (%L, 1, '{}') $$, repeat('n', 201)),
  '23514',
  'new row for relation "recipes" violates check constraint "recipes_name_length_check"',
  'a name of 201 characters is refused'
);
select throws_ok(
  $$ insert into public.recipes (name, servings, computed) values ('key283-zero-servings', 0, '{}') $$,
  '23514',
  'new row for relation "recipes" violates check constraint "recipes_servings_check"',
  '0 servings is refused'
);
select throws_ok(
  $$ insert into public.recipes (name, servings, computed) values ('key283-many-servings', 1000.01, '{}') $$,
  '23514',
  'new row for relation "recipes" violates check constraint "recipes_servings_check"',
  'more than 1000 servings is refused'
);
select throws_ok(
  $$ insert into public.recipes (name, servings, yield_grams, computed) values ('key283-zero-yield', 1, 0, '{}') $$,
  '23514',
  'new row for relation "recipes" violates check constraint "recipes_yield_grams_check"',
  'a yield of 0 is refused'
);
select throws_ok(
  $$ insert into public.recipes (name, servings, yield_grams, computed) values ('key283-huge-yield', 1, 100000.5, '{}') $$,
  '23514',
  'new row for relation "recipes" violates check constraint "recipes_yield_grams_check"',
  'a yield over 100000 is refused'
);
select throws_ok(
  format($$ insert into public.recipes (name, servings, instructions, computed) values ('key283-51-steps', 1, %L, '{}') $$, (select array_agg('step'::text) from generate_series(1, 51))),
  '23514',
  'new row for relation "recipes" violates check constraint "recipes_instructions_check"',
  '51 steps are refused'
);
select throws_ok(
  $$ insert into public.recipes (name, servings, instructions, computed) values ('key283-blank-step', 1, array['one', '  '], '{}') $$,
  '23514',
  'new row for relation "recipes" violates check constraint "recipes_instructions_check"',
  'a step of spaces is refused'
);
select throws_ok(
  $$ insert into public.recipes (name, servings, instructions, computed) values ('key283-empty-step', 1, array['one', ''], '{}') $$,
  '23514',
  'new row for relation "recipes" violates check constraint "recipes_instructions_check"',
  'an empty step is refused'
);
select throws_ok(
  $$ insert into public.recipes (name, servings, instructions, computed) values ('key283-null-step', 1, array['one', null], '{}') $$,
  '23514',
  'new row for relation "recipes" violates check constraint "recipes_instructions_check"',
  'a null step is refused'
);
select throws_ok(
  format($$ insert into public.recipes (name, servings, instructions, computed) values ('key283-long-step', 1, array[%L], '{}') $$, repeat('s', 1001)),
  '23514',
  'new row for relation "recipes" violates check constraint "recipes_instructions_check"',
  'a step of 1001 characters is refused'
);
select throws_ok(
  $$ insert into public.recipes (name, servings, instructions, computed) values ('key283-two-dimensions', 1, array[['one', 'two'], ['three', 'four']], '{}') $$,
  '23514',
  'new row for relation "recipes" violates check constraint "recipes_instructions_check"',
  'a two dimensional step list is refused'
);
select throws_ok(
  $$ insert into public.recipes (name, servings, computed) values ('key283-computed-array', 1, '[]') $$,
  '23514',
  'new row for relation "recipes" violates check constraint "recipes_computed_is_object"',
  'a computed cache that is not an object is refused'
);

-- User A: archive, unarchive, and the closed columns.
select lives_ok(
  $$ update public.recipes set is_archived = true where id = '28300000-0000-4000-8000-000000000401' $$,
  'user A archives their own recipe'
);
select is(
  (select count(*)::int from public.recipes where id = '28300000-0000-4000-8000-000000000401' and is_archived)
    + (select count(*)::int from public.recipe_ingredients where recipe_id = '28300000-0000-4000-8000-000000000401'),
  3,
  'an archived recipe is still readable and keeps its ingredients'
);
select lives_ok(
  $$ update public.recipes set is_archived = false where id = '28300000-0000-4000-8000-000000000401' $$,
  'user A unarchives their own recipe'
);
select is(
  (select is_archived from public.recipes where id = '28300000-0000-4000-8000-000000000401'),
  false,
  'the recipe is live again'
);
select throws_ok(
  $$ update public.recipes set owner_id = '28300000-0000-4000-8000-00000000000b' where id = '28300000-0000-4000-8000-000000000401' $$,
  '42501',
  'permission denied for table recipes',
  'user A cannot hand a recipe to user B'
);
select throws_ok(
  $$ update public.recipes set created_at = '2020-01-01' where id = '28300000-0000-4000-8000-000000000401' $$,
  '42501',
  'permission denied for table recipes',
  'user A cannot change created_at'
);
with changed as (
  update public.recipes set name = 'key283-taken-over' where id = '28300000-0000-4000-8000-0000000004b1' returning 1
)
select is((select count(*)::int from changed), 0, 'user A updates none of user B''s recipes');
select throws_ok(
  $$ delete from public.recipes where id = '28300000-0000-4000-8000-000000000401' $$,
  '42501',
  'permission denied for table recipes',
  'user A cannot delete their own recipe'
);

-- User A: ingredients.
select lives_ok(
  $$ insert into public.recipe_ingredients (recipe_id, position, food_id, quantity, unit, resolved_grams, snapshot) values ('28300000-0000-4000-8000-000000000401', 2, '28300000-0000-4000-8000-000000000101', 50, 'g', 50, '{"kind":"food"}') $$,
  'user A adds an ingredient of a global food to their own recipe'
);
select is(
  (select owner_id from public.recipe_ingredients where recipe_id = '28300000-0000-4000-8000-000000000401' and position = 2),
  '28300000-0000-4000-8000-00000000000a'::uuid,
  'the ingredient owner_id defaults to the caller'
);
select lives_ok(
  $$ insert into public.recipe_ingredients (recipe_id, position, food_id, quantity, unit, portion_id, resolved_grams, snapshot) values ('28300000-0000-4000-8000-000000000401', 3, '28300000-0000-4000-8000-0000000001a1', 2, 'portion', '28300000-0000-4000-8000-0000000002a1', 60, '{"kind":"food"}') $$,
  'user A adds an ingredient of their own food and portion'
);
select lives_ok(
  $$ insert into public.recipe_ingredients (recipe_id, position, food_id, quantity, unit, portion_id, resolved_grams, snapshot) values ('28300000-0000-4000-8000-000000000401', 4, '28300000-0000-4000-8000-000000000101', 1, 'portion', '28300000-0000-4000-8000-000000000201', 40, '{"kind":"food"}') $$,
  'user A adds an ingredient with a global portion'
);
select throws_ok(
  $$ insert into public.recipe_ingredients (recipe_id, position, food_id, quantity, unit, resolved_grams, snapshot) values ('28300000-0000-4000-8000-0000000004b1', 1, '28300000-0000-4000-8000-000000000101', 50, 'g', 50, '{"kind":"food"}') $$,
  '42501',
  'new row violates row-level security policy for table "recipe_ingredients"',
  'user A cannot add an ingredient to user B''s recipe'
);
select throws_ok(
  $$ insert into public.recipe_ingredients (recipe_id, owner_id, position, food_id, quantity, unit, resolved_grams, snapshot) values ('28300000-0000-4000-8000-000000000401', '28300000-0000-4000-8000-00000000000b', 5, '28300000-0000-4000-8000-000000000101', 50, 'g', 50, '{"kind":"food"}') $$,
  '42501',
  'new row violates row-level security policy for table "recipe_ingredients"',
  'user A cannot insert an ingredient with user B''s owner_id'
);
select throws_ok(
  $$ insert into public.recipe_ingredients (recipe_id, position, food_id, quantity, unit, resolved_grams, snapshot) values ('28300000-0000-4000-8000-000000000401', 5, '28300000-0000-4000-8000-0000000001b1', 50, 'g', 50, '{"kind":"food"}') $$,
  '42501',
  'new row violates row-level security policy for table "recipe_ingredients"',
  'user A cannot use user B''s private food'
);
select throws_ok(
  $$ insert into public.recipe_ingredients (recipe_id, position, food_id, quantity, unit, resolved_grams, snapshot) values ('28300000-0000-4000-8000-000000000401', 5, '28300000-0000-4000-8000-00000000dead', 50, 'g', 50, '{"kind":"food"}') $$,
  '42501',
  'new row violates row-level security policy for table "recipe_ingredients"',
  'a food that does not exist fails the same way as one that is not theirs'
);
select throws_ok(
  $$ insert into public.recipe_ingredients (recipe_id, position, food_id, quantity, unit, portion_id, resolved_grams, snapshot) values ('28300000-0000-4000-8000-000000000401', 5, '28300000-0000-4000-8000-000000000101', 1, 'portion', '28300000-0000-4000-8000-0000000002b1', 30, '{"kind":"food"}') $$,
  '42501',
  'new row violates row-level security policy for table "recipe_ingredients"',
  'user A cannot use user B''s private portion'
);
select throws_ok(
  $$ insert into public.recipe_ingredients (recipe_id, position, food_id, quantity, unit, portion_id, resolved_grams, snapshot) values ('28300000-0000-4000-8000-000000000401', 5, '28300000-0000-4000-8000-000000000101', 1, 'portion', '28300000-0000-4000-8000-00000000dead', 30, '{"kind":"food"}') $$,
  '42501',
  'new row violates row-level security policy for table "recipe_ingredients"',
  'a portion that does not exist fails the same way as one that is not theirs'
);
select throws_ok(
  $$ insert into public.recipe_ingredients (recipe_id, position, food_id, quantity, unit, resolved_grams, snapshot) values ('28300000-0000-4000-8000-00000000dead', 5, '28300000-0000-4000-8000-000000000101', 50, 'g', 50, '{"kind":"food"}') $$,
  '42501',
  'new row violates row-level security policy for table "recipe_ingredients"',
  'a recipe that does not exist fails the same way as one that is not theirs'
);
select throws_ok(
  $$ insert into public.recipe_ingredients (recipe_id, position, food_id, quantity, unit, resolved_grams, snapshot) values ('28300000-0000-4000-8000-000000000401', 0, '28300000-0000-4000-8000-000000000101', 50, 'g', 50, '{"kind":"food"}') $$,
  '23505',
  'duplicate key value violates unique constraint "recipe_ingredients_recipe_id_position_key"',
  'two ingredients of one recipe cannot share a position'
);
select throws_ok(
  $$ insert into public.recipe_ingredients (id, recipe_id, position, food_id, quantity, unit, resolved_grams, snapshot) values ('28300000-0000-4000-8000-000000000599', '28300000-0000-4000-8000-000000000401', 9, '28300000-0000-4000-8000-000000000101', 50, 'g', 50, '{"kind":"food"}') $$,
  '42501',
  'permission denied for table recipe_ingredients',
  'user A cannot choose the id of an ingredient'
);
select throws_ok(
  $$ update public.recipe_ingredients set quantity = 5 where id = '28300000-0000-4000-8000-000000000501' $$,
  '42501',
  'permission denied for table recipe_ingredients',
  'user A cannot edit an ingredient in place'
);
select throws_ok(
  $$ update public.recipe_ingredients set snapshot = '{}' where id = '28300000-0000-4000-8000-000000000501' $$,
  '42501',
  'permission denied for table recipe_ingredients',
  'user A cannot rewrite the snapshot of an ingredient'
);

-- Bounds on the ingredient row.
select throws_ok(
  $$ insert into public.recipe_ingredients (recipe_id, position, food_id, quantity, unit, resolved_grams, snapshot) values ('28300000-0000-4000-8000-000000000401', -1, '28300000-0000-4000-8000-000000000101', 50, 'g', 50, '{"kind":"food"}') $$,
  '23514',
  'new row for relation "recipe_ingredients" violates check constraint "recipe_ingredients_position_check"',
  'a negative position is refused'
);
select throws_ok(
  $$ insert into public.recipe_ingredients (recipe_id, position, food_id, quantity, unit, resolved_grams, snapshot) values ('28300000-0000-4000-8000-000000000401', 6, '28300000-0000-4000-8000-000000000101', 0, 'g', 50, '{"kind":"food"}') $$,
  '23514',
  'new row for relation "recipe_ingredients" violates check constraint "recipe_ingredients_quantity_check"',
  'a quantity of 0 is refused'
);
select throws_ok(
  $$ insert into public.recipe_ingredients (recipe_id, position, food_id, quantity, unit, resolved_grams, snapshot) values ('28300000-0000-4000-8000-000000000401', 6, '28300000-0000-4000-8000-000000000101', 1, 'g', 0, '{"kind":"food"}') $$,
  '23514',
  'new row for relation "recipe_ingredients" violates check constraint "recipe_ingredients_resolved_grams_check"',
  'resolved_grams of 0 is refused'
);
select throws_ok(
  $$ insert into public.recipe_ingredients (recipe_id, position, food_id, quantity, unit, resolved_grams, snapshot) values ('28300000-0000-4000-8000-000000000401', 6, '28300000-0000-4000-8000-000000000101', 1, 'g', 100000.5, '{"kind":"food"}') $$,
  '23514',
  'new row for relation "recipe_ingredients" violates check constraint "recipe_ingredients_resolved_grams_check"',
  'resolved_grams over 100000 is refused'
);
select throws_ok(
  $$ insert into public.recipe_ingredients (recipe_id, position, food_id, quantity, unit, resolved_grams, snapshot) values ('28300000-0000-4000-8000-000000000401', 6, '28300000-0000-4000-8000-000000000101', 1, 'g', 1, '[]') $$,
  '23514',
  'new row for relation "recipe_ingredients" violates check constraint "recipe_ingredients_snapshot_is_object"',
  'a snapshot that is not an object is refused'
);

-- Delete: own ingredients only.
with removed as (
  delete from public.recipe_ingredients where id = '28300000-0000-4000-8000-0000000005b1' returning 1
)
select is((select count(*)::int from removed), 0, 'user A deletes none of user B''s ingredients');
with removed as (
  delete from public.recipe_ingredients where recipe_id = '28300000-0000-4000-8000-000000000401' and position >= 2 returning 1
)
select is((select count(*)::int from removed), 3, 'user A deletes their own ingredients');

-- Name search: a case-insensitive ilike on a word of the name finds the recipe, and only the caller's.
select is(
  (select array_agg(name) from public.recipes where name ilike '%A-STEW%'),
  array['key283-a-stew'],
  'a case-insensitive ilike on a word of the name finds the recipe'
);
select is(
  (select count(*)::int from public.recipes where name ilike '%curry%' and name like 'key283-%'),
  0,
  'the name search does not find user B''s recipe'
);

-- Log entries on recipes.
select lives_ok(
  $$ insert into public.food_log_entries (local_date, item_type, recipe_id, snapshot, nutrients) values ('2026-10-17', 'recipe', '28300000-0000-4000-8000-000000000401', '{"kind":"recipe"}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}') $$,
  'user A logs their own recipe'
);
select lives_ok(
  $$ insert into public.food_log_entries (local_date, item_type, recipe_id, snapshot, nutrients) values ('2026-10-17', 'recipe', '28300000-0000-4000-8000-000000000402', '{"kind":"recipe"}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}') $$,
  'user A logs their own archived recipe'
);
select throws_ok(
  $$ insert into public.food_log_entries (local_date, item_type, recipe_id, snapshot, nutrients) values ('2026-10-17', 'recipe', '28300000-0000-4000-8000-0000000004b1', '{"kind":"recipe"}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}') $$,
  '42501',
  'new row violates row-level security policy for table "food_log_entries"',
  'user A cannot log user B''s recipe'
);
select throws_ok(
  $$ insert into public.food_log_entries (local_date, item_type, recipe_id, snapshot, nutrients) values ('2026-10-17', 'recipe', '28300000-0000-4000-8000-00000000dead', '{"kind":"recipe"}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}') $$,
  '42501',
  'new row violates row-level security policy for table "food_log_entries"',
  'a recipe that does not exist fails the same way as one that is not theirs'
);
select throws_ok(
  $$ insert into public.food_log_entries (local_date, item_type, food_id, recipe_id, snapshot, nutrients) values ('2026-10-17', 'food', '28300000-0000-4000-8000-000000000101', '28300000-0000-4000-8000-000000000401', '{}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}') $$,
  '23514',
  'new row for relation "food_log_entries" violates check constraint "food_log_entries_item_type_ids"',
  'a food entry with a recipe_id of their own is still refused by the item type check'
);
select throws_ok(
  $$ insert into public.food_log_entries (local_date, item_type, recipe_id, snapshot, nutrients) values ('2026-10-17', 'quick', '28300000-0000-4000-8000-000000000401', '{}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}') $$,
  '23514',
  'new row for relation "food_log_entries" violates check constraint "food_log_entries_item_type_ids"',
  'a quick entry with a recipe_id of their own is still refused by the item type check'
);
select throws_ok(
  $$ insert into public.food_log_entries (local_date, item_type, snapshot, nutrients) values ('2026-10-17', 'recipe', '{}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}') $$,
  '23514',
  'new row for relation "food_log_entries" violates check constraint "food_log_entries_item_type_ids"',
  'a recipe entry without a recipe_id is still refused by the item type check'
);
select throws_ok(
  $$ insert into public.food_log_entries (local_date, item_type, food_id, recipe_id, snapshot, nutrients) values ('2026-10-17', 'recipe', '28300000-0000-4000-8000-000000000101', '28300000-0000-4000-8000-000000000401', '{}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}') $$,
  '23514',
  'new row for relation "food_log_entries" violates check constraint "food_log_entries_item_type_ids"',
  'a recipe entry with a food_id is still refused by the item type check'
);
select lives_ok(
  $$ insert into public.food_log_entries (local_date, item_type, food_id, snapshot, nutrients) values ('2026-10-17', 'food', '28300000-0000-4000-8000-000000000101', '{"kind":"food"}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}') $$,
  'a food entry with no recipe_id is unaffected'
);
select lives_ok(
  $$ insert into public.food_log_entries (local_date, item_type, snapshot, nutrients) values ('2026-10-17', 'quick', '{"kind":"quick"}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}') $$,
  'a quick entry with no recipe_id is unaffected'
);
select throws_ok(
  $$ update public.food_log_entries set recipe_id = '28300000-0000-4000-8000-000000000401' where id = '28300000-0000-4000-8000-0000000003a1' $$,
  '42501',
  'permission denied for table food_log_entries',
  'an entry never changes its recipe'
);
select is(
  (select count(*)::int from public.food_log_entries where recipe_id = '28300000-0000-4000-8000-000000000402'),
  2,
  'an archived recipe is still referenced by its entries'
);

-- Portion delete clears portion_id and keeps the ingredient (Amendment 2). User A owns the food.
select lives_ok(
  $$ delete from public.food_portions where id = '28300000-0000-4000-8000-0000000002a1' $$,
  'user A deletes the portion of their own food'
);
select is(
  (select portion_id is null from public.recipe_ingredients where id = '28300000-0000-4000-8000-000000000502'),
  true,
  'the ingredient that used the portion survives with no portion'
);

reset role;

-- A stray delete of a recipe that an entry points at is refused, and an unreferenced one is not.
select throws_ok(
  $$ delete from public.recipes where id = '28300000-0000-4000-8000-000000000402' $$,
  '23503',
  'update or delete on table "recipes" violates foreign key constraint "food_log_entries_recipe_id_fkey" on table "food_log_entries"',
  'a recipe that entries point at cannot be deleted'
);
select is(
  (select count(*)::int from public.recipes where id = '28300000-0000-4000-8000-000000000402'),
  1,
  'the recipe is still there'
);
select is(
  (select count(*)::int from public.recipe_ingredients where id = '28300000-0000-4000-8000-0000000005b1'),
  1,
  'user B''s ingredient was not deleted by user A'
);
select is(
  (select name from public.recipes where id = '28300000-0000-4000-8000-0000000004b1'),
  'key283-b-curry',
  'user B''s recipe was not renamed by user A'
);

-- User B: the other direction.
set local role authenticated;
set local request.jwt.claims = '{"sub":"28300000-0000-4000-8000-00000000000b","role":"authenticated"}';

select is(
  (select array_agg(name order by name) from public.recipes where name like 'key283-%'),
  array['key283-b-curry'],
  'user B sees only their own recipe'
);
select is(
  (select count(*)::int from public.recipe_ingredients where recipe_id = '28300000-0000-4000-8000-000000000401'),
  0,
  'user B sees none of user A''s ingredients'
);
select throws_ok(
  $$ insert into public.food_log_entries (local_date, item_type, recipe_id, snapshot, nutrients) values ('2026-10-17', 'recipe', '28300000-0000-4000-8000-000000000401', '{"kind":"recipe"}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}') $$,
  '42501',
  'new row violates row-level security policy for table "food_log_entries"',
  'user B cannot log user A''s recipe, so it can never block user A''s account deletion'
);

reset role;

-- save_recipe as user A: creating.
set local role authenticated;
set local request.jwt.claims = '{"sub":"28300000-0000-4000-8000-00000000000a","role":"authenticated"}';

select lives_ok(
  $$ select set_config('key283.saved_id', public.save_recipe(
       null,
       pg_temp.recipe('key283-saved', '["key283 first step", "key283 second step", "key283 third step"]')
         || '{"id":"28300000-0000-4000-8000-0000000004ee","owner_id":"28300000-0000-4000-8000-00000000000b","is_archived":true,"created_at":"2020-01-01T00:00:00Z","unknown":"ignored"}',
       jsonb_build_array(
         pg_temp.ingredient('28300000-0000-4000-8000-000000000101', 300) || '{"position":99,"owner_id":"28300000-0000-4000-8000-00000000000b","recipe_id":"28300000-0000-4000-8000-0000000004b1"}',
         pg_temp.ingredient('28300000-0000-4000-8000-0000000001a1', 150),
         pg_temp.ingredient('28300000-0000-4000-8000-000000000101', 40)
       )
     )::text, true) $$,
  'a new recipe is created'
);
select ok(
  current_setting('key283.saved_id')::uuid is distinct from '28300000-0000-4000-8000-0000000004ee'::uuid
    and exists (select 1 from public.recipes where id = current_setting('key283.saved_id')::uuid),
  'the database chooses the id of a new recipe, and any sent id is ignored'
);
select is(
  (select owner_id::text || '/' || is_archived::text from public.recipes where id = current_setting('key283.saved_id')::uuid),
  '28300000-0000-4000-8000-00000000000a/false',
  'the new recipe belongs to the caller and starts live whatever the payload says'
);
select is(
  (select name || '/' || servings::text || '/' || yield_grams::text from public.recipes where id = current_setting('key283.saved_id')::uuid),
  'key283-saved/2/500',
  'the name, servings and yield are stored'
);
select is(
  (select instructions from public.recipes where id = current_setting('key283.saved_id')::uuid),
  array['key283 first step', 'key283 second step', 'key283 third step'],
  'the steps are stored in order'
);
select is(
  (select computed from public.recipes where id = current_setting('key283.saved_id')::uuid),
  '{"total":{"kcal":null},"engineVersion":1}'::jsonb,
  'the computed cache is stored'
);
select is(
  (select array_agg(position::text || ':' || resolved_grams::text order by position) from public.recipe_ingredients where recipe_id = current_setting('key283.saved_id')::uuid),
  array['0:300', '1:150', '2:40'],
  'the ingredients are stored in the order sent, with the position taken from the index'
);
select is(
  (select count(*)::int from public.recipe_ingredients where recipe_id = current_setting('key283.saved_id')::uuid and owner_id = '28300000-0000-4000-8000-00000000000a'),
  3,
  'every ingredient belongs to the caller whatever the payload says'
);

-- Archived stays archived across a save.
update public.recipes set is_archived = true where id = current_setting('key283.saved_id')::uuid;

-- Updating.
select lives_ok(
  $$ select public.save_recipe(
       current_setting('key283.saved_id')::uuid,
       pg_temp.recipe('key283-saved-v2', '["key283 only step"]') || '{"servings":3,"yield_grams":null}',
       jsonb_build_array(pg_temp.ingredient('28300000-0000-4000-8000-000000000101', 75))
     ) $$,
  'a recipe is updated'
);
select is(
  (select name || '/' || servings::text || '/' || coalesce(yield_grams::text, 'null') || '/' || is_archived::text from public.recipes where id = current_setting('key283.saved_id')::uuid),
  'key283-saved-v2/3/null/true',
  'the update replaces the name, servings and yield, and leaves is_archived alone'
);
select is(
  (select instructions from public.recipes where id = current_setting('key283.saved_id')::uuid),
  array['key283 only step'],
  'the update replaces the steps'
);
select is(
  (select array_agg(position::text || ':' || resolved_grams::text order by position) from public.recipe_ingredients where recipe_id = current_setting('key283.saved_id')::uuid),
  array['0:75'],
  'the update replaces the ingredients'
);

-- Reordering steps and ingredients is stored in the new order.
select lives_ok(
  $$ select public.save_recipe(
       current_setting('key283.saved_id')::uuid,
       pg_temp.recipe('key283-saved-v3', '["key283 step c", "key283 step a", "key283 step b"]'),
       jsonb_build_array(
         pg_temp.ingredient('28300000-0000-4000-8000-0000000001a1', 20),
         pg_temp.ingredient('28300000-0000-4000-8000-000000000101', 10),
         pg_temp.ingredient('28300000-0000-4000-8000-000000000101', 30)
       )
     ) $$,
  'steps and ingredients are reordered'
);
select is(
  (select instructions from public.recipes where id = current_setting('key283.saved_id')::uuid),
  array['key283 step c', 'key283 step a', 'key283 step b'],
  'the steps are stored in the new order'
);
select is(
  (select array_agg(resolved_grams::text order by position) from public.recipe_ingredients where recipe_id = current_setting('key283.saved_id')::uuid),
  array['20', '10', '30'],
  'the ingredients are stored in the new order'
);

-- Atomic: an ingredient of a food the caller cannot see leaves the previous recipe untouched.
select throws_ok(
  $$ select public.save_recipe(
       current_setting('key283.saved_id')::uuid,
       pg_temp.recipe('key283-saved-should-not-stick', '["key283 lost step"]'),
       jsonb_build_array(
         pg_temp.ingredient('28300000-0000-4000-8000-000000000101', 5),
         pg_temp.ingredient('28300000-0000-4000-8000-0000000001b1', 5)
       )
     ) $$,
  '42501',
  'new row violates row-level security policy for table "recipe_ingredients"',
  'an ingredient of user B''s private food fails the save'
);
select throws_ok(
  $$ select public.save_recipe(
       current_setting('key283.saved_id')::uuid,
       pg_temp.recipe('key283-saved-should-not-stick', '["key283 lost step"]'),
       jsonb_build_array(
         pg_temp.ingredient('28300000-0000-4000-8000-000000000101', 5),
         pg_temp.ingredient('28300000-0000-4000-8000-00000000dead', 5)
       )
     ) $$,
  '42501',
  'new row violates row-level security policy for table "recipe_ingredients"',
  'an ingredient of an unknown food fails the save'
);
select throws_ok(
  $$ select public.save_recipe(
       current_setting('key283.saved_id')::uuid,
       pg_temp.recipe('key283-saved-should-not-stick', '["key283 lost step"]'),
       jsonb_build_array(
         pg_temp.ingredient('28300000-0000-4000-8000-000000000101', 5),
         pg_temp.ingredient('28300000-0000-4000-8000-000000000101', 5) - 'unit'
       )
     ) $$,
  '23502',
  'null value in column "unit" of relation "recipe_ingredients" violates not-null constraint',
  'an ingredient without a unit fails the save after the first one was inserted'
);
select is(
  (select name from public.recipes where id = current_setting('key283.saved_id')::uuid)
    || '/' || (select array_to_string(instructions, ',') from public.recipes where id = current_setting('key283.saved_id')::uuid),
  'key283-saved-v3/key283 step c,key283 step a,key283 step b',
  'after the failed saves the name and the steps are as before'
);
select is(
  (select array_agg(resolved_grams::text order by position) from public.recipe_ingredients where recipe_id = current_setting('key283.saved_id')::uuid),
  array['20', '10', '30'],
  'after the failed saves the previous ingredients are in place'
);

-- A recipe that is not the caller's, or does not exist, raises P0002 and writes nothing.
select throws_ok(
  $$ select public.save_recipe('28300000-0000-4000-8000-0000000004b1', pg_temp.recipe('key283-taken-over'), jsonb_build_array(pg_temp.ingredient('28300000-0000-4000-8000-000000000101', 5))) $$,
  'P0002',
  'the recipe does not exist or is not yours',
  'user A cannot save over user B''s recipe'
);
select throws_ok(
  $$ select public.save_recipe('28300000-0000-4000-8000-00000000dead', pg_temp.recipe('key283-ghost'), '[]') $$,
  'P0002',
  'the recipe does not exist or is not yours',
  'a recipe that does not exist fails the same way as one that is not theirs'
);
select is(
  (select count(*)::int from public.recipes where name in ('key283-taken-over', 'key283-ghost')),
  0,
  'the refused saves created nothing'
);

-- Refusals, each with 22023 and a message that states the rule and quotes no value.
select throws_ok(
  $$ select public.save_recipe(null, '[]', '[]') $$,
  '22023', 'save_recipe needs the recipe as a JSON object', 'a recipe that is an array is refused'
);
select throws_ok(
  $$ select public.save_recipe(null, null, '[]') $$,
  '22023', 'save_recipe needs the recipe as a JSON object', 'a null recipe is refused'
);
select throws_ok(
  $$ select public.save_recipe(null, '"key283-text"', '[]') $$,
  '22023', 'save_recipe needs the recipe as a JSON object', 'a recipe that is text is refused'
);
select throws_ok(
  $$ select public.save_recipe(null, pg_temp.recipe('key283-refused'), '{}') $$,
  '22023', 'save_recipe needs the ingredients as a JSON array', 'ingredients that are an object are refused'
);
select throws_ok(
  $$ select public.save_recipe(null, pg_temp.recipe('key283-refused'), null) $$,
  '22023', 'save_recipe needs the ingredients as a JSON array', 'null ingredients are refused'
);
select throws_ok(
  $$ select public.save_recipe(null, pg_temp.recipe('key283-refused'), '["key283-text"]') $$,
  '22023', 'every ingredient must be a JSON object', 'an ingredient that is text is refused'
);
select throws_ok(
  $$ select public.save_recipe(null, pg_temp.recipe('key283-refused'), '[null]') $$,
  '22023', 'every ingredient must be a JSON object', 'a null ingredient is refused'
);
select throws_ok(
  $$ select public.save_recipe(null, pg_temp.recipe('key283-refused'), (select jsonb_agg(pg_temp.ingredient('28300000-0000-4000-8000-000000000101')) from generate_series(1, 101))) $$,
  '22023', 'a recipe has at most 100 ingredients', '101 ingredients are refused'
);
select throws_ok(
  $$ select public.save_recipe(null, pg_temp.recipe('key283-refused') - 'computed', '[]') $$,
  '22023', 'the computed cache must be a JSON object', 'a recipe with no computed cache is refused'
);
select throws_ok(
  $$ select public.save_recipe(null, pg_temp.recipe('key283-refused') || '{"computed":[]}', '[]') $$,
  '22023', 'the computed cache must be a JSON object', 'a computed cache that is an array is refused'
);
select throws_ok(
  $$ select public.save_recipe(null, pg_temp.recipe('key283-refused') || '{"name":7}', '[]') $$,
  '22023', 'the recipe name must be text', 'a name that is a number is refused'
);
select throws_ok(
  $$ select public.save_recipe(null, pg_temp.recipe('key283-refused') - 'name', '[]') $$,
  '22023', 'the recipe name must be text', 'a recipe with no name is refused'
);
select throws_ok(
  $$ select public.save_recipe(null, pg_temp.recipe('   '), '[]') $$,
  '22023', 'the recipe name must not be blank', 'a blank name is refused'
);
select throws_ok(
  $$ select public.save_recipe(null, pg_temp.recipe(repeat('n', 201)), '[]') $$,
  '22023', 'the recipe name has at most 200 characters', 'a name of 201 characters is refused'
);
select throws_ok(
  $$ select public.save_recipe(null, pg_temp.recipe('key283-refused') || '{"servings":"2"}', '[]') $$,
  '22023', 'the servings must be a number', 'servings sent as text are refused'
);
select throws_ok(
  $$ select public.save_recipe(null, pg_temp.recipe('key283-refused') || '{"servings":0}', '[]') $$,
  '22023', 'the servings must be more than 0 and at most 1000', '0 servings are refused'
);
select throws_ok(
  $$ select public.save_recipe(null, pg_temp.recipe('key283-refused') || '{"servings":1001}', '[]') $$,
  '22023', 'the servings must be more than 0 and at most 1000', '1001 servings are refused'
);
select throws_ok(
  $$ select public.save_recipe(null, pg_temp.recipe('key283-refused') || '{"yield_grams":"500"}', '[]') $$,
  '22023', 'the yield must be a number or null', 'a yield sent as text is refused'
);
select throws_ok(
  $$ select public.save_recipe(null, pg_temp.recipe('key283-refused') || '{"yield_grams":0}', '[]') $$,
  '22023', 'the yield must be more than 0 and at most 100000', 'a yield of 0 is refused'
);
select throws_ok(
  $$ select public.save_recipe(null, pg_temp.recipe('key283-refused') || '{"yield_grams":100001}', '[]') $$,
  '22023', 'the yield must be more than 0 and at most 100000', 'a yield over 100000 is refused'
);
select throws_ok(
  $$ select public.save_recipe(null, pg_temp.recipe('key283-refused') - 'instructions', '[]') $$,
  '22023', 'the instructions must be a JSON array of text', 'a recipe with no instructions key is refused'
);
select throws_ok(
  $$ select public.save_recipe(null, pg_temp.recipe('key283-refused', '"one step"'), '[]') $$,
  '22023', 'the instructions must be a JSON array of text', 'instructions that are text are refused'
);
select throws_ok(
  $$ select public.save_recipe(null, pg_temp.recipe('key283-refused', (select jsonb_agg('key283 step'::text) from generate_series(1, 51))), '[]') $$,
  '22023', 'a recipe has at most 50 steps', '51 steps are refused'
);
select throws_ok(
  $$ select public.save_recipe(null, pg_temp.recipe('key283-refused', '["key283 step", null]'), '[]') $$,
  '22023', 'every step must be text', 'a null step is refused'
);
select throws_ok(
  $$ select public.save_recipe(null, pg_temp.recipe('key283-refused', '["key283 step", 4]'), '[]') $$,
  '22023', 'every step must be text', 'a step that is a number is refused'
);
select throws_ok(
  $$ select public.save_recipe(null, pg_temp.recipe('key283-refused', '["key283 step", "   "]'), '[]') $$,
  '22023', 'a step must not be blank', 'a step of spaces is refused, not dropped'
);
select throws_ok(
  $$ select public.save_recipe(null, pg_temp.recipe('key283-refused', '["key283 step", ""]'), '[]') $$,
  '22023', 'a step must not be blank', 'an empty step is refused'
);
select throws_ok(
  $$ select public.save_recipe(null, pg_temp.recipe('key283-refused', jsonb_build_array('key283 step', E'\t \n')), '[]') $$,
  '22023', 'a step must not be blank', 'a step of a tab and a new line is refused'
);
select throws_ok(
  $$ select public.save_recipe(null, pg_temp.recipe('key283-refused', jsonb_build_array(repeat('s', 1001))), '[]') $$,
  '22023', 'a step has at most 1000 characters', 'a step of 1001 characters is refused'
);
select is(
  (select count(*)::int from public.recipes where name = 'key283-refused'),
  0,
  'no refused save created a recipe'
);

-- The limits themselves are accepted: 100 ingredients, 50 steps of 1000 characters.
select lives_ok(
  $$ select set_config('key283.full_id', public.save_recipe(
       null,
       pg_temp.recipe('key283-full', (select jsonb_agg(repeat('s', 1000)) from generate_series(1, 50))),
       (select jsonb_agg(pg_temp.ingredient('28300000-0000-4000-8000-000000000101', 1)) from generate_series(1, 100))
     )::text, true) $$,
  'a recipe with 100 ingredients and 50 steps of 1000 characters is saved'
);
select is(
  (select count(*)::int from public.recipe_ingredients where recipe_id = current_setting('key283.full_id')::uuid)
    || '/' || (select cardinality(instructions) from public.recipes where id = current_setting('key283.full_id')::uuid),
  '100/50',
  'all of them are stored'
);
select lives_ok(
  $$ select public.save_recipe(null, pg_temp.recipe('key283-empty', '[]'), '[]') $$,
  'a recipe with no ingredients and no steps is saved'
);

reset role;

select is(
  (select count(*)::int from public.recipe_ingredients where recipe_id = '28300000-0000-4000-8000-0000000004b1'),
  1,
  'a recipe_id in an ingredient is ignored, so user B''s recipe gained no ingredient'
);

-- Account deletion on the real tables. A throwaway user with a custom food and a portion, a recipe
-- with ingredients (one on the custom food), a recipe log entry and a food entry on the custom
-- food. Deleting the auth user must succeed and leave none of it.
insert into public.recipe_ingredients (id, recipe_id, owner_id, position, food_id, quantity, unit, portion_id, resolved_grams, snapshot) values
  ('28300000-0000-4000-8000-0000000005c1', '28300000-0000-4000-8000-0000000004c1', '28300000-0000-4000-8000-00000000000c', 0, '28300000-0000-4000-8000-000000000101', 100, 'g', null, 100, '{"kind":"food"}'),
  ('28300000-0000-4000-8000-0000000005c2', '28300000-0000-4000-8000-0000000004c1', '28300000-0000-4000-8000-00000000000c', 1, '28300000-0000-4000-8000-0000000001c1', 1, 'portion', '28300000-0000-4000-8000-0000000002c1', 30, '{"kind":"food"}');

insert into public.food_log_entries (id, user_id, local_date, item_type, food_id, recipe_id, portion_id, snapshot, nutrients) values
  ('28300000-0000-4000-8000-0000000003c1', '28300000-0000-4000-8000-00000000000c', '2026-10-17', 'recipe', null, '28300000-0000-4000-8000-0000000004c1', null, '{"kind":"recipe"}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}'),
  ('28300000-0000-4000-8000-0000000003c2', '28300000-0000-4000-8000-00000000000c', '2026-10-17', 'food', '28300000-0000-4000-8000-0000000001c1', null, '28300000-0000-4000-8000-0000000002c1', '{"kind":"food"}', '{"kcal":1,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}');

select lives_ok(
  $$ delete from auth.users where id = '28300000-0000-4000-8000-00000000000c' $$,
  'deleting an auth user with recipes, ingredients, recipe entries and an entry on their custom food succeeds'
);
select is(
  (select count(*)::int from public.recipes where owner_id = '28300000-0000-4000-8000-00000000000c')
  || '/' || (select count(*)::int from public.recipe_ingredients where owner_id = '28300000-0000-4000-8000-00000000000c')
  || '/' || (select count(*)::int from public.food_log_entries where user_id = '28300000-0000-4000-8000-00000000000c')
  || '/' || (select count(*)::int from public.foods where owner_id = '28300000-0000-4000-8000-00000000000c')
  || '/' || (select count(*)::int from public.food_portions where owner_id = '28300000-0000-4000-8000-00000000000c'),
  '0/0/0/0/0',
  'the recipes, ingredients, entries, foods and portions of the deleted user are gone'
);
select is(
  (select count(*)::int from public.recipes where id = '28300000-0000-4000-8000-0000000004c1'),
  0,
  'the recipe is gone'
);

select * from finish();

rollback;
