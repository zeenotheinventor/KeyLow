-- Asserts the row level security and check constraints on
-- public.food_portions (ADR 0003 and its Amendment 1): portions of global
-- foods are readable by everyone signed in, portions of a user food are
-- readable and writable only by that food's owner, a portion can be attached
-- only to the writer's own user food, and the table's own rules reject
-- ambiguous quantities and a second default portion.
--
-- `supabase test db` runs this file as postgres inside a transaction that is
-- rolled back, so nothing created here persists. Each actor is entered with
-- `set local role` plus the JWT claims that `auth.uid()` reads, and left with
-- `reset role`.

begin;

select plan(42);

-- Two users. The on_auth_user_created trigger creates their profiles rows.
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '36000002-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'portions-user-a@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '36000002-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'portions-user-b@keylow.test');

-- Fixture rows, inserted as postgres so row level security does not apply.
-- One global food, a food for each user, and a portion on each of them. The
-- portions of user A's food are one default and one plain, the global one
-- is a millilitre portion.
insert into public.foods (id, source, source_ref, owner_id, name, basis) values
  ('36000002-0000-4000-8000-000000000101', 'cofid', 'CF-PORTIONS-1', null, 'Fixture global milk', 'per_100ml'),
  ('36000002-0000-4000-8000-0000000001a1', 'user', null, '36000002-0000-4000-8000-00000000000a', 'Fixture A bread', 'per_100g'),
  ('36000002-0000-4000-8000-0000000001b1', 'user', null, '36000002-0000-4000-8000-00000000000b', 'Fixture B cake', 'per_100g');

insert into public.food_portions (id, food_id, owner_id, label, grams, ml, is_default, position) values
  ('36000002-0000-4000-8000-000000000201', '36000002-0000-4000-8000-000000000101', null, 'glass', null, 200, true, 0),
  ('36000002-0000-4000-8000-0000000002a1', '36000002-0000-4000-8000-0000000001a1', '36000002-0000-4000-8000-00000000000a', 'slice', 30, null, true, 0),
  ('36000002-0000-4000-8000-0000000002a2', '36000002-0000-4000-8000-0000000001a1', '36000002-0000-4000-8000-00000000000a', 'thick slice', 45, null, false, 1),
  ('36000002-0000-4000-8000-0000000002b1', '36000002-0000-4000-8000-0000000001b1', '36000002-0000-4000-8000-00000000000b', 'wedge', 80, null, true, 0);

-- Table level facts.
select ok(
  (select relrowsecurity from pg_class where oid = 'public.food_portions'::regclass),
  'row level security is enabled on food_portions'
);

-- Check constraints, exercised as postgres so only the table's own rules fire.
select throws_ok(
  $$insert into public.food_portions (food_id, owner_id, label, grams, ml) values ('36000002-0000-4000-8000-0000000001a1', '36000002-0000-4000-8000-00000000000a', 'both', 30, 30)$$,
  '23514',
  'new row for relation "food_portions" violates check constraint "food_portions_exactly_one_of_grams_ml"',
  'a portion with both grams and ml is rejected'
);

select throws_ok(
  $$insert into public.food_portions (food_id, owner_id, label) values ('36000002-0000-4000-8000-0000000001a1', '36000002-0000-4000-8000-00000000000a', 'neither')$$,
  '23514',
  'new row for relation "food_portions" violates check constraint "food_portions_exactly_one_of_grams_ml"',
  'a portion with neither grams nor ml is rejected'
);

select throws_ok(
  $$insert into public.food_portions (food_id, owner_id, label, grams) values ('36000002-0000-4000-8000-0000000001a1', '36000002-0000-4000-8000-00000000000a', 'zero grams', 0)$$,
  '23514',
  'new row for relation "food_portions" violates check constraint "food_portions_grams_check"',
  'a portion of zero grams is rejected'
);

select throws_ok(
  $$insert into public.food_portions (food_id, owner_id, label, ml) values ('36000002-0000-4000-8000-0000000001a1', '36000002-0000-4000-8000-00000000000a', 'negative ml', -5)$$,
  '23514',
  'new row for relation "food_portions" violates check constraint "food_portions_ml_check"',
  'a portion with a negative ml is rejected'
);

select throws_ok(
  $$insert into public.food_portions (food_id, owner_id, label, grams, is_default) values ('36000002-0000-4000-8000-0000000001a1', '36000002-0000-4000-8000-00000000000a', 'second default', 50, true)$$,
  '23505',
  'duplicate key value violates unique constraint "food_portions_one_default_per_food_idx"',
  'a second default portion on the same food is rejected'
);

select lives_ok(
  $$insert into public.food_portions (food_id, owner_id, label, grams, is_default) values ('36000002-0000-4000-8000-0000000001a1', '36000002-0000-4000-8000-00000000000a', 'another non-default', 50, false)$$,
  'any number of non-default portions can share a food'
);

select throws_ok(
  $$insert into public.food_portions (food_id, owner_id, label, grams) values (gen_random_uuid(), '36000002-0000-4000-8000-00000000000a', 'orphan', 10)$$,
  '23503',
  'insert or update on table "food_portions" violates foreign key constraint "food_portions_food_id_fkey"',
  'a portion must point at an existing food'
);

-- Anon: nothing at all.
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  'select * from public.food_portions',
  '42501',
  'permission denied for table food_portions',
  'anon cannot select from food_portions'
);

select throws_ok(
  $$insert into public.food_portions (food_id, owner_id, label, grams) values ('36000002-0000-4000-8000-0000000001a1', '36000002-0000-4000-8000-00000000000a', 'anon portion', 10)$$,
  '42501',
  'permission denied for table food_portions',
  'anon cannot insert into food_portions'
);

reset role;

-- User A: reads.
set local role authenticated;
set local request.jwt.claims = '{"sub":"36000002-0000-4000-8000-00000000000a","role":"authenticated"}';

select is(
  (select count(*)::int from public.food_portions where id = '36000002-0000-4000-8000-000000000201'),
  1,
  'user A can select a portion of a global food'
);

select is(
  (select count(*)::int from public.food_portions where id in ('36000002-0000-4000-8000-0000000002a1', '36000002-0000-4000-8000-0000000002a2')),
  2,
  'user A can select the portions of their own food'
);

select is(
  (select count(*)::int from public.food_portions where id = '36000002-0000-4000-8000-0000000002b1'),
  0,
  'user A cannot select the portions of user B''s food'
);

-- User A: inserts.
select lives_ok(
  $$insert into public.food_portions (food_id, owner_id, label, ml) values ('36000002-0000-4000-8000-0000000001a1', '36000002-0000-4000-8000-00000000000a', 'cup', 240)$$,
  'user A can add a portion to their own food'
);

select is(
  (select ml::text || '|' || (owner_id = '36000002-0000-4000-8000-00000000000a')::text from public.food_portions where food_id = '36000002-0000-4000-8000-0000000001a1' and label = 'cup'),
  '240|true',
  'the added portion is stored with its ml and user A as owner'
);

select throws_ok(
  $$insert into public.food_portions (food_id, owner_id, label, grams) values ('36000002-0000-4000-8000-0000000001b1', '36000002-0000-4000-8000-00000000000a', 'attached to B', 10)$$,
  '42501',
  'new row violates row-level security policy for table "food_portions"',
  'user A cannot attach a portion to user B''s food, even claiming it as their own'
);

select throws_ok(
  $$insert into public.food_portions (food_id, owner_id, label, grams) values ('36000002-0000-4000-8000-0000000001b1', '36000002-0000-4000-8000-00000000000b', 'attached as B', 10)$$,
  '42501',
  'new row violates row-level security policy for table "food_portions"',
  'user A cannot attach a portion to user B''s food by spoofing owner_id'
);

select throws_ok(
  $$insert into public.food_portions (food_id, owner_id, label, grams) values ('36000002-0000-4000-8000-0000000001a1', null, 'ownerless', 10)$$,
  '42501',
  'new row violates row-level security policy for table "food_portions"',
  'user A cannot insert a portion with no owner_id'
);

select throws_ok(
  $$insert into public.food_portions (food_id, owner_id, label, grams) values ('36000002-0000-4000-8000-000000000101', null, 'global portion', 10)$$,
  '42501',
  'new row violates row-level security policy for table "food_portions"',
  'user A cannot add a global portion to a global food'
);

select throws_ok(
  $$insert into public.food_portions (food_id, owner_id, label, grams) values ('36000002-0000-4000-8000-000000000101', '36000002-0000-4000-8000-00000000000a', 'owned portion on global', 10)$$,
  '42501',
  'new row violates row-level security policy for table "food_portions"',
  'user A cannot add an owned portion to a global food'
);

-- User A: updates.
select lives_ok(
  $$update public.food_portions set label = 'large slice', grams = 35 where id = '36000002-0000-4000-8000-0000000002a1'$$,
  'user A can update their own portion'
);

select is(
  (select label from public.food_portions where id = '36000002-0000-4000-8000-0000000002a1'),
  'large slice',
  'user A sees the updated label on their own portion'
);

select throws_ok(
  $$update public.food_portions set food_id = '36000002-0000-4000-8000-0000000001b1' where id = '36000002-0000-4000-8000-0000000002a1'$$,
  '42501',
  'new row violates row-level security policy for table "food_portions"',
  'user A cannot move their portion onto user B''s food'
);

select throws_ok(
  $$update public.food_portions set owner_id = '36000002-0000-4000-8000-00000000000b' where id = '36000002-0000-4000-8000-0000000002a1'$$,
  '42501',
  'new row violates row-level security policy for table "food_portions"',
  'user A cannot hand their portion to another owner'
);

select lives_ok(
  $$update public.food_portions set label = 'hijacked' where id = '36000002-0000-4000-8000-0000000002b1'$$,
  'user A updating user B''s portion is silently filtered, not an error'
);

select lives_ok(
  $$update public.food_portions set label = 'hijacked' where id = '36000002-0000-4000-8000-000000000201'$$,
  'user A updating a global portion is silently filtered, not an error'
);

-- User A: deletes.
select lives_ok(
  $$delete from public.food_portions where id = '36000002-0000-4000-8000-0000000002b1'$$,
  'user A deleting user B''s portion is silently filtered, not an error'
);

select lives_ok(
  $$delete from public.food_portions where id = '36000002-0000-4000-8000-000000000201'$$,
  'user A deleting a global portion is silently filtered, not an error'
);

reset role;

-- Postgres sees what user A's statements actually did.
select is(
  (select label from public.food_portions where id = '36000002-0000-4000-8000-0000000002b1') || '/' || (select label from public.food_portions where id = '36000002-0000-4000-8000-000000000201'),
  'wedge/glass',
  'user B''s and the global portion are unchanged after user A tried to update them'
);

select is(
  (select count(*)::int from public.food_portions where id in ('36000002-0000-4000-8000-0000000002b1', '36000002-0000-4000-8000-000000000201')),
  2,
  'user B''s and the global portion still exist after user A tried to delete them'
);

-- User A: replace a food's portions, the way the custom food form saves them.
set local role authenticated;
set local request.jwt.claims = '{"sub":"36000002-0000-4000-8000-00000000000a","role":"authenticated"}';

select lives_ok(
  $$delete from public.food_portions where food_id = '36000002-0000-4000-8000-0000000001a1'$$,
  'user A can delete all of their own portions on a food'
);

select lives_ok(
  $$insert into public.food_portions (food_id, owner_id, label, grams, is_default, position) values
      ('36000002-0000-4000-8000-0000000001a1', '36000002-0000-4000-8000-00000000000a', 'new default', 40, true, 0),
      ('36000002-0000-4000-8000-0000000001a1', '36000002-0000-4000-8000-00000000000a', 'new second', 60, false, 1)$$,
  'user A can then insert a replacement set with one default'
);

select is(
  (select count(*)::int from public.food_portions where food_id = '36000002-0000-4000-8000-0000000001a1'),
  2,
  'user A sees exactly the replacement portions'
);

reset role;

-- User B: reads and writes.
set local role authenticated;
set local request.jwt.claims = '{"sub":"36000002-0000-4000-8000-00000000000b","role":"authenticated"}';

select is(
  (select count(*)::int from public.food_portions where food_id = '36000002-0000-4000-8000-0000000001a1'),
  0,
  'user B cannot select user A''s portions'
);

select is(
  (select count(*)::int from public.food_portions where id in ('36000002-0000-4000-8000-000000000201', '36000002-0000-4000-8000-0000000002b1')),
  2,
  'user B can select the global portion and their own'
);

select lives_ok(
  $$delete from public.food_portions where food_id = '36000002-0000-4000-8000-0000000001a1'$$,
  'user B deleting user A''s portions is silently filtered, not an error'
);

reset role;

select is(
  (select count(*)::int from public.food_portions where food_id = '36000002-0000-4000-8000-0000000001a1'),
  2,
  'user A''s portions are still there after user B tried to delete them'
);

-- Service role: writes portions of global foods.
set local role service_role;

select lives_ok(
  $$insert into public.food_portions (food_id, owner_id, label, ml) values ('36000002-0000-4000-8000-000000000101', null, 'carton', 1000)$$,
  'service_role can insert a portion with a null owner_id on a global food'
);

select is(
  (select (owner_id is null)::text || '|' || ml::text from public.food_portions where food_id = '36000002-0000-4000-8000-000000000101' and label = 'carton'),
  'true|1000',
  'the service role portion is global and keeps its ml'
);

select lives_ok(
  $$delete from public.food_portions where food_id = '36000002-0000-4000-8000-000000000101' and label = 'carton'$$,
  'service_role can delete a portion'
);

select is(
  (select count(*)::int from public.food_portions where food_id = '36000002-0000-4000-8000-000000000101' and label = 'carton'),
  0,
  'the portion is gone after the service role deleted it'
);

reset role;

-- Cascade.
delete from public.foods where id = '36000002-0000-4000-8000-0000000001a1';

select is(
  (select count(*)::int from public.food_portions where food_id = '36000002-0000-4000-8000-0000000001a1'),
  0,
  'deleting a food deletes its portions'
);

select * from finish();

rollback;
