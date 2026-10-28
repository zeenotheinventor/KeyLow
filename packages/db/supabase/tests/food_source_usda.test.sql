-- Asserts the fourth food source of KEY-757: public.food_source lists usda after off, cofid and user,
-- a usda row is a global row (a source_ref, no owner), and a usda row with an owner is refused by the
-- same frozen rule that keeps cofid and off rows ownerless.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so nothing
-- created here persists.

begin;

select plan(4);

select enum_has_labels(
  'public',
  'food_source',
  array['off', 'cofid', 'user', 'usda'],
  'food_source is off, cofid, user and usda'
);

select lives_ok(
  $$ insert into public.foods (source, source_ref, name, basis) values ('usda', 'usda:757001', 'Chicken, thigh, raw, meat and skin', 'per_100g') $$,
  'a usda row with a source_ref and no owner is accepted'
);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '75700001-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'usda-owner@keylow.test');

select throws_ok(
  $$ insert into public.foods (source, source_ref, owner_id, name, basis) values ('usda', 'usda:757002', '75700001-0000-4000-8000-00000000000a', 'Owned usda', 'per_100g') $$,
  '23514',
  'new row for relation "foods" violates check constraint "foods_owner_matches_source"',
  'a usda row with an owner is refused'
);

select throws_ok(
  $$ insert into public.foods (source, source_ref, name, basis) values ('usda', 'usda:757001', 'Duplicate usda', 'per_100g') $$,
  '23505',
  'duplicate key value violates unique constraint "foods_source_source_ref_key"',
  'a second usda row with the same source_ref is refused'
);

select * from finish();

rollback;
