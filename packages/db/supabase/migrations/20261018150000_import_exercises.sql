-- import_exercises: the one write path of the exercise import (KEY-349). It is additive: it adds a
-- function and touches no table, type or grant that exists.
--
-- Why a function. The import reaches the database through PostgREST, where every request is its own
-- transaction, and the primary-muscle trigger of 20261018120000_training_exercises.sql is deferred
-- to commit. An exercise row written on its own, and a map deleted on its own, are therefore each
-- refused at their commit. Only one call that writes an exercise together with its map satisfies
-- the rule, and this is that call. The seed file calls it too, so the import and the seed share one
-- write path.
--
-- Health data: nothing here raises a notice or an error that quotes a name or a muscle value.

-- Writes the global exercises of one batch, all or nothing, and returns how many it created,
-- updated and left alone, as {"created": n, "updated": n, "unchanged": n}.
--
-- Input. p_exercises is an array of objects: source_ref and name (text), equipment (one of the
-- equipment enum), mechanic (compound or isolation), muscles (an array of objects with muscle_id,
-- role and weight, as save_exercise takes them) and raw (the source row as fetched). The exercise is
-- keyed by (free_exercise_db, source_ref). p_import_run_id is the exercise_import_runs row that
-- every source row of the batch points at.
--
-- An exercise that does not exist is created with its map. One that exists is updated when its name,
-- equipment or mechanic differs or when it was soft deleted, which brings it back, and its map is
-- replaced as a whole only when a muscle, a role or a weight differs, so a repeated import deletes
-- and inserts no map row. Its source row always moves to the given run. An exercise that is not
-- in the batch is not touched: removing one is a soft delete the import does separately.
--
-- Security invoker, so the service role grants of 20261018120000_training_exercises.sql decide what
-- may be written, and no other role may call it. The empty search_path forces every reference to be
-- schema-qualified. A batch whose map has no primary muscle is refused by the deferred trigger at
-- commit with 23514, and a muscle id that is not in the list by the foreign key.
create function public.import_exercises(p_import_run_id uuid, p_exercises jsonb)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  item jsonb;
  saved_id uuid;
  is_new boolean;
  exercise_changed boolean;
  map_changed boolean;
  changed_rows integer;
  created integer := 0;
  updated integer := 0;
  unchanged integer := 0;
begin
  if pg_catalog.jsonb_typeof(p_exercises) is distinct from 'array' then
    raise exception 'import_exercises needs the exercises as a JSON array'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_exercises) as exercise
    where pg_catalog.jsonb_typeof(exercise) is distinct from 'object'
  ) then
    raise exception 'every exercise must be a JSON object'
      using errcode = '22023';
  end if;

  for item in select exercise from pg_catalog.jsonb_array_elements(p_exercises) as exercise loop
    select e.id into saved_id
    from public.exercises e
    where e.source = 'free_exercise_db' and e.source_ref = item ->> 'source_ref';

    if saved_id is null then
      insert into public.exercises (source, source_ref, name, equipment, mechanic)
      values (
        'free_exercise_db',
        item ->> 'source_ref',
        item ->> 'name',
        (item ->> 'equipment')::public.equipment,
        (item ->> 'mechanic')::public.exercise_mechanic
      )
      returning id into saved_id;
      is_new := true;
      exercise_changed := false;
      map_changed := true;
    else
      is_new := false;
      update public.exercises e
      set
        name = item ->> 'name',
        equipment = (item ->> 'equipment')::public.equipment,
        mechanic = (item ->> 'mechanic')::public.exercise_mechanic,
        deleted_at = null
      where e.id = saved_id
        and (
          e.name is distinct from item ->> 'name'
          or e.equipment is distinct from (item ->> 'equipment')::public.equipment
          or e.mechanic is distinct from (item ->> 'mechanic')::public.exercise_mechanic
          or e.deleted_at is not null
        );
      get diagnostics changed_rows = row_count;
      exercise_changed := changed_rows > 0;

      -- The map differs when either side has a row the other lacks. Weights compare by value, so
      -- 0.6 and 0.60 are the same.
      map_changed := exists (
        (
          select muscle ->> 'muscle_id', (muscle ->> 'role')::public.muscle_role, (muscle ->> 'weight')::numeric
          from pg_catalog.jsonb_array_elements(item -> 'muscles') as muscle
          except
          select m.muscle_id, m.role, m.weight
          from public.exercise_muscles m
          where m.exercise_id = saved_id
        )
        union all
        (
          select m.muscle_id, m.role, m.weight
          from public.exercise_muscles m
          where m.exercise_id = saved_id
          except
          select muscle ->> 'muscle_id', (muscle ->> 'role')::public.muscle_role, (muscle ->> 'weight')::numeric
          from pg_catalog.jsonb_array_elements(item -> 'muscles') as muscle
        )
      );
    end if;

    if map_changed then
      delete from public.exercise_muscles where exercise_id = saved_id;

      insert into public.exercise_muscles (exercise_id, owner_id, muscle_id, role, weight)
      select
        saved_id,
        null,
        muscle ->> 'muscle_id',
        (muscle ->> 'role')::public.muscle_role,
        (muscle ->> 'weight')::numeric
      from pg_catalog.jsonb_array_elements(item -> 'muscles') as muscle;
    end if;

    insert into public.exercise_source_data (exercise_id, import_run_id, raw)
    values (saved_id, p_import_run_id, item -> 'raw')
    on conflict (exercise_id) do update
    set import_run_id = excluded.import_run_id, raw = excluded.raw;

    if is_new then
      created := created + 1;
    elsif exercise_changed or map_changed then
      updated := updated + 1;
    else
      unchanged := unchanged + 1;
    end if;
  end loop;

  return pg_catalog.jsonb_build_object('created', created, 'updated', updated, 'unchanged', unchanged);
end;
$$;

-- `create function` grants execute to public, and the Supabase default ACL grants it to the API
-- roles, so each is revoked by name. Only the service role, which the import runs as, holds it.
revoke execute on function public.import_exercises(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.import_exercises(uuid, jsonb) to service_role;
