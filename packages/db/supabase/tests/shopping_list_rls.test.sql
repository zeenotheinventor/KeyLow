-- Asserts the shopping list (ADR 0003, Amendment 15): the table, its checks, indexes and exact
-- privileges, owner-only row level security, the food visibility check on insert, the cascade from
-- the account, the delete of a food, and public.save_shopping_items (every refusal, a merge and new
-- rows in one call, and that a failure leaves nothing written).
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so
-- nothing created here persists. Every fixture id starts with 29103000 and every name and email
-- with shop29-, so the rows are recognisable as this file's, and nothing asserts a whole-table
-- count. Each actor is entered with `set local role` plus the JWT claims that `auth.uid()` reads,
-- and left with `reset role`.
--
-- Health data: no assertion or fixture here is a real list, and the refusal messages asserted
-- below state a rule and never a value.

begin;

select plan(81);

-- Three users. The on_auth_user_created trigger creates their profiles rows. C is the throwaway
-- user whose account is deleted at the end.
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '29103000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'shop29-user-a@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '29103000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'shop29-user-b@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '29103000-0000-4000-8000-00000000000c', 'authenticated', 'authenticated', 'shop29-user-c@keylow.test');

-- Fixtures, inserted as postgres so row level security does not apply: a global food, a private food
-- for A, B and C, and an item on each list.
insert into public.foods (id, source, source_ref, owner_id, name, basis) values
  ('29103000-0000-4000-8000-000000000101', 'cofid', 'SHOP29-FOOD-1', null, 'shop29-global-rice', 'per_100g'),
  ('29103000-0000-4000-8000-0000000001a1', 'user', null, '29103000-0000-4000-8000-00000000000a', 'shop29-a-private-food', 'per_100g'),
  ('29103000-0000-4000-8000-0000000001b1', 'user', null, '29103000-0000-4000-8000-00000000000b', 'shop29-b-private-food', 'per_100g'),
  ('29103000-0000-4000-8000-0000000001c1', 'user', null, '29103000-0000-4000-8000-00000000000c', 'shop29-c-private-food', 'per_100g');

insert into public.shopping_list_items (id, owner_id, food_id, name, grams, position) values
  ('29103000-0000-4000-8000-0000000002a1', '29103000-0000-4000-8000-00000000000a', '29103000-0000-4000-8000-000000000101', 'shop29-a-rice', 300, 0),
  ('29103000-0000-4000-8000-0000000002b1', '29103000-0000-4000-8000-00000000000b', '29103000-0000-4000-8000-0000000001b1', 'shop29-b-item', 100, 0),
  ('29103000-0000-4000-8000-0000000002c1', '29103000-0000-4000-8000-00000000000c', '29103000-0000-4000-8000-0000000001c1', 'shop29-c-item', 100, 0);

-- An item as save_shopping_items takes it. It lives in the temporary schema, so nothing persists,
-- and is callable under the API roles.
create function pg_temp.item(
  item_id uuid,
  item_name text,
  food uuid default null,
  grams numeric default null,
  item_position integer default 0
)
returns jsonb language sql as $$
  select jsonb_build_object(
    'id', item_id, 'food_id', food, 'name', item_name, 'grams', grams, 'portion_label', null,
    'portion_count', null, 'sources', '[]'::jsonb, 'position', item_position, 'checked_at', null
  )
$$;

-- Shape.
select has_table('public', 'shopping_list_items', 'shopping_list_items exists');
select col_has_default('public', 'shopping_list_items', 'owner_id', 'owner_id defaults to the caller');
select col_is_null('public', 'shopping_list_items', 'food_id', 'food_id is nullable, for an item typed by hand');
select col_is_null('public', 'shopping_list_items', 'grams', 'grams is nullable');
select col_is_null('public', 'shopping_list_items', 'checked_at', 'checked_at is nullable');
select col_not_null('public', 'shopping_list_items', 'sources', 'sources is not null');
select is(
  (select pg_get_expr(adbin, adrelid) from pg_attrdef where adrelid = 'public.shopping_list_items'::regclass and adnum = (select attnum from pg_attribute where attrelid = 'public.shopping_list_items'::regclass and attname = 'sources')),
  '''[]''::jsonb',
  'sources defaults to an empty array'
);
select col_not_null('public', 'shopping_list_items', 'position', 'position is not null');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.shopping_list_items'::regclass),
  'row level security is enabled on shopping_list_items'
);

-- Foreign keys: the delete rule of each.
select is(
  (select confdeltype::text from pg_constraint where conrelid = 'public.shopping_list_items'::regclass and contype = 'f' and confrelid = 'auth.users'::regclass),
  'c',
  'deleting the owner deletes their items'
);
select is(
  (select confdeltype::text from pg_constraint where conrelid = 'public.shopping_list_items'::regclass and contype = 'f' and confrelid = 'public.foods'::regclass),
  'n',
  'deleting a food sets the item food_id to null'
);

-- Indexes.
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'shopping_list_items' and indexdef like '%(owner_id, "position")'),
  'there is an index on shopping_list_items (owner_id, position)'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'shopping_list_items' and indexdef like '%(food_id)' and indexdef not like 'CREATE UNIQUE%'),
  'there is a plain index on shopping_list_items.food_id'
);

-- Privileges. anon and service_role hold nothing at all, on the table or a column.
select ok(
  not has_any_column_privilege('anon', 'public.shopping_list_items', 'select,insert,update,references')
    and not has_table_privilege('anon', 'public.shopping_list_items', 'delete,truncate,trigger'),
  'anon has no privilege on shopping_list_items'
);
select ok(
  not has_any_column_privilege('service_role', 'public.shopping_list_items', 'select,insert,update,references')
    and not has_table_privilege('service_role', 'public.shopping_list_items', 'delete,truncate,trigger'),
  'service_role has no privilege on shopping_list_items'
);
select is(
  (select array_agg(privilege_type::text order by privilege_type::text) from information_schema.table_privileges where table_schema = 'public' and table_name = 'shopping_list_items' and grantee = 'authenticated'),
  array['DELETE', 'SELECT'],
  'authenticated holds select and delete on shopping_list_items as a table'
);
select is(
  (select array_agg(column_name::text order by column_name::text collate "C") from information_schema.column_privileges where table_schema = 'public' and table_name = 'shopping_list_items' and grantee = 'authenticated' and privilege_type = 'INSERT'),
  array['checked_at', 'food_id', 'grams', 'id', 'name', 'owner_id', 'portion_count', 'portion_label', 'position', 'sources'],
  'authenticated can insert exactly these columns of shopping_list_items'
);
select is(
  (select array_agg(column_name::text order by column_name::text collate "C") from information_schema.column_privileges where table_schema = 'public' and table_name = 'shopping_list_items' and grantee = 'authenticated' and privilege_type = 'UPDATE'),
  array['checked_at', 'grams', 'name', 'portion_count', 'portion_label', 'position', 'sources'],
  'authenticated can update exactly these columns of shopping_list_items'
);

-- Policies, as predicates.
select is(
  (select array_agg(policyname || ':' || cmd || ':' || roles::text order by policyname) from pg_policies where schemaname = 'public' and tablename = 'shopping_list_items'),
  array['shopping_list_items_delete_own:DELETE:{authenticated}', 'shopping_list_items_insert_own:INSERT:{authenticated}', 'shopping_list_items_select_own:SELECT:{authenticated}', 'shopping_list_items_update_own:UPDATE:{authenticated}'],
  'shopping_list_items has exactly an owner-only select, insert, update and delete policy'
);
select ok(
  (select qual like '%SELECT auth.uid() AS uid%' from pg_policies where tablename = 'shopping_list_items' and policyname = 'shopping_list_items_select_own')
    and (select with_check like '%SELECT auth.uid() AS uid%' from pg_policies where tablename = 'shopping_list_items' and policyname = 'shopping_list_items_insert_own')
    and (select qual like '%SELECT auth.uid() AS uid%' and with_check like '%SELECT auth.uid() AS uid%' from pg_policies where tablename = 'shopping_list_items' and policyname = 'shopping_list_items_update_own')
    and (select qual like '%SELECT auth.uid() AS uid%' from pg_policies where tablename = 'shopping_list_items' and policyname = 'shopping_list_items_delete_own'),
  'the shopping list policies evaluate auth.uid() once per statement'
);
select ok(
  (select with_check like '%foods%' from pg_policies where tablename = 'shopping_list_items' and policyname = 'shopping_list_items_insert_own'),
  'the insert policy checks the food'
);

-- save_shopping_items: security invoker, a fixed search path, and execute for authenticated alone.
select ok(
  (select not prosecdef and provolatile = 'v' from pg_proc where oid = 'public.save_shopping_items(jsonb)'::regprocedure),
  'save_shopping_items is security invoker and volatile'
);
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc where oid = 'public.save_shopping_items(jsonb)'::regprocedure),
  'save_shopping_items has an empty search_path'
);
select ok(
  has_function_privilege('authenticated', 'public.save_shopping_items(jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.save_shopping_items(jsonb)', 'execute')
    and not has_function_privilege('service_role', 'public.save_shopping_items(jsonb)', 'execute')
    and (select not exists (select 1 from aclexplode(proacl) as privilege where privilege.grantee = 0) from pg_proc where oid = 'public.save_shopping_items(jsonb)'::regprocedure),
  'only authenticated can execute save_shopping_items, and public cannot'
);

-- Anon.
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  $$ select * from public.shopping_list_items $$,
  '42501',
  'permission denied for table shopping_list_items',
  'anon cannot select from shopping_list_items'
);
select throws_ok(
  $$ insert into public.shopping_list_items (name, position) values ('shop29-anon', 0) $$,
  '42501',
  'permission denied for table shopping_list_items',
  'anon cannot insert into shopping_list_items'
);
select throws_ok(
  $$ select public.save_shopping_items('[]') $$,
  '42501',
  'permission denied for function save_shopping_items',
  'anon cannot call save_shopping_items'
);

reset role;

-- service_role.
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';

select throws_ok(
  $$ select * from public.shopping_list_items $$,
  '42501',
  'permission denied for table shopping_list_items',
  'service_role cannot select from shopping_list_items'
);
select throws_ok(
  $$ select public.save_shopping_items('[]') $$,
  '42501',
  'permission denied for function save_shopping_items',
  'service_role cannot call save_shopping_items'
);

reset role;

-- User A: owner-only reads.
set local role authenticated;
set local request.jwt.claims = '{"sub":"29103000-0000-4000-8000-00000000000a","role":"authenticated"}';

select is(
  (select array_agg(name order by name) from public.shopping_list_items where name like 'shop29-%'),
  array['shop29-a-rice'],
  'user A sees their own item and none of the others'
);

-- User A: inserting items.
select lives_ok(
  $$ insert into public.shopping_list_items (name, position) values ('shop29-a-typed', 1) $$,
  'user A types an item without sending owner_id or a food'
);
select is(
  (select owner_id::text || '/' || sources::text || '/' || (checked_at is null)::text from public.shopping_list_items where name = 'shop29-a-typed'),
  '29103000-0000-4000-8000-00000000000a/[]/true',
  'owner_id defaults to the caller, sources to an empty array, and a new item is still to buy'
);
select lives_ok(
  $$ insert into public.shopping_list_items (food_id, name, grams, position) values ('29103000-0000-4000-8000-0000000001a1', 'shop29-a-own-food', 50, 2) $$,
  'user A adds an item of their own food'
);
select throws_ok(
  $$ insert into public.shopping_list_items (food_id, name, grams, position) values ('29103000-0000-4000-8000-0000000001b1', 'shop29-a-b-food', 50, 3) $$,
  '42501',
  'new row violates row-level security policy for table "shopping_list_items"',
  'user A cannot add an item of user B''s private food'
);
select throws_ok(
  $$ insert into public.shopping_list_items (food_id, name, grams, position) values ('29103000-0000-4000-8000-00000000dead', 'shop29-a-no-food', 50, 3) $$,
  '42501',
  'new row violates row-level security policy for table "shopping_list_items"',
  'a food that does not exist fails the same way as one that is not theirs'
);
select throws_ok(
  $$ insert into public.shopping_list_items (owner_id, name, position) values ('29103000-0000-4000-8000-00000000000b', 'shop29-a-for-b', 3) $$,
  '42501',
  'new row violates row-level security policy for table "shopping_list_items"',
  'user A cannot add an item to user B''s list'
);
select throws_ok(
  $$ insert into public.shopping_list_items (name, position, created_at) values ('shop29-a-dated', 3, '2020-01-01') $$,
  '42501',
  'permission denied for table shopping_list_items',
  'user A cannot choose created_at'
);

-- User A: bounds on the row.
select lives_ok(
  format($$ insert into public.shopping_list_items (name, grams, portion_label, portion_count, sources, position) values (%L, 100000, %L, 10000, %L, 0) $$,
    'shop29-edge-' || repeat('n', 188), repeat('p', 200), (select jsonb_agg(jsonb_build_object('recipeId', gen_random_uuid(), 'name', 'shop29')) from generate_series(1, 50))),
  'a name and a portion of 200 characters, 100000 g, a count of 10000 and 50 sources are accepted'
);
select throws_ok(
  $$ insert into public.shopping_list_items (name, position) values (E' \t\n', 0) $$,
  '23514',
  'new row for relation "shopping_list_items" violates check constraint "shopping_list_items_name_not_blank"',
  'a blank name is refused'
);
select throws_ok(
  format($$ insert into public.shopping_list_items (name, position) values (%L, 0) $$, repeat('n', 201)),
  '23514',
  'new row for relation "shopping_list_items" violates check constraint "shopping_list_items_name_length_check"',
  'a name of 201 characters is refused'
);
select throws_ok(
  $$ insert into public.shopping_list_items (name, grams, position) values ('shop29-zero-grams', 0, 0) $$,
  '23514',
  'new row for relation "shopping_list_items" violates check constraint "shopping_list_items_grams_check"',
  '0 g is refused'
);
select throws_ok(
  $$ insert into public.shopping_list_items (name, grams, position) values ('shop29-many-grams', 100000.5, 0) $$,
  '23514',
  'new row for relation "shopping_list_items" violates check constraint "shopping_list_items_grams_check"',
  'more than 100000 g is refused'
);
select throws_ok(
  $$ insert into public.shopping_list_items (name, portion_label, position) values ('shop29-label-alone', '1 medium', 0) $$,
  '23514',
  'new row for relation "shopping_list_items" violates check constraint "shopping_list_items_portion_paired"',
  'a portion label without a count is refused'
);
select throws_ok(
  $$ insert into public.shopping_list_items (name, portion_count, position) values ('shop29-count-alone', 2, 0) $$,
  '23514',
  'new row for relation "shopping_list_items" violates check constraint "shopping_list_items_portion_paired"',
  'a count without a portion label is refused'
);
select throws_ok(
  $$ insert into public.shopping_list_items (name, portion_label, portion_count, position) values ('shop29-blank-label', '  ', 2, 0) $$,
  '23514',
  'new row for relation "shopping_list_items" violates check constraint "shopping_list_items_portion_label_check"',
  'a blank portion label is refused'
);
select throws_ok(
  format($$ insert into public.shopping_list_items (name, portion_label, portion_count, position) values ('shop29-long-label', %L, 2, 0) $$, repeat('p', 201)),
  '23514',
  'new row for relation "shopping_list_items" violates check constraint "shopping_list_items_portion_label_check"',
  'a portion label of 201 characters is refused'
);
select throws_ok(
  $$ insert into public.shopping_list_items (name, portion_label, portion_count, position) values ('shop29-zero-count', '1 medium', 0, 0) $$,
  '23514',
  'new row for relation "shopping_list_items" violates check constraint "shopping_list_items_portion_count_check"',
  'a count of 0 is refused'
);
select throws_ok(
  $$ insert into public.shopping_list_items (name, portion_label, portion_count, position) values ('shop29-huge-count', '1 medium', 10000.5, 0) $$,
  '23514',
  'new row for relation "shopping_list_items" violates check constraint "shopping_list_items_portion_count_check"',
  'a count over 10000 is refused'
);
select throws_ok(
  $$ insert into public.shopping_list_items (name, sources, position) values ('shop29-object-sources', '{}', 0) $$,
  '23514',
  'new row for relation "shopping_list_items" violates check constraint "shopping_list_items_sources_check"',
  'sources that are not an array are refused'
);
select throws_ok(
  format($$ insert into public.shopping_list_items (name, sources, position) values ('shop29-51-sources', %L, 0) $$,
    (select jsonb_agg(jsonb_build_object('recipeId', gen_random_uuid(), 'name', 'shop29')) from generate_series(1, 51))),
  '23514',
  'new row for relation "shopping_list_items" violates check constraint "shopping_list_items_sources_check"',
  '51 sources are refused'
);
select throws_ok(
  $$ insert into public.shopping_list_items (name, position) values ('shop29-negative-position', -1) $$,
  '23514',
  'new row for relation "shopping_list_items" violates check constraint "shopping_list_items_position_check"',
  'a negative position is refused'
);

-- User A: ticking, the closed columns, and another user's rows.
select lives_ok(
  $$ update public.shopping_list_items set checked_at = now() where id = '29103000-0000-4000-8000-0000000002a1' $$,
  'user A ticks their own item'
);
select is(
  (select checked_at is not null from public.shopping_list_items where id = '29103000-0000-4000-8000-0000000002a1'),
  true,
  'the item is ticked'
);
select lives_ok(
  $$ update public.shopping_list_items set checked_at = null where id = '29103000-0000-4000-8000-0000000002a1' $$,
  'user A unticks it'
);
select throws_ok(
  $$ update public.shopping_list_items set owner_id = '29103000-0000-4000-8000-00000000000b' where id = '29103000-0000-4000-8000-0000000002a1' $$,
  '42501',
  'permission denied for table shopping_list_items',
  'user A cannot hand an item to user B'
);
select throws_ok(
  $$ update public.shopping_list_items set food_id = '29103000-0000-4000-8000-0000000001a1' where id = '29103000-0000-4000-8000-0000000002a1' $$,
  '42501',
  'permission denied for table shopping_list_items',
  'user A cannot change the food of an item'
);
select throws_ok(
  $$ update public.shopping_list_items set id = '29103000-0000-4000-8000-0000000002ff' where id = '29103000-0000-4000-8000-0000000002a1' $$,
  '42501',
  'permission denied for table shopping_list_items',
  'user A cannot change the id of an item'
);
with changed as (
  update public.shopping_list_items set checked_at = now() where id = '29103000-0000-4000-8000-0000000002b1' returning 1
)
select is((select count(*)::int from changed), 0, 'user A ticks none of user B''s items');
with removed as (
  delete from public.shopping_list_items where id = '29103000-0000-4000-8000-0000000002b1' returning 1
)
select is((select count(*)::int from removed), 0, 'user A deletes none of user B''s items');
with removed as (
  delete from public.shopping_list_items where name = 'shop29-a-typed' returning 1
)
select is((select count(*)::int from removed), 1, 'user A deletes their own item');

-- save_shopping_items: refusals of the input's shape.
select throws_ok(
  $$ select public.save_shopping_items('{}') $$,
  '22023',
  'save_shopping_items needs the items as a JSON array',
  'an object in place of the array is refused'
);
select throws_ok(
  $$ select public.save_shopping_items('[1]') $$,
  '22023',
  'every item must be a JSON object',
  'an item that is not an object is refused'
);
select throws_ok(
  $$ select public.save_shopping_items((select jsonb_agg(pg_temp.item(null, 'shop29-bulk')) from generate_series(1, 501))) $$,
  '22023',
  'a call writes at most 500 items',
  '501 items are refused'
);
select lives_ok(
  $$ select public.save_shopping_items('[]') $$,
  'an empty array writes nothing and succeeds'
);

-- save_shopping_items: a merge into an open row and a new row, in one call.
select lives_ok(
  $$ select public.save_shopping_items(jsonb_build_array(
       jsonb_build_object(
         'id', '29103000-0000-4000-8000-0000000002a1', 'food_id', '29103000-0000-4000-8000-000000000101',
         'name', 'shop29-a-rice', 'grams', 450, 'portion_label', null, 'portion_count', null,
         'sources', jsonb_build_array(jsonb_build_object('recipeId', '29103000-0000-4000-8000-000000000301', 'name', 'shop29-recipe')),
         'position', 0, 'checked_at', null, 'owner_id', '29103000-0000-4000-8000-00000000000b'
       ),
       pg_temp.item(null, 'shop29-a-new', '29103000-0000-4000-8000-000000000101', 200, 5)
     )) $$,
  'user A merges into an open row and adds a new one in one call'
);
select is(
  (select grams::text || '/' || jsonb_array_length(sources)::text || '/' || owner_id::text from public.shopping_list_items where id = '29103000-0000-4000-8000-0000000002a1'),
  '450/1/29103000-0000-4000-8000-00000000000a',
  'the open row carries the new grams and sources, and an owner_id key is ignored'
);
select is(
  (select count(*)::int from public.shopping_list_items where name = 'shop29-a-new' and owner_id = '29103000-0000-4000-8000-00000000000a' and position = 5),
  1,
  'the new row is the caller''s, with a new id'
);
select lives_ok(
  $$ select public.save_shopping_items(jsonb_build_array(
       pg_temp.item('29103000-0000-4000-8000-0000000002a1', 'shop29-a-rice', '29103000-0000-4000-8000-0000000001a1', 450, 0)
     )) $$,
  'a food_id sent for a row that exists is accepted'
);
select is(
  (select food_id from public.shopping_list_items where id = '29103000-0000-4000-8000-0000000002a1'),
  '29103000-0000-4000-8000-000000000101'::uuid,
  'and is ignored, so an item never changes food'
);
select throws_ok(
  $$ select public.save_shopping_items(jsonb_build_array(
       pg_temp.item('29103000-0000-4000-8000-0000000002b1', 'shop29-taken-over', null, null, 0)
     )) $$,
  '42501',
  'new row violates row-level security policy (USING expression) for table "shopping_list_items"',
  'user A cannot write over user B''s item by its id'
);
select throws_ok(
  $$ select public.save_shopping_items(jsonb_build_array(
       pg_temp.item(null, 'shop29-a-b-food', '29103000-0000-4000-8000-0000000001b1', 50, 6)
     )) $$,
  '42501',
  'new row violates row-level security policy for table "shopping_list_items"',
  'user A cannot add an item of user B''s private food through the function'
);
select throws_ok(
  $$ select public.save_shopping_items(jsonb_build_array(
       pg_temp.item('29103000-0000-4000-8000-0000000002a1', 'shop29-a-rice', '29103000-0000-4000-8000-000000000101', 999, 0),
       pg_temp.item(null, '   ', null, null, 7)
     )) $$,
  '23514',
  'new row for relation "shopping_list_items" violates check constraint "shopping_list_items_name_not_blank"',
  'a call with one bad row is refused'
);
select is(
  (select grams from public.shopping_list_items where id = '29103000-0000-4000-8000-0000000002a1'),
  450::numeric,
  'and writes nothing, so the good row of that call is not merged'
);

-- User A: clearing ticked items.
select lives_ok(
  $$ update public.shopping_list_items set checked_at = now() where name = 'shop29-a-new' $$,
  'user A ticks the new item'
);
with removed as (
  delete from public.shopping_list_items where checked_at is not null and name like 'shop29-%' returning 1
)
select is((select count(*)::int from removed), 1, 'clearing ticked items deletes the ticked one only');

reset role;

select is(
  (select name || '/' || grams::text || '/' || (checked_at is null)::text from public.shopping_list_items where id = '29103000-0000-4000-8000-0000000002b1'),
  'shop29-b-item/100/true',
  'user B''s item is as it was'
);

-- User B sees only their own list.
set local role authenticated;
set local request.jwt.claims = '{"sub":"29103000-0000-4000-8000-00000000000b","role":"authenticated"}';

select is(
  (select array_agg(name order by name) from public.shopping_list_items where name like 'shop29-%'),
  array['shop29-b-item'],
  'user B sees their own item and none of user A''s'
);

reset role;

-- Deleting a food leaves its items as typed items with their names. Inserted as postgres, since
-- clients have no delete grant on foods.
insert into public.foods (id, source, source_ref, owner_id, name, basis) values
  ('29103000-0000-4000-8000-0000000001a2', 'user', null, '29103000-0000-4000-8000-00000000000a', 'shop29-a-gone-food', 'per_100g');
insert into public.shopping_list_items (id, owner_id, food_id, name, grams, position) values
  ('29103000-0000-4000-8000-0000000002a2', '29103000-0000-4000-8000-00000000000a', '29103000-0000-4000-8000-0000000001a2', 'shop29-a-gone', 80, 9);

select lives_ok(
  $$ delete from public.foods where id = '29103000-0000-4000-8000-0000000001a2' $$,
  'a food on a shopping list can be deleted'
);
select is(
  (select coalesce(food_id::text, 'none') || '/' || name from public.shopping_list_items where id = '29103000-0000-4000-8000-0000000002a2'),
  'none/shop29-a-gone',
  'its item stays, with no food and its name'
);

-- Account deletion on the real tables: user C's item is on their own custom food.
select lives_ok(
  $$ delete from auth.users where id = '29103000-0000-4000-8000-00000000000c' $$,
  'deleting an auth user with a shopping list on their custom food succeeds'
);
select is(
  (select count(*)::int from public.shopping_list_items where owner_id = '29103000-0000-4000-8000-00000000000c')
  || '/' || (select count(*)::int from public.foods where owner_id = '29103000-0000-4000-8000-00000000000c'),
  '0/0',
  'the items and foods of the deleted user are gone'
);

select * from finish();

rollback;
