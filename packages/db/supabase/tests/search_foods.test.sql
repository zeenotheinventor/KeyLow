-- Asserts public.search_foods(q, lim): the local food search both apps use.
-- Full text plus trigram matching, own food and CoFID boosts, row level
-- security through security invoker, and the guards on its two arguments.
--
-- `supabase test db` runs this file as postgres inside a transaction that is
-- rolled back, so nothing created here persists. Every fixture id starts with
-- 41000001- and every source_ref with CF-KEY41- or OFF-KEY41-, and every
-- assertion looks only at rows with that id prefix, so foods that other tests
-- or a real import put in the table cannot change a result. The chicken and
-- yogurt fixtures carry the made up word "Zorblax" in their names and every
-- query for them starts with it, so a real catalogue with hundreds of chicken
-- foods cannot push a fixture off the page, which is capped at 50 rows. Each
-- actor is entered with `set local role` plus the JWT claims that `auth.uid()`
-- reads, and left with `reset role`.

begin;

select plan(32);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '41000001-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'search-foods-user-a@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '41000002-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'search-foods-user-b@keylow.test');

-- Fixture rows, inserted as postgres so row level security does not apply.
-- The names echo real CoFID and Open Food Facts rows.
insert into public.foods (id, source, source_ref, owner_id, name, brand, basis, fetched_at, deleted_at) values
  ('41000001-0000-4000-8000-000000000101', 'cofid', 'CF-KEY41-1', null, 'Zorblax chicken, breast, raw', null, 'per_100g', null, null),
  ('41000001-0000-4000-8000-000000000102', 'off', 'OFF-KEY41-1', null, 'Zorblax chicken breast fillets', 'Fixture Farm', 'per_100g', '2026-10-01 12:00:00+00', null),
  ('41000001-0000-4000-8000-000000000103', 'cofid', 'CF-KEY41-2', null, 'Zorblax chickpeas, dried, boiled', null, 'per_100g', null, null),
  ('41000001-0000-4000-8000-000000000104', 'cofid', 'CF-KEY41-3', null, 'Zorblax chicken, leg, roasted', null, 'per_100g', null, null),
  ('41000001-0000-4000-8000-000000000105', 'cofid', 'CF-KEY41-4', null, 'Porridge oats', null, 'per_100g', null, null),
  ('41000001-0000-4000-8000-000000000106', 'cofid', 'CF-KEY41-5', null, 'Zorblax yogurt, Greek style, plain', null, 'per_100g', null, null),
  -- One global food and one of user A's with the same name, plus a deleted
  -- copy of each.
  ('41000001-0000-4000-8000-000000000201', 'cofid', 'CF-KEY41-6', null, 'Zanzibar lentil stew', null, 'per_100g', null, null),
  ('41000001-0000-4000-8000-000000000202', 'user', null, '41000001-0000-4000-8000-00000000000a', 'Zanzibar lentil stew', null, 'per_100g', null, null),
  ('41000001-0000-4000-8000-000000000203', 'user', null, '41000001-0000-4000-8000-00000000000a', 'Zanzibar lentil stew', null, 'per_100g', null, '2026-10-01 12:00:00+00'),
  ('41000001-0000-4000-8000-000000000204', 'cofid', 'CF-KEY41-7', null, 'Zanzibar lentil stew', null, 'per_100g', null, '2026-10-01 12:00:00+00');

-- Sixty foods that all match one made up word, to exercise the row limit.
insert into public.foods (id, source, source_ref, name, basis)
select
  ('41000001-0000-4000-8000-' || lpad((1000 + n)::text, 12, '0'))::uuid,
  'cofid',
  'CF-KEY41-CLAMP-' || n,
  'Clampfixture item ' || n,
  'per_100g'
from generate_series(1, 60) as n;

-- Function shape.
select ok(
  not (select prosecdef from pg_proc where oid = 'public.search_foods(text, integer)'::regprocedure),
  'search_foods is security invoker, so row level security on foods applies to the caller'
);

select ok(
  (select proconfig @> array['search_path=""'] from pg_proc where oid = 'public.search_foods(text, integer)'::regprocedure),
  'search_foods pins an empty search_path'
);

select is(
  (
    select array_agg(output.name order by output.position)
    from pg_proc p,
      unnest(p.proargnames, p.proargmodes) with ordinality as output (name, mode, position)
    where p.oid = 'public.search_foods(text, integer)'::regprocedure and output.mode = 't'
  ),
  (
    select array_agg(attname::text order by attnum) || array['score']
    from pg_attribute
    where attrelid = 'public.foods'::regclass and attnum > 0 and not attisdropped
      and attname <> 'search'
  ),
  'search_foods returns every foods column except search, in table order, then score'
);

select throws_ok(
  $$ select search from public.search_foods('chicken', 25) $$,
  '42703',
  'column "search" does not exist',
  'the returned rows have no search column'
);

-- Privileges.
select ok(
  not has_function_privilege('anon', 'public.search_foods(text, integer)', 'execute'),
  'anon holds no execute privilege on search_foods'
);

select ok(
  has_function_privilege('authenticated', 'public.search_foods(text, integer)', 'execute')
    and has_function_privilege('service_role', 'public.search_foods(text, integer)', 'execute'),
  'authenticated and service_role can execute search_foods'
);

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  $$ select * from public.search_foods('chicken', 25) $$,
  '42501',
  'permission denied for function search_foods',
  'anon cannot call search_foods'
);

reset role;

-- User A searches.
set local role authenticated;
set local request.jwt.claims = '{"sub":"41000001-0000-4000-8000-00000000000a","role":"authenticated"}';

select is(
  (select array_agg(r.name order by r.name) from public.search_foods('zorblax chick', 50) r where r.id::text like '41000001-%'),
  array['Zorblax chicken breast fillets', 'Zorblax chicken, breast, raw', 'Zorblax chicken, leg, roasted', 'Zorblax chickpeas, dried, boiled'],
  'a half typed word matches by prefix and leaves the unrelated fixtures out'
);

select is(
  (select array_agg(r.name order by r.name) from public.search_foods('  zorblax chick  ', 50) r where r.id::text like '41000001-%'),
  array['Zorblax chicken breast fillets', 'Zorblax chicken, breast, raw', 'Zorblax chicken, leg, roasted', 'Zorblax chickpeas, dried, boiled'],
  'surrounding whitespace in the query is ignored'
);

select is(
  (
    select (array_agg(r.source_ref order by r.score desc, r.name))[1]
    from public.search_foods('zorblax chicken breast', 50) r where r.id::text like '41000001-%'
  ),
  'CF-KEY41-1',
  'the CoFID chicken breast ranks first for "chicken breast"'
);

select ok(
  (select r.score from public.search_foods('zorblax chicken breast', 50) r where r.source_ref = 'CF-KEY41-1')
    > (select r.score from public.search_foods('zorblax chicken breast', 50) r where r.source_ref = 'OFF-KEY41-1'),
  'the CoFID chicken breast scores above the Open Food Facts chicken breast fillets'
);

select ok(
  not exists (
    select 1
    from public.search_foods('zorblax chicken breast', 50) chickpeas
    where chickpeas.source_ref = 'CF-KEY41-2'
      and chickpeas.score >= (select r.score from public.search_foods('zorblax chicken breast', 50) r where r.source_ref = 'CF-KEY41-1')
  ),
  'chickpeas never rank at or above the CoFID chicken breast'
);

select is(
  (
    select (array_agg(r.source_ref order by r.score desc, r.name))[array_length(array_agg(r.source_ref), 1)]
    from public.search_foods('zorblax chicken', 50) r where r.id::text like '41000001-%'
  ),
  'CF-KEY41-2',
  'chickpeas rank last among the fixtures for "chicken"'
);

select ok(
  exists (select 1 from public.search_foods('zorblax greek yoghurt', 50) r where r.source_ref = 'CF-KEY41-5'),
  '"greek yoghurt" finds the CoFID "yogurt, Greek style, plain"'
);

select ok(
  not (select search @@ plainto_tsquery('english', 'zorblax greek yoghurt') from public.foods where source_ref = 'CF-KEY41-5'),
  'full text search alone cannot match that spelling, so the trigram arm carried the result'
);

select is(
  (
    select array_agg(coalesce(r.source_ref, 'own') order by r.score desc, r.name)
    from public.search_foods('zanzibar lentil', 50) r where r.id::text like '41000001-%'
  ),
  array['own', 'CF-KEY41-6'],
  'the user''s own food ranks above an otherwise identical CoFID food'
);

select ok(
  (select r.score from public.search_foods('zanzibar lentil', 50) r where r.id = '41000001-0000-4000-8000-000000000202')
    > (select r.score from public.search_foods('zanzibar lentil', 50) r where r.id = '41000001-0000-4000-8000-000000000201'),
  'the own food boost is a strictly higher score, not a tie broken by name'
);

select is(
  (
    select count(*)::int
    from public.search_foods('zanzibar lentil', 50) r
    where r.id in ('41000001-0000-4000-8000-000000000203', '41000001-0000-4000-8000-000000000204')
  ),
  0,
  'soft deleted foods are never returned, whether the user''s own or global'
);

-- Limit and length guards.
select is(
  (select count(*)::int from public.search_foods('clampfixture', 500) r where r.id::text like '41000001-%'),
  50,
  'a limit of 500 is clamped to 50 rows'
);

select is(
  (select count(*)::int from public.search_foods('clampfixture', 0) r where r.id::text like '41000001-%'),
  1,
  'a limit of 0 is raised to 1 row'
);

select is(
  (select count(*)::int from public.search_foods('clampfixture') r where r.id::text like '41000001-%'),
  25,
  'the default limit is 25 rows'
);

select is(
  (select count(*)::int from public.search_foods('clampfixture', null) r where r.id::text like '41000001-%'),
  25,
  'a null limit means the default of 25 rows'
);

select is(
  (select count(*)::int from public.search_foods('c', 50)),
  0,
  'a one character query returns no rows'
);

select is(
  (select count(*)::int from public.search_foods('  c  ', 50)),
  0,
  'the length is measured after trimming'
);

select is(
  (select count(*)::int from public.search_foods(null, 50)),
  0,
  'a null query returns no rows'
);

-- Hostile input. The punctuation is discarded, so what is left is "chicken".
select lives_ok(
  $$ select * from public.search_foods($q$zorblax chicken & | ! ( ) : * ' "$q$, 50) $$,
  'tsquery operators and quotes in the query do not raise an error'
);

select is(
  (select array_agg(r.name order by r.name) from public.search_foods($q$zorblax chicken & | ! ( ) : * ' "$q$, 50) r where r.id::text like '41000001-%'),
  array['Zorblax chicken breast fillets', 'Zorblax chicken, breast, raw', 'Zorblax chicken, leg, roasted', 'Zorblax chickpeas, dried, boiled'],
  'a query full of operators still finds the chicken it contains'
);

select lives_ok(
  $$ select * from public.search_foods($q$chicken\ <-> breast:*A !(x | y)$q$, 50) $$,
  'a backslash, a phrase operator and a weight label do not raise an error'
);

-- Postgres raises a NOTICE for a tsquery with no lexemes, which only clutters
-- the test output.
set local client_min_messages = warning;

select lives_ok(
  $$ select * from public.search_foods('the', 50) $$,
  'a query made only of stop words does not raise an error'
);

select lives_ok(
  $$ select * from public.search_foods((select string_agg('chicken', ' ') from generate_series(1, 5000)), 50) $$,
  'a query of 5,000 words is capped and does not raise an error'
);

reset role;

-- User B searches.
set local role authenticated;
set local request.jwt.claims = '{"sub":"41000002-0000-4000-8000-00000000000a","role":"authenticated"}';

select is(
  (
    select array_agg(coalesce(r.source_ref, 'own') order by r.score desc, r.name)
    from public.search_foods('zanzibar lentil', 50) r where r.id::text like '41000001-%'
  ),
  array['CF-KEY41-6'],
  'user B sees the CoFID food but never user A''s food'
);

reset role;

-- The service role bypasses row level security, so it sees every live food.
set local role service_role;

select is(
  (
    select array_agg(coalesce(r.source_ref, 'own') order by coalesce(r.source_ref, 'own'))
    from public.search_foods('zanzibar lentil', 50) r where r.id::text like '41000001-%'
  ),
  array['CF-KEY41-6', 'own'],
  'the service role can call search_foods and sees user A''s food as well'
);

reset role;

select * from finish();

rollback;
