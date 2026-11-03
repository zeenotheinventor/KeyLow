-- Asserts recipe favourites: the table, its exact privileges, owner-only row level security, the
-- recipe visibility and archive checks on insert, the cascades, ignoring a duplicate, and the cap of 30
-- shared with food favourites (error KL004).
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so
-- nothing created here persists. Every fixture id starts with 29110301 and every name and email
-- with fav797-, and nothing asserts a whole-table count. Each actor is entered with `set local role`
-- plus the JWT claims that `auth.uid()` reads, and left with `reset role`.
--
-- Health data: no assertion or fixture here is a real list.

begin;

select plan(34);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '29110301-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'fav797-user-a@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '29110301-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'fav797-user-b@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '29110301-0000-4000-8000-00000000000c', 'authenticated', 'authenticated', 'fav797-user-c@keylow.test');

-- A has a live and an archived recipe, and B has one live recipe.
insert into public.recipes (id, owner_id, name, servings, computed, is_archived) values
  ('29110301-0000-4000-8000-000000000401', '29110301-0000-4000-8000-00000000000a', 'fav797-a-stew', 2, '{}', false),
  ('29110301-0000-4000-8000-000000000402', '29110301-0000-4000-8000-00000000000a', 'fav797-a-archived', 2, '{}', true),
  ('29110301-0000-4000-8000-0000000004b1', '29110301-0000-4000-8000-00000000000b', 'fav797-b-curry', 4, '{}', false);

-- Seventeen foods and eighteen recipes for C: thirty favourites to meet the cap, and four more
-- items to try to go over it.
insert into public.foods (id, source, source_ref, owner_id, name, basis)
select
  ('29110301-0000-4000-8000-0000000003' || lpad(n::text, 2, '0'))::uuid,
  'user', null, '29110301-0000-4000-8000-00000000000c', 'fav797-c-food-' || n, 'per_100g'
from generate_series(1, 17) as n;

insert into public.recipes (id, owner_id, name, servings, computed)
select
  ('29110301-0000-4000-8000-0000000004' || lpad(n::text, 2, '0'))::uuid,
  '29110301-0000-4000-8000-00000000000c', 'fav797-c-recipe-' || n, 2, '{}'
from generate_series(11, 28) as n;

-- B already has a favourite, which A must never see.
insert into public.recipe_favourites (owner_id, recipe_id) values
  ('29110301-0000-4000-8000-00000000000b', '29110301-0000-4000-8000-0000000004b1');

-- Shape.
select has_table('public', 'recipe_favourites', 'recipe_favourites exists');
select col_is_pk('public', 'recipe_favourites', array['owner_id', 'recipe_id'], 'the key is owner and recipe');
select col_has_default('public', 'recipe_favourites', 'owner_id', 'owner_id defaults to the caller');
select table_privs_are('public', 'recipe_favourites', 'authenticated', array['SELECT', 'DELETE'], 'authenticated holds select and delete at table level');
select table_privs_are('public', 'recipe_favourites', 'anon', array[]::text[], 'anon holds nothing');
select table_privs_are('public', 'recipe_favourites', 'service_role', array[]::text[], 'service_role holds nothing');
select function_privs_are(
  'public', 'enforce_recipe_favourites_limit', array[]::name[], 'authenticated', array[]::text[],
  'authenticated cannot execute the cap trigger function'
);
select has_trigger('public', 'recipe_favourites', 'recipe_favourites_limit', 'the cap trigger is on the table');

-- A signs in.
set local role authenticated;
set local request.jwt.claims = '{"sub":"29110301-0000-4000-8000-00000000000a","role":"authenticated"}';

select lives_ok(
  $$ insert into public.recipe_favourites (recipe_id) values ('29110301-0000-4000-8000-000000000401') $$,
  'A favourites an own recipe'
);
select throws_ok(
  $$ insert into public.recipe_favourites (recipe_id) values ('29110301-0000-4000-8000-0000000004b1') $$,
  '42501', null,
  'A cannot favourite B''s recipe'
);
select throws_ok(
  $$ insert into public.recipe_favourites (recipe_id) values ('29110301-0000-4000-8000-000000000402') $$,
  '42501', null,
  'A cannot newly favourite an archived recipe'
);
select throws_ok(
  $$ insert into public.recipe_favourites (owner_id, recipe_id) values ('29110301-0000-4000-8000-00000000000b', '29110301-0000-4000-8000-000000000401') $$,
  '42501', null,
  'A cannot add a favourite for B'
);
select lives_ok(
  $$ insert into public.recipe_favourites (recipe_id) values ('29110301-0000-4000-8000-000000000401') on conflict do nothing $$,
  'favouriting twice with ignore duplicates raises no error'
);
select throws_ok(
  $$ insert into public.recipe_favourites (recipe_id) values ('29110301-0000-4000-8000-000000000401') $$,
  '23505', null,
  'a plain second insert is a duplicate key'
);
select results_eq(
  $$ select recipe_id::text from public.recipe_favourites $$,
  $$ values ('29110301-0000-4000-8000-000000000401') $$,
  'A sees exactly their own one favourite, once'
);
select throws_ok(
  $$ update public.recipe_favourites set created_at = now() $$,
  '42501', null,
  'there is no update privilege'
);

delete from public.recipe_favourites where owner_id = '29110301-0000-4000-8000-00000000000b';
select is(
  (select count(*) from public.recipe_favourites where owner_id = '29110301-0000-4000-8000-00000000000b'), 0::bigint,
  'A sees none of B''s favourites'
);

-- Archive a favourited recipe: the row stays, so restoring the recipe brings it back.
reset role;
update public.recipes set is_archived = true where id = '29110301-0000-4000-8000-000000000401';
select is(
  (select count(*) from public.recipe_favourites where recipe_id = '29110301-0000-4000-8000-000000000401' and owner_id = '29110301-0000-4000-8000-00000000000a'), 1::bigint,
  'an archived recipe keeps its favourite row'
);
update public.recipes set is_archived = false where id = '29110301-0000-4000-8000-000000000401';

set local role authenticated;
set local request.jwt.claims = '{"sub":"29110301-0000-4000-8000-00000000000a","role":"authenticated"}';
delete from public.recipe_favourites where recipe_id = '29110301-0000-4000-8000-000000000401';
select is(
  (select count(*) from public.recipe_favourites where recipe_id = '29110301-0000-4000-8000-000000000401'), 0::bigint,
  'A removes their own favourite'
);
reset role;

-- B signs in and still has the favourite A tried to delete.
set local role authenticated;
set local request.jwt.claims = '{"sub":"29110301-0000-4000-8000-00000000000b","role":"authenticated"}';
select is(
  (select count(*) from public.recipe_favourites), 1::bigint,
  'B''s favourite survived A''s delete and B sees only their own'
);
reset role;

-- C meets the cap with fifteen foods and fifteen recipes.
set local role authenticated;
set local request.jwt.claims = '{"sub":"29110301-0000-4000-8000-00000000000c","role":"authenticated"}';
select lives_ok(
  $$ insert into public.food_favourites (food_id)
     select ('29110301-0000-4000-8000-0000000003' || lpad(n::text, 2, '0'))::uuid from generate_series(1, 15) as n $$,
  'C holds 15 food favourites'
);
select lives_ok(
  $$ insert into public.recipe_favourites (recipe_id)
     select ('29110301-0000-4000-8000-0000000004' || lpad(n::text, 2, '0'))::uuid from generate_series(11, 25) as n $$,
  'C holds 15 recipe favourites, 30 across both kinds'
);
select throws_ok(
  $$ insert into public.recipe_favourites (recipe_id) values ('29110301-0000-4000-8000-000000000426') $$,
  'KL004', 'favourite_limit',
  'the 31st favourite is refused with KL004 when it is a recipe'
);
select throws_ok(
  $$ insert into public.food_favourites (food_id) values ('29110301-0000-4000-8000-000000000316') $$,
  'KL004', 'favourite_limit',
  'the 31st favourite is refused with KL004 when it is a food'
);
select lives_ok(
  $$ insert into public.recipe_favourites (recipe_id) values ('29110301-0000-4000-8000-000000000411') on conflict do nothing $$,
  'favouriting a recipe already held at the cap is a no-op, not an error'
);
select lives_ok(
  $$ insert into public.food_favourites (food_id) values ('29110301-0000-4000-8000-000000000301') on conflict do nothing $$,
  'favouriting a food already held at the cap is a no-op, not an error'
);

-- A favourite whose recipe is archived does not count towards the cap.
reset role;
update public.recipes set is_archived = true where id = '29110301-0000-4000-8000-000000000425';
set local role authenticated;
set local request.jwt.claims = '{"sub":"29110301-0000-4000-8000-00000000000c","role":"authenticated"}';
select lives_ok(
  $$ insert into public.food_favourites (food_id) values ('29110301-0000-4000-8000-000000000316') $$,
  'a favourite of an archived recipe leaves room for a food'
);
select throws_ok(
  $$ insert into public.recipe_favourites (recipe_id) values ('29110301-0000-4000-8000-000000000426') $$,
  'KL004', 'favourite_limit',
  'C is at 30 live favourites again, so the next recipe is refused'
);

-- A favourite whose food is soft deleted does not count towards the cap either.
reset role;
update public.foods set deleted_at = now() where id = '29110301-0000-4000-8000-000000000315';
set local role authenticated;
set local request.jwt.claims = '{"sub":"29110301-0000-4000-8000-00000000000c","role":"authenticated"}';
select lives_ok(
  $$ insert into public.recipe_favourites (recipe_id) values ('29110301-0000-4000-8000-000000000426') $$,
  'a favourite of a soft deleted food leaves room for a recipe'
);
select throws_ok(
  $$ insert into public.food_favourites (food_id) values ('29110301-0000-4000-8000-000000000317') $$,
  'KL004', 'favourite_limit',
  'C is at 30 live favourites again, so the next food is refused'
);

-- One statement that goes over the cap is refused as a whole.
delete from public.food_favourites where food_id = '29110301-0000-4000-8000-000000000301';
delete from public.recipe_favourites where recipe_id = '29110301-0000-4000-8000-000000000411';
select throws_ok(
  $$ insert into public.recipe_favourites (recipe_id) values ('29110301-0000-4000-8000-000000000411'), ('29110301-0000-4000-8000-000000000427'), ('29110301-0000-4000-8000-000000000428') $$,
  'KL004', 'favourite_limit',
  'a single insert that would pass 30 is refused'
);
select is(
  (select count(*) from public.recipe_favourites where recipe_id in ('29110301-0000-4000-8000-000000000411', '29110301-0000-4000-8000-000000000427')), 0::bigint,
  'the refused statement wrote none of its rows'
);
reset role;

-- Cascades.
delete from public.recipes where id = '29110301-0000-4000-8000-000000000426';
select is(
  (select count(*) from public.recipe_favourites where recipe_id = '29110301-0000-4000-8000-000000000426'), 0::bigint,
  'deleting a recipe deletes its favourites'
);
delete from auth.users where id = '29110301-0000-4000-8000-00000000000c';
select is(
  (select count(*) from public.recipe_favourites where owner_id = '29110301-0000-4000-8000-00000000000c'), 0::bigint,
  'deleting the account deletes its favourites'
);

select * from finish();
rollback;
