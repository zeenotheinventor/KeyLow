-- Asserts public.body_measurements (ADR 0003, Amendment 11): a user's imported body fat and lean mass
-- readings, owner-only through row level security and explicit column grants, with an import key that
-- includes the kind and outlives a soft delete.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so nothing
-- created here persists. Every fixture id starts with 56900000 and every external id with key569-.
-- Each actor is entered with `set local role` plus the JWT claims that `auth.uid()` reads, and left
-- with `reset role`.
--
-- Body measurements are health data. The fixtures are made up and no assertion name quotes a value
-- except where the value is the case under test (the bounds and the rounding). The table has no note
-- column, so a row is found by its key569- external id, and a manual row (which has none) by the
-- user it belongs to.

begin;

select plan(161);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '56900000-0000-4000-8000-0000000000aa', 'authenticated', 'authenticated', 'key569-body-a@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '56900000-0000-4000-8000-0000000000bb', 'authenticated', 'authenticated', 'key569-body-b@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '56900000-0000-4000-8000-0000000000cc', 'authenticated', 'authenticated', 'key569-body-c@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '56900000-0000-4000-8000-0000000000dd', 'authenticated', 'authenticated', 'key569-body-d@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '56900000-0000-4000-8000-0000000000ee', 'authenticated', 'authenticated', 'key569-body-e@keylow.test');

-- One reading on a fixed day, so a case names only what it is about. It runs as whoever calls it,
-- postgres in the cases below, so it is the table's constraints that decide and not its grants.
create function pg_temp.add_measurement(
  owner uuid,
  reading_kind public.body_measurement_kind,
  reading_value numeric,
  reading_source public.weigh_in_source,
  sample_id text,
  deleted timestamptz default null
)
returns void
language sql
as $$
  insert into public.body_measurements (user_id, kind, measured_at, local_date, tz, value, source, external_id, deleted_at)
  values (owner, reading_kind, '2026-10-17 08:00:00+00', '2026-10-17', 'Europe/London', reading_value, reading_source, sample_id, deleted)
$$;

-- The number of rows a statement affected, for the cases where row level security makes an update
-- match nothing instead of raising an error.
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

-- Shape.
select has_table('public', 'body_measurements', 'body_measurements exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.body_measurements'::regclass),
  'row level security is enabled on body_measurements'
);
select enum_has_labels(
  'public',
  'body_measurement_kind',
  array['body_fat_pct', 'lean_mass_kg'],
  'body_measurement_kind has exactly two values in the amendment''s order'
);
select columns_are(
  'public',
  'body_measurements',
  array['id', 'user_id', 'kind', 'measured_at', 'local_date', 'tz', 'value', 'source', 'external_id', 'deleted_at', 'created_at'],
  'body_measurements has the amendment''s columns and no note'
);
select col_is_pk('public', 'body_measurements', 'id', 'the primary key is id');
select col_type_is('public', 'body_measurements', 'id', 'uuid', 'id is a uuid');
select col_default_is('public', 'body_measurements', 'id', 'gen_random_uuid()', 'id defaults to a random uuid');
select col_type_is('public', 'body_measurements', 'user_id', 'uuid', 'user_id is a uuid');
select col_not_null('public', 'body_measurements', 'user_id', 'user_id is not null');
select col_default_is('public', 'body_measurements', 'user_id', 'auth.uid()', 'user_id defaults to the caller');
select fk_ok('public', 'body_measurements', 'user_id', 'auth', 'users', 'id', 'user_id references auth.users');
select is(
  (select confdeltype::text from pg_constraint where conrelid = 'public.body_measurements'::regclass and contype = 'f'),
  'c',
  'the user_id foreign key cascades on delete'
);
select col_type_is('public', 'body_measurements', 'kind', 'public', 'body_measurement_kind', 'kind is a body_measurement_kind');
select col_not_null('public', 'body_measurements', 'kind', 'kind is not null');
select col_hasnt_default('public', 'body_measurements', 'kind', 'kind has no default');
select col_type_is('public', 'body_measurements', 'measured_at', 'timestamp with time zone', 'measured_at is a timestamptz');
select col_not_null('public', 'body_measurements', 'measured_at', 'measured_at is not null');
select col_hasnt_default('public', 'body_measurements', 'measured_at', 'measured_at has no default');
select col_type_is('public', 'body_measurements', 'local_date', 'date', 'local_date is a date');
select col_not_null('public', 'body_measurements', 'local_date', 'local_date is not null');
select col_hasnt_default('public', 'body_measurements', 'local_date', 'local_date has no default');
select col_type_is('public', 'body_measurements', 'tz', 'text', 'tz is text');
select col_not_null('public', 'body_measurements', 'tz', 'tz is not null');
select col_hasnt_default('public', 'body_measurements', 'tz', 'tz has no default');
select col_type_is('public', 'body_measurements', 'value', 'numeric(6,3)', 'value is numeric(6,3)');
select col_not_null('public', 'body_measurements', 'value', 'value is not null');
select col_hasnt_default('public', 'body_measurements', 'value', 'value has no default');
select col_type_is('public', 'body_measurements', 'source', 'public', 'weigh_in_source', 'source is a weigh_in_source');
select col_not_null('public', 'body_measurements', 'source', 'source is not null');
select col_hasnt_default('public', 'body_measurements', 'source', 'source has no default');
select col_type_is('public', 'body_measurements', 'external_id', 'text', 'external_id is text');
select col_is_null('public', 'body_measurements', 'external_id', 'external_id is nullable');
select col_type_is('public', 'body_measurements', 'deleted_at', 'timestamp with time zone', 'deleted_at is a timestamptz');
select col_is_null('public', 'body_measurements', 'deleted_at', 'deleted_at is nullable');
select col_not_null('public', 'body_measurements', 'created_at', 'created_at is not null');
select col_default_is('public', 'body_measurements', 'created_at', 'now()', 'created_at defaults to now()');

-- A missing kind, source or measured_at is refused, because none of them has a default.
select throws_ok(
  $$insert into public.body_measurements (user_id, measured_at, local_date, tz, value, source)
    values ('56900000-0000-4000-8000-0000000000aa', '2026-10-17 08:00:00+00', '2026-10-17', 'Europe/London', 22, 'manual')$$,
  '23502',
  'null value in column "kind" of relation "body_measurements" violates not-null constraint',
  'an insert without kind is refused'
);
select throws_ok(
  $$insert into public.body_measurements (user_id, kind, measured_at, local_date, tz, value)
    values ('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', '2026-10-17 08:00:00+00', '2026-10-17', 'Europe/London', 22)$$,
  '23502',
  'null value in column "source" of relation "body_measurements" violates not-null constraint',
  'an insert without source is refused'
);
select throws_ok(
  $$insert into public.body_measurements (user_id, kind, local_date, tz, value, source)
    values ('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', '2026-10-17', 'Europe/London', 22, 'manual')$$,
  '23502',
  'null value in column "measured_at" of relation "body_measurements" violates not-null constraint',
  'an insert without measured_at is refused'
);

-- Bounds and rounding, per kind. The column rounds to 3 decimals, half away from zero, and the check
-- applies to the rounded value. Health rows carry a key569- external id so that each case is found.
select lives_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', 1, 'health_connect', 'key569-bf-min')$$,
  '1 is accepted as body fat'
);
select lives_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', 75, 'health_connect', 'key569-bf-max')$$,
  '75 is accepted as body fat'
);
select throws_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', 0.999, 'health_connect', 'key569-bf-below')$$,
  '23514',
  'new row for relation "body_measurements" violates check constraint "body_measurements_value_check"',
  '0.999 is refused as body fat'
);
select throws_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', 75.001, 'health_connect', 'key569-bf-above')$$,
  '23514',
  'new row for relation "body_measurements" violates check constraint "body_measurements_value_check"',
  '75.001 is refused as body fat'
);
select lives_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', 0.9996, 'health_connect', 'key569-bf-round-low-up')$$,
  '0.9996 rounds up to the minimum and is accepted as body fat'
);
select is(
  (select value::text from public.body_measurements where external_id = 'key569-bf-round-low-up'),
  '1.000',
  '0.9996 is stored as 1.000'
);
select throws_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', 0.9994, 'health_connect', 'key569-bf-round-low-down')$$,
  '23514',
  'new row for relation "body_measurements" violates check constraint "body_measurements_value_check"',
  '0.9994 rounds down to 0.999 and fails the body fat check'
);
select lives_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', 75.0004, 'health_connect', 'key569-bf-round-high-down')$$,
  '75.0004 rounds down to the maximum and is accepted as body fat'
);
select is(
  (select value::text from public.body_measurements where external_id = 'key569-bf-round-high-down'),
  '75.000',
  '75.0004 is stored as 75.000'
);
select throws_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', 75.0006, 'health_connect', 'key569-bf-round-high-up')$$,
  '23514',
  'new row for relation "body_measurements" violates check constraint "body_measurements_value_check"',
  '75.0006 rounds up to 75.001 and fails the body fat check'
);
select lives_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'lean_mass_kg', 10, 'health_connect', 'key569-lm-min')$$,
  '10 is accepted as lean mass'
);
select lives_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'lean_mass_kg', 300, 'health_connect', 'key569-lm-max')$$,
  '300 is accepted as lean mass'
);
select throws_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'lean_mass_kg', 9.999, 'health_connect', 'key569-lm-below')$$,
  '23514',
  'new row for relation "body_measurements" violates check constraint "body_measurements_value_check"',
  '9.999 is refused as lean mass'
);
select throws_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'lean_mass_kg', 300.001, 'health_connect', 'key569-lm-above')$$,
  '23514',
  'new row for relation "body_measurements" violates check constraint "body_measurements_value_check"',
  '300.001 is refused as lean mass'
);
select lives_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'lean_mass_kg', 9.9996, 'health_connect', 'key569-lm-round-low-up')$$,
  '9.9996 rounds up to the minimum and is accepted as lean mass'
);
select is(
  (select value::text from public.body_measurements where external_id = 'key569-lm-round-low-up'),
  '10.000',
  '9.9996 is stored as 10.000'
);
select throws_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'lean_mass_kg', 9.9994, 'health_connect', 'key569-lm-round-low-down')$$,
  '23514',
  'new row for relation "body_measurements" violates check constraint "body_measurements_value_check"',
  '9.9994 rounds down to 9.999 and fails the lean mass check'
);
select lives_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'lean_mass_kg', 300.0004, 'health_connect', 'key569-lm-round-high-down')$$,
  '300.0004 rounds down to the maximum and is accepted as lean mass'
);
select throws_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'lean_mass_kg', 300.0006, 'health_connect', 'key569-lm-round-high-up')$$,
  '23514',
  'new row for relation "body_measurements" violates check constraint "body_measurements_value_check"',
  '300.0006 rounds up to 300.001 and fails the lean mass check'
);

-- Across kinds: the same number is judged by the kind it is stored under.
select lives_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', 30, 'health_connect', 'key569-cross-bf-30')$$,
  '30 is accepted as body fat'
);
select lives_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'lean_mass_kg', 30, 'health_connect', 'key569-cross-lm-30')$$,
  '30 is accepted as lean mass'
);
select lives_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', 5, 'health_connect', 'key569-cross-bf-5')$$,
  '5 is accepted as body fat'
);
select throws_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'lean_mass_kg', 5, 'health_connect', 'key569-cross-lm-5')$$,
  '23514',
  'new row for relation "body_measurements" violates check constraint "body_measurements_value_check"',
  '5 is refused as lean mass'
);
select throws_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', 150, 'health_connect', 'key569-cross-bf-150')$$,
  '23514',
  'new row for relation "body_measurements" violates check constraint "body_measurements_value_check"',
  '150 is refused as body fat'
);
select lives_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'lean_mass_kg', 150, 'health_connect', 'key569-cross-lm-150')$$,
  '150 is accepted as lean mass'
);
select throws_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', 1000, 'health_connect', 'key569-overflow-bf')$$,
  '22003',
  'numeric field overflow',
  '1000 overflows numeric(6,3) as body fat before the check runs'
);
select throws_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'lean_mass_kg', 1000, 'health_connect', 'key569-overflow-lm')$$,
  '22003',
  'numeric field overflow',
  '1000 overflows numeric(6,3) as lean mass before the check runs'
);

-- Pairing of external_id with source.
select throws_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', 22, 'manual', 'key569-manual-with-id')$$,
  '23514',
  'new row for relation "body_measurements" violates check constraint "body_measurements_external_id_pairing_check"',
  'a manual row with an external_id is refused'
);
select throws_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', 22, 'health_connect', null)$$,
  '23514',
  'new row for relation "body_measurements" violates check constraint "body_measurements_external_id_pairing_check"',
  'a health_connect row without an external_id is refused'
);
select throws_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', 22, 'healthkit', null)$$,
  '23514',
  'new row for relation "body_measurements" violates check constraint "body_measurements_external_id_pairing_check"',
  'a healthkit row without an external_id is refused'
);
select throws_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', 22, 'health_connect', '')$$,
  '23514',
  'new row for relation "body_measurements" violates check constraint "body_measurements_external_id_pairing_check"',
  'a health_connect external_id of 0 characters is refused'
);
select throws_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', 22, 'healthkit', '')$$,
  '23514',
  'new row for relation "body_measurements" violates check constraint "body_measurements_external_id_pairing_check"',
  'a healthkit external_id of 0 characters is refused'
);
select throws_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', 22, 'import', '')$$,
  '23514',
  'new row for relation "body_measurements" violates check constraint "body_measurements_external_id_pairing_check"',
  'an import external_id of 0 characters is refused'
);
select throws_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', 22, 'health_connect', repeat('x', 201))$$,
  '23514',
  'new row for relation "body_measurements" violates check constraint "body_measurements_external_id_pairing_check"',
  'a health_connect external_id of 201 characters is refused'
);
select throws_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', 22, 'healthkit', repeat('x', 201))$$,
  '23514',
  'new row for relation "body_measurements" violates check constraint "body_measurements_external_id_pairing_check"',
  'a healthkit external_id of 201 characters is refused'
);
select throws_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', 22, 'import', repeat('x', 201))$$,
  '23514',
  'new row for relation "body_measurements" violates check constraint "body_measurements_external_id_pairing_check"',
  'an import external_id of 201 characters is refused'
);
select lives_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', 22, 'health_connect', 'x')$$,
  'a health_connect external_id of 1 character is accepted'
);
select lives_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', 22, 'health_connect', repeat('y', 200))$$,
  'a health_connect external_id of 200 characters is accepted'
);
select lives_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', 22, 'healthkit', 'x')$$,
  'a healthkit external_id of 1 character is accepted'
);
select lives_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', 22, 'import', 'x')$$,
  'an import external_id of 1 character is accepted'
);
select lives_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', 22, 'import', repeat('y', 200))$$,
  'an import external_id of 200 characters is accepted'
);
select lives_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', 22, 'import', null)$$,
  'an import row without an external_id is accepted'
);
select lives_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', 22, 'import', null)$$,
  'a second import row without an external_id does not conflict'
);
select lives_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000ee', 'lean_mass_kg', 60, 'manual', null)$$,
  'a manual row without an external_id is accepted'
);
select lives_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000ee', 'lean_mass_kg', 60, 'manual', null)$$,
  'a second manual row of the same kind does not conflict, because null keys are distinct'
);
select is(
  (select count(*)::int from public.body_measurements where user_id = '56900000-0000-4000-8000-0000000000ee' and source = 'manual' and kind = 'lean_mass_kg'),
  2,
  'any number of manual rows of one kind with a null external_id coexist'
);

-- The import key. It is a plain constraint that includes the kind, so it covers soft-deleted rows.
select is(
  (select pg_get_constraintdef(oid) from pg_constraint
    where conrelid = 'public.body_measurements'::regclass and conname = 'body_measurements_import_key'),
  'UNIQUE (user_id, kind, source, external_id)',
  'the import key is a plain unique constraint on (user_id, kind, source, external_id)'
);
select lives_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', 22, 'health_connect', 'key569-deleted-sample', now())$$,
  'a soft-deleted imported row is accepted'
);
select throws_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', 22, 'health_connect', 'key569-deleted-sample')$$,
  '23505',
  'duplicate key value violates unique constraint "body_measurements_import_key"',
  'a second row with the key of a soft-deleted row is refused'
);
select lives_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', 22, 'health_connect', 'key569-live-sample')$$,
  'a live imported row is accepted'
);
select throws_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', 23, 'health_connect', 'key569-live-sample')$$,
  '23505',
  'duplicate key value violates unique constraint "body_measurements_import_key"',
  'a second row with the key of a live row is refused'
);
select lives_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'lean_mass_kg', 60, 'health_connect', 'key569-deleted-sample')$$,
  'the same external id under the other kind is accepted'
);
select lives_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', 22, 'healthkit', 'key569-deleted-sample')$$,
  'the same external id under another source is accepted'
);
select lives_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000bb', 'body_fat_pct', 22, 'health_connect', 'key569-deleted-sample')$$,
  'the same external id for another user is accepted'
);

-- Owner-only, as user A. The inserts are the form PostgREST sends for a bulk import that ignores
-- duplicates.
set local role authenticated;
set local request.jwt.claims = '{"sub":"56900000-0000-4000-8000-0000000000aa","role":"authenticated"}';

select lives_ok(
  $$insert into public.body_measurements (kind, measured_at, local_date, tz, value, source, external_id)
    values ('body_fat_pct', '2026-10-16 07:30:00+00', '2026-10-16', 'Europe/London', 22.5, 'health_connect', 'key569-a-default-owner')$$,
  'user A inserts a reading without sending user_id'
);
select is(
  (select user_id from public.body_measurements where external_id = 'key569-a-default-owner'),
  '56900000-0000-4000-8000-0000000000aa'::uuid,
  'user_id defaults to the caller'
);
select lives_ok(
  $$insert into public.body_measurements (user_id, kind, measured_at, local_date, tz, value, source, external_id)
    values ('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', '2026-10-16 07:30:00+00', '2026-10-16', 'Europe/London', 22.4, 'health_connect', 'key569-a-sample')$$,
  'user A inserts an imported reading for themselves'
);
select lives_ok(
  $$insert into public.body_measurements (user_id, kind, measured_at, local_date, tz, value, source, external_id)
    values ('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', '2026-10-16 07:30:00+00', '2026-10-16', 'Europe/London', 29, 'health_connect', 'key569-a-sample')
    on conflict (user_id, kind, source, external_id) do nothing$$,
  'an import of a key the user already holds, with on conflict do nothing, is accepted'
);
select is(
  (select count(*)::int from public.body_measurements where external_id = 'key569-a-sample' and kind = 'body_fat_pct' and value = 22.4),
  1,
  'the imported key is held by one row, with its first value'
);
select lives_ok(
  $$insert into public.body_measurements (user_id, kind, measured_at, local_date, tz, value, source, external_id)
    values ('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', '2026-10-16 07:30:00+00', '2026-10-16', 'Europe/London', 29, 'health_connect', 'key569-deleted-sample')
    on conflict (user_id, kind, source, external_id) do nothing$$,
  'an import of a key whose row is soft-deleted, with on conflict do nothing, is accepted'
);
select is(
  (select count(*)::int from public.body_measurements
    where external_id = 'key569-deleted-sample' and kind = 'body_fat_pct' and source = 'health_connect' and deleted_at is not null),
  1,
  'the deleted import was not inserted again and its row stays deleted'
);
select lives_ok(
  $$insert into public.body_measurements (user_id, kind, measured_at, local_date, tz, value, source, external_id)
    values ('56900000-0000-4000-8000-0000000000aa', 'lean_mass_kg', '2026-10-16 07:30:00+00', '2026-10-16', 'Europe/London', 60.2, 'health_connect', 'key569-a-sample')
    on conflict (user_id, kind, source, external_id) do nothing$$,
  'the same sample id under the other kind is a different reading and is inserted'
);
select is(
  (select count(*)::int from public.body_measurements where external_id = 'key569-a-sample'),
  2,
  'one sample id holds a reading of each kind'
);
select throws_ok(
  $$insert into public.body_measurements (user_id, kind, measured_at, local_date, tz, value, source, external_id)
    values ('56900000-0000-4000-8000-0000000000bb', 'body_fat_pct', '2026-10-16 07:30:00+00', '2026-10-16', 'Europe/London', 22, 'health_connect', 'key569-a-for-b')$$,
  '42501',
  'new row violates row-level security policy for table "body_measurements"',
  'user A cannot insert a reading for user B'
);
select throws_ok(
  $$insert into public.body_measurements (user_id, kind, measured_at, local_date, tz, value, source, external_id, deleted_at)
    values ('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', '2026-10-16 07:30:00+00', '2026-10-16', 'Europe/London', 22, 'health_connect', 'key569-a-born-deleted', now())$$,
  '42501',
  'permission denied for table body_measurements',
  'a reading cannot be inserted already deleted'
);
select throws_ok(
  $$insert into public.body_measurements (id, kind, measured_at, local_date, tz, value, source, external_id)
    values ('56900000-0000-4000-8000-00000000f001', 'body_fat_pct', '2026-10-16 07:30:00+00', '2026-10-16', 'Europe/London', 22, 'health_connect', 'key569-a-chosen-id')$$,
  '42501',
  'permission denied for table body_measurements',
  'a client cannot choose the id'
);
select throws_ok(
  $$insert into public.body_measurements (kind, measured_at, local_date, tz, value, source, external_id, created_at)
    values ('body_fat_pct', '2026-10-16 07:30:00+00', '2026-10-16', 'Europe/London', 22, 'health_connect', 'key569-a-chosen-created', '2020-01-01')$$,
  '42501',
  'permission denied for table body_measurements',
  'a client cannot choose created_at'
);
select throws_ok(
  $$update public.body_measurements set value = 30 where external_id = 'key569-a-sample'$$,
  '42501',
  'permission denied for table body_measurements',
  'value of a reading cannot be updated'
);
select throws_ok(
  $$update public.body_measurements set kind = 'lean_mass_kg' where external_id = 'key569-a-sample'$$,
  '42501',
  'permission denied for table body_measurements',
  'kind of a reading cannot be updated'
);
select throws_ok(
  $$update public.body_measurements set measured_at = '2026-10-15 06:00:00+00' where external_id = 'key569-a-sample'$$,
  '42501',
  'permission denied for table body_measurements',
  'measured_at of a reading cannot be updated'
);
select throws_ok(
  $$update public.body_measurements set local_date = '2026-10-15' where external_id = 'key569-a-sample'$$,
  '42501',
  'permission denied for table body_measurements',
  'local_date of a reading cannot be updated'
);
select throws_ok(
  $$update public.body_measurements set tz = 'Europe/Paris' where external_id = 'key569-a-sample'$$,
  '42501',
  'permission denied for table body_measurements',
  'tz of a reading cannot be updated'
);
select throws_ok(
  $$update public.body_measurements set user_id = '56900000-0000-4000-8000-0000000000bb' where external_id = 'key569-a-sample'$$,
  '42501',
  'permission denied for table body_measurements',
  'user_id of a reading cannot be updated'
);
select throws_ok(
  $$update public.body_measurements set source = 'import' where external_id = 'key569-a-sample'$$,
  '42501',
  'permission denied for table body_measurements',
  'source of a reading cannot be updated'
);
select throws_ok(
  $$update public.body_measurements set external_id = 'key569-a-new-key' where external_id = 'key569-a-sample'$$,
  '42501',
  'permission denied for table body_measurements',
  'external_id of a reading cannot be updated'
);
select throws_ok(
  $$update public.body_measurements set created_at = '2020-01-01' where external_id = 'key569-a-sample'$$,
  '42501',
  'permission denied for table body_measurements',
  'created_at of a reading cannot be updated'
);
select throws_ok(
  $$delete from public.body_measurements where external_id = 'key569-a-sample'$$,
  '42501',
  'permission denied for table body_measurements',
  'user A cannot delete a reading'
);

-- Soft delete and restore, for a reading with a default owner and an imported one.
select lives_ok(
  $$update public.body_measurements set deleted_at = now() where external_id in ('key569-a-default-owner', 'key569-a-sample')$$,
  'user A soft-deletes their readings'
);
select is(
  (select count(*)::int from public.body_measurements
    where external_id in ('key569-a-default-owner', 'key569-a-sample') and deleted_at is not null),
  3,
  'the soft-deleted rows stay selectable with deleted_at set'
);
select lives_ok(
  $$update public.body_measurements set deleted_at = null where external_id in ('key569-a-default-owner', 'key569-a-sample')$$,
  'user A restores them by clearing deleted_at'
);
select is(
  (select count(*)::int from public.body_measurements
    where external_id in ('key569-a-default-owner', 'key569-a-sample') and deleted_at is null),
  3,
  'the restored rows are live again'
);
select is(
  (select count(*)::int from public.body_measurements where user_id <> '56900000-0000-4000-8000-0000000000aa'),
  0,
  'user A selects no row of another user'
);

reset role;

-- User B sees none of user A's rows, and can neither change nor delete them.
set local role authenticated;
set local request.jwt.claims = '{"sub":"56900000-0000-4000-8000-0000000000bb","role":"authenticated"}';

select is(
  (select count(*)::int from public.body_measurements where external_id like 'key569-%'),
  1,
  'user B selects only their own reading'
);
select is(
  (select external_id from public.body_measurements where external_id like 'key569-%'),
  'key569-deleted-sample',
  'the reading user B can select is their own'
);
select throws_ok(
  $$insert into public.body_measurements (user_id, kind, measured_at, local_date, tz, value, source, external_id)
    values ('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', '2026-10-16 07:30:00+00', '2026-10-16', 'Europe/London', 22, 'health_connect', 'key569-b-for-a')$$,
  '42501',
  'new row violates row-level security policy for table "body_measurements"',
  'user B cannot insert a reading for user A'
);
select is(
  pg_temp.affected_rows($$update public.body_measurements set deleted_at = now() where external_id = 'key569-a-sample'$$),
  0::bigint,
  'user B soft-deleting user A''s reading affects no row'
);
select is(
  pg_temp.affected_rows($$update public.body_measurements set deleted_at = now()$$),
  1::bigint,
  'user B updating with no where clause reaches only their own reading'
);

reset role;

select is(
  (select count(*)::int from public.body_measurements
    where external_id in ('key569-a-default-owner', 'key569-a-sample') and deleted_at is null),
  3,
  'user A''s readings were not changed by user B'
);
select is(
  (select count(*)::int from public.body_measurements where external_id = 'key569-b-for-a'),
  0,
  'user B wrote nothing into user A''s data'
);

-- User C has no readings yet. An update with no where clause is the case that reaches every row the
-- update policy lets through, so it affects none and raises no error for a row of another user.
set local role authenticated;
set local request.jwt.claims = '{"sub":"56900000-0000-4000-8000-0000000000cc","role":"authenticated"}';

select is(
  pg_temp.affected_rows($$update public.body_measurements set deleted_at = now()$$),
  0::bigint,
  'a user with no readings updating with no where clause affects no row'
);

reset role;

-- Anon can do nothing.
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  $$select * from public.body_measurements$$,
  '42501',
  'permission denied for table body_measurements',
  'anon cannot select from body_measurements'
);
select throws_ok(
  $$insert into public.body_measurements (user_id, kind, measured_at, local_date, tz, value, source, external_id)
    values ('56900000-0000-4000-8000-0000000000aa', 'body_fat_pct', '2026-10-16 07:30:00+00', '2026-10-16', 'Europe/London', 22, 'health_connect', 'key569-anon')$$,
  '42501',
  'permission denied for table body_measurements',
  'anon cannot insert into body_measurements'
);
select throws_ok(
  $$update public.body_measurements set deleted_at = now()$$,
  '42501',
  'permission denied for table body_measurements',
  'anon cannot update body_measurements'
);
select throws_ok(
  $$delete from public.body_measurements$$,
  '42501',
  'permission denied for table body_measurements',
  'anon cannot delete from body_measurements'
);

reset role;

-- Privileges, read from the catalog.
select is(
  (select array_agg(privilege_type::text order by privilege_type) from information_schema.table_privileges
    where table_schema = 'public' and table_name = 'body_measurements' and grantee = 'authenticated'),
  array['SELECT'],
  'authenticated holds table level select and nothing else'
);
select is(
  (select array_agg(column_name::text order by column_name) from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'body_measurements' and grantee = 'authenticated' and privilege_type = 'INSERT'),
  array['external_id', 'kind', 'local_date', 'measured_at', 'source', 'tz', 'user_id', 'value'],
  'authenticated can insert exactly user_id, kind, measured_at, local_date, tz, value, source and external_id'
);
select is(
  (select array_agg(column_name::text order by column_name) from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'body_measurements' and grantee = 'authenticated' and privilege_type = 'UPDATE'),
  array['deleted_at'],
  'authenticated can update exactly deleted_at'
);
select ok(
  not has_column_privilege('authenticated', 'public.body_measurements', 'kind', 'update')
    and not has_column_privilege('authenticated', 'public.body_measurements', 'value', 'update')
    and not has_column_privilege('authenticated', 'public.body_measurements', 'source', 'update')
    and not has_column_privilege('authenticated', 'public.body_measurements', 'external_id', 'update')
    and not has_column_privilege('authenticated', 'public.body_measurements', 'measured_at', 'update')
    and not has_column_privilege('authenticated', 'public.body_measurements', 'user_id', 'update'),
  'kind, value, source, external_id, measured_at and user_id cannot be updated'
);
select ok(
  not has_column_privilege('authenticated', 'public.body_measurements', 'id', 'insert')
    and not has_column_privilege('authenticated', 'public.body_measurements', 'id', 'update')
    and not has_column_privilege('authenticated', 'public.body_measurements', 'created_at', 'insert')
    and not has_column_privilege('authenticated', 'public.body_measurements', 'created_at', 'update')
    and not has_column_privilege('authenticated', 'public.body_measurements', 'deleted_at', 'insert'),
  'id and created_at are in neither list, and deleted_at is not insertable'
);
select ok(
  not has_table_privilege('authenticated', 'public.body_measurements', 'delete')
    and not has_table_privilege('authenticated', 'public.body_measurements', 'truncate')
    and not has_table_privilege('authenticated', 'public.body_measurements', 'references')
    and not has_table_privilege('authenticated', 'public.body_measurements', 'trigger'),
  'authenticated has no delete, truncate, references or trigger privilege'
);
select ok(
  not has_table_privilege('anon', 'public.body_measurements', 'select')
    and not has_table_privilege('anon', 'public.body_measurements', 'insert')
    and not has_table_privilege('anon', 'public.body_measurements', 'update')
    and not has_table_privilege('anon', 'public.body_measurements', 'delete')
    and not has_table_privilege('anon', 'public.body_measurements', 'truncate')
    and not has_table_privilege('anon', 'public.body_measurements', 'references')
    and not has_table_privilege('anon', 'public.body_measurements', 'trigger')
    and not has_any_column_privilege('anon', 'public.body_measurements', 'select')
    and not has_any_column_privilege('anon', 'public.body_measurements', 'insert')
    and not has_any_column_privilege('anon', 'public.body_measurements', 'update')
    and not has_any_column_privilege('anon', 'public.body_measurements', 'references'),
  'anon has no privilege on body_measurements'
);
select ok(
  not has_table_privilege('service_role', 'public.body_measurements', 'select')
    and not has_table_privilege('service_role', 'public.body_measurements', 'insert')
    and not has_table_privilege('service_role', 'public.body_measurements', 'update')
    and not has_table_privilege('service_role', 'public.body_measurements', 'delete')
    and not has_table_privilege('service_role', 'public.body_measurements', 'truncate')
    and not has_table_privilege('service_role', 'public.body_measurements', 'references')
    and not has_table_privilege('service_role', 'public.body_measurements', 'trigger')
    and not has_any_column_privilege('service_role', 'public.body_measurements', 'select')
    and not has_any_column_privilege('service_role', 'public.body_measurements', 'insert')
    and not has_any_column_privilege('service_role', 'public.body_measurements', 'update')
    and not has_any_column_privilege('service_role', 'public.body_measurements', 'references'),
  'service_role has no privilege on body_measurements'
);

-- Policies: one per statement the owner may run, and none for delete.
select policies_are(
  'public',
  'body_measurements',
  array['body_measurements_select_own', 'body_measurements_insert_own', 'body_measurements_update_own'],
  'body_measurements has exactly the select, insert and update owner policies'
);
select policy_roles_are('public', 'body_measurements', 'body_measurements_select_own', array['authenticated'], 'the select policy is for authenticated');
select policy_roles_are('public', 'body_measurements', 'body_measurements_insert_own', array['authenticated'], 'the insert policy is for authenticated');
select policy_roles_are('public', 'body_measurements', 'body_measurements_update_own', array['authenticated'], 'the update policy is for authenticated');
select policy_cmd_is('public', 'body_measurements', 'body_measurements_select_own', 'select', 'the select policy is for select');
select policy_cmd_is('public', 'body_measurements', 'body_measurements_insert_own', 'insert', 'the insert policy is for insert');
select policy_cmd_is('public', 'body_measurements', 'body_measurements_update_own', 'update', 'the update policy is for update');
select is(
  (select qual from pg_policies where tablename = 'body_measurements' and policyname = 'body_measurements_select_own'),
  '(user_id = ( SELECT auth.uid() AS uid))',
  'the select policy reads user_id = (select auth.uid())'
);
select is(
  (select with_check from pg_policies where tablename = 'body_measurements' and policyname = 'body_measurements_insert_own'),
  '(user_id = ( SELECT auth.uid() AS uid))',
  'the insert policy checks user_id = (select auth.uid())'
);
select is(
  (select qual || ' / ' || with_check from pg_policies where tablename = 'body_measurements' and policyname = 'body_measurements_update_own'),
  '(user_id = ( SELECT auth.uid() AS uid)) / (user_id = ( SELECT auth.uid() AS uid))',
  'the update policy uses and checks user_id = (select auth.uid())'
);

-- Indexes. The unique constraint leads with user_id, and the list index serves the list of one kind,
-- the trend and the range windows.
select is(
  (select pg_get_indexdef(indexrelid) from pg_index
    where indrelid = 'public.body_measurements'::regclass and indexrelid::regclass::text = 'body_measurements_list_idx'),
  'CREATE INDEX body_measurements_list_idx ON public.body_measurements USING btree (user_id, kind, local_date DESC, measured_at DESC)',
  'the list index is (user_id, kind, local_date desc, measured_at desc)'
);
select is(
  (select count(*)::int from pg_index where indrelid = 'public.body_measurements'::regclass),
  3,
  'body_measurements has the primary key, the import key and the list index and no other index'
);
select is(
  (select count(*)::int from pg_index where indrelid = 'public.body_measurements'::regclass and indpred is not null),
  0,
  'no index on body_measurements is partial'
);

-- Volume and order: 1,500 body fat readings of one user, inserted out of order, with a few lean mass
-- readings among them, read back for one kind newest first.
insert into public.body_measurements (user_id, kind, measured_at, local_date, tz, value, source, external_id)
select
  '56900000-0000-4000-8000-0000000000dd',
  'body_fat_pct',
  timestamptz '2024-01-01 00:00:00+00' + (g * interval '1 minute') + (((g - 1) / 5) * interval '1 day'),
  date '2024-01-01' + ((g - 1) / 5),
  'Europe/London',
  10 + (g % 10),
  'health_connect',
  'key569-volume-' || lpad(g::text, 4, '0')
from generate_series(1, 1500) as g
order by (g * 7919) % 1500;

insert into public.body_measurements (user_id, kind, measured_at, local_date, tz, value, source, external_id)
select
  '56900000-0000-4000-8000-0000000000dd',
  'lean_mass_kg',
  timestamptz '2024-01-01 12:00:00+00' + (g * interval '10 day'),
  date '2024-01-01' + (g * 10),
  'Europe/London',
  60 + (g % 5),
  'health_connect',
  'key569-volume-lean-' || lpad(g::text, 2, '0')
from generate_series(1, 30) as g;

set local role authenticated;
set local request.jwt.claims = '{"sub":"56900000-0000-4000-8000-0000000000dd","role":"authenticated"}';

select is(
  (select count(*)::int from public.body_measurements where kind = 'body_fat_pct'),
  1500,
  'a user with 1,500 body fat readings selects all of them for that kind'
);
select is(
  (select array_agg(external_id order by local_date desc, measured_at desc) from public.body_measurements where kind = 'body_fat_pct'),
  (select array_agg('key569-volume-' || lpad(g::text, 4, '0') order by g desc) from generate_series(1, 1500) as g),
  'the body fat readings read back in (local_date desc, measured_at desc) order'
);
select is(
  (select count(*)::int from public.body_measurements where kind = 'lean_mass_kg'),
  30,
  'the lean mass readings of the same user are a separate list'
);

reset role;

-- Account deletion on the real table: a user with a live and a soft-deleted reading of each kind, one
-- of them imported. Deleting the auth user must succeed and leave none.
select lives_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000cc', 'body_fat_pct', 22, 'manual', null)$$,
  'a live manual reading is accepted for the account deletion case'
);
select lives_ok(
  $$select pg_temp.add_measurement('56900000-0000-4000-8000-0000000000cc', 'lean_mass_kg', 60, 'health_connect', 'key569-c-sample', now())$$,
  'a soft-deleted imported reading is accepted for the account deletion case'
);
select lives_ok(
  $$delete from auth.users where id = '56900000-0000-4000-8000-0000000000cc'$$,
  'deleting an auth user with a live and a soft-deleted reading succeeds'
);
select is(
  (select count(*)::int from public.body_measurements where user_id = '56900000-0000-4000-8000-0000000000cc'),
  0,
  'the readings of the deleted user, soft-deleted ones included, are gone'
);
select * from finish();

rollback;
