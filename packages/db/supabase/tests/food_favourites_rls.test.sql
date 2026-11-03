-- Asserts food favourites: the table, its exact privileges, owner-only row level security, the food
-- visibility and soft delete checks on insert, the cascades, ignoring a duplicate, and the cap of 30
-- (error KL004).
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so
-- nothing created here persists. Every fixture id starts with 29110300 and every name and email
-- with fav29-, and nothing asserts a whole-table count. Each actor is entered with `set local role`
-- plus the JWT claims that `auth.uid()` reads, and left with `reset role`.
--
-- Health data: no assertion or fixture here is a real list.

begin;

select plan(29);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '29110300-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'fav29-user-a@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '29110300-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'fav29-user-b@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '29110300-0000-4000-8000-00000000000c', 'authenticated', 'authenticated', 'fav29-user-c@keylow.test');

-- A global food, a private food for A and B, and a soft deleted private food for A.
insert into public.foods (id, source, source_ref, owner_id, name, basis, deleted_at) values
  ('29110300-0000-4000-8000-000000000101', 'cofid', 'FAV29-FOOD-1', null, 'fav29-global-rice', 'per_100g', null),
  ('29110300-0000-4000-8000-0000000001a1', 'user', null, '29110300-0000-4000-8000-00000000000a', 'fav29-a-private-food', 'per_100g', null),
  ('29110300-0000-4000-8000-0000000001a2', 'user', null, '29110300-0000-4000-8000-00000000000a', 'fav29-a-deleted-food', 'per_100g', now()),
  ('29110300-0000-4000-8000-0000000001b1', 'user', null, '29110300-0000-4000-8000-00000000000b', 'fav29-b-private-food', 'per_100g', null);

-- Thirty-two foods for C: thirty to meet the cap, and two more to try to go over it.
insert into public.foods (id, source, source_ref, owner_id, name, basis)
select
  ('29110300-0000-4000-8000-0000000003' || lpad(n::text, 2, '0'))::uuid,
  'user', null, '29110300-0000-4000-8000-00000000000c', 'fav29-c-food-' || n, 'per_100g'
from generate_series(1, 32) as n;

-- B already has a favourite, which A must never see.
insert into public.food_favourites (owner_id, food_id) values
  ('29110300-0000-4000-8000-00000000000b', '29110300-0000-4000-8000-000000000101');

-- Shape.
select has_table('public', 'food_favourites', 'food_favourites exists');
select col_is_pk('public', 'food_favourites', array['owner_id', 'food_id'], 'the key is owner and food');
select col_has_default('public', 'food_favourites', 'owner_id', 'owner_id defaults to the caller');
select table_privs_are('public', 'food_favourites', 'authenticated', array['SELECT', 'DELETE'], 'authenticated holds select and delete at table level');
select table_privs_are('public', 'food_favourites', 'anon', array[]::text[], 'anon holds nothing');
select table_privs_are('public', 'food_favourites', 'service_role', array[]::text[], 'service_role holds nothing');

select function_privs_are(
  'public', 'enforce_food_favourites_limit', array[]::name[], 'authenticated', array[]::text[],
  'authenticated cannot execute the cap trigger function'
);

-- A signs in.
set local role authenticated;
set local request.jwt.claims = '{"sub":"29110300-0000-4000-8000-00000000000a","role":"authenticated"}';

select lives_ok(
  $$ insert into public.food_favourites (food_id) values ('29110300-0000-4000-8000-000000000101') $$,
  'A favourites a global food'
);
select lives_ok(
  $$ insert into public.food_favourites (food_id) values ('29110300-0000-4000-8000-0000000001a1') $$,
  'A favourites an own private food'
);
select throws_ok(
  $$ insert into public.food_favourites (food_id) values ('29110300-0000-4000-8000-0000000001b1') $$,
  '42501', null,
  'A cannot favourite B''s private food'
);
select throws_ok(
  $$ insert into public.food_favourites (food_id) values ('29110300-0000-4000-8000-0000000001a2') $$,
  '42501', null,
  'A cannot newly favourite a soft deleted food'
);
select throws_ok(
  $$ insert into public.food_favourites (owner_id, food_id) values ('29110300-0000-4000-8000-00000000000b', '29110300-0000-4000-8000-0000000001a1') $$,
  '42501', null,
  'A cannot add a favourite for B'
);
select lives_ok(
  $$ insert into public.food_favourites (food_id) values ('29110300-0000-4000-8000-000000000101') on conflict do nothing $$,
  'favouriting twice with ignore duplicates raises no error'
);
select throws_ok(
  $$ insert into public.food_favourites (food_id) values ('29110300-0000-4000-8000-000000000101') $$,
  '23505', null,
  'a plain second insert is a duplicate key'
);
select results_eq(
  $$ select food_id::text from public.food_favourites order by food_id $$,
  $$ values ('29110300-0000-4000-8000-000000000101'), ('29110300-0000-4000-8000-0000000001a1') $$,
  'A sees exactly their own two favourites, once each'
);
select throws_ok(
  $$ update public.food_favourites set created_at = now() $$,
  '42501', null,
  'there is no update privilege'
);

delete from public.food_favourites where owner_id = '29110300-0000-4000-8000-00000000000b';
select is(
  (select count(*) from public.food_favourites where owner_id = '29110300-0000-4000-8000-00000000000b'), 0::bigint,
  'A sees none of B''s favourites'
);

-- B's row survives A's delete attempt (checked as B below). A removes their own.
delete from public.food_favourites where food_id = '29110300-0000-4000-8000-0000000001a1';
select is(
  (select count(*) from public.food_favourites where food_id = '29110300-0000-4000-8000-0000000001a1'), 0::bigint,
  'A removes their own favourite'
);

-- Soft delete a favourited food: the row stays, so a restore brings it back.
reset role;
update public.foods set deleted_at = now() where id = '29110300-0000-4000-8000-000000000101';
select is(
  (select count(*) from public.food_favourites where food_id = '29110300-0000-4000-8000-000000000101' and owner_id = '29110300-0000-4000-8000-00000000000a'), 1::bigint,
  'a soft deleted food keeps its favourite row'
);
update public.foods set deleted_at = null where id = '29110300-0000-4000-8000-000000000101';

-- B signs in and still has the favourite A tried to delete.
set local role authenticated;
set local request.jwt.claims = '{"sub":"29110300-0000-4000-8000-00000000000b","role":"authenticated"}';
select is(
  (select count(*) from public.food_favourites), 1::bigint,
  'B''s favourite survived A''s delete and B sees only their own'
);
reset role;

-- C meets the cap.
set local role authenticated;
set local request.jwt.claims = '{"sub":"29110300-0000-4000-8000-00000000000c","role":"authenticated"}';
select lives_ok(
  $$ insert into public.food_favourites (food_id)
     select ('29110300-0000-4000-8000-0000000003' || lpad(n::text, 2, '0'))::uuid from generate_series(1, 30) as n $$,
  'C holds 30 favourites'
);
select throws_ok(
  $$ insert into public.food_favourites (food_id) values ('29110300-0000-4000-8000-000000000331') $$,
  'KL004', 'favourite_limit',
  'the 31st favourite is refused with KL004'
);
select lives_ok(
  $$ insert into public.food_favourites (food_id) values ('29110300-0000-4000-8000-000000000301') on conflict do nothing $$,
  'favouriting a food already held at the cap is a no-op, not an error'
);

-- A favourite whose food is soft deleted does not count towards the cap.
reset role;
update public.foods set deleted_at = now() where id = '29110300-0000-4000-8000-000000000305';
set local role authenticated;
set local request.jwt.claims = '{"sub":"29110300-0000-4000-8000-00000000000c","role":"authenticated"}';
select lives_ok(
  $$ insert into public.food_favourites (food_id) values ('29110300-0000-4000-8000-000000000331') $$,
  'a favourite of a soft deleted food leaves room for another'
);
select throws_ok(
  $$ insert into public.food_favourites (food_id) values ('29110300-0000-4000-8000-000000000332') $$,
  'KL004', 'favourite_limit',
  'C is at 30 live favourites again, so the next is refused'
);

-- One statement that goes over the cap is refused as a whole.
delete from public.food_favourites
  where food_id in ('29110300-0000-4000-8000-000000000301', '29110300-0000-4000-8000-000000000302');
select throws_ok(
  $$ insert into public.food_favourites (food_id) values
       ('29110300-0000-4000-8000-000000000301'),
       ('29110300-0000-4000-8000-000000000302'),
       ('29110300-0000-4000-8000-000000000332') $$,
  'KL004', 'favourite_limit',
  'a single insert that would pass 30 is refused'
);
select is(
  (select count(*) from public.food_favourites
    where food_id in ('29110300-0000-4000-8000-000000000301', '29110300-0000-4000-8000-000000000302', '29110300-0000-4000-8000-000000000332')),
  0::bigint,
  'the refused statement wrote none of its rows'
);
reset role;

-- Cascades.
delete from public.foods where id = '29110300-0000-4000-8000-000000000331';
select is(
  (select count(*) from public.food_favourites where food_id = '29110300-0000-4000-8000-000000000331'), 0::bigint,
  'deleting a food deletes its favourites'
);
delete from auth.users where id = '29110300-0000-4000-8000-00000000000c';
select is(
  (select count(*) from public.food_favourites where owner_id = '29110300-0000-4000-8000-00000000000c'), 0::bigint,
  'deleting the account deletes its favourites'
);

select * from finish();
rollback;
