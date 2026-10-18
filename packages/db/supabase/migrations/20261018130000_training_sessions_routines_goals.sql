-- training sessions, routines and goals: the second of the two T1 training migrations (KEY-348). It
-- adds the remaining training enums, `routines`, `routine_days` and `routine_exercises`,
-- `workout_sessions` and `workout_sets`, `training_goals`, and the functions `save_routine`,
-- `set_active_routine` and `save_training_goals`. Everything here is set out in
-- docs/adr/0005-training-v1.md, Amendment 1, which wins over any other description. The bounds are
-- the table in its "The numbers". KEY-347 added the exercise library these tables refer to.
--
-- Every table here is health data under the project's Working conventions, because a training log,
-- a plan and a goal reveal how a person trains. Nothing here logs a row value, and no function raises
-- a notice or an error that quotes a name, a load, a rep count, an effort value or a goal answer.
-- The functions check every typed field before writing, so a payload never reaches a table error,
-- whose detail can carry the failing row.
--
-- The migration is additive. It touches no table, type or function that existed before it.

-- The enums of sessions and goals. The values are Amendment 1's "Enums", in its order, which core's
-- SET_TYPES, TRAINING_GOALS and EXPERIENCE_LEVELS repeat.
create type public.set_type as enum ('warmup', 'working', 'drop', 'failure');
create type public.training_goal as enum ('aesthetic', 'strength', 'hybrid');
create type public.experience_level as enum ('beginner', 'intermediate', 'advanced');

-- A routine belongs to its user and is archived, never deleted, as a recipe is. A user has at most
-- one active routine, and an archived routine is never the active one. Switching the active routine
-- goes through `set_active_routine`, which clears the old one before it sets the new one.
create table public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  is_active boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),

  constraint routines_name_not_blank check (name ~ '\S'),
  constraint routines_name_length_check check (pg_catalog.char_length(name) <= 200),
  constraint routines_active_not_archived check (not (is_active and is_archived))
);

-- At most one active routine per user. Most routines are not active, so the index is partial.
create unique index routines_one_active_per_user on public.routines (user_id) where is_active;

-- The library of a user's routines, and the cascade from `auth.users`, which Postgres does not index
-- on the referencing side. The partial index above covers only active rows, so it serves neither.
create index routines_user_id_idx on public.routines (user_id);

-- One planned day of a routine. Days keep their ids across edits (`save_routine` updates a day in
-- place), so a logged session's link to its planned day survives an edit of the routine. `user_id`
-- is a copy of the routine's for row level security. A null weekday means any day.
create table public.routine_days (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  position integer not null,
  weekday smallint,
  name text not null,
  created_at timestamptz not null default now(),

  -- Deferred, so a reorder can swap two positions in one save. The index also serves the days of a
  -- routine in order and the cascade from `routines`.
  constraint routine_days_routine_id_position_key unique (routine_id, position)
    deferrable initially deferred,
  constraint routine_days_position_check check (position >= 0),
  -- 0 is Monday and 6 is Sunday, the numbering core's calendarDay uses.
  constraint routine_days_weekday_check check (weekday >= 0 and weekday <= 6),
  constraint routine_days_name_not_blank check (name ~ '\S'),
  constraint routine_days_name_length_check check (pg_catalog.char_length(name) <= 100)
);

-- At most one day per weekday in a routine. A partial index cannot be deferred, so `save_routine`
-- clears the weekday of every day it is about to move before it sets the new ones, and two days can
-- swap weekdays in one save.
create unique index routine_days_routine_id_weekday_key
  on public.routine_days (routine_id, weekday)
  where weekday is not null;

-- The cascade from `auth.users`.
create index routine_days_user_id_idx on public.routine_days (user_id);

-- The plan for one exercise on one routine day. A day's exercises are replaced as a whole on every
-- save, because nothing refers to them. `exercise_id` keeps the default `no action`: exercises are
-- soft deleted, so it never blocks a normal edit, and an account deletion removes the user's routine
-- exercises and custom exercises in the same statement, which `no action` allows.
create table public.routine_exercises (
  id uuid primary key default gen_random_uuid(),
  routine_day_id uuid not null references public.routine_days (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  position integer not null,
  exercise_id uuid not null references public.exercises (id),
  target_sets smallint not null,
  rep_min smallint not null,
  rep_max smallint not null,
  target_rir smallint,
  created_at timestamptz not null default now(),

  -- The index also serves the exercises of a day in order and the cascade from `routine_days`.
  unique (routine_day_id, position),
  constraint routine_exercises_position_check check (position >= 0),
  constraint routine_exercises_target_sets_check check (target_sets >= 1 and target_sets <= 20),
  constraint routine_exercises_rep_min_check check (rep_min >= 1 and rep_min <= 100),
  constraint routine_exercises_rep_max_check check (rep_max >= 1 and rep_max <= 100),
  constraint routine_exercises_rep_range_check check (rep_min <= rep_max),
  constraint routine_exercises_target_rir_check check (target_rir >= 0 and target_rir <= 10)
);

-- The foreign key check on `exercises` and the cascade from `auth.users`.
create index routine_exercises_exercise_id_idx on public.routine_exercises (exercise_id);
create index routine_exercises_user_id_idx on public.routine_exercises (user_id);

-- One workout. `local_date` is the user's calendar day of `started_at`, computed in `tz`, as
-- `food_log_entries.local_date` is. `routine_day_id` is set when the session was started from a
-- planned day, and is cleared only when the user removes that day from the routine. Sessions are soft
-- deleted, so a mistaken delete can be undone like a diary entry.
create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  started_at timestamptz not null,
  -- Null while the session is in progress.
  ended_at timestamptz,
  local_date date not null,
  tz text not null,
  routine_day_id uuid references public.routine_days (id) on delete set null,
  note text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),

  constraint workout_sessions_ended_after_started check (ended_at >= started_at),
  constraint workout_sessions_tz_not_blank check (tz ~ '\S'),
  constraint workout_sessions_tz_length_check check (pg_catalog.char_length(tz) <= 64),
  constraint workout_sessions_note_length_check check (pg_catalog.char_length(note) <= 1000)
);

-- History and the week view read a user's sessions by day. The index also serves the cascade from
-- `auth.users`.
create index workout_sessions_user_id_local_date_idx on public.workout_sessions (user_id, local_date);

-- The set null when a routine day is removed, which looks up `routine_day_id = $1`.
create index workout_sessions_routine_day_id_idx on public.workout_sessions (routine_day_id);

-- One logged set. `user_id` is a copy of the session's for row level security and for the heat window
-- index. The snapshot freezes the exercise as it was when the set was logged (Amendment 1, "The set
-- snapshot"), so editing an exercise's muscles never rewrites past heat, and the set survives the
-- exercise's soft delete. `exercise_id` keeps `no action`, for the reason `routine_exercises` gives.
--
-- `position` has no uniqueness rule. Sets are read in position, then performed_at, then id order, so
-- a tie is harmless and a reorder is a plain update of two rows with nothing to collide. A session
-- holds at most 200 live sets: the clients enforce it through core, and the database does not count.
create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id),
  position integer not null,
  set_type public.set_type not null default 'working',
  reps integer not null,
  -- Stored in kg whatever the profile's unit. Null for an unloaded bodyweight set.
  load_kg numeric,
  rir smallint,
  rpe numeric,
  performed_at timestamptz not null default now(),
  snapshot jsonb not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),

  constraint workout_sets_position_check check (position >= 0),
  constraint workout_sets_reps_check check (reps >= 1 and reps <= 100),
  constraint workout_sets_load_kg_check check (load_kg >= 0 and load_kg <= 1000),
  constraint workout_sets_rir_check check (rir >= 0 and rir <= 10),
  -- 1 to 10 in steps of 0.5.
  constraint workout_sets_rpe_check check (rpe >= 1 and rpe <= 10 and rpe * 2 = pg_catalog.floor(rpe * 2)),
  -- At most one effort measure per set.
  constraint workout_sets_one_effort_measure check (not (rir is not null and rpe is not null)),
  -- Core owns the shape and its version (SET_SNAPSHOT_VERSION). The database only holds it to being
  -- an object that names its version, so a reader can always tell the shape apart.
  constraint workout_sets_snapshot_is_versioned_object check (
    pg_catalog.jsonb_typeof(snapshot) = 'object' and (snapshot ->> 'version') is not null
  )
);

-- The 14-day heat window (T3) reads a user's sets by time. The index also serves the cascade from
-- `auth.users`.
create index workout_sets_user_id_performed_at_idx on public.workout_sets (user_id, performed_at);

-- The foreign key check on `exercises`.
create index workout_sets_exercise_id_idx on public.workout_sets (exercise_id);

-- A session's sets in order, and the cascade from `workout_sessions`. Not unique (see above).
create index workout_sets_session_id_position_idx on public.workout_sets (session_id, position);

-- A focus list holds values of "The numbers" focus list, each at most once, in a one dimensional
-- array. A `check` cannot hold a subquery, so the rule is this immutable function. A check runs it as
-- whoever writes the row, so `authenticated` must hold execute. It is pure, and nobody else has a
-- reason to call it, so its execute is granted to `authenticated` alone, as
-- `recipe_instructions_are_valid`'s is.
create function public.training_focus_is_valid(focus text[])
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select
    focus is not null
    and coalesce(pg_catalog.array_ndims(focus) = 1, true)
    and not exists (
      select 1
      from pg_catalog.unnest(focus) as value
      where value is null
        or not (value = any (array['v_taper', 'chest', 'arms', 'glutes', 'legs', 'overall']))
    )
    and (select pg_catalog.count(distinct value) from pg_catalog.unnest(focus) as value)
      = pg_catalog.cardinality(focus)
$$;

revoke execute on function public.training_focus_is_valid(text[]) from public, anon, service_role;
grant execute on function public.training_focus_is_valid(text[]) to authenticated;

-- A user's training goals, with their history kept the way `targets` keeps it: a new answer closes
-- the current row (sets `effective_to`) and inserts the next, through `save_training_goals`.
-- `muscle_priority` maps muscle ids to a priority number, derived in core from the answers with the
-- `TrainingParams` version named in `params_version`, so a retune never rewrites past rows.
create table public.training_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal public.training_goal not null,
  focus text[] not null default '{}',
  days_per_week smallint not null,
  session_minutes smallint not null,
  equipment public.equipment[] not null default '{}',
  experience public.experience_level not null,
  muscle_priority jsonb not null,
  params_version text not null,
  effective_from timestamptz not null default now(),
  -- Null means current.
  effective_to timestamptz,
  created_at timestamptz not null default now(),

  constraint training_goals_focus_check check (public.training_focus_is_valid(focus)),
  constraint training_goals_days_per_week_check check (days_per_week >= 1 and days_per_week <= 7),
  constraint training_goals_session_minutes_check check (session_minutes >= 15 and session_minutes <= 180),
  constraint training_goals_muscle_priority_is_object check (pg_catalog.jsonb_typeof(muscle_priority) = 'object'),
  constraint training_goals_effective_range_check check (effective_to > effective_from)
);

-- One current row per user.
create unique index training_goals_one_current_per_user
  on public.training_goals (user_id)
  where effective_to is null;

-- A user's history in order, and the cascade from `auth.users`, which the partial index above does
-- not serve.
create index training_goals_user_id_effective_from_idx
  on public.training_goals (user_id, effective_from);

alter table public.routines enable row level security;
alter table public.routine_days enable row level security;
alter table public.routine_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_sets enable row level security;
alter table public.training_goals enable row level security;

-- Set the table privileges explicitly so nothing relies on the default ones (see 0001_init.sql).
-- Start from a clean slate on every table, then grant back only what Amendment 1's privileges table
-- lists. The anon role keeps nothing. The service role keeps nothing either, because nothing server
-- side reads these tables yet (the M7 export grants what it needs then). A column added later is not
-- writable by a client until a migration grants it.
--
-- `id` and `created_at` are never written on insert, so every new row has the database's id. There
-- is no delete grant on a table whose rows are soft deleted or archived. Account deletion cascades
-- regardless, because a foreign key action does not run as the caller.
revoke all
  on public.routines, public.routine_days, public.routine_exercises,
    public.workout_sessions, public.workout_sets, public.training_goals
  from anon, authenticated, service_role;

-- Sessions: a session never moves to another day, user or planned day after it is created. It is
-- ended, annotated and soft deleted (and restored) through the update grant.
grant select on public.workout_sessions to authenticated;

grant insert (user_id, started_at, ended_at, local_date, tz, routine_day_id, note)
  on public.workout_sessions to authenticated;

grant update (ended_at, note, deleted_at)
  on public.workout_sessions to authenticated;

-- Sets: a set never changes session or exercise, and its snapshot is never rewritten. `performed_at`
-- is set on insert only.
grant select on public.workout_sets to authenticated;

grant insert (session_id, user_id, exercise_id, position, set_type, reps, load_kg, rir, rpe, performed_at, snapshot)
  on public.workout_sets to authenticated;

grant update (position, set_type, reps, load_kg, rir, rpe, deleted_at)
  on public.workout_sets to authenticated;

-- Routines start inactive and live. `is_active` is meant to change through `set_active_routine`,
-- and the partial unique index refuses a second active routine whichever way it is written.
grant select on public.routines to authenticated;

grant insert (user_id, name) on public.routines to authenticated;

grant update (name, is_active, is_archived) on public.routines to authenticated;

-- Days are updated in place and deleted when removed from a routine. A day never moves to another
-- routine.
grant select, delete on public.routine_days to authenticated;

grant insert (routine_id, user_id, position, weekday, name) on public.routine_days to authenticated;

grant update (position, weekday, name) on public.routine_days to authenticated;

-- A day's exercises are replaced as a whole, so there is delete and no update.
grant select, delete on public.routine_exercises to authenticated;

grant insert (routine_day_id, user_id, position, exercise_id, target_sets, rep_min, rep_max, target_rir)
  on public.routine_exercises to authenticated;

-- Goals: a row is never edited, only closed. `effective_from` takes the database's time on insert,
-- so a client cannot backdate a row.
grant select on public.training_goals to authenticated;

grant insert (user_id, goal, focus, days_per_week, session_minutes, equipment, experience, muscle_priority, params_version)
  on public.training_goals to authenticated;

grant update (effective_to) on public.training_goals to authenticated;

-- `(select auth.uid())` is evaluated once per statement instead of once per row. Soft deleted and
-- archived rows stay visible to their owner, and the clients filter on them.
create policy "workout_sessions_select_own" on public.workout_sessions
  for select to authenticated
  using (user_id = (select auth.uid()));

-- A foreign key is checked without row level security, so on its own it would let a user link a
-- session to another user's routine day, and the other user's edit of their routine would then
-- clear it. The `exists` runs as the caller under the owner-only `routine_days` policy, so a day that
-- does not exist fails the same way as one that is not theirs.
create policy "workout_sessions_insert_own" on public.workout_sessions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      routine_day_id is null
      or exists (select 1 from public.routine_days d where d.id = workout_sessions.routine_day_id)
    )
  );

create policy "workout_sessions_update_own" on public.workout_sessions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "workout_sets_select_own" on public.workout_sets
  for select to authenticated
  using (user_id = (select auth.uid()));

-- The session must be the caller's, so a set cannot be added to another user's session. The
-- exercise must be visible to the caller: the second `exists` runs under the exercises policy, so
-- only a global exercise or the caller's own passes. Without it, a foreign key, which ignores row
-- level security, would let a user log a set against another user's private exercise. In both, an id
-- that does not exist fails the same way as one that is not the caller's.
create policy "workout_sets_insert_own" on public.workout_sets
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workout_sessions s
      where s.id = workout_sets.session_id and s.user_id = (select auth.uid())
    )
    and exists (select 1 from public.exercises e where e.id = workout_sets.exercise_id)
  );

create policy "workout_sets_update_own" on public.workout_sets
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "routines_select_own" on public.routines
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "routines_insert_own" on public.routines
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "routines_update_own" on public.routines
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "routine_days_select_own" on public.routine_days
  for select to authenticated
  using (user_id = (select auth.uid()));

-- The routine must be the caller's, so `user_id` cannot disagree with the routine's and a day cannot
-- be added to another user's routine.
create policy "routine_days_insert_own" on public.routine_days
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.routines r
      where r.id = routine_days.routine_id and r.user_id = (select auth.uid())
    )
  );

create policy "routine_days_update_own" on public.routine_days
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "routine_days_delete_own" on public.routine_days
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "routine_exercises_select_own" on public.routine_exercises
  for select to authenticated
  using (user_id = (select auth.uid()));

-- The day must be the caller's and the exercise visible to the caller, for the reasons the set
-- insert gives.
create policy "routine_exercises_insert_own" on public.routine_exercises
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.routine_days d
      where d.id = routine_exercises.routine_day_id and d.user_id = (select auth.uid())
    )
    and exists (select 1 from public.exercises e where e.id = routine_exercises.exercise_id)
  );

create policy "routine_exercises_delete_own" on public.routine_exercises
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "training_goals_select_own" on public.training_goals
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "training_goals_insert_own" on public.training_goals
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "training_goals_update_own" on public.training_goals
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Creates a routine when p_routine_id is null, and otherwise renames the caller's routine and
-- replaces its days and their exercises, all or nothing. It returns the id.
--
-- Why a function. PostgREST has no transaction between calls, and a save writes the routine row,
-- updates, inserts and deletes days and replaces each day's exercises. Separately, a failure part
-- way would leave a routine with half its plan, and two devices could interleave their days. Here
-- the whole save is one call and one transaction.
--
-- Days keep their ids. A day sent with its id is updated in place, one sent without is inserted,
-- and one that is not sent is deleted, which clears `workout_sessions.routine_day_id` for its
-- sessions (on delete set null) and removes its exercises (cascade). So only a day the user removed
-- loses its link to the sessions logged from it.
--
-- Security invoker, so every policy above applies to its writes: the caller can only touch their own
-- routine and days, can only plan exercises they can see, and a failed policy or constraint rolls the
-- call back. The update of the routine row stays the first write: its row lock serialises two saves
-- of one routine, and the last to commit wins.
--
-- Input. p_routine is an object with name (text). p_days is an array of objects, in the order the
-- days are to be listed, each with id (the uuid of one of this routine's days, or null or missing
-- for a new day), weekday (an integer from 0, Monday, to 6, Sunday, or null or missing for any day),
-- name (text) and exercises (an array of objects with exercise_id, target_sets, rep_min, rep_max
-- and target_rir, which may be null or missing), in the order they are to be listed. Keys it does
-- not know (user_id, routine_id, position, is_active, is_archived, created_at, routine_day_id) are
-- ignored, so a caller cannot set them: the owner is the caller, a position is the index in its
-- array, and is_active and is_archived are neither read nor changed. A routine may have no days, and
-- a day may have no exercises.
--
-- Refusals. Every field is checked before anything is written, with 22023
-- (invalid_parameter_value) and a message that states the rule and quotes no value. A routine, a day
-- or an exercise that does not exist or is not the caller's raises P0002 (no_data_found), and the
-- cases look the same. A global exercise is visible to everyone, so it can be planned. Whether an
-- exercise is soft deleted is not looked at, so a routine that plans one can still be saved.
create function public.save_routine(p_routine_id uuid, p_routine jsonb, p_days jsonb)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  uuid_pattern constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  saved_id uuid;
  sent_day_ids uuid[];
  day_entry jsonb;
  day_number bigint;
  day_id uuid;
begin
  if pg_catalog.jsonb_typeof(p_routine) is distinct from 'object' then
    raise exception 'save_routine needs the routine as a JSON object'
      using errcode = '22023';
  end if;
  if pg_catalog.jsonb_typeof(p_days) is distinct from 'array' then
    raise exception 'save_routine needs the days as a JSON array'
      using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(p_routine -> 'name') is distinct from 'string' then
    raise exception 'the routine name must be text'
      using errcode = '22023';
  end if;
  if (p_routine ->> 'name') !~ '\S' then
    raise exception 'the routine name must not be blank'
      using errcode = '22023';
  end if;
  if pg_catalog.char_length(p_routine ->> 'name') > 200 then
    raise exception 'the routine name has at most 200 characters'
      using errcode = '22023';
  end if;

  -- The days.
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_days) as sent
    where pg_catalog.jsonb_typeof(sent) is distinct from 'object'
  ) then
    raise exception 'every day must be a JSON object'
      using errcode = '22023';
  end if;
  if pg_catalog.jsonb_array_length(p_days) > 7 then
    raise exception 'a routine has at most 7 days'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_days) as sent
    where coalesce(pg_catalog.jsonb_typeof(sent -> 'id'), 'null') not in ('string', 'null')
      or (pg_catalog.jsonb_typeof(sent -> 'id') = 'string' and (sent ->> 'id') !~ uuid_pattern)
  ) then
    raise exception 'every day id must be a uuid or null'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_days) as sent
    where (sent ->> 'id') is not null
    group by (sent ->> 'id')::uuid
    having pg_catalog.count(*) > 1
  ) then
    raise exception 'a day is sent at most once'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_days) as sent
    where coalesce(pg_catalog.jsonb_typeof(sent -> 'weekday'), 'null') not in ('number', 'null')
  ) then
    raise exception 'every weekday must be a number or null'
      using errcode = '22023';
  end if;
  -- A separate statement, so the cast only ever sees numbers or nulls.
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_days) as sent
    where (sent ->> 'weekday')::numeric not in (0, 1, 2, 3, 4, 5, 6)
  ) then
    raise exception 'every weekday must be a whole number from 0 to 6'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_days) as sent
    where (sent ->> 'weekday') is not null
    group by (sent ->> 'weekday')::numeric
    having pg_catalog.count(*) > 1
  ) then
    raise exception 'a routine has at most one day per weekday'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_days) as sent
    where pg_catalog.jsonb_typeof(sent -> 'name') is distinct from 'string'
  ) then
    raise exception 'every day name must be text'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_days) as sent
    where (sent ->> 'name') !~ '\S'
  ) then
    raise exception 'a day name must not be blank'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_days) as sent
    where pg_catalog.char_length(sent ->> 'name') > 100
  ) then
    raise exception 'a day name has at most 100 characters'
      using errcode = '22023';
  end if;

  -- The exercises of each day.
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_days) as sent
    where pg_catalog.jsonb_typeof(sent -> 'exercises') is distinct from 'array'
  ) then
    raise exception 'every day needs its exercises as a JSON array'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_days) as sent
    where pg_catalog.jsonb_array_length(sent -> 'exercises') > 30
  ) then
    raise exception 'a routine day has at most 30 exercises'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_days) as sent,
      pg_catalog.jsonb_array_elements(sent -> 'exercises') as planned
    where pg_catalog.jsonb_typeof(planned) is distinct from 'object'
  ) then
    raise exception 'every planned exercise must be a JSON object'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_days) as sent,
      pg_catalog.jsonb_array_elements(sent -> 'exercises') as planned
    where pg_catalog.jsonb_typeof(planned -> 'exercise_id') is distinct from 'string'
      or (planned ->> 'exercise_id') !~ uuid_pattern
  ) then
    raise exception 'every exercise id must be a uuid'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_days) as sent,
      pg_catalog.jsonb_array_elements(sent -> 'exercises') as planned
    where pg_catalog.jsonb_typeof(planned -> 'target_sets') is distinct from 'number'
      or pg_catalog.jsonb_typeof(planned -> 'rep_min') is distinct from 'number'
      or pg_catalog.jsonb_typeof(planned -> 'rep_max') is distinct from 'number'
      or coalesce(pg_catalog.jsonb_typeof(planned -> 'target_rir'), 'null') not in ('number', 'null')
  ) then
    raise exception 'the targets of every planned exercise must be numbers, and target_rir may be null'
      using errcode = '22023';
  end if;
  -- Separate statements, so the casts only ever see numbers or nulls.
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_days) as sent,
      pg_catalog.jsonb_array_elements(sent -> 'exercises') as planned
    where (planned ->> 'target_sets')::numeric not between 1 and 20
      or (planned ->> 'target_sets')::numeric <> pg_catalog.trunc((planned ->> 'target_sets')::numeric)
  ) then
    raise exception 'target_sets must be a whole number from 1 to 20'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_days) as sent,
      pg_catalog.jsonb_array_elements(sent -> 'exercises') as planned
    where (planned ->> 'rep_min')::numeric not between 1 and 100
      or (planned ->> 'rep_min')::numeric <> pg_catalog.trunc((planned ->> 'rep_min')::numeric)
      or (planned ->> 'rep_max')::numeric not between 1 and 100
      or (planned ->> 'rep_max')::numeric <> pg_catalog.trunc((planned ->> 'rep_max')::numeric)
  ) then
    raise exception 'rep_min and rep_max must be whole numbers from 1 to 100'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_days) as sent,
      pg_catalog.jsonb_array_elements(sent -> 'exercises') as planned
    where (planned ->> 'rep_min')::numeric > (planned ->> 'rep_max')::numeric
  ) then
    raise exception 'rep_min cannot be above rep_max'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_days) as sent,
      pg_catalog.jsonb_array_elements(sent -> 'exercises') as planned
    where (planned ->> 'target_rir')::numeric not between 0 and 10
      or (planned ->> 'target_rir')::numeric <> pg_catalog.trunc((planned ->> 'target_rir')::numeric)
  ) then
    raise exception 'target_rir must be a whole number from 0 to 10, or null'
      using errcode = '22023';
  end if;

  -- Every planned exercise must be visible to the caller. The query runs under the exercises policy,
  -- so another user's private exercise is not found, the same way as one that does not exist.
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_days) as sent,
      pg_catalog.jsonb_array_elements(sent -> 'exercises') as planned
    where not exists (
      select 1 from public.exercises e where e.id = (planned ->> 'exercise_id')::uuid
    )
  ) then
    raise exception 'an exercise does not exist or is not yours'
      using errcode = 'P0002';
  end if;

  -- The first write. For an update it takes the row lock that every other save of this routine
  -- queues behind, and row level security decides whether the caller may see the row at all.
  if p_routine_id is null then
    insert into public.routines (name)
    values (p_routine ->> 'name')
    returning id into saved_id;
  else
    update public.routines
    set name = p_routine ->> 'name'
    where id = p_routine_id and user_id = caller
    returning id into saved_id;

    if not found then
      raise exception 'the routine does not exist or is not yours'
        using errcode = 'P0002';
    end if;
  end if;

  -- Every day sent with an id must be one of this routine's days. A new routine has none, so any
  -- id sent with it is refused.
  sent_day_ids := array(
    select (sent ->> 'id')::uuid
    from pg_catalog.jsonb_array_elements(p_days) as sent
    where (sent ->> 'id') is not null
  );
  if (
    select pg_catalog.count(*)
    from public.routine_days d
    where d.routine_id = saved_id and d.id = any (sent_day_ids)
  ) <> pg_catalog.cardinality(sent_day_ids) then
    raise exception 'a routine day does not exist or is not in this routine'
      using errcode = 'P0002';
  end if;

  -- A day that is not sent is removed. Its exercises go with it, and its sessions keep their sets
  -- and lose only their link to it.
  delete from public.routine_days
  where routine_id = saved_id and not (id = any (sent_day_ids));

  -- The exercises of every kept day are replaced below.
  delete from public.routine_exercises e
  using public.routine_days d
  where d.id = e.routine_day_id and d.routine_id = saved_id;

  -- The weekday index cannot be deferred, so every kept day whose weekday changes is cleared first.
  -- Then no two days hold the same weekday at any point of the save, even when two of them swap.
  update public.routine_days d
  set weekday = null
  from pg_catalog.jsonb_array_elements(p_days) as sent
  where d.routine_id = saved_id
    and d.id = (sent ->> 'id')::uuid
    and d.weekday is not null
    and d.weekday is distinct from (sent ->> 'weekday')::numeric::smallint;

  for day_entry, day_number in
    select sent.value, sent.number
    from pg_catalog.jsonb_array_elements(p_days) with ordinality as sent(value, number)
    order by sent.number
  loop
    if (day_entry ->> 'id') is null then
      insert into public.routine_days (routine_id, position, weekday, name)
      values (
        saved_id,
        (day_number - 1)::integer,
        (day_entry ->> 'weekday')::numeric::smallint,
        day_entry ->> 'name'
      )
      returning id into day_id;
    else
      -- The position is unique only at commit, so two days can swap positions here.
      update public.routine_days
      set
        position = (day_number - 1)::integer,
        weekday = (day_entry ->> 'weekday')::numeric::smallint,
        name = day_entry ->> 'name'
      where id = (day_entry ->> 'id')::uuid and routine_id = saved_id
      returning id into day_id;
    end if;

    insert into public.routine_exercises (
      routine_day_id, position, exercise_id, target_sets, rep_min, rep_max, target_rir
    )
    select
      day_id,
      (planned.number - 1)::integer,
      (planned.value ->> 'exercise_id')::uuid,
      (planned.value ->> 'target_sets')::numeric::smallint,
      (planned.value ->> 'rep_min')::numeric::smallint,
      (planned.value ->> 'rep_max')::numeric::smallint,
      (planned.value ->> 'target_rir')::numeric::smallint
    from pg_catalog.jsonb_array_elements(day_entry -> 'exercises') with ordinality as planned(value, number);
  end loop;

  return saved_id;
end;
$$;

-- `create function` grants execute to public, and the Supabase default ACL grants it to the API
-- roles, so each is revoked by name. The function acts on the caller, so only authenticated holds it
-- (the service role has no caller).
revoke execute on function public.save_routine(uuid, jsonb, jsonb) from public, anon, service_role;
grant execute on function public.save_routine(uuid, jsonb, jsonb) to authenticated;

-- Makes the caller's routine p_routine_id the active one and clears whichever was active before, in
-- one transaction. A null p_routine_id clears the active routine without setting one.
--
-- Security invoker, so the owner-only policies apply. The target row is locked first, so two
-- switches to one routine queue behind each other. An archived routine cannot be active, and is
-- refused with 22023 before any write, rather than by the table check, whose detail would carry the
-- row. A routine that does not exist or is not the caller's raises P0002, and the cases look the
-- same.
create function public.set_active_routine(p_routine_id uuid)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target_archived boolean;
begin
  if p_routine_id is not null then
    select r.is_archived into target_archived
    from public.routines r
    where r.id = p_routine_id and r.user_id = caller
    for update;

    if not found then
      raise exception 'the routine does not exist or is not yours'
        using errcode = 'P0002';
    end if;
    if target_archived then
      raise exception 'an archived routine cannot be active'
        using errcode = '22023';
    end if;
  end if;

  -- Cleared before the new one is set, because the one-active index is checked row by row.
  update public.routines
  set is_active = false
  where user_id = caller and is_active and id is distinct from p_routine_id;

  if p_routine_id is not null then
    update public.routines
    set is_active = true
    where id = p_routine_id and not is_active;
  end if;
end;
$$;

revoke execute on function public.set_active_routine(uuid) from public, anon, service_role;
grant execute on function public.set_active_routine(uuid) to authenticated;

-- Records the caller's new training goals: closes the current row and inserts the new one in one
-- transaction, so the history keeps every past answer and exactly one row is current. It returns the
-- new row's id.
--
-- Security invoker, so the owner-only policies apply and the new row belongs to the caller. The
-- closed row's `effective_to` and the new row's `effective_from` are both the transaction's time,
-- so the history has no gap and no overlap.
--
-- Input. p_goals is an object with goal (one of training_goal), focus (an array of the focus list,
-- each at most once), days_per_week (a whole number from 1 to 7), session_minutes (a whole number
-- from 15 to 180), equipment (an array of the equipment list), experience (one of experience_level),
-- muscle_priority (an object from muscle id to a number) and params_version (non-empty text). Keys it
-- does not know (id, user_id, effective_from, effective_to, created_at) are ignored.
--
-- Refusals. Every field is checked before anything is written, with 22023 and a message that states
-- the rule and quotes no value. If the current row is not older than this transaction (it was saved
-- earlier in the same transaction, or by a request that started after this one), closing it would
-- end it before it starts, so the save is refused with 40001 (serialization_failure) before the
-- table's own check is reached, and the client can retry.
create function public.save_training_goals(p_goals jsonb)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  saved_id uuid;
begin
  if pg_catalog.jsonb_typeof(p_goals) is distinct from 'object' then
    raise exception 'save_training_goals needs the goals as a JSON object'
      using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(p_goals -> 'goal') is distinct from 'string'
    or not ((p_goals ->> 'goal') = any (pg_catalog.enum_range(null::public.training_goal)::text[]))
  then
    raise exception 'the goal must be aesthetic, strength or hybrid'
      using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(p_goals -> 'focus') is distinct from 'array' then
    raise exception 'the focus must be a JSON array'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_goals -> 'focus') as value
    where pg_catalog.jsonb_typeof(value) is distinct from 'string'
  ) or not public.training_focus_is_valid(
    array(select pg_catalog.jsonb_array_elements_text(p_goals -> 'focus'))
  ) then
    raise exception 'the focus must be values of the focus list, each at most once'
      using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(p_goals -> 'days_per_week') is distinct from 'number' then
    raise exception 'days_per_week must be a number'
      using errcode = '22023';
  end if;
  if (p_goals ->> 'days_per_week')::numeric not between 1 and 7
    or (p_goals ->> 'days_per_week')::numeric <> pg_catalog.trunc((p_goals ->> 'days_per_week')::numeric)
  then
    raise exception 'days_per_week must be a whole number from 1 to 7'
      using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(p_goals -> 'session_minutes') is distinct from 'number' then
    raise exception 'session_minutes must be a number'
      using errcode = '22023';
  end if;
  if (p_goals ->> 'session_minutes')::numeric not between 15 and 180
    or (p_goals ->> 'session_minutes')::numeric <> pg_catalog.trunc((p_goals ->> 'session_minutes')::numeric)
  then
    raise exception 'session_minutes must be a whole number from 15 to 180'
      using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(p_goals -> 'equipment') is distinct from 'array' then
    raise exception 'the equipment must be a JSON array'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_goals -> 'equipment') as value
    where pg_catalog.jsonb_typeof(value) is distinct from 'string'
      or not ((value #>> '{}') = any (pg_catalog.enum_range(null::public.equipment)::text[]))
  ) then
    raise exception 'every equipment must be one of the equipment list'
      using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(p_goals -> 'experience') is distinct from 'string'
    or not ((p_goals ->> 'experience') = any (pg_catalog.enum_range(null::public.experience_level)::text[]))
  then
    raise exception 'the experience must be beginner, intermediate or advanced'
      using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(p_goals -> 'muscle_priority') is distinct from 'object' then
    raise exception 'the muscle priority must be a JSON object'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_each(p_goals -> 'muscle_priority') as priority
    where not exists (select 1 from public.muscles m where m.id = priority.key)
  ) then
    raise exception 'every muscle priority must name a muscle of the muscle list'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_each(p_goals -> 'muscle_priority') as priority
    where pg_catalog.jsonb_typeof(priority.value) is distinct from 'number'
  ) then
    raise exception 'every muscle priority must be a number'
      using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(p_goals -> 'params_version') is distinct from 'string'
    or pg_catalog.char_length(p_goals ->> 'params_version') = 0
  then
    raise exception 'the params version must be non-empty text'
      using errcode = '22023';
  end if;

  -- The first write. It takes the current row's lock, which a concurrent save queues behind.
  update public.training_goals
  set effective_to = pg_catalog.now()
  where user_id = caller and effective_to is null and effective_from < pg_catalog.now();

  if exists (
    select 1 from public.training_goals g
    where g.user_id = caller and g.effective_to is null
  ) then
    raise exception 'the current training goals are newer than this save, so it must be retried'
      using errcode = '40001';
  end if;

  insert into public.training_goals (
    goal, focus, days_per_week, session_minutes, equipment, experience, muscle_priority, params_version
  )
  values (
    (p_goals ->> 'goal')::public.training_goal,
    array(select pg_catalog.jsonb_array_elements_text(p_goals -> 'focus')),
    (p_goals ->> 'days_per_week')::numeric::smallint,
    (p_goals ->> 'session_minutes')::numeric::smallint,
    array(select pg_catalog.jsonb_array_elements_text(p_goals -> 'equipment'))::public.equipment[],
    (p_goals ->> 'experience')::public.experience_level,
    p_goals -> 'muscle_priority',
    p_goals ->> 'params_version'
  )
  returning id into saved_id;

  return saved_id;
end;
$$;

revoke execute on function public.save_training_goals(jsonb) from public, anon, service_role;
grant execute on function public.save_training_goals(jsonb) to authenticated;
