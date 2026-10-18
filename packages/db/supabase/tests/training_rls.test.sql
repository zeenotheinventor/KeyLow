-- Asserts the training log, plans and goals (ADR 0005, Amendment 1, KEY-348): the enums,
-- `routines`, `routine_days`, `routine_exercises`, `workout_sessions`, `workout_sets` and
-- `training_goals`, every policy and the exact privilege set of each table, every bound of "The
-- numbers" just outside (refused) and at the edge (accepted), the owner-only rule in both
-- directions, `save_routine`, `set_active_routine` and `save_training_goals` (their refusals, their
-- atomicity, day ids kept across an edit, a weekday swap and a removed day clearing its sessions'
-- link), and the cascade from a deleted account that has sessions, sets, routines, goals and
-- custom exercises.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so
-- nothing created here persists and nothing is ever committed. The deferred checks (the day
-- position key and KEY-347's primary-muscle trigger) are fired with `set constraints ...
-- immediate`, which runs every pending check at that point, exactly as a commit would. Every
-- fixture id starts with 34800000 and every name and email with key348-, so the rows are
-- recognisable as this file's. Nothing asserts a whole-table count. Each actor is entered with
-- `set local role` plus the JWT claims that `auth.uid()` reads, and left with `reset role`.
--
-- Health data: no fixture here is a real user's training, and the refusal messages asserted below
-- state a rule and never a value.

begin;

select plan(372);

-- Four users. The on_auth_user_created trigger creates their profiles rows. C is the throwaway user
-- whose account is deleted at the end. D only owns the training goals rows of the bound checks.
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '34800000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'key348-user-a@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '34800000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'key348-user-b@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '34800000-0000-4000-8000-00000000000c', 'authenticated', 'authenticated', 'key348-user-c@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '34800000-0000-4000-8000-00000000000d', 'authenticated', 'authenticated', 'key348-user-d@keylow.test');

-- Fixtures, inserted as postgres so row level security does not apply. A global exercise, and
-- custom exercises for A (two), B and C, each with a primary muscle so the pending trigger checks
-- pass.
insert into public.exercises (id, owner_id, source, source_ref, name, equipment, mechanic) values
  ('34800000-0000-4000-8000-000000000101', null, 'free_exercise_db', 'KEY348-EX-1', 'key348-global-squat', 'barbell', 'compound'),
  ('34800000-0000-4000-8000-0000000001a1', '34800000-0000-4000-8000-00000000000a', 'user', null, 'key348-a-raise', 'dumbbell', 'isolation'),
  ('34800000-0000-4000-8000-0000000001a2', '34800000-0000-4000-8000-00000000000a', 'user', null, 'key348-a-row', 'cable', 'compound'),
  ('34800000-0000-4000-8000-0000000001b1', '34800000-0000-4000-8000-00000000000b', 'user', null, 'key348-b-curl', 'ez_bar', 'isolation'),
  ('34800000-0000-4000-8000-0000000001c1', '34800000-0000-4000-8000-00000000000c', 'user', null, 'key348-c-press', 'machine', 'compound');

insert into public.exercise_muscles (exercise_id, owner_id, muscle_id, role, weight) values
  ('34800000-0000-4000-8000-000000000101', null, 'quads', 'primary', 1),
  ('34800000-0000-4000-8000-0000000001a1', '34800000-0000-4000-8000-00000000000a', 'delt_side', 'primary', 1),
  ('34800000-0000-4000-8000-0000000001a2', '34800000-0000-4000-8000-00000000000a', 'lats', 'primary', 1),
  ('34800000-0000-4000-8000-0000000001b1', '34800000-0000-4000-8000-00000000000b', 'biceps', 'primary', 1),
  ('34800000-0000-4000-8000-0000000001c1', '34800000-0000-4000-8000-00000000000c', 'chest_lower', 'primary', 1);

-- B's and C's plans, logs and goals. A's routines are made through save_routine below. A has one
-- session to log sets into and a current goals row from 30 days ago.
insert into public.routines (id, user_id, name, is_active) values
  ('34800000-0000-4000-8000-0000000003b1', '34800000-0000-4000-8000-00000000000b', 'key348-b-plan', true),
  ('34800000-0000-4000-8000-0000000003c1', '34800000-0000-4000-8000-00000000000c', 'key348-c-plan', true);

insert into public.routine_days (id, routine_id, user_id, position, weekday, name) values
  ('34800000-0000-4000-8000-0000000004b1', '34800000-0000-4000-8000-0000000003b1', '34800000-0000-4000-8000-00000000000b', 0, 0, 'key348-b-day'),
  ('34800000-0000-4000-8000-0000000004c1', '34800000-0000-4000-8000-0000000003c1', '34800000-0000-4000-8000-00000000000c', 0, 3, 'key348-c-day');

insert into public.routine_exercises (id, routine_day_id, user_id, position, exercise_id, target_sets, rep_min, rep_max, target_rir) values
  ('34800000-0000-4000-8000-0000000005b1', '34800000-0000-4000-8000-0000000004b1', '34800000-0000-4000-8000-00000000000b', 0, '34800000-0000-4000-8000-0000000001b1', 3, 8, 12, 2),
  ('34800000-0000-4000-8000-0000000005c1', '34800000-0000-4000-8000-0000000004c1', '34800000-0000-4000-8000-00000000000c', 0, '34800000-0000-4000-8000-0000000001c1', 3, 8, 12, null),
  ('34800000-0000-4000-8000-0000000005c2', '34800000-0000-4000-8000-0000000004c1', '34800000-0000-4000-8000-00000000000c', 1, '34800000-0000-4000-8000-000000000101', 5, 5, 5, 1);

insert into public.workout_sessions (id, user_id, started_at, ended_at, local_date, tz, routine_day_id, note) values
  ('34800000-0000-4000-8000-0000000006a1', '34800000-0000-4000-8000-00000000000a', '2026-10-17 08:00+00', null, '2026-10-17', 'Europe/London', null, null),
  ('34800000-0000-4000-8000-0000000006b1', '34800000-0000-4000-8000-00000000000b', '2026-10-17 09:00+00', '2026-10-17 10:00+00', '2026-10-17', 'Europe/London', '34800000-0000-4000-8000-0000000004b1', 'key348-b-note'),
  ('34800000-0000-4000-8000-0000000006c1', '34800000-0000-4000-8000-00000000000c', '2026-10-17 07:00+00', '2026-10-17 08:00+00', '2026-10-17', 'Europe/London', '34800000-0000-4000-8000-0000000004c1', null);

-- A v1 set snapshot of an exercise, the shape core's buildSetSnapshot writes. It lives in the
-- temporary schema, so nothing persists, and is callable under the API roles.
create function pg_temp.snapshot(exercise uuid, exercise_name text default 'key348-snapshot')
returns jsonb language sql as $$
  select jsonb_build_object(
    'version', 1, 'kind', 'exercise', 'ref', exercise, 'name', exercise_name,
    'equipment', 'barbell', 'mechanic', 'compound', 'muscleListVersion', 1,
    'muscles', jsonb_build_array(jsonb_build_object('muscle_id', 'quads', 'role', 'primary', 'weight', 1))
  )
$$;

insert into public.workout_sets (id, session_id, user_id, exercise_id, position, set_type, reps, load_kg, rir, rpe, snapshot) values
  ('34800000-0000-4000-8000-0000000007b1', '34800000-0000-4000-8000-0000000006b1', '34800000-0000-4000-8000-00000000000b', '34800000-0000-4000-8000-0000000001b1', 0, 'working', 10, 20, 2, null, pg_temp.snapshot('34800000-0000-4000-8000-0000000001b1')),
  ('34800000-0000-4000-8000-0000000007c1', '34800000-0000-4000-8000-0000000006c1', '34800000-0000-4000-8000-00000000000c', '34800000-0000-4000-8000-0000000001c1', 0, 'working', 8, 60, null, 8, pg_temp.snapshot('34800000-0000-4000-8000-0000000001c1')),
  ('34800000-0000-4000-8000-0000000007c2', '34800000-0000-4000-8000-0000000006c1', '34800000-0000-4000-8000-00000000000c', '34800000-0000-4000-8000-000000000101', 1, 'warmup', 12, null, null, null, pg_temp.snapshot('34800000-0000-4000-8000-000000000101'));

insert into public.training_goals (id, user_id, goal, focus, days_per_week, session_minutes, equipment, experience, muscle_priority, params_version, effective_from, effective_to) values
  ('34800000-0000-4000-8000-0000000008a1', '34800000-0000-4000-8000-00000000000a', 'aesthetic', '{v_taper}', 3, 45, '{dumbbell}', 'beginner', '{"delt_side":2}', 'key348-params-1', now() - interval '30 days', null),
  ('34800000-0000-4000-8000-0000000008b1', '34800000-0000-4000-8000-00000000000b', 'strength', '{}', 4, 60, '{barbell}', 'advanced', '{}', 'key348-params-1', now() - interval '30 days', null),
  ('34800000-0000-4000-8000-0000000008c1', '34800000-0000-4000-8000-00000000000c', 'hybrid', '{legs}', 2, 30, '{}', 'intermediate', '{}', 'key348-params-1', now() - interval '60 days', now() - interval '30 days'),
  ('34800000-0000-4000-8000-0000000008c2', '34800000-0000-4000-8000-00000000000c', 'hybrid', '{legs,glutes}', 3, 45, '{band}', 'intermediate', '{"glute_max":3}', 'key348-params-1', now() - interval '30 days', null);

-- Builders for the writes below. Each is a plain SQL function in the temporary schema, run with the
-- caller's privileges, so a refusal is the table's or the policy's own.
create function pg_temp.log_set(
  set_reps integer default 10, set_load numeric default 20, set_rir integer default null, set_rpe numeric default null,
  set_position integer default 0,
  set_session uuid default '34800000-0000-4000-8000-0000000006a1',
  set_exercise uuid default '34800000-0000-4000-8000-000000000101',
  set_user uuid default '34800000-0000-4000-8000-00000000000a',
  set_snapshot jsonb default null
)
returns void language sql as $$
  insert into public.workout_sets (session_id, user_id, exercise_id, position, reps, load_kg, rir, rpe, snapshot)
  values (set_session, set_user, set_exercise, set_position, set_reps, set_load, set_rir, set_rpe,
    coalesce(set_snapshot, pg_temp.snapshot(set_exercise)))
$$;

create function pg_temp.start_session(
  session_started timestamptz default '2026-10-18 08:00+00', session_ended timestamptz default null,
  session_tz text default 'Europe/London', session_note text default null, session_day uuid default null,
  session_owner uuid default '34800000-0000-4000-8000-00000000000a'
)
returns void language sql as $$
  insert into public.workout_sessions (user_id, started_at, ended_at, local_date, tz, routine_day_id, note)
  values (session_owner, session_started, session_ended, '2026-10-18', session_tz, session_day, session_note)
$$;

create function pg_temp.add_routine(routine_name text, routine_user uuid default '34800000-0000-4000-8000-00000000000a')
returns void language sql as $$
  insert into public.routines (user_id, name) values (routine_user, routine_name)
$$;

create function pg_temp.add_day(
  day_routine uuid, day_position integer, day_weekday integer, day_name text default 'key348-day',
  day_user uuid default '34800000-0000-4000-8000-00000000000a'
)
returns void language sql as $$
  insert into public.routine_days (routine_id, user_id, position, weekday, name)
  values (day_routine, day_user, day_position, day_weekday, day_name)
$$;

create function pg_temp.add_planned(
  planned_day uuid, planned_position integer default 0,
  planned_sets integer default 3, planned_rep_min integer default 8, planned_rep_max integer default 12,
  planned_rir integer default null,
  planned_exercise uuid default '34800000-0000-4000-8000-000000000101',
  planned_user uuid default '34800000-0000-4000-8000-00000000000a'
)
returns void language sql as $$
  insert into public.routine_exercises (routine_day_id, user_id, position, exercise_id, target_sets, rep_min, rep_max, target_rir)
  values (planned_day, planned_user, planned_position, planned_exercise, planned_sets, planned_rep_min, planned_rep_max, planned_rir)
$$;

-- Payload builders for the functions.
create function pg_temp.planned(exercise text default '34800000-0000-4000-8000-000000000101', target_sets numeric default 3, rep_min numeric default 8, rep_max numeric default 12, target_rir numeric default null)
returns jsonb language sql as $$
  select jsonb_build_object('exercise_id', exercise, 'target_sets', target_sets, 'rep_min', rep_min, 'rep_max', rep_max, 'target_rir', target_rir)
$$;

create function pg_temp.day(day_name text, weekday integer, exercises jsonb default '[]', day_id text default null)
returns jsonb language sql as $$
  select jsonb_build_object('id', day_id, 'weekday', weekday, 'name', day_name, 'exercises', exercises)
$$;

create function pg_temp.goals()
returns jsonb language sql as $$
  select jsonb_build_object(
    'goal', 'hybrid', 'focus', jsonb_build_array('chest', 'arms'), 'days_per_week', 4, 'session_minutes', 60,
    'equipment', jsonb_build_array('barbell', 'dumbbell'), 'experience', 'intermediate',
    'muscle_priority', jsonb_build_object('chest_upper', 1.5, 'biceps', 1), 'params_version', 'key348-params-2'
  )
$$;

-- Shape.
select has_table('public', 'routines', 'routines exists');
select has_table('public', 'routine_days', 'routine_days exists');
select has_table('public', 'routine_exercises', 'routine_exercises exists');
select has_table('public', 'workout_sessions', 'workout_sessions exists');
select has_table('public', 'workout_sets', 'workout_sets exists');
select has_table('public', 'training_goals', 'training_goals exists');
select ok(
  (select bool_and(relrowsecurity) from pg_class where oid in (
    'public.routines'::regclass, 'public.routine_days'::regclass, 'public.routine_exercises'::regclass,
    'public.workout_sessions'::regclass, 'public.workout_sets'::regclass, 'public.training_goals'::regclass
  )),
  'row level security is enabled on all six tables'
);
select ok(
  (select bool_and(
     exists (select 1 from pg_attribute where attrelid = format('public.%I', t)::regclass and attname = 'created_at' and attnotnull)
     and exists (
       select 1 from pg_attribute a join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
       where a.attrelid = format('public.%I', t)::regclass and a.attname = 'id' and pg_get_expr(d.adbin, d.adrelid) = 'gen_random_uuid()'
     )
   ) from unnest(array['routines', 'routine_days', 'routine_exercises', 'workout_sessions', 'workout_sets', 'training_goals']) as t),
  'every table has a generated id and a not null created_at'
);
select ok(
  not exists (
    select 1 from pg_attribute
    where attrelid in ('public.routines'::regclass, 'public.routine_days'::regclass, 'public.routine_exercises'::regclass,
      'public.workout_sessions'::regclass, 'public.workout_sets'::regclass, 'public.training_goals'::regclass)
      and attname = 'updated_at' and not attisdropped
  ),
  'no table has an updated_at'
);
select ok(
  (select bool_and(exists (
     select 1 from pg_attribute a join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
     where a.attrelid = format('public.%I', t)::regclass and a.attname = 'user_id' and a.attnotnull
       and pg_get_expr(d.adbin, d.adrelid) = 'auth.uid()'
   )) from unnest(array['routines', 'routine_days', 'routine_exercises', 'workout_sessions', 'workout_sets', 'training_goals']) as t),
  'every table has a not null user_id that defaults to auth.uid()'
);
select col_type_is('public', 'workout_sets', 'set_type', 'set_type', 'workout_sets.set_type is the set_type enum');
select col_default_is('public', 'workout_sets', 'set_type', 'working', 'a set is a working set by default');
select col_type_is('public', 'workout_sets', 'reps', 'integer', 'workout_sets.reps is an integer');
select col_type_is('public', 'workout_sets', 'load_kg', 'numeric', 'workout_sets.load_kg is numeric');
select col_type_is('public', 'workout_sets', 'rir', 'smallint', 'workout_sets.rir is a smallint');
select col_type_is('public', 'workout_sets', 'rpe', 'numeric', 'workout_sets.rpe is numeric');
select col_type_is('public', 'workout_sets', 'snapshot', 'jsonb', 'workout_sets.snapshot is jsonb');
select col_default_is('public', 'workout_sets', 'performed_at', 'now()', 'performed_at defaults to now()');
select col_is_null('public', 'workout_sets', 'load_kg', 'load_kg is nullable, for an unloaded bodyweight set');
select col_is_null('public', 'workout_sessions', 'ended_at', 'ended_at is nullable while a session is in progress');
select col_is_null('public', 'workout_sessions', 'routine_day_id', 'routine_day_id is nullable');
select col_type_is('public', 'workout_sessions', 'local_date', 'date', 'workout_sessions.local_date is a date');
select col_type_is('public', 'routine_days', 'weekday', 'smallint', 'routine_days.weekday is a smallint');
select col_is_null('public', 'routine_days', 'weekday', 'a null weekday means any day');
select col_type_is('public', 'routine_exercises', 'target_rir', 'smallint', 'routine_exercises.target_rir is a smallint');
select col_is_null('public', 'routine_exercises', 'target_rir', 'target_rir is nullable');
select ok(
  (select bool_and(col.atttypid = 'smallint'::regtype) from pg_attribute col
   where col.attrelid = 'public.routine_exercises'::regclass and col.attname in ('target_sets', 'rep_min', 'rep_max')),
  'target_sets, rep_min and rep_max are smallints'
);
select col_default_is('public', 'routines', 'is_active', 'false', 'a routine starts inactive');
select col_default_is('public', 'routines', 'is_archived', 'false', 'a routine starts live');
select col_type_is('public', 'training_goals', 'focus', 'text[]', 'training_goals.focus is a text array');
select col_default_is('public', 'training_goals', 'focus', '{}', 'focus defaults to empty');
select col_type_is('public', 'training_goals', 'equipment', 'equipment[]', 'training_goals.equipment is an equipment array');
select col_default_is('public', 'training_goals', 'equipment', '{}', 'equipment defaults to empty');
select col_type_is('public', 'training_goals', 'goal', 'training_goal', 'training_goals.goal is the training_goal enum');
select col_type_is('public', 'training_goals', 'experience', 'experience_level', 'training_goals.experience is the experience_level enum');
select col_type_is('public', 'training_goals', 'muscle_priority', 'jsonb', 'training_goals.muscle_priority is jsonb');
select col_default_is('public', 'training_goals', 'effective_from', 'now()', 'effective_from defaults to now()');
select col_is_null('public', 'training_goals', 'effective_to', 'a null effective_to means current');

-- Enums.
select enum_has_labels('public', 'set_type', array['warmup', 'working', 'drop', 'failure'], 'set_type has exactly its values');
select enum_has_labels('public', 'training_goal', array['aesthetic', 'strength', 'hybrid'], 'training_goal has exactly its values');
select enum_has_labels('public', 'experience_level', array['beginner', 'intermediate', 'advanced'], 'experience_level has exactly its values');

-- Foreign keys and their delete rules.
select is(
  (select array_agg(conrelid::regclass::text || ':' || confdeltype::text order by conrelid::regclass::text)
   from pg_constraint where contype = 'f' and confrelid = 'auth.users'::regclass
     and conrelid in ('public.routines'::regclass, 'public.routine_days'::regclass, 'public.routine_exercises'::regclass,
       'public.workout_sessions'::regclass, 'public.workout_sets'::regclass, 'public.training_goals'::regclass)),
  array['routine_days:c', 'routine_exercises:c', 'routines:c', 'training_goals:c', 'workout_sessions:c', 'workout_sets:c'],
  'deleting the user deletes their rows in every table'
);
select is(
  (select array_agg(conrelid::regclass::text || '>' || confrelid::regclass::text || ':' || confdeltype::text order by conrelid::regclass::text, confrelid::regclass::text)
   from pg_constraint where contype = 'f' and confrelid <> 'auth.users'::regclass
     and conrelid in ('public.routines'::regclass, 'public.routine_days'::regclass, 'public.routine_exercises'::regclass,
       'public.workout_sessions'::regclass, 'public.workout_sets'::regclass, 'public.training_goals'::regclass)),
  array[
    'routine_days>routines:c',
    'routine_exercises>exercises:a', 'routine_exercises>routine_days:c',
    'workout_sessions>routine_days:n',
    'workout_sets>exercises:a', 'workout_sets>workout_sessions:c'
  ],
  'a day goes with its routine, a planned exercise with its day and a set with its session; a removed day clears its sessions'' link; exercises are never cascaded'
);

-- Indexes.
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'routines' and indexdef like 'CREATE UNIQUE INDEX routines_one_active_per_user %(user_id) WHERE is_active'),
  'at most one active routine per user, by a partial unique index'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'routines' and indexdef like '%(user_id)' and indexdef not like 'CREATE UNIQUE%'),
  'there is a plain index on routines.user_id'
);
select is(
  (select contype::text || ':' || condeferrable::text || ':' || condeferred::text from pg_constraint where conname = 'routine_days_routine_id_position_key'),
  'u:true:true',
  'a day''s position is unique in its routine, deferrable and initially deferred'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'routine_days' and indexdef like 'CREATE UNIQUE INDEX routine_days_routine_id_weekday_key %(routine_id, weekday) WHERE (weekday IS NOT NULL)'),
  'at most one day per weekday in a routine, by a partial unique index'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'routine_exercises' and indexdef like 'CREATE UNIQUE INDEX%(routine_day_id, "position")'),
  'a planned exercise''s position is unique in its day'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'routine_exercises' and indexdef like '%(exercise_id)' and indexdef not like 'CREATE UNIQUE%'),
  'there is a plain index on routine_exercises.exercise_id'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'workout_sessions' and indexdef like '%(user_id, local_date)' and indexdef not like 'CREATE UNIQUE%'),
  'there is an index on workout_sessions (user_id, local_date)'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'workout_sessions' and indexdef like '%(routine_day_id)' and indexdef not like 'CREATE UNIQUE%' and indexdef not like '%WHERE%'),
  'there is a plain index on workout_sessions.routine_day_id'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'workout_sets' and indexdef like '%(user_id, performed_at)' and indexdef not like 'CREATE UNIQUE%'),
  'there is an index on workout_sets (user_id, performed_at)'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'workout_sets' and indexdef like '%(exercise_id)' and indexdef not like 'CREATE UNIQUE%'),
  'there is a plain index on workout_sets.exercise_id'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'workout_sets' and indexdef like '%(session_id, "position")' and indexdef not like 'CREATE UNIQUE%'),
  'there is a plain index on workout_sets (session_id, position)'
);
select is(
  (select array_agg(indexname::text) from pg_indexes where schemaname = 'public' and tablename = 'workout_sets' and indexdef like 'CREATE UNIQUE%'),
  array['workout_sets_pkey'],
  'workout_sets has no unique index but its key, so a set''s position has no uniqueness rule'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'training_goals' and indexdef like 'CREATE UNIQUE INDEX training_goals_one_current_per_user %(user_id) WHERE (effective_to IS NULL)'),
  'one current goals row per user, by a partial unique index'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'training_goals' and indexdef like '%(user_id, effective_from)' and indexdef not like 'CREATE UNIQUE%'),
  'there is an index on training_goals (user_id, effective_from)'
);

-- Functions: security invoker, a fixed search path, and execute for authenticated alone.
select ok(
  (select bool_and(not prosecdef and provolatile = 'v' and proconfig @> array['search_path=""']) from pg_proc
   where oid in ('public.save_routine(uuid, jsonb, jsonb)'::regprocedure, 'public.set_active_routine(uuid)'::regprocedure, 'public.save_training_goals(jsonb)'::regprocedure)),
  'save_routine, set_active_routine and save_training_goals are security invoker and volatile, with an empty search_path'
);
select ok(
  (select not prosecdef and provolatile = 'i' and proconfig @> array['search_path=""'] from pg_proc where oid = 'public.training_focus_is_valid(text[])'::regprocedure),
  'the focus helper is an immutable security invoker function with an empty search_path'
);
select ok(
  (select bool_and(
     has_function_privilege('authenticated', f, 'execute')
       and not has_function_privilege('anon', f, 'execute')
       and not has_function_privilege('service_role', f, 'execute')
       and (select not exists (select 1 from aclexplode(proacl) as privilege where privilege.grantee = 0) from pg_proc where oid = f)
   ) from unnest(array[
     'public.save_routine(uuid, jsonb, jsonb)'::regprocedure, 'public.set_active_routine(uuid)'::regprocedure,
     'public.save_training_goals(jsonb)'::regprocedure, 'public.training_focus_is_valid(text[])'::regprocedure
   ]) as f),
  'only authenticated can execute the three functions and the focus helper, and public cannot'
);

-- Privileges. anon and service_role hold nothing at all, on any table or column.
select ok(
  (select bool_and(
     not has_any_column_privilege(r, format('public.%I', t), 'select,insert,update,references')
       and not has_table_privilege(r, format('public.%I', t), 'delete,truncate,trigger')
   ) from unnest(array['routines', 'routine_days', 'routine_exercises', 'workout_sessions', 'workout_sets', 'training_goals']) as t,
     unnest(array['anon', 'service_role']) as r),
  'anon and service_role have no privilege on any of the six tables'
);

-- authenticated, table by table: the table privileges, then exactly the insertable and updatable
-- columns.
select is(
  (select array_agg(table_name::text || ':' || privilege_type::text order by table_name::text collate "C", privilege_type::text collate "C") from information_schema.table_privileges
   where table_schema = 'public' and grantee = 'authenticated'
     and table_name in ('routines', 'routine_days', 'routine_exercises', 'workout_sessions', 'workout_sets', 'training_goals')),
  array[
    'routine_days:DELETE', 'routine_days:SELECT',
    'routine_exercises:DELETE', 'routine_exercises:SELECT',
    'routines:SELECT',
    'training_goals:SELECT',
    'workout_sessions:SELECT',
    'workout_sets:SELECT'
  ],
  'authenticated holds select on every table and delete only on routine_days and routine_exercises'
);
select is(
  (select array_agg(column_name::text order by column_name::text collate "C") from information_schema.column_privileges where table_schema = 'public' and table_name = 'workout_sessions' and grantee = 'authenticated' and privilege_type = 'INSERT'),
  array['ended_at', 'local_date', 'note', 'routine_day_id', 'started_at', 'tz', 'user_id'],
  'authenticated can insert exactly these columns of workout_sessions'
);
select is(
  (select array_agg(column_name::text order by column_name::text collate "C") from information_schema.column_privileges where table_schema = 'public' and table_name = 'workout_sessions' and grantee = 'authenticated' and privilege_type = 'UPDATE'),
  array['deleted_at', 'ended_at', 'note'],
  'authenticated can update exactly these columns of workout_sessions'
);
select is(
  (select array_agg(column_name::text order by column_name::text collate "C") from information_schema.column_privileges where table_schema = 'public' and table_name = 'workout_sets' and grantee = 'authenticated' and privilege_type = 'INSERT'),
  array['exercise_id', 'load_kg', 'performed_at', 'position', 'reps', 'rir', 'rpe', 'session_id', 'set_type', 'snapshot', 'user_id'],
  'authenticated can insert exactly these columns of workout_sets'
);
select is(
  (select array_agg(column_name::text order by column_name::text collate "C") from information_schema.column_privileges where table_schema = 'public' and table_name = 'workout_sets' and grantee = 'authenticated' and privilege_type = 'UPDATE'),
  array['deleted_at', 'load_kg', 'position', 'reps', 'rir', 'rpe', 'set_type'],
  'authenticated can update exactly these columns of workout_sets'
);
select is(
  (select array_agg(column_name::text order by column_name::text collate "C") from information_schema.column_privileges where table_schema = 'public' and table_name = 'routines' and grantee = 'authenticated' and privilege_type = 'INSERT'),
  array['name', 'user_id'],
  'authenticated can insert exactly these columns of routines'
);
select is(
  (select array_agg(column_name::text order by column_name::text collate "C") from information_schema.column_privileges where table_schema = 'public' and table_name = 'routines' and grantee = 'authenticated' and privilege_type = 'UPDATE'),
  array['is_active', 'is_archived', 'name'],
  'authenticated can update exactly these columns of routines'
);
select is(
  (select array_agg(column_name::text order by column_name::text collate "C") from information_schema.column_privileges where table_schema = 'public' and table_name = 'routine_days' and grantee = 'authenticated' and privilege_type = 'INSERT'),
  array['name', 'position', 'routine_id', 'user_id', 'weekday'],
  'authenticated can insert exactly these columns of routine_days'
);
select is(
  (select array_agg(column_name::text order by column_name::text collate "C") from information_schema.column_privileges where table_schema = 'public' and table_name = 'routine_days' and grantee = 'authenticated' and privilege_type = 'UPDATE'),
  array['name', 'position', 'weekday'],
  'authenticated can update exactly these columns of routine_days'
);
select is(
  (select array_agg(column_name::text order by column_name::text collate "C") from information_schema.column_privileges where table_schema = 'public' and table_name = 'routine_exercises' and grantee = 'authenticated' and privilege_type = 'INSERT'),
  array['exercise_id', 'position', 'rep_max', 'rep_min', 'routine_day_id', 'target_rir', 'target_sets', 'user_id'],
  'authenticated can insert exactly these columns of routine_exercises'
);
select is(
  (select count(*)::int from information_schema.column_privileges where table_schema = 'public' and table_name = 'routine_exercises' and grantee = 'authenticated' and privilege_type = 'UPDATE'),
  0,
  'authenticated can update no column of routine_exercises'
);
select is(
  (select array_agg(column_name::text order by column_name::text collate "C") from information_schema.column_privileges where table_schema = 'public' and table_name = 'training_goals' and grantee = 'authenticated' and privilege_type = 'INSERT'),
  array['days_per_week', 'equipment', 'experience', 'focus', 'goal', 'muscle_priority', 'params_version', 'session_minutes', 'user_id'],
  'authenticated can insert exactly these columns of training_goals'
);
select is(
  (select array_agg(column_name::text order by column_name::text collate "C") from information_schema.column_privileges where table_schema = 'public' and table_name = 'training_goals' and grantee = 'authenticated' and privilege_type = 'UPDATE'),
  array['effective_to'],
  'authenticated can update only effective_to of training_goals'
);
select ok(
  not exists (
    select 1 from information_schema.column_privileges
    where table_schema = 'public' and grantee = 'authenticated' and privilege_type = 'REFERENCES'
      and table_name in ('routines', 'routine_days', 'routine_exercises', 'workout_sessions', 'workout_sets', 'training_goals')
  ),
  'authenticated holds no references privilege on any column'
);

-- Policies, as predicates.
select is(
  (select array_agg(tablename::text || '/' || policyname || ':' || cmd || ':' || roles::text order by tablename::text collate "C", policyname::text collate "C") from pg_policies
   where schemaname = 'public' and tablename in ('routines', 'routine_days', 'routine_exercises', 'workout_sessions', 'workout_sets', 'training_goals')),
  array[
    'routine_days/routine_days_delete_own:DELETE:{authenticated}',
    'routine_days/routine_days_insert_own:INSERT:{authenticated}',
    'routine_days/routine_days_select_own:SELECT:{authenticated}',
    'routine_days/routine_days_update_own:UPDATE:{authenticated}',
    'routine_exercises/routine_exercises_delete_own:DELETE:{authenticated}',
    'routine_exercises/routine_exercises_insert_own:INSERT:{authenticated}',
    'routine_exercises/routine_exercises_select_own:SELECT:{authenticated}',
    'routines/routines_insert_own:INSERT:{authenticated}',
    'routines/routines_select_own:SELECT:{authenticated}',
    'routines/routines_update_own:UPDATE:{authenticated}',
    'training_goals/training_goals_insert_own:INSERT:{authenticated}',
    'training_goals/training_goals_select_own:SELECT:{authenticated}',
    'training_goals/training_goals_update_own:UPDATE:{authenticated}',
    'workout_sessions/workout_sessions_insert_own:INSERT:{authenticated}',
    'workout_sessions/workout_sessions_select_own:SELECT:{authenticated}',
    'workout_sessions/workout_sessions_update_own:UPDATE:{authenticated}',
    'workout_sets/workout_sets_insert_own:INSERT:{authenticated}',
    'workout_sets/workout_sets_select_own:SELECT:{authenticated}',
    'workout_sets/workout_sets_update_own:UPDATE:{authenticated}'
  ],
  'the six tables have exactly these policies'
);
select ok(
  (select bool_and(
     (qual is null or qual = '(user_id = ( SELECT auth.uid() AS uid))')
     and (with_check is null or with_check like '(%user_id = ( SELECT auth.uid() AS uid))%')
     and (cmd <> 'UPDATE' or (qual is not null and with_check = '(user_id = ( SELECT auth.uid() AS uid))'))
   ) from pg_policies
   where schemaname = 'public' and tablename in ('routines', 'routine_days', 'routine_exercises', 'workout_sessions', 'workout_sets', 'training_goals')),
  'every policy is owner-only on user_id and reads auth.uid() once per statement, and every update policy checks both sides'
);
select ok(
  (select with_check like '%routine_day_id IS NULL%' and with_check like '%FROM routine_days d%' from pg_policies where tablename = 'workout_sessions' and policyname = 'workout_sessions_insert_own')
    and (select with_check like '%FROM workout_sessions s%s.user_id = ( SELECT auth.uid() AS uid)%' and with_check like '%FROM exercises e%' from pg_policies where tablename = 'workout_sets' and policyname = 'workout_sets_insert_own')
    and (select with_check like '%FROM routines r%r.user_id = ( SELECT auth.uid() AS uid)%' from pg_policies where tablename = 'routine_days' and policyname = 'routine_days_insert_own')
    and (select with_check like '%FROM routine_days d%d.user_id = ( SELECT auth.uid() AS uid)%' and with_check like '%FROM exercises e%' from pg_policies where tablename = 'routine_exercises' and policyname = 'routine_exercises_insert_own')
    and (select with_check = '(user_id = ( SELECT auth.uid() AS uid))' from pg_policies where tablename = 'routines' and policyname = 'routines_insert_own')
    and (select with_check = '(user_id = ( SELECT auth.uid() AS uid))' from pg_policies where tablename = 'training_goals' and policyname = 'training_goals_insert_own'),
  'the insert policies check the session, routine, day and exercise each row refers to'
);

-- Anon.
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok($$ select * from public.routines $$, '42501', 'permission denied for table routines', 'anon cannot select from routines');
select throws_ok($$ select * from public.routine_days $$, '42501', 'permission denied for table routine_days', 'anon cannot select from routine_days');
select throws_ok($$ select * from public.routine_exercises $$, '42501', 'permission denied for table routine_exercises', 'anon cannot select from routine_exercises');
select throws_ok($$ select * from public.workout_sessions $$, '42501', 'permission denied for table workout_sessions', 'anon cannot select from workout_sessions');
select throws_ok($$ select * from public.workout_sets $$, '42501', 'permission denied for table workout_sets', 'anon cannot select from workout_sets');
select throws_ok($$ select * from public.training_goals $$, '42501', 'permission denied for table training_goals', 'anon cannot select from training_goals');
select throws_ok($$ select pg_temp.start_session(session_owner => null) $$, '42501', 'permission denied for table workout_sessions', 'anon cannot insert a session');
select throws_ok($$ select public.save_routine(null, '{"name":"key348-anon"}', '[]') $$, '42501', 'permission denied for function save_routine', 'anon cannot call save_routine');
select throws_ok($$ select public.set_active_routine(null) $$, '42501', 'permission denied for function set_active_routine', 'anon cannot call set_active_routine');
select throws_ok($$ select public.save_training_goals(pg_temp.goals()) $$, '42501', 'permission denied for function save_training_goals', 'anon cannot call save_training_goals');

reset role;

-- service_role: nothing server side reads these tables yet.
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';

select throws_ok($$ select * from public.workout_sets $$, '42501', 'permission denied for table workout_sets', 'service_role cannot read workout_sets');
select throws_ok($$ select * from public.training_goals $$, '42501', 'permission denied for table training_goals', 'service_role cannot read training_goals');
select throws_ok($$ select public.save_routine(null, '{"name":"key348-service"}', '[]') $$, '42501', 'permission denied for function save_routine', 'service_role cannot call save_routine');
select throws_ok($$ select public.set_active_routine(null) $$, '42501', 'permission denied for function set_active_routine', 'service_role cannot call set_active_routine');
select throws_ok($$ select public.save_training_goals(pg_temp.goals()) $$, '42501', 'permission denied for function save_training_goals', 'service_role cannot call save_training_goals');

reset role;

-- The bounds of "The numbers" on the tables, as user A writing directly, so the grants and policies
-- let each row through and the table's own check decides. Each failing row breaks exactly one rule.
set local role authenticated;
set local request.jwt.claims = '{"sub":"34800000-0000-4000-8000-00000000000a","role":"authenticated"}';

-- Routines.
select lives_ok($$ select pg_temp.add_routine('key348-a-direct') $$, 'user A inserts a routine directly');
select is(
  (select user_id::text || '/' || is_active::text || '/' || is_archived::text from public.routines where name = 'key348-a-direct'),
  '34800000-0000-4000-8000-00000000000a/false/false',
  'the routine belongs to A and starts inactive and live'
);
do $$ begin perform set_config('key348.direct', (select id::text from public.routines where name = 'key348-a-direct'), true); end $$;
select lives_ok($$ select pg_temp.add_routine('key348-' || repeat('r', 193)) $$, 'a routine name of 200 characters is accepted');
select throws_ok(
  $$ select pg_temp.add_routine('key348-' || repeat('r', 194)) $$,
  '23514', 'new row for relation "routines" violates check constraint "routines_name_length_check"',
  'a routine name of 201 characters is refused'
);
select throws_ok(
  $$ select pg_temp.add_routine(E' \t\n') $$,
  '23514', 'new row for relation "routines" violates check constraint "routines_name_not_blank"',
  'a blank routine name is refused'
);

-- Routine days.
select lives_ok(
  $$ select pg_temp.add_day(current_setting('key348.direct')::uuid, 0, 0, 'key348-' || repeat('d', 93)) $$,
  'a day at position 0 on weekday 0 with a name of 100 characters is accepted'
);
select lives_ok(
  $$ select pg_temp.add_day(current_setting('key348.direct')::uuid, 1, 6, 'key348-sunday') $$,
  'a day on weekday 6 is accepted'
);
select lives_ok(
  $$ select pg_temp.add_day(current_setting('key348.direct')::uuid, 2, null, 'key348-any-1');
     select pg_temp.add_day(current_setting('key348.direct')::uuid, 3, null, 'key348-any-2') $$,
  'two days of one routine can both be any day'
);
do $$ begin perform set_config('key348.sunday', (select id::text from public.routine_days where name = 'key348-sunday'), true); end $$;
select throws_ok(
  $$ select pg_temp.add_day(current_setting('key348.direct')::uuid, 4, 7) $$,
  '23514', 'new row for relation "routine_days" violates check constraint "routine_days_weekday_check"',
  'weekday 7 is refused'
);
select throws_ok(
  $$ select pg_temp.add_day(current_setting('key348.direct')::uuid, 4, -1) $$,
  '23514', 'new row for relation "routine_days" violates check constraint "routine_days_weekday_check"',
  'weekday -1 is refused'
);
select throws_ok(
  $$ select pg_temp.add_day(current_setting('key348.direct')::uuid, -1, 3) $$,
  '23514', 'new row for relation "routine_days" violates check constraint "routine_days_position_check"',
  'a negative day position is refused'
);
select throws_ok(
  $$ select pg_temp.add_day(current_setting('key348.direct')::uuid, 4, 3, 'key348-' || repeat('d', 94)) $$,
  '23514', 'new row for relation "routine_days" violates check constraint "routine_days_name_length_check"',
  'a day name of 101 characters is refused'
);
select throws_ok(
  $$ select pg_temp.add_day(current_setting('key348.direct')::uuid, 4, 3, '   ') $$,
  '23514', 'new row for relation "routine_days" violates check constraint "routine_days_name_not_blank"',
  'a blank day name is refused'
);
select throws_ok(
  $$ select pg_temp.add_day(current_setting('key348.direct')::uuid, 4, 0) $$,
  '23505', 'duplicate key value violates unique constraint "routine_days_routine_id_weekday_key"',
  'a second day on the same weekday is refused'
);
select throws_ok(
  $$ select pg_temp.add_day(current_setting('key348.direct')::uuid, 0, 2, 'key348-same-position');
     set constraints public.routine_days_routine_id_position_key immediate $$,
  '23505', 'duplicate key value violates unique constraint "routine_days_routine_id_position_key"',
  'a second day in the same position is refused when the deferred check runs'
);
select lives_ok(
  $$ update public.routine_days set position = 1 where routine_id = current_setting('key348.direct')::uuid and position = 0;
     update public.routine_days set position = 0 where id = current_setting('key348.sunday')::uuid;
     set constraints public.routine_days_routine_id_position_key immediate;
     set constraints public.routine_days_routine_id_position_key deferred $$,
  'two days swap positions with two plain updates, because the position check waits for the end'
);
select is(
  (select position from public.routine_days where id = current_setting('key348.sunday')::uuid),
  0,
  'the swapped day is in its new position'
);

-- Planned exercises.
select lives_ok(
  $$ select pg_temp.add_planned(current_setting('key348.sunday')::uuid, 0, 1, 1, 1, 0) $$,
  'one target set of exactly one rep at 0 RIR is accepted, and rep_min may equal rep_max'
);
select lives_ok(
  $$ select pg_temp.add_planned(current_setting('key348.sunday')::uuid, 1, 20, 100, 100, 10) $$,
  '20 target sets of 100 reps at 10 RIR are accepted'
);
select lives_ok(
  $$ select pg_temp.add_planned(current_setting('key348.sunday')::uuid, 2, planned_exercise => '34800000-0000-4000-8000-0000000001a1') $$,
  'user A plans their own private exercise'
);
select throws_ok(
  $$ select pg_temp.add_planned(current_setting('key348.sunday')::uuid, 3, 0) $$,
  '23514', 'new row for relation "routine_exercises" violates check constraint "routine_exercises_target_sets_check"',
  '0 target sets are refused'
);
select throws_ok(
  $$ select pg_temp.add_planned(current_setting('key348.sunday')::uuid, 3, 21) $$,
  '23514', 'new row for relation "routine_exercises" violates check constraint "routine_exercises_target_sets_check"',
  '21 target sets are refused'
);
select throws_ok(
  $$ select pg_temp.add_planned(current_setting('key348.sunday')::uuid, 3, 3, 0, 12) $$,
  '23514', 'new row for relation "routine_exercises" violates check constraint "routine_exercises_rep_min_check"',
  'a rep_min of 0 is refused'
);
select throws_ok(
  $$ select pg_temp.add_planned(current_setting('key348.sunday')::uuid, 3, 3, 8, 101) $$,
  '23514', 'new row for relation "routine_exercises" violates check constraint "routine_exercises_rep_max_check"',
  'a rep_max of 101 is refused'
);
select throws_ok(
  $$ select pg_temp.add_planned(current_setting('key348.sunday')::uuid, 3, 3, 9, 8) $$,
  '23514', 'new row for relation "routine_exercises" violates check constraint "routine_exercises_rep_range_check"',
  'a rep_min above rep_max is refused'
);
select throws_ok(
  $$ select pg_temp.add_planned(current_setting('key348.sunday')::uuid, 3, 3, 8, 12, -1) $$,
  '23514', 'new row for relation "routine_exercises" violates check constraint "routine_exercises_target_rir_check"',
  'a target RIR of -1 is refused'
);
select throws_ok(
  $$ select pg_temp.add_planned(current_setting('key348.sunday')::uuid, 3, 3, 8, 12, 11) $$,
  '23514', 'new row for relation "routine_exercises" violates check constraint "routine_exercises_target_rir_check"',
  'a target RIR of 11 is refused'
);
select throws_ok(
  $$ select pg_temp.add_planned(current_setting('key348.sunday')::uuid, -1) $$,
  '23514', 'new row for relation "routine_exercises" violates check constraint "routine_exercises_position_check"',
  'a negative planned exercise position is refused'
);
select throws_ok(
  $$ select pg_temp.add_planned(current_setting('key348.sunday')::uuid, 0) $$,
  '23505', 'duplicate key value violates unique constraint "routine_exercises_routine_day_id_position_key"',
  'two planned exercises of a day cannot share a position'
);

-- Sessions.
select lives_ok(
  $$ select pg_temp.start_session('2026-10-18 08:00+00', '2026-10-18 08:00+00', 'key348-' || repeat('z', 57), 'key348-' || repeat('n', 993)) $$,
  'a session that ends as it starts, with a zone of 64 characters and a note of 1000, is accepted'
);
select throws_ok(
  $$ select pg_temp.start_session('2026-10-18 08:00+00', '2026-10-18 07:59:59+00') $$,
  '23514', 'new row for relation "workout_sessions" violates check constraint "workout_sessions_ended_after_started"',
  'a session that ends before it starts is refused'
);
select throws_ok(
  $$ select pg_temp.start_session(session_tz => 'key348-' || repeat('z', 58)) $$,
  '23514', 'new row for relation "workout_sessions" violates check constraint "workout_sessions_tz_length_check"',
  'a zone of 65 characters is refused'
);
select throws_ok(
  $$ select pg_temp.start_session(session_tz => ' ') $$,
  '23514', 'new row for relation "workout_sessions" violates check constraint "workout_sessions_tz_not_blank"',
  'a blank zone is refused'
);
select throws_ok(
  $$ select pg_temp.start_session(session_note => 'key348-' || repeat('n', 994)) $$,
  '23514', 'new row for relation "workout_sessions" violates check constraint "workout_sessions_note_length_check"',
  'a note of 1001 characters is refused'
);

-- Sets, in A's session.
select lives_ok($$ select pg_temp.log_set(1, 0, 0, null) $$, 'one rep at 0 kg and 0 RIR is accepted');
select lives_ok($$ select pg_temp.log_set(100, 1000, 10, null) $$, '100 reps at 1000 kg and 10 RIR are accepted');
select lives_ok($$ select pg_temp.log_set(10, null, null, 1) $$, 'an unloaded set at RPE 1 is accepted');
select lives_ok($$ select pg_temp.log_set(10, 20, null, 10) $$, 'RPE 10 is accepted');
select lives_ok($$ select pg_temp.log_set(10, 20, null, 7.5) $$, 'RPE 7.5, a half step, is accepted');
select lives_ok($$ select pg_temp.log_set(10, 20, null, null) $$, 'a set with no effort measure is accepted');
select throws_ok(
  $$ select pg_temp.log_set(0) $$,
  '23514', 'new row for relation "workout_sets" violates check constraint "workout_sets_reps_check"', '0 reps are refused'
);
select throws_ok(
  $$ select pg_temp.log_set(101) $$,
  '23514', 'new row for relation "workout_sets" violates check constraint "workout_sets_reps_check"', '101 reps are refused'
);
select throws_ok(
  $$ select pg_temp.log_set(10, -0.5) $$,
  '23514', 'new row for relation "workout_sets" violates check constraint "workout_sets_load_kg_check"', 'a negative load is refused'
);
select throws_ok(
  $$ select pg_temp.log_set(10, 1000.5) $$,
  '23514', 'new row for relation "workout_sets" violates check constraint "workout_sets_load_kg_check"', 'a load above 1000 kg is refused'
);
select throws_ok(
  $$ select pg_temp.log_set(10, 20, -1) $$,
  '23514', 'new row for relation "workout_sets" violates check constraint "workout_sets_rir_check"', 'RIR -1 is refused'
);
select throws_ok(
  $$ select pg_temp.log_set(10, 20, 11) $$,
  '23514', 'new row for relation "workout_sets" violates check constraint "workout_sets_rir_check"', 'RIR 11 is refused'
);
select throws_ok(
  $$ select pg_temp.log_set(10, 20, null, 0.5) $$,
  '23514', 'new row for relation "workout_sets" violates check constraint "workout_sets_rpe_check"', 'RPE 0.5 is refused'
);
select throws_ok(
  $$ select pg_temp.log_set(10, 20, null, 10.5) $$,
  '23514', 'new row for relation "workout_sets" violates check constraint "workout_sets_rpe_check"', 'RPE 10.5 is refused'
);
select throws_ok(
  $$ select pg_temp.log_set(10, 20, null, 7.25) $$,
  '23514', 'new row for relation "workout_sets" violates check constraint "workout_sets_rpe_check"', 'RPE 7.25, off the half steps, is refused'
);
select throws_ok(
  $$ select pg_temp.log_set(10, 20, 2, 8) $$,
  '23514', 'new row for relation "workout_sets" violates check constraint "workout_sets_one_effort_measure"', 'a set with both RIR and RPE is refused'
);
select throws_ok(
  $$ select pg_temp.log_set(set_position => -1) $$,
  '23514', 'new row for relation "workout_sets" violates check constraint "workout_sets_position_check"', 'a negative set position is refused'
);
select throws_ok(
  $$ select pg_temp.log_set(set_snapshot => '[]') $$,
  '23514', 'new row for relation "workout_sets" violates check constraint "workout_sets_snapshot_is_versioned_object"', 'a snapshot that is not an object is refused'
);
select throws_ok(
  $$ select pg_temp.log_set(set_snapshot => '{"kind":"exercise"}') $$,
  '23514', 'new row for relation "workout_sets" violates check constraint "workout_sets_snapshot_is_versioned_object"', 'a snapshot with no version is refused'
);
select throws_ok(
  $$ select pg_temp.log_set(set_snapshot => '{"version":null}') $$,
  '23514', 'new row for relation "workout_sets" violates check constraint "workout_sets_snapshot_is_versioned_object"', 'a snapshot whose version is null is refused'
);
select lives_ok(
  $$ select pg_temp.log_set(set_position => 5); select pg_temp.log_set(set_position => 5) $$,
  'two sets of a session can share a position'
);
select is(
  (select count(*)::int || '/' || bool_and(set_type = 'working' and deleted_at is null and performed_at = now())::text
   from public.workout_sets where session_id = '34800000-0000-4000-8000-0000000006a1' and position = 5),
  '2/true',
  'both are kept, as live working sets performed now'
);
select lives_ok(
  $$ update public.workout_sets set position = 6, set_type = 'drop', reps = 8, load_kg = 15, rir = null, rpe = 9.5
     where id = (select id from public.workout_sets where session_id = '34800000-0000-4000-8000-0000000006a1' and position = 5 limit 1) $$,
  'user A edits a set''s position, type, reps, load and effort'
);
select throws_ok(
  $$ update public.workout_sets set rir = 3, rpe = 8 where session_id = '34800000-0000-4000-8000-0000000006a1' and position = 6 $$,
  '23514', 'new row for relation "workout_sets" violates check constraint "workout_sets_one_effort_measure"',
  'an edit cannot give a set both RIR and RPE'
);
select throws_ok(
  $$ update public.workout_sets set reps = 101 where session_id = '34800000-0000-4000-8000-0000000006a1' and position = 6 $$,
  '23514', 'new row for relation "workout_sets" violates check constraint "workout_sets_reps_check"',
  'an edit is held to the bounds too'
);

reset role;

-- Training goals. User D writes directly first, which also proves that authenticated can run the
-- focus helper the check calls. The rest of the bounds are rows written as postgres, closed so the
-- one-current rule does not get in the way.
set local role authenticated;
set local request.jwt.claims = '{"sub":"34800000-0000-4000-8000-00000000000d","role":"authenticated"}';

select lives_ok(
  $$ insert into public.training_goals (user_id, goal, focus, days_per_week, session_minutes, equipment, experience, muscle_priority, params_version)
     values ('34800000-0000-4000-8000-00000000000d', 'strength', '{v_taper,chest,arms,glutes,legs,overall}', 1, 15, '{barbell,kettlebell}', 'beginner', '{}', 'key348-params-1') $$,
  'user D inserts goals directly, with every focus once, 1 day a week and 15 minutes'
);
select is(
  (select (effective_from = now())::text || '/' || coalesce(effective_to::text, 'null') from public.training_goals where user_id = '34800000-0000-4000-8000-00000000000d'),
  'true/null',
  'the row takes the database''s time and is current'
);
select throws_ok(
  $$ insert into public.training_goals (user_id, goal, days_per_week, session_minutes, experience, muscle_priority, params_version)
     values ('34800000-0000-4000-8000-00000000000d', 'strength', 3, 45, 'beginner', '{}', 'key348-params-1') $$,
  '23505', 'duplicate key value violates unique constraint "training_goals_one_current_per_user"',
  'a second current goals row is refused'
);
select throws_ok(
  $$ insert into public.training_goals (user_id, goal, days_per_week, session_minutes, experience, muscle_priority, params_version, effective_from)
     values ('34800000-0000-4000-8000-00000000000d', 'strength', 3, 45, 'beginner', '{}', 'key348-params-1', '2020-01-01') $$,
  '42501', 'permission denied for table training_goals',
  'a client cannot backdate a goals row'
);
select throws_ok(
  $$ insert into public.training_goals (user_id, goal, days_per_week, session_minutes, experience, muscle_priority, params_version, effective_to)
     values ('34800000-0000-4000-8000-00000000000d', 'strength', 3, 45, 'beginner', '{}', 'key348-params-1', '2030-01-01') $$,
  '42501', 'permission denied for table training_goals',
  'a client cannot insert a closed goals row'
);
select throws_ok(
  $$ update public.training_goals set effective_to = now() where user_id = '34800000-0000-4000-8000-00000000000d' $$,
  '23514', 'new row for relation "training_goals" violates check constraint "training_goals_effective_range_check"',
  'a goals row cannot end when it starts'
);

reset role;

create function pg_temp.closed_goals(goals_days integer default 3, goals_minutes integer default 45, goals_focus text[] default '{}', goals_priority jsonb default '{}')
returns void language sql as $$
  insert into public.training_goals (user_id, goal, focus, days_per_week, session_minutes, experience, muscle_priority, params_version, effective_from, effective_to)
  values ('34800000-0000-4000-8000-00000000000d', 'hybrid', goals_focus, goals_days, goals_minutes, 'advanced', goals_priority, 'key348-params-1', '2025-01-01', '2025-02-01')
$$;

select lives_ok($$ select pg_temp.closed_goals(7, 180) $$, '7 days a week and 180 minutes are accepted');
select lives_ok($$ select pg_temp.closed_goals(goals_focus => '{}') $$, 'an empty focus is accepted');
select throws_ok(
  $$ select pg_temp.closed_goals(0) $$,
  '23514', 'new row for relation "training_goals" violates check constraint "training_goals_days_per_week_check"', '0 days a week are refused'
);
select throws_ok(
  $$ select pg_temp.closed_goals(8) $$,
  '23514', 'new row for relation "training_goals" violates check constraint "training_goals_days_per_week_check"', '8 days a week are refused'
);
select throws_ok(
  $$ select pg_temp.closed_goals(goals_minutes => 14) $$,
  '23514', 'new row for relation "training_goals" violates check constraint "training_goals_session_minutes_check"', '14 minutes are refused'
);
select throws_ok(
  $$ select pg_temp.closed_goals(goals_minutes => 181) $$,
  '23514', 'new row for relation "training_goals" violates check constraint "training_goals_session_minutes_check"', '181 minutes are refused'
);
select throws_ok(
  $$ select pg_temp.closed_goals(goals_focus => '{key348}') $$,
  '23514', 'new row for relation "training_goals" violates check constraint "training_goals_focus_check"', 'a focus off the list is refused'
);
select throws_ok(
  $$ select pg_temp.closed_goals(goals_focus => '{chest,chest}') $$,
  '23514', 'new row for relation "training_goals" violates check constraint "training_goals_focus_check"', 'a repeated focus is refused'
);
select throws_ok(
  $$ select pg_temp.closed_goals(goals_focus => '{chest,NULL}') $$,
  '23514', 'new row for relation "training_goals" violates check constraint "training_goals_focus_check"', 'a null focus is refused'
);
select throws_ok(
  $$ select pg_temp.closed_goals(goals_focus => '{{chest},{arms}}') $$,
  '23514', 'new row for relation "training_goals" violates check constraint "training_goals_focus_check"', 'a focus list of more than one dimension is refused'
);
select throws_ok(
  $$ select pg_temp.closed_goals(goals_priority => '[]') $$,
  '23514', 'new row for relation "training_goals" violates check constraint "training_goals_muscle_priority_is_object"', 'a muscle priority that is not an object is refused'
);
select throws_ok(
  $$ insert into public.training_goals (user_id, goal, days_per_week, session_minutes, experience, muscle_priority, params_version, effective_from, effective_to)
     values ('34800000-0000-4000-8000-00000000000d', 'hybrid', 3, 45, 'advanced', '{}', 'key348-params-1', '2025-01-01', '2024-12-31') $$,
  '23514', 'new row for relation "training_goals" violates check constraint "training_goals_effective_range_check"', 'a goals row cannot end before it starts'
);

-- Owner only, as user A: A reads only their own rows, and cannot write a row for anyone else or
-- point a row at anyone else's session, routine, day or private exercise. A reference to another
-- user's row fails exactly as a reference to an id that does not exist.
set local role authenticated;
set local request.jwt.claims = '{"sub":"34800000-0000-4000-8000-00000000000a","role":"authenticated"}';

select is(
  (select count(*)::int from public.routines where user_id <> '34800000-0000-4000-8000-00000000000a')
    || '/' || (select count(*)::int from public.routine_days where user_id <> '34800000-0000-4000-8000-00000000000a')
    || '/' || (select count(*)::int from public.routine_exercises where user_id <> '34800000-0000-4000-8000-00000000000a')
    || '/' || (select count(*)::int from public.workout_sessions where user_id <> '34800000-0000-4000-8000-00000000000a')
    || '/' || (select count(*)::int from public.workout_sets where user_id <> '34800000-0000-4000-8000-00000000000a')
    || '/' || (select count(*)::int from public.training_goals where user_id <> '34800000-0000-4000-8000-00000000000a'),
  '0/0/0/0/0/0',
  'user A sees no other user''s routines, days, planned exercises, sessions, sets or goals'
);
select is(
  (select count(*)::int from public.workout_sessions where id = '34800000-0000-4000-8000-0000000006a1')
    || '/' || (select count(*)::int from public.training_goals where id = '34800000-0000-4000-8000-0000000008a1'),
  '1/1',
  'user A sees their own session and goals'
);

-- Writing a row for another user.
select throws_ok(
  $$ select pg_temp.add_routine('key348-a-for-b', '34800000-0000-4000-8000-00000000000b') $$,
  '42501', 'new row violates row-level security policy for table "routines"', 'user A cannot insert a routine for user B'
);
select throws_ok(
  $$ select pg_temp.add_day(current_setting('key348.direct')::uuid, 9, null, 'key348-a-for-b', '34800000-0000-4000-8000-00000000000b') $$,
  '42501', 'new row violates row-level security policy for table "routine_days"', 'user A cannot insert a day with user B''s id, even in their own routine'
);
select throws_ok(
  $$ select pg_temp.add_planned(current_setting('key348.sunday')::uuid, 9, planned_user => '34800000-0000-4000-8000-00000000000b') $$,
  '42501', 'new row violates row-level security policy for table "routine_exercises"', 'user A cannot insert a planned exercise with user B''s id'
);
select throws_ok(
  $$ select pg_temp.start_session(session_owner => '34800000-0000-4000-8000-00000000000b') $$,
  '42501', 'new row violates row-level security policy for table "workout_sessions"', 'user A cannot insert a session for user B'
);
select throws_ok(
  $$ select pg_temp.log_set(set_user => '34800000-0000-4000-8000-00000000000b') $$,
  '42501', 'new row violates row-level security policy for table "workout_sets"', 'user A cannot insert a set with user B''s id'
);
select throws_ok(
  $$ insert into public.training_goals (user_id, goal, days_per_week, session_minutes, experience, muscle_priority, params_version)
     values ('34800000-0000-4000-8000-00000000000b', 'strength', 3, 45, 'beginner', '{}', 'key348-params-1') $$,
  '42501', 'new row violates row-level security policy for table "training_goals"', 'user A cannot insert goals for user B'
);

-- Pointing a row at another user's row, or at an id that does not exist.
select throws_ok(
  $$ select pg_temp.add_day('34800000-0000-4000-8000-0000000003b1', 9, null) $$,
  '42501', 'new row violates row-level security policy for table "routine_days"', 'user A cannot add a day to user B''s routine'
);
select throws_ok(
  $$ select pg_temp.add_day('34800000-0000-4000-8000-00000000dead', 9, null) $$,
  '42501', 'new row violates row-level security policy for table "routine_days"', 'a routine that does not exist fails the same way'
);
select throws_ok(
  $$ select pg_temp.add_planned('34800000-0000-4000-8000-0000000004b1', 9) $$,
  '42501', 'new row violates row-level security policy for table "routine_exercises"', 'user A cannot plan an exercise on user B''s day'
);
select throws_ok(
  $$ select pg_temp.add_planned('34800000-0000-4000-8000-00000000dead', 9) $$,
  '42501', 'new row violates row-level security policy for table "routine_exercises"', 'a day that does not exist fails the same way'
);
select throws_ok(
  $$ select pg_temp.add_planned(current_setting('key348.sunday')::uuid, 9, planned_exercise => '34800000-0000-4000-8000-0000000001b1') $$,
  '42501', 'new row violates row-level security policy for table "routine_exercises"', 'user A cannot plan user B''s private exercise'
);
select throws_ok(
  $$ select pg_temp.add_planned(current_setting('key348.sunday')::uuid, 9, planned_exercise => '34800000-0000-4000-8000-00000000dead') $$,
  '42501', 'new row violates row-level security policy for table "routine_exercises"', 'an exercise that does not exist fails the same way when planned'
);
select throws_ok(
  $$ select pg_temp.start_session(session_day => '34800000-0000-4000-8000-0000000004b1') $$,
  '42501', 'new row violates row-level security policy for table "workout_sessions"', 'user A cannot start a session from user B''s day'
);
select throws_ok(
  $$ select pg_temp.start_session(session_day => '34800000-0000-4000-8000-00000000dead') $$,
  '42501', 'new row violates row-level security policy for table "workout_sessions"', 'a day that does not exist fails the same way for a session'
);
select lives_ok(
  $$ select pg_temp.start_session(session_day => current_setting('key348.sunday')::uuid, session_ended => '2026-10-18 09:00+00', session_note => 'key348-from-sunday') $$,
  'user A starts a session from their own day'
);
select throws_ok(
  $$ select pg_temp.log_set(set_session => '34800000-0000-4000-8000-0000000006b1') $$,
  '42501', 'new row violates row-level security policy for table "workout_sets"', 'user A cannot add a set to user B''s session'
);
select throws_ok(
  $$ select pg_temp.log_set(set_session => '34800000-0000-4000-8000-00000000dead') $$,
  '42501', 'new row violates row-level security policy for table "workout_sets"', 'a session that does not exist fails the same way'
);
select throws_ok(
  $$ select pg_temp.log_set(set_exercise => '34800000-0000-4000-8000-0000000001b1') $$,
  '42501', 'new row violates row-level security policy for table "workout_sets"', 'user A cannot log a set against user B''s private exercise'
);
select throws_ok(
  $$ select pg_temp.log_set(set_exercise => '34800000-0000-4000-8000-0000000001c1') $$,
  '42501', 'new row violates row-level security policy for table "workout_sets"', 'user A cannot log a set against user C''s private exercise'
);
select throws_ok(
  $$ select pg_temp.log_set(set_exercise => '34800000-0000-4000-8000-00000000dead') $$,
  '42501', 'new row violates row-level security policy for table "workout_sets"', 'an exercise that does not exist fails the same way when logged'
);

-- Changing another user's rows changes nothing.
with changed as (
  update public.routines set name = 'key348-taken-over' where id = '34800000-0000-4000-8000-0000000003b1' returning 1
)
select is((select count(*)::int from changed), 0, 'user A renames none of user B''s routines');
with changed as (
  update public.routine_days set name = 'key348-taken-over' where id = '34800000-0000-4000-8000-0000000004b1' returning 1
)
select is((select count(*)::int from changed), 0, 'user A renames none of user B''s days');
with changed as (
  update public.workout_sessions set deleted_at = now() where id = '34800000-0000-4000-8000-0000000006b1' returning 1
)
select is((select count(*)::int from changed), 0, 'user A deletes none of user B''s sessions');
with changed as (
  update public.workout_sets set reps = 1 where id = '34800000-0000-4000-8000-0000000007b1' returning 1
)
select is((select count(*)::int from changed), 0, 'user A edits none of user B''s sets');
with changed as (
  update public.training_goals set effective_to = now() where id = '34800000-0000-4000-8000-0000000008b1' returning 1
)
select is((select count(*)::int from changed), 0, 'user A closes none of user B''s goals');
with removed as (
  delete from public.routine_days where id = '34800000-0000-4000-8000-0000000004b1' returning 1
)
select is((select count(*)::int from removed), 0, 'user A deletes none of user B''s days');
with removed as (
  delete from public.routine_exercises where id = '34800000-0000-4000-8000-0000000005b1' returning 1
)
select is((select count(*)::int from removed), 0, 'user A deletes none of user B''s planned exercises');

-- What the grants leave out, on A's own rows.
select throws_ok(
  $$ delete from public.workout_sets where session_id = '34800000-0000-4000-8000-0000000006a1' $$,
  '42501', 'permission denied for table workout_sets', 'user A cannot hard delete a set'
);
select throws_ok(
  $$ delete from public.workout_sessions where id = '34800000-0000-4000-8000-0000000006a1' $$,
  '42501', 'permission denied for table workout_sessions', 'user A cannot hard delete a session'
);
select throws_ok(
  $$ delete from public.routines where id = current_setting('key348.direct')::uuid $$,
  '42501', 'permission denied for table routines', 'user A cannot delete a routine'
);
select throws_ok(
  $$ delete from public.training_goals where id = '34800000-0000-4000-8000-0000000008a1' $$,
  '42501', 'permission denied for table training_goals', 'user A cannot delete goals'
);
select throws_ok(
  $$ update public.workout_sets set session_id = '34800000-0000-4000-8000-0000000006b1' where session_id = '34800000-0000-4000-8000-0000000006a1' $$,
  '42501', 'permission denied for table workout_sets', 'a set never changes session'
);
select throws_ok(
  $$ update public.workout_sets set exercise_id = '34800000-0000-4000-8000-0000000001a1' where session_id = '34800000-0000-4000-8000-0000000006a1' $$,
  '42501', 'permission denied for table workout_sets', 'a set never changes exercise'
);
select throws_ok(
  $$ update public.workout_sets set snapshot = '{"version":1}' where session_id = '34800000-0000-4000-8000-0000000006a1' $$,
  '42501', 'permission denied for table workout_sets', 'a set''s snapshot is never rewritten'
);
select throws_ok(
  $$ update public.workout_sets set performed_at = now() - interval '1 day' where session_id = '34800000-0000-4000-8000-0000000006a1' $$,
  '42501', 'permission denied for table workout_sets', 'a set''s performed_at is set on insert only'
);
select throws_ok(
  $$ update public.workout_sets set user_id = '34800000-0000-4000-8000-00000000000b' where session_id = '34800000-0000-4000-8000-0000000006a1' $$,
  '42501', 'permission denied for table workout_sets', 'user A cannot hand a set to user B'
);
select throws_ok(
  $$ insert into public.workout_sets (id, session_id, user_id, exercise_id, position, reps, snapshot)
     values ('34800000-0000-4000-8000-0000000007ff', '34800000-0000-4000-8000-0000000006a1', '34800000-0000-4000-8000-00000000000a', '34800000-0000-4000-8000-000000000101', 0, 5, '{"version":1}') $$,
  '42501', 'permission denied for table workout_sets', 'user A cannot choose the id of a set'
);
select throws_ok(
  $$ insert into public.workout_sets (session_id, user_id, exercise_id, position, reps, snapshot, deleted_at)
     values ('34800000-0000-4000-8000-0000000006a1', '34800000-0000-4000-8000-00000000000a', '34800000-0000-4000-8000-000000000101', 0, 5, '{"version":1}', now()) $$,
  '42501', 'permission denied for table workout_sets', 'user A cannot insert a deleted set'
);
select throws_ok(
  $$ update public.workout_sessions set started_at = now() where id = '34800000-0000-4000-8000-0000000006a1' $$,
  '42501', 'permission denied for table workout_sessions', 'a session''s start never changes'
);
select throws_ok(
  $$ update public.workout_sessions set local_date = '2026-10-01' where id = '34800000-0000-4000-8000-0000000006a1' $$,
  '42501', 'permission denied for table workout_sessions', 'a session never moves to another day'
);
select throws_ok(
  $$ update public.workout_sessions set tz = 'UTC' where id = '34800000-0000-4000-8000-0000000006a1' $$,
  '42501', 'permission denied for table workout_sessions', 'a session''s zone never changes'
);
select throws_ok(
  $$ update public.workout_sessions set routine_day_id = null where id = '34800000-0000-4000-8000-0000000006a1' $$,
  '42501', 'permission denied for table workout_sessions', 'a session never moves to another planned day'
);
select throws_ok(
  $$ update public.workout_sessions set user_id = '34800000-0000-4000-8000-00000000000b' where id = '34800000-0000-4000-8000-0000000006a1' $$,
  '42501', 'permission denied for table workout_sessions', 'user A cannot hand a session to user B'
);
select throws_ok(
  $$ insert into public.workout_sessions (id, user_id, started_at, local_date, tz)
     values ('34800000-0000-4000-8000-0000000006ff', '34800000-0000-4000-8000-00000000000a', now(), '2026-10-18', 'UTC') $$,
  '42501', 'permission denied for table workout_sessions', 'user A cannot choose the id of a session'
);
select throws_ok(
  $$ update public.routines set user_id = '34800000-0000-4000-8000-00000000000b' where id = current_setting('key348.direct')::uuid $$,
  '42501', 'permission denied for table routines', 'user A cannot hand a routine to user B'
);
select throws_ok(
  $$ insert into public.routines (user_id, name, is_active) values ('34800000-0000-4000-8000-00000000000a', 'key348-born-active', true) $$,
  '42501', 'permission denied for table routines', 'a routine cannot be inserted active'
);
select throws_ok(
  $$ update public.routine_days set routine_id = '34800000-0000-4000-8000-0000000003b1' where id = current_setting('key348.sunday')::uuid $$,
  '42501', 'permission denied for table routine_days', 'a day never moves to another routine'
);
select throws_ok(
  $$ update public.routine_days set user_id = '34800000-0000-4000-8000-00000000000b' where id = current_setting('key348.sunday')::uuid $$,
  '42501', 'permission denied for table routine_days', 'user A cannot hand a day to user B'
);
select throws_ok(
  $$ update public.routine_exercises set target_sets = 4 where routine_day_id = current_setting('key348.sunday')::uuid $$,
  '42501', 'permission denied for table routine_exercises', 'a planned exercise is never edited in place'
);
select throws_ok(
  $$ update public.training_goals set goal = 'strength' where id = '34800000-0000-4000-8000-0000000008a1' $$,
  '42501', 'permission denied for table training_goals', 'a goals row is never edited, only closed'
);
select throws_ok(
  $$ update public.training_goals set effective_from = now() - interval '1 year' where id = '34800000-0000-4000-8000-0000000008a1' $$,
  '42501', 'permission denied for table training_goals', 'a goals row''s start never changes'
);

-- What the grants allow, on A's own rows.
select lives_ok(
  $$ update public.workout_sessions set ended_at = '2026-10-17 09:00+00', note = 'key348-done' where id = '34800000-0000-4000-8000-0000000006a1' $$,
  'user A ends and annotates their own session'
);
select lives_ok(
  $$ update public.workout_sessions set deleted_at = now() where id = '34800000-0000-4000-8000-0000000006a1' $$,
  'user A soft deletes their own session'
);
select is(
  (select count(*)::int from public.workout_sessions where id = '34800000-0000-4000-8000-0000000006a1' and deleted_at is not null)
    || '/' || (select count(*)::int from public.workout_sets where session_id = '34800000-0000-4000-8000-0000000006a1' and deleted_at is null),
  '1/8',
  'a soft deleted session is still readable, and its sets are untouched'
);
select lives_ok(
  $$ update public.workout_sessions set deleted_at = null where id = '34800000-0000-4000-8000-0000000006a1' $$,
  'user A restores their own session'
);
select lives_ok(
  $$ update public.workout_sets set deleted_at = now() where session_id = '34800000-0000-4000-8000-0000000006a1' and position = 6 $$,
  'user A soft deletes their own set'
);
select is(
  (select count(*)::int from public.workout_sets where session_id = '34800000-0000-4000-8000-0000000006a1' and position = 6 and deleted_at is not null),
  1,
  'a soft deleted set is still readable'
);
select lives_ok(
  $$ update public.routines set name = 'key348-a-direct-renamed', is_archived = true where id = current_setting('key348.direct')::uuid $$,
  'user A renames and archives their own routine'
);
select lives_ok(
  $$ update public.routine_days set name = 'key348-sunday-renamed', weekday = 5 where id = current_setting('key348.sunday')::uuid $$,
  'user A edits their own day'
);
select throws_ok(
  $$ update public.routines set is_active = true where id = current_setting('key348.direct')::uuid $$,
  '23514', 'new row for relation "routines" violates check constraint "routines_active_not_archived"',
  'an archived routine cannot be active'
);

-- An exercise is soft deleted, never hard deleted, and the sets logged against it keep their frozen
-- snapshot whatever happens to it.
select lives_ok(
  $$ select pg_temp.log_set(12, 40, set_exercise => '34800000-0000-4000-8000-0000000001a2', set_position => 7,
       set_snapshot => pg_temp.snapshot('34800000-0000-4000-8000-0000000001a2', 'key348-a-row')) $$,
  'user A logs a set against their own private exercise'
);
select lives_ok(
  $$ update public.exercises set name = 'key348-a-row-renamed', deleted_at = now() where id = '34800000-0000-4000-8000-0000000001a2' $$,
  'user A renames and soft deletes that exercise'
);
select is(
  (select count(*)::int || '/' || min(s.snapshot ->> 'ref') || '/' || min(s.snapshot ->> 'name') || '/' || min(s.snapshot ->> 'version')
   from public.workout_sets s where s.exercise_id = '34800000-0000-4000-8000-0000000001a2' and s.deleted_at is null),
  '1/34800000-0000-4000-8000-0000000001a2/key348-a-row/1',
  'the set survives the exercise''s soft delete with its snapshot as it was logged'
);
select is(
  (select count(*)::int from public.exercises where id = '34800000-0000-4000-8000-0000000001a2' and deleted_at is not null),
  1,
  'the soft deleted exercise is still readable for the set that names it'
);

reset role;

-- No action: the set blocks a stray hard delete of its exercise, even by postgres.
select throws_ok(
  $$ delete from public.exercises where id = '34800000-0000-4000-8000-0000000001a2' $$,
  '23503', 'update or delete on table "exercises" violates foreign key constraint "workout_sets_exercise_id_fkey" on table "workout_sets"',
  'a set blocks the hard delete of its exercise'
);
select throws_ok(
  $$ delete from public.exercises where id = '34800000-0000-4000-8000-0000000001a1' $$,
  '23503', 'update or delete on table "exercises" violates foreign key constraint "routine_exercises_exercise_id_fkey" on table "routine_exercises"',
  'a planned exercise blocks the hard delete of its exercise'
);

-- save_routine as user A: creating. Keys it does not know are ignored, so the caller owns the
-- routine, it starts inactive and live, and every position is the index in its array.
set local role authenticated;
set local request.jwt.claims = '{"sub":"34800000-0000-4000-8000-00000000000a","role":"authenticated"}';

select lives_ok(
  $$ select set_config('key348.plan', public.save_routine(
       null,
       '{"name":"key348-a-plan","id":"34800000-0000-4000-8000-0000000003ee","user_id":"34800000-0000-4000-8000-00000000000b","is_active":true,"is_archived":true}',
       jsonb_build_array(
         pg_temp.day('key348-push', 0, jsonb_build_array(
           pg_temp.planned() || '{"user_id":"34800000-0000-4000-8000-00000000000b","position":9,"routine_day_id":"34800000-0000-4000-8000-0000000004b1"}',
           pg_temp.planned('34800000-0000-4000-8000-0000000001a1', 4, 6, 8, 2)
         )) || '{"position":5,"user_id":"34800000-0000-4000-8000-00000000000b","routine_id":"34800000-0000-4000-8000-0000000003b1"}',
         pg_temp.day('key348-pull', 2, jsonb_build_array(pg_temp.planned('34800000-0000-4000-8000-000000000101', 5, 5, 5, 0))),
         pg_temp.day('key348-legs', null) - 'id'
       )
     )::text, true) $$,
  'a new routine is created with its days and their exercises'
);
select is(
  (select user_id::text || '/' || name || '/' || is_active::text || '/' || is_archived::text || '/' || (id <> '34800000-0000-4000-8000-0000000003ee')::text
   from public.routines where id = current_setting('key348.plan')::uuid),
  '34800000-0000-4000-8000-00000000000a/key348-a-plan/false/false/true',
  'the routine belongs to the caller, starts inactive and live, and has the database''s id, whatever the payload says'
);
select is(
  (select array_agg(position::text || ':' || coalesce(weekday::text, 'any') || ':' || name || ':' || user_id::text order by position)
   from public.routine_days where routine_id = current_setting('key348.plan')::uuid),
  array[
    '0:0:key348-push:34800000-0000-4000-8000-00000000000a',
    '1:2:key348-pull:34800000-0000-4000-8000-00000000000a',
    '2:any:key348-legs:34800000-0000-4000-8000-00000000000a'
  ],
  'the days are in the order sent, on their weekdays, and belong to the caller'
);
select is(
  (select array_agg(d.name || ':' || e.position::text || ':' || e.exercise_id::text || ':' || e.target_sets::text || ':' || e.rep_min::text || '-' || e.rep_max::text || ':' || coalesce(e.target_rir::text, 'none') || ':' || e.user_id::text order by d.position, e.position)
   from public.routine_exercises e join public.routine_days d on d.id = e.routine_day_id
   where d.routine_id = current_setting('key348.plan')::uuid),
  array[
    'key348-push:0:34800000-0000-4000-8000-000000000101:3:8-12:none:34800000-0000-4000-8000-00000000000a',
    'key348-push:1:34800000-0000-4000-8000-0000000001a1:4:6-8:2:34800000-0000-4000-8000-00000000000a',
    'key348-pull:0:34800000-0000-4000-8000-000000000101:5:5-5:0:34800000-0000-4000-8000-00000000000a'
  ],
  'each day has its exercises in the order sent, a global and an own exercise among them'
);
do $$ begin
  perform set_config('key348.push', (select id::text from public.routine_days where routine_id = current_setting('key348.plan')::uuid and name = 'key348-push'), true);
  perform set_config('key348.pull', (select id::text from public.routine_days where routine_id = current_setting('key348.plan')::uuid and name = 'key348-pull'), true);
  perform set_config('key348.legs', (select id::text from public.routine_days where routine_id = current_setting('key348.plan')::uuid and name = 'key348-legs'), true);
end $$;
select lives_ok(
  $$ select pg_temp.start_session(session_day => current_setting('key348.push')::uuid, session_ended => '2026-10-18 09:00+00', session_note => 'key348-from-push');
     select pg_temp.start_session(session_day => current_setting('key348.legs')::uuid, session_ended => '2026-10-18 09:00+00', session_note => 'key348-from-legs') $$,
  'user A logs a session from the push day and one from the legs day'
);

-- save_routine as user A: editing. Push and pull swap both positions and weekdays, legs is removed
-- and arms is added. The kept days keep their ids.
select lives_ok(
  $$ select set_config('key348.plan_edit', public.save_routine(
       current_setting('key348.plan')::uuid,
       '{"name":"key348-a-plan-v2"}',
       jsonb_build_array(
         pg_temp.day('key348-pull-v2', 0, jsonb_build_array(pg_temp.planned('34800000-0000-4000-8000-0000000001a1')), current_setting('key348.pull')),
         pg_temp.day('key348-push', 2, jsonb_build_array(pg_temp.planned('34800000-0000-4000-8000-000000000101', 3, 10, 15)), current_setting('key348.push')),
         pg_temp.day('key348-arms', 4, jsonb_build_array(pg_temp.planned()))
       )
     )::text, true) $$,
  'the routine is edited: two days swap position and weekday, one is removed and one is added'
);
select lives_ok(
  $$ set constraints all immediate; set constraints all deferred $$,
  'every deferred check passes after the edit, the day position key among them'
);
select is(current_setting('key348.plan_edit'), current_setting('key348.plan'), 'an edit returns the routine''s id');
select is(
  (select name from public.routines where id = current_setting('key348.plan')::uuid),
  'key348-a-plan-v2',
  'the routine is renamed'
);
select is(
  (select array_agg(position::text || ':' || coalesce(weekday::text, 'any') || ':' || name || ':' ||
     case id when current_setting('key348.push')::uuid then 'push-id' when current_setting('key348.pull')::uuid then 'pull-id' else 'new-id' end
     order by position)
   from public.routine_days where routine_id = current_setting('key348.plan')::uuid),
  array['0:0:key348-pull-v2:pull-id', '1:2:key348-push:push-id', '2:4:key348-arms:new-id'],
  'the kept days keep their ids, swap positions and weekdays, and the new day is added'
);
select is(
  (select count(*)::int from public.routine_days where id = current_setting('key348.legs')::uuid),
  0,
  'the day that was not sent is removed'
);
select is(
  (select array_agg(note || ':' || coalesce(case routine_day_id when current_setting('key348.push')::uuid then 'push-id' else routine_day_id::text end, 'unlinked') order by note)
   from public.workout_sessions where note in ('key348-from-push', 'key348-from-legs')),
  array['key348-from-legs:unlinked', 'key348-from-push:push-id'],
  'the removed day''s session keeps itself and loses only its link; the kept day''s session keeps its link'
);
select is(
  (select array_agg(d.name || ':' || e.position::text || ':' || e.exercise_id::text || ':' || e.target_sets::text || ':' || e.rep_min::text || '-' || e.rep_max::text order by d.position, e.position)
   from public.routine_exercises e join public.routine_days d on d.id = e.routine_day_id
   where d.routine_id = current_setting('key348.plan')::uuid),
  array[
    'key348-pull-v2:0:34800000-0000-4000-8000-0000000001a1:3:8-12',
    'key348-push:0:34800000-0000-4000-8000-000000000101:3:10-15',
    'key348-arms:0:34800000-0000-4000-8000-000000000101:3:8-12'
  ],
  'each day''s exercises are replaced as a whole'
);

-- save_routine is all or nothing. Each refused save below leaves the edited version in place.
select throws_ok(
  $$ select public.save_routine(current_setting('key348.plan')::uuid, '{"name":"key348-refused"}', jsonb_build_array(
       pg_temp.day('key348-refused', 0, jsonb_build_array(pg_temp.planned(), pg_temp.planned('34800000-0000-4000-8000-0000000001b1')), current_setting('key348.pull')))) $$,
  'P0002', 'an exercise does not exist or is not yours',
  'one of user B''s private exercises refuses the whole save'
);
select throws_ok(
  $$ select public.save_routine(current_setting('key348.plan')::uuid, '{"name":"key348-refused"}', jsonb_build_array(
       pg_temp.day('key348-refused', 0, jsonb_build_array(pg_temp.planned('34800000-0000-4000-8000-00000000dead'))))) $$,
  'P0002', 'an exercise does not exist or is not yours',
  'an exercise that does not exist fails the same way'
);
select throws_ok(
  $$ select public.save_routine(current_setting('key348.plan')::uuid, '{"name":"key348-refused"}', jsonb_build_array(
       pg_temp.day('key348-refused', 0, '[]', current_setting('key348.pull')),
       pg_temp.day('key348-refused', 1, '[]', '34800000-0000-4000-8000-0000000004b1'))) $$,
  'P0002', 'a routine day does not exist or is not in this routine',
  'a day of user B''s refuses the save after the routine row was written'
);
select throws_ok(
  $$ select public.save_routine(current_setting('key348.plan')::uuid, '{"name":"key348-refused"}', jsonb_build_array(
       pg_temp.day('key348-refused', 0, '[]', current_setting('key348.sunday')))) $$,
  'P0002', 'a routine day does not exist or is not in this routine',
  'a day of the caller''s other routine is refused the same way'
);
select throws_ok(
  $$ select public.save_routine(current_setting('key348.plan')::uuid, '{"name":"key348-refused"}', jsonb_build_array(
       pg_temp.day('key348-refused', 0, '[]', current_setting('key348.legs')))) $$,
  'P0002', 'a routine day does not exist or is not in this routine',
  'a removed day cannot be sent back by its old id'
);
select throws_ok(
  $$ select public.save_routine(current_setting('key348.plan')::uuid, '{"name":"key348-refused"}', jsonb_build_array(
       pg_temp.day('key348-refused', 0, '[]', current_setting('key348.pull')),
       pg_temp.day('key348-refused', 1, jsonb_build_array(pg_temp.planned(target_sets => 21))))) $$,
  '22023', 'target_sets must be a whole number from 1 to 20',
  'a bound broken in a later day refuses the whole save'
);
select throws_ok(
  $$ select public.save_routine(null, '{"name":"key348-refused"}', jsonb_build_array(pg_temp.day('key348-refused', 0, '[]', current_setting('key348.pull')))) $$,
  'P0002', 'a routine day does not exist or is not in this routine',
  'a new routine cannot take an existing day'
);
select throws_ok(
  $$ select public.save_routine('34800000-0000-4000-8000-0000000003b1', '{"name":"key348-refused"}', '[]') $$,
  'P0002', 'the routine does not exist or is not yours',
  'user A cannot save over user B''s routine'
);
select throws_ok(
  $$ select public.save_routine('34800000-0000-4000-8000-00000000dead', '{"name":"key348-refused"}', '[]') $$,
  'P0002', 'the routine does not exist or is not yours',
  'a routine that does not exist fails the same way'
);
select is(
  (select count(*)::int from public.routines where name = 'key348-refused')
    || '/' || (select count(*)::int from public.routine_days where name = 'key348-refused'),
  '0/0',
  'no refused save created or renamed a routine or a day'
);
select is(
  (select r.name || '/' || array_to_string(array_agg(d.id::text || ':' || d.position::text || ':' || coalesce(d.weekday::text, 'any') || ':' || d.name order by d.position), ',')
   from public.routines r join public.routine_days d on d.routine_id = r.id
   where r.id = current_setting('key348.plan')::uuid group by r.name),
  'key348-a-plan-v2/' || current_setting('key348.pull') || ':0:0:key348-pull-v2,' || current_setting('key348.push') || ':1:2:key348-push,'
    || (select id::text from public.routine_days where routine_id = current_setting('key348.plan')::uuid and name = 'key348-arms') || ':2:4:key348-arms',
  'after the refused saves the routine and its days are exactly the previous version'
);
select is(
  (select count(*)::int from public.routine_exercises e join public.routine_days d on d.id = e.routine_day_id where d.routine_id = current_setting('key348.plan')::uuid),
  3,
  'and so are its planned exercises'
);

-- The edges. Seven days on every weekday, a name of 200 characters, day names of 100, a day of 30
-- exercises at the top of every target, and a weekday sent as 6.0.
select lives_ok(
  $$ select set_config('key348.full', public.save_routine(
       null,
       jsonb_build_object('name', 'key348-' || repeat('f', 193)),
       (select jsonb_agg(
          case when weekday = 6
            then jsonb_build_object('weekday', 6.0, 'name', 'key348-' || repeat('w', 93), 'exercises', (
              select jsonb_agg(pg_temp.planned('34800000-0000-4000-8000-000000000101', 20, 100, 100, 10)) from generate_series(1, 30)))
            else pg_temp.day('key348-' || repeat('w', 93), weekday, jsonb_build_array(pg_temp.planned('34800000-0000-4000-8000-000000000101', 1, 1, 1, 0)))
          end order by weekday)
        from generate_series(0, 6) as weekday)
     )::text, true) $$,
  'seven days, 200 and 100 character names, 30 exercises on a day and every target at its edge are accepted'
);
select is(
  (select count(*)::int || '/' || array_to_string(array_agg(weekday order by position), ',') from public.routine_days where routine_id = current_setting('key348.full')::uuid)
    || '/' || (select count(*)::int from public.routine_exercises e join public.routine_days d on d.id = e.routine_day_id where d.routine_id = current_setting('key348.full')::uuid),
  '7/0,1,2,3,4,5,6/36',
  'the full routine has its seven days and 36 planned exercises'
);
select lives_ok(
  $$ select public.save_routine(current_setting('key348.full')::uuid, '{"name":"key348-emptied"}', '[]') $$,
  'a routine can be saved with no days'
);
select is(
  (select count(*)::int from public.routine_days where routine_id = current_setting('key348.full')::uuid),
  0,
  'and then has none'
);

-- Every payload refusal, with 22023 and a message that quotes no value.
select throws_ok($$ select public.save_routine(null, '[]', '[]') $$, '22023', 'save_routine needs the routine as a JSON object', 'a routine that is not an object is refused');
select throws_ok($$ select public.save_routine(null, null, '[]') $$, '22023', 'save_routine needs the routine as a JSON object', 'a missing routine is refused');
select throws_ok($$ select public.save_routine(null, '{"name":"key348-x"}', '{}') $$, '22023', 'save_routine needs the days as a JSON array', 'days that are not an array are refused');
select throws_ok($$ select public.save_routine(null, '{"name":1}', '[]') $$, '22023', 'the routine name must be text', 'a name that is not text is refused');
select throws_ok($$ select public.save_routine(null, '{}', '[]') $$, '22023', 'the routine name must be text', 'a missing name is refused');
select throws_ok($$ select public.save_routine(null, '{"name":" \t"}', '[]') $$, '22023', 'the routine name must not be blank', 'a blank name is refused');
select throws_ok(
  $$ select public.save_routine(null, jsonb_build_object('name', 'key348-' || repeat('f', 194)), '[]') $$,
  '22023', 'the routine name has at most 200 characters', 'a name of 201 characters is refused'
);
select throws_ok($$ select public.save_routine(null, '{"name":"key348-x"}', '[1]') $$, '22023', 'every day must be a JSON object', 'a day that is not an object is refused');
select throws_ok(
  $$ select public.save_routine(null, '{"name":"key348-x"}', (select jsonb_agg(pg_temp.day('key348-d', null)) from generate_series(1, 8))) $$,
  '22023', 'a routine has at most 7 days', 'eight days are refused'
);
select throws_ok(
  $$ select public.save_routine(null, '{"name":"key348-x"}', jsonb_build_array(pg_temp.day('key348-d', null, '[]', 'key348-not-a-uuid'))) $$,
  '22023', 'every day id must be a uuid or null', 'a day id that is not a uuid is refused'
);
select throws_ok(
  $$ select public.save_routine(null, '{"name":"key348-x"}', jsonb_build_array(pg_temp.day('key348-d', null) || '{"id":5}')) $$,
  '22023', 'every day id must be a uuid or null', 'a day id that is a number is refused'
);
select throws_ok(
  $$ select public.save_routine(current_setting('key348.plan')::uuid, '{"name":"key348-x"}', jsonb_build_array(
       pg_temp.day('key348-d', 0, '[]', current_setting('key348.pull')), pg_temp.day('key348-d', 1, '[]', upper(current_setting('key348.pull'))))) $$,
  '22023', 'a day is sent at most once', 'the same day sent twice is refused'
);
select throws_ok(
  $$ select public.save_routine(null, '{"name":"key348-x"}', jsonb_build_array(pg_temp.day('key348-d', null) || '{"weekday":"1"}')) $$,
  '22023', 'every weekday must be a number or null', 'a weekday that is text is refused'
);
select throws_ok(
  $$ select public.save_routine(null, '{"name":"key348-x"}', jsonb_build_array(pg_temp.day('key348-d', 7))) $$,
  '22023', 'every weekday must be a whole number from 0 to 6', 'weekday 7 is refused'
);
select throws_ok(
  $$ select public.save_routine(null, '{"name":"key348-x"}', jsonb_build_array(pg_temp.day('key348-d', -1))) $$,
  '22023', 'every weekday must be a whole number from 0 to 6', 'weekday -1 is refused'
);
select throws_ok(
  $$ select public.save_routine(null, '{"name":"key348-x"}', jsonb_build_array(pg_temp.day('key348-d', null) || '{"weekday":1.5}')) $$,
  '22023', 'every weekday must be a whole number from 0 to 6', 'a weekday that is not whole is refused'
);
select throws_ok(
  $$ select public.save_routine(null, '{"name":"key348-x"}', jsonb_build_array(pg_temp.day('key348-d', 3), pg_temp.day('key348-e', 3))) $$,
  '22023', 'a routine has at most one day per weekday', 'two days on one weekday are refused'
);
select throws_ok(
  $$ select public.save_routine(null, '{"name":"key348-x"}', jsonb_build_array(pg_temp.day('key348-d', null) - 'name')) $$,
  '22023', 'every day name must be text', 'a day with no name is refused'
);
select throws_ok(
  $$ select public.save_routine(null, '{"name":"key348-x"}', jsonb_build_array(pg_temp.day(' ', null))) $$,
  '22023', 'a day name must not be blank', 'a blank day name is refused'
);
select throws_ok(
  $$ select public.save_routine(null, '{"name":"key348-x"}', jsonb_build_array(pg_temp.day('key348-' || repeat('w', 94), null))) $$,
  '22023', 'a day name has at most 100 characters', 'a day name of 101 characters is refused'
);
select throws_ok(
  $$ select public.save_routine(null, '{"name":"key348-x"}', jsonb_build_array(pg_temp.day('key348-d', null) - 'exercises')) $$,
  '22023', 'every day needs its exercises as a JSON array', 'a day with no exercises array is refused'
);
select throws_ok(
  $$ select public.save_routine(null, '{"name":"key348-x"}', jsonb_build_array(pg_temp.day('key348-d', null, (select jsonb_agg(pg_temp.planned()) from generate_series(1, 31))))) $$,
  '22023', 'a routine day has at most 30 exercises', '31 exercises on a day are refused'
);
select throws_ok(
  $$ select public.save_routine(null, '{"name":"key348-x"}', jsonb_build_array(pg_temp.day('key348-d', null, '["key348"]'))) $$,
  '22023', 'every planned exercise must be a JSON object', 'a planned exercise that is not an object is refused'
);
select throws_ok(
  $$ select public.save_routine(null, '{"name":"key348-x"}', jsonb_build_array(pg_temp.day('key348-d', null, jsonb_build_array(pg_temp.planned('key348-not-a-uuid'))))) $$,
  '22023', 'every exercise id must be a uuid', 'an exercise id that is not a uuid is refused'
);
select throws_ok(
  $$ select public.save_routine(null, '{"name":"key348-x"}', jsonb_build_array(pg_temp.day('key348-d', null, jsonb_build_array(pg_temp.planned() - 'exercise_id')))) $$,
  '22023', 'every exercise id must be a uuid', 'a planned exercise with no exercise id is refused'
);
select throws_ok(
  $$ select public.save_routine(null, '{"name":"key348-x"}', jsonb_build_array(pg_temp.day('key348-d', null, jsonb_build_array(pg_temp.planned() || '{"target_sets":"3"}')))) $$,
  '22023', 'the targets of every planned exercise must be numbers, and target_rir may be null', 'target_sets as text is refused'
);
select throws_ok(
  $$ select public.save_routine(null, '{"name":"key348-x"}', jsonb_build_array(pg_temp.day('key348-d', null, jsonb_build_array(pg_temp.planned() - 'rep_max')))) $$,
  '22023', 'the targets of every planned exercise must be numbers, and target_rir may be null', 'a missing rep_max is refused'
);
select throws_ok(
  $$ select public.save_routine(null, '{"name":"key348-x"}', jsonb_build_array(pg_temp.day('key348-d', null, jsonb_build_array(pg_temp.planned() || '{"target_rir":"2"}')))) $$,
  '22023', 'the targets of every planned exercise must be numbers, and target_rir may be null', 'target_rir as text is refused'
);
select throws_ok(
  $$ select public.save_routine(null, '{"name":"key348-x"}', jsonb_build_array(pg_temp.day('key348-d', null, jsonb_build_array(pg_temp.planned(target_sets => 0))))) $$,
  '22023', 'target_sets must be a whole number from 1 to 20', '0 target sets are refused'
);
select throws_ok(
  $$ select public.save_routine(null, '{"name":"key348-x"}', jsonb_build_array(pg_temp.day('key348-d', null, jsonb_build_array(pg_temp.planned(target_sets => 21))))) $$,
  '22023', 'target_sets must be a whole number from 1 to 20', '21 target sets are refused'
);
select throws_ok(
  $$ select public.save_routine(null, '{"name":"key348-x"}', jsonb_build_array(pg_temp.day('key348-d', null, jsonb_build_array(pg_temp.planned(target_sets => 2.5))))) $$,
  '22023', 'target_sets must be a whole number from 1 to 20', 'target sets that are not whole are refused'
);
select throws_ok(
  $$ select public.save_routine(null, '{"name":"key348-x"}', jsonb_build_array(pg_temp.day('key348-d', null, jsonb_build_array(pg_temp.planned(rep_min => 0))))) $$,
  '22023', 'rep_min and rep_max must be whole numbers from 1 to 100', 'a rep_min of 0 is refused'
);
select throws_ok(
  $$ select public.save_routine(null, '{"name":"key348-x"}', jsonb_build_array(pg_temp.day('key348-d', null, jsonb_build_array(pg_temp.planned(rep_max => 101))))) $$,
  '22023', 'rep_min and rep_max must be whole numbers from 1 to 100', 'a rep_max of 101 is refused'
);
select throws_ok(
  $$ select public.save_routine(null, '{"name":"key348-x"}', jsonb_build_array(pg_temp.day('key348-d', null, jsonb_build_array(pg_temp.planned(rep_min => 8.5))))) $$,
  '22023', 'rep_min and rep_max must be whole numbers from 1 to 100', 'a rep target that is not whole is refused'
);
select throws_ok(
  $$ select public.save_routine(null, '{"name":"key348-x"}', jsonb_build_array(pg_temp.day('key348-d', null, jsonb_build_array(pg_temp.planned(rep_min => 12, rep_max => 8))))) $$,
  '22023', 'rep_min cannot be above rep_max', 'a rep_min above rep_max is refused'
);
select throws_ok(
  $$ select public.save_routine(null, '{"name":"key348-x"}', jsonb_build_array(pg_temp.day('key348-d', null, jsonb_build_array(pg_temp.planned(target_rir => -1))))) $$,
  '22023', 'target_rir must be a whole number from 0 to 10, or null', 'a target RIR of -1 is refused'
);
select throws_ok(
  $$ select public.save_routine(null, '{"name":"key348-x"}', jsonb_build_array(pg_temp.day('key348-d', null, jsonb_build_array(pg_temp.planned(target_rir => 11))))) $$,
  '22023', 'target_rir must be a whole number from 0 to 10, or null', 'a target RIR of 11 is refused'
);
select throws_ok(
  $$ select public.save_routine(null, '{"name":"key348-x"}', jsonb_build_array(pg_temp.day('key348-d', null, jsonb_build_array(pg_temp.planned(target_rir => 1.5))))) $$,
  '22023', 'target_rir must be a whole number from 0 to 10, or null', 'a target RIR that is not whole is refused'
);
select is(
  (select count(*)::int from public.routines where name = 'key348-x'),
  0,
  'no refused payload created a routine'
);

-- set_active_routine as user A.
select lives_ok($$ select public.set_active_routine(current_setting('key348.plan')::uuid) $$, 'user A makes a routine active');
select is(
  (select array_agg(id::text) from public.routines where is_active),
  array[current_setting('key348.plan')],
  'it is A''s only active routine'
);
select lives_ok(
  $$ select set_config('key348.second', public.save_routine(null, '{"name":"key348-a-second"}', jsonb_build_array(pg_temp.day('key348-solo', 1, jsonb_build_array(pg_temp.planned()))))::text, true) $$,
  'user A saves a second routine'
);
select throws_ok(
  $$ update public.routines set is_active = true where id = current_setting('key348.second')::uuid $$,
  '23505', 'duplicate key value violates unique constraint "routines_one_active_per_user"',
  'a second active routine is refused'
);
select lives_ok($$ select public.set_active_routine(current_setting('key348.second')::uuid) $$, 'user A switches the active routine');
select is(
  (select array_agg(id::text) from public.routines where is_active),
  array[current_setting('key348.second')],
  'the switch cleared the old active routine and set the new one'
);
select lives_ok($$ select public.set_active_routine(current_setting('key348.second')::uuid) $$, 'making the active routine active again changes nothing');
select is(
  (select array_agg(id::text) from public.routines where is_active),
  array[current_setting('key348.second')],
  'it is still the only active routine'
);
select lives_ok($$ select public.set_active_routine(null) $$, 'a null routine clears the active one');
select is((select count(*)::int from public.routines where is_active), 0, 'user A has no active routine');
select throws_ok(
  $$ select public.set_active_routine(current_setting('key348.direct')::uuid) $$,
  '22023', 'an archived routine cannot be active',
  'an archived routine cannot be made active'
);
select throws_ok(
  $$ select public.set_active_routine('34800000-0000-4000-8000-0000000003b1') $$,
  'P0002', 'the routine does not exist or is not yours',
  'user A cannot make user B''s routine active'
);
select throws_ok(
  $$ select public.set_active_routine('34800000-0000-4000-8000-00000000dead') $$,
  'P0002', 'the routine does not exist or is not yours',
  'a routine that does not exist fails the same way'
);
select lives_ok($$ select public.set_active_routine(current_setting('key348.plan')::uuid) $$, 'user A makes the first routine active again');

-- save_training_goals as user A. A's current row is 30 days old. Keys it does not know are
-- ignored, so the new row belongs to the caller, takes the database's time and is current.
select lives_ok(
  $$ select set_config('key348.goals_1', public.save_training_goals(
       pg_temp.goals() || '{"days_per_week":1,"session_minutes":15,"id":"34800000-0000-4000-8000-0000000008ee","user_id":"34800000-0000-4000-8000-00000000000b","effective_from":"2020-01-01T00:00:00Z","effective_to":"2030-01-01T00:00:00Z"}'
     )::text, true) $$,
  'user A saves new goals, at 1 day a week and 15 minutes'
);
select is(
  (select array_agg(
     case id when '34800000-0000-4000-8000-0000000008a1' then 'previous' when current_setting('key348.goals_1')::uuid then 'new' else id::text end
     || ':' || (effective_from = now())::text || ':' || coalesce((effective_to = now())::text, 'current')
     order by effective_from)
   from public.training_goals where user_id = '34800000-0000-4000-8000-00000000000a'),
  array['previous:false:true', 'new:true:current'],
  'the previous row is closed when the new one starts, and the new one is the only current row'
);
select is(
  (select user_id::text || '/' || goal::text || '/' || focus::text || '/' || days_per_week::text || '/' || session_minutes::text || '/' || equipment::text || '/' || experience::text || '/' || muscle_priority::text || '/' || params_version || '/' || (id <> '34800000-0000-4000-8000-0000000008ee')::text
   from public.training_goals where id = current_setting('key348.goals_1')::uuid),
  '34800000-0000-4000-8000-00000000000a/hybrid/{chest,arms}/1/15/{barbell,dumbbell}/intermediate/{"biceps": 1, "chest_upper": 1.5}/key348-params-2/true',
  'the new row holds the answers, belongs to the caller and has the database''s id'
);
select throws_ok(
  $$ select public.save_training_goals(pg_temp.goals()) $$,
  '40001', 'the current training goals are newer than this save, so it must be retried',
  'a second save in the same transaction is refused, because it would end the current row when it starts'
);

-- Every payload refusal, with 22023 and a message that quotes no value.
select throws_ok($$ select public.save_training_goals('[]') $$, '22023', 'save_training_goals needs the goals as a JSON object', 'goals that are not an object are refused');
select throws_ok($$ select public.save_training_goals(null) $$, '22023', 'save_training_goals needs the goals as a JSON object', 'missing goals are refused');
select throws_ok($$ select public.save_training_goals(pg_temp.goals() || '{"goal":"key348"}') $$, '22023', 'the goal must be aesthetic, strength or hybrid', 'a goal off the list is refused');
select throws_ok($$ select public.save_training_goals(pg_temp.goals() - 'goal') $$, '22023', 'the goal must be aesthetic, strength or hybrid', 'a missing goal is refused');
select throws_ok($$ select public.save_training_goals(pg_temp.goals() || '{"focus":"chest"}') $$, '22023', 'the focus must be a JSON array', 'a focus that is not an array is refused');
select throws_ok($$ select public.save_training_goals(pg_temp.goals() - 'focus') $$, '22023', 'the focus must be a JSON array', 'a missing focus is refused');
select throws_ok($$ select public.save_training_goals(pg_temp.goals() || '{"focus":["key348"]}') $$, '22023', 'the focus must be values of the focus list, each at most once', 'a focus off the list is refused');
select throws_ok($$ select public.save_training_goals(pg_temp.goals() || '{"focus":["legs","legs"]}') $$, '22023', 'the focus must be values of the focus list, each at most once', 'a repeated focus is refused');
select throws_ok($$ select public.save_training_goals(pg_temp.goals() || '{"focus":[1]}') $$, '22023', 'the focus must be values of the focus list, each at most once', 'a focus that is not text is refused');
select throws_ok($$ select public.save_training_goals(pg_temp.goals() || '{"focus":[null]}') $$, '22023', 'the focus must be values of the focus list, each at most once', 'a null focus is refused');
select throws_ok($$ select public.save_training_goals(pg_temp.goals() || '{"days_per_week":"4"}') $$, '22023', 'days_per_week must be a number', 'days_per_week as text is refused');
select throws_ok($$ select public.save_training_goals(pg_temp.goals() || '{"days_per_week":0}') $$, '22023', 'days_per_week must be a whole number from 1 to 7', '0 days a week are refused');
select throws_ok($$ select public.save_training_goals(pg_temp.goals() || '{"days_per_week":8}') $$, '22023', 'days_per_week must be a whole number from 1 to 7', '8 days a week are refused');
select throws_ok($$ select public.save_training_goals(pg_temp.goals() || '{"days_per_week":2.5}') $$, '22023', 'days_per_week must be a whole number from 1 to 7', 'days a week that are not whole are refused');
select throws_ok($$ select public.save_training_goals(pg_temp.goals() - 'session_minutes') $$, '22023', 'session_minutes must be a number', 'missing session_minutes are refused');
select throws_ok($$ select public.save_training_goals(pg_temp.goals() || '{"session_minutes":14}') $$, '22023', 'session_minutes must be a whole number from 15 to 180', '14 minutes are refused');
select throws_ok($$ select public.save_training_goals(pg_temp.goals() || '{"session_minutes":181}') $$, '22023', 'session_minutes must be a whole number from 15 to 180', '181 minutes are refused');
select throws_ok($$ select public.save_training_goals(pg_temp.goals() || '{"session_minutes":45.5}') $$, '22023', 'session_minutes must be a whole number from 15 to 180', 'minutes that are not whole are refused');
select throws_ok($$ select public.save_training_goals(pg_temp.goals() || '{"equipment":"barbell"}') $$, '22023', 'the equipment must be a JSON array', 'equipment that is not an array is refused');
select throws_ok($$ select public.save_training_goals(pg_temp.goals() || '{"equipment":["key348"]}') $$, '22023', 'every equipment must be one of the equipment list', 'equipment off the list is refused');
select throws_ok($$ select public.save_training_goals(pg_temp.goals() || '{"equipment":[null]}') $$, '22023', 'every equipment must be one of the equipment list', 'a null equipment is refused');
select throws_ok($$ select public.save_training_goals(pg_temp.goals() || '{"experience":"expert"}') $$, '22023', 'the experience must be beginner, intermediate or advanced', 'an experience off the list is refused');
select throws_ok($$ select public.save_training_goals(pg_temp.goals() || '{"muscle_priority":[]}') $$, '22023', 'the muscle priority must be a JSON object', 'a muscle priority that is not an object is refused');
select throws_ok($$ select public.save_training_goals(pg_temp.goals() || '{"muscle_priority":{"key348":1}}') $$, '22023', 'every muscle priority must name a muscle of the muscle list', 'a priority for a muscle off the list is refused');
select throws_ok($$ select public.save_training_goals(pg_temp.goals() || '{"muscle_priority":{"quads":"high"}}') $$, '22023', 'every muscle priority must be a number', 'a priority that is not a number is refused');
select throws_ok($$ select public.save_training_goals(pg_temp.goals() || '{"params_version":""}') $$, '22023', 'the params version must be non-empty text', 'an empty params version is refused');
select throws_ok($$ select public.save_training_goals(pg_temp.goals() || '{"params_version":2}') $$, '22023', 'the params version must be non-empty text', 'a params version that is not text is refused');
select is(
  (select count(*)::int || '/' || count(*) filter (where effective_to is null)::int from public.training_goals where user_id = '34800000-0000-4000-8000-00000000000a'),
  '2/1',
  'no refused save wrote a goals row'
);

reset role;

-- A later request. Postgres moves A's history back a day, as if the first save had been made
-- yesterday, so the next save starts after it.
update public.training_goals set effective_from = now() - interval '30 days', effective_to = now() - interval '1 day'
where id = '34800000-0000-4000-8000-0000000008a1';
update public.training_goals set effective_from = now() - interval '1 day'
where id = current_setting('key348.goals_1')::uuid;

set local role authenticated;
set local request.jwt.claims = '{"sub":"34800000-0000-4000-8000-00000000000a","role":"authenticated"}';

select lives_ok(
  $$ select set_config('key348.goals_2', public.save_training_goals(
       pg_temp.goals() || '{"focus":[],"equipment":[],"days_per_week":7,"session_minutes":180,"muscle_priority":{},"goal":"strength"}'
     )::text, true) $$,
  'user A saves goals again, with no focus or equipment, 7 days a week and 180 minutes'
);
select is(
  (select array_agg(
     case id when '34800000-0000-4000-8000-0000000008a1' then 'first' when current_setting('key348.goals_1')::uuid then 'second' when current_setting('key348.goals_2')::uuid then 'third' else id::text end
     || ':' || coalesce((effective_to = now())::text, 'current')
     order by effective_from)
   from public.training_goals where user_id = '34800000-0000-4000-8000-00000000000a'),
  array['first:false', 'second:true', 'third:current'],
  'the history keeps every row, the last save closed the previous one, and exactly one row is current'
);
select is(
  (select goal::text || '/' || focus::text || '/' || equipment::text || '/' || days_per_week::text || '/' || session_minutes::text || '/' || muscle_priority::text
   from public.training_goals where id = current_setting('key348.goals_2')::uuid),
  'strength/{}/{}/7/180/{}',
  'the current row holds the latest answers'
);

reset role;

-- User B: the other direction. B sees none of A's rows and cannot change them through any function.
set local role authenticated;
set local request.jwt.claims = '{"sub":"34800000-0000-4000-8000-00000000000b","role":"authenticated"}';

select is(
  (select count(*)::int from public.routines where user_id <> '34800000-0000-4000-8000-00000000000b')
    || '/' || (select count(*)::int from public.routine_days where user_id <> '34800000-0000-4000-8000-00000000000b')
    || '/' || (select count(*)::int from public.routine_exercises where user_id <> '34800000-0000-4000-8000-00000000000b')
    || '/' || (select count(*)::int from public.workout_sessions where user_id <> '34800000-0000-4000-8000-00000000000b')
    || '/' || (select count(*)::int from public.workout_sets where user_id <> '34800000-0000-4000-8000-00000000000b')
    || '/' || (select count(*)::int from public.training_goals where user_id <> '34800000-0000-4000-8000-00000000000b'),
  '0/0/0/0/0/0',
  'user B sees none of user A''s or user C''s routines, days, planned exercises, sessions, sets or goals'
);
select is(
  (select count(*)::int from public.routines where id = current_setting('key348.plan')::uuid)
    || '/' || (select count(*)::int from public.routine_days where id = current_setting('key348.push')::uuid)
    || '/' || (select count(*)::int from public.workout_sessions where id = '34800000-0000-4000-8000-0000000006a1')
    || '/' || (select count(*)::int from public.workout_sets where session_id = '34800000-0000-4000-8000-0000000006a1')
    || '/' || (select count(*)::int from public.training_goals where id = current_setting('key348.goals_2')::uuid),
  '0/0/0/0/0',
  'user B cannot read A''s rows even by id'
);
select is(
  (select count(*)::int from public.workout_sets where id = '34800000-0000-4000-8000-0000000007b1')
    || '/' || (select count(*)::int from public.routines where id = '34800000-0000-4000-8000-0000000003b1'),
  '1/1',
  'user B sees their own set and routine'
);
select throws_ok(
  $$ select public.save_routine(current_setting('key348.plan')::uuid, '{"name":"key348-taken-over"}', '[]') $$,
  'P0002', 'the routine does not exist or is not yours',
  'user B cannot save over user A''s routine'
);
select throws_ok(
  $$ select public.save_routine('34800000-0000-4000-8000-0000000003b1', '{"name":"key348-taken-over"}', jsonb_build_array(
       pg_temp.day('key348-b-day', 0, jsonb_build_array(pg_temp.planned('34800000-0000-4000-8000-0000000001a1')), '34800000-0000-4000-8000-0000000004b1'))) $$,
  'P0002', 'an exercise does not exist or is not yours',
  'user B cannot plan user A''s private exercise'
);
select throws_ok(
  $$ select public.save_routine('34800000-0000-4000-8000-0000000003b1', '{"name":"key348-taken-over"}', jsonb_build_array(
       pg_temp.day('key348-b-day', 0, '[]', current_setting('key348.push')))) $$,
  'P0002', 'a routine day does not exist or is not in this routine',
  'user B cannot take user A''s day into their routine'
);
select throws_ok(
  $$ select public.set_active_routine(current_setting('key348.plan')::uuid) $$,
  'P0002', 'the routine does not exist or is not yours',
  'user B cannot make user A''s routine active'
);
select lives_ok(
  $$ select public.set_active_routine(null) $$,
  'user B clears their own active routine'
);
select lives_ok(
  $$ select public.save_training_goals(pg_temp.goals()) $$,
  'user B saves their own goals'
);
select is(
  (select count(*)::int || '/' || count(*) filter (where effective_to is null)::int from public.training_goals),
  '2/1',
  'user B''s save closed and replaced only their own goals'
);

reset role;

select is(
  (select count(*)::int || '/' || count(*) filter (where effective_to is null)::int from public.training_goals where user_id = '34800000-0000-4000-8000-00000000000a')
    || '/' || (select is_active::text from public.routines where id = current_setting('key348.plan')::uuid)
    || '/' || (select is_active::text from public.routines where id = '34800000-0000-4000-8000-0000000003b1'),
  '3/1/true/false',
  'user B''s calls left A''s goals and active routine alone, and cleared only B''s'
);
select is(
  (select array_agg(exercise_id::text) from public.routine_exercises where routine_day_id = '34800000-0000-4000-8000-0000000004b1')
    || array[(select name from public.routines where id = '34800000-0000-4000-8000-0000000003b1')],
  array['34800000-0000-4000-8000-0000000001b1', 'key348-b-plan'],
  'the routine_id and routine_day_id sent by A were ignored and the refused saves left B''s plan as it was'
);

-- Account deletion. User C has a custom exercise, a routine with a day and planned exercises (one on
-- the custom exercise), a session from that day with sets (one on the custom exercise) and a closed
-- and a current goals row. Deleting the auth user removes all of it in one statement, the `no
-- action` checks of the sets and planned exercises on the custom exercise pass because the same
-- statement removes both sides, and the pending deferred checks then pass too.
select lives_ok(
  $$ delete from auth.users where id = '34800000-0000-4000-8000-00000000000c' $$,
  'deleting an auth user with sessions, sets, routines, goals and a custom exercise succeeds'
);
select lives_ok(
  $$ set constraints all immediate $$,
  'every deferred check passes after the deletion'
);
select is(
  (select count(*)::int from public.workout_sessions where user_id = '34800000-0000-4000-8000-00000000000c')
    || '/' || (select count(*)::int from public.workout_sets where user_id = '34800000-0000-4000-8000-00000000000c')
    || '/' || (select count(*)::int from public.routines where user_id = '34800000-0000-4000-8000-00000000000c')
    || '/' || (select count(*)::int from public.routine_days where user_id = '34800000-0000-4000-8000-00000000000c')
    || '/' || (select count(*)::int from public.routine_exercises where user_id = '34800000-0000-4000-8000-00000000000c')
    || '/' || (select count(*)::int from public.training_goals where user_id = '34800000-0000-4000-8000-00000000000c')
    || '/' || (select count(*)::int from public.exercises where owner_id = '34800000-0000-4000-8000-00000000000c')
    || '/' || (select count(*)::int from public.exercise_muscles where owner_id = '34800000-0000-4000-8000-00000000000c'),
  '0/0/0/0/0/0/0/0',
  'none of the deleted user''s sessions, sets, routines, days, planned exercises, goals, exercises or maps remain'
);
select is(
  (select count(*)::int from public.workout_sessions where id = '34800000-0000-4000-8000-0000000006c1')
    + (select count(*)::int from public.workout_sets where id in ('34800000-0000-4000-8000-0000000007c1', '34800000-0000-4000-8000-0000000007c2'))
    + (select count(*)::int from public.routines where id = '34800000-0000-4000-8000-0000000003c1')
    + (select count(*)::int from public.routine_days where id = '34800000-0000-4000-8000-0000000004c1')
    + (select count(*)::int from public.routine_exercises where id in ('34800000-0000-4000-8000-0000000005c1', '34800000-0000-4000-8000-0000000005c2'))
    + (select count(*)::int from public.training_goals where id in ('34800000-0000-4000-8000-0000000008c1', '34800000-0000-4000-8000-0000000008c2'))
    + (select count(*)::int from public.exercises where id = '34800000-0000-4000-8000-0000000001c1'),
  0,
  'none of the deleted user''s fixture rows remain by id'
);
select is(
  (select count(*)::int from public.exercises where id = '34800000-0000-4000-8000-000000000101')
    || '/' || (select count(*)::int from public.exercise_muscles where exercise_id = '34800000-0000-4000-8000-000000000101')
    || '/' || ((select count(*)::int from public.workout_sets where exercise_id = '34800000-0000-4000-8000-000000000101' and user_id = '34800000-0000-4000-8000-00000000000a' and deleted_at is null) > 0)::text
    || '/' || (select count(*)::int from public.workout_sets where id = '34800000-0000-4000-8000-0000000007b1')
    || '/' || ((select count(*)::int from public.routines where user_id in ('34800000-0000-4000-8000-00000000000a', '34800000-0000-4000-8000-00000000000b')) > 0)::text,
  '1/1/true/1/true',
  'the global exercise and its map, and the other users'' sets and routines, stay'
);


select * from finish();

rollback;
