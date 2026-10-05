-- Asserts the owner-only row level security on public.profiles (ADR 0003):
-- select, insert, update and delete are each limited to the signed-in user's
-- own row, and the anon role has no access at all.
--
-- `supabase test db` runs this file as postgres inside a transaction that is
-- rolled back, so nothing created here persists. Each actor is entered with
-- `set local role` plus the JWT claims that `auth.uid()` reads, and left with
-- `reset role`.

begin;

select plan(18);

-- Two users. The on_auth_user_created trigger creates both profiles rows.
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'user-a@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', 'user-b@keylow.test');

-- Select: user A.
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

select is(
  (select count(*)::int from public.profiles),
  1,
  'user A can select exactly one profiles row'
);

select results_eq(
  'select id from public.profiles',
  $$values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid)$$,
  'the row user A can select is their own'
);

select is(
  (select count(*)::int from public.profiles where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  0,
  'user A cannot select user B''s row'
);

reset role;

-- Select: user B.
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';

select is(
  (select count(*)::int from public.profiles),
  1,
  'user B can select exactly one profiles row'
);

select is(
  (select count(*)::int from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  0,
  'user B cannot select user A''s row'
);

reset role;

-- Select: anon.
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  'select * from public.profiles',
  '42501',
  'permission denied for table profiles',
  'anon cannot select from profiles'
);

reset role;

-- Update and insert: user A acting on user B's data, then on their own.
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

select lives_ok(
  $$update public.profiles set timezone = 'Pacific/Auckland' where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'$$,
  'user A updating user B''s row is silently filtered, not an error'
);

reset role;

select is(
  (select timezone from public.profiles where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  'UTC',
  'user B''s row is unchanged after user A tried to update it'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

select lives_ok(
  $$update public.profiles set timezone = 'Europe/London' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'user A can update their own row'
);

select results_eq(
  'select timezone from public.profiles',
  $$values ('Europe/London')$$,
  'user A sees the updated timezone on their own row'
);

select throws_ok(
  $$update public.profiles set id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '42501',
  'new row violates row-level security policy for table "profiles"',
  'user A cannot hand their row over to user B''s id'
);

select throws_ok(
  $$insert into public.profiles (id) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')$$,
  '42501',
  'new row violates row-level security policy for table "profiles"',
  'user A cannot insert a row with user B''s id'
);

-- Delete: user A acting on user B's row, then on their own.
select lives_ok(
  $$delete from public.profiles where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'$$,
  'user A deleting user B''s row is silently filtered, not an error'
);

reset role;

select is(
  (select count(*)::int from public.profiles where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  1,
  'user B''s row still exists after user A tried to delete it'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

select lives_ok(
  $$delete from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'user A can delete their own row'
);

reset role;

select is(
  (select count(*)::int from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  0,
  'user A''s row is gone after they deleted it'
);

-- Insert own row, now that it is free again.
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

select lives_ok(
  $$insert into public.profiles (id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,
  'user A can insert a row with their own id'
);

select is(
  (select count(*)::int from public.profiles),
  1,
  'user A sees their re-inserted row'
);

reset role;

select * from finish();

rollback;
