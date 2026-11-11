-- Asserts the restaurant foods that have no published weight (KEY-943), loaded by the second
-- *_restaurant_foods.sql migration: McDonald's and KFC are stored per portion, as the chain publishes
-- them. A KFC Zinger Burger carries the published figures for one burger and opens on one count portion
-- with no grams and no ml, every food per portion has exactly one portion and it is a count portion,
-- every restaurant food keeps its source URL, and search finds the chains' burgers.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so nothing
-- created here persists. It reads the foods the migration wrote, so it needs a stack that has applied
-- that migration (`pnpm --filter @keylow/db migration:up`). Only the restaurant foods are asserted on,
-- because the seeds a test database loads may hold no generic foods. The search runs as an authenticated
-- user, with the JWT claims that `auth.uid()` reads. The auth user's id starts with 94300001-.

begin;

select plan(11);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '94300001-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'restaurant-wave1b-user@keylow.test');

select results_eq(
  $$ select name, brand, basis::text from public.foods where source = 'restaurant' and source_ref = 'kfc-gb:zinger-burger' $$,
  $$ values ('Zinger Burger'::text, 'KFC'::text, 'per_portion'::text) $$,
  'the KFC Zinger Burger has the chain name and brand, per portion'
);

select results_eq(
  $$ select kcal::numeric, protein_g::numeric, fat_g::numeric, carbs_g::numeric from public.foods where source = 'restaurant' and source_ref = 'kfc-gb:zinger-burger' $$,
  $$ values (468::numeric, 23::numeric, 22::numeric, 43::numeric) $$,
  'the KFC Zinger Burger keeps the published 468 kcal, 23 g protein, 22 g fat and 43 g carbohydrate of one burger, unscaled'
);

select results_eq(
  $$
    select portion.label, portion.grams, portion.ml, portion.is_default
    from public.food_portions portion
    join public.foods food on food.id = portion.food_id
    where food.source = 'restaurant' and food.source_ref = 'kfc-gb:zinger-burger' and portion.owner_id is null
  $$,
  $$ values ('1 burger'::text, null::numeric, null::numeric, true) $$,
  'the KFC Zinger Burger has one shared portion, 1 burger, with grams and ml both null, and it is the default'
);

select results_eq(
  $$ select kcal::numeric, protein_g::numeric, fat_g::numeric, carbs_g::numeric, basis::text from public.foods where source = 'restaurant' and source_ref = 'mcdonalds-gb:big-mac' $$,
  $$ values (509::numeric, 27::numeric, 25::numeric, 41::numeric, 'per_portion'::text) $$,
  'the McDonald''s Big Mac is per portion with the published 509 kcal, 27 g protein, 25 g fat and 41 g carbohydrate'
);

select is(
  (
    select count(*)
    from public.foods food
    join public.food_source_data source_data on source_data.food_id = food.id
    where food.source = 'restaurant' and source_data.raw ->> 'wave' = '2' and food.basis = 'per_portion'
  ),
  34::bigint,
  'wave 2 holds 34 restaurant foods, all per portion'
);

select is_empty(
  $$
    select food.source_ref
    from public.foods food
    join public.food_source_data source_data on source_data.food_id = food.id
    where food.source = 'restaurant' and source_data.raw ->> 'wave' = '2' and food.basis <> 'per_portion'
  $$,
  'no wave 2 restaurant food is per 100 g'
);

select is_empty(
  $$
    select food.source_ref
    from public.foods food
    left join public.food_portions portion on portion.food_id = food.id and portion.owner_id is null
    where food.source = 'restaurant' and food.basis = 'per_portion'
    group by food.id, food.source_ref
    having count(portion.id) <> 1
  $$,
  'every per portion restaurant food has exactly one shared portion'
);

select is_empty(
  $$
    select food.source_ref
    from public.foods food
    join public.food_portions portion on portion.food_id = food.id and portion.owner_id is null
    where food.source = 'restaurant' and food.basis = 'per_portion'
      and (portion.grams is not null or portion.ml is not null or not portion.is_default)
  $$,
  'the one portion of every per portion restaurant food is a default count portion with no grams and no ml'
);

select is_empty(
  $$
    select food.source_ref
    from public.foods food
    left join public.food_source_data source_data on source_data.food_id = food.id
    where food.source = 'restaurant' and coalesce(source_data.raw ->> 'source_url', '') = ''
  $$,
  'every restaurant food keeps the URL it was read from in its source data'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"94300001-0000-4000-8000-00000000000a","role":"authenticated"}';

select ok(
  exists (
    select 1
    from (
      select result.source, result.name, result.brand
      from public.search_foods('zinger burger', 3) with ordinality as result
      order by result.ordinality
      limit 3
    ) top_three
    where top_three.source = 'restaurant' and top_three.name = 'Zinger Burger' and top_three.brand = 'KFC'
  ),
  'searching zinger burger puts the KFC Zinger Burger in the first three'
);

select ok(
  exists (
    select 1
    from (
      select result.source, result.name, result.brand
      from public.search_foods('kfc zinger', 3) with ordinality as result
      order by result.ordinality
      limit 3
    ) top_three
    where top_three.source = 'restaurant' and top_three.name = 'Zinger Burger' and top_three.brand = 'KFC'
  ),
  'searching kfc zinger puts the KFC Zinger Burger in the first three'
);

select * from finish();

rollback;
