-- Asserts public.off_search_results and public.store_off_search_results() (ADR 0003 Amendment 16):
-- the shared store of Open Food Facts search answers. Only the service role can reach it, and it can
-- only read the table, because every write goes through the function.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so nothing
-- created here persists. Every query_key is unique to this file. now() is fixed for the whole
-- transaction, so rows that must look old are inserted with an explicit fetched_at as postgres.

begin;

select plan(30);

-- The table.
select ok(
  (select relrowsecurity from pg_class where oid = 'public.off_search_results'::regclass),
  'row level security is enabled on off_search_results'
);

select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'off_search_results'),
  0,
  'off_search_results has no policy, so row level security alone denies the API roles'
);

select columns_are(
  'public', 'off_search_results', array['query_key', 'candidates', 'fetched_at'],
  'off_search_results has exactly query_key, candidates and fetched_at, with no id, created_at or user id'
);

select col_is_pk('public', 'off_search_results', array['query_key'], 'off_search_results is keyed by query_key');

select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'off_search_results'
      and indexdef like '%(fetched_at)' and indexdef not like 'CREATE UNIQUE%'
  ),
  'there is a plain index on off_search_results.fetched_at'
);

select ok(
  not has_table_privilege('anon', 'public.off_search_results', 'select, insert, update, delete, truncate, references, trigger')
    and not has_table_privilege('authenticated', 'public.off_search_results', 'select, insert, update, delete, truncate, references, trigger'),
  'anon and authenticated hold no privilege on off_search_results'
);

select is(
  (select array_agg(privilege_type::text order by privilege_type::text)
   from information_schema.table_privileges
   where table_schema = 'public' and table_name = 'off_search_results' and grantee = 'service_role'),
  array['SELECT'],
  'service_role holds select on off_search_results and nothing else'
);

-- The function.
select ok(
  (select prosecdef from pg_proc where oid = 'public.store_off_search_results(text, jsonb, integer)'::regprocedure),
  'store_off_search_results is security definer'
);

select ok(
  (select proconfig @> array['search_path=""'] from pg_proc where oid = 'public.store_off_search_results(text, jsonb, integer)'::regprocedure),
  'store_off_search_results pins an empty search_path'
);

select is(
  (select array_agg(role_name order by role_name)
   from unnest(array['anon', 'authenticated', 'service_role']) as role_name
   where has_function_privilege(role_name, 'public.store_off_search_results(text, jsonb, integer)', 'execute')),
  array['service_role'],
  'only service_role can execute store_off_search_results'
);

select ok(
  not has_function_privilege('public', 'public.store_off_search_results(text, jsonb, integer)', 'execute'),
  'public cannot execute store_off_search_results'
);

-- The API roles.
set local role anon;
select throws_ok(
  $$ select public.store_off_search_results('test-k937-anon', '[]', 86400) $$,
  '42501', null, 'an anonymous caller cannot call store_off_search_results'
);
select throws_ok(
  $$ select count(*) from public.off_search_results $$,
  '42501', null, 'an anonymous caller cannot read off_search_results'
);
reset role;

set local role authenticated;
select throws_ok(
  $$ select public.store_off_search_results('test-k937-user', '[]', 86400) $$,
  '42501', null, 'a signed in user cannot call store_off_search_results'
);
select throws_ok(
  $$ select count(*) from public.off_search_results $$,
  '42501', null, 'a signed in user cannot read off_search_results'
);
reset role;

-- The service role reads the table and cannot write it directly.
set local role service_role;
select lives_ok(
  $$ select count(*) from public.off_search_results $$,
  'service_role can read off_search_results'
);
select throws_ok(
  $$ insert into public.off_search_results (query_key, candidates) values ('test-k937-direct', '[]') $$,
  '42501', null, 'service_role cannot insert into off_search_results directly'
);
select throws_ok(
  $$ delete from public.off_search_results $$,
  '42501', null, 'service_role cannot delete from off_search_results directly'
);

-- The function stores a row, and a repeat replaces it and moves fetched_at.
select public.store_off_search_results('test-k937-store', '[{"code": "1"}]', 86400);
select is(
  (select candidates from public.off_search_results where query_key = 'test-k937-store'),
  '[{"code": "1"}]'::jsonb,
  'the function stores the candidates it is given'
);

reset role;
update public.off_search_results set fetched_at = now() - interval '2 hours' where query_key = 'test-k937-store';
set local role service_role;

select public.store_off_search_results('test-k937-store', '[{"code": "2"}]', 86400);
select is(
  (select candidates from public.off_search_results where query_key = 'test-k937-store'),
  '[{"code": "2"}]'::jsonb,
  'a repeat store replaces the candidates'
);
select is(
  (select count(*)::int from public.off_search_results where query_key = 'test-k937-store'),
  1,
  'a repeat store leaves one row for the key'
);
select ok(
  (select fetched_at >= now() - interval '1 minute' from public.off_search_results where query_key = 'test-k937-store'),
  'a repeat store moves fetched_at to now'
);

select lives_ok(
  $$ select public.store_off_search_results('test-k937-empty', '[]', 86400) $$,
  'an empty list is a valid answer to store'
);

-- Refusals.
select throws_ok(
  $$ select public.store_off_search_results('test-k937-object', '{"code": "1"}', 86400) $$,
  '22023', 'p_candidates must be a JSON array', 'an object is refused'
);
select throws_ok(
  $$ select public.store_off_search_results('test-k937-null', null, 86400) $$,
  '22023', 'p_candidates must be a JSON array', 'a null list is refused'
);
select throws_ok(
  $$ select public.store_off_search_results('test-k937-keep', '[]', 0) $$,
  '22023', 'p_keep_seconds must be at least 1', 'a horizon below 1 second is refused'
);

-- The horizon: rows past it go, oldest first, and at most 100 in one call. Rows are inserted as
-- postgres, because the service role cannot insert. The marker is a prefix unique to this file.
reset role;
-- Rows a developer's own searches left past the horizon would take places in the 100 and skew the
-- count, so they go first. The rollback at the end puts them back.
delete from public.off_search_results where fetched_at < now() - interval '14 days';
insert into public.off_search_results (query_key, candidates, fetched_at)
select 'test-k937-old-' || lpad(n::text, 3, '0'), '[]', now() - interval '30 days' - make_interval(secs => n)
from generate_series(1, 130) as n;
insert into public.off_search_results (query_key, candidates, fetched_at)
values ('test-k937-recent', '[]', now() - interval '1 hour');
set local role service_role;

select public.store_off_search_results('test-k937-sweep', '[]', 14 * 86400);

select is(
  (select count(*)::int from public.off_search_results where query_key like 'test-k937-old-%'),
  30,
  'a store removes at most 100 rows past the horizon'
);
select is(
  (select max(query_key) from public.off_search_results where query_key like 'test-k937-old-%'),
  'test-k937-old-030',
  'the rows it removed were the oldest, so the 30 newest of them remain'
);

select public.store_off_search_results('test-k937-sweep', '[]', 14 * 86400);
select is(
  (select count(*)::int from public.off_search_results where query_key like 'test-k937-old-%'),
  0,
  'the next store clears the rest'
);
select ok(
  exists (select 1 from public.off_search_results where query_key = 'test-k937-recent')
    and exists (select 1 from public.off_search_results where query_key = 'test-k937-sweep'),
  'rows inside the horizon stay, and so does the row just stored'
);

select * from finish();

rollback;
