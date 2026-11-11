-- Asserts the third wave of restaurant foods (KEY-953), loaded by the newest *_restaurant_foods.sql
-- migration: Burger King. Burger King's UK PDF publishes a serving weight, so its foods are stored per
-- 100 g, scaled from the published figures for one serving, and open on one default portion at that
-- weight. A Whopper carries the scaled figures, opens on 1 burger at 287 g, wave 3 holds 17 foods all
-- per 100 g with one default portion each, and search finds the Whopper.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so nothing
-- created here persists. It reads the foods the migration wrote, so it needs a stack that has applied
-- that migration (`pnpm --filter @keylow/db migration:up`). Only the restaurant foods are asserted on,
-- because the seeds a test database loads may hold no generic foods. The search runs as an authenticated
-- user, with the JWT claims that `auth.uid()` reads. The auth user's id starts with 95300001-.

begin;

select plan(7);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '95300001-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'restaurant-wave3-user@keylow.test');

select results_eq(
  $$ select name, brand, basis::text from public.foods where source = 'restaurant' and source_ref = 'burgerking-gb:whopper' $$,
  $$ values ('Whopper'::text, 'Burger King'::text, 'per_100g'::text) $$,
  'the Burger King Whopper has the chain name and brand, per 100 g'
);

select results_eq(
  $$ select kcal::numeric, protein_g::numeric, fat_g::numeric, sat_fat_g::numeric, carbs_g::numeric, salt_g::numeric from public.foods where source = 'restaurant' and source_ref = 'burgerking-gb:whopper' $$,
  $$ values (207.32::numeric, 10.1::numeric, 10.45::numeric, 2.86::numeric, 18.47::numeric, 0.8::numeric) $$,
  'the Burger King Whopper carries the published figures of 595 kcal for 287 g, scaled to 100 g'
);

select results_eq(
  $$
    select portion.label, portion.grams, portion.is_default
    from public.food_portions portion
    join public.foods food on food.id = portion.food_id
    where food.source = 'restaurant' and food.source_ref = 'burgerking-gb:whopper' and portion.owner_id is null
  $$,
  $$ values ('1 burger'::text, 287::numeric, true) $$,
  'the Burger King Whopper has one shared portion, 1 burger at 287 g, and it is the default'
);

select is(
  (
    select count(*)
    from public.foods food
    join public.food_source_data source_data on source_data.food_id = food.id
    where food.source = 'restaurant' and source_data.raw ->> 'wave' = '3'
  ),
  17::bigint,
  'wave 3 holds 17 restaurant foods'
);

select is_empty(
  $$
    select food.source_ref
    from public.foods food
    join public.food_source_data source_data on source_data.food_id = food.id
    where food.source = 'restaurant' and source_data.raw ->> 'wave' = '3' and food.basis <> 'per_100g'
  $$,
  'every wave 3 restaurant food is per 100 g'
);

select is_empty(
  $$
    select food.source_ref
    from public.foods food
    join public.food_source_data source_data on source_data.food_id = food.id
    left join public.food_portions portion on portion.food_id = food.id and portion.owner_id is null and portion.is_default and portion.grams is not null
    where food.source = 'restaurant' and source_data.raw ->> 'wave' = '3'
    group by food.id, food.source_ref
    having count(portion.id) <> 1
  $$,
  'every wave 3 restaurant food has exactly one default portion, and it has a weight'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"95300001-0000-4000-8000-00000000000a","role":"authenticated"}';

select ok(
  exists (
    select 1
    from (
      select result.source, result.name, result.brand
      from public.search_foods('whopper', 3) with ordinality as result
      order by result.ordinality
      limit 3
    ) top_three
    where top_three.source = 'restaurant' and top_three.name = 'Whopper' and top_three.brand = 'Burger King'
  ),
  'searching whopper puts the Burger King Whopper in the first three'
);

select * from finish();

rollback;
