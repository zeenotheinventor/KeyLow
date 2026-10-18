-- Asserts the rule of one session in progress per user (ADR 0005, Amendment 3, KEY-386): the
-- partial unique index and its predicate, a second session in progress refused with 23505, a
-- finished or a deleted session never in the way of a new one, two users each holding one, and the
-- backfill statement of the migration, which closes the duplicates that exist, keeps the newest and
-- ends each older one at its last live set or at its start. The statement is kept here word for
-- word, and a unit test of the db package compares it with the migration so the two cannot drift.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so
-- nothing created here persists. Every fixture id starts with 38600000 and every email with
-- key386-. Each actor is entered with `set local role` plus the JWT claims that `auth.uid()`
-- reads, and left with `reset role`. A client cannot write `id`, so the sessions it inserts are told
-- apart by `started_at`. The backfill part drops the index, writes duplicates, runs the
-- migration's update and creates the index again over the cleaned rows.
--
-- Health data: a note is not written, and nothing asserted here quotes a user's value.

begin;

select plan(26);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '38600000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'key386-user-a@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '38600000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'key386-user-b@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '38600000-0000-4000-8000-00000000000c', 'authenticated', 'authenticated', 'key386-user-c@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '38600000-0000-4000-8000-00000000000d', 'authenticated', 'authenticated', 'key386-user-d@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '38600000-0000-4000-8000-00000000000e', 'authenticated', 'authenticated', 'key386-user-e@keylow.test');

insert into public.exercises (id, owner_id, source, source_ref, name, equipment, mechanic) values
  ('38600000-0000-4000-8000-000000000101', null, 'free_exercise_db', 'KEY386-EX-1', 'key386-global-press', 'barbell', 'compound');

insert into public.exercise_muscles (exercise_id, owner_id, muscle_id, role, weight) values
  ('38600000-0000-4000-8000-000000000101', null, 'chest_lower', 'primary', 1);

create function pg_temp.snapshot(exercise uuid)
returns jsonb language sql as $$
  select jsonb_build_object(
    'version', 1, 'kind', 'exercise', 'ref', exercise, 'name', 'key386-snapshot',
    'equipment', 'barbell', 'mechanic', 'compound', 'muscleListVersion', 1,
    'muscles', jsonb_build_array(jsonb_build_object('muscle_id', 'chest_lower', 'role', 'primary', 'weight', 1))
  )
$$;

-- The index and its predicate.
select is(
  pg_get_indexdef('public.workout_sessions_one_open_per_user'::regclass),
  'CREATE UNIQUE INDEX workout_sessions_one_open_per_user ON public.workout_sessions USING btree (user_id) WHERE ((ended_at IS NULL) AND (deleted_at IS NULL))',
  'the index is unique over user_id and holds only the sessions that are not ended and not deleted'
);
select ok(
  (select indisunique and indisvalid from pg_index where indexrelid = 'public.workout_sessions_one_open_per_user'::regclass),
  'the index is unique and valid'
);

-- User A.
set local role authenticated;
set local request.jwt.claims = '{"sub":"38600000-0000-4000-8000-00000000000a","role":"authenticated"}';

select lives_ok(
  $$insert into public.workout_sessions (started_at, local_date, tz) values ('2026-10-18 09:00+00', '2026-10-18', 'UTC')$$,
  'a user can start a session'
);
select throws_ok(
  $$insert into public.workout_sessions (started_at, local_date, tz) values ('2026-10-18 09:05+00', '2026-10-18', 'UTC')$$,
  '23505',
  'duplicate key value violates unique constraint "workout_sessions_one_open_per_user"',
  'a second session in progress for the same user is refused with 23505'
);
select is(
  (select count(*)::int from public.workout_sessions where ended_at is null and deleted_at is null),
  1,
  'the refused insert left one session in progress'
);
select lives_ok(
  $$update public.workout_sessions set ended_at = '2026-10-18 10:00+00' where started_at = '2026-10-18 09:00+00'$$,
  'a session can be finished'
);
select lives_ok(
  $$insert into public.workout_sessions (started_at, local_date, tz) values ('2026-10-18 11:00+00', '2026-10-18', 'UTC')$$,
  'a finished session does not stop a new one in progress'
);
select lives_ok(
  $$update public.workout_sessions set deleted_at = '2026-10-18 11:30+00' where started_at = '2026-10-18 11:00+00'$$,
  'a session in progress can be deleted'
);
select lives_ok(
  $$insert into public.workout_sessions (started_at, local_date, tz) values ('2026-10-18 12:00+00', '2026-10-18', 'UTC')$$,
  'a deleted session does not stop a new one in progress'
);
select throws_ok(
  $$update public.workout_sessions set deleted_at = null where started_at = '2026-10-18 11:00+00'$$,
  '23505',
  'duplicate key value violates unique constraint "workout_sessions_one_open_per_user"',
  'restoring a deleted session in progress while another is in progress is refused with 23505'
);
select lives_ok(
  $$insert into public.workout_sessions (started_at, ended_at, local_date, tz) values
      ('2026-10-17 09:00+00', '2026-10-17 10:00+00', '2026-10-17', 'UTC'),
      ('2026-10-16 09:00+00', '2026-10-16 10:00+00', '2026-10-16', 'UTC')$$,
  'any number of finished sessions sit next to the one in progress'
);

-- User B holds one at the same time as A.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"38600000-0000-4000-8000-00000000000b","role":"authenticated"}';

select lives_ok(
  $$insert into public.workout_sessions (started_at, local_date, tz) values ('2026-10-18 09:00+00', '2026-10-18', 'UTC')$$,
  'another user can have a session in progress while the first has one'
);
select throws_ok(
  $$insert into public.workout_sessions (started_at, local_date, tz) values ('2026-10-18 09:30+00', '2026-10-18', 'UTC')$$,
  '23505',
  'duplicate key value violates unique constraint "workout_sessions_one_open_per_user"',
  'the second user is held to one as well'
);
reset role;
select is(
  (select count(*)::int from public.workout_sessions where ended_at is null and deleted_at is null and user_id in ('38600000-0000-4000-8000-00000000000a', '38600000-0000-4000-8000-00000000000b')),
  2,
  'each of the two users has exactly one session in progress'
);

-- The backfill. The index is dropped to write the duplicates the old schema allowed. User C has three
-- sessions in progress, a newer one that is deleted and a finished one. D has one. E has two that
-- started at the same moment.
select lives_ok($$drop index public.workout_sessions_one_open_per_user$$, 'the index can be dropped to write duplicates');

insert into public.workout_sessions (id, user_id, started_at, ended_at, deleted_at, local_date, tz) values
  ('38600000-0000-4000-8000-0000000003c1', '38600000-0000-4000-8000-00000000000c', '2026-10-10 09:00+00', null, null, '2026-10-10', 'UTC'),
  ('38600000-0000-4000-8000-0000000003c2', '38600000-0000-4000-8000-00000000000c', '2026-10-11 09:00+00', null, null, '2026-10-11', 'UTC'),
  ('38600000-0000-4000-8000-0000000003c3', '38600000-0000-4000-8000-00000000000c', '2026-10-12 09:00+00', null, null, '2026-10-12', 'UTC'),
  ('38600000-0000-4000-8000-0000000003c4', '38600000-0000-4000-8000-00000000000c', '2026-10-13 09:00+00', null, '2026-10-13 09:30+00', '2026-10-13', 'UTC'),
  ('38600000-0000-4000-8000-0000000003c5', '38600000-0000-4000-8000-00000000000c', '2026-10-09 09:00+00', '2026-10-09 10:00+00', null, '2026-10-09', 'UTC'),
  ('38600000-0000-4000-8000-0000000003d1', '38600000-0000-4000-8000-00000000000d', '2026-10-12 09:00+00', null, null, '2026-10-12', 'UTC'),
  ('38600000-0000-4000-8000-0000000003e1', '38600000-0000-4000-8000-00000000000e', '2026-10-12 09:00+00', null, null, '2026-10-12', 'UTC'),
  ('38600000-0000-4000-8000-0000000003e2', '38600000-0000-4000-8000-00000000000e', '2026-10-12 09:00+00', null, null, '2026-10-12', 'UTC');

-- C's first session has a set logged before it started, and the second has two live sets and a deleted
-- one after them. The backfill ends them at the start, and at the last live set.
insert into public.workout_sets (session_id, user_id, exercise_id, position, reps, load_kg, snapshot, performed_at, deleted_at) values
  ('38600000-0000-4000-8000-0000000003c1', '38600000-0000-4000-8000-00000000000c', '38600000-0000-4000-8000-000000000101', 0, 10, 20, pg_temp.snapshot('38600000-0000-4000-8000-000000000101'), '2026-10-10 08:00+00', null),
  ('38600000-0000-4000-8000-0000000003c2', '38600000-0000-4000-8000-00000000000c', '38600000-0000-4000-8000-000000000101', 0, 10, 20, pg_temp.snapshot('38600000-0000-4000-8000-000000000101'), '2026-10-11 09:30+00', null),
  ('38600000-0000-4000-8000-0000000003c2', '38600000-0000-4000-8000-00000000000c', '38600000-0000-4000-8000-000000000101', 1, 10, 20, pg_temp.snapshot('38600000-0000-4000-8000-000000000101'), '2026-10-11 09:50+00', null),
  ('38600000-0000-4000-8000-0000000003c2', '38600000-0000-4000-8000-00000000000c', '38600000-0000-4000-8000-000000000101', 2, 10, 20, pg_temp.snapshot('38600000-0000-4000-8000-000000000101'), '2026-10-11 10:30+00', '2026-10-11 10:40+00');

select lives_ok(
  $$update public.workout_sessions as older
  set ended_at = greatest(
    older.started_at,
    coalesce(
      (
        select max(logged.performed_at)
        from public.workout_sets as logged
        where logged.session_id = older.id
          and logged.deleted_at is null
      ),
      older.started_at
    )
  )
  where older.ended_at is null
    and older.deleted_at is null
    and exists (
      select 1
      from public.workout_sessions as newer
      where newer.user_id = older.user_id
        and newer.ended_at is null
        and newer.deleted_at is null
        and (newer.started_at, newer.id) > (older.started_at, older.id)
    )$$,
  'the backfill runs'
);
select is(
  (select array_agg(id order by id) from public.workout_sessions where user_id = '38600000-0000-4000-8000-00000000000c' and ended_at is null and deleted_at is null),
  array['38600000-0000-4000-8000-0000000003c3'::uuid],
  'the backfill keeps the newest session in progress of a user with three'
);
select is(
  (select ended_at from public.workout_sessions where id = '38600000-0000-4000-8000-0000000003c1'),
  '2026-10-10 09:00+00'::timestamptz,
  'the backfill ends an older session at its start when its only set was logged before it, and never before the start'
);
select is(
  (select ended_at from public.workout_sessions where id = '38600000-0000-4000-8000-0000000003c2'),
  '2026-10-11 09:50+00'::timestamptz,
  'the backfill ends an older session at its last live set, and a deleted set after it does not count'
);
select ok(
  (select ended_at is null and deleted_at is not null from public.workout_sessions where id = '38600000-0000-4000-8000-0000000003c4'),
  'the backfill leaves a newer deleted session as it was'
);
select is(
  (select ended_at from public.workout_sessions where id = '38600000-0000-4000-8000-0000000003c5'),
  '2026-10-09 10:00+00'::timestamptz,
  'the backfill leaves a finished session as it was'
);
select is(
  (select array_agg(id order by id) from public.workout_sessions where user_id = '38600000-0000-4000-8000-00000000000d' and ended_at is null and deleted_at is null),
  array['38600000-0000-4000-8000-0000000003d1'::uuid],
  'the backfill leaves a user with one session in progress alone'
);
select is(
  (select array_agg(id order by id) from public.workout_sessions where user_id = '38600000-0000-4000-8000-00000000000e' and ended_at is null and deleted_at is null),
  array['38600000-0000-4000-8000-0000000003e2'::uuid],
  'two sessions that started at the same moment keep the one with the higher id'
);
do $$
declare
  changed integer;
begin
  update public.workout_sessions as older
  set ended_at = greatest(
    older.started_at,
    coalesce(
      (
        select max(logged.performed_at)
        from public.workout_sets as logged
        where logged.session_id = older.id
          and logged.deleted_at is null
      ),
      older.started_at
    )
  )
  where older.ended_at is null
    and older.deleted_at is null
    and exists (
      select 1
      from public.workout_sessions as newer
      where newer.user_id = older.user_id
        and newer.ended_at is null
        and newer.deleted_at is null
        and (newer.started_at, newer.id) > (older.started_at, older.id)
    );
  get diagnostics changed = row_count;
  perform set_config('key386.second_run_rows', changed::text, true);
end
$$;
select is(
  current_setting('key386.second_run_rows')::int,
  0,
  'the backfill run a second time changes no row'
);
select lives_ok(
  $$create unique index workout_sessions_one_open_per_user on public.workout_sessions (user_id) where ended_at is null and deleted_at is null$$,
  'the index can be created over the cleaned rows'
);
select throws_ok(
  $$insert into public.workout_sessions (user_id, started_at, local_date, tz) values ('38600000-0000-4000-8000-00000000000c', '2026-10-14 09:00+00', '2026-10-14', 'UTC')$$,
  '23505',
  'duplicate key value violates unique constraint "workout_sessions_one_open_per_user"',
  'the recreated index refuses a second session in progress'
);

select * from finish();

rollback;
