-- Asserts public.record_checkin and public.record_targets, the only writers of expenditure_snapshots
-- and targets, and the service role's read grants (ADR 0003, Amendment 13): the privileges of the two
-- functions, `recorded` and `duplicate`, the rollback of a failed write, the schedule, the in-place
-- replacement of a start snapshot, `start_conflict`, the target dates and a hostile jsonb that names
-- another user's `user_id`, `program_id` and `expenditure_snapshot_id`.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so nothing
-- created here persists. Every fixture id starts with 61100000 and every email with key611-. The
-- privilege cases enter a role with `set local role` and leave it with `reset role`.
--
-- A snapshot and a target are health data. The fixtures are made up and no assertion name quotes a
-- value except where the value is the case under test (the 700 kcal that a check refuses). Every row
-- is found by its owner, never by a whole-table count.
--
-- Fixture users (the two hex digits that end each id): aa (one check-in), bb (the same check-in twice),
-- cc (a refused write), dd (a recompute with no start snapshot), ee (a start snapshot, then its
-- replacement), ff (start_conflict), 11 (the attacker), 22 (the victim), 33 (check-in dates), 44
-- (recompute dates), 55 (privileges), 66 (a null next date and the order of the days), 77 (an ended
-- program), 88 (a JSON null start snapshot). The user f0 is never created, so it has no profile.

begin;

select plan(146);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '61100000-0000-4000-8000-0000000000aa', 'authenticated', 'authenticated', 'key611-writers-aa@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '61100000-0000-4000-8000-0000000000bb', 'authenticated', 'authenticated', 'key611-writers-bb@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '61100000-0000-4000-8000-0000000000cc', 'authenticated', 'authenticated', 'key611-writers-cc@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '61100000-0000-4000-8000-0000000000dd', 'authenticated', 'authenticated', 'key611-writers-dd@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '61100000-0000-4000-8000-0000000000ee', 'authenticated', 'authenticated', 'key611-writers-ee@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '61100000-0000-4000-8000-0000000000ff', 'authenticated', 'authenticated', 'key611-writers-ff@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '61100000-0000-4000-8000-000000000011', 'authenticated', 'authenticated', 'key611-writers-11@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '61100000-0000-4000-8000-000000000022', 'authenticated', 'authenticated', 'key611-writers-22@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '61100000-0000-4000-8000-000000000033', 'authenticated', 'authenticated', 'key611-writers-33@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '61100000-0000-4000-8000-000000000044', 'authenticated', 'authenticated', 'key611-writers-44@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '61100000-0000-4000-8000-000000000055', 'authenticated', 'authenticated', 'key611-writers-55@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '61100000-0000-4000-8000-000000000066', 'authenticated', 'authenticated', 'key611-writers-66@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '61100000-0000-4000-8000-000000000077', 'authenticated', 'authenticated', 'key611-writers-77@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '61100000-0000-4000-8000-000000000088', 'authenticated', 'authenticated', 'key611-writers-88@keylow.test');

-- The ids of a fixture, from the two hex digits that name it: the user, its program and its snapshot.
create function pg_temp.user_id(suffix text) returns uuid language sql as
$$ select ('61100000-0000-4000-8000-0000000000' || suffix)::uuid $$;
create function pg_temp.program_id(suffix text) returns uuid language sql as
$$ select ('61100000-0000-4000-9000-0000000000' || suffix)::uuid $$;
create function pg_temp.snapshot_id(suffix text) returns uuid language sql as
$$ select ('61100000-0000-4000-a000-0000000000' || suffix)::uuid $$;

-- An active program of the user, made as postgres so only its constraints decide.
create function pg_temp.add_program(suffix text, next_date date) returns void language sql as
$$
  insert into public.programs (
    id, user_id, goal, rate_pct_per_week, protein_g_per_kg, fat_fraction_of_remaining, split_preset,
    started_on, next_checkin_date
  )
  values (pg_temp.program_id(suffix), pg_temp.user_id(suffix), 'maintain', 0, 1.6, 0.4, 'balanced', '2026-10-01', next_date)
$$;

-- A snapshot with a fixed id, made as postgres. A `start` row has no measurement.
create function pg_temp.add_snapshot(suffix text, as_of date, snapshot_kind text, mu numeric default 2300) returns void
language sql as
$$
  insert into public.expenditure_snapshots (
    id, user_id, program_id, as_of_date, kind, mu_kcal, var_kcal2, measurement, engine_version, params
  )
  values (
    pg_temp.snapshot_id(suffix), pg_temp.user_id(suffix), pg_temp.program_id(suffix), as_of, snapshot_kind, mu, 10000,
    case when snapshot_kind = 'start' then null else '{"eligible": false}'::jsonb end, 'test-1', '{}'
  )
$$;

-- A target of the user, made as postgres. A null `effective_to` makes it the current one.
create function pg_temp.add_target(suffix text, effective_from date, effective_to date, snapshot uuid default null) returns void
language sql as
$$
  insert into public.targets (
    user_id, program_id, expenditure_snapshot_id, effective_from, effective_to, calories_kcal, protein_g, fat_g, carbs_g,
    dow_calories_kcal, basis, engine_version, params
  )
  values (
    pg_temp.user_id(suffix), pg_temp.program_id(suffix), snapshot, effective_from, effective_to, 2000, 120, 70, 200,
    '{2000,2000,2000,2000,2000,2000,2000}', '{}', 'test-1', '{}'
  )
$$;

-- What `run-checkin` sends. A check-in snapshot carries an ineligible measurement, which is valid.
-- Each key names a column. An argument that is null becomes a JSON null, which the writers treat as
-- missing.
create function pg_temp.snapshot_json(program uuid, as_of date, mu numeric default 2400) returns jsonb language sql as
$$
  select jsonb_build_object(
    'program_id', program, 'as_of_date', as_of, 'mu_kcal', mu, 'var_kcal2', 10000,
    'measurement', jsonb_build_object('eligible', false), 'trend_weight_kg', 80,
    'engine_version', 'test-1', 'params', '{}'::jsonb
  )
$$;

-- A start snapshot has a JSON null measurement, as the engine sends it.
create function pg_temp.start_json(program uuid, as_of date, mu numeric default 2400) returns jsonb language sql as
$$
  select jsonb_build_object(
    'program_id', program, 'as_of_date', as_of, 'mu_kcal', mu, 'var_kcal2', 10000,
    'measurement', null::jsonb, 'trend_weight_kg', null::numeric,
    'engine_version', 'test-1', 'params', '{}'::jsonb
  )
$$;

create function pg_temp.targets_json(
  program uuid, from_date date default null, calories integer default 2000, snapshot uuid default null,
  days jsonb default jsonb_build_array(2000, 2000, 2000, 2000, 2000, 2000, 2000)
) returns jsonb language sql as
$$
  select jsonb_build_object(
    'program_id', program, 'effective_from', from_date, 'expenditure_snapshot_id', snapshot,
    'calories_kcal', calories, 'protein_g', 120, 'fat_g', 70, 'carbs_g', 200,
    'dow_calories_kcal', days,
    'basis', '{"source": "checkin"}'::jsonb, 'engine_version', 'test-1', 'params', '{}'::jsonb
  )
$$;

create function pg_temp.snapshot_count(suffix text, as_of date default null) returns integer language sql as
$$
  select count(*)::integer from public.expenditure_snapshots
    where user_id = pg_temp.user_id(suffix) and (as_of is null or as_of_date = as_of)
$$;

create function pg_temp.target_count(suffix text, current_only boolean default false) returns integer language sql as
$$
  select count(*)::integer from public.targets
    where user_id = pg_temp.user_id(suffix) and (not current_only or effective_to is null)
$$;

-- What record_targets answered, by fixture. A call is made before the select that compares its answer
-- with the table, because the arguments of one select all see the table as it was before the call.
create temporary table answered_targets (suffix text primary key, targets_id uuid);

-- The function itself: the signature, the result, the definer rights and the empty search path.
select has_function('public', 'record_checkin', array['uuid', 'jsonb', 'jsonb', 'date'], 'record_checkin exists');
select has_function('public', 'record_targets', array['uuid', 'jsonb', 'jsonb', 'date', 'integer'], 'record_targets exists');
select function_returns('public', 'record_checkin', array['uuid', 'jsonb', 'jsonb', 'date'], 'text', 'record_checkin returns text');
select function_returns('public', 'record_targets', array['uuid', 'jsonb', 'jsonb', 'date', 'integer'], 'uuid', 'record_targets returns uuid');
select is_definer('public', 'record_checkin', array['uuid', 'jsonb', 'jsonb', 'date'], 'record_checkin is security definer');
select is_definer('public', 'record_targets', array['uuid', 'jsonb', 'jsonb', 'date', 'integer'], 'record_targets is security definer');
select is(
  (select proconfig from pg_proc where oid = 'public.record_checkin(uuid, jsonb, jsonb, date)'::regprocedure),
  array['search_path=""'],
  'record_checkin runs with an empty search_path'
);
select is(
  (select proconfig from pg_proc where oid = 'public.record_targets(uuid, jsonb, jsonb, date, integer)'::regprocedure),
  array['search_path=""'],
  'record_targets runs with an empty search_path'
);

-- Privileges. Execute is held by the service role only, and PUBLIC holds none.
select function_privs_are('public', 'record_checkin', array['uuid', 'jsonb', 'jsonb', 'date'], 'anon', array[]::text[], 'anon cannot execute record_checkin');
select function_privs_are('public', 'record_checkin', array['uuid', 'jsonb', 'jsonb', 'date'], 'authenticated', array[]::text[], 'authenticated cannot execute record_checkin');
select function_privs_are('public', 'record_checkin', array['uuid', 'jsonb', 'jsonb', 'date'], 'service_role', array['EXECUTE'], 'service_role can execute record_checkin');
select function_privs_are('public', 'record_targets', array['uuid', 'jsonb', 'jsonb', 'date', 'integer'], 'anon', array[]::text[], 'anon cannot execute record_targets');
select function_privs_are('public', 'record_targets', array['uuid', 'jsonb', 'jsonb', 'date', 'integer'], 'authenticated', array[]::text[], 'authenticated cannot execute record_targets');
select function_privs_are('public', 'record_targets', array['uuid', 'jsonb', 'jsonb', 'date', 'integer'], 'service_role', array['EXECUTE'], 'service_role can execute record_targets');
select ok(
  not exists (
    select 1
    from pg_proc as writer, aclexplode(writer.proacl) as privilege
    where writer.oid in (
        'public.record_checkin(uuid, jsonb, jsonb, date)'::regprocedure,
        'public.record_targets(uuid, jsonb, jsonb, date, integer)'::regprocedure
      )
      and privilege.grantee = 0
  ),
  'PUBLIC holds no execute privilege on either writer'
);

select pg_temp.add_program('55', '2026-10-12');

set local role authenticated;
select throws_ok(
  $$select public.record_checkin(pg_temp.user_id('55'), '{}', '{}', null)$$,
  '42501',
  'permission denied for function record_checkin',
  'a call to record_checkin as authenticated is refused'
);
select throws_ok(
  $$select public.record_targets(pg_temp.user_id('55'), '{}', null, null, null)$$,
  '42501',
  'permission denied for function record_targets',
  'a call to record_targets as authenticated is refused'
);
reset role;

set local role anon;
select throws_ok(
  $$select public.record_checkin(pg_temp.user_id('55'), '{}', '{}', null)$$,
  '42501',
  'permission denied for function record_checkin',
  'a call to record_checkin as anon is refused'
);
select throws_ok(
  $$select public.record_targets(pg_temp.user_id('55'), '{}', null, null, null)$$,
  '42501',
  'permission denied for function record_targets',
  'a call to record_targets as anon is refused'
);
reset role;

set local role service_role;
select is(
  public.record_checkin(
    pg_temp.user_id('55'),
    pg_temp.snapshot_json(pg_temp.program_id('55'), '2026-10-12'),
    pg_temp.targets_json(pg_temp.program_id('55')),
    '2026-10-19'
  ),
  'recorded',
  'a call to record_checkin as service_role records the check-in'
);
select lives_ok(
  $$select public.record_targets(
    pg_temp.user_id('55'),
    pg_temp.targets_json(pg_temp.program_id('55'), '2026-10-13', 2100),
    null, null, null
  )$$,
  'a call to record_targets as service_role is accepted'
);
reset role;

-- The service role's reads, which run-checkin needs. Each table is read as the service role, and no
-- write privilege is added to any of them. day_totals is a security_invoker view, so reading it also
-- proves the grants on its source tables.
set local role service_role;
select lives_ok($$select 1 from public.profiles where id = pg_temp.user_id('55')$$, 'service_role selects from profiles');
select lives_ok($$select 1 from public.programs where user_id = pg_temp.user_id('55')$$, 'service_role selects from programs');
select lives_ok($$select 1 from public.weigh_ins where user_id = pg_temp.user_id('55')$$, 'service_role selects from weigh_ins');
select lives_ok($$select 1 from public.food_log_entries where user_id = pg_temp.user_id('55')$$, 'service_role selects from food_log_entries');
select lives_ok($$select 1 from public.day_logs where user_id = pg_temp.user_id('55')$$, 'service_role selects from day_logs');
select lives_ok($$select 1 from public.day_totals where user_id = pg_temp.user_id('55')$$, 'service_role selects from day_totals');
select lives_ok($$select 1 from public.expenditure_snapshots where user_id = pg_temp.user_id('55')$$, 'service_role selects from expenditure_snapshots');
select lives_ok($$select 1 from public.targets where user_id = pg_temp.user_id('55')$$, 'service_role selects from targets');
reset role;

select ok(
  has_table_privilege('service_role', 'public.profiles', 'select')
    and not has_table_privilege('service_role', 'public.profiles', 'insert')
    and not has_table_privilege('service_role', 'public.profiles', 'update')
    and not has_table_privilege('service_role', 'public.profiles', 'delete'),
  'service_role can select from profiles and cannot write it'
);
select ok(
  not exists (
    select 1
    from unnest(array['programs', 'weigh_ins', 'food_log_entries', 'day_logs', 'day_totals', 'expenditure_snapshots', 'targets']) as table_name
    where not has_table_privilege('service_role', 'public.' || table_name, 'select')
      or has_table_privilege('service_role', 'public.' || table_name, 'insert')
      or has_table_privilege('service_role', 'public.' || table_name, 'update')
      or has_table_privilege('service_role', 'public.' || table_name, 'delete')
  ),
  'service_role can select from every other table run-checkin reads and cannot write any of them'
);

-- No profile: the lock finds nothing, so the writer raises and writes nothing.
select throws_ok(
  $$select public.record_checkin(
    pg_temp.user_id('f0'),
    pg_temp.snapshot_json(pg_temp.program_id('f0'), '2026-10-12'),
    pg_temp.targets_json(pg_temp.program_id('f0')),
    '2026-10-19'
  )$$,
  'KL001',
  'no_profile',
  'record_checkin raises no_profile for a user with no profile'
);
select throws_ok(
  $$select public.record_targets(
    pg_temp.user_id('f0'), pg_temp.targets_json(pg_temp.program_id('f0'), '2026-10-12'), null, null, null
  )$$,
  'KL001',
  'no_profile',
  'record_targets raises no_profile for a user with no profile'
);

-- record_checkin once (aa): the snapshot, the new current target pointing at it, the previous target
-- closed on the new effective_from and the program's next date moved. The snapshot's own `kind` key
-- says `start` and is ignored, because this writer makes check-ins.
select pg_temp.add_program('aa', '2026-10-12');
select pg_temp.add_snapshot('aa', '2026-10-05', 'start');
select pg_temp.add_target('aa', '2026-10-05', null, pg_temp.snapshot_id('aa'));

select is(
  public.record_checkin(
    pg_temp.user_id('aa'),
    pg_temp.snapshot_json(pg_temp.program_id('aa'), '2026-10-12') || jsonb_build_object('kind', 'start'),
    pg_temp.targets_json(pg_temp.program_id('aa')),
    '2026-10-19'
  ),
  'recorded',
  'record_checkin answers recorded for a new check-in'
);
select is(pg_temp.snapshot_count('aa', '2026-10-12'), 1, 'the check-in made one snapshot for its date');
select is(
  (select kind from public.expenditure_snapshots where user_id = pg_temp.user_id('aa') and as_of_date = '2026-10-12'),
  'checkin',
  'the snapshot is a checkin row whatever kind the jsonb names'
);
select is(
  (select program_id from public.expenditure_snapshots where user_id = pg_temp.user_id('aa') and as_of_date = '2026-10-12'),
  pg_temp.program_id('aa'),
  'the snapshot names the program'
);
select is(
  (select jsonb_build_object(
      'mu_kcal', mu_kcal, 'var_kcal2', var_kcal2, 'trend_weight_kg', trend_weight_kg,
      'engine_version', engine_version, 'params', params, 'measurement', measurement
    )
    from public.expenditure_snapshots where user_id = pg_temp.user_id('aa') and as_of_date = '2026-10-12'),
  '{"mu_kcal": 2400, "var_kcal2": 10000, "trend_weight_kg": 80, "engine_version": "test-1", "params": {}, "measurement": {"eligible": false}}'::jsonb,
  'every snapshot column is built from its key'
);
select is(pg_temp.target_count('aa', true), 1, 'the user has one current target');
select is(
  (select expenditure_snapshot_id from public.targets where user_id = pg_temp.user_id('aa') and effective_to is null),
  (select id from public.expenditure_snapshots where user_id = pg_temp.user_id('aa') and as_of_date = '2026-10-12'),
  'the current target points at the new snapshot'
);
select is(
  (select program_id from public.targets where user_id = pg_temp.user_id('aa') and effective_to is null),
  pg_temp.program_id('aa'),
  'the current target names the program'
);
select is(
  (select effective_from from public.targets where user_id = pg_temp.user_id('aa') and effective_to is null),
  '2026-10-12'::date,
  'the current target takes effect on the check-in date'
);
select is(
  (select jsonb_build_object(
      'calories_kcal', calories_kcal, 'protein_g', protein_g, 'fat_g', fat_g, 'carbs_g', carbs_g,
      'dow_calories_kcal', dow_calories_kcal, 'basis', basis, 'engine_version', engine_version, 'params', params
    )
    from public.targets where user_id = pg_temp.user_id('aa') and effective_to is null),
  '{"calories_kcal": 2000, "protein_g": 120, "fat_g": 70, "carbs_g": 200, "dow_calories_kcal": [2000, 2000, 2000, 2000, 2000, 2000, 2000], "basis": {"source": "checkin"}, "engine_version": "test-1", "params": {}}'::jsonb,
  'every target column is built from its key'
);
select is(
  (select effective_to from public.targets where user_id = pg_temp.user_id('aa') and effective_from = '2026-10-05'),
  '2026-10-12'::date,
  'the previous target is closed on the new effective_from'
);
select is(
  (select next_checkin_date from public.programs where id = pg_temp.program_id('aa')),
  '2026-10-19'::date,
  'the next check-in date of the program moved'
);
select is(pg_temp.snapshot_count('aa'), 2, 'the user has the start snapshot and the check-in and nothing more');
select is(pg_temp.target_count('aa'), 2, 'the user has the previous target and the new one and nothing more');

-- The same check-in twice (bb): the second call answers duplicate and writes nothing, with a different
-- estimate, different targets and a different next date to show that none of them is applied. The first
-- call has no current target to close, so it only inserts.
select pg_temp.add_program('bb', '2026-10-12');

select is(
  public.record_checkin(
    pg_temp.user_id('bb'),
    pg_temp.snapshot_json(pg_temp.program_id('bb'), '2026-10-12'),
    pg_temp.targets_json(pg_temp.program_id('bb')),
    '2026-10-19'
  ),
  'recorded',
  'the first call answers recorded'
);
select is(pg_temp.target_count('bb', true), 1, 'with no previous target the first call inserts one current target');
select is(
  (select effective_from from public.targets where user_id = pg_temp.user_id('bb') and effective_to is null),
  '2026-10-12'::date,
  'with no previous target the new one takes effect on the check-in date'
);
select is(
  public.record_checkin(
    pg_temp.user_id('bb'),
    pg_temp.snapshot_json(pg_temp.program_id('bb'), '2026-10-12', 2500),
    pg_temp.targets_json(pg_temp.program_id('bb'), null, 2100),
    '2026-10-26'
  ),
  'duplicate',
  'the second call for the same user and date answers duplicate'
);
select is(pg_temp.snapshot_count('bb'), 1, 'the user still has one snapshot');
select is(pg_temp.target_count('bb'), 1, 'the user still has one target');
select is(pg_temp.target_count('bb', true), 1, 'the user still has one current target');
select is(
  (select mu_kcal from public.expenditure_snapshots where user_id = pg_temp.user_id('bb')),
  2400::numeric,
  'the duplicate did not change the snapshot'
);
select is(
  (select calories_kcal from public.targets where user_id = pg_temp.user_id('bb')),
  2000,
  'the duplicate did not change the target'
);
select is(
  (select next_checkin_date from public.programs where id = pg_temp.program_id('bb')),
  '2026-10-19'::date,
  'the duplicate did not move the next check-in date'
);

-- A refused write (cc): a target that a check refuses rolls back the whole call, so the snapshot is not
-- left behind, the current target stays current and the program's date stays put.
select pg_temp.add_program('cc', '2026-10-12');
select pg_temp.add_snapshot('cc', '2026-10-05', 'start');
select pg_temp.add_target('cc', '2026-10-05', null, pg_temp.snapshot_id('cc'));

select throws_ok(
  $$select public.record_checkin(
    pg_temp.user_id('cc'),
    pg_temp.snapshot_json(pg_temp.program_id('cc'), '2026-10-12'),
    pg_temp.targets_json(pg_temp.program_id('cc'), null, 700),
    '2026-10-19'
  )$$,
  '23514',
  'new row for relation "targets" violates check constraint "targets_calories_kcal_check"',
  'a target refused by its check fails the call'
);
select is(pg_temp.snapshot_count('cc', '2026-10-12'), 0, 'no snapshot is left behind by the refused call');
select is(pg_temp.snapshot_count('cc'), 1, 'the user has only the start snapshot');
select is(pg_temp.target_count('cc'), 1, 'the user has only the previous target');
select is(
  (select effective_to from public.targets where user_id = pg_temp.user_id('cc')),
  null::date,
  'the previous target is still current'
);
select is(
  (select next_checkin_date from public.programs where id = pg_temp.program_id('cc')),
  '2026-10-12'::date,
  'the refused call did not move the next check-in date'
);
select throws_ok(
  $$select public.record_checkin(
    pg_temp.user_id('cc'),
    pg_temp.snapshot_json(pg_temp.program_id('cc'), '2026-10-12') || jsonb_build_object('measurement', null::jsonb),
    pg_temp.targets_json(pg_temp.program_id('cc')),
    '2026-10-19'
  )$$,
  '23514',
  'new row for relation "expenditure_snapshots" violates check constraint "expenditure_snapshots_measurement_kind_check"',
  'a JSON null measurement is a missing measurement, which a check-in cannot have'
);
select is(pg_temp.snapshot_count('cc'), 1, 'the second refused call left no snapshot either');

-- A catch-up check-in (33): the new target takes effect on the later of the check-in date and the
-- current row's effective_from, so the current row (from the 20th) closes at its own start and the
-- intervals never overlap.
select pg_temp.add_program('33', '2026-10-12');
select pg_temp.add_snapshot('33', '2026-10-20', 'start');
select pg_temp.add_target('33', '2026-10-20', null, pg_temp.snapshot_id('33'));

select is(
  public.record_checkin(
    pg_temp.user_id('33'),
    pg_temp.snapshot_json(pg_temp.program_id('33'), '2026-10-12'),
    pg_temp.targets_json(pg_temp.program_id('33')),
    '2026-10-19'
  ),
  'recorded',
  'a check-in for a date before the current target takes effect is recorded'
);
select is(pg_temp.target_count('33', true), 1, 'the user has one current target');
select is(
  (select effective_from from public.targets where user_id = pg_temp.user_id('33') and effective_to is null),
  '2026-10-20'::date,
  'the new target takes effect on the current target''s effective_from'
);
select is(
  (select effective_to from public.targets where user_id = pg_temp.user_id('33') and effective_to is not null),
  '2026-10-20'::date,
  'the old target closes at its own effective_from, an empty interval'
);

-- record_targets with no start snapshot (dd): it closes the current target and inserts the new one,
-- pointing at the snapshot that p_targets names. A null date and a null weekday leave both alone.
select pg_temp.add_program('dd', '2026-11-01');
update public.profiles set checkin_weekday = 2 where id = pg_temp.user_id('dd');
select pg_temp.add_snapshot('dd', '2026-10-05', 'start');
select pg_temp.add_target('dd', '2026-10-05', null, pg_temp.snapshot_id('dd'));

insert into answered_targets
  select 'dd', public.record_targets(
    pg_temp.user_id('dd'),
    pg_temp.targets_json(pg_temp.program_id('dd'), '2026-10-12', 2100, pg_temp.snapshot_id('dd')),
    null, null, null
  );
select is(
  (select targets_id from answered_targets where suffix = 'dd'),
  (select id from public.targets where user_id = pg_temp.user_id('dd') and effective_to is null),
  'record_targets answers the id of the new current target'
);
select is(pg_temp.target_count('dd'), 2, 'the user has the previous target and the new one');
select is(pg_temp.target_count('dd', true), 1, 'the user has one current target');
select is(
  (select calories_kcal from public.targets where user_id = pg_temp.user_id('dd') and effective_to is null),
  2100,
  'the new target holds the new calories'
);
select is(
  (select expenditure_snapshot_id from public.targets where user_id = pg_temp.user_id('dd') and effective_to is null),
  pg_temp.snapshot_id('dd'),
  'the new target points at the snapshot that p_targets names'
);
select is(
  (select effective_to from public.targets where user_id = pg_temp.user_id('dd') and effective_from = '2026-10-05'),
  '2026-10-12'::date,
  'the previous target is closed on the new effective_from'
);
select is(pg_temp.snapshot_count('dd'), 1, 'no snapshot was written');
select is(
  (select next_checkin_date from public.programs where id = pg_temp.program_id('dd')),
  '2026-11-01'::date,
  'a null next date leaves the program alone'
);
select is(
  (select checkin_weekday from public.profiles where id = pg_temp.user_id('dd')),
  2,
  'a null weekday leaves the profile alone'
);

-- The dates of a recompute (44): the later of the date given and the current row's effective_from, both
-- for a date before it and for a date after it.
select pg_temp.add_program('44', '2026-11-01');
select pg_temp.add_target('44', '2026-10-20', null);

select lives_ok(
  $$select public.record_targets(
    pg_temp.user_id('44'), pg_temp.targets_json(pg_temp.program_id('44'), '2026-10-12'), null, null, null
  )$$,
  'a recompute dated before the current target is accepted'
);
select is(
  (select effective_from from public.targets where user_id = pg_temp.user_id('44') and effective_to is null),
  '2026-10-20'::date,
  'a date before the current target takes effect on its effective_from'
);
select lives_ok(
  $$select public.record_targets(
    pg_temp.user_id('44'), pg_temp.targets_json(pg_temp.program_id('44'), '2026-10-25'), null, null, null
  )$$,
  'a recompute dated after the current target is accepted'
);
select is(
  (select effective_from from public.targets where user_id = pg_temp.user_id('44') and effective_to is null),
  '2026-10-25'::date,
  'a date after the current target takes effect on that date'
);
select is(
  (select array_agg(effective_to order by effective_from, effective_to nulls last) from public.targets where user_id = pg_temp.user_id('44')),
  array['2026-10-20', '2026-10-25', null]::date[],
  'the three targets close one after another with no overlap'
);

-- record_targets with a start snapshot (ee): it writes the snapshot, points the new target at it and
-- sets the program's next date and the profile's weekday.
select pg_temp.add_program('ee', null);

insert into answered_targets
  select 'ee', public.record_targets(
    pg_temp.user_id('ee'),
    pg_temp.targets_json(pg_temp.program_id('ee'), '2026-10-05'),
    pg_temp.start_json(pg_temp.program_id('ee'), '2026-10-05'),
    '2026-10-19',
    1
  );
select is(
  (select targets_id from answered_targets where suffix = 'ee'),
  (select id from public.targets where user_id = pg_temp.user_id('ee') and effective_to is null),
  'record_targets with a start snapshot answers the id of the new current target'
);
select is(pg_temp.snapshot_count('ee'), 1, 'the start snapshot was written');
select is(
  (select kind from public.expenditure_snapshots where user_id = pg_temp.user_id('ee')),
  'start',
  'the snapshot is a start row'
);
select is(
  (select measurement is null from public.expenditure_snapshots where user_id = pg_temp.user_id('ee')),
  true,
  'a JSON null measurement is stored as a null column'
);
select is(
  (select expenditure_snapshot_id from public.targets where user_id = pg_temp.user_id('ee') and effective_to is null),
  (select id from public.expenditure_snapshots where user_id = pg_temp.user_id('ee')),
  'the new target points at the start snapshot'
);
select is(pg_temp.target_count('ee'), 1, 'with no previous target the call only inserts');
select is(
  (select next_checkin_date from public.programs where id = pg_temp.program_id('ee')),
  '2026-10-19'::date,
  'the program''s next date was set'
);
select is(
  (select checkin_weekday from public.profiles where id = pg_temp.user_id('ee')),
  1,
  'the profile''s weekday was set'
);

-- A second start snapshot on the same date replaces the first in place: the id and created_at stay, the
-- estimate changes, and the new target points at the same row. The expenditure_snapshot_id in p_targets
-- names a snapshot that does not exist and is ignored when a start snapshot is given.
update public.expenditure_snapshots set created_at = '2026-10-06 12:00:00+00' where user_id = pg_temp.user_id('ee');
create temporary table first_start_snapshot as
  select id from public.expenditure_snapshots where user_id = pg_temp.user_id('ee');

select lives_ok(
  $$select public.record_targets(
    pg_temp.user_id('ee'),
    pg_temp.targets_json(pg_temp.program_id('ee'), '2026-10-05', 2050, pg_temp.snapshot_id('fe')),
    pg_temp.start_json(pg_temp.program_id('ee'), '2026-10-05', 2500),
    null,
    null
  )$$,
  'a second start snapshot on the same date is accepted'
);
select is(pg_temp.snapshot_count('ee'), 1, 'the user still has one snapshot');
select is(
  (select id from public.expenditure_snapshots where user_id = pg_temp.user_id('ee')),
  (select id from first_start_snapshot),
  'the replacement kept the snapshot''s id'
);
select is(
  (select created_at from public.expenditure_snapshots where user_id = pg_temp.user_id('ee')),
  '2026-10-06 12:00:00+00'::timestamptz,
  'the replacement kept the snapshot''s created_at'
);
select is(
  (select mu_kcal from public.expenditure_snapshots where user_id = pg_temp.user_id('ee')),
  2500::numeric,
  'the replacement changed the estimate'
);
select is(
  (select expenditure_snapshot_id from public.targets where user_id = pg_temp.user_id('ee') and effective_to is null),
  (select id from first_start_snapshot),
  'the new target points at the replaced snapshot'
);
select is(pg_temp.target_count('ee'), 2, 'the user has the first target and the new one');
select is(pg_temp.target_count('ee', true), 1, 'the user has one current target');
select is(
  (select effective_to from public.targets where user_id = pg_temp.user_id('ee') and calories_kcal = 2000),
  '2026-10-05'::date,
  'a replacement on the same day closes the old target at its own effective_from'
);
select is(
  (select next_checkin_date from public.programs where id = pg_temp.program_id('ee')),
  '2026-10-19'::date,
  'a null next date left the program''s date alone'
);
select is(
  (select checkin_weekday from public.profiles where id = pg_temp.user_id('ee')),
  1,
  'a null weekday left the profile alone'
);

-- A start snapshot on a date that already has a check-in raises start_conflict and changes nothing (ff).
select pg_temp.add_program('ff', '2026-10-12');
select pg_temp.add_snapshot('ff', '2026-10-12', 'checkin');
select pg_temp.add_target('ff', '2026-10-05', null);

select throws_ok(
  $$select public.record_targets(
    pg_temp.user_id('ff'),
    pg_temp.targets_json(pg_temp.program_id('ff'), '2026-10-12'),
    pg_temp.start_json(pg_temp.program_id('ff'), '2026-10-12', 2500),
    '2026-10-19',
    3
  )$$,
  'KL003',
  'start_conflict',
  'a start snapshot on the date of a check-in raises start_conflict'
);
select is(
  (select kind from public.expenditure_snapshots where user_id = pg_temp.user_id('ff')),
  'checkin',
  'the check-in snapshot is still a checkin row'
);
select is(
  (select mu_kcal from public.expenditure_snapshots where user_id = pg_temp.user_id('ff')),
  2300::numeric,
  'the check-in snapshot was not changed'
);
select is(pg_temp.snapshot_count('ff'), 1, 'no snapshot was added');
select is(pg_temp.target_count('ff'), 1, 'no target was added');
select is(pg_temp.target_count('ff', true), 1, 'the previous target is still current');
select is(
  (select next_checkin_date from public.programs where id = pg_temp.program_id('ff')),
  '2026-10-12'::date,
  'the refused call did not move the next check-in date'
);
select is(
  (select checkin_weekday from public.profiles where id = pg_temp.user_id('ff')),
  null::integer,
  'the refused call did not set the weekday'
);

-- A null next date (66): record_checkin leaves the program's date alone, as record_targets does. The seven
-- days are all different, so the stored array proves the order of the elements.
select pg_temp.add_program('66', '2026-10-12');

select is(
  public.record_checkin(
    pg_temp.user_id('66'),
    pg_temp.snapshot_json(pg_temp.program_id('66'), '2026-10-12'),
    pg_temp.targets_json(
      pg_temp.program_id('66'), null, 2000, null, jsonb_build_array(2101, 2102, 2103, 2104, 2105, 2106, 2107)
    ),
    null
  ),
  'recorded',
  'record_checkin with a null next date records the check-in'
);
select is(
  (select next_checkin_date from public.programs where id = pg_temp.program_id('66')),
  '2026-10-12'::date,
  'a null next date leaves the program''s date alone'
);
select is(
  (select dow_calories_kcal from public.targets where user_id = pg_temp.user_id('66') and effective_to is null),
  array[2101, 2102, 2103, 2104, 2105, 2106, 2107],
  'the days are stored in the order they were sent'
);

-- An ended program (77): a check-in for it writes nothing. This is what a check-in that races the user
-- saving their own targets meets, because saving them ends the program.
select pg_temp.add_program('77', '2026-10-12');
select pg_temp.add_snapshot('77', '2026-10-05', 'start');
select pg_temp.add_target('77', '2026-10-05', null, pg_temp.snapshot_id('77'));
update public.programs set ended_on = '2026-10-10' where id = pg_temp.program_id('77');

select is(
  public.record_checkin(
    pg_temp.user_id('77'),
    pg_temp.snapshot_json(pg_temp.program_id('77'), '2026-10-12'),
    pg_temp.targets_json(pg_temp.program_id('77')),
    '2026-10-19'
  ),
  'program_ended',
  'record_checkin answers program_ended for an ended program'
);
select is(pg_temp.snapshot_count('77'), 1, 'no snapshot was written for the ended program');
select is(pg_temp.target_count('77'), 1, 'no target was written for the ended program');
select is(
  (select effective_to from public.targets where user_id = pg_temp.user_id('77')),
  null::date,
  'the current target of the ended program is unchanged'
);
select is(
  (select next_checkin_date from public.programs where id = pg_temp.program_id('77')),
  '2026-10-12'::date,
  'the date of the ended program did not move'
);
select throws_ok(
  $$select public.record_checkin(
    pg_temp.user_id('11'),
    pg_temp.snapshot_json(pg_temp.program_id('77'), '2026-10-12'),
    pg_temp.targets_json(pg_temp.program_id('77')),
    '2026-10-19'
  )$$,
  'KL002',
  'not_owner',
  'another user''s ended program is still refused as not_owner'
);

-- A JSON null start snapshot (88) is no start snapshot: the targets point at the snapshot they name.
select pg_temp.add_program('88', '2026-11-01');
select pg_temp.add_snapshot('88', '2026-10-05', 'start');
select pg_temp.add_target('88', '2026-10-05', null, pg_temp.snapshot_id('88'));

select lives_ok(
  $$select public.record_targets(
    pg_temp.user_id('88'),
    pg_temp.targets_json(pg_temp.program_id('88'), '2026-10-12', 2100, pg_temp.snapshot_id('88')),
    'null'::jsonb, null, null
  )$$,
  'a JSON null start snapshot is accepted'
);
select is(pg_temp.snapshot_count('88'), 1, 'a JSON null start snapshot writes no snapshot');
select is(
  (select expenditure_snapshot_id from public.targets where user_id = pg_temp.user_id('88') and effective_to is null),
  pg_temp.snapshot_id('88'),
  'the new target points at the snapshot that p_targets names'
);

-- A hostile jsonb (11 attacks 22). The victim has a program, a snapshot and a current target. Every
-- way of naming the victim's program or snapshot is refused with not_owner, and nothing changes.
select pg_temp.add_program('11', '2026-10-12');
select pg_temp.add_program('22', '2026-10-12');
select pg_temp.add_snapshot('22', '2026-10-05', 'start');
select pg_temp.add_target('22', '2026-10-05', null, pg_temp.snapshot_id('22'));

select throws_ok(
  $$select public.record_checkin(
    pg_temp.user_id('11'),
    pg_temp.snapshot_json(pg_temp.program_id('22'), '2026-10-12'),
    pg_temp.targets_json(pg_temp.program_id('22')),
    '2026-10-19'
  )$$,
  'KL002',
  'not_owner',
  'record_checkin refuses a snapshot that names another user''s program'
);
select throws_ok(
  $$select public.record_targets(
    pg_temp.user_id('11'), pg_temp.targets_json(pg_temp.program_id('22'), '2026-10-12'), null, '2026-10-19', null
  )$$,
  'KL002',
  'not_owner',
  'record_targets refuses targets that name another user''s program'
);
select throws_ok(
  $$select public.record_targets(
    pg_temp.user_id('11'),
    pg_temp.targets_json(pg_temp.program_id('11'), '2026-10-12', 2000, pg_temp.snapshot_id('22')),
    null, null, null
  )$$,
  'KL002',
  'not_owner',
  'record_targets refuses targets that point at another user''s snapshot'
);
select throws_ok(
  $$select public.record_targets(
    pg_temp.user_id('11'),
    pg_temp.targets_json(pg_temp.program_id('11'), '2026-10-12'),
    pg_temp.start_json(pg_temp.program_id('22'), '2026-10-12'),
    null, null
  )$$,
  'KL002',
  'not_owner',
  'record_targets refuses a start snapshot that names another user''s program'
);
select throws_ok(
  $$select public.record_checkin(
    pg_temp.user_id('11'),
    pg_temp.snapshot_json(null, '2026-10-12'),
    pg_temp.targets_json(null),
    '2026-10-19'
  )$$,
  'KL002',
  'not_owner',
  'record_checkin refuses a snapshot that names no program'
);
select is(pg_temp.snapshot_count('11'), 0, 'the refused calls left the attacker no snapshot');
select is(pg_temp.target_count('11'), 0, 'the refused calls left the attacker no target');
select is(pg_temp.snapshot_count('22'), 1, 'the victim still has one snapshot');
select is(pg_temp.target_count('22'), 1, 'the victim still has one target');
select is(pg_temp.target_count('22', true), 1, 'the victim''s target is still current');
select is(
  (select next_checkin_date from public.programs where id = pg_temp.program_id('22')),
  '2026-10-12'::date,
  'the victim''s next check-in date did not move'
);

-- A jsonb that names the victim as the owner, and sets the id, created_at and effective_to, gets none of
-- them: the rows belong to the caller and the columns take their own values.
select is(
  public.record_checkin(
    pg_temp.user_id('11'),
    pg_temp.snapshot_json(pg_temp.program_id('11'), '2026-10-12') || jsonb_build_object(
      'user_id', pg_temp.user_id('22'), 'id', pg_temp.snapshot_id('ab'), 'created_at', '2000-01-01T00:00:00Z'
    ),
    pg_temp.targets_json(pg_temp.program_id('11')) || jsonb_build_object(
      'user_id', pg_temp.user_id('22'), 'id', pg_temp.snapshot_id('ab'), 'created_at', '2000-01-01T00:00:00Z',
      'effective_to', '2026-12-31'
    ),
    '2026-10-19'
  ),
  'recorded',
  'record_checkin accepts a jsonb that also names the victim as the owner'
);
select is(pg_temp.snapshot_count('11', '2026-10-12'), 1, 'the snapshot belongs to the caller');
select is(pg_temp.target_count('11', true), 1, 'the target belongs to the caller and is current');
select is(
  (select count(*)::integer from public.expenditure_snapshots
    where id = pg_temp.snapshot_id('ab') or created_at < '2001-01-01'),
  0,
  'the snapshot took its own id and created_at'
);
select is(
  (select count(*)::integer from public.targets
    where id = pg_temp.snapshot_id('ab') or created_at < '2001-01-01'),
  0,
  'the target took its own id and created_at'
);
select is(pg_temp.snapshot_count('22'), 1, 'the victim still has one snapshot after the hostile check-in');
select is(pg_temp.target_count('22'), 1, 'the victim still has one target after the hostile check-in');
select is(
  (select next_checkin_date from public.programs where id = pg_temp.program_id('11')),
  '2026-10-19'::date,
  'the caller''s own program moved'
);
select is(
  (select next_checkin_date from public.programs where id = pg_temp.program_id('22')),
  '2026-10-12'::date,
  'the victim''s program did not move'
);

select lives_ok(
  $$select public.record_targets(
    pg_temp.user_id('11'),
    pg_temp.targets_json(pg_temp.program_id('11'), '2026-10-13') || jsonb_build_object('user_id', pg_temp.user_id('22')),
    pg_temp.start_json(pg_temp.program_id('11'), '2026-10-13') || jsonb_build_object('user_id', pg_temp.user_id('22')),
    null, null
  )$$,
  'record_targets accepts a jsonb that also names the victim as the owner'
);
select is(pg_temp.snapshot_count('11'), 2, 'the start snapshot belongs to the caller');
select is(pg_temp.target_count('22'), 1, 'the victim still has one target after the hostile recompute');
select is(pg_temp.snapshot_count('22'), 1, 'the victim still has one snapshot after the hostile recompute');

select * from finish();

rollback;
