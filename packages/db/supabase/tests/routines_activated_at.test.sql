-- Asserts `routines.activated_at` and the trigger that stamps it (ADR 0005, Amendment 2, KEY-378):
-- the column and its privileges (readable, never written by a client), the `before update` trigger
-- that sets it to now() whenever `is_active` goes from false to true however the statement was sent
-- and leaves it alone otherwise, and the way `set_active_routine`, a direct client update and a
-- statement run as the owner all reach the same result.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so
-- nothing created here persists. now() is one value for the whole transaction, so a stamp is told
-- apart from an older one by writing a known older date as postgres first. Every fixture id starts
-- with 37800000 and every name and email with key378-. Each actor is entered with `set local role`
-- plus the JWT claims that `auth.uid()` reads, and left with `reset role`.
--
-- Health data: a routine name is a fixture label, and nothing asserted here quotes a user's value.

begin;

select plan(41);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '37800000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'key378-user-a@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '37800000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'key378-user-b@keylow.test');

-- A has two inactive routines. B has an active one that was activated before this test.
insert into public.routines (id, user_id, name, is_active) values
  ('37800000-0000-4000-8000-0000000003a1', '37800000-0000-4000-8000-00000000000a', 'key378-a-first', false),
  ('37800000-0000-4000-8000-0000000003a2', '37800000-0000-4000-8000-00000000000a', 'key378-a-second', false),
  ('37800000-0000-4000-8000-0000000003b1', '37800000-0000-4000-8000-00000000000b', 'key378-b-plan', true);

update public.routines set activated_at = '2026-02-01 09:00+00' where id = '37800000-0000-4000-8000-0000000003b1';

-- The column, its trigger and the trigger function.
select has_column('public', 'routines', 'activated_at', 'routines has an activated_at column');
select col_type_is('public', 'routines', 'activated_at', 'timestamp with time zone', 'activated_at is a timestamptz');
select col_is_null('public', 'routines', 'activated_at', 'activated_at is nullable');
select col_hasnt_default('public', 'routines', 'activated_at', 'activated_at has no default');
select has_trigger('public', 'routines', 'routines_stamp_activated_at', 'routines has the activation trigger');
select is(
  (select tgtype::int from pg_trigger where tgrelid = 'public.routines'::regclass and tgname = 'routines_stamp_activated_at'),
  19,
  'the activation trigger is a before update trigger that runs for each row'
);
select trigger_is('public', 'routines', 'routines_stamp_activated_at', 'public', 'routines_stamp_activated_at', 'the trigger runs routines_stamp_activated_at');
select ok(
  (select not prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = 'public.routines_stamp_activated_at()'::regprocedure),
  'the trigger function is security invoker with an empty search_path'
);
select ok(
  not has_function_privilege('authenticated', 'public.routines_stamp_activated_at()', 'execute')
    and not has_function_privilege('anon', 'public.routines_stamp_activated_at()', 'execute')
    and not has_function_privilege('service_role', 'public.routines_stamp_activated_at()', 'execute')
    and (select not exists (select 1 from aclexplode(proacl) as privilege where privilege.grantee = 0) from pg_proc where oid = 'public.routines_stamp_activated_at()'::regprocedure),
  'nobody holds execute on the trigger function, and public cannot'
);

-- Privileges. A client reads the date and can never write it, and the update grant is what it was.
select ok(has_column_privilege('authenticated', 'public.routines', 'activated_at', 'select'), 'authenticated can read activated_at');
select ok(
  not has_column_privilege('authenticated', 'public.routines', 'activated_at', 'insert')
    and not has_column_privilege('authenticated', 'public.routines', 'activated_at', 'update'),
  'authenticated can neither insert nor update activated_at'
);
select ok(
  not has_column_privilege('anon', 'public.routines', 'activated_at', 'select,insert,update')
    and not has_column_privilege('service_role', 'public.routines', 'activated_at', 'select,insert,update'),
  'anon and service_role hold nothing on activated_at'
);
select is(
  (select array_agg(column_name::text order by column_name::text collate "C") from information_schema.column_privileges where table_schema = 'public' and table_name = 'routines' and grantee = 'authenticated' and privilege_type = 'UPDATE'),
  array['is_active', 'is_archived', 'name'],
  'authenticated can still update exactly name, is_active and is_archived of a routine'
);

-- User A.
set local role authenticated;
set local request.jwt.claims = '{"sub":"37800000-0000-4000-8000-00000000000a","role":"authenticated"}';

insert into public.routines (name) values ('key378-a-new');
select is(
  (select activated_at from public.routines where name = 'key378-a-new'),
  null::timestamptz,
  'a new routine has never been activated'
);

select lives_ok($$ select public.set_active_routine('37800000-0000-4000-8000-0000000003a1') $$, 'user A activates a routine through set_active_routine');
select is(
  (select activated_at from public.routines where id = '37800000-0000-4000-8000-0000000003a1'),
  now(),
  'activating a routine stamps activated_at with now()'
);
select is(
  (select count(*)::int from public.routines where activated_at is not null),
  1,
  'only the activated routine of A carries a date, and B''s is out of sight'
);

select throws_ok(
  $$ update public.routines set activated_at = now() where id = '37800000-0000-4000-8000-0000000003a1' $$,
  '42501', 'permission denied for table routines',
  'a client update that sends activated_at is refused by the column grant'
);
select throws_ok(
  $$ update public.routines set is_active = true, activated_at = '2000-01-01 00:00+00' where id = '37800000-0000-4000-8000-0000000003a2' $$,
  '42501', 'permission denied for table routines',
  'a client update that activates and sends activated_at is refused as well'
);
select throws_ok(
  $$ insert into public.routines (name, activated_at) values ('key378-a-backdated', now()) $$,
  '42501', 'permission denied for table routines',
  'a client insert that sends activated_at is refused'
);

-- The owner backdates the stamp, so the next checks can tell an untouched value from a new one.
reset role;
update public.routines set activated_at = '2026-01-01 09:00+00' where id = '37800000-0000-4000-8000-0000000003a1';
set local role authenticated;
set local request.jwt.claims = '{"sub":"37800000-0000-4000-8000-00000000000a","role":"authenticated"}';

update public.routines set name = 'key378-a-first-renamed' where id = '37800000-0000-4000-8000-0000000003a1';
select is(
  (select activated_at from public.routines where id = '37800000-0000-4000-8000-0000000003a1'),
  '2026-01-01 09:00+00'::timestamptz,
  'an update of the name alone leaves activated_at unchanged'
);

select lives_ok($$ select public.set_active_routine(null) $$, 'user A clears the active routine');
select is(
  (select activated_at from public.routines where id = '37800000-0000-4000-8000-0000000003a1'),
  '2026-01-01 09:00+00'::timestamptz,
  'deactivating a routine keeps its old activated_at'
);

select lives_ok($$ select public.set_active_routine('37800000-0000-4000-8000-0000000003a1') $$, 'user A activates the same routine again');
select is(
  (select activated_at from public.routines where id = '37800000-0000-4000-8000-0000000003a1'),
  now(),
  'activating it again restamps activated_at'
);

-- Switching. The first routine keeps the old date it is switched away with, the second is stamped.
reset role;
update public.routines set activated_at = '2026-01-01 09:00+00' where id = '37800000-0000-4000-8000-0000000003a1';
set local role authenticated;
set local request.jwt.claims = '{"sub":"37800000-0000-4000-8000-00000000000a","role":"authenticated"}';

select lives_ok($$ select public.set_active_routine('37800000-0000-4000-8000-0000000003a2') $$, 'user A switches the active routine');
select is(
  (select activated_at from public.routines where id = '37800000-0000-4000-8000-0000000003a2'),
  now(),
  'switching stamps the routine that became active'
);
select is(
  (select activated_at from public.routines where id = '37800000-0000-4000-8000-0000000003a1'),
  '2026-01-01 09:00+00'::timestamptz,
  'switching leaves the routine that was switched away from with its old date'
);
select is(
  (select activated_at from public.routines where name = 'key378-a-new'),
  null::timestamptz,
  'switching leaves a routine that was never active without a date'
);
select is(
  (select array_agg(id::text) from public.routines where is_active),
  array['37800000-0000-4000-8000-0000000003a2'],
  'user A still has exactly one active routine'
);
select throws_ok(
  $$ update public.routines set is_active = true where id = '37800000-0000-4000-8000-0000000003a1' $$,
  '23505', 'duplicate key value violates unique constraint "routines_one_active_per_user"',
  'a second active routine is still refused'
);
select is(
  (select activated_at from public.routines where id = '37800000-0000-4000-8000-0000000003a1'),
  '2026-01-01 09:00+00'::timestamptz,
  'the refused activation did not move the date'
);

-- A call that changes nothing does not move the date.
reset role;
update public.routines set activated_at = '2026-01-02 09:00+00' where id = '37800000-0000-4000-8000-0000000003a2';
set local role authenticated;
set local request.jwt.claims = '{"sub":"37800000-0000-4000-8000-00000000000a","role":"authenticated"}';

select lives_ok($$ select public.set_active_routine('37800000-0000-4000-8000-0000000003a2') $$, 'user A makes the active routine active again');
select is(
  (select activated_at from public.routines where id = '37800000-0000-4000-8000-0000000003a2'),
  '2026-01-02 09:00+00'::timestamptz,
  'making the active routine active again leaves its date alone'
);

-- A direct client update of is_active takes the same path as set_active_routine.
update public.routines set is_active = false where id = '37800000-0000-4000-8000-0000000003a2';
select is(
  (select activated_at from public.routines where id = '37800000-0000-4000-8000-0000000003a2'),
  '2026-01-02 09:00+00'::timestamp with time zone,
  'a direct update that deactivates keeps the old date'
);
update public.routines set is_active = true where id = '37800000-0000-4000-8000-0000000003a2';
select is(
  (select activated_at from public.routines where id = '37800000-0000-4000-8000-0000000003a2'),
  now(),
  'a direct update that activates stamps the date'
);

-- The owner role cannot bypass the stamp by sending a value of its own.
reset role;
update public.routines set is_active = false where id = '37800000-0000-4000-8000-0000000003a2';
update public.routines set is_active = true, activated_at = '2000-01-01 00:00+00' where id = '37800000-0000-4000-8000-0000000003a2';
select is(
  (select activated_at from public.routines where id = '37800000-0000-4000-8000-0000000003a2'),
  now(),
  'whatever value an activating statement sends, activated_at becomes now()'
);
update public.routines set is_active = false where id = '37800000-0000-4000-8000-0000000003a2';
update public.routines set is_active = true, activated_at = null where id = '37800000-0000-4000-8000-0000000003a2';
select isnt(
  (select activated_at from public.routines where id = '37800000-0000-4000-8000-0000000003a2'),
  null::timestamptz,
  'an activating statement that sends null still ends with a date'
);

-- User B's date was never touched by any of this.
select is(
  (select activated_at from public.routines where id = '37800000-0000-4000-8000-0000000003b1'),
  '2026-02-01 09:00+00'::timestamptz,
  'user B''s routine kept its date through all of user A''s switches'
);
select is(
  (select count(*)::int from public.routines where user_id = '37800000-0000-4000-8000-00000000000a' and is_active),
  1,
  'user A ends with one active routine'
);
select is(
  (select count(*)::int from public.routines where user_id = '37800000-0000-4000-8000-00000000000b' and is_active),
  1,
  'user B ends with one active routine'
);

select * from finish();

rollback;
