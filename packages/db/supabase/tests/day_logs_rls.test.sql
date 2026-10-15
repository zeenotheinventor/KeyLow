-- Asserts public.day_logs (ADR 0003): one row per user per local day, owner-only
-- through row level security and explicit grants. A day's completion and note
-- are the only things a client writes after the row exists.
--
-- `supabase test db` runs this file as postgres inside a transaction that is
-- rolled back, so nothing created here persists. Every fixture id starts with
-- 18100000 and every email and note with key181-. Each actor is entered with
-- `set local role` plus the JWT claims that `auth.uid()` reads, and left with
-- `reset role`.

begin;

select plan(35);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '18100000-0000-4000-8000-0000000000da', 'authenticated', 'authenticated', 'key181-days-a@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '18100000-0000-4000-8000-0000000000db', 'authenticated', 'authenticated', 'key181-days-b@keylow.test');

insert into public.day_logs (user_id, local_date, is_complete, completed_at, note) values
  ('18100000-0000-4000-8000-0000000000da', '2026-10-14', true, '2026-10-14 22:00:00+00', 'key181-a-complete'),
  ('18100000-0000-4000-8000-0000000000db', '2026-10-14', false, null, 'key181-b-open');

-- Shape.
select ok(
  (select relrowsecurity from pg_class where oid = 'public.day_logs'::regclass),
  'row level security is enabled on day_logs'
);
select col_is_pk('public', 'day_logs', array['user_id', 'local_date'], 'the primary key is (user_id, local_date)');
select col_type_is('public', 'day_logs', 'local_date', 'date', 'local_date is a date');
select col_not_null('public', 'day_logs', 'is_complete', 'is_complete is not null');
select col_default_is('public', 'day_logs', 'is_complete', 'false', 'is_complete defaults to false');
select col_not_null('public', 'day_logs', 'created_at', 'created_at is not null');
select col_default_is('public', 'day_logs', 'created_at', 'now()', 'created_at defaults to now()');
select is(
  (select created_at from public.day_logs where note = 'key181-a-complete'),
  now(),
  'a new day gets created_at from the database clock'
);
select col_is_null('public', 'day_logs', 'completed_at', 'completed_at is nullable');
select col_is_null('public', 'day_logs', 'note', 'note is nullable');

select throws_ok(
  $$insert into public.day_logs (user_id, local_date) values ('18100000-0000-4000-8000-0000000000da', '2026-10-14')$$,
  '23505',
  'duplicate key value violates unique constraint "day_logs_pkey"',
  'a user has one day_logs row per local day'
);

-- Privileges, read from the catalog.
select ok(
  not has_table_privilege('anon', 'public.day_logs', 'select')
    and not has_table_privilege('anon', 'public.day_logs', 'insert')
    and not has_table_privilege('anon', 'public.day_logs', 'update')
    and not has_table_privilege('anon', 'public.day_logs', 'delete'),
  'anon has no privilege on day_logs'
);
select ok(
  not has_table_privilege('service_role', 'public.day_logs', 'select')
    and not has_table_privilege('service_role', 'public.day_logs', 'insert')
    and not has_table_privilege('service_role', 'public.day_logs', 'update')
    and not has_table_privilege('service_role', 'public.day_logs', 'delete')
    and not has_table_privilege('service_role', 'public.day_logs', 'truncate')
    and not has_table_privilege('service_role', 'public.day_logs', 'references')
    and not has_table_privilege('service_role', 'public.day_logs', 'trigger'),
  'service_role has no privilege on day_logs'
);
select ok(
  has_table_privilege('authenticated', 'public.day_logs', 'select')
    and not has_table_privilege('authenticated', 'public.day_logs', 'delete'),
  'authenticated can select and cannot delete'
);
select ok(
  has_column_privilege('authenticated', 'public.day_logs', 'is_complete', 'update')
    and has_column_privilege('authenticated', 'public.day_logs', 'completed_at', 'update')
    and has_column_privilege('authenticated', 'public.day_logs', 'note', 'update'),
  'is_complete, completed_at and note are updatable'
);
select ok(
  not has_column_privilege('authenticated', 'public.day_logs', 'user_id', 'update')
    and not has_column_privilege('authenticated', 'public.day_logs', 'local_date', 'update')
    and not has_column_privilege('authenticated', 'public.day_logs', 'created_at', 'update')
    and not has_column_privilege('authenticated', 'public.day_logs', 'created_at', 'insert'),
  'the key columns and created_at are never updatable, created_at is never insertable'
);

-- User A.
set local role authenticated;
set local request.jwt.claims = '{"sub":"18100000-0000-4000-8000-0000000000da","role":"authenticated"}';

select is(
  (select count(*)::int from public.day_logs where note like 'key181-%'),
  1,
  'user A selects exactly one day'
);
select is(
  (select note from public.day_logs where note like 'key181-%'),
  'key181-a-complete',
  'the day user A can select is their own'
);

select lives_ok(
  $$insert into public.day_logs (local_date, note) values ('2026-10-15', 'key181-a-today')$$,
  'user A inserts a day without sending user_id'
);
select is(
  (select user_id from public.day_logs where note = 'key181-a-today'),
  '18100000-0000-4000-8000-0000000000da'::uuid,
  'user_id defaults to the caller'
);
select is(
  (select is_complete from public.day_logs where note = 'key181-a-today'),
  false,
  'a new day is not complete'
);
select lives_ok(
  $$insert into public.day_logs (user_id, local_date, is_complete, completed_at) values ('18100000-0000-4000-8000-0000000000da', '2026-10-16', true, '2026-10-16 21:00:00+00')$$,
  'user A inserts a completed day for themselves'
);
select throws_ok(
  $$insert into public.day_logs (user_id, local_date) values ('18100000-0000-4000-8000-0000000000db', '2026-10-17')$$,
  '42501',
  'new row violates row-level security policy for table "day_logs"',
  'user A cannot insert a day for user B'
);
select lives_ok(
  $$update public.day_logs set is_complete = true, completed_at = '2026-10-15 22:00:00+00', note = 'key181-a-done' where note = 'key181-a-today'$$,
  'user A completes their own day and edits the note'
);
select is(
  (select is_complete from public.day_logs where note = 'key181-a-done'),
  true,
  'the day is complete'
);
select lives_ok(
  $$update public.day_logs set is_complete = true where note = 'key181-b-open'$$,
  'user A updating user B''s day is filtered, not an error'
);
select throws_ok(
  $$update public.day_logs set user_id = '18100000-0000-4000-8000-0000000000db' where note = 'key181-a-done'$$,
  '42501',
  'permission denied for table day_logs',
  'user A cannot hand a day to user B'
);
select throws_ok(
  $$update public.day_logs set local_date = '2026-10-20' where note = 'key181-a-done'$$,
  '42501',
  'permission denied for table day_logs',
  'user A cannot move a day to another date'
);
select throws_ok(
  $$delete from public.day_logs where note = 'key181-a-done'$$,
  '42501',
  'permission denied for table day_logs',
  'user A cannot delete a day'
);

reset role;

select is(
  (select is_complete from public.day_logs where note = 'key181-b-open'),
  false,
  'user B''s day was not changed by user A'
);

-- User B.
set local role authenticated;
set local request.jwt.claims = '{"sub":"18100000-0000-4000-8000-0000000000db","role":"authenticated"}';

select is(
  (select count(*)::int from public.day_logs where note like 'key181-%'),
  1,
  'user B selects exactly one day'
);
select is(
  (select note from public.day_logs where note like 'key181-%'),
  'key181-b-open',
  'the day user B can select is their own'
);

reset role;

-- Anon.
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  'select * from public.day_logs',
  '42501',
  'permission denied for table day_logs',
  'anon cannot select from day_logs'
);

reset role;

-- Policies: one per statement the owner may run, and none for delete.
select policies_are(
  'public',
  'day_logs',
  array['day_logs_select_own', 'day_logs_insert_own', 'day_logs_update_own'],
  'day_logs has exactly the select, insert and update owner policies'
);
select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'day_logs' and roles = '{authenticated}'),
  3,
  'every day_logs policy is for authenticated only'
);

select * from finish();

rollback;
