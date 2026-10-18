-- Asserts public.import_exercises (KEY-349), the one function the exercise import writes the global
-- library through: who may call it, what it refuses, and the four things a call can do to an
-- exercise (create it, change it, leave it alone, bring a soft deleted one back). The import runs as
-- the service role over PostgREST, where every request is its own transaction, and the
-- primary-muscle trigger is deferred to commit. An exercise and its map therefore have to arrive in
-- one call, which is what this function is for.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back. The
-- primary-muscle trigger is deferred to commit, so the file fires it with `set constraints ...
-- immediate`, which runs every pending check at that point, exactly as a commit would. Every
-- fixture id starts with 34900000 and every source_ref, name and label with key349-. Nothing
-- asserts a whole-table count. The service role is entered with `set local role` and left with
-- `reset role`.
--
-- Health data: the refusal messages asserted below state a rule and never a value.

begin;

select plan(28);

insert into public.exercise_import_runs (id, source, label, source_commit, file_sha256) values
  ('34900000-0000-4000-8000-000000000301', 'free_exercise_db', 'key349-run-1', 'key349-commit', repeat('a', 64)),
  ('34900000-0000-4000-8000-000000000302', 'free_exercise_db', 'key349-run-2', 'key349-commit', repeat('b', 64));

-- Payload builders. They live in the temporary schema, so nothing persists.
create function pg_temp.muscle(muscle text, muscle_role text default 'primary', muscle_weight numeric default 1)
returns jsonb language sql as $$
  select jsonb_build_object('muscle_id', muscle, 'role', muscle_role, 'weight', muscle_weight)
$$;

create function pg_temp.lift(ref text, lift_name text, muscles jsonb)
returns jsonb language sql as $$
  select jsonb_build_object(
    'source_ref', ref, 'name', lift_name, 'equipment', 'barbell', 'mechanic', 'compound',
    'muscles', muscles, 'raw', jsonb_build_object('id', ref, 'name', lift_name)
  )
$$;

create function pg_temp.bench_map(secondary_weight numeric default 0.6)
returns jsonb language sql as $$
  select jsonb_build_array(
    pg_temp.muscle('chest_lower'), pg_temp.muscle('chest_upper', 'secondary', secondary_weight),
    pg_temp.muscle('triceps', 'secondary', 0.5)
  )
$$;

create function pg_temp.squat_map()
returns jsonb language sql as $$
  select jsonb_build_array(pg_temp.muscle('quads'), pg_temp.muscle('glute_max', 'secondary', 0.5))
$$;

create function pg_temp.map_ids(ref text)
returns text language sql as $$
  select coalesce(string_agg(m.id::text, ',' order by m.id), '')
  from public.exercise_muscles m join public.exercises e on e.id = m.exercise_id
  where e.source = 'free_exercise_db' and e.source_ref = ref
$$;

-- Shape and privileges.
select has_function('public', 'import_exercises', array['uuid', 'jsonb'], 'import_exercises exists');
select ok(
  has_function_privilege('service_role', 'public.import_exercises(uuid, jsonb)', 'execute')
    and not has_function_privilege('authenticated', 'public.import_exercises(uuid, jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.import_exercises(uuid, jsonb)', 'execute')
    and (select not exists (select 1 from aclexplode(proacl) as privilege where privilege.grantee = 0) from pg_proc where oid = 'public.import_exercises(uuid, jsonb)'::regprocedure),
  'only the service role may execute import_exercises, and PUBLIC may not'
);
select ok(
  (select not prosecdef and proconfig = array['search_path=""'] from pg_proc where oid = 'public.import_exercises(uuid, jsonb)'::regprocedure),
  'import_exercises is security invoker with an empty search_path, so the service role grants decide what it may write'
);

set local role authenticated;
select throws_ok(
  $$ select public.import_exercises('34900000-0000-4000-8000-000000000301', '[]'::jsonb) $$,
  '42501',
  'permission denied for function import_exercises',
  'a signed-in user cannot call import_exercises'
);
reset role;

set local role service_role;

-- Refusals, which state the rule and quote no value.
select throws_ok(
  $$ select public.import_exercises('34900000-0000-4000-8000-000000000301', '{}'::jsonb) $$,
  '22023',
  'import_exercises needs the exercises as a JSON array',
  'the exercises must be an array'
);
select throws_ok(
  $$ select public.import_exercises('34900000-0000-4000-8000-000000000301', '["key349-text"]'::jsonb) $$,
  '22023',
  'every exercise must be a JSON object',
  'every exercise must be an object'
);

-- The first call creates both exercises with their maps and their source rows.
select is(
  public.import_exercises(
    '34900000-0000-4000-8000-000000000301',
    jsonb_build_array(
      pg_temp.lift('key349-bench', 'key349 bench', pg_temp.bench_map()),
      pg_temp.lift('key349-squat', 'key349 squat', pg_temp.squat_map())
    )
  ),
  '{"created": 2, "updated": 0, "unchanged": 0}'::jsonb,
  'the first call creates both exercises'
);
select is(
  (select count(*)::int || '/' || bool_and(owner_id is null and source = 'free_exercise_db' and deleted_at is null and equipment = 'barbell' and mechanic = 'compound')::text
   from public.exercises where source_ref in ('key349-bench', 'key349-squat')),
  '2/true',
  'both are global, live exercises with the given equipment and mechanic'
);
select is(
  (select string_agg(m.muscle_id || ':' || m.role || ':' || m.weight::text, ';' order by m.muscle_id)
   from public.exercise_muscles m join public.exercises e on e.id = m.exercise_id where e.source_ref = 'key349-bench'),
  'chest_lower:primary:1;chest_upper:secondary:0.6;triceps:secondary:0.5',
  'the bench has the map that was sent'
);
select is(
  (select bool_and(m.owner_id is null) from public.exercise_muscles m join public.exercises e on e.id = m.exercise_id where e.source_ref in ('key349-bench', 'key349-squat')),
  true,
  'the map rows of a global exercise have no owner'
);
select is(
  (select count(*)::int || '/' || bool_and(s.import_run_id = '34900000-0000-4000-8000-000000000301')::text || '/' || bool_and(s.raw ->> 'id' = e.source_ref)::text
   from public.exercise_source_data s join public.exercises e on e.id = s.exercise_id where e.source_ref in ('key349-bench', 'key349-squat')),
  '2/true/true',
  'each exercise has one source row that points at the run and holds the raw row'
);
select lives_ok(
  $$ set constraints public.exercise_has_primary_muscle immediate;
     set constraints public.exercise_has_primary_muscle deferred $$,
  'the created exercises pass the primary-muscle check'
);

-- The same call again leaves the maps exactly as they were, row for row.
select set_config('key349.bench_ids', pg_temp.map_ids('key349-bench'), true);
select set_config('key349.squat_ids', pg_temp.map_ids('key349-squat'), true);
select is(
  public.import_exercises(
    '34900000-0000-4000-8000-000000000302',
    jsonb_build_array(
      pg_temp.lift('key349-bench', 'key349 bench', pg_temp.bench_map()),
      pg_temp.lift('key349-squat', 'key349 squat', pg_temp.squat_map())
    )
  ),
  '{"created": 0, "updated": 0, "unchanged": 2}'::jsonb,
  'the same call again changes nothing'
);
select is(
  pg_temp.map_ids('key349-bench') || '|' || pg_temp.map_ids('key349-squat'),
  current_setting('key349.bench_ids') || '|' || current_setting('key349.squat_ids'),
  'and no map row was deleted or inserted'
);
select is(
  (select count(*)::int || '/' || bool_and(s.import_run_id = '34900000-0000-4000-8000-000000000302')::text
   from public.exercise_source_data s join public.exercises e on e.id = s.exercise_id where e.source_ref in ('key349-bench', 'key349-squat')),
  '2/true',
  'the source rows now point at the second run, and there is still one per exercise'
);

-- One changed weight replaces that exercise's map and no other.
select is(
  public.import_exercises(
    '34900000-0000-4000-8000-000000000302',
    jsonb_build_array(
      pg_temp.lift('key349-bench', 'key349 bench', pg_temp.bench_map(0.7)),
      pg_temp.lift('key349-squat', 'key349 squat', pg_temp.squat_map())
    )
  ),
  '{"created": 0, "updated": 1, "unchanged": 1}'::jsonb,
  'a changed weight updates that exercise and leaves the other alone'
);
select is(
  (select weight from public.exercise_muscles m join public.exercises e on e.id = m.exercise_id where e.source_ref = 'key349-bench' and m.muscle_id = 'chest_upper'),
  0.7::numeric,
  'the bench has the new weight'
);
select isnt(
  pg_temp.map_ids('key349-bench'),
  current_setting('key349.bench_ids'),
  'the bench map was replaced'
);
select is(
  pg_temp.map_ids('key349-squat'),
  current_setting('key349.squat_ids'),
  'the squat map was not touched'
);

-- A dropped muscle and an added one are changes too.
select is(
  public.import_exercises(
    '34900000-0000-4000-8000-000000000302',
    jsonb_build_array(pg_temp.lift('key349-squat', 'key349 squat', jsonb_build_array(pg_temp.muscle('quads'))))
  ),
  '{"created": 0, "updated": 1, "unchanged": 0}'::jsonb,
  'a dropped muscle changes the map'
);
select is(
  (select count(*)::int from public.exercise_muscles m join public.exercises e on e.id = m.exercise_id where e.source_ref = 'key349-squat'),
  1,
  'and the dropped muscle is gone'
);

-- A rename alone updates the exercise and keeps its map rows.
select set_config('key349.bench_ids', pg_temp.map_ids('key349-bench'), true);
select is(
  public.import_exercises(
    '34900000-0000-4000-8000-000000000302',
    jsonb_build_array(pg_temp.lift('key349-bench', 'key349 bench renamed', pg_temp.bench_map(0.7)))
  ),
  '{"created": 0, "updated": 1, "unchanged": 0}'::jsonb,
  'a new name updates the exercise'
);
select is(
  pg_temp.map_ids('key349-bench'),
  current_setting('key349.bench_ids'),
  'and keeps its map rows'
);

-- A soft deleted exercise that is in the file again is brought back.
update public.exercises set deleted_at = now() where source_ref = 'key349-bench';
select is(
  public.import_exercises(
    '34900000-0000-4000-8000-000000000302',
    jsonb_build_array(pg_temp.lift('key349-bench', 'key349 bench renamed', pg_temp.bench_map(0.7)))
  ),
  '{"created": 0, "updated": 1, "unchanged": 0}'::jsonb,
  'a soft deleted exercise that is imported again counts as updated'
);
select is(
  (select deleted_at from public.exercises where source_ref = 'key349-bench'),
  null,
  'and is live again'
);

-- A batch is all or nothing: one exercise with no primary muscle takes the good one before it back out.
select throws_ok(
  $$ select public.import_exercises(
       '34900000-0000-4000-8000-000000000302',
       jsonb_build_array(
         pg_temp.lift('key349-good', 'key349 good', pg_temp.squat_map()),
         pg_temp.lift('key349-no-primary', 'key349 no primary', jsonb_build_array(pg_temp.muscle('forearms', 'secondary', 0.5)))
       )
     );
     set constraints public.exercise_has_primary_muscle immediate $$,
  '23514',
  'an exercise needs at least one primary muscle',
  'an exercise whose map has no primary muscle is refused at commit'
);
select is(
  (select count(*)::int from public.exercises where source_ref in ('key349-good', 'key349-no-primary')),
  0,
  'and the exercise before it in the batch is not left behind'
);

reset role;

-- The exercise rows of this file are global and carry no owner, so an account deletion has nothing to do with them.
select is(
  (select count(*)::int from public.exercises where source_ref like 'key349-%' and owner_id is not null),
  0,
  'no exercise written by the function has an owner'
);

select * from finish();

rollback;
