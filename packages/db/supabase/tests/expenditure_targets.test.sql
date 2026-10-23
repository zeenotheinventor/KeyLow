-- Asserts public.expenditure_snapshots and public.targets, and the check on profiles.checkin_weekday
-- (ADR 0003, Amendment 13): the columns, the checks, the unique key, the indexes, the select-only
-- privileges, the owner-only policies, the cascade from the auth user and the set null from a program
-- and a snapshot.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so nothing
-- created here persists. Every fixture id starts with 61000000 and every email with key610-. Each
-- actor is entered with `set local role` plus the JWT claims that `auth.uid()` reads, and left with
-- `reset role`.
--
-- A snapshot and a target are health data. The fixtures are made up and no assertion name quotes a
-- value except where the value is the case under test (the bounds of a check). Every row is found by
-- its owner, never by a whole-table count.
--
-- The migration sets a `checkin_weekday` outside 1 to 7 to null before it adds the check. That step
-- runs inside the migration, before any test can run, so it is proved by hand in the pull request and
-- not here.
--
-- Fixture users: a and b (row level security), c (account deletion), d (the checks of snapshots), e
-- (the checks of targets), f (the set null cases), g (the check on checkin_weekday).

begin;

select plan(246);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '61000000-0000-4000-8000-0000000000aa', 'authenticated', 'authenticated', 'key610-targets-a@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '61000000-0000-4000-8000-0000000000bb', 'authenticated', 'authenticated', 'key610-targets-b@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '61000000-0000-4000-8000-0000000000cc', 'authenticated', 'authenticated', 'key610-targets-c@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '61000000-0000-4000-8000-0000000000dd', 'authenticated', 'authenticated', 'key610-targets-d@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '61000000-0000-4000-8000-0000000000ee', 'authenticated', 'authenticated', 'key610-targets-e@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '61000000-0000-4000-8000-0000000000ff', 'authenticated', 'authenticated', 'key610-targets-f@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '61000000-0000-4000-8000-000000000011', 'authenticated', 'authenticated', 'key610-targets-g@keylow.test');

-- One snapshot, with every column a case does not name set to a value that passes. It runs as whoever
-- calls it, postgres in the cases below, so it is the table's constraints that decide and not its
-- grants. The default measurement is an ineligible one, which is valid on a `checkin` row. A `start`
-- case passes `measure => null` explicitly.
create function pg_temp.add_snapshot(
  owner uuid,
  as_of date,
  snapshot_kind text default 'checkin',
  mu numeric default 2400,
  variance numeric default 10000,
  measure jsonb default '{"eligible": false}',
  trend numeric default null,
  program uuid default null
)
returns void
language sql
as $$
  insert into public.expenditure_snapshots (
    user_id, program_id, as_of_date, kind, mu_kcal, var_kcal2, measurement, trend_weight_kg, engine_version, params
  )
  values (owner, program, as_of, snapshot_kind, mu, variance, measure, trend, 'test-1', '{}')
$$;

-- One target, with every column a case does not name set to a value that passes. `effective_to`
-- defaults to a date so that rows made by the check cases never meet the one-current index. The cases
-- of that index pass null explicitly.
create function pg_temp.add_target(
  owner uuid,
  effective_from date default '2026-10-01',
  effective_to date default '2026-10-31',
  calories integer default 2000,
  protein numeric default 120,
  fat numeric default 70,
  carbs numeric default 200,
  day_calories integer[] default '{2000,2000,2000,2000,2000,2000,2000}',
  program uuid default null,
  snapshot uuid default null
)
returns void
language sql
as $$
  insert into public.targets (
    user_id, program_id, expenditure_snapshot_id, effective_from, effective_to, calories_kcal, protein_g,
    fat_g, carbs_g, dow_calories_kcal, basis, engine_version, params
  )
  values (
    owner, program, snapshot, effective_from, effective_to, calories, protein, fat, carbs, day_calories,
    '{}', 'test-1', '{}'
  )
$$;

-- The number of rows a statement affected, for the cases where row level security makes an update or
-- a delete match nothing instead of raising an error.
create function pg_temp.affected_rows(statement text)
returns bigint
language plpgsql
as $$
declare
  affected bigint;
begin
  execute statement;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- Shape: expenditure_snapshots.
select has_table('public', 'expenditure_snapshots', 'expenditure_snapshots exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.expenditure_snapshots'::regclass),
  'row level security is enabled on expenditure_snapshots'
);
select columns_are(
  'public',
  'expenditure_snapshots',
  array[
    'id', 'user_id', 'program_id', 'as_of_date', 'kind', 'mu_kcal', 'var_kcal2', 'measurement',
    'trend_weight_kg', 'engine_version', 'params', 'created_at'
  ],
  'expenditure_snapshots has the amendment''s columns'
);
select col_is_pk('public', 'expenditure_snapshots', 'id', 'the primary key is id');
select col_type_is('public', 'expenditure_snapshots', 'id', 'uuid', 'id is a uuid');
select col_default_is('public', 'expenditure_snapshots', 'id', 'gen_random_uuid()', 'id defaults to a random uuid');
select col_type_is('public', 'expenditure_snapshots', 'user_id', 'uuid', 'user_id is a uuid');
select col_not_null('public', 'expenditure_snapshots', 'user_id', 'user_id is not null');
select col_hasnt_default('public', 'expenditure_snapshots', 'user_id', 'user_id has no default, because no client inserts');
select fk_ok('public', 'expenditure_snapshots', 'user_id', 'auth', 'users', 'id', 'user_id references auth.users');
select is(
  (select confdeltype::text from pg_constraint where conrelid = 'public.expenditure_snapshots'::regclass and conname = 'expenditure_snapshots_user_id_fkey'),
  'c',
  'the user_id foreign key cascades on delete'
);
select col_type_is('public', 'expenditure_snapshots', 'program_id', 'uuid', 'program_id is a uuid');
select col_is_null('public', 'expenditure_snapshots', 'program_id', 'program_id is nullable');
select col_hasnt_default('public', 'expenditure_snapshots', 'program_id', 'program_id has no default');
select fk_ok('public', 'expenditure_snapshots', 'program_id', 'public', 'programs', 'id', 'program_id references programs');
select is(
  (select confdeltype::text from pg_constraint where conrelid = 'public.expenditure_snapshots'::regclass and conname = 'expenditure_snapshots_program_id_fkey'),
  'n',
  'the program_id foreign key sets null on delete'
);
select col_type_is('public', 'expenditure_snapshots', 'as_of_date', 'date', 'as_of_date is a date');
select col_not_null('public', 'expenditure_snapshots', 'as_of_date', 'as_of_date is not null');
select col_hasnt_default('public', 'expenditure_snapshots', 'as_of_date', 'as_of_date has no default');
select col_type_is('public', 'expenditure_snapshots', 'kind', 'text', 'kind is text and not an enum');
select col_not_null('public', 'expenditure_snapshots', 'kind', 'kind is not null');
select col_hasnt_default('public', 'expenditure_snapshots', 'kind', 'kind has no default');
select col_type_is('public', 'expenditure_snapshots', 'mu_kcal', 'numeric', 'mu_kcal is numeric');
select col_not_null('public', 'expenditure_snapshots', 'mu_kcal', 'mu_kcal is not null');
select col_hasnt_default('public', 'expenditure_snapshots', 'mu_kcal', 'mu_kcal has no default');
select col_type_is('public', 'expenditure_snapshots', 'var_kcal2', 'numeric', 'var_kcal2 is numeric');
select col_not_null('public', 'expenditure_snapshots', 'var_kcal2', 'var_kcal2 is not null');
select col_hasnt_default('public', 'expenditure_snapshots', 'var_kcal2', 'var_kcal2 has no default');
select col_type_is('public', 'expenditure_snapshots', 'measurement', 'jsonb', 'measurement is jsonb');
select col_is_null('public', 'expenditure_snapshots', 'measurement', 'measurement is nullable');
select col_hasnt_default('public', 'expenditure_snapshots', 'measurement', 'measurement has no default');
select col_type_is('public', 'expenditure_snapshots', 'trend_weight_kg', 'numeric', 'trend_weight_kg is numeric');
select col_is_null('public', 'expenditure_snapshots', 'trend_weight_kg', 'trend_weight_kg is nullable');
select col_hasnt_default('public', 'expenditure_snapshots', 'trend_weight_kg', 'trend_weight_kg has no default');
select col_type_is('public', 'expenditure_snapshots', 'engine_version', 'text', 'engine_version is text');
select col_not_null('public', 'expenditure_snapshots', 'engine_version', 'engine_version is not null');
select col_hasnt_default('public', 'expenditure_snapshots', 'engine_version', 'engine_version has no default');
select col_type_is('public', 'expenditure_snapshots', 'params', 'jsonb', 'params is jsonb');
select col_not_null('public', 'expenditure_snapshots', 'params', 'params is not null');
select col_hasnt_default('public', 'expenditure_snapshots', 'params', 'params has no default');
select col_type_is('public', 'expenditure_snapshots', 'created_at', 'timestamp with time zone', 'created_at is a timestamptz');
select col_not_null('public', 'expenditure_snapshots', 'created_at', 'created_at is not null');
select col_default_is('public', 'expenditure_snapshots', 'created_at', 'now()', 'created_at defaults to now()');
select is(
  (select count(*)::int from pg_trigger where tgrelid = 'public.expenditure_snapshots'::regclass and not tgisinternal),
  0,
  'expenditure_snapshots has no trigger'
);

-- Shape: targets.
select has_table('public', 'targets', 'targets exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.targets'::regclass),
  'row level security is enabled on targets'
);
select columns_are(
  'public',
  'targets',
  array[
    'id', 'user_id', 'program_id', 'expenditure_snapshot_id', 'effective_from', 'effective_to', 'calories_kcal',
    'protein_g', 'fat_g', 'carbs_g', 'dow_calories_kcal', 'basis', 'engine_version', 'params', 'created_at'
  ],
  'targets has the amendment''s columns'
);
select col_is_pk('public', 'targets', 'id', 'the primary key is id');
select col_type_is('public', 'targets', 'id', 'uuid', 'id is a uuid');
select col_default_is('public', 'targets', 'id', 'gen_random_uuid()', 'id defaults to a random uuid');
select col_type_is('public', 'targets', 'user_id', 'uuid', 'user_id is a uuid');
select col_not_null('public', 'targets', 'user_id', 'user_id is not null');
select col_hasnt_default('public', 'targets', 'user_id', 'user_id has no default, because no client inserts');
select fk_ok('public', 'targets', 'user_id', 'auth', 'users', 'id', 'user_id references auth.users');
select is(
  (select confdeltype::text from pg_constraint where conrelid = 'public.targets'::regclass and conname = 'targets_user_id_fkey'),
  'c',
  'the user_id foreign key cascades on delete'
);
select col_type_is('public', 'targets', 'program_id', 'uuid', 'program_id is a uuid');
select col_is_null('public', 'targets', 'program_id', 'program_id is nullable');
select col_hasnt_default('public', 'targets', 'program_id', 'program_id has no default');
select fk_ok('public', 'targets', 'program_id', 'public', 'programs', 'id', 'program_id references programs');
select is(
  (select confdeltype::text from pg_constraint where conrelid = 'public.targets'::regclass and conname = 'targets_program_id_fkey'),
  'n',
  'the program_id foreign key sets null on delete'
);
select col_type_is('public', 'targets', 'expenditure_snapshot_id', 'uuid', 'expenditure_snapshot_id is a uuid');
select col_is_null('public', 'targets', 'expenditure_snapshot_id', 'expenditure_snapshot_id is nullable');
select col_hasnt_default('public', 'targets', 'expenditure_snapshot_id', 'expenditure_snapshot_id has no default');
select fk_ok(
  'public', 'targets', 'expenditure_snapshot_id', 'public', 'expenditure_snapshots', 'id',
  'expenditure_snapshot_id references expenditure_snapshots'
);
select is(
  (select confdeltype::text from pg_constraint where conrelid = 'public.targets'::regclass and conname = 'targets_expenditure_snapshot_id_fkey'),
  'n',
  'the expenditure_snapshot_id foreign key sets null on delete'
);
select col_type_is('public', 'targets', 'effective_from', 'date', 'effective_from is a date');
select col_not_null('public', 'targets', 'effective_from', 'effective_from is not null');
select col_hasnt_default('public', 'targets', 'effective_from', 'effective_from has no default');
select col_type_is('public', 'targets', 'effective_to', 'date', 'effective_to is a date');
select col_is_null('public', 'targets', 'effective_to', 'effective_to is nullable');
select col_hasnt_default('public', 'targets', 'effective_to', 'effective_to has no default');
select col_type_is('public', 'targets', 'calories_kcal', 'integer', 'calories_kcal is an integer');
select col_not_null('public', 'targets', 'calories_kcal', 'calories_kcal is not null');
select col_hasnt_default('public', 'targets', 'calories_kcal', 'calories_kcal has no default');
select col_type_is('public', 'targets', 'protein_g', 'numeric', 'protein_g is numeric');
select col_not_null('public', 'targets', 'protein_g', 'protein_g is not null');
select col_hasnt_default('public', 'targets', 'protein_g', 'protein_g has no default');
select col_type_is('public', 'targets', 'fat_g', 'numeric', 'fat_g is numeric');
select col_not_null('public', 'targets', 'fat_g', 'fat_g is not null');
select col_hasnt_default('public', 'targets', 'fat_g', 'fat_g has no default');
select col_type_is('public', 'targets', 'carbs_g', 'numeric', 'carbs_g is numeric');
select col_not_null('public', 'targets', 'carbs_g', 'carbs_g is not null');
select col_hasnt_default('public', 'targets', 'carbs_g', 'carbs_g has no default');
select col_type_is('public', 'targets', 'dow_calories_kcal', 'integer[]', 'dow_calories_kcal is an integer array');
select col_not_null('public', 'targets', 'dow_calories_kcal', 'dow_calories_kcal is not null');
select col_hasnt_default('public', 'targets', 'dow_calories_kcal', 'dow_calories_kcal has no default');
select col_type_is('public', 'targets', 'basis', 'jsonb', 'basis is jsonb');
select col_not_null('public', 'targets', 'basis', 'basis is not null');
select col_hasnt_default('public', 'targets', 'basis', 'basis has no default');
select col_type_is('public', 'targets', 'engine_version', 'text', 'engine_version is text');
select col_not_null('public', 'targets', 'engine_version', 'engine_version is not null');
select col_hasnt_default('public', 'targets', 'engine_version', 'engine_version has no default');
select col_type_is('public', 'targets', 'params', 'jsonb', 'params is jsonb');
select col_not_null('public', 'targets', 'params', 'params is not null');
select col_hasnt_default('public', 'targets', 'params', 'params has no default');
select col_type_is('public', 'targets', 'created_at', 'timestamp with time zone', 'created_at is a timestamptz');
select col_not_null('public', 'targets', 'created_at', 'created_at is not null');
select col_default_is('public', 'targets', 'created_at', 'now()', 'created_at defaults to now()');
select is(
  (select count(*)::int from pg_trigger where tgrelid = 'public.targets'::regclass and not tgisinternal),
  0,
  'targets has no trigger'
);

-- Indexes: the primary key, the unique key and the foreign key index of snapshots, and no other.
select is(
  (select array_agg(indexname::text order by indexname) from pg_indexes where schemaname = 'public' and tablename = 'expenditure_snapshots'),
  array['expenditure_snapshots_pkey', 'expenditure_snapshots_program_id_idx', 'expenditure_snapshots_user_id_as_of_date_key'],
  'expenditure_snapshots has the primary key, the unique key and the program_id index and no other index'
);
select is(
  (select indexdef from pg_indexes where schemaname = 'public' and indexname = 'expenditure_snapshots_user_id_as_of_date_key'),
  'CREATE UNIQUE INDEX expenditure_snapshots_user_id_as_of_date_key ON public.expenditure_snapshots USING btree (user_id, as_of_date)',
  'the unique key is on user_id and as_of_date, so it also serves the cascade from auth.users'
);
select is(
  (select indexdef from pg_indexes where schemaname = 'public' and indexname = 'expenditure_snapshots_program_id_idx'),
  'CREATE INDEX expenditure_snapshots_program_id_idx ON public.expenditure_snapshots USING btree (program_id)',
  'the program_id index is on program_id'
);

-- Indexes: the primary key, the one-current index, the list index and the two foreign key indexes of
-- targets, and no other.
select is(
  (select array_agg(indexname::text order by indexname) from pg_indexes where schemaname = 'public' and tablename = 'targets'),
  array[
    'targets_expenditure_snapshot_id_idx', 'targets_one_current_per_user', 'targets_pkey',
    'targets_program_id_idx', 'targets_user_id_effective_from_idx'
  ],
  'targets has the primary key, the one-current index, the list index and two foreign key indexes and no other index'
);
select is(
  (select indexdef from pg_indexes where schemaname = 'public' and indexname = 'targets_one_current_per_user'),
  'CREATE UNIQUE INDEX targets_one_current_per_user ON public.targets USING btree (user_id) WHERE (effective_to IS NULL)',
  'the one-current index is unique on user_id where effective_to is null'
);
select is(
  (select indexdef from pg_indexes where schemaname = 'public' and indexname = 'targets_user_id_effective_from_idx'),
  'CREATE INDEX targets_user_id_effective_from_idx ON public.targets USING btree (user_id, effective_from DESC)',
  'the list index is on user_id and effective_from descending'
);
select is(
  (select indexdef from pg_indexes where schemaname = 'public' and indexname = 'targets_program_id_idx'),
  'CREATE INDEX targets_program_id_idx ON public.targets USING btree (program_id)',
  'the targets program_id index is on program_id'
);
select is(
  (select indexdef from pg_indexes where schemaname = 'public' and indexname = 'targets_expenditure_snapshot_id_idx'),
  'CREATE INDEX targets_expenditure_snapshot_id_idx ON public.targets USING btree (expenditure_snapshot_id)',
  'the expenditure_snapshot_id index is on expenditure_snapshot_id'
);

-- Policies, read from the catalog. Each table has one select policy for the owner and nothing else.
select policies_are(
  'public',
  'expenditure_snapshots',
  array['expenditure_snapshots_select_own'],
  'expenditure_snapshots has exactly one policy'
);
select policy_cmd_is('public', 'expenditure_snapshots', 'expenditure_snapshots_select_own', 'select', 'expenditure_snapshots_select_own is for select');
select policy_roles_are(
  'public', 'expenditure_snapshots', 'expenditure_snapshots_select_own', array['authenticated'],
  'expenditure_snapshots_select_own is for authenticated only'
);
select policies_are('public', 'targets', array['targets_select_own'], 'targets has exactly one policy');
select policy_cmd_is('public', 'targets', 'targets_select_own', 'select', 'targets_select_own is for select');
select policy_roles_are('public', 'targets', 'targets_select_own', array['authenticated'], 'targets_select_own is for authenticated only');

-- Each policy reads the caller as `(select auth.uid())`, which Postgres evaluates once per statement and
-- renders with the subselect. A bare `auth.uid()` would be evaluated once per row and shows no subselect.
select ok(
  (select qual from pg_policies where schemaname = 'public' and tablename = 'expenditure_snapshots' and policyname = 'expenditure_snapshots_select_own')
    like '%user_id = ( SELECT auth.uid()%',
  'expenditure_snapshots_select_own tests user_id against (select auth.uid())'
);
select ok(
  (select qual from pg_policies where schemaname = 'public' and tablename = 'targets' and policyname = 'targets_select_own')
    like '%user_id = ( SELECT auth.uid()%',
  'targets_select_own tests user_id against (select auth.uid())'
);

-- Checks of expenditure_snapshots, as postgres, on user D. Every case uses its own date, so a failure
-- is the check under test and never the unique key.
select throws_ok(
  $$select pg_temp.add_snapshot('61000000-0000-4000-8000-0000000000dd', '2026-01-01', mu => 799)$$,
  '23514',
  'new row for relation "expenditure_snapshots" violates check constraint "expenditure_snapshots_mu_kcal_check"',
  'mu_kcal of 799 fails'
);
select throws_ok(
  $$select pg_temp.add_snapshot('61000000-0000-4000-8000-0000000000dd', '2026-01-02', mu => 6001)$$,
  '23514',
  'new row for relation "expenditure_snapshots" violates check constraint "expenditure_snapshots_mu_kcal_check"',
  'mu_kcal of 6001 fails'
);
select lives_ok(
  $$select pg_temp.add_snapshot('61000000-0000-4000-8000-0000000000dd', '2026-01-03', mu => 800)$$,
  'mu_kcal of 800 passes'
);
select lives_ok(
  $$select pg_temp.add_snapshot('61000000-0000-4000-8000-0000000000dd', '2026-01-04', mu => 6000)$$,
  'mu_kcal of 6000 passes'
);
select throws_ok(
  $$select pg_temp.add_snapshot('61000000-0000-4000-8000-0000000000dd', '2026-01-05', variance => 0)$$,
  '23514',
  'new row for relation "expenditure_snapshots" violates check constraint "expenditure_snapshots_var_kcal2_check"',
  'var_kcal2 of 0 fails'
);
select throws_ok(
  $$select pg_temp.add_snapshot('61000000-0000-4000-8000-0000000000dd', '2026-01-06', variance => -1)$$,
  '23514',
  'new row for relation "expenditure_snapshots" violates check constraint "expenditure_snapshots_var_kcal2_check"',
  'a negative var_kcal2 fails'
);
select lives_ok(
  $$select pg_temp.add_snapshot('61000000-0000-4000-8000-0000000000dd', '2026-01-07', variance => 0.01)$$,
  'a small positive var_kcal2 passes'
);
select throws_ok(
  $$select pg_temp.add_snapshot('61000000-0000-4000-8000-0000000000dd', '2026-01-08', trend => 19.9)$$,
  '23514',
  'new row for relation "expenditure_snapshots" violates check constraint "expenditure_snapshots_trend_weight_kg_check"',
  'trend_weight_kg of 19.9 fails'
);
select throws_ok(
  $$select pg_temp.add_snapshot('61000000-0000-4000-8000-0000000000dd', '2026-01-09', trend => 400.1)$$,
  '23514',
  'new row for relation "expenditure_snapshots" violates check constraint "expenditure_snapshots_trend_weight_kg_check"',
  'trend_weight_kg of 400.1 fails'
);
select lives_ok(
  $$select pg_temp.add_snapshot('61000000-0000-4000-8000-0000000000dd', '2026-01-10', trend => 20)$$,
  'trend_weight_kg of 20 passes'
);
select lives_ok(
  $$select pg_temp.add_snapshot('61000000-0000-4000-8000-0000000000dd', '2026-01-11', trend => 400)$$,
  'trend_weight_kg of 400 passes'
);
select lives_ok(
  $$select pg_temp.add_snapshot('61000000-0000-4000-8000-0000000000dd', '2026-01-12', trend => null)$$,
  'a null trend_weight_kg passes'
);
select throws_ok(
  $$select pg_temp.add_snapshot('61000000-0000-4000-8000-0000000000dd', '2026-01-13', snapshot_kind => 'baseline')$$,
  '23514',
  'new row for relation "expenditure_snapshots" violates check constraint "expenditure_snapshots_kind_check"',
  'a kind that is not start or checkin fails'
);
select lives_ok(
  $$select pg_temp.add_snapshot('61000000-0000-4000-8000-0000000000dd', '2026-01-14', snapshot_kind => 'start', measure => null)$$,
  'a start row with no measurement passes'
);
select throws_ok(
  $$select pg_temp.add_snapshot('61000000-0000-4000-8000-0000000000dd', '2026-01-15', snapshot_kind => 'start')$$,
  '23514',
  'new row for relation "expenditure_snapshots" violates check constraint "expenditure_snapshots_measurement_kind_check"',
  'a start row with a measurement fails'
);
select throws_ok(
  $$select pg_temp.add_snapshot('61000000-0000-4000-8000-0000000000dd', '2026-01-16', measure => null)$$,
  '23514',
  'new row for relation "expenditure_snapshots" violates check constraint "expenditure_snapshots_measurement_kind_check"',
  'a checkin row without a measurement fails'
);
select lives_ok(
  $$select pg_temp.add_snapshot('61000000-0000-4000-8000-0000000000dd', '2026-01-17', measure => '{"eligible": true}')$$,
  'a checkin row with a measurement passes'
);
select lives_ok(
  $$select pg_temp.add_snapshot('61000000-0000-4000-8000-0000000000dd', '2026-01-18')$$,
  'a checkin row with the default ineligible measurement passes'
);
select throws_ok(
  $$select pg_temp.add_snapshot('61000000-0000-4000-8000-0000000000dd', '2026-01-18')$$,
  '23505',
  'duplicate key value violates unique constraint "expenditure_snapshots_user_id_as_of_date_key"',
  'a second snapshot for the same user and date fails'
);
select throws_ok(
  $$select pg_temp.add_snapshot('61000000-0000-4000-8000-0000000000dd', '2026-01-14', snapshot_kind => 'start', measure => null)$$,
  '23505',
  'duplicate key value violates unique constraint "expenditure_snapshots_user_id_as_of_date_key"',
  'a start row cannot share a date with an existing start row either'
);
select lives_ok(
  $$select pg_temp.add_snapshot('61000000-0000-4000-8000-0000000000ee', '2026-01-18')$$,
  'another user can have a snapshot on the same date'
);
select throws_ok(
  $$insert into public.expenditure_snapshots (user_id, as_of_date, kind, mu_kcal, var_kcal2, measurement, engine_version)
    values ('61000000-0000-4000-8000-0000000000dd', '2026-01-19', 'checkin', 2400, 10000, '{"eligible": false}', 'test-1')$$,
  '23502',
  'null value in column "params" of relation "expenditure_snapshots" violates not-null constraint',
  'a snapshot with no params fails'
);
select throws_ok(
  $$insert into public.expenditure_snapshots (user_id, as_of_date, kind, mu_kcal, var_kcal2, measurement, params)
    values ('61000000-0000-4000-8000-0000000000dd', '2026-01-19', 'checkin', 2400, 10000, '{"eligible": false}', '{}')$$,
  '23502',
  'null value in column "engine_version" of relation "expenditure_snapshots" violates not-null constraint',
  'a snapshot with no engine_version fails'
);
select throws_ok(
  $$insert into public.expenditure_snapshots (user_id, program_id, as_of_date, kind, mu_kcal, var_kcal2, measurement, engine_version, params)
    values ('61000000-0000-4000-8000-0000000000dd', gen_random_uuid(), '2026-01-19', 'checkin', 2400, 10000, '{"eligible": false}', 'test-1', '{}')$$,
  '23503',
  'insert or update on table "expenditure_snapshots" violates foreign key constraint "expenditure_snapshots_program_id_fkey"',
  'a snapshot cannot name a program that does not exist'
);

-- Checks of targets, as postgres, on user E.
select throws_ok(
  $$select pg_temp.add_target('61000000-0000-4000-8000-0000000000ee', calories => 799)$$,
  '23514',
  'new row for relation "targets" violates check constraint "targets_calories_kcal_check"',
  'calories_kcal of 799 fails'
);
select throws_ok(
  $$select pg_temp.add_target('61000000-0000-4000-8000-0000000000ee', calories => 6001)$$,
  '23514',
  'new row for relation "targets" violates check constraint "targets_calories_kcal_check"',
  'calories_kcal of 6001 fails'
);
select lives_ok(
  $$select pg_temp.add_target('61000000-0000-4000-8000-0000000000ee', calories => 800)$$,
  'calories_kcal of 800 passes'
);
select lives_ok(
  $$select pg_temp.add_target('61000000-0000-4000-8000-0000000000ee', calories => 6000)$$,
  'calories_kcal of 6000 passes'
);
select throws_ok(
  $$select pg_temp.add_target('61000000-0000-4000-8000-0000000000ee', protein => -1)$$,
  '23514',
  'new row for relation "targets" violates check constraint "targets_protein_g_check"',
  'a negative protein_g fails'
);
select throws_ok(
  $$select pg_temp.add_target('61000000-0000-4000-8000-0000000000ee', fat => -1)$$,
  '23514',
  'new row for relation "targets" violates check constraint "targets_fat_g_check"',
  'a negative fat_g fails'
);
select throws_ok(
  $$select pg_temp.add_target('61000000-0000-4000-8000-0000000000ee', carbs => -1)$$,
  '23514',
  'new row for relation "targets" violates check constraint "targets_carbs_g_check"',
  'a negative carbs_g fails'
);
select lives_ok(
  $$select pg_temp.add_target('61000000-0000-4000-8000-0000000000ee', protein => 0, fat => 0, carbs => 0)$$,
  'a macro of 0 passes'
);
select throws_ok(
  $$select pg_temp.add_target('61000000-0000-4000-8000-0000000000ee', day_calories => '{2000,2000,2000,2000,2000,2000}')$$,
  '23514',
  'new row for relation "targets" violates check constraint "targets_dow_calories_kcal_check"',
  'dow_calories_kcal of length 6 fails'
);
select throws_ok(
  $$select pg_temp.add_target('61000000-0000-4000-8000-0000000000ee', day_calories => '{2000,2000,2000,2000,2000,2000,2000,2000}')$$,
  '23514',
  'new row for relation "targets" violates check constraint "targets_dow_calories_kcal_check"',
  'dow_calories_kcal of length 8 fails'
);
select throws_ok(
  $$select pg_temp.add_target('61000000-0000-4000-8000-0000000000ee', day_calories => '{}')$$,
  '23514',
  'new row for relation "targets" violates check constraint "targets_dow_calories_kcal_check"',
  'an empty dow_calories_kcal fails'
);
select throws_ok(
  $$select pg_temp.add_target('61000000-0000-4000-8000-0000000000ee', day_calories => '[0:6]={2000,2000,2000,2000,2000,2000,2000}')$$,
  '23514',
  'new row for relation "targets" violates check constraint "targets_dow_calories_kcal_check"',
  'dow_calories_kcal with a lower bound other than 1 fails'
);
select throws_ok(
  $$select pg_temp.add_target('61000000-0000-4000-8000-0000000000ee', day_calories => '{{2000},{2000},{2000},{2000},{2000},{2000},{2000}}')$$,
  '23514',
  'new row for relation "targets" violates check constraint "targets_dow_calories_kcal_check"',
  'a seven row two-dimensional dow_calories_kcal fails'
);
select lives_ok(
  $$select pg_temp.add_target('61000000-0000-4000-8000-0000000000ee', day_calories => '{1900,2100,2000,2000,2000,2000,2000}')$$,
  'dow_calories_kcal of length 7 passes'
);
select throws_ok(
  $$select pg_temp.add_target('61000000-0000-4000-8000-0000000000ee', effective_from => '2026-10-10', effective_to => '2026-10-09')$$,
  '23514',
  'new row for relation "targets" violates check constraint "targets_effective_to_check"',
  'effective_to before effective_from fails'
);
select lives_ok(
  $$select pg_temp.add_target('61000000-0000-4000-8000-0000000000ee', effective_from => '2026-10-10', effective_to => '2026-10-10')$$,
  'effective_to equal to effective_from passes, which is a replacement on the same day'
);
select lives_ok(
  $$select pg_temp.add_target('61000000-0000-4000-8000-0000000000ee', effective_from => '2026-10-10', effective_to => '2026-10-11')$$,
  'effective_to after effective_from passes'
);
select throws_ok(
  $$insert into public.targets (user_id, effective_from, calories_kcal, protein_g, fat_g, carbs_g, dow_calories_kcal, basis, engine_version)
    values ('61000000-0000-4000-8000-0000000000ee', '2026-09-01', 2000, 120, 70, 200, '{2000,2000,2000,2000,2000,2000,2000}', '{}', 'test-1')$$,
  '23502',
  'null value in column "params" of relation "targets" violates not-null constraint',
  'a target with no params fails'
);
select throws_ok(
  $$insert into public.targets (user_id, effective_from, calories_kcal, protein_g, fat_g, carbs_g, dow_calories_kcal, basis, params)
    values ('61000000-0000-4000-8000-0000000000ee', '2026-09-01', 2000, 120, 70, 200, '{2000,2000,2000,2000,2000,2000,2000}', '{}', '{}')$$,
  '23502',
  'null value in column "engine_version" of relation "targets" violates not-null constraint',
  'a target with no engine_version fails'
);
select throws_ok(
  $$insert into public.targets (user_id, effective_from, calories_kcal, protein_g, fat_g, carbs_g, dow_calories_kcal, engine_version, params)
    values ('61000000-0000-4000-8000-0000000000ee', '2026-09-01', 2000, 120, 70, 200, '{2000,2000,2000,2000,2000,2000,2000}', 'test-1', '{}')$$,
  '23502',
  'null value in column "basis" of relation "targets" violates not-null constraint',
  'a target with no basis fails'
);
select throws_ok(
  $$select pg_temp.add_target('61000000-0000-4000-8000-0000000000ee', program => gen_random_uuid())$$,
  '23503',
  'insert or update on table "targets" violates foreign key constraint "targets_program_id_fkey"',
  'a target cannot name a program that does not exist'
);
select throws_ok(
  $$select pg_temp.add_target('61000000-0000-4000-8000-0000000000ee', snapshot => gen_random_uuid())$$,
  '23503',
  'insert or update on table "targets" violates foreign key constraint "targets_expenditure_snapshot_id_fkey"',
  'a target cannot name a snapshot that does not exist'
);

-- One current target per user, on user E, who so far has only closed targets.
select lives_ok(
  $$select pg_temp.add_target('61000000-0000-4000-8000-0000000000ee', effective_from => '2026-11-01', effective_to => null)$$,
  'a user with only closed targets can have one current target'
);
select throws_ok(
  $$select pg_temp.add_target('61000000-0000-4000-8000-0000000000ee', effective_from => '2026-11-08', effective_to => null)$$,
  '23505',
  'duplicate key value violates unique constraint "targets_one_current_per_user"',
  'a second current target for the same user fails'
);
select lives_ok(
  $$select pg_temp.add_target('61000000-0000-4000-8000-0000000000dd', effective_from => '2026-11-01', effective_to => null)$$,
  'another user can have a current target at the same time'
);
select lives_ok(
  $$update public.targets set effective_to = '2026-11-08' where user_id = '61000000-0000-4000-8000-0000000000ee' and effective_to is null$$,
  'closing the current target succeeds'
);
select lives_ok(
  $$select pg_temp.add_target('61000000-0000-4000-8000-0000000000ee', effective_from => '2026-11-08', effective_to => null)$$,
  'one closed target and one current target succeed together'
);
select is(
  (select count(*)::int from public.targets where user_id = '61000000-0000-4000-8000-0000000000ee' and effective_to is null),
  1,
  'user E has exactly one current target'
);

-- Row level security. Fixtures are inserted as postgres. User A has a snapshot and a target, and so
-- has user B, each with a different calories_kcal so a row can be told apart without quoting it.
select lives_ok(
  $$select pg_temp.add_snapshot('61000000-0000-4000-8000-0000000000aa', '2026-10-05', mu => 2500)$$,
  'a snapshot is inserted for user A'
);
select lives_ok(
  $$select pg_temp.add_snapshot('61000000-0000-4000-8000-0000000000bb', '2026-10-05', mu => 3100)$$,
  'a snapshot is inserted for user B'
);
select lives_ok(
  $$select pg_temp.add_target('61000000-0000-4000-8000-0000000000aa', effective_to => null, calories => 2200)$$,
  'a current target is inserted for user A'
);
select lives_ok(
  $$select pg_temp.add_target('61000000-0000-4000-8000-0000000000bb', effective_to => null, calories => 2900)$$,
  'a current target is inserted for user B'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"61000000-0000-4000-8000-0000000000aa","role":"authenticated"}';

select is(
  (select count(*)::int from public.expenditure_snapshots
    where user_id in ('61000000-0000-4000-8000-0000000000aa', '61000000-0000-4000-8000-0000000000bb')),
  1,
  'user A selects one snapshot out of A and B'
);
select is(
  (select count(*)::int from public.expenditure_snapshots where user_id = '61000000-0000-4000-8000-0000000000aa'),
  1,
  'the snapshot user A sees is their own'
);
select is(
  (select count(*)::int from public.expenditure_snapshots where user_id = '61000000-0000-4000-8000-0000000000bb'),
  0,
  'user A cannot see user B''s snapshot'
);
select is(
  (select count(*)::int from public.targets
    where user_id in ('61000000-0000-4000-8000-0000000000aa', '61000000-0000-4000-8000-0000000000bb')),
  1,
  'user A selects one target out of A and B'
);
select is(
  (select count(*)::int from public.targets where user_id = '61000000-0000-4000-8000-0000000000aa'),
  1,
  'the target user A sees is their own'
);
select is(
  (select count(*)::int from public.targets where user_id = '61000000-0000-4000-8000-0000000000bb'),
  0,
  'user A cannot see user B''s target'
);

-- Select only: every write by an authenticated user is refused at the privilege check, whatever the row.
select throws_ok(
  $$insert into public.expenditure_snapshots (user_id, as_of_date, kind, mu_kcal, var_kcal2, measurement, engine_version, params)
    values ('61000000-0000-4000-8000-0000000000aa', '2026-10-06', 'checkin', 2400, 10000, '{"eligible": false}', 'test-1', '{}')$$,
  '42501',
  'permission denied for table expenditure_snapshots',
  'user A cannot insert a snapshot for themselves'
);
select throws_ok(
  $$insert into public.expenditure_snapshots (user_id, as_of_date, kind, mu_kcal, var_kcal2, measurement, engine_version, params)
    values ('61000000-0000-4000-8000-0000000000bb', '2026-10-06', 'checkin', 2400, 10000, '{"eligible": false}', 'test-1', '{}')$$,
  '42501',
  'permission denied for table expenditure_snapshots',
  'user A cannot insert a snapshot for user B'
);
select throws_ok(
  $$update public.expenditure_snapshots set mu_kcal = 2400 where user_id = '61000000-0000-4000-8000-0000000000aa'$$,
  '42501',
  'permission denied for table expenditure_snapshots',
  'user A cannot update their own snapshot'
);
select throws_ok(
  $$update public.expenditure_snapshots set params = '{}' where user_id = '61000000-0000-4000-8000-0000000000aa'$$,
  '42501',
  'permission denied for table expenditure_snapshots',
  'user A cannot rewrite the params of their own snapshot'
);
select throws_ok(
  $$update public.expenditure_snapshots set mu_kcal = 2400 where user_id = '61000000-0000-4000-8000-0000000000bb'$$,
  '42501',
  'permission denied for table expenditure_snapshots',
  'user A cannot update user B''s snapshot'
);
select throws_ok(
  $$delete from public.expenditure_snapshots where user_id = '61000000-0000-4000-8000-0000000000aa'$$,
  '42501',
  'permission denied for table expenditure_snapshots',
  'user A cannot delete their own snapshot'
);
select throws_ok(
  $$delete from public.expenditure_snapshots where user_id = '61000000-0000-4000-8000-0000000000bb'$$,
  '42501',
  'permission denied for table expenditure_snapshots',
  'user A cannot delete user B''s snapshot'
);
select throws_ok(
  $$insert into public.targets (user_id, effective_from, effective_to, calories_kcal, protein_g, fat_g, carbs_g, dow_calories_kcal, basis, engine_version, params)
    values ('61000000-0000-4000-8000-0000000000aa', '2026-09-01', '2026-09-30', 2000, 120, 70, 200, '{2000,2000,2000,2000,2000,2000,2000}', '{}', 'test-1', '{}')$$,
  '42501',
  'permission denied for table targets',
  'user A cannot insert a target for themselves'
);
select throws_ok(
  $$insert into public.targets (user_id, effective_from, effective_to, calories_kcal, protein_g, fat_g, carbs_g, dow_calories_kcal, basis, engine_version, params)
    values ('61000000-0000-4000-8000-0000000000bb', '2026-09-01', '2026-09-30', 2000, 120, 70, 200, '{2000,2000,2000,2000,2000,2000,2000}', '{}', 'test-1', '{}')$$,
  '42501',
  'permission denied for table targets',
  'user A cannot insert a target for user B'
);
select throws_ok(
  $$update public.targets set calories_kcal = 2000 where user_id = '61000000-0000-4000-8000-0000000000aa'$$,
  '42501',
  'permission denied for table targets',
  'user A cannot update their own target'
);
select throws_ok(
  $$update public.targets set effective_to = '2026-10-31' where user_id = '61000000-0000-4000-8000-0000000000aa'$$,
  '42501',
  'permission denied for table targets',
  'user A cannot close their own target'
);
select throws_ok(
  $$update public.targets set calories_kcal = 2000 where user_id = '61000000-0000-4000-8000-0000000000bb'$$,
  '42501',
  'permission denied for table targets',
  'user A cannot update user B''s target'
);
select throws_ok(
  $$delete from public.targets where user_id = '61000000-0000-4000-8000-0000000000aa'$$,
  '42501',
  'permission denied for table targets',
  'user A cannot delete their own target'
);
select throws_ok(
  $$delete from public.targets where user_id = '61000000-0000-4000-8000-0000000000bb'$$,
  '42501',
  'permission denied for table targets',
  'user A cannot delete user B''s target'
);

reset role;

-- User B sees only their own rows, which shows the policy is the owner's and not user A's.
set local role authenticated;
set local request.jwt.claims = '{"sub":"61000000-0000-4000-8000-0000000000bb","role":"authenticated"}';

select is(
  (select count(*)::int from public.expenditure_snapshots
    where user_id in ('61000000-0000-4000-8000-0000000000aa', '61000000-0000-4000-8000-0000000000bb')),
  1,
  'user B selects one snapshot out of A and B'
);
select is(
  (select count(*)::int from public.expenditure_snapshots where user_id = '61000000-0000-4000-8000-0000000000bb'),
  1,
  'the snapshot user B sees is their own'
);
select is(
  (select count(*)::int from public.targets
    where user_id in ('61000000-0000-4000-8000-0000000000aa', '61000000-0000-4000-8000-0000000000bb')),
  1,
  'user B selects one target out of A and B'
);
select is(
  (select count(*)::int from public.targets where user_id = '61000000-0000-4000-8000-0000000000bb'),
  1,
  'the target user B sees is their own'
);

reset role;

-- Anon can do nothing.
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  $$select * from public.expenditure_snapshots$$,
  '42501',
  'permission denied for table expenditure_snapshots',
  'anon cannot select from expenditure_snapshots'
);
select throws_ok(
  $$insert into public.expenditure_snapshots (user_id, as_of_date, kind, mu_kcal, var_kcal2, measurement, engine_version, params)
    values ('61000000-0000-4000-8000-0000000000aa', '2026-10-06', 'checkin', 2400, 10000, '{"eligible": false}', 'test-1', '{}')$$,
  '42501',
  'permission denied for table expenditure_snapshots',
  'anon cannot insert into expenditure_snapshots'
);
select throws_ok(
  $$update public.expenditure_snapshots set mu_kcal = 2400$$,
  '42501',
  'permission denied for table expenditure_snapshots',
  'anon cannot update expenditure_snapshots'
);
select throws_ok(
  $$delete from public.expenditure_snapshots$$,
  '42501',
  'permission denied for table expenditure_snapshots',
  'anon cannot delete from expenditure_snapshots'
);
select throws_ok(
  $$select * from public.targets$$,
  '42501',
  'permission denied for table targets',
  'anon cannot select from targets'
);
select throws_ok(
  $$insert into public.targets (user_id, effective_from, effective_to, calories_kcal, protein_g, fat_g, carbs_g, dow_calories_kcal, basis, engine_version, params)
    values ('61000000-0000-4000-8000-0000000000aa', '2026-09-01', '2026-09-30', 2000, 120, 70, 200, '{2000,2000,2000,2000,2000,2000,2000}', '{}', 'test-1', '{}')$$,
  '42501',
  'permission denied for table targets',
  'anon cannot insert into targets'
);
select throws_ok(
  $$update public.targets set calories_kcal = 2000$$,
  '42501',
  'permission denied for table targets',
  'anon cannot update targets'
);
select throws_ok(
  $$delete from public.targets$$,
  '42501',
  'permission denied for table targets',
  'anon cannot delete from targets'
);

reset role;

-- The service role reads both tables, and nothing else is granted to it (the writer functions are the
-- next ticket's).
set local role service_role;

select is(
  (select count(*)::int from public.expenditure_snapshots
    where user_id in ('61000000-0000-4000-8000-0000000000aa', '61000000-0000-4000-8000-0000000000bb')),
  2,
  'service_role selects the snapshots of both users'
);
select is(
  (select count(*)::int from public.targets
    where user_id in ('61000000-0000-4000-8000-0000000000aa', '61000000-0000-4000-8000-0000000000bb')),
  2,
  'service_role selects the targets of both users'
);
select throws_ok(
  $$insert into public.expenditure_snapshots (user_id, as_of_date, kind, mu_kcal, var_kcal2, measurement, engine_version, params)
    values ('61000000-0000-4000-8000-0000000000aa', '2026-10-06', 'checkin', 2400, 10000, '{"eligible": false}', 'test-1', '{}')$$,
  '42501',
  'permission denied for table expenditure_snapshots',
  'service_role cannot insert into expenditure_snapshots'
);
select throws_ok(
  $$update public.expenditure_snapshots set mu_kcal = 2400$$,
  '42501',
  'permission denied for table expenditure_snapshots',
  'service_role cannot update expenditure_snapshots'
);
select throws_ok(
  $$delete from public.expenditure_snapshots$$,
  '42501',
  'permission denied for table expenditure_snapshots',
  'service_role cannot delete from expenditure_snapshots'
);
select throws_ok(
  $$insert into public.targets (user_id, effective_from, effective_to, calories_kcal, protein_g, fat_g, carbs_g, dow_calories_kcal, basis, engine_version, params)
    values ('61000000-0000-4000-8000-0000000000aa', '2026-09-01', '2026-09-30', 2000, 120, 70, 200, '{2000,2000,2000,2000,2000,2000,2000}', '{}', 'test-1', '{}')$$,
  '42501',
  'permission denied for table targets',
  'service_role cannot insert into targets'
);
select throws_ok(
  $$update public.targets set calories_kcal = 2000$$,
  '42501',
  'permission denied for table targets',
  'service_role cannot update targets'
);
select throws_ok(
  $$delete from public.targets$$,
  '42501',
  'permission denied for table targets',
  'service_role cannot delete from targets'
);

reset role;

-- Privileges, read from the catalog.
select is(
  (select array_agg(privilege_type::text order by privilege_type) from information_schema.table_privileges
    where table_schema = 'public' and table_name = 'expenditure_snapshots' and grantee = 'authenticated'),
  array['SELECT'],
  'authenticated holds table level select on expenditure_snapshots and nothing else'
);
select is(
  (select array_agg(privilege_type::text order by privilege_type) from information_schema.table_privileges
    where table_schema = 'public' and table_name = 'targets' and grantee = 'authenticated'),
  array['SELECT'],
  'authenticated holds table level select on targets and nothing else'
);
select is(
  (select array_agg(privilege_type::text order by privilege_type) from information_schema.table_privileges
    where table_schema = 'public' and table_name = 'expenditure_snapshots' and grantee = 'service_role'),
  array['SELECT'],
  'service_role holds table level select on expenditure_snapshots and nothing else'
);
select is(
  (select array_agg(privilege_type::text order by privilege_type) from information_schema.table_privileges
    where table_schema = 'public' and table_name = 'targets' and grantee = 'service_role'),
  array['SELECT'],
  'service_role holds table level select on targets and nothing else'
);
select is(
  (select count(*)::int from information_schema.column_privileges
    where table_schema = 'public' and table_name in ('expenditure_snapshots', 'targets')
      and grantee in ('authenticated', 'service_role') and privilege_type <> 'SELECT'),
  0,
  'no column level privilege other than select is held by authenticated or service_role on either table'
);
select ok(
  not has_table_privilege('authenticated', 'public.expenditure_snapshots', 'insert')
    and not has_table_privilege('authenticated', 'public.expenditure_snapshots', 'update')
    and not has_table_privilege('authenticated', 'public.expenditure_snapshots', 'delete')
    and not has_table_privilege('authenticated', 'public.expenditure_snapshots', 'truncate')
    and not has_table_privilege('authenticated', 'public.expenditure_snapshots', 'references')
    and not has_table_privilege('authenticated', 'public.expenditure_snapshots', 'trigger')
    and not has_any_column_privilege('authenticated', 'public.expenditure_snapshots', 'insert')
    and not has_any_column_privilege('authenticated', 'public.expenditure_snapshots', 'update')
    and not has_any_column_privilege('authenticated', 'public.expenditure_snapshots', 'references'),
  'authenticated has no write privilege of any kind on expenditure_snapshots'
);
select ok(
  not has_table_privilege('authenticated', 'public.targets', 'insert')
    and not has_table_privilege('authenticated', 'public.targets', 'update')
    and not has_table_privilege('authenticated', 'public.targets', 'delete')
    and not has_table_privilege('authenticated', 'public.targets', 'truncate')
    and not has_table_privilege('authenticated', 'public.targets', 'references')
    and not has_table_privilege('authenticated', 'public.targets', 'trigger')
    and not has_any_column_privilege('authenticated', 'public.targets', 'insert')
    and not has_any_column_privilege('authenticated', 'public.targets', 'update')
    and not has_any_column_privilege('authenticated', 'public.targets', 'references'),
  'authenticated has no write privilege of any kind on targets'
);
select ok(
  not has_table_privilege('anon', 'public.expenditure_snapshots', 'select')
    and not has_table_privilege('anon', 'public.expenditure_snapshots', 'insert')
    and not has_table_privilege('anon', 'public.expenditure_snapshots', 'update')
    and not has_table_privilege('anon', 'public.expenditure_snapshots', 'delete')
    and not has_table_privilege('anon', 'public.expenditure_snapshots', 'truncate')
    and not has_table_privilege('anon', 'public.expenditure_snapshots', 'references')
    and not has_table_privilege('anon', 'public.expenditure_snapshots', 'trigger')
    and not has_any_column_privilege('anon', 'public.expenditure_snapshots', 'select')
    and not has_any_column_privilege('anon', 'public.expenditure_snapshots', 'insert')
    and not has_any_column_privilege('anon', 'public.expenditure_snapshots', 'update')
    and not has_any_column_privilege('anon', 'public.expenditure_snapshots', 'references'),
  'anon has no privilege on expenditure_snapshots'
);
select ok(
  not has_table_privilege('anon', 'public.targets', 'select')
    and not has_table_privilege('anon', 'public.targets', 'insert')
    and not has_table_privilege('anon', 'public.targets', 'update')
    and not has_table_privilege('anon', 'public.targets', 'delete')
    and not has_table_privilege('anon', 'public.targets', 'truncate')
    and not has_table_privilege('anon', 'public.targets', 'references')
    and not has_table_privilege('anon', 'public.targets', 'trigger')
    and not has_any_column_privilege('anon', 'public.targets', 'select')
    and not has_any_column_privilege('anon', 'public.targets', 'insert')
    and not has_any_column_privilege('anon', 'public.targets', 'update')
    and not has_any_column_privilege('anon', 'public.targets', 'references'),
  'anon has no privilege on targets'
);
select ok(
  not has_table_privilege('service_role', 'public.expenditure_snapshots', 'insert')
    and not has_table_privilege('service_role', 'public.expenditure_snapshots', 'update')
    and not has_table_privilege('service_role', 'public.expenditure_snapshots', 'delete')
    and not has_table_privilege('service_role', 'public.expenditure_snapshots', 'truncate')
    and not has_table_privilege('service_role', 'public.expenditure_snapshots', 'references')
    and not has_table_privilege('service_role', 'public.expenditure_snapshots', 'trigger')
    and not has_any_column_privilege('service_role', 'public.expenditure_snapshots', 'insert')
    and not has_any_column_privilege('service_role', 'public.expenditure_snapshots', 'update')
    and not has_any_column_privilege('service_role', 'public.expenditure_snapshots', 'references'),
  'service_role has no write privilege of any kind on expenditure_snapshots'
);
select ok(
  not has_table_privilege('service_role', 'public.targets', 'insert')
    and not has_table_privilege('service_role', 'public.targets', 'update')
    and not has_table_privilege('service_role', 'public.targets', 'delete')
    and not has_table_privilege('service_role', 'public.targets', 'truncate')
    and not has_table_privilege('service_role', 'public.targets', 'references')
    and not has_table_privilege('service_role', 'public.targets', 'trigger')
    and not has_any_column_privilege('service_role', 'public.targets', 'insert')
    and not has_any_column_privilege('service_role', 'public.targets', 'update')
    and not has_any_column_privilege('service_role', 'public.targets', 'references'),
  'service_role has no write privilege of any kind on targets'
);

-- Account deletion on the real tables: user C has a program, a snapshot, a closed target and a current
-- target. Deleting the auth user must succeed and leave nothing in either table.
select lives_ok(
  $$insert into public.programs (user_id, goal, rate_pct_per_week, protein_g_per_kg, fat_fraction_of_remaining, split_preset, started_on)
    values ('61000000-0000-4000-8000-0000000000cc', 'maintain', 0, 1.6, 0.4, 'balanced', '2026-10-01')$$,
  'a program is accepted for the account deletion case'
);
select lives_ok(
  $$select pg_temp.add_snapshot('61000000-0000-4000-8000-0000000000cc', '2026-10-05',
    program => (select id from public.programs where user_id = '61000000-0000-4000-8000-0000000000cc'))$$,
  'a snapshot is accepted for the account deletion case'
);
select lives_ok(
  $$select pg_temp.add_target('61000000-0000-4000-8000-0000000000cc', effective_from => '2026-10-01', effective_to => '2026-10-05')$$,
  'a closed target is accepted for the account deletion case'
);
select lives_ok(
  $$select pg_temp.add_target('61000000-0000-4000-8000-0000000000cc', effective_from => '2026-10-05', effective_to => null,
    program => (select id from public.programs where user_id = '61000000-0000-4000-8000-0000000000cc'),
    snapshot => (select id from public.expenditure_snapshots where user_id = '61000000-0000-4000-8000-0000000000cc'))$$,
  'a current target is accepted for the account deletion case'
);
select lives_ok(
  $$delete from auth.users where id = '61000000-0000-4000-8000-0000000000cc'$$,
  'deleting an auth user with snapshots and targets succeeds'
);
select is(
  (select count(*)::int from public.expenditure_snapshots where user_id = '61000000-0000-4000-8000-0000000000cc'),
  0,
  'the snapshots of the deleted user are gone'
);
select is(
  (select count(*)::int from public.targets where user_id = '61000000-0000-4000-8000-0000000000cc'),
  0,
  'the targets of the deleted user, closed ones included, are gone'
);

-- Deleting a program sets program_id null on the snapshots and targets that name it and deletes none of
-- them, and deleting a snapshot does the same for expenditure_snapshot_id. User F has one of each.
select lives_ok(
  $$insert into public.programs (user_id, goal, rate_pct_per_week, protein_g_per_kg, fat_fraction_of_remaining, split_preset, started_on)
    values ('61000000-0000-4000-8000-0000000000ff', 'maintain', 0, 1.6, 0.4, 'balanced', '2026-10-01')$$,
  'a program is accepted for the set null cases'
);
select lives_ok(
  $$select pg_temp.add_snapshot('61000000-0000-4000-8000-0000000000ff', '2026-10-05',
    program => (select id from public.programs where user_id = '61000000-0000-4000-8000-0000000000ff'))$$,
  'a snapshot naming the program is accepted'
);
select lives_ok(
  $$select pg_temp.add_target('61000000-0000-4000-8000-0000000000ff', effective_from => '2026-10-05', effective_to => null,
    program => (select id from public.programs where user_id = '61000000-0000-4000-8000-0000000000ff'),
    snapshot => (select id from public.expenditure_snapshots where user_id = '61000000-0000-4000-8000-0000000000ff'))$$,
  'a target naming the program and the snapshot is accepted'
);
select is(
  (select count(*)::int from public.expenditure_snapshots
    where user_id = '61000000-0000-4000-8000-0000000000ff' and program_id is not null),
  1,
  'the snapshot names the program before the delete'
);
select lives_ok(
  $$delete from public.programs where user_id = '61000000-0000-4000-8000-0000000000ff'$$,
  'deleting a program that snapshots and targets name succeeds'
);
select is(
  (select count(*)::int from public.expenditure_snapshots
    where user_id = '61000000-0000-4000-8000-0000000000ff' and program_id is null),
  1,
  'deleting a program sets program_id null on the snapshot and keeps the row'
);
select is(
  (select count(*)::int from public.targets
    where user_id = '61000000-0000-4000-8000-0000000000ff' and program_id is null and expenditure_snapshot_id is not null),
  1,
  'deleting a program sets program_id null on the target, keeps the row and keeps its snapshot link'
);
select lives_ok(
  $$delete from public.expenditure_snapshots where user_id = '61000000-0000-4000-8000-0000000000ff'$$,
  'deleting a snapshot that a target names succeeds'
);
select is(
  (select count(*)::int from public.targets
    where user_id = '61000000-0000-4000-8000-0000000000ff' and expenditure_snapshot_id is null),
  1,
  'deleting a snapshot sets expenditure_snapshot_id null on the target and keeps the row'
);

-- profiles.checkin_weekday: null, or 1 (Monday) to 7 (Sunday). User G's profile is made by the
-- new-user trigger and starts with no weekday.
select ok(
  (select checkin_weekday is null from public.profiles where id = '61000000-0000-4000-8000-000000000011'),
  'a new profile has no checkin_weekday'
);
select is(
  (select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_checkin_weekday_check'),
  'CHECK (((checkin_weekday >= 1) AND (checkin_weekday <= 7)))',
  'profiles_checkin_weekday_check allows 1 to 7'
);
select throws_ok(
  $$update public.profiles set checkin_weekday = 0 where id = '61000000-0000-4000-8000-000000000011'$$,
  '23514',
  'new row for relation "profiles" violates check constraint "profiles_checkin_weekday_check"',
  'checkin_weekday of 0 fails'
);
select throws_ok(
  $$update public.profiles set checkin_weekday = 8 where id = '61000000-0000-4000-8000-000000000011'$$,
  '23514',
  'new row for relation "profiles" violates check constraint "profiles_checkin_weekday_check"',
  'checkin_weekday of 8 fails'
);
select throws_ok(
  $$update public.profiles set checkin_weekday = -1 where id = '61000000-0000-4000-8000-000000000011'$$,
  '23514',
  'new row for relation "profiles" violates check constraint "profiles_checkin_weekday_check"',
  'a negative checkin_weekday fails'
);
select lives_ok(
  $$update public.profiles set checkin_weekday = 1 where id = '61000000-0000-4000-8000-000000000011'$$,
  'checkin_weekday of 1 passes'
);
select lives_ok(
  $$update public.profiles set checkin_weekday = 7 where id = '61000000-0000-4000-8000-000000000011'$$,
  'checkin_weekday of 7 passes'
);
select lives_ok(
  $$update public.profiles set checkin_weekday = null where id = '61000000-0000-4000-8000-000000000011'$$,
  'a null checkin_weekday passes'
);

select * from finish();

rollback;
