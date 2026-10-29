-- Asserts the first wave of USDA foods (KEY-760), loaded by the *_usda_foods.sql migration: the wave
-- holds at least 59 foods, the raw chicken thigh carries the SR Legacy numbers and its natural portion,
-- no name keeps a US word, no USDA food has the name of a CoFID food, and searching "chicken thigh"
-- finds the USDA thighs.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so nothing
-- created here persists. It reads the foods the migration wrote, so it needs a stack that has applied
-- that migration. The search runs as an authenticated user, with the JWT claims that `auth.uid()` reads.

begin;

select plan(8);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '76000001-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'usda-wave1-user@keylow.test');

select cmp_ok(
  (select count(*) from public.foods where source = 'usda'),
  '>=',
  59::bigint,
  'the first wave holds at least 59 usda foods'
);

select is(
  (select name from public.foods where source = 'usda' and source_ref = '172385'),
  'Chicken, thigh, raw, meat and skin',
  'the raw chicken thigh has the Ki-Lo name'
);

select results_eq(
  $$ select kcal::numeric, protein_g::numeric, fat_g::numeric, salt_g::numeric from public.foods where source = 'usda' and source_ref = '172385' $$,
  $$ values (221::numeric, 16.52::numeric, 16.61::numeric, 0.2025::numeric) $$,
  'the raw chicken thigh carries the SR Legacy kcal, protein, fat and salt per 100 g'
);

select results_eq(
  $$
    select portion.label, portion.is_default
    from public.food_portions portion
    join public.foods food on food.id = portion.food_id
    where food.source = 'usda' and food.source_ref = '172385' and portion.owner_id is null
  $$,
  $$ values ('1 thigh'::text, true) $$,
  'the raw chicken thigh has one shared portion, 1 thigh, and it is the default'
);

select is(
  (
    select portion.grams
    from public.food_portions portion
    join public.foods food on food.id = portion.food_id
    where food.source = 'usda' and food.source_ref = '172385' and portion.label = '1 thigh'
  ),
  193::numeric,
  'the 1 thigh portion weighs 193 g, the SR Legacy weight of a thigh with skin'
);

select is_empty(
  $$ select name from public.foods where source = 'usda' and name ~* 'broilers|fryers|ground|all classes|retail parts' $$,
  'no usda name keeps a US word'
);

select is_empty(
  $$
    select usda.name
    from public.foods usda
    join public.foods cofid on lower(cofid.name) = lower(usda.name) and cofid.source = 'cofid'
    where usda.source = 'usda'
  $$,
  'no usda food shares a name with a cofid food'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"76000001-0000-4000-8000-00000000000a","role":"authenticated"}';

select cmp_ok(
  (
    select count(*)
    from public.search_foods('chicken thigh', 25) result
    where result.source = 'usda' and result.name like 'Chicken, thigh%'
  ),
  '>=',
  2::bigint,
  'searching chicken thigh finds at least two usda chicken thighs'
);

select * from finish();

rollback;
