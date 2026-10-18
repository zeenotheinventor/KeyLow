-- Asserts `delete_workout_session` (ADR 0005, Amendment 2, KEY-378): it soft deletes the caller's
-- live session and stamps every live set of that session in one call, leaves a set that was deleted
-- earlier with its earlier stamp, refuses a null id (22023) and a session that does not exist, is
-- not the caller's or is already deleted (P0002) with messages that state the rule, leaves both
-- tables unchanged when either write fails (the write of the sets, which is the first, and the write
-- of the session, which comes after the sets were stamped), keeps the deleted sets out of the
-- heat read, and is executable by `authenticated` alone.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so
-- nothing created here persists. now() is one value for the whole transaction, so the stamps are
-- compared with it, and the earlier ones are written as fixed older dates. A failure is forced with
-- a restrictive update policy, created and dropped inside the transaction: one on `workout_sets`
-- that refuses a marked set, so the first write fails, and one on `workout_sessions` that refuses
-- the delete stamp, so the second write fails after the sets were stamped. Every fixture id starts
-- with 37800000 and every name and email with key378-. Each actor is entered with `set local role`
-- plus the JWT claims that `auth.uid()` reads, and left with `reset role`.
--
-- Health data: no fixture here is a real user's training, and the refusal messages asserted below
-- state a rule and never a value.

begin;

select plan(45);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '37800000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'key378-user-a@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '37800000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'key378-user-b@keylow.test');

insert into public.exercises (id, owner_id, source, source_ref, name, equipment, mechanic) values
  ('37800000-0000-4000-8000-000000000101', null, 'free_exercise_db', 'KEY378-EX-1', 'key378-global-squat', 'barbell', 'compound');

insert into public.exercise_muscles (exercise_id, owner_id, muscle_id, role, weight) values
  ('37800000-0000-4000-8000-000000000101', null, 'quads', 'primary', 1);

-- A: a live session with two live sets and one set deleted earlier (s1), a live session that
-- stays (s2), a session deleted earlier (s3), a session whose sets are used for the forced failure
-- (s5, whose second set carries the marker position 99), and a live session without sets (s6). B
-- has one live session with one set. s7 is a live session with two sets, used for the failure of the
-- session write.
insert into public.workout_sessions (id, user_id, started_at, ended_at, local_date, tz, deleted_at) values
  ('37800000-0000-4000-8000-0000000006a1', '37800000-0000-4000-8000-00000000000a', '2026-10-17 08:00+00', null, '2026-10-17', 'Europe/London', null),
  ('37800000-0000-4000-8000-0000000006a2', '37800000-0000-4000-8000-00000000000a', '2026-10-16 08:00+00', '2026-10-16 09:00+00', '2026-10-16', 'Europe/London', null),
  ('37800000-0000-4000-8000-0000000006a3', '37800000-0000-4000-8000-00000000000a', '2026-10-01 08:00+00', '2026-10-01 09:00+00', '2026-10-01', 'Europe/London', '2026-10-02 10:00+00'),
  ('37800000-0000-4000-8000-0000000006a5', '37800000-0000-4000-8000-00000000000a', '2026-10-15 08:00+00', '2026-10-15 09:00+00', '2026-10-15', 'Europe/London', null),
  ('37800000-0000-4000-8000-0000000006a6', '37800000-0000-4000-8000-00000000000a', '2026-10-14 08:00+00', '2026-10-14 09:00+00', '2026-10-14', 'Europe/London', null),
  ('37800000-0000-4000-8000-0000000006a7', '37800000-0000-4000-8000-00000000000a', '2026-10-13 08:00+00', '2026-10-13 09:00+00', '2026-10-13', 'Europe/London', null),
  ('37800000-0000-4000-8000-0000000006b1', '37800000-0000-4000-8000-00000000000b', '2026-10-17 09:00+00', '2026-10-17 10:00+00', '2026-10-17', 'Europe/London', null);

create function pg_temp.snapshot(exercise uuid)
returns jsonb language sql as $$
  select jsonb_build_object(
    'version', 1, 'kind', 'exercise', 'ref', exercise, 'name', 'key378-snapshot',
    'equipment', 'barbell', 'mechanic', 'compound', 'muscleListVersion', 1,
    'muscles', jsonb_build_array(jsonb_build_object('muscle_id', 'quads', 'role', 'primary', 'weight', 1))
  )
$$;

insert into public.workout_sets (id, session_id, user_id, exercise_id, position, reps, load_kg, snapshot, deleted_at) values
  ('37800000-0000-4000-8000-0000000007a1', '37800000-0000-4000-8000-0000000006a1', '37800000-0000-4000-8000-00000000000a', '37800000-0000-4000-8000-000000000101', 0, 10, 20, pg_temp.snapshot('37800000-0000-4000-8000-000000000101'), null),
  ('37800000-0000-4000-8000-0000000007a2', '37800000-0000-4000-8000-0000000006a1', '37800000-0000-4000-8000-00000000000a', '37800000-0000-4000-8000-000000000101', 1, 8, 25, pg_temp.snapshot('37800000-0000-4000-8000-000000000101'), null),
  ('37800000-0000-4000-8000-0000000007a3', '37800000-0000-4000-8000-0000000006a1', '37800000-0000-4000-8000-00000000000a', '37800000-0000-4000-8000-000000000101', 2, 6, 30, pg_temp.snapshot('37800000-0000-4000-8000-000000000101'), '2026-10-17 08:30+00'),
  ('37800000-0000-4000-8000-0000000007a4', '37800000-0000-4000-8000-0000000006a2', '37800000-0000-4000-8000-00000000000a', '37800000-0000-4000-8000-000000000101', 0, 12, 15, pg_temp.snapshot('37800000-0000-4000-8000-000000000101'), null),
  ('37800000-0000-4000-8000-0000000007a5', '37800000-0000-4000-8000-0000000006a5', '37800000-0000-4000-8000-00000000000a', '37800000-0000-4000-8000-000000000101', 0, 10, 20, pg_temp.snapshot('37800000-0000-4000-8000-000000000101'), null),
  ('37800000-0000-4000-8000-0000000007a6', '37800000-0000-4000-8000-0000000006a5', '37800000-0000-4000-8000-00000000000a', '37800000-0000-4000-8000-000000000101', 99, 10, 20, pg_temp.snapshot('37800000-0000-4000-8000-000000000101'), null),
  ('37800000-0000-4000-8000-0000000007a7', '37800000-0000-4000-8000-0000000006a7', '37800000-0000-4000-8000-00000000000a', '37800000-0000-4000-8000-000000000101', 0, 10, 20, pg_temp.snapshot('37800000-0000-4000-8000-000000000101'), null),
  ('37800000-0000-4000-8000-0000000007a8', '37800000-0000-4000-8000-0000000006a7', '37800000-0000-4000-8000-00000000000a', '37800000-0000-4000-8000-000000000101', 1, 8, 25, pg_temp.snapshot('37800000-0000-4000-8000-000000000101'), null),
  ('37800000-0000-4000-8000-0000000007b1', '37800000-0000-4000-8000-0000000006b1', '37800000-0000-4000-8000-00000000000b', '37800000-0000-4000-8000-000000000101', 0, 10, 40, pg_temp.snapshot('37800000-0000-4000-8000-000000000101'), null);

-- Privileges. Only authenticated may execute the function, and public may not.
select has_function('public', 'delete_workout_session', array['uuid'], 'delete_workout_session(uuid) exists');
select function_returns('public', 'delete_workout_session', array['uuid'], 'void', 'it returns void');
select ok(
  (select not prosecdef and provolatile = 'v' and proconfig @> array['search_path=""'] from pg_proc where oid = 'public.delete_workout_session(uuid)'::regprocedure),
  'it is a volatile security invoker function with an empty search_path'
);
select is(
  (select array_agg(holder order by holder)
   from (
     select case when privilege.grantee = 0 then 'public' else privilege.grantee::regrole::text end as holder
     from aclexplode((select proacl from pg_proc where oid = 'public.delete_workout_session(uuid)'::regprocedure)) as privilege
   ) as holders),
  array['authenticated', 'postgres'],
  'only its owner and authenticated hold a privilege on it'
);
select is(
  (select array_agg(distinct privilege.privilege_type)
   from aclexplode((select proacl from pg_proc where oid = 'public.delete_workout_session(uuid)'::regprocedure)) as privilege),
  array['EXECUTE'],
  'the only privilege on it is execute'
);
select ok(
  has_function_privilege('authenticated', 'public.delete_workout_session(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.delete_workout_session(uuid)', 'execute')
    and not has_function_privilege('service_role', 'public.delete_workout_session(uuid)', 'execute'),
  'authenticated can execute it, and anon and service_role cannot'
);

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok(
  $$ select public.delete_workout_session('37800000-0000-4000-8000-0000000006a1') $$,
  '42501', 'permission denied for function delete_workout_session',
  'anon cannot call delete_workout_session'
);
reset role;

set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';
select throws_ok(
  $$ select public.delete_workout_session('37800000-0000-4000-8000-0000000006a1') $$,
  '42501', 'permission denied for function delete_workout_session',
  'service_role cannot call delete_workout_session'
);
reset role;

-- User A.
set local role authenticated;
set local request.jwt.claims = '{"sub":"37800000-0000-4000-8000-00000000000a","role":"authenticated"}';

-- Refusals, each leaving everything as it was.
select throws_ok(
  $$ select public.delete_workout_session(null) $$,
  '22023', 'a session id is required',
  'a null id is refused with 22023'
);
select throws_ok(
  $$ select public.delete_workout_session('37800000-0000-4000-8000-00000000dead') $$,
  'P0002', 'the session does not exist, is not yours or is already deleted',
  'a session that does not exist is refused with P0002'
);
select throws_ok(
  $$ select public.delete_workout_session('37800000-0000-4000-8000-0000000006b1') $$,
  'P0002', 'the session does not exist, is not yours or is already deleted',
  'another user''s session is refused the same way'
);
select throws_ok(
  $$ select public.delete_workout_session('37800000-0000-4000-8000-0000000006a3') $$,
  'P0002', 'the session does not exist, is not yours or is already deleted',
  'a session that is already deleted is refused the same way'
);
select is(
  (select deleted_at from public.workout_sessions where id = '37800000-0000-4000-8000-0000000006a3'),
  '2026-10-02 10:00+00'::timestamptz,
  'the refused call kept the earlier stamp of the deleted session'
);

-- The delete.
select lives_ok(
  $$ select public.delete_workout_session('37800000-0000-4000-8000-0000000006a1') $$,
  'user A deletes a live session'
);
select is(
  (select deleted_at from public.workout_sessions where id = '37800000-0000-4000-8000-0000000006a1'),
  now(),
  'the session is soft deleted with now()'
);
select is(
  (select array_agg(deleted_at order by id) from public.workout_sets where id in ('37800000-0000-4000-8000-0000000007a1', '37800000-0000-4000-8000-0000000007a2')),
  array[now(), now()],
  'both live sets of the session are stamped with now()'
);
select is(
  (select deleted_at from public.workout_sets where id = '37800000-0000-4000-8000-0000000007a3'),
  '2026-10-17 08:30+00'::timestamptz,
  'a set deleted earlier keeps its earlier stamp'
);
select is(
  (select count(*)::int from public.workout_sets where session_id = '37800000-0000-4000-8000-0000000006a1' and deleted_at is null),
  0,
  'no live set is left in the deleted session'
);
select is(
  (select count(*)::int from public.workout_sets where session_id = '37800000-0000-4000-8000-0000000006a1'),
  3,
  'the sets are soft deleted, not removed'
);
select is(
  (select deleted_at from public.workout_sessions where id = '37800000-0000-4000-8000-0000000006a2'),
  null::timestamptz,
  'another live session of A is untouched'
);
select is(
  (select deleted_at from public.workout_sets where id = '37800000-0000-4000-8000-0000000007a4'),
  null::timestamptz,
  'the sets of another live session of A are untouched'
);
select throws_ok(
  $$ select public.delete_workout_session('37800000-0000-4000-8000-0000000006a1') $$,
  'P0002', 'the session does not exist, is not yours or is already deleted',
  'a second call on the same session is refused with P0002'
);
select is(
  (select array_agg(deleted_at order by id) from public.workout_sets where id in ('37800000-0000-4000-8000-0000000007a1', '37800000-0000-4000-8000-0000000007a2')),
  array[now(), now()],
  'the second call changed no stamp'
);

-- A session without sets is deleted too.
select lives_ok(
  $$ select public.delete_workout_session('37800000-0000-4000-8000-0000000006a6') $$,
  'a session without sets can be deleted'
);
select is(
  (select deleted_at from public.workout_sessions where id = '37800000-0000-4000-8000-0000000006a6'),
  now(),
  'the session without sets is soft deleted'
);

-- The heat read: the sets that count are those with no deleted_at, and the deleted session's are gone.
select is(
  (select array_agg(id::text order by id) from public.workout_sets where deleted_at is null),
  array['37800000-0000-4000-8000-0000000007a4', '37800000-0000-4000-8000-0000000007a5', '37800000-0000-4000-8000-0000000007a6', '37800000-0000-4000-8000-0000000007a7', '37800000-0000-4000-8000-0000000007a8'],
  'a read of A''s live sets no longer includes the deleted session''s sets'
);

-- A failure of the first write. A restrictive policy refuses an update of the marked set, so the
-- write of the sets fails and nothing was written before it.
reset role;
create policy key378_refuse_marked_set on public.workout_sets
  as restrictive for update to authenticated
  using (true) with check (position <> 99);
set local role authenticated;
set local request.jwt.claims = '{"sub":"37800000-0000-4000-8000-00000000000a","role":"authenticated"}';

select throws_ok(
  $$ select public.delete_workout_session('37800000-0000-4000-8000-0000000006a5') $$,
  '42501', null,
  'a failure while the sets are written is raised'
);
select is(
  (select deleted_at from public.workout_sessions where id = '37800000-0000-4000-8000-0000000006a5'),
  null::timestamptz,
  'after the failure the session is not deleted'
);
select is(
  (select count(*)::int from public.workout_sets where session_id = '37800000-0000-4000-8000-0000000006a5' and deleted_at is null),
  2,
  'after the failure both sets are still live'
);

reset role;
drop policy key378_refuse_marked_set on public.workout_sets;
set local role authenticated;
set local request.jwt.claims = '{"sub":"37800000-0000-4000-8000-00000000000a","role":"authenticated"}';

select lives_ok(
  $$ select public.delete_workout_session('37800000-0000-4000-8000-0000000006a5') $$,
  'with the policy gone the same call succeeds'
);
select is(
  (select count(*)::int from public.workout_sets where session_id = '37800000-0000-4000-8000-0000000006a5' and deleted_at = now()),
  2,
  'and it stamps both sets'
);
select is(
  (select deleted_at from public.workout_sessions where id = '37800000-0000-4000-8000-0000000006a5'),
  now(),
  'and the session'
);

-- A failure of the second write. A restrictive policy refuses the delete stamp on a session, so the
-- write of the session fails after both of its sets were stamped, and the sets must be live again.
reset role;
create policy key378_refuse_session_delete on public.workout_sessions
  as restrictive for update to authenticated
  using (true) with check (deleted_at is null);
set local role authenticated;
set local request.jwt.claims = '{"sub":"37800000-0000-4000-8000-00000000000a","role":"authenticated"}';

select throws_ok(
  $$ select public.delete_workout_session('37800000-0000-4000-8000-0000000006a7') $$,
  '42501', null,
  'a failure while the session is written is raised'
);
select is(
  (select deleted_at from public.workout_sessions where id = '37800000-0000-4000-8000-0000000006a7'),
  null::timestamptz,
  'after the failure the session is not deleted'
);
select is(
  (select count(*)::int from public.workout_sets where session_id = '37800000-0000-4000-8000-0000000006a7' and deleted_at is null),
  2,
  'after the failure the sets that were stamped before it are live again'
);

reset role;
drop policy key378_refuse_session_delete on public.workout_sessions;
set local role authenticated;
set local request.jwt.claims = '{"sub":"37800000-0000-4000-8000-00000000000a","role":"authenticated"}';

select lives_ok(
  $$ select public.delete_workout_session('37800000-0000-4000-8000-0000000006a7') $$,
  'with the policy gone the same call succeeds'
);
select is(
  (select count(*)::int from public.workout_sets where session_id = '37800000-0000-4000-8000-0000000006a7' and deleted_at = now()),
  2,
  'and it stamps both sets'
);
select is(
  (select deleted_at from public.workout_sessions where id = '37800000-0000-4000-8000-0000000006a7'),
  now(),
  'and the session'
);

-- User B.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"37800000-0000-4000-8000-00000000000b","role":"authenticated"}';

select is(
  (select deleted_at from public.workout_sessions where id = '37800000-0000-4000-8000-0000000006b1'),
  null::timestamptz,
  'user B''s session was never touched by any of A''s calls'
);
select is(
  (select deleted_at from public.workout_sets where id = '37800000-0000-4000-8000-0000000007b1'),
  null::timestamptz,
  'user B''s set was never touched by any of A''s calls'
);
select throws_ok(
  $$ select public.delete_workout_session('37800000-0000-4000-8000-0000000006a2') $$,
  'P0002', 'the session does not exist, is not yours or is already deleted',
  'user B cannot delete user A''s session'
);
select lives_ok(
  $$ select public.delete_workout_session('37800000-0000-4000-8000-0000000006b1') $$,
  'user B deletes their own session'
);
select is(
  (select deleted_at from public.workout_sets where id = '37800000-0000-4000-8000-0000000007b1'),
  now(),
  'and its set'
);

-- A's live session and set are still there, as seen from the owner's role.
reset role;
select is(
  (select deleted_at from public.workout_sessions where id = '37800000-0000-4000-8000-0000000006a2'),
  null::timestamptz,
  'user A''s other session survived user B''s attempt'
);
select is(
  (select count(*)::int from public.workout_sets where deleted_at is null and user_id = '37800000-0000-4000-8000-00000000000a'),
  1,
  'one live set of A is left, the one in the session that was not deleted'
);

select * from finish();

rollback;
