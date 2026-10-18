-- Asserts that a set can only be written into a live session (ADR 0005, Amendment 2, KEY-378). The
-- rule is the trigger `workout_sets_require_live_session`: inserting a set into a deleted session is
-- refused, a set cannot be revived behind a deleted session, and the live paths (inserting into a
-- live session, editing, deleting and reviving a set of one) still work. Restoring the session first
-- makes its sets revivable again, which is the order an undo takes. The trigger's own properties
-- are asserted too. The race it closes, a write that started before a delete committed, needs two
-- connections and is not shown by a single rolled back transaction.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so
-- nothing created here persists. Every fixture id starts with 37800000 and every name and email
-- with key378-. Each actor is entered with `set local role` plus the JWT claims that `auth.uid()`
-- reads, and left with `reset role`.
--
-- Health data: no fixture here is a real user's training, and nothing asserted quotes a value.

begin;

select plan(20);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '37800000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'key378-user-a@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '37800000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'key378-user-b@keylow.test');

insert into public.exercises (id, owner_id, source, source_ref, name, equipment, mechanic) values
  ('37800000-0000-4000-8000-000000000101', null, 'free_exercise_db', 'KEY378-EX-2', 'key378-global-press', 'barbell', 'compound');

insert into public.exercise_muscles (exercise_id, owner_id, muscle_id, role, weight) values
  ('37800000-0000-4000-8000-000000000101', null, 'chest_lower', 'primary', 1);

-- A has a live session and a session deleted earlier, which holds one set deleted with it. B has a
-- live session.
insert into public.workout_sessions (id, user_id, started_at, ended_at, local_date, tz, deleted_at) values
  ('37800000-0000-4000-8000-0000000006a1', '37800000-0000-4000-8000-00000000000a', '2026-10-17 08:00+00', null, '2026-10-17', 'Europe/London', null),
  ('37800000-0000-4000-8000-0000000006a3', '37800000-0000-4000-8000-00000000000a', '2026-10-01 08:00+00', '2026-10-01 09:00+00', '2026-10-01', 'Europe/London', '2026-10-02 10:00+00'),
  ('37800000-0000-4000-8000-0000000006b1', '37800000-0000-4000-8000-00000000000b', '2026-10-17 09:00+00', null, '2026-10-17', 'Europe/London', null);

create function pg_temp.snapshot(exercise uuid)
returns jsonb language sql as $$
  select jsonb_build_object(
    'version', 1, 'kind', 'exercise', 'ref', exercise, 'name', 'key378-snapshot',
    'equipment', 'barbell', 'mechanic', 'compound', 'muscleListVersion', 1,
    'muscles', jsonb_build_array(jsonb_build_object('muscle_id', 'chest_lower', 'role', 'primary', 'weight', 1))
  )
$$;

insert into public.workout_sets (id, session_id, user_id, exercise_id, position, reps, load_kg, snapshot, deleted_at) values
  ('37800000-0000-4000-8000-0000000007a3', '37800000-0000-4000-8000-0000000006a3', '37800000-0000-4000-8000-00000000000a', '37800000-0000-4000-8000-000000000101', 0, 10, 20, pg_temp.snapshot('37800000-0000-4000-8000-000000000101'), '2026-10-02 10:00+00');

-- The write a client makes to log a set, run with the caller's privileges.
create function pg_temp.log_set(target_session uuid, set_position integer default 0)
returns void language sql as $$
  insert into public.workout_sets (session_id, user_id, exercise_id, position, reps, load_kg, snapshot)
  values (target_session, '37800000-0000-4000-8000-00000000000a', '37800000-0000-4000-8000-000000000101', set_position, 10, 20,
    pg_temp.snapshot('37800000-0000-4000-8000-000000000101'))
$$;

-- The trigger and its function.
select has_trigger('public', 'workout_sets', 'workout_sets_require_live_session', 'workout_sets has the live session trigger');
select is(
  (select tgtype::int from pg_trigger where tgrelid = 'public.workout_sets'::regclass and tgname = 'workout_sets_require_live_session'),
  23,
  'the trigger is a before insert or update trigger that runs for each row'
);
select is(
  (select array_agg(attname::text order by attname::text collate "C") from pg_trigger t
   join pg_attribute a on a.attrelid = t.tgrelid and a.attnum = any (t.tgattr)
   where t.tgrelid = 'public.workout_sets'::regclass and t.tgname = 'workout_sets_require_live_session'),
  array['deleted_at'],
  'its update event is limited to the deleted_at column'
);
select trigger_is('public', 'workout_sets', 'workout_sets_require_live_session', 'public', 'workout_sets_require_live_session', 'the trigger runs workout_sets_require_live_session');
select ok(
  (select not prosecdef and provolatile = 'v' and proconfig @> array['search_path=""'] from pg_proc where oid = 'public.workout_sets_require_live_session()'::regprocedure),
  'the trigger function is volatile security invoker with an empty search_path'
);
select ok(
  not has_function_privilege('authenticated', 'public.workout_sets_require_live_session()', 'execute')
    and not has_function_privilege('anon', 'public.workout_sets_require_live_session()', 'execute')
    and not has_function_privilege('service_role', 'public.workout_sets_require_live_session()', 'execute')
    and (select not exists (select 1 from aclexplode(proacl) as privilege where privilege.grantee = 0) from pg_proc where oid = 'public.workout_sets_require_live_session()'::regprocedure),
  'nobody holds execute on the trigger function, and public cannot'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"37800000-0000-4000-8000-00000000000a","role":"authenticated"}';

-- Insert.
select lives_ok(
  $$ select pg_temp.log_set('37800000-0000-4000-8000-0000000006a1') $$,
  'a set can be inserted into the caller''s live session'
);
select throws_ok(
  $$ select pg_temp.log_set('37800000-0000-4000-8000-0000000006a3', 1) $$,
  '42501', 'a set can only be written into a live session',
  'a set cannot be inserted into the caller''s deleted session'
);
select throws_ok(
  $$ select pg_temp.log_set('37800000-0000-4000-8000-0000000006b1', 2) $$,
  '42501', 'new row violates row-level security policy for table "workout_sets"',
  'a set cannot be inserted into another user''s live session, and the policy still says so'
);
select is(
  (select count(*)::int from public.workout_sets where session_id = '37800000-0000-4000-8000-0000000006a3' and deleted_at is null),
  0,
  'the deleted session has no live set after the refused insert'
);

-- Update. The set in the deleted session was deleted with it, and reviving it is refused.
select throws_ok(
  $$ update public.workout_sets set deleted_at = null where id = '37800000-0000-4000-8000-0000000007a3' $$,
  '42501', 'a set can only be written into a live session',
  'a set cannot be revived into a deleted session'
);
select throws_ok(
  $$ update public.workout_sets set deleted_at = null, reps = 12 where id = '37800000-0000-4000-8000-0000000007a3' $$,
  '42501', 'a set can only be written into a live session',
  'a set cannot be revived into a deleted session together with an edit either'
);
select is(
  (select count(*)::int from public.workout_sets where session_id = '37800000-0000-4000-8000-0000000006a3' and deleted_at is null),
  0,
  'the deleted session still has no live set after the refused updates'
);
select is(
  (select reps::int from public.workout_sets where id = '37800000-0000-4000-8000-0000000007a3'),
  10,
  'and the set kept its reps'
);

-- A set of a live session is still edited, deleted and revived as before.
select lives_ok(
  $$ update public.workout_sets set reps = 12 where session_id = '37800000-0000-4000-8000-0000000006a1' $$,
  'a set of a live session can be edited'
);
select lives_ok(
  $$ update public.workout_sets set deleted_at = now() where session_id = '37800000-0000-4000-8000-0000000006a1' $$,
  'a set of a live session can be deleted'
);
select lives_ok(
  $$ update public.workout_sets set deleted_at = null where session_id = '37800000-0000-4000-8000-0000000006a1' $$,
  'and revived'
);

-- Restoring the session first makes its sets writable again, the order an undo takes.
select lives_ok(
  $$ update public.workout_sessions set deleted_at = null where id = '37800000-0000-4000-8000-0000000006a3' $$,
  'user A restores the deleted session'
);
select lives_ok(
  $$ update public.workout_sets set deleted_at = null where id = '37800000-0000-4000-8000-0000000007a3' $$,
  'and then revives its set'
);
select is(
  (select count(*)::int from public.workout_sets where session_id = '37800000-0000-4000-8000-0000000006a3' and deleted_at is null),
  1,
  'the restored session has its live set back'
);

select * from finish();

rollback;
