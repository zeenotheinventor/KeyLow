-- Asserts the atomic portion writes of KEY-946: public.replace_food_portions() and public.create_food()
-- write a person's own food and its portions in one transaction, and public.give_foods_default_portions()
-- leaves every food, of any source, on exactly one default portion.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so nothing
-- created here persists. Every row is created here and every check names its own food ids, so the
-- result does not depend on what else the database holds. Each actor is entered with `set local role`
-- plus the JWT claims that `auth.uid()` reads, and left with `reset role`. A statement inside throws_ok
-- runs in its own savepoint, which is what makes "the failure rolled everything back" checkable here.

begin;

select plan(38);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '94600000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'atomic-portions-a@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '94600000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'atomic-portions-b@keylow.test');

-- Fixtures inserted as postgres. A shared food with a portion, a food each for user A and user B, and two
-- portions on user A's food.
insert into public.foods (id, source, source_ref, owner_id, name, basis) values
  ('94600000-0000-4000-8000-000000000101', 'cofid', 'CF-ATOMIC-1', null, 'Atomic shared milk', 'per_100ml'),
  ('94600000-0000-4000-8000-0000000001a1', 'user', null, '94600000-0000-4000-8000-00000000000a', 'Atomic A bread', 'per_100g'),
  ('94600000-0000-4000-8000-0000000001b1', 'user', null, '94600000-0000-4000-8000-00000000000b', 'Atomic B cake', 'per_100g');

insert into public.food_portions (id, food_id, owner_id, label, grams, ml, is_default, position) values
  ('94600000-0000-4000-8000-000000000201', '94600000-0000-4000-8000-000000000101', null, 'glass', null, 200, true, 0),
  ('94600000-0000-4000-8000-0000000002a1', '94600000-0000-4000-8000-0000000001a1', '94600000-0000-4000-8000-00000000000a', 'slice', 30, null, true, 0),
  ('94600000-0000-4000-8000-0000000002a2', '94600000-0000-4000-8000-0000000001a1', '94600000-0000-4000-8000-00000000000a', 'thick slice', 45, null, false, 1),
  ('94600000-0000-4000-8000-0000000002b1', '94600000-0000-4000-8000-0000000001b1', '94600000-0000-4000-8000-00000000000b', 'wedge', 80, null, true, 0);

-- Function attributes and privileges.
select ok(
  not (select prosecdef from pg_proc where oid = 'public.replace_food_portions(uuid, jsonb)'::regprocedure),
  'replace_food_portions is security invoker, so row level security still applies'
);

select ok(
  not (select prosecdef from pg_proc where oid = 'public.create_food(jsonb, jsonb)'::regprocedure),
  'create_food is security invoker, so row level security still applies'
);

select ok(
  (select proconfig @> array['search_path=""'] from pg_proc where oid = 'public.replace_food_portions(uuid, jsonb)'::regprocedure)
  and (select proconfig @> array['search_path=""'] from pg_proc where oid = 'public.create_food(jsonb, jsonb)'::regprocedure)
  and (select proconfig @> array['search_path=""'] from pg_proc where oid = 'public.give_foods_default_portions(uuid[])'::regprocedure),
  'all three functions pin an empty search_path'
);

select is(
  (
    select array_agg(role_name order by role_name)
    from unnest(array['anon', 'authenticated', 'service_role']) as role_name
    where has_function_privilege(role_name, 'public.replace_food_portions(uuid, jsonb)', 'execute')
  ),
  array['authenticated', 'service_role'],
  'a signed in person can execute replace_food_portions and an anonymous caller cannot'
);

select is(
  (
    select array_agg(role_name order by role_name)
    from unnest(array['anon', 'authenticated', 'service_role']) as role_name
    where has_function_privilege(role_name, 'public.create_food(jsonb, jsonb)', 'execute')
  ),
  array['authenticated', 'service_role'],
  'a signed in person can execute create_food and an anonymous caller cannot'
);

select ok(
  (select prosecdef from pg_proc where oid = 'public.give_foods_default_portions(uuid[])'::regprocedure),
  'give_foods_default_portions is security definer'
);

select is(
  (
    select array_agg(role_name order by role_name)
    from unnest(array['anon', 'authenticated', 'service_role']) as role_name
    where has_function_privilege(role_name, 'public.give_foods_default_portions(uuid[])', 'execute')
  ),
  array['service_role'],
  'only service_role can execute give_foods_default_portions'
);

-- replace_food_portions as user A.
set local role authenticated;
set local request.jwt.claims = '{"sub":"94600000-0000-4000-8000-00000000000a","role":"authenticated"}';

create temporary table replaced as
select public.replace_food_portions(
  '94600000-0000-4000-8000-0000000001a1',
  '[{"label": "1 roll", "grams": 70, "ml": null, "is_default": true},
    {"label": "1 cup", "grams": null, "ml": 250, "is_default": false}]'
) as result;

select is(
  (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('label', stored ->> 'label', 'is_default', (stored ->> 'is_default')::boolean, 'position', (stored ->> 'position')::int, 'owner', stored ->> 'owner_id') order by (stored ->> 'position')::int) from replaced, pg_catalog.jsonb_array_elements(result) as stored),
  '[{"label": "1 roll", "is_default": true, "position": 0, "owner": "94600000-0000-4000-8000-00000000000a"},
    {"label": "1 cup", "is_default": false, "position": 1, "owner": "94600000-0000-4000-8000-00000000000a"}]'::jsonb,
  'a replace returns the stored portions in order, owned by the food''s owner'
);

select is(
  (select pg_catalog.jsonb_agg(label order by position) from public.food_portions where food_id = '94600000-0000-4000-8000-0000000001a1'),
  '["1 roll", "1 cup"]'::jsonb,
  'a replace leaves exactly the new portions and none of the old ones'
);

-- A failed insert rolls the delete back, so the old portions stay.
select throws_ok(
  $$ select public.replace_food_portions(
       '94600000-0000-4000-8000-0000000001a1',
       '[{"label": "ok", "grams": 10, "ml": null, "is_default": true},
         {"label": "both", "grams": 5, "ml": 5, "is_default": false}]') $$,
  '23514',
  null,
  'a portion with both grams and ml fails the replace'
);

select is(
  (select pg_catalog.jsonb_agg(label order by position) from public.food_portions where food_id = '94600000-0000-4000-8000-0000000001a1'),
  '["1 roll", "1 cup"]'::jsonb,
  'after a failed insert the food keeps its previous portions'
);

select throws_ok(
  $$ select public.replace_food_portions('94600000-0000-4000-8000-0000000001a1', '[]') $$,
  '22023',
  'replace_food_portions needs exactly one default portion',
  'an empty list is refused, so a food is never left with none'
);

select throws_ok(
  $$ select public.replace_food_portions(
       '94600000-0000-4000-8000-0000000001a1',
       '[{"label": "a", "grams": 1, "is_default": false}]') $$,
  '22023',
  'replace_food_portions needs exactly one default portion',
  'a list with no default is refused'
);

select throws_ok(
  $$ select public.replace_food_portions(
       '94600000-0000-4000-8000-0000000001a1',
       '[{"label": "a", "grams": 1, "is_default": true}, {"label": "b", "grams": 2, "is_default": true}]') $$,
  '22023',
  'replace_food_portions needs exactly one default portion',
  'a list with two defaults is refused with a clear error, not a unique violation'
);

select throws_ok(
  $$ select public.replace_food_portions('94600000-0000-4000-8000-0000000001a1', '{"label": "x"}') $$,
  '22023',
  'replace_food_portions needs the portions as a JSON array',
  'portions that are not an array are refused'
);

select is(
  (select pg_catalog.jsonb_agg(label order by position) from public.food_portions where food_id = '94600000-0000-4000-8000-0000000001a1'),
  '["1 roll", "1 cup"]'::jsonb,
  'every refused list leaves the previous portions in place'
);

select throws_ok(
  $$ select public.replace_food_portions(
       '94600000-0000-4000-8000-000000000101',
       '[{"label": "x", "grams": 1, "is_default": true}]') $$,
  '42501',
  'replace_food_portions only changes the caller''s own foods',
  'a shared food cannot be changed'
);

select throws_ok(
  $$ select public.replace_food_portions(
       '94600000-0000-4000-8000-0000000001b1',
       '[{"label": "x", "grams": 1, "is_default": true}]') $$,
  'P0002',
  'replace_food_portions could not find the food',
  'another person''s food answers as not found, the same as one that does not exist'
);

select throws_ok(
  $$ select public.replace_food_portions(
       '94600000-0000-4000-8000-000000000999',
       '[{"label": "x", "grams": 1, "is_default": true}]') $$,
  'P0002',
  'replace_food_portions could not find the food',
  'a food that does not exist is not found'
);

-- create_food as user A.
create temporary table created as
select public.create_food(
  '{"source": "user", "owner_id": "94600000-0000-4000-8000-00000000000a", "name": "Atomic flapjack",
    "basis": "per_100g", "kcal": 410, "protein_g": 22, "fat_g": 14, "carbs_g": 45, "fibre_g": 6, "sat_fat_g": 3.5}',
  '[{"label": "1 bar", "grams": 60, "ml": null, "is_default": true},
    {"label": "1 cup", "grams": null, "ml": 250, "is_default": false}]'
) as result;

select is(
  (select pg_catalog.jsonb_build_object(
     'source', result -> 'food' ->> 'source',
     'owner', result -> 'food' ->> 'owner_id',
     'name', result -> 'food' ->> 'name',
     'sat_fat_g', (result -> 'food' ->> 'sat_fat_g')::numeric,
     'has_search', (result -> 'food') ? 'search',
     'portions', (select pg_catalog.jsonb_agg(portion ->> 'label' order by (portion ->> 'position')::int) from pg_catalog.jsonb_array_elements(result -> 'portions') as portion)
   ) from created),
  '{"source": "user", "owner": "94600000-0000-4000-8000-00000000000a", "name": "Atomic flapjack", "sat_fat_g": 3.5, "has_search": false, "portions": ["1 bar", "1 cup"]}'::jsonb,
  'create_food returns the stored food without the search column, and its portions in order'
);

select is(
  (select count(*)::int from public.food_portions where food_id = ((select result -> 'food' ->> 'id' from created))::uuid and is_default),
  1,
  'the created food has exactly one default portion'
);

select is(
  (select micros from public.foods where id = ((select result -> 'food' ->> 'id' from created))::uuid),
  '{}'::jsonb,
  'a created food starts with empty micros'
);

-- A failed portions insert leaves no food behind.
select throws_ok(
  $$ select public.create_food(
       '{"source": "user", "owner_id": "94600000-0000-4000-8000-00000000000a", "name": "Atomic half made",
         "basis": "per_100g", "kcal": 1, "protein_g": 1, "fat_g": 1, "carbs_g": 1}',
       '[{"label": "ok", "grams": 10, "is_default": true}, {"label": "both", "grams": 5, "ml": 5, "is_default": false}]') $$,
  '23514',
  null,
  'a portion with both grams and ml fails the create'
);

select throws_ok(
  $$ select public.create_food(
       '{"source": "user", "owner_id": "94600000-0000-4000-8000-00000000000a", "name": "Atomic half made",
         "basis": "per_100g", "kcal": 1, "protein_g": 1, "fat_g": 1, "carbs_g": 1}',
       '[]') $$,
  '22023',
  'replace_food_portions needs exactly one default portion',
  'a create with no portions is refused'
);

select is(
  (select count(*)::int from public.foods where name = 'Atomic half made'),
  0,
  'a failed create leaves no food and so no food without portions'
);

select throws_ok(
  $$ select public.create_food(
       '{"source": "user", "owner_id": "94600000-0000-4000-8000-00000000000b", "name": "Atomic not mine",
         "basis": "per_100g", "kcal": 1}',
       '[{"label": "ok", "grams": 10, "is_default": true}]') $$,
  '42501',
  null,
  'a food owned by someone else is refused by row level security'
);

select throws_ok(
  $$ select public.create_food(
       '{"source": "cofid", "name": "Atomic shared", "basis": "per_100g", "kcal": 1}',
       '[{"label": "ok", "grams": 10, "is_default": true}]') $$,
  '42501',
  null,
  'a shared food cannot be created by a signed in person'
);

select throws_ok(
  $$ select public.create_food('[]', '[{"label": "ok", "grams": 10, "is_default": true}]') $$,
  '22023',
  'create_food needs the food as a JSON object',
  'a food that is not an object is refused'
);

reset role;

-- Another person's food and the shared food are untouched by everything above.
select is(
  (select pg_catalog.jsonb_agg(label order by food_id, position) from public.food_portions where food_id in ('94600000-0000-4000-8000-000000000101', '94600000-0000-4000-8000-0000000001b1')),
  '["glass", "wedge"]'::jsonb,
  'the shared food and the other person''s food keep their portions'
);

set local role anon;
select throws_ok(
  $$ select public.replace_food_portions('94600000-0000-4000-8000-0000000001a1', '[{"label": "x", "grams": 1, "is_default": true}]') $$,
  '42501',
  null,
  'an anonymous caller cannot replace portions'
);
reset role;

-- Every food, of any source, ends on exactly one default. Each food below is created here, with no default
-- or no portions at all, and the check names those ids.
insert into public.foods (id, source, source_ref, owner_id, name, basis, kcal, food_group, fetched_at) values
  ('94600000-0000-4000-8000-000000000301', 'cofid', 'CF-ATOMIC-2', null, 'Atomic cofid with no portions', 'per_100g', 120, 'AC', null),
  ('94600000-0000-4000-8000-000000000302', 'off', 'OFF-ATOMIC-1', null, 'Atomic off with only a plain portion', 'per_100g', 300, null, now()),
  ('94600000-0000-4000-8000-000000000303', 'user', null, '94600000-0000-4000-8000-00000000000b', 'Atomic user with no portions', 'per_100ml', 40, null, null),
  ('94600000-0000-4000-8000-000000000304', 'cofid', 'CF-ATOMIC-3', null, 'Atomic cofid already defaulted', 'per_100g', 50, 'F', null);

insert into public.food_portions (id, food_id, owner_id, label, grams, is_default, position) values
  ('94600000-0000-4000-8000-000000000402', '94600000-0000-4000-8000-000000000302', null, '1 pot', 150, false, 0),
  ('94600000-0000-4000-8000-000000000404', '94600000-0000-4000-8000-000000000304', null, '1 handful', 25, true, 0);

-- A call with ids touches only those foods. Food 303 has no portions and is not named, so it stays as it was.
set local role service_role;
select public.give_foods_default_portions(
  array['94600000-0000-4000-8000-000000000301', '94600000-0000-4000-8000-000000000302']::uuid[]
);
reset role;

select is(
  (select count(*)::int from public.food_portions where food_id = '94600000-0000-4000-8000-000000000303'),
  0,
  'a call with ids leaves a food that is not named without portions'
);

select is(
  (select pg_catalog.jsonb_object_agg(food.name, (
     select count(*)::int from public.food_portions portion where portion.food_id = food.id and portion.is_default
   ))
   from public.foods food
   where food.id in ('94600000-0000-4000-8000-000000000301', '94600000-0000-4000-8000-000000000302')),
  '{"Atomic cofid with no portions": 1, "Atomic off with only a plain portion": 1}'::jsonb,
  'a call with ids gives the named foods their default'
);

-- A call with no ids covers every food.
set local role service_role;
select public.give_foods_default_portions();
reset role;

select is(
  (
    select pg_catalog.jsonb_object_agg(food.name, (
      select count(*)::int from public.food_portions portion where portion.food_id = food.id and portion.is_default
    ))
    from public.foods food
    where food.id in (
      '94600000-0000-4000-8000-000000000301', '94600000-0000-4000-8000-000000000302',
      '94600000-0000-4000-8000-000000000303', '94600000-0000-4000-8000-000000000304'
    )
  ),
  '{"Atomic cofid with no portions": 1, "Atomic off with only a plain portion": 1,
    "Atomic user with no portions": 1, "Atomic cofid already defaulted": 1}'::jsonb,
  'every food of every source ends on exactly one default'
);

select is(
  (select label from public.food_portions where food_id = '94600000-0000-4000-8000-000000000302' and is_default),
  '1 pot',
  'a food with portions and no default promotes its first portion and gains no row'
);

select is(
  (select pg_catalog.jsonb_agg(label) from public.food_portions where food_id = '94600000-0000-4000-8000-000000000304'),
  '["1 handful"]'::jsonb,
  'a food that already has a default keeps it and gains no row'
);

select is(
  (select unit from (
     select case when ml is not null then 'ml' else 'g' end as unit
     from public.food_portions where food_id = '94600000-0000-4000-8000-000000000303' and is_default
   ) sized),
  'ml',
  'a food with no portions gets an estimate in the unit of its basis'
);

select is(
  (select count(*)::int from public.food_portions where food_id = '94600000-0000-4000-8000-0000000001a1' and is_default),
  1,
  'a person''s own food that was already fine is left with one default'
);

-- Running it again changes nothing. Each of the four foods holds one row: 301 the food group row, 302 its
-- promoted first portion, 303 the energy row and 304 its own default.
set local role service_role;
select public.give_foods_default_portions();
reset role;

select is(
  (select count(*)::int from public.food_portions where food_id in (
    '94600000-0000-4000-8000-000000000301', '94600000-0000-4000-8000-000000000302',
    '94600000-0000-4000-8000-000000000303', '94600000-0000-4000-8000-000000000304'
  )),
  4,
  'a second run adds no portion'
);

select * from finish();

rollback;
