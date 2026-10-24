-- Asserts public.weigh_ins (ADR 0003, Amendment 9): a user's weigh-ins, owner-only through row level
-- security and explicit column grants, with an import key that outlives a soft delete.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so nothing
-- created here persists. Every fixture id starts with 36000000 and every note and external id with
-- key360-. Each actor is entered with `set local role` plus the JWT claims that `auth.uid()` reads,
-- and left with `reset role`.
--
-- Weigh-ins are health data. The fixtures are made up and no assertion name quotes a weight except
-- where the weight is the case under test (the bounds and the rounding).

begin;

select plan(135);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '36000000-0000-4000-8000-0000000000aa', 'authenticated', 'authenticated', 'key360-weigh-a@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '36000000-0000-4000-8000-0000000000bb', 'authenticated', 'authenticated', 'key360-weigh-b@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '36000000-0000-4000-8000-0000000000cc', 'authenticated', 'authenticated', 'key360-weigh-c@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '36000000-0000-4000-8000-0000000000dd', 'authenticated', 'authenticated', 'key360-weigh-d@keylow.test');

-- One weigh-in on a fixed day, so a case names only what it is about. It runs as whoever calls it,
-- postgres in the cases below, so it is the table's constraints that decide and not its grants.
create function pg_temp.add_weigh_in(
  owner uuid,
  weight numeric,
  reading_source public.weigh_in_source,
  sample_id text,
  note_text text,
  deleted timestamptz default null
)
returns void
language sql
as $$
  insert into public.weigh_ins (user_id, measured_at, local_date, tz, weight_kg, source, external_id, note, deleted_at)
  values (owner, '2026-10-17 08:00:00+00', '2026-10-17', 'Europe/London', weight, reading_source, sample_id, note_text, deleted)
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
select has_table('public', 'weigh_ins', 'weigh_ins exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.weigh_ins'::regclass),
  'row level security is enabled on weigh_ins'
);
select enum_has_labels(
  'public',
  'weigh_in_source',
  array['manual', 'healthkit', 'health_connect', 'import'],
  'weigh_in_source has the four values in the amendment''s order'
);
select col_is_pk('public', 'weigh_ins', 'id', 'the primary key is id');
select col_type_is('public', 'weigh_ins', 'id', 'uuid', 'id is a uuid');
select col_default_is('public', 'weigh_ins', 'id', 'gen_random_uuid()', 'id defaults to a random uuid');
select col_type_is('public', 'weigh_ins', 'user_id', 'uuid', 'user_id is a uuid');
select col_not_null('public', 'weigh_ins', 'user_id', 'user_id is not null');
select col_default_is('public', 'weigh_ins', 'user_id', 'auth.uid()', 'user_id defaults to the caller');
select fk_ok('public', 'weigh_ins', 'user_id', 'auth', 'users', 'id', 'user_id references auth.users');
select is(
  (select confdeltype::text from pg_constraint where conrelid = 'public.weigh_ins'::regclass and contype = 'f'),
  'c',
  'the user_id foreign key cascades on delete'
);
select col_type_is('public', 'weigh_ins', 'measured_at', 'timestamp with time zone', 'measured_at is a timestamptz');
select col_not_null('public', 'weigh_ins', 'measured_at', 'measured_at is not null');
select col_hasnt_default('public', 'weigh_ins', 'measured_at', 'measured_at has no default');
select col_type_is('public', 'weigh_ins', 'local_date', 'date', 'local_date is a date');
select col_not_null('public', 'weigh_ins', 'local_date', 'local_date is not null');
select col_hasnt_default('public', 'weigh_ins', 'local_date', 'local_date has no default');
select col_type_is('public', 'weigh_ins', 'tz', 'text', 'tz is text');
select col_not_null('public', 'weigh_ins', 'tz', 'tz is not null');
select col_hasnt_default('public', 'weigh_ins', 'tz', 'tz has no default');
select col_type_is('public', 'weigh_ins', 'weight_kg', 'numeric(6,3)', 'weight_kg is numeric(6,3)');
select col_not_null('public', 'weigh_ins', 'weight_kg', 'weight_kg is not null');
select col_hasnt_default('public', 'weigh_ins', 'weight_kg', 'weight_kg has no default');
select col_type_is('public', 'weigh_ins', 'source', 'public', 'weigh_in_source', 'source is a weigh_in_source');
select col_not_null('public', 'weigh_ins', 'source', 'source is not null');
select col_hasnt_default('public', 'weigh_ins', 'source', 'source has no default');
select col_type_is('public', 'weigh_ins', 'external_id', 'text', 'external_id is text');
select col_is_null('public', 'weigh_ins', 'external_id', 'external_id is nullable');
select col_type_is('public', 'weigh_ins', 'note', 'text', 'note is text');
select col_is_null('public', 'weigh_ins', 'note', 'note is nullable');
select col_type_is('public', 'weigh_ins', 'deleted_at', 'timestamp with time zone', 'deleted_at is a timestamptz');
select col_is_null('public', 'weigh_ins', 'deleted_at', 'deleted_at is nullable');
select col_not_null('public', 'weigh_ins', 'created_at', 'created_at is not null');
select col_default_is('public', 'weigh_ins', 'created_at', 'now()', 'created_at defaults to now()');

-- A missing source or measured_at is refused, because neither has a default.
select throws_ok(
  $$insert into public.weigh_ins (user_id, measured_at, local_date, tz, weight_kg)
    values ('36000000-0000-4000-8000-0000000000aa', '2026-10-17 08:00:00+00', '2026-10-17', 'Europe/London', 80)$$,
  '23502',
  'null value in column "source" of relation "weigh_ins" violates not-null constraint',
  'an insert without source is refused'
);
select throws_ok(
  $$insert into public.weigh_ins (user_id, local_date, tz, weight_kg, source)
    values ('36000000-0000-4000-8000-0000000000aa', '2026-10-17', 'Europe/London', 80, 'manual')$$,
  '23502',
  'null value in column "measured_at" of relation "weigh_ins" violates not-null constraint',
  'an insert without measured_at is refused'
);

-- Bounds and rounding. The column rounds to 3 decimals, half away from zero, and the check applies
-- to the rounded value.
select lives_ok(
  $$select pg_temp.add_weigh_in('36000000-0000-4000-8000-0000000000aa', 20, 'manual', null, 'key360-bound-min')$$,
  '20 is accepted'
);
select lives_ok(
  $$select pg_temp.add_weigh_in('36000000-0000-4000-8000-0000000000aa', 400, 'manual', null, 'key360-bound-max')$$,
  '400 is accepted'
);
select throws_ok(
  $$select pg_temp.add_weigh_in('36000000-0000-4000-8000-0000000000aa', 19.999, 'manual', null, 'key360-bound-below')$$,
  '23514',
  'new row for relation "weigh_ins" violates check constraint "weigh_ins_weight_kg_check"',
  '19.999 is refused'
);
select throws_ok(
  $$select pg_temp.add_weigh_in('36000000-0000-4000-8000-0000000000aa', 400.001, 'manual', null, 'key360-bound-above')$$,
  '23514',
  'new row for relation "weigh_ins" violates check constraint "weigh_ins_weight_kg_check"',
  '400.001 is refused'
);
select lives_ok(
  $$select pg_temp.add_weigh_in('36000000-0000-4000-8000-0000000000aa', 19.9996, 'manual', null, 'key360-round-low-up')$$,
  '19.9996 rounds up to the minimum and is accepted'
);
select is(
  (select weight_kg::text from public.weigh_ins where note = 'key360-round-low-up'),
  '20.000',
  '19.9996 is stored as 20.000'
);
select throws_ok(
  $$select pg_temp.add_weigh_in('36000000-0000-4000-8000-0000000000aa', 19.9994, 'manual', null, 'key360-round-low-down')$$,
  '23514',
  'new row for relation "weigh_ins" violates check constraint "weigh_ins_weight_kg_check"',
  '19.9994 rounds down to 19.999 and fails the check'
);
select lives_ok(
  $$select pg_temp.add_weigh_in('36000000-0000-4000-8000-0000000000aa', 400.0004, 'manual', null, 'key360-round-high-down')$$,
  '400.0004 rounds down to the maximum and is accepted'
);
select is(
  (select weight_kg::text from public.weigh_ins where note = 'key360-round-high-down'),
  '400.000',
  '400.0004 is stored as 400.000'
);
select throws_ok(
  $$select pg_temp.add_weigh_in('36000000-0000-4000-8000-0000000000aa', 400.0006, 'manual', null, 'key360-round-high-up')$$,
  '23514',
  'new row for relation "weigh_ins" violates check constraint "weigh_ins_weight_kg_check"',
  '400.0006 rounds up to 400.001 and fails the check'
);
select throws_ok(
  $$select pg_temp.add_weigh_in('36000000-0000-4000-8000-0000000000aa', 1000, 'manual', null, 'key360-overflow')$$,
  '22003',
  'numeric field overflow',
  '1000 overflows numeric(6,3) before the check runs'
);

-- The note: null, or 1 to 200 characters. The database does not trim.
select lives_ok(
  $$select pg_temp.add_weigh_in('36000000-0000-4000-8000-0000000000aa', 80, 'manual', null, null)$$,
  'a null note is accepted'
);
select lives_ok(
  $$select pg_temp.add_weigh_in('36000000-0000-4000-8000-0000000000aa', 80, 'manual', null, 'key360-note-' || repeat('n', 188))$$,
  'a note of 200 characters is accepted'
);
select throws_ok(
  $$select pg_temp.add_weigh_in('36000000-0000-4000-8000-0000000000aa', 80, 'manual', null, 'key360-note-' || repeat('n', 189))$$,
  '23514',
  'new row for relation "weigh_ins" violates check constraint "weigh_ins_note_length_check"',
  'a note of 201 characters is refused'
);
select throws_ok(
  $$select pg_temp.add_weigh_in('36000000-0000-4000-8000-0000000000aa', 80, 'manual', null, '')$$,
  '23514',
  'new row for relation "weigh_ins" violates check constraint "weigh_ins_note_length_check"',
  'an empty note is refused'
);
select lives_ok(
  $$select pg_temp.add_weigh_in('36000000-0000-4000-8000-0000000000aa', 80, 'manual', null, '   ')$$,
  'a note of spaces is stored, because the database does not trim'
);

-- Pairing of external_id with source.
select throws_ok(
  $$select pg_temp.add_weigh_in('36000000-0000-4000-8000-0000000000aa', 80, 'manual', 'key360-manual-with-id', 'key360-pair-manual-id')$$,
  '23514',
  'new row for relation "weigh_ins" violates check constraint "weigh_ins_external_id_pairing_check"',
  'a manual row with an external_id is refused'
);
select throws_ok(
  $$select pg_temp.add_weigh_in('36000000-0000-4000-8000-0000000000aa', 80, 'health_connect', null, 'key360-pair-hc-null')$$,
  '23514',
  'new row for relation "weigh_ins" violates check constraint "weigh_ins_external_id_pairing_check"',
  'a health_connect row without an external_id is refused'
);
select throws_ok(
  $$select pg_temp.add_weigh_in('36000000-0000-4000-8000-0000000000aa', 80, 'healthkit', null, 'key360-pair-hk-null')$$,
  '23514',
  'new row for relation "weigh_ins" violates check constraint "weigh_ins_external_id_pairing_check"',
  'a healthkit row without an external_id is refused'
);
select throws_ok(
  $$select pg_temp.add_weigh_in('36000000-0000-4000-8000-0000000000aa', 80, 'health_connect', '', 'key360-pair-hc-empty')$$,
  '23514',
  'new row for relation "weigh_ins" violates check constraint "weigh_ins_external_id_pairing_check"',
  'a health_connect external_id of 0 characters is refused'
);
select throws_ok(
  $$select pg_temp.add_weigh_in('36000000-0000-4000-8000-0000000000aa', 80, 'healthkit', '', 'key360-pair-hk-empty')$$,
  '23514',
  'new row for relation "weigh_ins" violates check constraint "weigh_ins_external_id_pairing_check"',
  'a healthkit external_id of 0 characters is refused'
);
select throws_ok(
  $$select pg_temp.add_weigh_in('36000000-0000-4000-8000-0000000000aa', 80, 'import', '', 'key360-pair-import-empty')$$,
  '23514',
  'new row for relation "weigh_ins" violates check constraint "weigh_ins_external_id_pairing_check"',
  'an import external_id of 0 characters is refused'
);
select throws_ok(
  $$select pg_temp.add_weigh_in('36000000-0000-4000-8000-0000000000aa', 80, 'health_connect', repeat('x', 201), 'key360-pair-hc-long')$$,
  '23514',
  'new row for relation "weigh_ins" violates check constraint "weigh_ins_external_id_pairing_check"',
  'a health_connect external_id of 201 characters is refused'
);
select throws_ok(
  $$select pg_temp.add_weigh_in('36000000-0000-4000-8000-0000000000aa', 80, 'healthkit', repeat('x', 201), 'key360-pair-hk-long')$$,
  '23514',
  'new row for relation "weigh_ins" violates check constraint "weigh_ins_external_id_pairing_check"',
  'a healthkit external_id of 201 characters is refused'
);
select throws_ok(
  $$select pg_temp.add_weigh_in('36000000-0000-4000-8000-0000000000aa', 80, 'import', repeat('x', 201), 'key360-pair-import-long')$$,
  '23514',
  'new row for relation "weigh_ins" violates check constraint "weigh_ins_external_id_pairing_check"',
  'an import external_id of 201 characters is refused'
);
select lives_ok(
  $$select pg_temp.add_weigh_in('36000000-0000-4000-8000-0000000000aa', 80, 'health_connect', 'x', 'key360-pair-hc-one')$$,
  'a health_connect external_id of 1 character is accepted'
);
select lives_ok(
  $$select pg_temp.add_weigh_in('36000000-0000-4000-8000-0000000000aa', 80, 'health_connect', repeat('y', 200), 'key360-pair-hc-max')$$,
  'a health_connect external_id of 200 characters is accepted'
);
select lives_ok(
  $$select pg_temp.add_weigh_in('36000000-0000-4000-8000-0000000000aa', 80, 'healthkit', 'x', 'key360-pair-hk-one')$$,
  'a healthkit external_id of 1 character is accepted'
);
select lives_ok(
  $$select pg_temp.add_weigh_in('36000000-0000-4000-8000-0000000000aa', 80, 'import', 'x', 'key360-pair-import-one')$$,
  'an import external_id of 1 character is accepted'
);
select lives_ok(
  $$select pg_temp.add_weigh_in('36000000-0000-4000-8000-0000000000aa', 80, 'import', repeat('y', 200), 'key360-pair-import-max')$$,
  'an import external_id of 200 characters is accepted'
);
select lives_ok(
  $$select pg_temp.add_weigh_in('36000000-0000-4000-8000-0000000000aa', 80, 'import', null, 'key360-pair-import-null-1')$$,
  'an import row without an external_id is accepted'
);
select lives_ok(
  $$select pg_temp.add_weigh_in('36000000-0000-4000-8000-0000000000aa', 80, 'import', null, 'key360-pair-import-null-2')$$,
  'a second import row without an external_id does not conflict'
);

-- The import key. It is a plain constraint, so it covers soft-deleted rows.
select is(
  (select pg_get_constraintdef(oid) from pg_constraint
    where conrelid = 'public.weigh_ins'::regclass and conname = 'weigh_ins_import_key'),
  'UNIQUE (user_id, source, external_id)',
  'the import key is a plain unique constraint on (user_id, source, external_id)'
);
select lives_ok(
  $$select pg_temp.add_weigh_in('36000000-0000-4000-8000-0000000000aa', 80, 'health_connect', 'key360-deleted-sample', 'key360-key-first', now())$$,
  'a soft-deleted imported row is accepted'
);
select throws_ok(
  $$select pg_temp.add_weigh_in('36000000-0000-4000-8000-0000000000aa', 80, 'health_connect', 'key360-deleted-sample', 'key360-key-second')$$,
  '23505',
  'duplicate key value violates unique constraint "weigh_ins_import_key"',
  'a second row with the key of a soft-deleted row is refused'
);
select lives_ok(
  $$select pg_temp.add_weigh_in('36000000-0000-4000-8000-0000000000bb', 80, 'health_connect', 'key360-deleted-sample', 'key360-key-other-user')$$,
  'two users may share an external id'
);
select lives_ok(
  $$select pg_temp.add_weigh_in('36000000-0000-4000-8000-0000000000aa', 80, 'healthkit', 'key360-deleted-sample', 'key360-key-other-source')$$,
  'the same external id under two sources is accepted'
);
select is(
  (select count(*)::int from public.weigh_ins
    where user_id = '36000000-0000-4000-8000-0000000000aa' and source = 'manual' and external_id is null),
  7,
  'any number of manual rows with a null external_id coexist'
);

-- Owner-only, as user A. The insert is the form PostgREST sends for a bulk import that ignores
-- duplicates.
set local role authenticated;
set local request.jwt.claims = '{"sub":"36000000-0000-4000-8000-0000000000aa","role":"authenticated"}';

select lives_ok(
  $$insert into public.weigh_ins (measured_at, local_date, tz, weight_kg, source, note)
    values ('2026-10-16 07:30:00+00', '2026-10-16', 'Europe/London', 81.2, 'manual', 'key360-a-default-owner')$$,
  'user A inserts a weigh-in without sending user_id'
);
select is(
  (select user_id from public.weigh_ins where note = 'key360-a-default-owner'),
  '36000000-0000-4000-8000-0000000000aa'::uuid,
  'user_id defaults to the caller'
);
select lives_ok(
  $$insert into public.weigh_ins (user_id, measured_at, local_date, tz, weight_kg, source, external_id, note)
    values ('36000000-0000-4000-8000-0000000000aa', '2026-10-15 07:30:00+00', '2026-10-15', 'Europe/London', 81.4, 'health_connect', 'key360-a-sample', 'key360-a-import')$$,
  'user A inserts an imported weigh-in for themselves'
);
select lives_ok(
  $$insert into public.weigh_ins (user_id, measured_at, local_date, tz, weight_kg, source, external_id, note)
    values ('36000000-0000-4000-8000-0000000000aa', '2026-10-15 07:30:00+00', '2026-10-15', 'Europe/London', 81.4, 'health_connect', 'key360-a-sample', 'key360-a-import-again')
    on conflict (user_id, source, external_id) do nothing$$,
  'an import of a key the user already holds, with on conflict do nothing, is accepted'
);
select lives_ok(
  $$insert into public.weigh_ins (user_id, measured_at, local_date, tz, weight_kg, source, external_id, note)
    values ('36000000-0000-4000-8000-0000000000aa', '2026-10-14 07:30:00+00', '2026-10-14', 'Europe/London', 81.4, 'health_connect', 'key360-deleted-sample', 'key360-a-import-of-deleted')
    on conflict (user_id, source, external_id) do nothing$$,
  'an import of a key whose row is soft-deleted, with on conflict do nothing, is accepted'
);
select is(
  (select count(*)::int from public.weigh_ins
    where note in ('key360-a-import-again', 'key360-a-import-of-deleted')),
  0,
  'on conflict do nothing inserted neither the duplicate nor the deleted import again'
);
select is(
  (select count(*)::int from public.weigh_ins where source = 'health_connect' and external_id = 'key360-a-sample'),
  1,
  'the imported key is held by one row'
);
select throws_ok(
  $$insert into public.weigh_ins (user_id, measured_at, local_date, tz, weight_kg, source, note)
    values ('36000000-0000-4000-8000-0000000000bb', '2026-10-16 07:30:00+00', '2026-10-16', 'Europe/London', 70, 'manual', 'key360-a-for-b')$$,
  '42501',
  'new row violates row-level security policy for table "weigh_ins"',
  'user A cannot insert a weigh-in for user B'
);
select throws_ok(
  $$insert into public.weigh_ins (user_id, measured_at, local_date, tz, weight_kg, source, deleted_at)
    values ('36000000-0000-4000-8000-0000000000aa', '2026-10-16 07:30:00+00', '2026-10-16', 'Europe/London', 70, 'manual', now())$$,
  '42501',
  'permission denied for table weigh_ins',
  'a weigh-in cannot be inserted already deleted'
);
select throws_ok(
  $$insert into public.weigh_ins (id, measured_at, local_date, tz, weight_kg, source)
    values ('36000000-0000-4000-8000-00000000f001', '2026-10-16 07:30:00+00', '2026-10-16', 'Europe/London', 70, 'manual')$$,
  '42501',
  'permission denied for table weigh_ins',
  'a client cannot choose the id'
);
select throws_ok(
  $$insert into public.weigh_ins (measured_at, local_date, tz, weight_kg, source, created_at)
    values ('2026-10-16 07:30:00+00', '2026-10-16', 'Europe/London', 70, 'manual', '2020-01-01')$$,
  '42501',
  'permission denied for table weigh_ins',
  'a client cannot choose created_at'
);
select lives_ok(
  $$update public.weigh_ins set weight_kg = 81.0, note = 'key360-a-edited' where note = 'key360-a-default-owner'$$,
  'user A edits the weight and note of their own manual weigh-in'
);
select lives_ok(
  $$update public.weigh_ins
    set measured_at = '2026-10-16 06:00:00+00', local_date = '2026-10-16', tz = 'Europe/London'
    where note = 'key360-a-edited'$$,
  'user A moves the time of their own weigh-in with local_date and tz'
);
select throws_ok(
  $$update public.weigh_ins set user_id = '36000000-0000-4000-8000-0000000000bb' where note = 'key360-a-edited'$$,
  '42501',
  'permission denied for table weigh_ins',
  'user A cannot hand a weigh-in to user B'
);
select throws_ok(
  $$update public.weigh_ins set source = 'import' where note = 'key360-a-edited'$$,
  '42501',
  'permission denied for table weigh_ins',
  'the source of a weigh-in cannot be updated'
);
select throws_ok(
  $$update public.weigh_ins set external_id = 'key360-a-new-key' where note = 'key360-a-import'$$,
  '42501',
  'permission denied for table weigh_ins',
  'the external_id of a weigh-in cannot be updated'
);
select throws_ok(
  $$update public.weigh_ins set created_at = '2020-01-01' where note = 'key360-a-edited'$$,
  '42501',
  'permission denied for table weigh_ins',
  'created_at cannot be updated'
);
select throws_ok(
  $$delete from public.weigh_ins where note = 'key360-a-edited'$$,
  '42501',
  'permission denied for table weigh_ins',
  'user A cannot delete a weigh-in'
);

-- Soft delete and restore, for a manual row and an imported one.
select lives_ok(
  $$update public.weigh_ins set deleted_at = now() where note in ('key360-a-edited', 'key360-a-import')$$,
  'user A soft-deletes a manual and an imported weigh-in'
);
select is(
  (select count(*)::int from public.weigh_ins
    where note in ('key360-a-edited', 'key360-a-import') and deleted_at is not null),
  2,
  'the soft-deleted rows stay selectable with deleted_at set'
);
select lives_ok(
  $$update public.weigh_ins set deleted_at = null where note in ('key360-a-edited', 'key360-a-import')$$,
  'user A restores them by clearing deleted_at'
);
select is(
  (select count(*)::int from public.weigh_ins
    where note in ('key360-a-edited', 'key360-a-import') and deleted_at is null),
  2,
  'the restored rows are live again'
);
select is(
  (select count(*)::int from public.weigh_ins where user_id <> '36000000-0000-4000-8000-0000000000aa'),
  0,
  'user A selects no row of another user'
);

reset role;

-- User B sees none of user A's rows, and can neither change nor delete them.
set local role authenticated;
set local request.jwt.claims = '{"sub":"36000000-0000-4000-8000-0000000000bb","role":"authenticated"}';

select is(
  (select count(*)::int from public.weigh_ins where note like 'key360-%'),
  1,
  'user B selects only their own weigh-in'
);
select is(
  (select note from public.weigh_ins where note like 'key360-%'),
  'key360-key-other-user',
  'the weigh-in user B can select is their own'
);
select throws_ok(
  $$insert into public.weigh_ins (user_id, measured_at, local_date, tz, weight_kg, source, note)
    values ('36000000-0000-4000-8000-0000000000aa', '2026-10-16 07:30:00+00', '2026-10-16', 'Europe/London', 70, 'manual', 'key360-b-for-a')$$,
  '42501',
  'new row violates row-level security policy for table "weigh_ins"',
  'user B cannot insert a weigh-in for user A'
);
select is(
  pg_temp.affected_rows($$update public.weigh_ins set weight_kg = 55, note = 'key360-b-edited' where note = 'key360-a-edited'$$),
  0::bigint,
  'user B updating user A''s weigh-in affects no row'
);
select is(
  pg_temp.affected_rows($$update public.weigh_ins set deleted_at = now() where note = 'key360-a-import'$$),
  0::bigint,
  'user B soft-deleting user A''s weigh-in affects no row'
);
select is(
  pg_temp.affected_rows($$update public.weigh_ins set weight_kg = 55$$),
  1::bigint,
  'user B updating with no where clause reaches only their own weigh-in'
);

reset role;

select is(
  (select count(*)::int from public.weigh_ins
    where note in ('key360-a-edited', 'key360-a-import') and deleted_at is null and weight_kg = 81.0),
  1,
  'user A''s weigh-ins were not changed by user B'
);
select is(
  (select count(*)::int from public.weigh_ins where note in ('key360-b-edited', 'key360-b-for-a')),
  0,
  'user B wrote nothing into user A''s data'
);

-- User C has no weigh-ins yet. An update with no where clause is the case that reaches every row the
-- update policy lets through, so it affects none, and does not raise an error for a row of another
-- user.
set local role authenticated;
set local request.jwt.claims = '{"sub":"36000000-0000-4000-8000-0000000000cc","role":"authenticated"}';

select is(
  pg_temp.affected_rows($$update public.weigh_ins set weight_kg = 55$$),
  0::bigint,
  'a user with no weigh-ins updating with no where clause affects no row'
);

reset role;

-- Anon can do nothing.
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok('select * from public.weigh_ins', '42501', 'permission denied for table weigh_ins', 'anon cannot select from weigh_ins');
select throws_ok(
  $$insert into public.weigh_ins (user_id, measured_at, local_date, tz, weight_kg, source)
    values ('36000000-0000-4000-8000-0000000000aa', '2026-10-16 07:30:00+00', '2026-10-16', 'Europe/London', 70, 'manual')$$,
  '42501',
  'permission denied for table weigh_ins',
  'anon cannot insert into weigh_ins'
);
select throws_ok(
  $$update public.weigh_ins set note = 'key360-anon'$$,
  '42501',
  'permission denied for table weigh_ins',
  'anon cannot update weigh_ins'
);
select throws_ok('delete from public.weigh_ins', '42501', 'permission denied for table weigh_ins', 'anon cannot delete from weigh_ins');

reset role;

-- Privileges, read from the catalog.
select is(
  (select array_agg(privilege_type::text order by privilege_type) from information_schema.table_privileges
    where table_schema = 'public' and table_name = 'weigh_ins' and grantee = 'authenticated'),
  array['SELECT'],
  'authenticated holds table level select and nothing else'
);
select is(
  (select array_agg(column_name::text order by column_name) from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'weigh_ins' and grantee = 'authenticated' and privilege_type = 'INSERT'),
  array['external_id', 'local_date', 'measured_at', 'note', 'source', 'tz', 'user_id', 'weight_kg'],
  'authenticated can insert exactly user_id, measured_at, local_date, tz, weight_kg, source, external_id and note'
);
select is(
  (select array_agg(column_name::text order by column_name) from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'weigh_ins' and grantee = 'authenticated' and privilege_type = 'UPDATE'),
  array['deleted_at', 'local_date', 'measured_at', 'note', 'tz', 'weight_kg'],
  'authenticated can update exactly measured_at, local_date, tz, weight_kg, note and deleted_at'
);
select ok(
  not has_column_privilege('authenticated', 'public.weigh_ins', 'user_id', 'update')
    and not has_column_privilege('authenticated', 'public.weigh_ins', 'source', 'update')
    and not has_column_privilege('authenticated', 'public.weigh_ins', 'external_id', 'update'),
  'user_id, source and external_id cannot be updated'
);
select ok(
  not has_column_privilege('authenticated', 'public.weigh_ins', 'id', 'insert')
    and not has_column_privilege('authenticated', 'public.weigh_ins', 'id', 'update')
    and not has_column_privilege('authenticated', 'public.weigh_ins', 'created_at', 'insert')
    and not has_column_privilege('authenticated', 'public.weigh_ins', 'created_at', 'update')
    and not has_column_privilege('authenticated', 'public.weigh_ins', 'deleted_at', 'insert'),
  'id and created_at are in neither list, and deleted_at is not insertable'
);
select ok(
  not has_table_privilege('authenticated', 'public.weigh_ins', 'delete')
    and not has_table_privilege('authenticated', 'public.weigh_ins', 'truncate')
    and not has_table_privilege('authenticated', 'public.weigh_ins', 'references')
    and not has_table_privilege('authenticated', 'public.weigh_ins', 'trigger'),
  'authenticated has no delete, truncate, references or trigger privilege'
);
select ok(
  not has_table_privilege('anon', 'public.weigh_ins', 'select')
    and not has_table_privilege('anon', 'public.weigh_ins', 'insert')
    and not has_table_privilege('anon', 'public.weigh_ins', 'update')
    and not has_table_privilege('anon', 'public.weigh_ins', 'delete')
    and not has_table_privilege('anon', 'public.weigh_ins', 'truncate')
    and not has_table_privilege('anon', 'public.weigh_ins', 'references')
    and not has_table_privilege('anon', 'public.weigh_ins', 'trigger')
    and not has_any_column_privilege('anon', 'public.weigh_ins', 'select')
    and not has_any_column_privilege('anon', 'public.weigh_ins', 'insert')
    and not has_any_column_privilege('anon', 'public.weigh_ins', 'update')
    and not has_any_column_privilege('anon', 'public.weigh_ins', 'references'),
  'anon has no privilege on weigh_ins'
);
select ok(
  has_table_privilege('service_role', 'public.weigh_ins', 'select')
    and not has_table_privilege('service_role', 'public.weigh_ins', 'insert')
    and not has_table_privilege('service_role', 'public.weigh_ins', 'update')
    and not has_table_privilege('service_role', 'public.weigh_ins', 'delete')
    and not has_table_privilege('service_role', 'public.weigh_ins', 'truncate')
    and not has_table_privilege('service_role', 'public.weigh_ins', 'references')
    and not has_table_privilege('service_role', 'public.weigh_ins', 'trigger')
    and not has_any_column_privilege('service_role', 'public.weigh_ins', 'insert')
    and not has_any_column_privilege('service_role', 'public.weigh_ins', 'update')
    and not has_any_column_privilege('service_role', 'public.weigh_ins', 'references'),
  'service_role can select from weigh_ins and holds no other privilege on it'
);

-- Policies: one per statement the owner may run, and none for delete.
select policies_are(
  'public',
  'weigh_ins',
  array['weigh_ins_select_own', 'weigh_ins_insert_own', 'weigh_ins_update_own'],
  'weigh_ins has exactly the select, insert and update owner policies'
);
select policy_roles_are('public', 'weigh_ins', 'weigh_ins_select_own', array['authenticated'], 'the select policy is for authenticated');
select policy_roles_are('public', 'weigh_ins', 'weigh_ins_insert_own', array['authenticated'], 'the insert policy is for authenticated');
select policy_roles_are('public', 'weigh_ins', 'weigh_ins_update_own', array['authenticated'], 'the update policy is for authenticated');
select policy_cmd_is('public', 'weigh_ins', 'weigh_ins_select_own', 'select', 'the select policy is for select');
select policy_cmd_is('public', 'weigh_ins', 'weigh_ins_insert_own', 'insert', 'the insert policy is for insert');
select policy_cmd_is('public', 'weigh_ins', 'weigh_ins_update_own', 'update', 'the update policy is for update');
select is(
  (select qual from pg_policies where tablename = 'weigh_ins' and policyname = 'weigh_ins_select_own'),
  '(user_id = ( SELECT auth.uid() AS uid))',
  'the select policy reads user_id = (select auth.uid())'
);
select is(
  (select with_check from pg_policies where tablename = 'weigh_ins' and policyname = 'weigh_ins_insert_own'),
  '(user_id = ( SELECT auth.uid() AS uid))',
  'the insert policy checks user_id = (select auth.uid())'
);
select is(
  (select qual || ' / ' || with_check from pg_policies where tablename = 'weigh_ins' and policyname = 'weigh_ins_update_own'),
  '(user_id = ( SELECT auth.uid() AS uid)) / (user_id = ( SELECT auth.uid() AS uid))',
  'the update policy uses and checks user_id = (select auth.uid())'
);

-- Indexes. The unique constraint leads with user_id, and the list index serves the list, the trend
-- and the chart ranges.
select is(
  (select pg_get_indexdef(indexrelid) from pg_index where indrelid = 'public.weigh_ins'::regclass and indexrelid::regclass::text = 'weigh_ins_list_idx'),
  'CREATE INDEX weigh_ins_list_idx ON public.weigh_ins USING btree (user_id, local_date DESC, measured_at DESC)',
  'the list index is (user_id, local_date desc, measured_at desc)'
);
select is(
  (select count(*)::int from pg_index where indrelid = 'public.weigh_ins'::regclass),
  3,
  'weigh_ins has the primary key, the import key and the list index and no other index'
);
select is(
  (select count(*)::int from pg_index where indrelid = 'public.weigh_ins'::regclass and indpred is not null),
  0,
  'no index on weigh_ins is partial'
);

-- Volume and order: 1,500 weigh-ins of one user, inserted out of order, read back newest first.
insert into public.weigh_ins (user_id, measured_at, local_date, tz, weight_kg, source, note)
select
  '36000000-0000-4000-8000-0000000000dd',
  timestamptz '2024-01-01 00:00:00+00' + (g * interval '1 minute') + (((g - 1) / 5) * interval '1 day'),
  date '2024-01-01' + ((g - 1) / 5),
  'Europe/London',
  70 + (g % 10),
  'manual',
  'key360-volume-' || lpad(g::text, 4, '0')
from generate_series(1, 1500) as g
order by (g * 7919) % 1500;

set local role authenticated;
set local request.jwt.claims = '{"sub":"36000000-0000-4000-8000-0000000000dd","role":"authenticated"}';

select is(
  (select count(*)::int from public.weigh_ins),
  1500,
  'a user with 1,500 weigh-ins selects all of them'
);
select is(
  (select array_agg(note order by local_date desc, measured_at desc) from public.weigh_ins),
  (select array_agg('key360-volume-' || lpad(g::text, 4, '0') order by g desc) from generate_series(1, 1500) as g),
  'the weigh-ins read back in (local_date desc, measured_at desc) order'
);

reset role;

-- Account deletion on the real table: a user with a live and a soft-deleted weigh-in, one of them
-- imported. Deleting the auth user must succeed and leave none.
select pg_temp.add_weigh_in('36000000-0000-4000-8000-0000000000cc', 79, 'manual', null, 'key360-c-live');
select pg_temp.add_weigh_in('36000000-0000-4000-8000-0000000000cc', 79, 'health_connect', 'key360-c-sample', 'key360-c-deleted-import', now());

select lives_ok(
  $$delete from auth.users where id = '36000000-0000-4000-8000-0000000000cc'$$,
  'deleting an auth user with a live and a soft-deleted weigh-in succeeds'
);
select is(
  (select count(*)::int from public.weigh_ins where user_id = '36000000-0000-4000-8000-0000000000cc'),
  0,
  'the weigh-ins of the deleted user, soft-deleted ones included, are gone'
);
select * from finish();

rollback;
