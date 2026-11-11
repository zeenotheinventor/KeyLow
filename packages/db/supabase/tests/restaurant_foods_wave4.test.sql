-- Asserts the Nando's foods (KEY-955, ADR 0003 Amendment 20), loaded by the wave 4 *_restaurant_foods.sql
-- migration. Nando's publishes energy only, so each food is per portion with the published kcal and macros
-- estimated from the dish's ingredients, and carries `quality.macros_estimated`. A Whole Chicken keeps the
-- published 1,159 kcal unscaled, opens on one count portion with no grams and no ml, every Nando's food has
-- the mark and no other restaurant food has, and search finds the chicken.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so nothing
-- created here persists. It reads the foods the migration wrote, so it needs a stack that has applied
-- that migration (`pnpm --filter @keylow/db migration:up`). Only the restaurant foods are asserted on,
-- because the seeds a test database loads may hold no generic foods. The search runs as an authenticated
-- user, with the JWT claims that `auth.uid()` reads. The auth user's id starts with 95500001-.

begin;

select plan(9);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '95500001-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'restaurant-wave4-user@keylow.test');

select results_eq(
  $$ select name, brand, basis::text from public.foods where source = 'restaurant' and source_ref = 'nandos-gb:whole-chicken' $$,
  $$ values ('Whole Chicken'::text, 'Nando''s'::text, 'per_portion'::text) $$,
  'the Nando''s Whole Chicken has the chain name and brand, per portion'
);

select results_eq(
  $$ select kcal::numeric, protein_g::numeric, fat_g::numeric, carbs_g::numeric from public.foods where source = 'restaurant' and source_ref = 'nandos-gb:whole-chicken' $$,
  $$ values (1159::numeric, 134.3::numeric, 69.1::numeric, 0::numeric) $$,
  'the Whole Chicken keeps the published 1159 kcal and the estimated 134.3 g protein, 69.1 g fat and no carbohydrate, unscaled'
);

select results_eq(
  $$
    select portion.label, portion.grams, portion.ml, portion.is_default
    from public.food_portions portion
    join public.foods food on food.id = portion.food_id
    where food.source = 'restaurant' and food.source_ref = 'nandos-gb:whole-chicken' and portion.owner_id is null
  $$,
  $$ values ('1 whole chicken'::text, null::numeric, null::numeric, true) $$,
  'the Whole Chicken has one shared portion, 1 whole chicken, with grams and ml both null, and it is the default'
);

select is(
  (
    select count(*)
    from public.foods food
    join public.food_source_data source_data on source_data.food_id = food.id
    where food.source = 'restaurant' and source_data.raw ->> 'wave' = '4' and food.basis = 'per_portion'
  ),
  13::bigint,
  'wave 4 holds 13 restaurant foods, all per portion'
);

select is_empty(
  $$
    select source_ref
    from public.foods
    where source = 'restaurant' and brand = 'Nando''s' and quality is distinct from '{"macros_estimated": true}'::jsonb
  $$,
  'every Nando''s food carries quality.macros_estimated and nothing else'
);

select is_empty(
  $$
    select source_ref
    from public.foods
    where source = 'restaurant' and brand <> 'Nando''s' and quality ? 'macros_estimated'
  $$,
  'no other restaurant food is marked as having estimated macros'
);

select is_empty(
  $$
    select food.source_ref
    from public.foods food
    left join public.food_portions portion on portion.food_id = food.id and portion.owner_id is null
    where food.source = 'restaurant' and food.brand = 'Nando''s'
    group by food.id, food.source_ref
    having count(portion.id) <> 1 or bool_and(portion.grams is not null or portion.ml is not null or not portion.is_default)
  $$,
  'every Nando''s food has exactly one shared portion, a default count portion with no grams and no ml'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"95500001-0000-4000-8000-00000000000a","role":"authenticated"}';

select ok(
  exists (
    select 1
    from (
      select result.source, result.name, result.brand
      from public.search_foods('chicken butterfly', 3) with ordinality as result
      order by result.ordinality
      limit 3
    ) top_three
    where top_three.source = 'restaurant' and top_three.name = 'Chicken Butterfly' and top_three.brand = 'Nando''s'
  ),
  'searching chicken butterfly puts the Nando''s Chicken Butterfly in the first three'
);

select ok(
  exists (
    select 1
    from (
      select result.source, result.name, result.brand
      from public.search_foods('nandos whole chicken', 3) with ordinality as result
      order by result.ordinality
      limit 3
    ) top_three
    where top_three.source = 'restaurant' and top_three.name = 'Whole Chicken' and top_three.brand = 'Nando''s'
  ),
  'searching nandos whole chicken puts the Nando''s Whole Chicken in the first three'
);

select * from finish();

rollback;
