-- training exercises: the first of the two T1 training migrations (KEY-347). It adds the enums the
-- exercise library needs, the global `muscles` list and its seed, `exercises`, `exercise_muscles`
-- and the primary-muscle rule, the two service-only provenance tables, and `save_exercise`.
-- Everything here is set out in docs/adr/0005-training-v1.md, Amendment 1, which wins over any
-- other description. The bounds are the table in its "The numbers". KEY-348 adds the sessions,
-- sets, routines and goals.
--
-- A user's custom exercises are health data under the project's Working conventions, because the
-- library a user builds reveals how they train. Nothing here logs a row value, and neither
-- `save_exercise` nor the trigger raises a notice or an error that quotes a name or a muscle value.
--
-- The migration is additive. It touches no table, type or function that existed before it.

-- The enums of the exercise library. Equipment is an enum and not a checked text list, because
-- `exercises.equipment` and, in KEY-348, `training_goals.equipment` share one list, and an enum
-- gives both the same generated TypeScript union. Adding a value is a migration either way.
create type public.muscle_group as enum ('chest', 'shoulders', 'back', 'arms', 'core', 'legs', 'neck');
create type public.muscle_size_class as enum ('small', 'medium', 'large');
create type public.exercise_source as enum ('free_exercise_db', 'user');
create type public.exercise_mechanic as enum ('compound', 'isolation');
create type public.muscle_role as enum ('primary', 'secondary', 'stabiliser');
create type public.equipment as enum (
  'barbell', 'dumbbell', 'kettlebell', 'cable', 'machine', 'smith_machine', 'ez_bar', 'band',
  'bodyweight', 'other'
);

-- The muscle list is the contract (ADR 0005): the same ids name the database rows, core's
-- `MUSCLE_IDS`, the regions of the 2D body map and the meshes of the 3D model. It is keyed by its
-- text id, so a map row names its muscle directly, and it keeps Amendment 1's `created_at`.
-- `position` is the order of the accepted list.
create table public.muscles (
  id text primary key,
  "group" public.muscle_group not null,
  size_class public.muscle_size_class not null,
  position integer not null unique,
  created_at timestamptz not null default now(),

  constraint muscles_id_check check (id ~ '^[a-z_]+$')
);

-- Exactly the 22 ids of "The muscle list is the contract", in its order, with the size classes of
-- the table in "The heat model". `position` counts from 0, the index of each id in core's ordered
-- list. Nothing writes this table after this migration: adding or splitting an id is a new list
-- version and a migration of its own.
insert into public.muscles (id, "group", size_class, position) values
  ('chest_upper', 'chest', 'medium', 0),
  ('chest_lower', 'chest', 'medium', 1),
  ('delt_front', 'shoulders', 'small', 2),
  ('delt_side', 'shoulders', 'small', 3),
  ('delt_rear', 'shoulders', 'small', 4),
  ('lats', 'back', 'medium', 5),
  ('traps_upper', 'back', 'medium', 6),
  ('traps_mid', 'back', 'medium', 7),
  ('lower_back', 'back', 'large', 8),
  ('biceps', 'arms', 'small', 9),
  ('triceps', 'arms', 'small', 10),
  ('forearms', 'arms', 'small', 11),
  ('abs', 'core', 'small', 12),
  ('obliques', 'core', 'small', 13),
  ('glute_max', 'legs', 'large', 14),
  ('glute_med', 'legs', 'medium', 15),
  ('quads', 'legs', 'large', 16),
  ('hamstrings', 'legs', 'large', 17),
  ('adductors', 'legs', 'medium', 18),
  ('calves', 'legs', 'small', 19),
  ('tibialis', 'legs', 'small', 20),
  ('neck', 'neck', 'small', 21);

-- An exercise is global (imported, no owner) or a user's own, the shape of `foods`. Exercises are
-- soft deleted and never hard deleted, because KEY-348's logged sets and routine exercises refer to
-- them. `owner_id` has no default, so a client names itself as the owner and the insert policy
-- checks it.
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  source public.exercise_source not null,
  source_ref text,
  name text not null,
  equipment public.equipment not null,
  mechanic public.exercise_mechanic not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),

  -- Only user rows have an owner, the rule `foods` has.
  constraint exercises_owner_matches_source check ((source = 'user') = (owner_id is not null)),
  -- Every imported row has a source_ref and no user row does, which keeps user rows out of the
  -- unique constraint below (nulls are distinct).
  constraint exercises_source_ref_matches_source check ((source = 'user') = (source_ref is null)),
  constraint exercises_name_not_blank check (name ~ '\S'),
  constraint exercises_name_length_check check (pg_catalog.char_length(name) <= 200),
  -- A plain constraint, not a partial index, so the import can upsert on (source, source_ref).
  unique (source, source_ref)
);

-- The library search is a case-insensitive `ilike` through PostgREST with no function of its own,
-- which the trigram index serves. The partial owner index serves "my exercises" and the cascade
-- from `auth.users`, which Postgres does not index on the referencing side. Global rows have no
-- owner, so leaving them out keeps the index small.
create index exercises_name_trgm_idx on public.exercises using gin (name extensions.gin_trgm_ops);
create index exercises_owner_id_idx on public.exercises (owner_id) where owner_id is not null;

-- The per-muscle share of one set of the exercise. The map is replaced as a whole on every save
-- (rows deleted and inserted), so nothing refers to a row's id. `owner_id` is a copy of the
-- exercise's for row level security, as `food_portions` has, and is null for a global exercise.
-- A weight of 0 would contribute nothing, so a listed muscle has a weight above 0.
create table public.exercise_muscles (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  owner_id uuid references auth.users (id) on delete cascade,
  muscle_id text not null references public.muscles (id),
  role public.muscle_role not null,
  weight numeric not null,
  created_at timestamptz not null default now(),

  -- One row per muscle, which also caps a map at the 22 muscles of the list. The unique index
  -- serves reading an exercise's map and the cascade from `exercises`.
  unique (exercise_id, muscle_id),
  constraint exercise_muscles_weight_check check (weight > 0 and weight <= 1)
);

-- The reverse lookup ("exercises for side delts"), and the foreign key check on `muscles`.
create index exercise_muscles_muscle_id_idx on public.exercise_muscles (muscle_id);

-- Every exercise has at least one primary muscle (ADR 0005, "Tables"). The rule spans rows, so a
-- check cannot hold it, and it is a deferred constraint trigger rather than a check inside
-- `save_exercise` so that the import, which writes as the service role, is held to it too. It is
-- checked at commit, so a save can delete a map and insert the new one in one transaction.
--
-- An exercise that no longer exists is skipped: an account deletion cascades the user's
-- exercises and their maps away in one statement, and the map rows' delete events still fire.
--
-- Security definer, owned by the migration role, which owns both tables. A deferred trigger runs as
-- whoever commits, and an account deletion commits as the auth server's role, which holds no
-- privilege on these tables, so an invoker check would refuse every deletion of a user with a
-- custom exercise. The function reads two existence facts and returns nothing, so running it as
-- the owner reveals nothing to the caller. The empty search_path forces every reference to be
-- schema-qualified.
create function public.exercise_has_primary_muscle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected uuid[];
  checked uuid;
begin
  if tg_table_name = 'exercises' then
    affected := array[new.id];
  elsif tg_op = 'INSERT' then
    affected := array[new.exercise_id];
  elsif tg_op = 'DELETE' then
    affected := array[old.exercise_id];
  else
    affected := array[old.exercise_id, new.exercise_id];
  end if;

  foreach checked in array affected loop
    if exists (select 1 from public.exercises e where e.id = checked)
      and not exists (
        select 1 from public.exercise_muscles m
        where m.exercise_id = checked and m.role = 'primary'
      )
    then
      raise exception 'an exercise needs at least one primary muscle'
        using errcode = '23514';
    end if;
  end loop;

  return null;
end;
$$;

-- Only the triggers run this function, and firing a trigger needs no execute privilege, so nobody
-- holds it. `create function` grants execute to public and the Supabase default ACL grants it to
-- the API roles, so each is revoked by name.
revoke execute on function public.exercise_has_primary_muscle() from public, anon, authenticated, service_role;

create constraint trigger exercise_has_primary_muscle
  after insert or update on public.exercises
  deferrable initially deferred
  for each row execute function public.exercise_has_primary_muscle();

create constraint trigger exercise_has_primary_muscle
  after insert or update or delete on public.exercise_muscles
  deferrable initially deferred
  for each row execute function public.exercise_has_primary_muscle();

-- Provenance, separate from the foods tables so the foods schema and its `food_source` enum are
-- untouched. Never visible to the API roles: only the import (KEY-349, service role) reads and
-- writes them. An import run describes a bulk source, so a user source is refused.
create table public.exercise_import_runs (
  id uuid primary key default gen_random_uuid(),
  source public.exercise_source not null,
  label text not null,
  -- The commit of the source repository the file was taken from.
  source_commit text not null,
  -- The SHA-256 of the imported file, as 64 lower-case hex characters.
  file_sha256 text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  row_count integer,
  created_at timestamptz not null default now(),

  constraint exercise_import_runs_source_not_user check (source <> 'user'),
  constraint exercise_import_runs_file_sha256_check check (file_sha256 ~ '^[0-9a-f]{64}$')
);

-- One raw source row per imported exercise, keyed by the exercise as `food_source_data` is keyed by
-- the food. Every row comes from a run.
create table public.exercise_source_data (
  exercise_id uuid primary key references public.exercises (id) on delete cascade,
  import_run_id uuid not null references public.exercise_import_runs (id),
  -- The source row as fetched.
  raw jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.muscles enable row level security;
alter table public.exercises enable row level security;
alter table public.exercise_muscles enable row level security;
alter table public.exercise_import_runs enable row level security;
alter table public.exercise_source_data enable row level security;

-- Set the table privileges explicitly so nothing relies on the default ones (see 0001_init.sql).
-- Start from a clean slate on every table, then grant back only what Amendment 1's privileges
-- table lists. The anon role keeps nothing. A column added later is not writable by a client
-- until a migration grants it.
revoke all
  on public.muscles, public.exercises, public.exercise_muscles,
    public.exercise_import_runs, public.exercise_source_data
  from anon, authenticated, service_role;

-- Muscles are read by everyone signed in and written by nobody, the import included.
grant select on public.muscles to authenticated;

-- Exercises: row visibility comes from row level security, so every column is readable. `id`,
-- `source_ref`, `deleted_at` and `created_at` are never written on insert, so a new exercise has
-- the database's id and starts live. `owner_id` and `source` are set on insert and never change.
-- There is no delete grant: an exercise is removed by setting `deleted_at`. Account deletion
-- cascades regardless, because a foreign key action does not run as the caller.
grant select on public.exercises to authenticated;

grant insert (owner_id, source, name, equipment, mechanic)
  on public.exercises to authenticated;

grant update (name, equipment, mechanic, deleted_at)
  on public.exercises to authenticated;

-- The map is replaced as a whole, so there is delete and no update.
grant select, delete on public.exercise_muscles to authenticated;

grant insert (exercise_id, owner_id, muscle_id, role, weight)
  on public.exercise_muscles to authenticated;

-- The import (KEY-349) writes the global library, its maps and its provenance. The service role
-- bypasses row level security, so it needs no policy. It gets no delete on exercises, which are
-- soft deleted, and nothing on `muscles`.
grant select, insert, update
  on public.exercises, public.exercise_import_runs, public.exercise_source_data
  to service_role;

grant select, insert, delete on public.exercise_muscles to service_role;

-- `(select auth.uid())` is evaluated once per statement instead of once per row.
create policy "muscles_select_all" on public.muscles
  for select to authenticated
  using (true);

-- Everyone signed in sees the global library and their own exercises. Soft deleted rows stay
-- visible, and the clients filter on deleted_at, so a logged set can still show its exercise.
create policy "exercises_select_visible" on public.exercises
  for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));

create policy "exercises_insert_own" on public.exercises
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and source = 'user');

-- A global row has no owner, so it never passes and no client can update it.
create policy "exercises_update_own" on public.exercises
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "exercise_muscles_select_visible" on public.exercise_muscles
  for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));

-- A foreign key is checked without row level security, so on its own it would let a user attach a
-- map row to another user's or a global exercise. The `exists` runs as the caller, and requires the
-- exercise to be the caller's own, so an id that does not exist fails the same way as one that is
-- not theirs, and `owner_id` cannot disagree with the exercise's.
create policy "exercise_muscles_insert_own" on public.exercise_muscles
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.exercises e
      where e.id = exercise_muscles.exercise_id and e.owner_id = (select auth.uid())
    )
  );

create policy "exercise_muscles_delete_own" on public.exercise_muscles
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Creates a user exercise when p_exercise_id is null, and otherwise replaces the name, equipment,
-- mechanic and muscle map of the caller's exercise, all or nothing. It returns the id.
--
-- Why a function. PostgREST has no transaction between calls, and a save writes the exercise row
-- and replaces its map. Separately, a failure after the delete would leave an exercise with no
-- map, which the primary-muscle trigger refuses at commit anyway, and two devices could interleave
-- their maps. Here the whole save is one call and one transaction.
--
-- Security invoker, so every policy above applies to its writes: the caller can only touch their
-- own exercise, and a failed policy or constraint rolls the call back. The update of the exercise
-- row stays the first write: its row lock serialises two saves of one exercise, and the last to
-- commit wins. The update also names the caller as the owner, so a global exercise, which has no
-- owner, is never written whatever the policies say.
--
-- Input. p_exercise is an object with name (text), equipment (one of the equipment enum) and
-- mechanic (compound or isolation). p_muscles is an array of objects with muscle_id (an id of the
-- muscle list), role (primary, secondary or stabiliser) and weight (a number above 0 and at most
-- 1). Keys it does not know (id, owner_id, source, source_ref, deleted_at, created_at,
-- exercise_id) are ignored, so a caller cannot set them: the owner is the caller, the source is
-- `user`, the database chooses a new exercise's id, and deleted_at is neither read nor changed.
--
-- Refusals. Every field is checked before anything is written, with 22023
-- (invalid_parameter_value) and a message that states the rule and quotes no value, so no table
-- error, whose detail can carry the failing row, is reached from a payload. An exercise that does
-- not exist or is not the caller's, a global one included, raises P0002 (no_data_found), and the
-- cases look the same.
create function public.save_exercise(p_exercise_id uuid, p_exercise jsonb, p_muscles jsonb)
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
  if pg_catalog.jsonb_typeof(p_exercise) is distinct from 'object' then
    raise exception 'save_exercise needs the exercise as a JSON object'
      using errcode = '22023';
  end if;
  if pg_catalog.jsonb_typeof(p_muscles) is distinct from 'array' then
    raise exception 'save_exercise needs the muscles as a JSON array'
      using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(p_exercise -> 'name') is distinct from 'string' then
    raise exception 'the exercise name must be text'
      using errcode = '22023';
  end if;
  if (p_exercise ->> 'name') !~ '\S' then
    raise exception 'the exercise name must not be blank'
      using errcode = '22023';
  end if;
  if pg_catalog.char_length(p_exercise ->> 'name') > 200 then
    raise exception 'the exercise name has at most 200 characters'
      using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(p_exercise -> 'equipment') is distinct from 'string'
    or not ((p_exercise ->> 'equipment') = any (pg_catalog.enum_range(null::public.equipment)::text[]))
  then
    raise exception 'the equipment must be one of the equipment list'
      using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(p_exercise -> 'mechanic') is distinct from 'string'
    or not ((p_exercise ->> 'mechanic') = any (pg_catalog.enum_range(null::public.exercise_mechanic)::text[]))
  then
    raise exception 'the mechanic must be compound or isolation'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_muscles) as muscle
    where pg_catalog.jsonb_typeof(muscle) is distinct from 'object'
  ) then
    raise exception 'every muscle must be a JSON object'
      using errcode = '22023';
  end if;
  if pg_catalog.jsonb_array_length(p_muscles) > 22 then
    raise exception 'an exercise has at most 22 muscles'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_muscles) as muscle
    where pg_catalog.jsonb_typeof(muscle -> 'muscle_id') is distinct from 'string'
      or not exists (select 1 from public.muscles m where m.id = muscle ->> 'muscle_id')
  ) then
    raise exception 'every muscle must be one of the muscle list'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_muscles) as muscle
    group by muscle ->> 'muscle_id'
    having pg_catalog.count(*) > 1
  ) then
    raise exception 'a muscle is listed at most once per exercise'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_muscles) as muscle
    where pg_catalog.jsonb_typeof(muscle -> 'role') is distinct from 'string'
      or not ((muscle ->> 'role') = any (pg_catalog.enum_range(null::public.muscle_role)::text[]))
  ) then
    raise exception 'every muscle role must be primary, secondary or stabiliser'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_muscles) as muscle
    where pg_catalog.jsonb_typeof(muscle -> 'weight') is distinct from 'number'
  ) then
    raise exception 'every muscle weight must be a number'
      using errcode = '22023';
  end if;
  -- A separate statement, so the cast only ever sees numbers.
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_muscles) as muscle
    where (muscle ->> 'weight')::numeric <= 0 or (muscle ->> 'weight')::numeric > 1
  ) then
    raise exception 'every muscle weight must be more than 0 and at most 1'
      using errcode = '22023';
  end if;

  -- The trigger holds the table to this at commit. Checking it here as well gives the caller the
  -- same 22023 refusal as every other rule, before anything is written.
  if not exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_muscles) as muscle
    where muscle ->> 'role' = 'primary'
  ) then
    raise exception 'an exercise needs at least one primary muscle'
      using errcode = '22023';
  end if;

  -- The first write. For an update it takes the row lock that every other save of this exercise
  -- queues behind, and row level security decides whether the caller may see the row at all.
  if p_exercise_id is null then
    insert into public.exercises (owner_id, source, name, equipment, mechanic)
    values (
      caller,
      'user',
      p_exercise ->> 'name',
      (p_exercise ->> 'equipment')::public.equipment,
      (p_exercise ->> 'mechanic')::public.exercise_mechanic
    )
    returning id into saved_id;
  else
    update public.exercises
    set
      name = p_exercise ->> 'name',
      equipment = (p_exercise ->> 'equipment')::public.equipment,
      mechanic = (p_exercise ->> 'mechanic')::public.exercise_mechanic
    where id = p_exercise_id and owner_id = caller
    returning id into saved_id;

    if not found then
      raise exception 'the exercise does not exist or is not yours'
        using errcode = 'P0002';
    end if;
  end if;

  delete from public.exercise_muscles where exercise_id = saved_id;

  insert into public.exercise_muscles (exercise_id, owner_id, muscle_id, role, weight)
  select
    saved_id,
    caller,
    muscle ->> 'muscle_id',
    (muscle ->> 'role')::public.muscle_role,
    (muscle ->> 'weight')::numeric
  from pg_catalog.jsonb_array_elements(p_muscles) as muscle;

  return saved_id;
end;
$$;

-- `create function` grants execute to public, and the Supabase default ACL grants it to the API
-- roles, so each is revoked by name. The function acts on the caller, so only authenticated holds it
-- (the service role has no caller, and the import writes the tables directly).
revoke execute on function public.save_exercise(uuid, jsonb, jsonb) from public, anon, service_role;
grant execute on function public.save_exercise(uuid, jsonb, jsonb) to authenticated;
