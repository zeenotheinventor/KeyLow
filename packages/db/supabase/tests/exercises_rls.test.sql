-- Asserts the exercise library (ADR 0005, Amendment 1, KEY-347): the enums, the 22-muscle seed,
-- `exercises`, `exercise_muscles`, the deferred primary-muscle trigger, the two provenance tables,
-- every policy and the exact privilege set of each table, and public.save_exercise (every refusal,
-- the save and the rule that it never writes a global exercise). It ends with the cascade from a
-- deleted account.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so
-- nothing created here persists and nothing is ever committed. The primary-muscle trigger is
-- deferred to commit, so this file fires it with `set constraints ... immediate`, which runs every
-- pending check at that point, exactly as a commit would. An assertion that expects the trigger to
-- refuse runs the writes and the `set constraints` together, so its savepoint takes the bad rows
-- and their pending checks away again. Every fixture id starts with 34700000 and every name and
-- email with key347-, so the rows are recognisable as this file's. Nothing asserts a whole-table
-- count, except the exact muscle list. Each actor is entered with `set local role` plus the JWT
-- claims that `auth.uid()` reads, and left with `reset role`.
--
-- Health data: no fixture here is a real user's exercise, and the refusal messages asserted below
-- state a rule and never a value.

begin;

select plan(207);

-- Three users. The on_auth_user_created trigger creates their profiles rows. C is the throwaway
-- user whose account is deleted at the end.
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '34700000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'key347-user-a@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '34700000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'key347-user-b@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '34700000-0000-4000-8000-00000000000c', 'authenticated', 'authenticated', 'key347-user-c@keylow.test');

-- Fixtures, inserted as postgres so row level security does not apply: a global exercise with its
-- map, an import run and its raw row, and one custom exercise with a map for each of A, B and C.
-- Every fixture exercise has a primary muscle, so the pending trigger checks pass.
insert into public.exercises (id, owner_id, source, source_ref, name, equipment, mechanic) values
  ('34700000-0000-4000-8000-000000000101', null, 'free_exercise_db', 'KEY347-EX-1', 'key347-global-bench', 'barbell', 'compound'),
  ('34700000-0000-4000-8000-0000000001a1', '34700000-0000-4000-8000-00000000000a', 'user', null, 'key347-a-raise', 'dumbbell', 'isolation'),
  ('34700000-0000-4000-8000-0000000001b1', '34700000-0000-4000-8000-00000000000b', 'user', null, 'key347-b-curl', 'ez_bar', 'isolation'),
  ('34700000-0000-4000-8000-0000000001c1', '34700000-0000-4000-8000-00000000000c', 'user', null, 'key347-c-squat', 'barbell', 'compound');

insert into public.exercise_muscles (id, exercise_id, owner_id, muscle_id, role, weight) values
  ('34700000-0000-4000-8000-000000000201', '34700000-0000-4000-8000-000000000101', null, 'chest_lower', 'primary', 1),
  ('34700000-0000-4000-8000-000000000202', '34700000-0000-4000-8000-000000000101', null, 'chest_upper', 'secondary', 0.6),
  ('34700000-0000-4000-8000-000000000203', '34700000-0000-4000-8000-000000000101', null, 'delt_front', 'secondary', 0.5),
  ('34700000-0000-4000-8000-000000000204', '34700000-0000-4000-8000-000000000101', null, 'triceps', 'secondary', 0.5),
  ('34700000-0000-4000-8000-0000000002a1', '34700000-0000-4000-8000-0000000001a1', '34700000-0000-4000-8000-00000000000a', 'delt_side', 'primary', 1),
  ('34700000-0000-4000-8000-0000000002a2', '34700000-0000-4000-8000-0000000001a1', '34700000-0000-4000-8000-00000000000a', 'traps_upper', 'secondary', 0.3),
  ('34700000-0000-4000-8000-0000000002b1', '34700000-0000-4000-8000-0000000001b1', '34700000-0000-4000-8000-00000000000b', 'biceps', 'primary', 1),
  ('34700000-0000-4000-8000-0000000002c1', '34700000-0000-4000-8000-0000000001c1', '34700000-0000-4000-8000-00000000000c', 'quads', 'primary', 1),
  ('34700000-0000-4000-8000-0000000002c2', '34700000-0000-4000-8000-0000000001c1', '34700000-0000-4000-8000-00000000000c', 'glute_max', 'secondary', 0.7);

insert into public.exercise_import_runs (id, source, label, source_commit, file_sha256) values
  ('34700000-0000-4000-8000-000000000301', 'free_exercise_db', 'key347-run', 'key347-commit', repeat('a', 64));

insert into public.exercise_source_data (exercise_id, import_run_id, raw) values
  ('34700000-0000-4000-8000-000000000101', '34700000-0000-4000-8000-000000000301', '{"id":"KEY347-EX-1"}');

-- Payload builders for save_exercise. They live in the temporary schema, so nothing persists, and
-- are callable under the API roles.
create function pg_temp.exercise(exercise_name text)
returns jsonb language sql as $$
  select jsonb_build_object('name', exercise_name, 'equipment', 'dumbbell', 'mechanic', 'isolation')
$$;

create function pg_temp.muscle(muscle text, muscle_role text default 'primary', muscle_weight numeric default 1)
returns jsonb language sql as $$
  select jsonb_build_object('muscle_id', muscle, 'role', muscle_role, 'weight', muscle_weight)
$$;

-- Shape.
select has_table('public', 'muscles', 'muscles exists');
select has_table('public', 'exercises', 'exercises exists');
select has_table('public', 'exercise_muscles', 'exercise_muscles exists');
select has_table('public', 'exercise_import_runs', 'exercise_import_runs exists');
select has_table('public', 'exercise_source_data', 'exercise_source_data exists');
select ok(
  (select bool_and(relrowsecurity) from pg_class where oid in (
    'public.muscles'::regclass, 'public.exercises'::regclass, 'public.exercise_muscles'::regclass,
    'public.exercise_import_runs'::regclass, 'public.exercise_source_data'::regclass
  )),
  'row level security is enabled on all five tables'
);
select col_is_pk('public', 'muscles', 'id', 'muscles is keyed by its text id');
select col_is_pk('public', 'exercise_source_data', 'exercise_id', 'exercise_source_data is keyed by exercise_id');
select ok(
  (select bool_and(exists (
     select 1 from pg_attribute where attrelid = format('public.%I', t)::regclass and attname = 'created_at' and attnotnull
   )) from unnest(array['muscles', 'exercises', 'exercise_muscles', 'exercise_import_runs', 'exercise_source_data']) as t),
  'every table has a not null created_at'
);
select ok(
  not exists (
    select 1 from pg_attribute
    where attrelid in ('public.muscles'::regclass, 'public.exercises'::regclass, 'public.exercise_muscles'::regclass,
      'public.exercise_import_runs'::regclass, 'public.exercise_source_data'::regclass)
      and attname = 'updated_at' and not attisdropped
  ),
  'no table has an updated_at'
);
select col_hasnt_default('public', 'exercises', 'owner_id', 'exercises.owner_id has no default');
select col_is_null('public', 'exercises', 'owner_id', 'exercises.owner_id is nullable, null for a global row');
select col_is_null('public', 'exercise_muscles', 'owner_id', 'exercise_muscles.owner_id is nullable, null for a global map');
select col_is_null('public', 'exercises', 'deleted_at', 'exercises.deleted_at is nullable');
select col_type_is('public', 'exercises', 'equipment', 'equipment', 'exercises.equipment is the equipment enum');
select col_type_is('public', 'exercise_muscles', 'weight', 'numeric', 'exercise_muscles.weight is numeric');

-- Enums.
select enum_has_labels('public', 'muscle_group', array['chest', 'shoulders', 'back', 'arms', 'core', 'legs', 'neck'], 'muscle_group has exactly its values');
select enum_has_labels('public', 'muscle_size_class', array['small', 'medium', 'large'], 'muscle_size_class has exactly its values');
select enum_has_labels('public', 'exercise_source', array['free_exercise_db', 'user'], 'exercise_source has exactly its values');
select enum_has_labels('public', 'exercise_mechanic', array['compound', 'isolation'], 'exercise_mechanic has exactly its values');
select enum_has_labels('public', 'muscle_role', array['primary', 'secondary', 'stabiliser'], 'muscle_role has exactly its values');
select enum_has_labels('public', 'equipment', array['barbell', 'dumbbell', 'kettlebell', 'cable', 'machine', 'smith_machine', 'ez_bar', 'band', 'bodyweight', 'other'], 'equipment has exactly its values');

-- The muscle list, exactly: the 22 ids in the accepted order, with their group and size class.
select is(
  (select array_agg(position::text || ':' || id || ':' || "group"::text || ':' || size_class::text order by position) from public.muscles),
  array[
    '0:chest_upper:chest:medium', '1:chest_lower:chest:medium',
    '2:delt_front:shoulders:small', '3:delt_side:shoulders:small', '4:delt_rear:shoulders:small',
    '5:lats:back:medium', '6:traps_upper:back:medium', '7:traps_mid:back:medium', '8:lower_back:back:large',
    '9:biceps:arms:small', '10:triceps:arms:small', '11:forearms:arms:small',
    '12:abs:core:small', '13:obliques:core:small',
    '14:glute_max:legs:large', '15:glute_med:legs:medium', '16:quads:legs:large', '17:hamstrings:legs:large',
    '18:adductors:legs:medium', '19:calves:legs:small', '20:tibialis:legs:small',
    '21:neck:neck:small'
  ],
  'muscles holds exactly the 22 ids of the accepted list, in order, with their group and size class'
);
select throws_ok(
  $$ insert into public.muscles (id, "group", size_class, position) values ('Key347-Bad', 'neck', 'small', 99) $$,
  '23514',
  'new row for relation "muscles" violates check constraint "muscles_id_check"',
  'a muscle id must be lower case letters and underscores'
);
select throws_ok(
  $$ insert into public.muscles (id, "group", size_class, position) values ('key_three_four_seven', 'neck', 'small', 0) $$,
  '23505',
  'duplicate key value violates unique constraint "muscles_position_key"',
  'two muscles cannot share a position'
);

-- Foreign keys and their delete rules.
select is(
  (select confdeltype::text from pg_constraint where conrelid = 'public.exercises'::regclass and contype = 'f' and confrelid = 'auth.users'::regclass),
  'c',
  'deleting the owner deletes their exercises'
);
select is(
  (select confdeltype::text from pg_constraint where conrelid = 'public.exercise_muscles'::regclass and contype = 'f' and confrelid = 'public.exercises'::regclass),
  'c',
  'deleting an exercise deletes its map'
);
select is(
  (select confdeltype::text from pg_constraint where conrelid = 'public.exercise_muscles'::regclass and contype = 'f' and confrelid = 'auth.users'::regclass),
  'c',
  'deleting the owner deletes their map rows'
);
select is(
  (select confdeltype::text from pg_constraint where conrelid = 'public.exercise_muscles'::regclass and contype = 'f' and confrelid = 'public.muscles'::regclass),
  'a',
  'a map row''s muscle has no cascade'
);
select is(
  (select confdeltype::text from pg_constraint where conrelid = 'public.exercise_source_data'::regclass and contype = 'f' and confrelid = 'public.exercises'::regclass),
  'c',
  'deleting an exercise deletes its raw source row'
);
select is(
  (select confdeltype::text from pg_constraint where conrelid = 'public.exercise_source_data'::regclass and contype = 'f' and confrelid = 'public.exercise_import_runs'::regclass),
  'a',
  'a raw source row''s import run has no cascade'
);
select col_not_null('public', 'exercise_source_data', 'import_run_id', 'every raw source row names its import run');

-- Indexes.
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'exercises' and indexdef like '%USING gin (name%gin_trgm_ops)'),
  'there is a trigram index on exercises.name'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'exercises' and indexdef like '%(owner_id) WHERE (owner_id IS NOT NULL)' and indexdef not like 'CREATE UNIQUE%'),
  'there is a partial index on exercises.owner_id'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'exercises' and indexdef like 'CREATE UNIQUE INDEX%(source, source_ref)'),
  'exercises is unique on (source, source_ref)'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'exercise_muscles' and indexdef like 'CREATE UNIQUE INDEX%(exercise_id, muscle_id)'),
  'exercise_muscles is unique on (exercise_id, muscle_id)'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'exercise_muscles' and indexdef like '%(muscle_id)' and indexdef not like 'CREATE UNIQUE%'),
  'there is a plain index on exercise_muscles.muscle_id'
);

-- The primary-muscle trigger: one constraint trigger on each table, deferrable and initially
-- deferred, row level, on insert and update of exercises and insert, update and delete of maps.
-- tgtype bits: 1 row, 4 insert, 8 delete, 16 update.
select is(
  (select array_agg(tgrelid::regclass::text || ':' || tgtype::text || ':' || tgdeferrable::text || ':' || tginitdeferred::text || ':' || (tgconstraint <> 0)::text order by tgrelid::regclass::text)
   from pg_trigger where tgname = 'exercise_has_primary_muscle'),
  array['exercise_muscles:29:true:true:true', 'exercises:21:true:true:true'],
  'exercise_has_primary_muscle is a deferred constraint trigger on both tables, on exactly the agreed events'
);
select ok(
  (select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = 'public.exercise_has_primary_muscle()'::regprocedure),
  'the trigger function is security definer with an empty search_path'
);
select ok(
  not has_function_privilege('authenticated', 'public.exercise_has_primary_muscle()', 'execute')
    and not has_function_privilege('anon', 'public.exercise_has_primary_muscle()', 'execute')
    and not has_function_privilege('service_role', 'public.exercise_has_primary_muscle()', 'execute')
    and (select not exists (select 1 from aclexplode(proacl) as privilege where privilege.grantee = 0) from pg_proc where oid = 'public.exercise_has_primary_muscle()'::regprocedure),
  'nobody can call the trigger function'
);

-- Privileges. anon holds nothing at all, on any table or column.
select ok(
  (select bool_and(
     not has_any_column_privilege('anon', format('public.%I', t), 'select,insert,update,references')
       and not has_table_privilege('anon', format('public.%I', t), 'delete,truncate,trigger')
   ) from unnest(array['muscles', 'exercises', 'exercise_muscles', 'exercise_import_runs', 'exercise_source_data']) as t),
  'anon has no privilege on any of the five tables'
);

-- authenticated, table by table.
select is(
  (select array_agg(privilege_type::text order by privilege_type::text) from information_schema.table_privileges where table_schema = 'public' and table_name = 'muscles' and grantee = 'authenticated'),
  array['SELECT'],
  'authenticated holds only select on muscles'
);
select ok(
  not has_any_column_privilege('authenticated', 'public.muscles', 'insert,update,references'),
  'authenticated can write no column of muscles'
);
select is(
  (select array_agg(privilege_type::text order by privilege_type::text) from information_schema.table_privileges where table_schema = 'public' and table_name = 'exercises' and grantee = 'authenticated'),
  array['SELECT'],
  'authenticated holds only select on exercises as a table, so there is no delete'
);
select is(
  (select array_agg(column_name::text order by column_name::text collate "C") from information_schema.column_privileges where table_schema = 'public' and table_name = 'exercises' and grantee = 'authenticated' and privilege_type = 'INSERT'),
  array['equipment', 'mechanic', 'name', 'owner_id', 'source'],
  'authenticated can insert exactly these columns of exercises'
);
select is(
  (select array_agg(column_name::text order by column_name::text collate "C") from information_schema.column_privileges where table_schema = 'public' and table_name = 'exercises' and grantee = 'authenticated' and privilege_type = 'UPDATE'),
  array['deleted_at', 'equipment', 'mechanic', 'name'],
  'authenticated can update exactly these columns of exercises'
);
select is(
  (select array_agg(privilege_type::text order by privilege_type::text) from information_schema.table_privileges where table_schema = 'public' and table_name = 'exercise_muscles' and grantee = 'authenticated'),
  array['DELETE', 'SELECT'],
  'authenticated holds select and delete on exercise_muscles as a table'
);
select is(
  (select array_agg(column_name::text order by column_name::text collate "C") from information_schema.column_privileges where table_schema = 'public' and table_name = 'exercise_muscles' and grantee = 'authenticated' and privilege_type = 'INSERT'),
  array['exercise_id', 'muscle_id', 'owner_id', 'role', 'weight'],
  'authenticated can insert exactly these columns of exercise_muscles'
);
select is(
  (select count(*)::int from information_schema.column_privileges where table_schema = 'public' and table_name = 'exercise_muscles' and grantee = 'authenticated' and privilege_type = 'UPDATE'),
  0,
  'authenticated can update no column of exercise_muscles'
);
select ok(
  (select bool_and(
     not has_any_column_privilege('authenticated', format('public.%I', t), 'select,insert,update,references')
       and not has_table_privilege('authenticated', format('public.%I', t), 'delete,truncate,trigger')
   ) from unnest(array['exercise_import_runs', 'exercise_source_data']) as t),
  'authenticated has no privilege on the provenance tables'
);

-- service_role: the import's grants and nothing else.
select ok(
  not has_any_column_privilege('service_role', 'public.muscles', 'select,insert,update,references')
    and not has_table_privilege('service_role', 'public.muscles', 'delete,truncate,trigger'),
  'service_role has no privilege on muscles'
);
select is(
  (select array_agg(table_name::text || ':' || privilege_type::text order by table_name::text collate "C", privilege_type::text collate "C") from information_schema.table_privileges
   where table_schema = 'public' and grantee = 'service_role'
     and table_name in ('muscles', 'exercises', 'exercise_muscles', 'exercise_import_runs', 'exercise_source_data')),
  array[
    'exercise_import_runs:INSERT', 'exercise_import_runs:SELECT', 'exercise_import_runs:UPDATE',
    'exercise_muscles:DELETE', 'exercise_muscles:INSERT', 'exercise_muscles:SELECT',
    'exercise_source_data:INSERT', 'exercise_source_data:SELECT', 'exercise_source_data:UPDATE',
    'exercises:INSERT', 'exercises:SELECT', 'exercises:UPDATE'
  ],
  'service_role holds exactly the import''s table privileges'
);

-- Policies, as predicates.
select is(
  (select array_agg(tablename::text || '/' || policyname || ':' || cmd || ':' || roles::text order by tablename, policyname) from pg_policies
   where schemaname = 'public' and tablename in ('muscles', 'exercises', 'exercise_muscles', 'exercise_import_runs', 'exercise_source_data')),
  array[
    'exercise_muscles/exercise_muscles_delete_own:DELETE:{authenticated}',
    'exercise_muscles/exercise_muscles_insert_own:INSERT:{authenticated}',
    'exercise_muscles/exercise_muscles_select_visible:SELECT:{authenticated}',
    'exercises/exercises_insert_own:INSERT:{authenticated}',
    'exercises/exercises_select_visible:SELECT:{authenticated}',
    'exercises/exercises_update_own:UPDATE:{authenticated}',
    'muscles/muscles_select_all:SELECT:{authenticated}'
  ],
  'the five tables have exactly these policies, and the provenance tables have none'
);
select is(
  (select qual from pg_policies where tablename = 'muscles' and policyname = 'muscles_select_all'),
  'true',
  'muscles_select_all lets every signed-in user read every muscle'
);
select ok(
  (select qual like '%owner_id IS NULL%' and qual like '%SELECT auth.uid() AS uid%' from pg_policies where tablename = 'exercises' and policyname = 'exercises_select_visible')
    and (select with_check like '%SELECT auth.uid() AS uid%' and with_check like '%''user''::exercise_source%' from pg_policies where tablename = 'exercises' and policyname = 'exercises_insert_own')
    and (select qual like '%SELECT auth.uid() AS uid%' and with_check like '%SELECT auth.uid() AS uid%' from pg_policies where tablename = 'exercises' and policyname = 'exercises_update_own')
    and (select qual like '%owner_id IS NULL%' and qual like '%SELECT auth.uid() AS uid%' from pg_policies where tablename = 'exercise_muscles' and policyname = 'exercise_muscles_select_visible')
    and (select with_check like '%SELECT auth.uid() AS uid%' and with_check like '%exercises%' from pg_policies where tablename = 'exercise_muscles' and policyname = 'exercise_muscles_insert_own')
    and (select qual like '%SELECT auth.uid() AS uid%' from pg_policies where tablename = 'exercise_muscles' and policyname = 'exercise_muscles_delete_own'),
  'the exercise policies read auth.uid() once per statement, and the map insert checks the exercise'
);

-- save_exercise: security invoker, a fixed search path, and execute for authenticated alone.
select ok(
  (select not prosecdef and provolatile = 'v' from pg_proc where oid = 'public.save_exercise(uuid, jsonb, jsonb)'::regprocedure),
  'save_exercise is security invoker and volatile'
);
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc where oid = 'public.save_exercise(uuid, jsonb, jsonb)'::regprocedure),
  'save_exercise has an empty search_path'
);
select ok(
  has_function_privilege('authenticated', 'public.save_exercise(uuid, jsonb, jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.save_exercise(uuid, jsonb, jsonb)', 'execute')
    and not has_function_privilege('service_role', 'public.save_exercise(uuid, jsonb, jsonb)', 'execute')
    and (select not exists (select 1 from aclexplode(proacl) as privilege where privilege.grantee = 0) from pg_proc where oid = 'public.save_exercise(uuid, jsonb, jsonb)'::regprocedure),
  'only authenticated can execute save_exercise, and public cannot'
);

-- Table rules, as postgres.
select throws_ok(
  $$ insert into public.exercises (source, source_ref, name, equipment, mechanic) values ('free_exercise_db', 'KEY347-EX-1', 'key347-duplicate', 'barbell', 'compound') $$,
  '23505',
  'duplicate key value violates unique constraint "exercises_source_source_ref_key"',
  'two global exercises cannot share a source_ref'
);
select throws_ok(
  $$ insert into public.exercises (source, source_ref, name, equipment, mechanic) values ('user', null, 'key347-no-owner', 'band', 'isolation') $$,
  '23514',
  'new row for relation "exercises" violates check constraint "exercises_owner_matches_source"',
  'a user exercise must have an owner'
);
select throws_ok(
  $$ insert into public.exercises (owner_id, source, source_ref, name, equipment, mechanic) values ('34700000-0000-4000-8000-00000000000a', 'free_exercise_db', 'KEY347-EX-OWNED', 'key347-owned-global', 'band', 'isolation') $$,
  '23514',
  'new row for relation "exercises" violates check constraint "exercises_owner_matches_source"',
  'a global exercise cannot have an owner'
);
select throws_ok(
  $$ insert into public.exercises (owner_id, source, source_ref, name, equipment, mechanic) values ('34700000-0000-4000-8000-00000000000a', 'user', 'KEY347-REF', 'key347-user-ref', 'band', 'isolation') $$,
  '23514',
  'new row for relation "exercises" violates check constraint "exercises_source_ref_matches_source"',
  'a user exercise has no source_ref'
);
select throws_ok(
  $$ insert into public.exercises (source, name, equipment, mechanic) values ('free_exercise_db', 'key347-no-ref', 'band', 'isolation') $$,
  '23514',
  'new row for relation "exercises" violates check constraint "exercises_source_ref_matches_source"',
  'an imported exercise must have a source_ref'
);
select throws_ok(
  $$ insert into public.exercise_import_runs (source, label, source_commit, file_sha256) values ('user', 'key347-user-run', 'key347-commit', repeat('a', 64)) $$,
  '23514',
  'new row for relation "exercise_import_runs" violates check constraint "exercise_import_runs_source_not_user"',
  'an import run cannot be of user exercises'
);
select throws_ok(
  $$ insert into public.exercise_import_runs (source, label, source_commit, file_sha256) values ('free_exercise_db', 'key347-short-sha', 'key347-commit', repeat('a', 63)) $$,
  '23514',
  'new row for relation "exercise_import_runs" violates check constraint "exercise_import_runs_file_sha256_check"',
  'a file hash must be 64 hex characters'
);
select throws_ok(
  $$ insert into public.exercise_import_runs (source, label, source_commit, file_sha256) values ('free_exercise_db', 'key347-bad-sha', 'key347-commit', repeat('g', 64)) $$,
  '23514',
  'new row for relation "exercise_import_runs" violates check constraint "exercise_import_runs_file_sha256_check"',
  'a file hash must be hex'
);
select throws_ok(
  $$ insert into public.exercise_source_data (exercise_id, import_run_id, raw) values ('34700000-0000-4000-8000-000000000101', '34700000-0000-4000-8000-000000000301', '{}') $$,
  '23505',
  'duplicate key value violates unique constraint "exercise_source_data_pkey"',
  'an exercise has at most one raw source row'
);
select throws_ok(
  $$ insert into public.exercise_source_data (exercise_id, import_run_id, raw) values ('34700000-0000-4000-8000-0000000001a1', null, '{}') $$,
  '23502',
  'null value in column "import_run_id" of relation "exercise_source_data" violates not-null constraint',
  'a raw source row needs its import run'
);

-- Anon.
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok($$ select * from public.muscles $$, '42501', 'permission denied for table muscles', 'anon cannot select from muscles');
select throws_ok($$ select * from public.exercises $$, '42501', 'permission denied for table exercises', 'anon cannot select from exercises');
select throws_ok($$ select * from public.exercise_muscles $$, '42501', 'permission denied for table exercise_muscles', 'anon cannot select from exercise_muscles');
select throws_ok($$ select * from public.exercise_import_runs $$, '42501', 'permission denied for table exercise_import_runs', 'anon cannot select from exercise_import_runs');
select throws_ok($$ select * from public.exercise_source_data $$, '42501', 'permission denied for table exercise_source_data', 'anon cannot select from exercise_source_data');
select throws_ok(
  $$ insert into public.exercises (owner_id, source, name, equipment, mechanic) values (null, 'user', 'key347-anon', 'band', 'isolation') $$,
  '42501',
  'permission denied for table exercises',
  'anon cannot insert into exercises'
);
select throws_ok(
  $$ select public.save_exercise(null, pg_temp.exercise('key347-anon'), jsonb_build_array(pg_temp.muscle('abs'))) $$,
  '42501',
  'permission denied for function save_exercise',
  'anon cannot call save_exercise'
);

reset role;

-- service_role: the import writes global exercises, maps and provenance, and is held to the
-- primary-muscle rule like everyone else.
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';

select throws_ok($$ select * from public.muscles $$, '42501', 'permission denied for table muscles', 'service_role cannot read muscles');
select throws_ok(
  $$ insert into public.muscles (id, "group", size_class, position) values ('key_three_four_seven', 'neck', 'small', 99) $$,
  '42501',
  'permission denied for table muscles',
  'service_role cannot add a muscle'
);
select is(
  (select array_agg(name order by name) from public.exercises where name like 'key347-%'),
  array['key347-a-raise', 'key347-b-curl', 'key347-c-squat', 'key347-global-bench'],
  'service_role reads every exercise'
);
select lives_ok(
  $$ insert into public.exercises (id, source, source_ref, name, equipment, mechanic) values ('34700000-0000-4000-8000-000000000102', 'free_exercise_db', 'KEY347-EX-2', 'key347-global-row', 'cable', 'isolation');
     insert into public.exercise_muscles (exercise_id, muscle_id, role, weight) values ('34700000-0000-4000-8000-000000000102', 'delt_rear', 'primary', 1), ('34700000-0000-4000-8000-000000000102', 'traps_mid', 'secondary', 0.5);
     insert into public.exercise_import_runs (id, source, label, source_commit, file_sha256) values ('34700000-0000-4000-8000-000000000302', 'free_exercise_db', 'key347-run-2', 'key347-commit', repeat('b', 64));
     insert into public.exercise_source_data (exercise_id, import_run_id, raw) values ('34700000-0000-4000-8000-000000000102', '34700000-0000-4000-8000-000000000302', '{"id":"KEY347-EX-2"}');
     set constraints public.exercise_has_primary_muscle immediate;
     set constraints public.exercise_has_primary_muscle deferred $$,
  'service_role imports a global exercise with its map, run and raw row, and it passes the primary-muscle check'
);
select lives_ok(
  $$ update public.exercises set name = 'key347-global-row-renamed' where id = '34700000-0000-4000-8000-000000000102';
     update public.exercise_import_runs set finished_at = now(), row_count = 1 where id = '34700000-0000-4000-8000-000000000302';
     update public.exercise_source_data set raw = '{"id":"KEY347-EX-2","v":2}' where exercise_id = '34700000-0000-4000-8000-000000000102' $$,
  'service_role updates an exercise, a run and a raw row'
);
select lives_ok(
  $$ delete from public.exercise_muscles where exercise_id = '34700000-0000-4000-8000-000000000102';
     insert into public.exercise_muscles (exercise_id, muscle_id, role, weight) values ('34700000-0000-4000-8000-000000000102', 'delt_rear', 'primary', 0.9);
     set constraints public.exercise_has_primary_muscle immediate;
     set constraints public.exercise_has_primary_muscle deferred $$,
  'service_role replaces a global map inside one transaction'
);
select throws_ok(
  $$ insert into public.exercises (source, source_ref, name, equipment, mechanic) values ('free_exercise_db', 'KEY347-EX-3', 'key347-global-no-map', 'cable', 'isolation');
     set constraints public.exercise_has_primary_muscle immediate $$,
  '23514',
  'an exercise needs at least one primary muscle',
  'service_role cannot import an exercise with no map'
);
select throws_ok(
  $$ insert into public.exercises (id, source, source_ref, name, equipment, mechanic) values ('34700000-0000-4000-8000-000000000103', 'free_exercise_db', 'KEY347-EX-3', 'key347-global-secondary', 'cable', 'isolation');
     insert into public.exercise_muscles (exercise_id, muscle_id, role, weight) values ('34700000-0000-4000-8000-000000000103', 'forearms', 'secondary', 0.5);
     set constraints public.exercise_has_primary_muscle immediate $$,
  '23514',
  'an exercise needs at least one primary muscle',
  'service_role cannot import an exercise whose map has no primary muscle'
);
select throws_ok(
  $$ delete from public.exercises where id = '34700000-0000-4000-8000-000000000102' $$,
  '42501',
  'permission denied for table exercises',
  'service_role cannot hard delete an exercise'
);
select throws_ok(
  $$ update public.exercise_muscles set weight = 0.5 where exercise_id = '34700000-0000-4000-8000-000000000102' $$,
  '42501',
  'permission denied for table exercise_muscles',
  'service_role cannot edit a map row in place'
);
select throws_ok(
  $$ delete from public.exercise_import_runs where id = '34700000-0000-4000-8000-000000000302' $$,
  '42501',
  'permission denied for table exercise_import_runs',
  'service_role cannot delete an import run'
);
select throws_ok(
  $$ select public.save_exercise(null, pg_temp.exercise('key347-service'), jsonb_build_array(pg_temp.muscle('abs'))) $$,
  '42501',
  'permission denied for function save_exercise',
  'service_role cannot call save_exercise'
);

reset role;

-- User A: reads.
set local role authenticated;
set local request.jwt.claims = '{"sub":"34700000-0000-4000-8000-00000000000a","role":"authenticated"}';

select is(
  (select count(*)::int from public.muscles where id in ('chest_upper', 'neck')),
  2,
  'user A reads the muscle list'
);
select is(
  (select array_agg(name order by name) from public.exercises where name like 'key347-%'),
  array['key347-a-raise', 'key347-global-bench', 'key347-global-row-renamed'],
  'user A sees the global exercises and their own, and none of the other users'''
);
select is(
  (select array_agg(muscle_id order by muscle_id) from public.exercise_muscles where exercise_id = '34700000-0000-4000-8000-000000000101'),
  array['chest_lower', 'chest_upper', 'delt_front', 'triceps'],
  'user A reads a global exercise''s map'
);
select is(
  (select array_agg(muscle_id || ':' || role::text || ':' || weight::text order by muscle_id) from public.exercise_muscles where exercise_id = '34700000-0000-4000-8000-0000000001a1'),
  array['delt_side:primary:1', 'traps_upper:secondary:0.3'],
  'user A reads their own exercise''s map'
);
select is(
  (select count(*)::int from public.exercise_muscles where exercise_id in ('34700000-0000-4000-8000-0000000001b1', '34700000-0000-4000-8000-0000000001c1')),
  0,
  'user A sees none of the other users'' map rows'
);
select is(
  (select array_agg(name) from public.exercises where name ilike '%A-RAISE%'),
  array['key347-a-raise'],
  'a case-insensitive ilike on the name finds the exercise'
);
select is(
  (select count(*)::int from public.exercises where name ilike '%curl%' and name like 'key347-%'),
  0,
  'the name search does not find user B''s exercise'
);

-- User A: the muscle list and the provenance tables are closed.
select throws_ok(
  $$ insert into public.muscles (id, "group", size_class, position) values ('key_three_four_seven', 'neck', 'small', 99) $$,
  '42501', 'permission denied for table muscles', 'user A cannot add a muscle'
);
select throws_ok(
  $$ update public.muscles set size_class = 'large' where id = 'neck' $$,
  '42501', 'permission denied for table muscles', 'user A cannot change a muscle'
);
select throws_ok(
  $$ delete from public.muscles where id = 'neck' $$,
  '42501', 'permission denied for table muscles', 'user A cannot delete a muscle'
);
select throws_ok($$ select * from public.exercise_import_runs $$, '42501', 'permission denied for table exercise_import_runs', 'user A cannot read the import runs');
select throws_ok($$ select * from public.exercise_source_data $$, '42501', 'permission denied for table exercise_source_data', 'user A cannot read the raw source rows');
select throws_ok(
  $$ insert into public.exercise_import_runs (source, label, source_commit, file_sha256) values ('free_exercise_db', 'key347-forged', 'key347-commit', repeat('c', 64)) $$,
  '42501', 'permission denied for table exercise_import_runs', 'user A cannot forge an import run'
);
select throws_ok(
  $$ insert into public.exercise_source_data (exercise_id, import_run_id, raw) values ('34700000-0000-4000-8000-0000000001a1', '34700000-0000-4000-8000-000000000301', '{}') $$,
  '42501', 'permission denied for table exercise_source_data', 'user A cannot write a raw source row'
);
select throws_ok(
  $$ update public.exercise_source_data set raw = '{}' $$,
  '42501', 'permission denied for table exercise_source_data', 'user A cannot update the raw source rows'
);
select throws_ok(
  $$ delete from public.exercise_import_runs $$,
  '42501', 'permission denied for table exercise_import_runs', 'user A cannot delete an import run'
);

-- User A: inserting exercises directly. A new exercise needs its map in the same transaction.
select lives_ok(
  $$ insert into public.exercises (owner_id, source, name, equipment, mechanic) values ('34700000-0000-4000-8000-00000000000a', 'user', 'key347-a-direct', 'kettlebell', 'compound');
     insert into public.exercise_muscles (exercise_id, owner_id, muscle_id, role, weight)
       select id, '34700000-0000-4000-8000-00000000000a', 'glute_max', 'primary', 1 from public.exercises where name = 'key347-a-direct';
     set constraints public.exercise_has_primary_muscle immediate;
     set constraints public.exercise_has_primary_muscle deferred $$,
  'user A inserts their own exercise and its map directly'
);
select is(
  (select owner_id::text || '/' || source::text || '/' || coalesce(source_ref, 'null') || '/' || coalesce(deleted_at::text, 'null') from public.exercises where name = 'key347-a-direct'),
  '34700000-0000-4000-8000-00000000000a/user/null/null',
  'the direct insert belongs to A, is a user row and starts live'
);
select throws_ok(
  $$ insert into public.exercises (owner_id, source, name, equipment, mechanic) values ('34700000-0000-4000-8000-00000000000b', 'user', 'key347-a-for-b', 'band', 'isolation') $$,
  '42501',
  'new row violates row-level security policy for table "exercises"',
  'user A cannot insert an exercise for user B'
);
select throws_ok(
  $$ insert into public.exercises (owner_id, source, name, equipment, mechanic) values (null, 'free_exercise_db', 'key347-a-global', 'band', 'isolation') $$,
  '42501',
  'new row violates row-level security policy for table "exercises"',
  'user A cannot insert a global exercise'
);
select throws_ok(
  $$ insert into public.exercises (owner_id, source, name, equipment, mechanic) values ('34700000-0000-4000-8000-00000000000a', 'free_exercise_db', 'key347-a-imported', 'band', 'isolation') $$,
  '42501',
  'new row violates row-level security policy for table "exercises"',
  'user A cannot insert a row with an import source'
);
select throws_ok(
  $$ insert into public.exercises (owner_id, source, name, equipment, mechanic) values (null, 'user', 'key347-a-ownerless', 'band', 'isolation') $$,
  '42501',
  'new row violates row-level security policy for table "exercises"',
  'user A cannot insert an exercise without an owner'
);
select throws_ok(
  $$ insert into public.exercises (id, owner_id, source, name, equipment, mechanic) values ('34700000-0000-4000-8000-0000000001ff', '34700000-0000-4000-8000-00000000000a', 'user', 'key347-a-chosen-id', 'band', 'isolation') $$,
  '42501', 'permission denied for table exercises', 'user A cannot choose the id of an exercise'
);
select throws_ok(
  $$ insert into public.exercises (owner_id, source, source_ref, name, equipment, mechanic) values ('34700000-0000-4000-8000-00000000000a', 'user', 'KEY347-A', 'key347-a-ref', 'band', 'isolation') $$,
  '42501', 'permission denied for table exercises', 'user A cannot set a source_ref'
);
select throws_ok(
  $$ insert into public.exercises (owner_id, source, name, equipment, mechanic, deleted_at) values ('34700000-0000-4000-8000-00000000000a', 'user', 'key347-a-dead', 'band', 'isolation', now()) $$,
  '42501', 'permission denied for table exercises', 'user A cannot insert a deleted exercise'
);

-- User A: name bounds on the table.
select throws_ok(
  $$ insert into public.exercises (owner_id, source, name, equipment, mechanic) values ('34700000-0000-4000-8000-00000000000a', 'user', E' \t\n', 'band', 'isolation') $$,
  '23514',
  'new row for relation "exercises" violates check constraint "exercises_name_not_blank"',
  'a blank exercise name is refused'
);
select throws_ok(
  format($$ insert into public.exercises (owner_id, source, name, equipment, mechanic) values ('34700000-0000-4000-8000-00000000000a', 'user', %L, 'band', 'isolation') $$, repeat('n', 201)),
  '23514',
  'new row for relation "exercises" violates check constraint "exercises_name_length_check"',
  'an exercise name of 201 characters is refused'
);

-- User A: updates and soft delete.
select lives_ok(
  $$ update public.exercises set name = 'key347-a-raise-v2', equipment = 'cable' where id = '34700000-0000-4000-8000-0000000001a1' $$,
  'user A renames their own exercise'
);
select lives_ok(
  $$ update public.exercises set deleted_at = now() where id = '34700000-0000-4000-8000-0000000001a1';
     set constraints public.exercise_has_primary_muscle immediate;
     set constraints public.exercise_has_primary_muscle deferred $$,
  'user A soft deletes their own exercise, which still has its primary muscle'
);
select is(
  (select count(*)::int from public.exercises where id = '34700000-0000-4000-8000-0000000001a1' and deleted_at is not null),
  1,
  'a soft deleted exercise is still readable'
);
select lives_ok(
  $$ update public.exercises set deleted_at = null where id = '34700000-0000-4000-8000-0000000001a1' $$,
  'user A restores their own exercise'
);
with changed as (
  update public.exercises set name = 'key347-taken-over' where id = '34700000-0000-4000-8000-000000000101' returning 1
)
select is((select count(*)::int from changed), 0, 'user A updates no global exercise');
with changed as (
  update public.exercises set name = 'key347-taken-over' where id = '34700000-0000-4000-8000-0000000001b1' returning 1
)
select is((select count(*)::int from changed), 0, 'user A updates none of user B''s exercises');
select throws_ok(
  $$ update public.exercises set owner_id = '34700000-0000-4000-8000-00000000000b' where id = '34700000-0000-4000-8000-0000000001a1' $$,
  '42501', 'permission denied for table exercises', 'user A cannot hand an exercise to user B'
);
select throws_ok(
  $$ update public.exercises set source = 'free_exercise_db' where id = '34700000-0000-4000-8000-0000000001a1' $$,
  '42501', 'permission denied for table exercises', 'user A cannot change the source of an exercise'
);
select throws_ok(
  $$ update public.exercises set source_ref = 'KEY347-X' where id = '34700000-0000-4000-8000-0000000001a1' $$,
  '42501', 'permission denied for table exercises', 'user A cannot set a source_ref on update'
);
select throws_ok(
  $$ update public.exercises set created_at = '2020-01-01' where id = '34700000-0000-4000-8000-0000000001a1' $$,
  '42501', 'permission denied for table exercises', 'user A cannot change created_at'
);
select throws_ok(
  $$ delete from public.exercises where id = '34700000-0000-4000-8000-0000000001a1' $$,
  '42501', 'permission denied for table exercises', 'user A cannot hard delete their own exercise'
);

-- User A: map rows.
select lives_ok(
  $$ insert into public.exercise_muscles (exercise_id, owner_id, muscle_id, role, weight) values ('34700000-0000-4000-8000-0000000001a1', '34700000-0000-4000-8000-00000000000a', 'delt_rear', 'stabiliser', 0.2) $$,
  'user A adds a muscle to their own exercise'
);
select lives_ok(
  $$ insert into public.exercise_muscles (exercise_id, owner_id, muscle_id, role, weight) values ('34700000-0000-4000-8000-0000000001a1', '34700000-0000-4000-8000-00000000000a', 'forearms', 'stabiliser', 1) $$,
  'a weight of exactly 1 is accepted'
);
select lives_ok(
  $$ insert into public.exercise_muscles (exercise_id, owner_id, muscle_id, role, weight) values ('34700000-0000-4000-8000-0000000001a1', '34700000-0000-4000-8000-00000000000a', 'abs', 'stabiliser', 0.001) $$,
  'a small weight above 0 is accepted'
);
select throws_ok(
  $$ insert into public.exercise_muscles (exercise_id, owner_id, muscle_id, role, weight) values ('34700000-0000-4000-8000-0000000001a1', '34700000-0000-4000-8000-00000000000a', 'traps_upper', 'stabiliser', 0.5) $$,
  '23505',
  'duplicate key value violates unique constraint "exercise_muscles_exercise_id_muscle_id_key"',
  'a muscle is listed at most once per exercise'
);
select throws_ok(
  $$ insert into public.exercise_muscles (exercise_id, owner_id, muscle_id, role, weight) values ('34700000-0000-4000-8000-0000000001a1', '34700000-0000-4000-8000-00000000000a', 'neck', 'stabiliser', 0) $$,
  '23514',
  'new row for relation "exercise_muscles" violates check constraint "exercise_muscles_weight_check"',
  'a weight of 0 is refused'
);
select throws_ok(
  $$ insert into public.exercise_muscles (exercise_id, owner_id, muscle_id, role, weight) values ('34700000-0000-4000-8000-0000000001a1', '34700000-0000-4000-8000-00000000000a', 'neck', 'stabiliser', -0.5) $$,
  '23514',
  'new row for relation "exercise_muscles" violates check constraint "exercise_muscles_weight_check"',
  'a negative weight is refused'
);
select throws_ok(
  $$ insert into public.exercise_muscles (exercise_id, owner_id, muscle_id, role, weight) values ('34700000-0000-4000-8000-0000000001a1', '34700000-0000-4000-8000-00000000000a', 'neck', 'stabiliser', 1.01) $$,
  '23514',
  'new row for relation "exercise_muscles" violates check constraint "exercise_muscles_weight_check"',
  'a weight above 1 is refused'
);
select throws_ok(
  $$ insert into public.exercise_muscles (exercise_id, owner_id, muscle_id, role, weight) values ('34700000-0000-4000-8000-0000000001a1', '34700000-0000-4000-8000-00000000000a', 'key347_not_a_muscle', 'stabiliser', 0.5) $$,
  '23503',
  'insert or update on table "exercise_muscles" violates foreign key constraint "exercise_muscles_muscle_id_fkey"',
  'a muscle that is not on the list is refused'
);
select throws_ok(
  $$ insert into public.exercise_muscles (exercise_id, owner_id, muscle_id, role, weight) values ('34700000-0000-4000-8000-000000000101', '34700000-0000-4000-8000-00000000000a', 'neck', 'stabiliser', 0.5) $$,
  '42501',
  'new row violates row-level security policy for table "exercise_muscles"',
  'user A cannot add a muscle to a global exercise'
);
select throws_ok(
  $$ insert into public.exercise_muscles (exercise_id, owner_id, muscle_id, role, weight) values ('34700000-0000-4000-8000-000000000101', null, 'neck', 'stabiliser', 0.5) $$,
  '42501',
  'new row violates row-level security policy for table "exercise_muscles"',
  'user A cannot add a global map row'
);
select throws_ok(
  $$ insert into public.exercise_muscles (exercise_id, owner_id, muscle_id, role, weight) values ('34700000-0000-4000-8000-0000000001b1', '34700000-0000-4000-8000-00000000000a', 'neck', 'stabiliser', 0.5) $$,
  '42501',
  'new row violates row-level security policy for table "exercise_muscles"',
  'user A cannot add a muscle to user B''s exercise'
);
select throws_ok(
  $$ insert into public.exercise_muscles (exercise_id, owner_id, muscle_id, role, weight) values ('34700000-0000-4000-8000-0000000001a1', '34700000-0000-4000-8000-00000000000b', 'neck', 'stabiliser', 0.5) $$,
  '42501',
  'new row violates row-level security policy for table "exercise_muscles"',
  'user A cannot insert a map row with user B''s owner_id'
);
select throws_ok(
  $$ insert into public.exercise_muscles (exercise_id, owner_id, muscle_id, role, weight) values ('34700000-0000-4000-8000-00000000dead', '34700000-0000-4000-8000-00000000000a', 'neck', 'stabiliser', 0.5) $$,
  '42501',
  'new row violates row-level security policy for table "exercise_muscles"',
  'an exercise that does not exist fails the same way as one that is not theirs'
);
select throws_ok(
  $$ insert into public.exercise_muscles (id, exercise_id, owner_id, muscle_id, role, weight) values ('34700000-0000-4000-8000-0000000002ff', '34700000-0000-4000-8000-0000000001a1', '34700000-0000-4000-8000-00000000000a', 'neck', 'stabiliser', 0.5) $$,
  '42501', 'permission denied for table exercise_muscles', 'user A cannot choose the id of a map row'
);
select throws_ok(
  $$ update public.exercise_muscles set weight = 0.5 where id = '34700000-0000-4000-8000-0000000002a2' $$,
  '42501', 'permission denied for table exercise_muscles', 'user A cannot edit a map row in place'
);
with removed as (
  delete from public.exercise_muscles where exercise_id = '34700000-0000-4000-8000-000000000101' returning 1
)
select is((select count(*)::int from removed), 0, 'user A deletes none of a global exercise''s map');
with removed as (
  delete from public.exercise_muscles where exercise_id = '34700000-0000-4000-8000-0000000001b1' returning 1
)
select is((select count(*)::int from removed), 0, 'user A deletes none of user B''s map');
with removed as (
  delete from public.exercise_muscles where exercise_id = '34700000-0000-4000-8000-0000000001a1' and muscle_id in ('delt_rear', 'forearms', 'abs') returning 1
)
select is((select count(*)::int from removed), 3, 'user A deletes their own map rows');

-- User A: the primary-muscle rule, checked when the deferred trigger fires.
select lives_ok(
  $$ set constraints public.exercise_has_primary_muscle immediate;
     set constraints public.exercise_has_primary_muscle deferred $$,
  'every exercise written so far has a primary muscle'
);
select throws_ok(
  $$ insert into public.exercises (owner_id, source, name, equipment, mechanic) values ('34700000-0000-4000-8000-00000000000a', 'user', 'key347-a-no-map', 'band', 'isolation');
     set constraints public.exercise_has_primary_muscle immediate $$,
  '23514',
  'an exercise needs at least one primary muscle',
  'an exercise with no map is refused when the check runs'
);
select throws_ok(
  $$ insert into public.exercises (owner_id, source, name, equipment, mechanic) values ('34700000-0000-4000-8000-00000000000a', 'user', 'key347-a-secondary-only', 'band', 'isolation');
     insert into public.exercise_muscles (exercise_id, owner_id, muscle_id, role, weight)
       select id, '34700000-0000-4000-8000-00000000000a', 'abs', 'secondary', 1 from public.exercises where name = 'key347-a-secondary-only';
     set constraints public.exercise_has_primary_muscle immediate $$,
  '23514',
  'an exercise needs at least one primary muscle',
  'an exercise whose map has only secondary muscles is refused when the check runs'
);
select throws_ok(
  $$ delete from public.exercise_muscles where exercise_id = '34700000-0000-4000-8000-0000000001a1' and role = 'primary';
     set constraints public.exercise_has_primary_muscle immediate $$,
  '23514',
  'an exercise needs at least one primary muscle',
  'removing the only primary muscle of an exercise is refused when the check runs'
);
select lives_ok(
  $$ delete from public.exercise_muscles where exercise_id = '34700000-0000-4000-8000-0000000001a1';
     insert into public.exercise_muscles (exercise_id, owner_id, muscle_id, role, weight) values ('34700000-0000-4000-8000-0000000001a1', '34700000-0000-4000-8000-00000000000a', 'delt_side', 'primary', 1), ('34700000-0000-4000-8000-0000000001a1', '34700000-0000-4000-8000-00000000000a', 'traps_upper', 'secondary', 0.3);
     set constraints public.exercise_has_primary_muscle immediate;
     set constraints public.exercise_has_primary_muscle deferred $$,
  'a map deleted and inserted again in one transaction passes, because the check waits for the end'
);
select is(
  (select count(*)::int from public.exercises where name in ('key347-a-no-map', 'key347-a-secondary-only')),
  0,
  'the refused exercises were not kept'
);

-- save_exercise as user A: creating. Keys it does not know are ignored.
select lives_ok(
  $$ select set_config('key347.saved_id', public.save_exercise(
       null,
       pg_temp.exercise('key347-saved')
         || '{"id":"34700000-0000-4000-8000-0000000001ee","owner_id":"34700000-0000-4000-8000-00000000000b","source":"free_exercise_db","source_ref":"KEY347-FORGED","deleted_at":"2020-01-01T00:00:00Z","created_at":"2020-01-01T00:00:00Z","unknown":"ignored"}',
       jsonb_build_array(
         pg_temp.muscle('delt_side', 'primary', 1) || '{"owner_id":"34700000-0000-4000-8000-00000000000b","exercise_id":"34700000-0000-4000-8000-0000000001b1","id":"34700000-0000-4000-8000-0000000002ee"}',
         pg_temp.muscle('delt_front', 'secondary', 0.4),
         pg_temp.muscle('traps_upper', 'stabiliser', 0.25)
       )
     )::text, true) $$,
  'a new exercise is created'
);
select ok(
  current_setting('key347.saved_id')::uuid is distinct from '34700000-0000-4000-8000-0000000001ee'::uuid
    and exists (select 1 from public.exercises where id = current_setting('key347.saved_id')::uuid),
  'the database chooses the id of a new exercise, and any sent id is ignored'
);
select is(
  (select owner_id::text || '/' || source::text || '/' || coalesce(source_ref, 'null') || '/' || coalesce(deleted_at::text, 'null') from public.exercises where id = current_setting('key347.saved_id')::uuid),
  '34700000-0000-4000-8000-00000000000a/user/null/null',
  'the new exercise belongs to the caller, is a user row and starts live whatever the payload says'
);
select is(
  (select name || '/' || equipment::text || '/' || mechanic::text from public.exercises where id = current_setting('key347.saved_id')::uuid),
  'key347-saved/dumbbell/isolation',
  'the name, equipment and mechanic are stored'
);
select is(
  (select array_agg(muscle_id || ':' || role::text || ':' || weight::text || ':' || owner_id::text order by muscle_id) from public.exercise_muscles where exercise_id = current_setting('key347.saved_id')::uuid),
  array[
    'delt_front:secondary:0.4:34700000-0000-4000-8000-00000000000a',
    'delt_side:primary:1:34700000-0000-4000-8000-00000000000a',
    'traps_upper:stabiliser:0.25:34700000-0000-4000-8000-00000000000a'
  ],
  'the map is stored, every row belonging to the caller whatever the payload says'
);
select lives_ok(
  $$ set constraints public.exercise_has_primary_muscle immediate;
     set constraints public.exercise_has_primary_muscle deferred $$,
  'the saved exercise passes the primary-muscle check'
);

-- Updating. A soft deleted exercise stays soft deleted across a save.
update public.exercises set deleted_at = '2026-10-18T00:00:00Z' where id = current_setting('key347.saved_id')::uuid;

select lives_ok(
  $$ select public.save_exercise(
       current_setting('key347.saved_id')::uuid,
       jsonb_build_object('name', 'key347-saved-v2', 'equipment', 'smith_machine', 'mechanic', 'compound'),
       jsonb_build_array(pg_temp.muscle('chest_upper', 'primary', 1), pg_temp.muscle('triceps', 'secondary', 0.5))
     );
     set constraints public.exercise_has_primary_muscle immediate;
     set constraints public.exercise_has_primary_muscle deferred $$,
  'an exercise is updated and passes the primary-muscle check'
);
select is(
  (select name || '/' || equipment::text || '/' || mechanic::text || '/' || deleted_at::text from public.exercises where id = current_setting('key347.saved_id')::uuid),
  'key347-saved-v2/smith_machine/compound/2026-10-18 00:00:00+00',
  'the update replaces the name, equipment and mechanic, and leaves deleted_at alone'
);
select is(
  (select array_agg(muscle_id || ':' || role::text || ':' || weight::text order by muscle_id) from public.exercise_muscles where exercise_id = current_setting('key347.saved_id')::uuid),
  array['chest_upper:primary:1', 'triceps:secondary:0.5'],
  'the update replaces the map as a whole'
);

-- The limits themselves are accepted: 22 muscles and a 200 character name.
select lives_ok(
  format($$ select set_config('key347.full_id', public.save_exercise(
       null,
       jsonb_build_object('name', %L, 'equipment', 'bodyweight', 'mechanic', 'compound'),
       (select jsonb_agg(pg_temp.muscle(id, case when position = 0 then 'primary' else 'secondary' end, 0.5) order by position) from public.muscles)
     )::text, true) $$, 'key347-full-' || repeat('n', 188)),
  'an exercise with all 22 muscles and a name of 200 characters is saved'
);
select is(
  (select count(*)::int from public.exercise_muscles where exercise_id = current_setting('key347.full_id')::uuid),
  22,
  'all 22 map rows are stored'
);

-- A global exercise, another user's exercise, or one that does not exist raises P0002 and writes
-- nothing.
select throws_ok(
  $$ select public.save_exercise('34700000-0000-4000-8000-000000000101', pg_temp.exercise('key347-taken-over'), jsonb_build_array(pg_temp.muscle('abs'))) $$,
  'P0002',
  'the exercise does not exist or is not yours',
  'user A cannot save over a global exercise'
);
select throws_ok(
  $$ select public.save_exercise('34700000-0000-4000-8000-0000000001b1', pg_temp.exercise('key347-taken-over'), jsonb_build_array(pg_temp.muscle('abs'))) $$,
  'P0002',
  'the exercise does not exist or is not yours',
  'user A cannot save over user B''s exercise'
);
select throws_ok(
  $$ select public.save_exercise('34700000-0000-4000-8000-00000000dead', pg_temp.exercise('key347-ghost'), jsonb_build_array(pg_temp.muscle('abs'))) $$,
  'P0002',
  'the exercise does not exist or is not yours',
  'an exercise that does not exist fails the same way as one that is not theirs'
);
select is(
  (select name from public.exercises where id = '34700000-0000-4000-8000-000000000101')
    || '/' || (select array_to_string(array_agg(muscle_id order by muscle_id), ',') from public.exercise_muscles where exercise_id = '34700000-0000-4000-8000-000000000101'),
  'key347-global-bench/chest_lower,chest_upper,delt_front,triceps',
  'the global exercise and its map are untouched'
);

-- Refusals, each with 22023 and a message that states the rule and quotes no value.
select throws_ok(
  $$ select public.save_exercise(null, '[]', '[]') $$,
  '22023', 'save_exercise needs the exercise as a JSON object', 'an exercise that is an array is refused'
);
select throws_ok(
  $$ select public.save_exercise(null, null, '[]') $$,
  '22023', 'save_exercise needs the exercise as a JSON object', 'a null exercise is refused'
);
select throws_ok(
  $$ select public.save_exercise(null, pg_temp.exercise('key347-refused'), '{}') $$,
  '22023', 'save_exercise needs the muscles as a JSON array', 'muscles that are an object are refused'
);
select throws_ok(
  $$ select public.save_exercise(null, pg_temp.exercise('key347-refused'), null) $$,
  '22023', 'save_exercise needs the muscles as a JSON array', 'null muscles are refused'
);
select throws_ok(
  $$ select public.save_exercise(null, pg_temp.exercise('key347-refused') - 'name', jsonb_build_array(pg_temp.muscle('abs'))) $$,
  '22023', 'the exercise name must be text', 'an exercise with no name is refused'
);
select throws_ok(
  $$ select public.save_exercise(null, pg_temp.exercise('key347-refused') || '{"name":7}', jsonb_build_array(pg_temp.muscle('abs'))) $$,
  '22023', 'the exercise name must be text', 'a name that is a number is refused'
);
select throws_ok(
  $$ select public.save_exercise(null, pg_temp.exercise(E' \t\n'), jsonb_build_array(pg_temp.muscle('abs'))) $$,
  '22023', 'the exercise name must not be blank', 'a blank name is refused'
);
select throws_ok(
  $$ select public.save_exercise(null, pg_temp.exercise(repeat('n', 201)), jsonb_build_array(pg_temp.muscle('abs'))) $$,
  '22023', 'the exercise name has at most 200 characters', 'a name of 201 characters is refused'
);
select throws_ok(
  $$ select public.save_exercise(null, pg_temp.exercise('key347-refused') - 'equipment', jsonb_build_array(pg_temp.muscle('abs'))) $$,
  '22023', 'the equipment must be one of the equipment list', 'an exercise with no equipment is refused'
);
select throws_ok(
  $$ select public.save_exercise(null, pg_temp.exercise('key347-refused') || '{"equipment":"key347-anvil"}', jsonb_build_array(pg_temp.muscle('abs'))) $$,
  '22023', 'the equipment must be one of the equipment list', 'equipment that is not on the list is refused'
);
select throws_ok(
  $$ select public.save_exercise(null, pg_temp.exercise('key347-refused') || '{"equipment":["band"]}', jsonb_build_array(pg_temp.muscle('abs'))) $$,
  '22023', 'the equipment must be one of the equipment list', 'equipment that is an array is refused'
);
select throws_ok(
  $$ select public.save_exercise(null, pg_temp.exercise('key347-refused') - 'mechanic', jsonb_build_array(pg_temp.muscle('abs'))) $$,
  '22023', 'the mechanic must be compound or isolation', 'an exercise with no mechanic is refused'
);
select throws_ok(
  $$ select public.save_exercise(null, pg_temp.exercise('key347-refused') || '{"mechanic":"Compound"}', jsonb_build_array(pg_temp.muscle('abs'))) $$,
  '22023', 'the mechanic must be compound or isolation', 'a mechanic that is not on the list is refused'
);
select throws_ok(
  $$ select public.save_exercise(null, pg_temp.exercise('key347-refused'), '["abs"]') $$,
  '22023', 'every muscle must be a JSON object', 'a muscle that is text is refused'
);
select throws_ok(
  $$ select public.save_exercise(null, pg_temp.exercise('key347-refused'), '[null]') $$,
  '22023', 'every muscle must be a JSON object', 'a null muscle is refused'
);
select throws_ok(
  $$ select public.save_exercise(null, pg_temp.exercise('key347-refused'), (select jsonb_agg(pg_temp.muscle(id)) || jsonb_build_array(pg_temp.muscle('abs')) from public.muscles)) $$,
  '22023', 'an exercise has at most 22 muscles', '23 muscles are refused'
);
select throws_ok(
  $$ select public.save_exercise(null, pg_temp.exercise('key347-refused'), jsonb_build_array(pg_temp.muscle('key347_not_a_muscle'))) $$,
  '22023', 'every muscle must be one of the muscle list', 'a muscle that is not on the list is refused'
);
select throws_ok(
  $$ select public.save_exercise(null, pg_temp.exercise('key347-refused'), jsonb_build_array(pg_temp.muscle('abs') - 'muscle_id')) $$,
  '22023', 'every muscle must be one of the muscle list', 'a muscle with no muscle_id is refused'
);
select throws_ok(
  $$ select public.save_exercise(null, pg_temp.exercise('key347-refused'), jsonb_build_array(pg_temp.muscle('abs') || '{"muscle_id":12}')) $$,
  '22023', 'every muscle must be one of the muscle list', 'a muscle_id that is a number is refused'
);
select throws_ok(
  $$ select public.save_exercise(null, pg_temp.exercise('key347-refused'), jsonb_build_array(pg_temp.muscle('abs'), pg_temp.muscle('abs', 'secondary', 0.5))) $$,
  '22023', 'a muscle is listed at most once per exercise', 'a muscle listed twice is refused'
);
select throws_ok(
  $$ select public.save_exercise(null, pg_temp.exercise('key347-refused'), jsonb_build_array(pg_temp.muscle('abs', 'main'))) $$,
  '22023', 'every muscle role must be primary, secondary or stabiliser', 'a role that is not on the list is refused'
);
select throws_ok(
  $$ select public.save_exercise(null, pg_temp.exercise('key347-refused'), jsonb_build_array(pg_temp.muscle('abs') - 'role')) $$,
  '22023', 'every muscle role must be primary, secondary or stabiliser', 'a muscle with no role is refused'
);
select throws_ok(
  $$ select public.save_exercise(null, pg_temp.exercise('key347-refused'), jsonb_build_array(pg_temp.muscle('abs') || '{"weight":"1"}')) $$,
  '22023', 'every muscle weight must be a number', 'a weight sent as text is refused'
);
select throws_ok(
  $$ select public.save_exercise(null, pg_temp.exercise('key347-refused'), jsonb_build_array(pg_temp.muscle('abs') - 'weight')) $$,
  '22023', 'every muscle weight must be a number', 'a muscle with no weight is refused'
);
select throws_ok(
  $$ select public.save_exercise(null, pg_temp.exercise('key347-refused'), jsonb_build_array(pg_temp.muscle('abs', 'primary', 0))) $$,
  '22023', 'every muscle weight must be more than 0 and at most 1', 'a weight of 0 is refused'
);
select throws_ok(
  $$ select public.save_exercise(null, pg_temp.exercise('key347-refused'), jsonb_build_array(pg_temp.muscle('abs', 'primary', -1))) $$,
  '22023', 'every muscle weight must be more than 0 and at most 1', 'a negative weight is refused'
);
select throws_ok(
  $$ select public.save_exercise(null, pg_temp.exercise('key347-refused'), jsonb_build_array(pg_temp.muscle('abs', 'primary', 1.5))) $$,
  '22023', 'every muscle weight must be more than 0 and at most 1', 'a weight above 1 is refused'
);
select throws_ok(
  $$ select public.save_exercise(null, pg_temp.exercise('key347-refused'), '[]') $$,
  '22023', 'an exercise needs at least one primary muscle', 'an empty map is refused'
);
select throws_ok(
  $$ select public.save_exercise(null, pg_temp.exercise('key347-refused'), jsonb_build_array(pg_temp.muscle('abs', 'secondary'), pg_temp.muscle('obliques', 'stabiliser', 0.5))) $$,
  '22023', 'an exercise needs at least one primary muscle', 'a map with no primary muscle is refused'
);
select throws_ok(
  $$ select public.save_exercise(current_setting('key347.saved_id')::uuid, pg_temp.exercise('key347-refused'), jsonb_build_array(pg_temp.muscle('abs', 'secondary'))) $$,
  '22023', 'an exercise needs at least one primary muscle', 'an update that would leave no primary muscle is refused'
);
select is(
  (select count(*)::int from public.exercises where name = 'key347-refused'),
  0,
  'no refused save created or renamed an exercise'
);
select is(
  (select array_agg(muscle_id order by muscle_id) from public.exercise_muscles where exercise_id = current_setting('key347.saved_id')::uuid),
  array['chest_upper', 'triceps'],
  'after the refused saves the previous map is in place'
);

reset role;

select is(
  (select count(*)::int from public.exercise_muscles where exercise_id = '34700000-0000-4000-8000-0000000001b1'),
  1,
  'an exercise_id in a muscle is ignored, so user B''s exercise gained no map row'
);
select is(
  (select name from public.exercises where id = '34700000-0000-4000-8000-0000000001b1'),
  'key347-b-curl',
  'user B''s exercise was not renamed by user A'
);

-- User B: the other direction.
set local role authenticated;
set local request.jwt.claims = '{"sub":"34700000-0000-4000-8000-00000000000b","role":"authenticated"}';

select is(
  (select array_agg(name order by name) from public.exercises where name like 'key347-%'),
  array['key347-b-curl', 'key347-global-bench', 'key347-global-row-renamed'],
  'user B sees the global exercises and only their own'
);
select is(
  (select count(*)::int from public.exercise_muscles where owner_id = '34700000-0000-4000-8000-00000000000a'),
  0,
  'user B sees none of user A''s map rows'
);
select throws_ok(
  $$ select public.save_exercise(current_setting('key347.saved_id')::uuid, pg_temp.exercise('key347-taken-over'), jsonb_build_array(pg_temp.muscle('abs'))) $$,
  'P0002',
  'the exercise does not exist or is not yours',
  'user B cannot save over user A''s exercise'
);
with removed as (
  delete from public.exercise_muscles where exercise_id = current_setting('key347.saved_id')::uuid returning 1
)
select is((select count(*)::int from removed), 0, 'user B deletes none of user A''s map');

reset role;

-- Account deletion. Deleting C's auth user removes their custom exercise and its map in one
-- statement, the pending checks then skip the exercise that no longer exists, and the global
-- exercises and maps stay.
select lives_ok(
  $$ delete from auth.users where id = '34700000-0000-4000-8000-00000000000c' $$,
  'deleting an auth user with a custom exercise and its map succeeds'
);
select lives_ok(
  $$ set constraints all immediate $$,
  'the deferred primary-muscle checks pass after the deletion, skipping the removed exercise'
);
select is(
  (select count(*)::int from public.exercises where owner_id = '34700000-0000-4000-8000-00000000000c')
    || '/' || (select count(*)::int from public.exercise_muscles where owner_id = '34700000-0000-4000-8000-00000000000c')
    || '/' || (select count(*)::int from public.exercises where id = '34700000-0000-4000-8000-0000000001c1')
    || '/' || (select count(*)::int from public.exercise_muscles where exercise_id = '34700000-0000-4000-8000-0000000001c1'),
  '0/0/0/0',
  'the deleted user''s exercises and map rows are gone'
);
select is(
  (select count(*)::int from public.exercises where id in ('34700000-0000-4000-8000-000000000101', '34700000-0000-4000-8000-000000000102'))
    || '/' || (select count(*)::int from public.exercise_muscles where exercise_id in ('34700000-0000-4000-8000-000000000101', '34700000-0000-4000-8000-000000000102'))
    || '/' || (select count(*)::int from public.exercise_source_data where exercise_id in ('34700000-0000-4000-8000-000000000101', '34700000-0000-4000-8000-000000000102')),
  '2/5/2',
  'the global exercises, their maps and their raw rows stay'
);
select is(
  (select count(*)::int from public.exercises where owner_id in ('34700000-0000-4000-8000-00000000000a', '34700000-0000-4000-8000-00000000000b')) > 0,
  true,
  'the other users'' exercises stay'
);

select * from finish();

rollback;
