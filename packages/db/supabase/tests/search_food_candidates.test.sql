-- Asserts public.search_food_candidate_ids (KEY-59), the security definer helper that lets search_foods use
-- the gin indexes, and that search_foods stays safe on top of it: another user's food never appears, the
-- caller's own food does, a soft deleted food does not, and the helper can only be called by the roles that
-- need it.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back. Every fixture id
-- starts with 64000002- and every name carries the made up word "Vexhollow", so real foods cannot change a
-- result. Each actor is entered with `set local role` plus the JWT claims that `auth.uid()` reads.

begin;

select plan(15);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '64000002-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'candidates-user-a@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '64000002-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'candidates-user-b@keylow.test');

insert into public.foods (id, source, source_ref, owner_id, name, basis, deleted_at) values
  ('64000002-0000-4000-8000-000000000101', 'cofid', 'CF-KEY64-G1', null, 'Vexhollow global stew', 'per_100g', null),
  ('64000002-0000-4000-8000-000000000102', 'cofid', 'CF-KEY64-G2', null, 'Vexhollow deleted global stew', 'per_100g', '2026-10-01 12:00:00+00'),
  ('64000002-0000-4000-8000-000000000201', 'user', null, '64000002-0000-4000-8000-00000000000a', 'Vexhollow user A stew', 'per_100g', null),
  ('64000002-0000-4000-8000-000000000202', 'user', null, '64000002-0000-4000-8000-00000000000a', 'Vexhollow deleted user A stew', 'per_100g', '2026-10-01 12:00:00+00'),
  ('64000002-0000-4000-8000-000000000301', 'user', null, '64000002-0000-4000-8000-00000000000b', 'Vexhollow user B stew', 'per_100g', null);

-- Function shape and privileges.
select ok(
  (select prosecdef from pg_proc where oid = 'public.search_food_candidate_ids(text, tsquery)'::regprocedure),
  'the candidate helper is security definer, so the planner may use the gin indexes'
);

select ok(
  (select proconfig @> array['search_path=""', 'row_security=off'] from pg_proc where oid = 'public.search_food_candidate_ids(text, tsquery)'::regprocedure),
  'the candidate helper pins an empty search_path and turns row level security off'
);

select ok(
  not (select prosecdef from pg_proc where oid = 'public.search_foods(text, integer)'::regprocedure),
  'search_foods stays security invoker, so row level security has the last word on the rows it returns'
);

select ok(
  not exists (
    select 1
    from pg_proc p, aclexplode(p.proacl) as acl
    where p.oid = 'public.search_food_candidate_ids(text, tsquery)'::regprocedure and acl.grantee = 0
  ),
  'the candidate helper has no execute grant to public'
);

select ok(
  not has_function_privilege('anon', 'public.search_food_candidate_ids(text, tsquery)', 'execute'),
  'anon holds no execute privilege on the candidate helper'
);

select ok(
  has_function_privilege('authenticated', 'public.search_food_candidate_ids(text, tsquery)', 'execute')
    and has_function_privilege('service_role', 'public.search_food_candidate_ids(text, tsquery)', 'execute'),
  'authenticated and service_role can execute the candidate helper'
);

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  $$ select * from public.search_food_candidate_ids('vexhollow', to_tsquery('english', 'vexhollow:*')) $$,
  '42501',
  'permission denied for function search_food_candidate_ids',
  'anon cannot call the candidate helper'
);

reset role;

-- User A.
set local role authenticated;
set local request.jwt.claims = '{"sub":"64000002-0000-4000-8000-00000000000a","role":"authenticated"}';

select is(
  (
    select array_agg(r.id order by r.id)
    from public.search_foods('vexhollow', 50) r
    where r.id::text like '64000002-%'
  ),
  array[
    '64000002-0000-4000-8000-000000000101',
    '64000002-0000-4000-8000-000000000201'
  ]::uuid[],
  'user A finds the global food and their own, and neither user B''s food nor any soft deleted food'
);

select is(
  (
    select array_agg(c.id order by c.id)
    from public.search_food_candidate_ids('vexhollow', to_tsquery('english', 'vexhollow:*')) as c (id)
    where c.id::text like '64000002-%'
  ),
  array[
    '64000002-0000-4000-8000-000000000101',
    '64000002-0000-4000-8000-000000000201'
  ]::uuid[],
  'the helper applies the same visibility itself: global and own, never another user''s, never soft deleted'
);

select is(
  (
    select count(*)::int
    from public.search_foods('vexhollow user B', 50) r
    where r.id = '64000002-0000-4000-8000-000000000301'
  ),
  0,
  'user B''s food stays out even when the query is its exact name'
);

select is(
  (
    select array_agg(c.id order by c.id)
    from public.search_food_candidate_ids('vexhollow', null) as c (id)
    where c.id::text like '64000002-%'
  ),
  array[
    '64000002-0000-4000-8000-000000000101',
    '64000002-0000-4000-8000-000000000201'
  ]::uuid[],
  'a null tsquery is answered by the trigram arm alone, under the same visibility'
);

reset role;

-- User B.
set local role authenticated;
set local request.jwt.claims = '{"sub":"64000002-0000-4000-8000-00000000000b","role":"authenticated"}';

select is(
  (
    select array_agg(r.id order by r.id)
    from public.search_foods('vexhollow', 50) r
    where r.id::text like '64000002-%'
  ),
  array[
    '64000002-0000-4000-8000-000000000101',
    '64000002-0000-4000-8000-000000000301'
  ]::uuid[],
  'user B finds the global food and their own, and never user A''s'
);

select is(
  (
    select count(*)::int
    from public.search_food_candidate_ids('vexhollow', to_tsquery('english', 'vexhollow:*')) as c (id)
    where c.id in ('64000002-0000-4000-8000-000000000201', '64000002-0000-4000-8000-000000000202')
  ),
  0,
  'the helper never returns user A''s ids to user B'
);

reset role;

-- The service role bypasses row level security, so it sees every live food, and the helper agrees.
set local role service_role;

select is(
  (
    select array_agg(r.id order by r.id)
    from public.search_foods('vexhollow', 50) r
    where r.id::text like '64000002-%'
  ),
  array[
    '64000002-0000-4000-8000-000000000101',
    '64000002-0000-4000-8000-000000000201',
    '64000002-0000-4000-8000-000000000301'
  ]::uuid[],
  'the service role finds every live food, as it does without the helper'
);

reset role;

-- A caller with no user at all (a JWT without a sub) owns nothing.
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated"}';

select is(
  (
    select array_agg(r.id order by r.id)
    from public.search_foods('vexhollow', 50) r
    where r.id::text like '64000002-%'
  ),
  array['64000002-0000-4000-8000-000000000101']::uuid[],
  'an authenticated caller without a user id finds only the global food'
);

reset role;

select * from finish();

rollback;
