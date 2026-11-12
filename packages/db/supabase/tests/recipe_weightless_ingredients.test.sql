-- Asserts that a weightless restaurant food can be a recipe ingredient, counted in portions (KEY-944, ADR 0003
-- Amendment 19): an ingredient row of a food per portion stores 0 grams and the unit portion, the row checks
-- that say so, a servings only recipe having no cooked weight in save_recipe, and the rules for every other food
-- staying as they were.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so nothing
-- created here persists. Every fixture id starts with 94400000 and the email with key944-. The actor is
-- entered with `set local role` plus the JWT claims that `auth.uid()` reads, and left with `reset role`.

begin;

select plan(12);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '94400000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'key944-user-a@keylow.test');

-- A restaurant food per portion with its count portion, and a food with a weight, both global.
insert into public.foods (id, source, source_ref, name, basis, kcal) values
  ('94400000-0000-4000-8000-000000000101', 'restaurant', 'key944:bucket', 'key944 bucket', 'per_portion', 1250),
  ('94400000-0000-4000-8000-000000000102', 'cofid', 'KEY944-FOOD-1', 'key944 fries', 'per_100g', 300);

insert into public.food_portions (id, food_id, owner_id, label, grams, ml, is_default, position) values
  ('94400000-0000-4000-8000-000000000201', '94400000-0000-4000-8000-000000000101', null, '1 bucket', null, null, true, 0),
  ('94400000-0000-4000-8000-000000000202', '94400000-0000-4000-8000-000000000102', null, '1 portion', 100, null, true, 0);

-- Payload builders for save_recipe, in the temporary schema so nothing persists.
create function pg_temp.bucket(count numeric, unit text default 'portion', grams numeric default 0, basis text default 'per_portion')
returns jsonb language sql as $$
  select jsonb_build_object(
    'food_id', '94400000-0000-4000-8000-000000000101', 'quantity', count, 'unit', unit,
    'portion_id', case when unit = 'portion' then '94400000-0000-4000-8000-000000000201' else null end,
    'resolved_grams', grams, 'snapshot', jsonb_build_object('kind', 'food', 'basis', basis)
  )
$$;

create function pg_temp.fries(grams numeric)
returns jsonb language sql as $$
  select jsonb_build_object(
    'food_id', '94400000-0000-4000-8000-000000000102', 'quantity', grams, 'unit', 'g', 'portion_id', null,
    'resolved_grams', grams, 'snapshot', jsonb_build_object('kind', 'food', 'basis', 'per_100g')
  )
$$;

create function pg_temp.recipe(recipe_name text, yield numeric default null)
returns jsonb language sql as $$
  select jsonb_build_object(
    'name', recipe_name, 'servings', 4, 'yield_grams', yield, 'instructions', '[]'::jsonb,
    'computed', '{"total":{"kcal":null},"engineVersion":1}'::jsonb
  )
$$;

set local role authenticated;
set local request.jwt.claims = '{"sub":"94400000-0000-4000-8000-00000000000a","role":"authenticated"}';

select lives_ok(
  $$ select set_config('key944.saved_id', public.save_recipe(
       null,
       pg_temp.recipe('key944-meal-deal'),
       jsonb_build_array(pg_temp.bucket(2), pg_temp.fries(200))
     )::text, true) $$,
  'a recipe with a food per portion counted in portions and a food with a weight is saved, with no cooked weight'
);

select is(
  (select resolved_grams::text || '/' || unit::text || '/' || quantity::text
   from public.recipe_ingredients
   where recipe_id = current_setting('key944.saved_id')::uuid and position = 0),
  '0/portion/2',
  'the food per portion is stored as 2 portions with 0 grams'
);

select is(
  (select resolved_grams from public.recipe_ingredients
   where recipe_id = current_setting('key944.saved_id')::uuid and position = 1),
  200::numeric,
  'the other ingredient keeps its grams'
);

select throws_ok(
  $$ select public.save_recipe(null, pg_temp.recipe('key944-weighed', 400), jsonb_build_array(pg_temp.bucket(1), pg_temp.fries(200))) $$,
  '22023',
  'a recipe with a food per portion has no cooked weight',
  'a recipe with a food per portion refuses a cooked weight'
);

select lives_ok(
  $$ select public.save_recipe(null, pg_temp.recipe('key944-weighed-ok', 400), jsonb_build_array(pg_temp.fries(200))) $$,
  'a recipe of weighed foods still takes a cooked weight'
);

select lives_ok(
  $$ select public.save_recipe(
       current_setting('key944.saved_id')::uuid,
       pg_temp.recipe('key944-meal-deal-again'),
       jsonb_build_array(pg_temp.bucket(1), pg_temp.fries(100))
     ) $$,
  'a recipe with a food per portion can be saved again with no cooked weight'
);

select throws_ok(
  $$ select public.save_recipe(null, pg_temp.recipe('key944-grams'), jsonb_build_array(pg_temp.bucket(100, 'g', 0))) $$,
  '23514',
  'new row for relation "recipe_ingredients" violates check constraint "recipe_ingredients_per_portion_is_portion_check"',
  'a food per portion in grams is refused'
);

select throws_ok(
  $$ select public.save_recipe(null, pg_temp.recipe('key944-zero'), jsonb_build_array(jsonb_set(pg_temp.fries(100), '{resolved_grams}', '0'))) $$,
  '23514',
  'new row for relation "recipe_ingredients" violates check constraint "recipe_ingredients_resolved_grams_check"',
  '0 grams of a food per 100 g is refused'
);

select throws_ok(
  $$ select public.save_recipe(null, pg_temp.recipe('key944-no-basis'), jsonb_build_array(pg_temp.bucket(1, 'portion', 0, 'per_100g'))) $$,
  '23514',
  'new row for relation "recipe_ingredients" violates check constraint "recipe_ingredients_resolved_grams_check"',
  '0 grams with a snapshot that is not per portion is refused'
);

select throws_ok(
  $$ select public.save_recipe(null, pg_temp.recipe('key944-no-snapshot-basis'), jsonb_build_array(jsonb_set(pg_temp.bucket(1), '{snapshot}', '{"kind":"food"}'))) $$,
  '23514',
  'new row for relation "recipe_ingredients" violates check constraint "recipe_ingredients_resolved_grams_check"',
  '0 grams with a snapshot that has no basis is refused'
);

select throws_ok(
  $$ select public.save_recipe(null, pg_temp.recipe('key944-too-heavy'), jsonb_build_array(pg_temp.fries(100001))) $$,
  '23514',
  'new row for relation "recipe_ingredients" violates check constraint "recipe_ingredients_resolved_grams_check"',
  'more than 100000 grams is still refused'
);

select is(
  (select count(*)::int from public.recipes where name in ('key944-weighed', 'key944-grams', 'key944-zero', 'key944-no-basis', 'key944-too-heavy')),
  0,
  'a refused save leaves nothing behind'
);

select * from finish();

rollback;
