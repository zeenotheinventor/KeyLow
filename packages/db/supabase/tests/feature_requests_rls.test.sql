-- Asserts public.feature_requests (ADR 0003, Amendment 21): the table, its checks, the exact
-- privileges, owner-only row level security, the cascade from the account and the cap of 20 rows per
-- person in any rolling 24 hours.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so nothing
-- created here persists. Every fixture id starts with 97600000 and every request text with key976-.
-- Each actor is entered with `set local role` plus the JWT claims that `auth.uid()` reads, and left
-- with `reset role`.
--
-- A request can hold diary talk. The fixtures are made up and no assertion name quotes one.

begin;

select plan(50);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '97600000-0000-4000-8000-0000000000aa', 'authenticated', 'authenticated', 'key976-a@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '97600000-0000-4000-8000-0000000000bb', 'authenticated', 'authenticated', 'key976-b@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '97600000-0000-4000-8000-0000000000cc', 'authenticated', 'authenticated', 'key976-c@keylow.test');

-- Shape.
select has_table('public', 'feature_requests', 'feature_requests exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.feature_requests'::regclass),
  'row level security is enabled on feature_requests'
);
select col_is_pk('public', 'feature_requests', 'id', 'the primary key is id');
select col_default_is('public', 'feature_requests', 'id', 'gen_random_uuid()', 'id defaults to a random uuid');
select col_not_null('public', 'feature_requests', 'user_id', 'user_id is not null');
select col_default_is('public', 'feature_requests', 'user_id', 'auth.uid()', 'user_id defaults to the caller');
select col_not_null('public', 'feature_requests', 'source', 'source is not null');
select col_not_null('public', 'feature_requests', 'request', 'request is not null');
select col_is_null('public', 'feature_requests', 'context', 'context may be null');
select col_type_is('public', 'feature_requests', 'context', 'jsonb', 'context is jsonb');
select col_not_null('public', 'feature_requests', 'created_at', 'created_at is not null');
select col_default_is('public', 'feature_requests', 'created_at', 'now()', 'created_at defaults to now()');
select fk_ok('public', 'feature_requests', 'user_id', 'auth', 'users', 'id', 'user_id references auth.users');
select has_index('public', 'feature_requests', 'feature_requests_user_id_created_at_idx', array['user_id', 'created_at'], 'the user and time index exists');

-- Own insert works, with user_id defaulted.
set local role authenticated;
set local request.jwt.claims = '{"sub":"97600000-0000-4000-8000-0000000000aa","role":"authenticated"}';

select lives_ok(
  $$insert into public.feature_requests (source, request) values ('more_menu', 'key976-a-more')$$,
  'a user inserts a more_menu request with no context'
);
select lives_ok(
  $$insert into public.feature_requests (source, request, context)
    values ('assistant', 'key976-a-assistant', '{"version": 1, "ask": "x", "unsupported": "y", "recent": []}')$$,
  'a user inserts an assistant request with an object context'
);
select is(
  (select count(*)::int from public.feature_requests where user_id = '97600000-0000-4000-8000-0000000000aa'),
  2,
  'user_id was defaulted to the caller on both rows'
);

-- Refusals on insert.
select throws_ok(
  $$insert into public.feature_requests (user_id, source, request) values ('97600000-0000-4000-8000-0000000000bb', 'more_menu', 'key976-a-for-b')$$,
  '42501',
  'permission denied for table feature_requests',
  'a user cannot set user_id'
);
select throws_ok(
  $$insert into public.feature_requests (id, source, request) values ('97600000-0000-4000-8000-000000000001', 'more_menu', 'key976-a-id')$$,
  '42501',
  'permission denied for table feature_requests',
  'a user cannot set id'
);
select throws_ok(
  $$insert into public.feature_requests (created_at, source, request) values (now() - interval '2 days', 'more_menu', 'key976-a-time')$$,
  '42501',
  'permission denied for table feature_requests',
  'a user cannot set created_at'
);

-- The source, context and length checks.
select throws_ok(
  $$insert into public.feature_requests (source, request) values ('web', 'key976-a-source')$$,
  '23514',
  null,
  'an unknown source is refused'
);
select throws_ok(
  $$insert into public.feature_requests (source, request, context) values ('more_menu', 'key976-a-ctx', '{}')$$,
  '23514',
  null,
  'a more_menu request with a context is refused'
);
select throws_ok(
  $$insert into public.feature_requests (source, request) values ('assistant', 'key976-a-noctx')$$,
  '23514',
  null,
  'an assistant request with no context is refused'
);
select throws_ok(
  $$insert into public.feature_requests (source, request, context) values ('assistant', 'key976-a-array', '[]')$$,
  '23514',
  null,
  'an assistant request with an array context is refused'
);
select throws_ok(
  $$insert into public.feature_requests (source, request, context) values ('assistant', 'key976-a-json-null', 'null')$$,
  '23514',
  null,
  'an assistant request with a JSON null context is refused'
);
select throws_ok(
  $$insert into public.feature_requests (source, request, context)
    values ('assistant', 'key976-a-big', jsonb_build_object('pad', (select string_agg(md5(i::text), '') from generate_series(1, 600) as i)))$$,
  '23514',
  null,
  'an assistant request with a context over 16 KB is refused'
);
select throws_ok(
  $$insert into public.feature_requests (source, request) values ('more_menu', 'ab')$$,
  '23514',
  null,
  'a request of 2 characters is refused'
);
select throws_ok(
  $$insert into public.feature_requests (source, request) values ('more_menu', '   a   ')$$,
  '23514',
  null,
  'a request that is 1 character once trimmed is refused'
);
select lives_ok(
  $$insert into public.feature_requests (source, request) values ('more_menu', 'abc')$$,
  'a request of 3 characters is accepted'
);
select lives_ok(
  $$insert into public.feature_requests (source, request) values ('more_menu', repeat('a', 1000))$$,
  'a request of 1000 characters is accepted'
);
select throws_ok(
  $$insert into public.feature_requests (source, request) values ('more_menu', repeat('a', 1001))$$,
  '23514',
  null,
  'a request of 1001 characters is refused'
);

-- Select sees only own rows. User B has one row of its own.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"97600000-0000-4000-8000-0000000000bb","role":"authenticated"}';

select lives_ok(
  $$insert into public.feature_requests (source, request) values ('more_menu', 'key976-b-more')$$,
  'user B inserts a request'
);
select is(
  (select count(*)::int from public.feature_requests where request like 'key976-%'),
  1,
  'user B sees only its own request'
);

-- No update, no delete.
select throws_ok(
  $$update public.feature_requests set request = 'key976-b-edit'$$,
  '42501',
  'permission denied for table feature_requests',
  'a user cannot update a request'
);
select throws_ok(
  $$delete from public.feature_requests$$,
  '42501',
  'permission denied for table feature_requests',
  'a user cannot delete a request'
);

-- User C has none.
set local request.jwt.claims = '{"sub":"97600000-0000-4000-8000-0000000000cc","role":"authenticated"}';
select is(
  (select count(*)::int from public.feature_requests),
  0,
  'user C sees no request'
);

reset role;

-- Anon has nothing.
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok('select * from public.feature_requests', '42501', 'permission denied for table feature_requests', 'anon cannot select');
select throws_ok(
  $$insert into public.feature_requests (source, request) values ('more_menu', 'key976-anon')$$,
  '42501',
  'permission denied for table feature_requests',
  'anon cannot insert'
);

reset role;

-- Privileges, exactly.
select ok(
  has_table_privilege('authenticated', 'public.feature_requests', 'select')
    and not has_table_privilege('authenticated', 'public.feature_requests', 'insert')
    and not has_table_privilege('authenticated', 'public.feature_requests', 'update')
    and not has_table_privilege('authenticated', 'public.feature_requests', 'delete')
    and not has_table_privilege('authenticated', 'public.feature_requests', 'truncate')
    and not has_any_column_privilege('authenticated', 'public.feature_requests', 'update'),
  'authenticated can select, and has no table level insert, update, delete or truncate'
);
select ok(
  has_column_privilege('authenticated', 'public.feature_requests', 'source', 'insert')
    and has_column_privilege('authenticated', 'public.feature_requests', 'request', 'insert')
    and has_column_privilege('authenticated', 'public.feature_requests', 'context', 'insert')
    and not has_column_privilege('authenticated', 'public.feature_requests', 'id', 'insert')
    and not has_column_privilege('authenticated', 'public.feature_requests', 'user_id', 'insert')
    and not has_column_privilege('authenticated', 'public.feature_requests', 'created_at', 'insert'),
  'authenticated can insert source, request and context only'
);
select ok(
  not has_table_privilege('anon', 'public.feature_requests', 'select')
    and not has_any_column_privilege('anon', 'public.feature_requests', 'select')
    and not has_any_column_privilege('anon', 'public.feature_requests', 'insert')
    and not has_any_column_privilege('anon', 'public.feature_requests', 'update')
    and not has_table_privilege('anon', 'public.feature_requests', 'delete'),
  'anon has no privilege on feature_requests'
);
select ok(
  has_table_privilege('service_role', 'public.feature_requests', 'select')
    and not has_table_privilege('service_role', 'public.feature_requests', 'delete')
    and not has_table_privilege('service_role', 'public.feature_requests', 'truncate')
    and not has_any_column_privilege('service_role', 'public.feature_requests', 'insert')
    and not has_any_column_privilege('service_role', 'public.feature_requests', 'update'),
  'service_role can select and holds no write privilege'
);
select policies_are(
  'public',
  'feature_requests',
  array['feature_requests_select_own', 'feature_requests_insert_own'],
  'feature_requests has exactly the select and insert owner policies'
);
select policy_roles_are('public', 'feature_requests', 'feature_requests_insert_own', array['authenticated'], 'the insert policy is for authenticated');

-- The cap. User C inserts 20 rows in one go, and the 21st is refused with the code the repo reads.
set local role authenticated;
set local request.jwt.claims = '{"sub":"97600000-0000-4000-8000-0000000000cc","role":"authenticated"}';

select lives_ok(
  $$insert into public.feature_requests (source, request)
    select 'more_menu', 'key976-c-' || n from generate_series(1, 20) as n$$,
  'a user inserts 20 requests in 24 hours'
);
select throws_ok(
  $$insert into public.feature_requests (source, request) values ('more_menu', 'key976-c-21')$$,
  '54000',
  'feature_requests_daily_cap',
  'the 21st request in 24 hours is refused with the cap error'
);
select is(
  (select count(*)::int from public.feature_requests),
  20,
  'the refused request was not stored'
);

-- The cap is per person: user A is unaffected.
set local request.jwt.claims = '{"sub":"97600000-0000-4000-8000-0000000000aa","role":"authenticated"}';
select lives_ok(
  $$insert into public.feature_requests (source, request) values ('more_menu', 'key976-a-after-c')$$,
  'another user can still insert while user C is at the cap'
);

reset role;

-- Rows older than 24 hours do not count. 20 rows 25 hours old leave user B free to insert.
insert into public.feature_requests (user_id, source, request, created_at)
select '97600000-0000-4000-8000-0000000000bb', 'more_menu', 'key976-b-old-' || n, now() - interval '25 hours'
from generate_series(1, 20) as n;

set local role authenticated;
set local request.jwt.claims = '{"sub":"97600000-0000-4000-8000-0000000000bb","role":"authenticated"}';
select lives_ok(
  $$insert into public.feature_requests (source, request) values ('more_menu', 'key976-b-fresh')$$,
  'rows older than 24 hours do not count towards the cap'
);

reset role;

-- The cascade from the account.
delete from auth.users where id = '97600000-0000-4000-8000-0000000000cc';
select is(
  (select count(*)::int from public.feature_requests where user_id = '97600000-0000-4000-8000-0000000000cc'),
  0,
  'deleting the account deletes its requests'
);

select * from finish();
rollback;
