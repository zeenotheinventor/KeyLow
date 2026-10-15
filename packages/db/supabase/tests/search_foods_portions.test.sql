-- Asserts the default portion columns of public.search_foods (default_portion_id, _label, _grams, _ml):
-- the food's default portion when it has one, nulls when it has none, and never a portion the caller
-- cannot see under food_portions_select, because the join runs in the security invoker function.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back. Every fixture
-- id starts with 64000004- and every name carries the made up word "Quibblefen", so real foods cannot
-- change a result.

begin;

select plan(9);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '64000004-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'portions-user-a@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '64000004-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'portions-user-b@keylow.test');

insert into public.foods (id, source, source_ref, owner_id, name, basis) values
  ('64000004-0000-4000-8000-000000000101', 'cofid', 'CF-KEY64-P1', null, 'Quibblefen with default portion', 'per_100g'),
  ('64000004-0000-4000-8000-000000000102', 'cofid', 'CF-KEY64-P2', null, 'Quibblefen with no portion', 'per_100g'),
  ('64000004-0000-4000-8000-000000000103', 'cofid', 'CF-KEY64-P3', null, 'Quibblefen with only a spare portion', 'per_100g'),
  ('64000004-0000-4000-8000-000000000104', 'cofid', 'CF-KEY64-P4', null, 'Quibblefen with a millilitre default', 'per_100ml'),
  ('64000004-0000-4000-8000-000000000105', 'cofid', 'CF-KEY64-P5', null, 'Quibblefen with a hidden default', 'per_100g'),
  ('64000004-0000-4000-8000-000000000201', 'user', null, '64000004-0000-4000-8000-00000000000a', 'Quibblefen user A food', 'per_100g');

insert into public.food_portions (id, food_id, owner_id, label, grams, ml, is_default, position) values
  ('64000004-0000-4000-8000-000000000a01', '64000004-0000-4000-8000-000000000101', null, '1 slice', 30, null, true, 0),
  ('64000004-0000-4000-8000-000000000a02', '64000004-0000-4000-8000-000000000101', null, '1 cup', 240, null, false, 1),
  ('64000004-0000-4000-8000-000000000a03', '64000004-0000-4000-8000-000000000103', null, '1 spare', 10, null, false, 0),
  ('64000004-0000-4000-8000-000000000a04', '64000004-0000-4000-8000-000000000104', null, '1 glass', null, 250, true, 0),
  -- A default portion owned by user A on a global food. The app never creates one, so this proves the join
  -- itself respects food_portions_select and does not rely on the write policy.
  ('64000004-0000-4000-8000-000000000a05', '64000004-0000-4000-8000-000000000105', '64000004-0000-4000-8000-00000000000a', 'A secret serving', 99, null, true, 0),
  ('64000004-0000-4000-8000-000000000a06', '64000004-0000-4000-8000-000000000201', '64000004-0000-4000-8000-00000000000a', 'my bowl', 180, null, true, 0);

set local role authenticated;
set local request.jwt.claims = '{"sub":"64000004-0000-4000-8000-00000000000a","role":"authenticated"}';

select is(
  (
    select to_jsonb(r) - 'score' - 'quality'
    from public.search_foods('quibblefen with default portion', 50) r
    where r.id = '64000004-0000-4000-8000-000000000101'
  ) ->> 'default_portion_label',
  '1 slice',
  'a food with a default portion returns its label'
);

select is(
  (
    select array[r.default_portion_id::text, r.default_portion_grams::text, coalesce(r.default_portion_ml::text, 'null')]
    from public.search_foods('quibblefen with default portion', 50) r
    where r.id = '64000004-0000-4000-8000-000000000101'
  ),
  array['64000004-0000-4000-8000-000000000a01', '30', 'null'],
  'the portion id and grams come from the default row, not the spare one, and ml is null'
);

select is(
  (
    select array[r.default_portion_label, r.default_portion_ml::text, coalesce(r.default_portion_grams::text, 'null')]
    from public.search_foods('quibblefen millilitre', 50) r
    where r.id = '64000004-0000-4000-8000-000000000104'
  ),
  array['1 glass', '250', 'null'],
  'a millilitre default carries ml and a null grams'
);

select is(
  (
    select count(*)::int
    from public.search_foods('quibblefen', 50) r
    where r.id = '64000004-0000-4000-8000-000000000102'
      and r.default_portion_id is null and r.default_portion_label is null
      and r.default_portion_grams is null and r.default_portion_ml is null
  ),
  1,
  'a food with no portion returns all four default portion columns as null'
);

select is(
  (
    select count(*)::int
    from public.search_foods('quibblefen', 50) r
    where r.id = '64000004-0000-4000-8000-000000000103' and r.default_portion_id is null
  ),
  1,
  'a food whose only portion is not the default returns nulls'
);

select is(
  (
    select count(*)::int
    from public.search_foods('quibblefen', 50) r
    where r.id::text like '64000004-%'
  ),
  6,
  'a food with several portions is still one row, and every fixture is found once'
);

select is(
  (select r.default_portion_label from public.search_foods('quibblefen hidden default', 50) r where r.id = '64000004-0000-4000-8000-000000000105'),
  'A secret serving',
  'the owner of a portion sees it'
);

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"64000004-0000-4000-8000-00000000000b","role":"authenticated"}';

select is(
  (
    select count(*)::int
    from public.search_foods('quibblefen', 50) r
    where r.id::text like '64000004-%'
      and (r.default_portion_label in ('A secret serving', 'my bowl') or r.default_portion_id in (
        '64000004-0000-4000-8000-000000000a05', '64000004-0000-4000-8000-000000000a06'))
  ),
  0,
  'another user''s portion never leaks into a row'
);

select is(
  (
    select array_agg(r.id order by r.id)
    from public.search_foods('quibblefen hidden default', 50) r
    where r.id = '64000004-0000-4000-8000-000000000105' and r.default_portion_id is null and r.default_portion_label is null
  ),
  array['64000004-0000-4000-8000-000000000105']::uuid[],
  'the food itself still appears for user B, with its default portion columns null'
);

reset role;

select * from finish();

rollback;
