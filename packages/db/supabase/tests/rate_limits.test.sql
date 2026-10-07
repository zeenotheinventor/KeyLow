-- Asserts public.rate_limits and public.consume_rate_limit() (ADR 0003
-- Amendment 1): a fixed window counter that only the service role can reach,
-- through the function, never through the table.
--
-- `supabase test db` runs this file as postgres inside a transaction that is
-- rolled back, so nothing created here persists. Every bucket name is unique
-- to this file. Each actor is entered with `set local role` and left with
-- `reset role`.
--
-- The window is measured against the wall clock, not the transaction start,
-- so the one test that sleeps can see a new window inside this transaction.
-- The main tests use a one day window, which makes a boundary straddle
-- vanishingly unlikely.

begin;

select plan(34);

-- Table level facts.
select ok(
  (select relrowsecurity from pg_class where oid = 'public.rate_limits'::regclass),
  'row level security is enabled on rate_limits'
);

select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'rate_limits'),
  0,
  'rate_limits has no policy, so row level security alone denies the API roles'
);

select columns_are(
  'public', 'rate_limits', array['bucket', 'window_start', 'hits'],
  'rate_limits has exactly bucket, window_start and hits, with no id or created_at'
);

select col_is_pk(
  'public', 'rate_limits', array['bucket', 'window_start'],
  'rate_limits is keyed by (bucket, window_start)'
);

select ok(
  not (
    select bool_or(has_table_privilege(role_name, 'public.rate_limits', 'select, insert, update, delete, truncate, references, trigger'))
    from unnest(array['anon', 'authenticated', 'service_role']) as role_name
  ),
  'anon, authenticated and service_role hold no privilege at all on rate_limits'
);

-- Function attributes.
select ok(
  (select prosecdef from pg_proc where oid = 'public.consume_rate_limit(text, integer, integer)'::regprocedure),
  'consume_rate_limit is security definer'
);

select ok(
  (select proconfig @> array['search_path=""'] from pg_proc where oid = 'public.consume_rate_limit(text, integer, integer)'::regprocedure),
  'consume_rate_limit pins an empty search_path'
);

select is(
  (select provolatile::text from pg_proc where oid = 'public.consume_rate_limit(text, integer, integer)'::regprocedure),
  'v',
  'consume_rate_limit is volatile'
);

-- Behaviour, as postgres. Results are kept in a temp table so each call
-- counts once, and the assertions below read them back.
create temp table call_results (bucket text, call_number integer, allowed boolean, retry_after_seconds integer);

insert into call_results select 'test-key40-limit', 1, * from public.consume_rate_limit('test-key40-limit', 3, 86400);
insert into call_results select 'test-key40-limit', 2, * from public.consume_rate_limit('test-key40-limit', 3, 86400);
insert into call_results select 'test-key40-limit', 3, * from public.consume_rate_limit('test-key40-limit', 3, 86400);
insert into call_results select 'test-key40-limit', 4, * from public.consume_rate_limit('test-key40-limit', 3, 86400);

select ok(
  (select bool_and(allowed) from call_results where bucket = 'test-key40-limit' and call_number <= 3),
  'with p_max 3 the first three calls are allowed'
);

select is(
  (select allowed from call_results where bucket = 'test-key40-limit' and call_number = 4),
  false,
  'with p_max 3 the fourth call is refused'
);

select ok(
  (select bool_and(retry_after_seconds between 1 and 86400) from call_results where bucket = 'test-key40-limit' and call_number <= 3),
  'retry_after_seconds is between 1 and the window on every allowed call'
);

select ok(
  (select retry_after_seconds between 1 and 86400 from call_results where bucket = 'test-key40-limit' and call_number = 4),
  'retry_after_seconds is between 1 and the window on the refused call'
);

-- The first call's retry_after_seconds must be the whole seconds left in the
-- day, rounded up. It is compared with the same figure computed right after
-- the call, which can only be smaller by the time between the two reads.
select ok(
  (select abs(
      retry_after_seconds - pg_catalog.ceil(extract(epoch from (
        pg_catalog.date_bin(interval '86400 seconds', pg_catalog.clock_timestamp(), 'epoch'::timestamptz)
        + interval '86400 seconds' - pg_catalog.clock_timestamp()
      )))
    ) <= 1
    from call_results where bucket = 'test-key40-limit' and call_number = 1),
  'retry_after_seconds is the whole seconds left in the window, rounded up'
);

select ok(
  (select bool_and(retry_after_seconds <= previous_retry_after_seconds)
    from (
      select retry_after_seconds, lag(retry_after_seconds) over (order by call_number) as previous_retry_after_seconds
      from call_results where bucket = 'test-key40-limit'
    ) as ordered_calls
    where previous_retry_after_seconds is not null),
  'retry_after_seconds never grows from one call to the next within a window'
);

select is(
  (select hits from public.rate_limits where bucket = 'test-key40-limit'),
  4,
  'a refused call is still counted, so the row holds four hits'
);

-- A different bucket keeps its own count.
insert into call_results select 'test-key40-other', 1, * from public.consume_rate_limit('test-key40-other', 3, 86400);

select is(
  (select allowed from call_results where bucket = 'test-key40-other'),
  true,
  'a different bucket is still allowed after the first bucket ran out'
);

select is(
  (select hits from public.rate_limits where bucket = 'test-key40-other'),
  1,
  'a different bucket starts at one hit, untouched by the first bucket'
);

-- Expired windows are removed for the bucket being called, and only for it.
insert into public.rate_limits (bucket, window_start, hits) values
  ('test-key40-stale', pg_catalog.date_bin(interval '86400 seconds', pg_catalog.clock_timestamp(), 'epoch'::timestamptz) - interval '86400 seconds', 99),
  ('test-key40-stale-bystander', pg_catalog.date_bin(interval '86400 seconds', pg_catalog.clock_timestamp(), 'epoch'::timestamptz) - interval '86400 seconds', 99);

insert into call_results select 'test-key40-stale', 1, * from public.consume_rate_limit('test-key40-stale', 3, 86400);

select is(
  (select count(*)::int from public.rate_limits
    where bucket = 'test-key40-stale'
      and window_start < pg_catalog.date_bin(interval '86400 seconds', pg_catalog.clock_timestamp(), 'epoch'::timestamptz)),
  0,
  'the call deletes the expired window row of its own bucket'
);

select is(
  (select hits from public.rate_limits where bucket = 'test-key40-stale'),
  1,
  'the count restarts at one in the new window'
);

select is(
  (select allowed from call_results where bucket = 'test-key40-stale'),
  true,
  'a bucket whose old window was over the limit is allowed again in the new window'
);

select is(
  (select count(*)::int from public.rate_limits where bucket = 'test-key40-stale-bystander'),
  1,
  'the expired window row of another bucket is left alone'
);

-- One real window rollover. The first call lands in one second window and the
-- call after the sleep must land in a later one, whatever the timing.
insert into call_results select 'test-key40-rollover', 1, * from public.consume_rate_limit('test-key40-rollover', 1, 1);
select pg_sleep(1.1);
insert into call_results select 'test-key40-rollover', 2, * from public.consume_rate_limit('test-key40-rollover', 1, 1);

select is(
  (select allowed from call_results where bucket = 'test-key40-rollover' and call_number = 2),
  true,
  'a one second window allows a call again after 1.1 seconds'
);

select results_eq(
  $$ select count(*)::int, max(hits) from public.rate_limits where bucket = 'test-key40-rollover' $$,
  $$ values (1, 1) $$,
  'the rollover left one row with one hit, so the earlier window was removed and the count restarted'
);

select is(
  (select retry_after_seconds from call_results where bucket = 'test-key40-rollover' and call_number = 2),
  1,
  'a one second window reports a retry after of exactly one second'
);

-- Bad arguments.
select throws_ok(
  $$ select * from public.consume_rate_limit('test-key40-invalid', 0, 60) $$,
  '22023',
  'p_max must be at least 1',
  'a p_max of 0 is rejected with invalid_parameter_value'
);

select throws_ok(
  $$ select * from public.consume_rate_limit('test-key40-invalid', 3, 0) $$,
  '22023',
  'p_window_seconds must be at least 1',
  'a p_window_seconds of 0 is rejected with invalid_parameter_value'
);

select throws_ok(
  $$ select * from public.consume_rate_limit('test-key40-invalid', null, 60) $$,
  '22023',
  'p_max must be at least 1',
  'a null p_max is rejected with invalid_parameter_value'
);

select throws_ok(
  $$ select * from public.consume_rate_limit(null, 3, 60) $$,
  '23502',
  'null value in column "bucket" of relation "rate_limits" violates not-null constraint',
  'a null p_bucket is rejected by the not-null constraint'
);

-- Anon.
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  $$ select * from public.rate_limits $$,
  '42501',
  'permission denied for table rate_limits',
  'anon cannot select from rate_limits'
);

select throws_ok(
  $$ select * from public.consume_rate_limit('test-key40-anon', 3, 60) $$,
  '42501',
  'permission denied for function consume_rate_limit',
  'anon cannot call consume_rate_limit'
);

reset role;

-- Authenticated.
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"40000000-0000-4000-8000-00000000000a"}';

select throws_ok(
  $$ select * from public.rate_limits $$,
  '42501',
  'permission denied for table rate_limits',
  'authenticated cannot select from rate_limits'
);

select throws_ok(
  $$ select * from public.consume_rate_limit('test-key40-authenticated', 3, 60) $$,
  '42501',
  'permission denied for function consume_rate_limit',
  'authenticated cannot call consume_rate_limit'
);

reset role;

-- Service role: the function works, the table stays out of reach.
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';

select lives_ok(
  $$ select * from public.consume_rate_limit('test-key40-service', 3, 60) $$,
  'service_role can call consume_rate_limit'
);

select throws_ok(
  $$ select * from public.rate_limits $$,
  '42501',
  'permission denied for table rate_limits',
  'service_role cannot select from rate_limits directly'
);

reset role;

select * from finish();

rollback;
