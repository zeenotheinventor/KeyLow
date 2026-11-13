-- Asserts public.push_tokens (ADR 0003, Amendment 25): the table, its checks, the exact privileges,
-- owner-only row level security for every verb, the cascade from the account, and the two functions
-- that register and unregister a phone's token.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so nothing
-- created here persists. Every fixture id starts with 10660000 and every token with
-- ExponentPushToken[key1066-. Each assertion reads only those rows, never a whole table. Each actor is
-- entered with `set local role` plus the JWT claims that `auth.uid()` reads, and left with
-- `reset role`.

begin;

select plan(52);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '10660000-0000-4000-8000-0000000000aa', 'authenticated', 'authenticated', 'key1066-a@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '10660000-0000-4000-8000-0000000000bb', 'authenticated', 'authenticated', 'key1066-b@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '10660000-0000-4000-8000-0000000000cc', 'authenticated', 'authenticated', 'key1066-c@keylow.test');

-- Shape.
select has_table('public', 'push_tokens', 'push_tokens exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.push_tokens'::regclass),
  'row level security is enabled on push_tokens'
);
select col_is_pk('public', 'push_tokens', 'id', 'the primary key is id');
select col_default_is('public', 'push_tokens', 'id', 'gen_random_uuid()', 'id defaults to a random uuid');
select col_not_null('public', 'push_tokens', 'user_id', 'user_id is not null');
select col_default_is('public', 'push_tokens', 'user_id', 'auth.uid()', 'user_id defaults to the caller');
select fk_ok('public', 'push_tokens', 'user_id', 'auth', 'users', 'id', 'user_id references auth.users');
select col_not_null('public', 'push_tokens', 'token', 'token is not null');
select col_is_unique('public', 'push_tokens', 'token', 'token is unique');
select col_not_null('public', 'push_tokens', 'platform', 'platform is not null');
select col_not_null('public', 'push_tokens', 'created_at', 'created_at is not null');
select col_default_is('public', 'push_tokens', 'created_at', 'now()', 'created_at defaults to now()');
select col_not_null('public', 'push_tokens', 'updated_at', 'updated_at is not null');
select col_default_is('public', 'push_tokens', 'updated_at', 'now()', 'updated_at defaults to now()');
select has_index('public', 'push_tokens', 'push_tokens_user_id_idx', array['user_id'], 'the user index exists');

-- Owner writes, with user_id defaulted.
set local role authenticated;
set local request.jwt.claims = '{"sub":"10660000-0000-4000-8000-0000000000aa","role":"authenticated"}';

select lives_ok(
  $$insert into public.push_tokens (token, platform) values ('ExponentPushToken[key1066-a1]', 'android')$$,
  'a user inserts a token'
);
select is(
  (select user_id from public.push_tokens where token = 'ExponentPushToken[key1066-a1]'),
  '10660000-0000-4000-8000-0000000000aa'::uuid,
  'user_id was defaulted to the caller'
);
select throws_ok(
  $$insert into public.push_tokens (user_id, token, platform) values ('10660000-0000-4000-8000-0000000000bb', 'ExponentPushToken[key1066-a-for-b]', 'ios')$$,
  '42501',
  'permission denied for table push_tokens',
  'a user cannot set user_id'
);

-- The token and platform checks.
select throws_ok(
  $$insert into public.push_tokens (token, platform) values ('key1066-no-prefix', 'ios')$$,
  '23514',
  null,
  'a token without the ExponentPushToken prefix is refused'
);
select throws_ok(
  $$insert into public.push_tokens (token, platform) values ('ExponentPushToken[key1066-open', 'ios')$$,
  '23514',
  null,
  'a token that does not close its bracket is refused'
);
select throws_ok(
  $$insert into public.push_tokens (token, platform) values ('ExponentPushToken[key1066-' || repeat('x', 200) || ']', 'ios')$$,
  '23514',
  null,
  'a token over 200 characters is refused'
);
select throws_ok(
  $$insert into public.push_tokens (token, platform) values ('ExponentPushToken[]', 'ios')$$,
  '23514',
  null,
  'a token with nothing inside the brackets is refused'
);
select lives_ok(
  $$insert into public.push_tokens (token, platform) values ('ExponentPushToken[' || repeat('x', 181) || ']', 'ios')$$,
  'a token of exactly 200 characters is accepted'
);
select throws_ok(
  $$insert into public.push_tokens (token, platform) values ('ExponentPushToken[key1066-a-web]', 'web')$$,
  '23514',
  null,
  'an unknown platform is refused'
);
select throws_ok(
  $$insert into public.push_tokens (token, platform) values ('ExponentPushToken[key1066-a1]', 'ios')$$,
  '23505',
  null,
  'the same token cannot be inserted twice'
);

-- The owner updates and deletes their own row.
select lives_ok(
  $$update public.push_tokens set platform = 'ios' where token = 'ExponentPushToken[key1066-a1]'$$,
  'a user updates their own token'
);
select is(
  (select platform from public.push_tokens where token = 'ExponentPushToken[key1066-a1]'),
  'ios',
  'the update was applied'
);
select throws_ok(
  $$update public.push_tokens set user_id = '10660000-0000-4000-8000-0000000000bb' where token = 'ExponentPushToken[key1066-a1]'$$,
  '42501',
  'permission denied for table push_tokens',
  'a user cannot hand a row to someone else'
);
select lives_ok(
  $$insert into public.push_tokens (token, platform) values ('ExponentPushToken[key1066-a2]', 'android')$$,
  'a user inserts a second token'
);
select lives_ok(
  $$delete from public.push_tokens where token = 'ExponentPushToken[key1066-a2]'$$,
  'a user deletes their own token'
);
select is(
  (select count(*)::int from public.push_tokens where token = 'ExponentPushToken[key1066-a2]'),
  0,
  'the delete removed the row'
);

-- Another person cannot see, change or delete the row.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"10660000-0000-4000-8000-0000000000bb","role":"authenticated"}';

select is(
  (select count(*)::int from public.push_tokens where token = 'ExponentPushToken[key1066-a1]'),
  0,
  'user B cannot read user A''s token'
);
update public.push_tokens set platform = 'android' where token = 'ExponentPushToken[key1066-a1]';
delete from public.push_tokens where token = 'ExponentPushToken[key1066-a1]';
reset role;
select is(
  (select platform from public.push_tokens where token = 'ExponentPushToken[key1066-a1]'),
  'ios',
  'user A''s row is unchanged and still there after user B tried to update and delete it'
);

-- Registering as B moves the token from A to B. A cannot see it afterwards.
set local role authenticated;
set local request.jwt.claims = '{"sub":"10660000-0000-4000-8000-0000000000bb","role":"authenticated"}';
select lives_ok(
  $$select public.register_push_token('ExponentPushToken[key1066-a1]', 'android')$$,
  'user B registers a token that user A holds'
);
select is(
  (select user_id from public.push_tokens where token = 'ExponentPushToken[key1066-a1]'),
  '10660000-0000-4000-8000-0000000000bb'::uuid,
  'the token moved to user B'
);
reset role;
select is(
  (select count(*)::int from public.push_tokens where token = 'ExponentPushToken[key1066-a1]'),
  1,
  'the token is still one row after the move'
);
select is(
  (select platform from public.push_tokens where token = 'ExponentPushToken[key1066-a1]'),
  'android',
  'the move took the new platform'
);

-- Registering again as the same person is idempotent, and keeps created_at.
set local role authenticated;
set local request.jwt.claims = '{"sub":"10660000-0000-4000-8000-0000000000bb","role":"authenticated"}';
select lives_ok(
  $$select public.register_push_token('ExponentPushToken[key1066-a1]', 'android')$$,
  'user B registers the same token again'
);
reset role;
select is(
  (select count(*)::int from public.push_tokens where token = 'ExponentPushToken[key1066-a1]'),
  1,
  'registering the same token twice leaves one row'
);

-- A new token registers as a new row for the caller, and bad input is refused.
set local role authenticated;
set local request.jwt.claims = '{"sub":"10660000-0000-4000-8000-0000000000cc","role":"authenticated"}';
select lives_ok(
  $$select public.register_push_token('ExponentPushToken[key1066-c1]', 'ios')$$,
  'user C registers a new token'
);
select throws_ok(
  $$select public.register_push_token('not-a-token', 'ios')$$,
  '23514',
  null,
  'registering a malformed token is refused'
);

-- Unregister deletes only the caller's row, and is quiet about a token that is not theirs.
select lives_ok(
  $$select public.unregister_push_token('ExponentPushToken[key1066-a1]')$$,
  'user C unregistering a token user B holds is not an error'
);
reset role;
select is(
  (select count(*)::int from public.push_tokens where token = 'ExponentPushToken[key1066-a1]'),
  1,
  'user C did not remove user B''s token'
);
set local role authenticated;
set local request.jwt.claims = '{"sub":"10660000-0000-4000-8000-0000000000cc","role":"authenticated"}';
select lives_ok(
  $$select public.unregister_push_token('ExponentPushToken[key1066-c1]')$$,
  'user C unregisters their own token'
);
reset role;
select is(
  (select count(*)::int from public.push_tokens where token = 'ExponentPushToken[key1066-c1]'),
  0,
  'the token is gone'
);

-- Anon has nothing and cannot call either function.
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok('select * from public.push_tokens', '42501', 'permission denied for table push_tokens', 'anon cannot select');
select throws_ok(
  $$select public.register_push_token('ExponentPushToken[key1066-anon]', 'ios')$$,
  '42501',
  'permission denied for function register_push_token',
  'anon cannot register a token'
);
select throws_ok(
  $$select public.unregister_push_token('ExponentPushToken[key1066-b1]')$$,
  '42501',
  'permission denied for function unregister_push_token',
  'anon cannot unregister a token'
);
reset role;

-- The service role reads and deletes for the assistant function, and inserts and updates nothing.
select ok(
  has_table_privilege('service_role', 'public.push_tokens', 'select')
    and not has_any_column_privilege('service_role', 'public.push_tokens', 'insert')
    and not has_any_column_privilege('service_role', 'public.push_tokens', 'update')
    and has_table_privilege('service_role', 'public.push_tokens', 'delete'),
  'service_role can select and delete, cannot insert or update'
);
select ok(
  not has_table_privilege('anon', 'public.push_tokens', 'select')
    and not has_any_column_privilege('anon', 'public.push_tokens', 'insert')
    and not has_any_column_privilege('anon', 'public.push_tokens', 'update')
    and not has_table_privilege('anon', 'public.push_tokens', 'delete'),
  'anon has no privilege on push_tokens'
);

-- updated_at moves on every update, and a client cannot choose it.
update public.push_tokens set updated_at = '2001-01-01', platform = 'ios' where token = 'ExponentPushToken[key1066-a1]';
select ok(
  (select updated_at > now() - interval '1 minute' from public.push_tokens where token = 'ExponentPushToken[key1066-a1]'),
  'updated_at is stamped by the trigger, whatever the update sent'
);

-- Deleting the account removes its rows.
delete from auth.users where id = '10660000-0000-4000-8000-0000000000bb';
select is(
  (select count(*)::int from public.push_tokens where token = 'ExponentPushToken[key1066-a1]'),
  0,
  'deleting the account removed its token'
);

select * from finish();
rollback;
