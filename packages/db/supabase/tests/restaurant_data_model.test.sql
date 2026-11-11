-- Asserts the data model of restaurant foods (KEY-939, ADR 0003 Amendment 17): the two enum values, a
-- restaurant food stored per portion with one count portion (no grams and no ml), the rule that only a
-- restaurant food is per portion, the rule that only a per portion food has a portion with no size (held
-- by a trigger, so it binds the service role and a signed-in person writing to their own food alike),
-- and day_totals summing an entry of one. A recipe taking such a food is in recipe_weightless_ingredients.test.sql.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so nothing
-- created here persists. Every fixture id starts with 93900000 and the email with key939-. Each actor is
-- entered with `set local role` plus the JWT claims that `auth.uid()` reads, and left with `reset role`.

begin;

select plan(22);

select enum_has_labels(
  'public',
  'food_source',
  array['off', 'cofid', 'user', 'usda', 'restaurant'],
  'food_source is off, cofid, user, usda and restaurant'
);

select enum_has_labels(
  'public',
  'nutrient_basis',
  array['per_100g', 'per_100ml', 'per_portion'],
  'nutrient_basis is per_100g, per_100ml and per_portion'
);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '93900000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'key939-user-a@keylow.test');

-- A user food with a weight, which a person owns and may write portions to.
insert into public.foods (id, source, owner_id, name, basis, kcal) values
  ('93900000-0000-4000-8000-0000000001a1', 'user', '93900000-0000-4000-8000-00000000000a', 'key939 own bread', 'per_100g', 250);

-- A restaurant food per portion, and a restaurant food per 100 g, as the service role loads them.
select lives_ok(
  $$insert into public.foods (id, source, source_ref, name, brand, basis, kcal, protein_g, fat_g, carbs_g)
    values ('93900000-0000-4000-8000-000000000101', 'restaurant', 'key939:bucket', 'key939 bucket', 'key939 chain', 'per_portion', 1250, 80, 70, 60)$$,
  'a restaurant food per portion is accepted'
);

insert into public.foods (id, source, source_ref, name, brand, basis, kcal) values
  ('93900000-0000-4000-8000-000000000102', 'restaurant', 'key939:burger', 'key939 burger', 'key939 chain', 'per_100g', 250);

select lives_ok(
  $$insert into public.food_portions (id, food_id, owner_id, label, grams, ml, is_default, position)
    values ('93900000-0000-4000-8000-000000000201', '93900000-0000-4000-8000-000000000101', null, '1 bucket', null, null, true, 0)$$,
  'a count portion with no grams and no ml is accepted on a per portion food'
);

select is(
  (select grams is null and ml is null from public.food_portions where id = '93900000-0000-4000-8000-000000000201'),
  true,
  'the count portion is stored with neither grams nor ml'
);

select lives_ok(
  $$insert into public.food_portions (food_id, owner_id, label, grams, is_default, position)
    values ('93900000-0000-4000-8000-000000000102', null, '1 burger', 180, true, 0)$$,
  'a gram portion on a restaurant food per 100 g is accepted'
);

-- Only a restaurant food may be per portion.
select throws_ok(
  $$insert into public.foods (source, source_ref, name, basis) values ('cofid', 'key939:cofid', 'key939 cofid per portion', 'per_portion')$$,
  '23514',
  'new row for relation "foods" violates check constraint "foods_per_portion_only_restaurant"',
  'a cofid food cannot be per portion'
);

select throws_ok(
  $$insert into public.foods (source, owner_id, name, basis) values ('user', '93900000-0000-4000-8000-00000000000a', 'key939 user per portion', 'per_portion')$$,
  '23514',
  'new row for relation "foods" violates check constraint "foods_per_portion_only_restaurant"',
  'a user food cannot be per portion'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"93900000-0000-4000-8000-00000000000a","role":"authenticated"}';

select throws_ok(
  $$insert into public.foods (source, owner_id, name, basis) values ('user', '93900000-0000-4000-8000-00000000000a', 'key939 own per portion', 'per_portion')$$,
  '23514',
  'new row for relation "foods" violates check constraint "foods_per_portion_only_restaurant"',
  'a signed-in person cannot create a per portion food'
);

select throws_ok(
  $$insert into public.foods (source, name, basis) values ('restaurant', 'key939 own restaurant food', 'per_100g')$$,
  '42501',
  'new row violates row-level security policy for table "foods"',
  'a signed-in person cannot create a restaurant food'
);

-- A portion with no size on a food that has a weight, by a signed-in person on their own food.
select throws_ok(
  $$insert into public.food_portions (food_id, owner_id, label) values ('93900000-0000-4000-8000-0000000001a1', '93900000-0000-4000-8000-00000000000a', 'key939 weightless')$$,
  '23514',
  'A portion needs a size in grams or ml unless its food is per portion',
  'a signed-in person cannot store a weightless portion on their own food'
);

select lives_ok(
  $$insert into public.food_portions (food_id, owner_id, label, grams) values ('93900000-0000-4000-8000-0000000001a1', '93900000-0000-4000-8000-00000000000a', 'key939 slice', 30)$$,
  'a signed-in person can still add a gram portion to their own food'
);

select throws_ok(
  $$update public.food_portions set grams = null where food_id = '93900000-0000-4000-8000-0000000001a1' and label = 'key939 slice'$$,
  '23514',
  'A portion needs a size in grams or ml unless its food is per portion',
  'a signed-in person cannot take the size off a portion of their own food'
);

reset role;

-- The same rule binds the service role, which RLS does not.
set local role service_role;

select throws_ok(
  $$insert into public.food_portions (food_id, owner_id, label) values ('93900000-0000-4000-8000-000000000102', null, '1 burger, no weight')$$,
  '23514',
  'A portion needs a size in grams or ml unless its food is per portion',
  'the service role cannot store a count portion on a per 100 g food'
);

select throws_ok(
  $$insert into public.food_portions (food_id, owner_id, label, grams) values ('93900000-0000-4000-8000-000000000101', null, '1 bucket, 800 g', 800)$$,
  '23514',
  'A portion of a food per portion has no size',
  'a gram portion on a per portion food is refused'
);

select throws_ok(
  $$insert into public.food_portions (food_id, owner_id, label, ml) values ('93900000-0000-4000-8000-000000000101', null, '1 bucket, 800 ml', 800)$$,
  '23514',
  'A portion of a food per portion has no size',
  'a millilitre portion on a per portion food is refused'
);

select throws_ok(
  $$update public.food_portions set grams = 800 where id = '93900000-0000-4000-8000-000000000201'$$,
  '23514',
  'A portion of a food per portion has no size',
  'a count portion cannot be given a size afterwards'
);

select throws_ok(
  $$insert into public.food_portions (food_id, owner_id, label, grams, ml) values ('93900000-0000-4000-8000-000000000102', null, 'both', 30, 30)$$,
  '23514',
  'new row for relation "food_portions" violates check constraint "food_portions_at_most_one_of_grams_ml"',
  'a portion with both grams and ml is still refused'
);

reset role;

-- day_totals sums the nutrients core computed at write time, so an entry of a per portion food counts as any other.
insert into public.food_log_entries (id, user_id, local_date, logged_at, item_type, food_id, quantity, unit, portion_id, resolved_grams, snapshot, nutrients) values
  ('93900000-0000-4000-8000-0000000003a1', '93900000-0000-4000-8000-00000000000a', '2026-11-10', '2026-11-10 12:00:00+00', 'food',
    '93900000-0000-4000-8000-000000000101', 1.5, 'portion', '93900000-0000-4000-8000-000000000201', 0,
    '{"v":1,"kind":"food","basis":"per_portion","portion":{"label":"1 bucket"}}',
    '{"kcal":1875,"protein_g":120,"fat_g":105,"carbs_g":90,"fibre_g":null}'),
  ('93900000-0000-4000-8000-0000000003a2', '93900000-0000-4000-8000-00000000000a', '2026-11-10', '2026-11-10 18:00:00+00', 'quick',
    null, null, null, null, null,
    '{"v":1,"kind":"quick","label":"key939 quick"}',
    '{"kcal":125,"protein_g":null,"fat_g":null,"carbs_g":null,"fibre_g":null}');

set local role authenticated;
set local request.jwt.claims = '{"sub":"93900000-0000-4000-8000-00000000000a","role":"authenticated"}';

select is(
  (select kcal from public.day_totals where local_date = '2026-11-10'),
  2000::numeric,
  'day_totals sums the entry of a per portion food with the entries of the day'
);

select is(
  (select entry_count from public.day_totals where local_date = '2026-11-10'),
  2,
  'day_totals counts the entry of a per portion food'
);

reset role;

-- The default portion function (Amendment 17) never gives a food per portion an estimate. A restaurant food that
-- has no portion yet stays without one, and a food with its count portion keeps just that portion.
insert into public.foods (id, source, source_ref, name, basis, kcal) values
  ('93900000-0000-4000-8000-000000000103', 'restaurant', 'key939:no-portion-yet', 'key939 no portion yet', 'per_portion', 900);

select public.give_foods_default_portions(array['93900000-0000-4000-8000-000000000101', '93900000-0000-4000-8000-000000000103']::uuid[]);

select is(
  (select count(*)::int from public.food_portions where food_id = '93900000-0000-4000-8000-000000000103'),
  0,
  'a per portion food with no portion is not given an estimate'
);

select is(
  (select count(*)::int from public.food_portions where food_id = '93900000-0000-4000-8000-000000000101' and is_default and grams is null and ml is null and label = '1 bucket'),
  1,
  'a per portion food keeps its one count portion as its default'
);

select * from finish();

rollback;
