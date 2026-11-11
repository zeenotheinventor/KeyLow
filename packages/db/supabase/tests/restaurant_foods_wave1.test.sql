-- Asserts the first wave of restaurant foods (KEY-940), loaded by the *_restaurant_foods.sql migrations:
-- a Greggs sausage roll carries the chain's published figures scaled to 100 g and opens on one default
-- portion at the published weight, every restaurant food has exactly one default portion that is not a
-- bare gram amount and keeps its source URL in food_source_data, and search finds the Greggs rows.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so nothing
-- created here persists. It reads the foods the migration wrote, so it needs a stack that has applied
-- that migration (`pnpm --filter @keylow/db migration:up`). The search runs as an authenticated user,
-- with the JWT claims that `auth.uid()` reads. The auth user's id starts with 94000001-.

begin;

select plan(12);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '94000001-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'restaurant-wave1-user@keylow.test');

select is(
  (
    select count(*)
    from public.foods food
    join public.food_source_data source_data on source_data.food_id = food.id
    where food.source = 'restaurant' and source_data.raw ->> 'wave' = '1'
  ),
  30::bigint,
  'the first wave holds exactly 30 restaurant foods'
);

select results_eq(
  $$ select name, brand, basis::text from public.foods where source = 'restaurant' and source_ref = 'greggs-gb:sausage-roll' $$,
  $$ values ('Sausage Roll'::text, 'Greggs'::text, 'per_100g'::text) $$,
  'the Greggs sausage roll has the chain name and brand, per 100 g'
);

select results_eq(
  $$ select kcal::numeric, protein_g::numeric, fat_g::numeric, sat_fat_g::numeric, carbs_g::numeric, salt_g::numeric from public.foods where source = 'restaurant' and source_ref = 'greggs-gb:sausage-roll' $$,
  $$ values (336.89::numeric, 8.83::numeric, 23.3::numeric, 10.68::numeric, 23.3::numeric, 1.46::numeric) $$,
  'the Greggs sausage roll carries the published figures of 347 kcal for 103 g, scaled to 100 g'
);

select results_eq(
  $$
    select portion.label, portion.grams, portion.is_default
    from public.food_portions portion
    join public.foods food on food.id = portion.food_id
    where food.source = 'restaurant' and food.source_ref = 'greggs-gb:sausage-roll' and portion.owner_id is null
  $$,
  $$ values ('1 sausage roll'::text, 103::numeric, true) $$,
  'the Greggs sausage roll has one shared portion, 1 sausage roll at 103 g, and it is the default'
);

select is_empty(
  $$
    select food.source_ref
    from public.foods food
    left join public.food_portions portion on portion.food_id = food.id and portion.owner_id is null and portion.is_default
    where food.source = 'restaurant'
    group by food.id, food.source_ref
    having count(portion.id) <> 1
  $$,
  'every restaurant food has exactly one default portion'
);

select is_empty(
  $$
    select food.source_ref
    from public.foods food
    join public.food_portions portion on portion.food_id = food.id and portion.is_default
    where food.source = 'restaurant' and (portion.label ~* '^[0-9.]+ ?(g|ml)$' or portion.label ~* 'typical')
  $$,
  'no restaurant food opens on a bare gram or ml amount or on a typical portion'
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

select is_empty(
  $$
    select food.source_ref
    from public.foods food
    join public.food_source_data source_data on source_data.food_id = food.id
    where food.source = 'restaurant' and food.basis = 'per_portion' and source_data.raw ->> 'wave' = '1'
  $$,
  'wave 1 holds no restaurant food per portion'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"94000001-0000-4000-8000-00000000000a","role":"authenticated"}';

select ok(
  exists (
    select 1 from public.search_foods('greggs sausage roll', 25) result
    where result.source = 'restaurant' and result.name = 'Sausage Roll' and result.brand = 'Greggs'
  ),
  'searching greggs sausage roll finds the Greggs sausage roll'
);

select ok(
  exists (
    select 1 from public.search_foods('sausage roll greggs', 25) result
    where result.source = 'restaurant' and result.name = 'Sausage Roll' and result.brand = 'Greggs'
  ),
  'searching sausage roll greggs finds the Greggs sausage roll'
);

select results_eq(
  $$
    select result.name, result.brand
    from public.search_foods('sausage roll', 25) with ordinality as result
    order by result.ordinality
    limit 1
  $$,
  $$ values ('Sausage Roll'::text, 'Greggs'::text) $$,
  'a plain sausage roll search leads with the Greggs sausage roll'
);

select isnt(
  (select result.source::text from public.search_foods('chicken breast', 25) with ordinality as result order by result.ordinality limit 1),
  'restaurant',
  'a plain chicken breast search puts a food that is not a chain''s first'
);

select * from finish();

rollback;
