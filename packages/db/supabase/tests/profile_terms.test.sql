-- Asserts how terms acceptance is recorded on public.profiles (ADR 0003,
-- Amendment 3): the two nullable columns, the sign-up trigger that fills them
-- from user metadata, the accept_terms() RPC, and the narrowed table grants
-- that leave those two columns writable only through the trigger and the RPC.
--
-- `supabase test db` runs this file as postgres inside a transaction that is
-- rolled back, so nothing created here persists. Each actor is entered with
-- `set local role` plus the JWT claims that `auth.uid()` reads, and left with
-- `reset role`.

begin;

select plan(41);

-- Columns.
select has_column('public', 'profiles', 'terms_accepted_at', 'profiles has terms_accepted_at');
select col_type_is('public', 'profiles', 'terms_accepted_at', 'timestamp with time zone', 'terms_accepted_at is timestamptz');
select col_is_null('public', 'profiles', 'terms_accepted_at', 'terms_accepted_at is nullable');
select has_column('public', 'profiles', 'terms_version', 'profiles has terms_version');
select col_type_is('public', 'profiles', 'terms_version', 'text', 'terms_version is text');
select col_is_null('public', 'profiles', 'terms_version', 'terms_version is nullable');

-- Sign-up trigger. User A has no metadata, B sends blank metadata, C sends a
-- version and also tries to choose its own timestamp, D and E are the two
-- users the RPC tests act on.
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'terms-a@keylow.test', null),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', 'terms-b@keylow.test', '{"terms_version":"   "}'),
  ('00000000-0000-0000-0000-000000000000', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'authenticated', 'authenticated', 'terms-c@keylow.test', '{"terms_version":"2026-10-15","terms_accepted_at":"2000-01-01T00:00:00Z"}'),
  ('00000000-0000-0000-0000-000000000000', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'authenticated', 'authenticated', 'terms-d@keylow.test', '{"unrelated":"value"}'),
  ('00000000-0000-0000-0000-000000000000', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'authenticated', 'authenticated', 'terms-e@keylow.test', '{}');

select results_eq(
  $$select terms_accepted_at is null, terms_version is null from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  $$values (true, true)$$,
  'sign-up without metadata leaves both terms columns null'
);

select results_eq(
  $$select terms_accepted_at is null, terms_version is null from public.profiles where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'$$,
  $$values (true, true)$$,
  'sign-up with a blank terms_version leaves both terms columns null'
);

select is(
  (select terms_version from public.profiles where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
  '2026-10-15',
  'sign-up with a terms_version records that version'
);

select is(
  (select terms_accepted_at from public.profiles where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
  now(),
  'sign-up takes terms_accepted_at from the database clock, not from the metadata'
);

select results_eq(
  $$select terms_accepted_at is null, terms_version is null from public.profiles where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'$$,
  $$values (true, true)$$,
  'sign-up with unrelated metadata leaves both terms columns null'
);

-- The two columns are set together or not at all.
select throws_ok(
  $$update public.profiles set terms_version = '2026-10-15' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '23514',
  'new row for relation "profiles" violates check constraint "profiles_terms_acceptance_paired"',
  'a version without a timestamp is rejected'
);

select throws_ok(
  $$update public.profiles set terms_accepted_at = now() where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '23514',
  'new row for relation "profiles" violates check constraint "profiles_terms_acceptance_paired"',
  'a timestamp without a version is rejected'
);

-- accept_terms: function shape.
select function_returns('public', 'accept_terms', array['text'], 'void', 'accept_terms returns void');
select is_definer('public', 'accept_terms', array['text'], 'accept_terms is security definer');

select ok(
  (select proconfig @> array['search_path=""'] from pg_proc where oid = 'public.accept_terms(text)'::regprocedure),
  'accept_terms pins an empty search_path'
);

select ok(
  not has_function_privilege('service_role', 'public.accept_terms(text)', 'execute'),
  'service_role holds no execute privilege on accept_terms'
);

select ok(
  not (
    select bool_or(has_function_privilege(role_name, 'public.handle_new_user()', 'execute'))
    from unnest(array['anon', 'authenticated', 'service_role']) as role_name
  ),
  'anon, authenticated and service_role hold no execute privilege on handle_new_user'
);

select ok(
  not (
    select bool_or(has_column_privilege('authenticated', 'public.profiles', column_name, 'insert'))
    from unnest(array['created_at', 'terms_accepted_at', 'terms_version']) as column_name
  ),
  'authenticated holds no insert privilege on created_at, terms_accepted_at or terms_version'
);

-- accept_terms: user D accepts.
set local role authenticated;
set local request.jwt.claims = '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated"}';

select lives_ok(
  $$select public.accept_terms('2026-10-15')$$,
  'a signed-in user can accept the terms'
);

reset role;

select results_eq(
  $$select terms_version, terms_accepted_at = now() from public.profiles where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'$$,
  $$values ('2026-10-15', true)$$,
  'accept_terms sets the version and the database time on the caller''s row'
);

select results_eq(
  $$select terms_accepted_at is null, terms_version is null from public.profiles where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'$$,
  $$values (true, true)$$,
  'accept_terms leaves another user''s row unchanged'
);

-- Accepting a newer version overwrites both columns. The old timestamp is put
-- back in the past first so the overwrite is visible inside one transaction.
update public.profiles
set terms_accepted_at = now() - interval '1 day'
where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

set local role authenticated;
set local request.jwt.claims = '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated"}';

select lives_ok(
  $$select public.accept_terms('2027-01-01')$$,
  'a user who already accepted can accept a newer version'
);

reset role;

select results_eq(
  $$select terms_version, terms_accepted_at = now() from public.profiles where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'$$,
  $$values ('2027-01-01', true)$$,
  'accepting a newer version overwrites both columns'
);

-- accept_terms: rejected input and callers.
set local role authenticated;
set local request.jwt.claims = '{"sub":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","role":"authenticated"}';

select throws_ok(
  $$select public.accept_terms(null)$$,
  '22023',
  'accept_terms needs a non-empty version',
  'accept_terms rejects a null version'
);

select throws_ok(
  $$select public.accept_terms('')$$,
  '22023',
  'accept_terms needs a non-empty version',
  'accept_terms rejects an empty version'
);

select throws_ok(
  $$select public.accept_terms('   ')$$,
  '22023',
  'accept_terms needs a non-empty version',
  'accept_terms rejects a blank version'
);

reset role;

select results_eq(
  $$select terms_accepted_at is null, terms_version is null from public.profiles where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'$$,
  $$values (true, true)$$,
  'a rejected accept_terms call writes nothing'
);

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated"}';

select throws_ok(
  $$select public.accept_terms('2026-10-15')$$,
  '28000',
  'accept_terms needs a signed-in user',
  'accept_terms raises when there is no signed-in user'
);

set local request.jwt.claims = '{"sub":"ffffffff-ffff-4fff-8fff-ffffffffffff","role":"authenticated"}';

select throws_ok(
  $$select public.accept_terms('2026-10-15')$$,
  'P0002',
  'accept_terms found no profile for the signed-in user',
  'accept_terms raises when the caller has no profile row'
);

reset role;

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  $$select public.accept_terms('2026-10-15')$$,
  '42501',
  'permission denied for function accept_terms',
  'anon cannot execute accept_terms'
);

reset role;

-- Direct writes: the terms columns are closed to the signed-in role, the other
-- profile columns still work.
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

select throws_ok(
  $$update public.profiles set terms_accepted_at = now() where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '42501',
  'permission denied for table profiles',
  'authenticated cannot update terms_accepted_at directly'
);

select throws_ok(
  $$update public.profiles set terms_version = '2026-10-15' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '42501',
  'permission denied for table profiles',
  'authenticated cannot update terms_version directly'
);

select throws_ok(
  $$insert into public.profiles (id, terms_version, terms_accepted_at) values ('ffffffff-ffff-4fff-8fff-ffffffffffff', '2026-10-15', now())$$,
  '42501',
  'permission denied for table profiles',
  'authenticated cannot insert a row with the terms columns set'
);

select throws_ok(
  $$update public.profiles set created_at = now() where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '42501',
  'permission denied for table profiles',
  'authenticated cannot update created_at'
);

select throws_ok(
  $$update public.profiles set id = 'ffffffff-ffff-4fff-8fff-ffffffffffff' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '42501',
  'permission denied for table profiles',
  'authenticated cannot update id'
);

select lives_ok(
  $$update public.profiles set timezone = 'Europe/London', weight_unit = 'kg' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'authenticated can still update the other profile columns'
);

select results_eq(
  'select timezone from public.profiles',
  $$values ('Europe/London')$$,
  'the allowed update took effect on the caller''s own row'
);

-- Deleting the row and inserting it again is still possible, and starts
-- without an acceptance, which the accept-to-continue gate then catches.
select lives_ok(
  $$delete from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'authenticated can still delete their own row'
);

select lives_ok(
  $$insert into public.profiles (id, timezone) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'UTC')$$,
  'authenticated can still insert their own row without the terms columns'
);

reset role;

select results_eq(
  $$select terms_accepted_at is null, terms_version is null from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  $$values (true, true)$$,
  'a re-inserted profile row starts without an acceptance'
);

select * from finish();

rollback;
