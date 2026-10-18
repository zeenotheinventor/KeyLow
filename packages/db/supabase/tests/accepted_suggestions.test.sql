-- Asserts the accepted suggestions table (ADR 0005, Amendment 4, KEY-397): the exact column list,
-- types and defaults, every check on `exercises`, `reasons` and the rest just outside (refused) and
-- at the edge (accepted), the foreign keys and their delete rules, the indexes, the exact privilege
-- set of each role, the policies as predicates, the owner-only rule in both directions, the partial
-- unique index of one live row per user and day, the set null of a removed routine day, and the
-- cascade from a deleted account.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so
-- nothing created here persists. Every fixture id starts with 39700000 and every name and email
-- with key397-, so the rows are recognisable as this file's. Nothing asserts a whole-table count.
-- Each actor is entered with `set local role` plus the JWT claims that `auth.uid()` reads, and left
-- with `reset role`. A client cannot write `id`, so the rows a client inserts are told apart by
-- `local_date`, and the rows inserted as postgres carry fixed ids.
--
-- Health data: no fixture here is a real user's training, and the refusal messages asserted below
-- state a rule and never a value.

begin;

select plan(123);

-- Three users. The on_auth_user_created trigger creates their profiles rows. C is the throwaway
-- user whose account is deleted at the end.
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '39700000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'key397-user-a@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '39700000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'key397-user-b@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '39700000-0000-4000-8000-00000000000c', 'authenticated', 'authenticated', 'key397-user-c@keylow.test');

-- Fixtures, inserted as postgres so row level security does not apply. A has a routine with two days
-- (the second is the one the set null test removes), B and C one day each.
insert into public.routines (id, user_id, name, is_active) values
  ('39700000-0000-4000-8000-0000000003a1', '39700000-0000-4000-8000-00000000000a', 'key397-a-plan', true),
  ('39700000-0000-4000-8000-0000000003b1', '39700000-0000-4000-8000-00000000000b', 'key397-b-plan', true),
  ('39700000-0000-4000-8000-0000000003c1', '39700000-0000-4000-8000-00000000000c', 'key397-c-plan', true);

insert into public.routine_days (id, routine_id, user_id, position, weekday, name) values
  ('39700000-0000-4000-8000-0000000004a1', '39700000-0000-4000-8000-0000000003a1', '39700000-0000-4000-8000-00000000000a', 0, 0, 'key397-a-day-1'),
  ('39700000-0000-4000-8000-0000000004a2', '39700000-0000-4000-8000-0000000003a1', '39700000-0000-4000-8000-00000000000a', 1, 3, 'key397-a-day-2'),
  ('39700000-0000-4000-8000-0000000004b1', '39700000-0000-4000-8000-0000000003b1', '39700000-0000-4000-8000-00000000000b', 0, 0, 'key397-b-day'),
  ('39700000-0000-4000-8000-0000000004c1', '39700000-0000-4000-8000-0000000003c1', '39700000-0000-4000-8000-00000000000c', 0, 3, 'key397-c-day');

-- The exercises of a payload: `element_count` objects shaped like core's planned exercise.
create function pg_temp.exercise_list(element_count integer)
returns jsonb language sql as $$
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'name', 'key397-exercise-' || position, 'target_sets', 3, 'rep_min', 8, 'rep_max', 12, 'target_rir', 2
    )),
    '[]'::jsonb
  )
  from generate_series(1, element_count) as position
$$;

create function pg_temp.reasons()
returns jsonb language sql as $$
  select jsonb_build_object('muscles', jsonb_build_array(jsonb_build_object('muscle_id', 'lats', 'gap_sets', 4)))
$$;

-- One accepted suggestion, as a client writes it: the six granted columns.
create function pg_temp.accept(
  accepted_date date default '2026-10-22', accepted_day uuid default null,
  accepted_exercises jsonb default null, accepted_reasons jsonb default null,
  accepted_params text default 'key397-params-1',
  accepted_owner uuid default '39700000-0000-4000-8000-00000000000a'
)
returns void language sql as $$
  insert into public.accepted_suggestions (user_id, local_date, routine_day_id, exercises, reasons, params_version)
  values (accepted_owner, accepted_date, accepted_day,
    coalesce(accepted_exercises, pg_temp.exercise_list(2)), coalesce(accepted_reasons, pg_temp.reasons()), accepted_params)
$$;

-- Rows inserted as postgres. A has a live suggestion for Monday 19 October that stands on a planned
-- day. B has a live one for the same day. C has a live one and a soft deleted one for the same day.
insert into public.accepted_suggestions (id, user_id, local_date, routine_day_id, exercises, reasons, params_version, deleted_at) values
  ('39700000-0000-4000-8000-0000000009a1', '39700000-0000-4000-8000-00000000000a', '2026-10-19', '39700000-0000-4000-8000-0000000004a1', pg_temp.exercise_list(3), pg_temp.reasons(), 'key397-params-1', null),
  ('39700000-0000-4000-8000-0000000009b1', '39700000-0000-4000-8000-00000000000b', '2026-10-19', '39700000-0000-4000-8000-0000000004b1', pg_temp.exercise_list(2), pg_temp.reasons(), 'key397-params-1', null),
  ('39700000-0000-4000-8000-0000000009c1', '39700000-0000-4000-8000-00000000000c', '2026-10-19', '39700000-0000-4000-8000-0000000004c1', pg_temp.exercise_list(2), pg_temp.reasons(), 'key397-params-1', null),
  ('39700000-0000-4000-8000-0000000009c2', '39700000-0000-4000-8000-00000000000c', '2026-10-19', null, pg_temp.exercise_list(1), pg_temp.reasons(), 'key397-params-1', '2026-10-18 12:00+00');

-- Shape.
select has_table('public', 'accepted_suggestions', 'accepted_suggestions exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.accepted_suggestions'::regclass),
  'row level security is enabled'
);
select columns_are(
  'public', 'accepted_suggestions',
  array['id', 'user_id', 'local_date', 'routine_day_id', 'exercises', 'reasons', 'params_version', 'deleted_at', 'created_at'],
  'the columns are exactly these nine, with no updated_at'
);
select col_is_pk('public', 'accepted_suggestions', 'id', 'id is the primary key');
select col_type_is('public', 'accepted_suggestions', 'id', 'uuid', 'id is a uuid');
select col_default_is('public', 'accepted_suggestions', 'id', 'gen_random_uuid()', 'id defaults to gen_random_uuid()');
select col_type_is('public', 'accepted_suggestions', 'user_id', 'uuid', 'user_id is a uuid');
select col_not_null('public', 'accepted_suggestions', 'user_id', 'user_id is not null');
select col_default_is('public', 'accepted_suggestions', 'user_id', 'auth.uid()', 'user_id defaults to auth.uid()');
select col_type_is('public', 'accepted_suggestions', 'local_date', 'date', 'local_date is a date');
select col_not_null('public', 'accepted_suggestions', 'local_date', 'local_date is not null');
select col_type_is('public', 'accepted_suggestions', 'routine_day_id', 'uuid', 'routine_day_id is a uuid');
select col_is_null('public', 'accepted_suggestions', 'routine_day_id', 'routine_day_id is nullable, for a suggestion that stands alone');
select col_type_is('public', 'accepted_suggestions', 'exercises', 'jsonb', 'exercises is jsonb');
select col_not_null('public', 'accepted_suggestions', 'exercises', 'exercises is not null');
select col_type_is('public', 'accepted_suggestions', 'reasons', 'jsonb', 'reasons is jsonb');
select col_not_null('public', 'accepted_suggestions', 'reasons', 'reasons is not null');
select col_type_is('public', 'accepted_suggestions', 'params_version', 'text', 'params_version is text');
select col_not_null('public', 'accepted_suggestions', 'params_version', 'params_version is not null');
select col_type_is('public', 'accepted_suggestions', 'deleted_at', 'timestamp with time zone', 'deleted_at is a timestamptz');
select col_is_null('public', 'accepted_suggestions', 'deleted_at', 'deleted_at is nullable, null meaning live');
select col_type_is('public', 'accepted_suggestions', 'created_at', 'timestamp with time zone', 'created_at is a timestamptz');
select col_not_null('public', 'accepted_suggestions', 'created_at', 'created_at is not null');
select col_default_is('public', 'accepted_suggestions', 'created_at', 'now()', 'created_at defaults to now()');
select is(
  (select array_agg(conname::text order by conname::text collate "C") from pg_constraint
   where conrelid = 'public.accepted_suggestions'::regclass and contype = 'c'),
  array[
    'accepted_suggestions_exercises_are_objects',
    'accepted_suggestions_exercises_count_check',
    'accepted_suggestions_exercises_is_array',
    'accepted_suggestions_reasons_is_object'
  ],
  'the checks are exactly these four'
);

-- Foreign keys and their delete rules.
select is(
  (select array_agg(confrelid::regclass::text || ':' || confdeltype::text order by confrelid::regclass::text)
   from pg_constraint where contype = 'f' and conrelid = 'public.accepted_suggestions'::regclass),
  array['auth.users:c', 'routine_days:n'],
  'deleting the user deletes their rows, and removing a routine day clears the link and keeps the row'
);

-- Indexes.
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'accepted_suggestions'
      and indexdef = 'CREATE UNIQUE INDEX accepted_suggestions_one_live_per_user_day ON public.accepted_suggestions USING btree (user_id, local_date) WHERE (deleted_at IS NULL)'
  ),
  'at most one live row per user and day, by a partial unique index'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'accepted_suggestions' and indexdef like '%(routine_day_id)' and indexdef not like 'CREATE UNIQUE%' and indexdef not like '%WHERE%'),
  'there is a plain index on routine_day_id, for the set null'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'accepted_suggestions' and indexdef like '%(user_id, local_date)' and indexdef not like 'CREATE UNIQUE%' and indexdef not like '%WHERE%'),
  'there is a plain index on (user_id, local_date), which the partial one does not serve for soft deleted rows or the cascade'
);
select is(
  (select count(*)::int from pg_indexes where schemaname = 'public' and tablename = 'accepted_suggestions'),
  4,
  'the table has the primary key and these three indexes and no other'
);

-- Privileges. anon and service_role hold nothing at all, on any column.
select ok(
  not has_any_column_privilege('anon', 'public.accepted_suggestions', 'select,insert,update,references')
    and not has_table_privilege('anon', 'public.accepted_suggestions', 'delete,truncate,trigger')
    and not has_any_column_privilege('service_role', 'public.accepted_suggestions', 'select,insert,update,references')
    and not has_table_privilege('service_role', 'public.accepted_suggestions', 'delete,truncate,trigger'),
  'anon and service_role have no privilege on accepted_suggestions'
);
select is(
  (select array_agg(privilege_type::text order by privilege_type::text collate "C") from information_schema.table_privileges
   where table_schema = 'public' and table_name = 'accepted_suggestions' and grantee = 'authenticated'),
  array['SELECT'],
  'authenticated holds only select at table level, so no table-wide insert, update or delete'
);
select is(
  (select array_agg(column_name::text order by column_name::text collate "C") from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'accepted_suggestions' and grantee = 'authenticated' and privilege_type = 'INSERT'),
  array['exercises', 'local_date', 'params_version', 'reasons', 'routine_day_id', 'user_id'],
  'authenticated can insert exactly these columns'
);
select is(
  (select array_agg(column_name::text order by column_name::text collate "C") from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'accepted_suggestions' and grantee = 'authenticated' and privilege_type = 'UPDATE'),
  array['deleted_at'],
  'authenticated can update only deleted_at'
);
select ok(
  not has_table_privilege('authenticated', 'public.accepted_suggestions', 'delete,truncate,trigger')
    and not exists (
      select 1 from information_schema.column_privileges
      where table_schema = 'public' and table_name = 'accepted_suggestions' and grantee = 'authenticated' and privilege_type = 'REFERENCES'
    ),
  'authenticated holds no delete, truncate, trigger or references privilege'
);

-- Policies, as predicates.
select is(
  (select array_agg(policyname::text || ':' || cmd || ':' || roles::text order by policyname::text collate "C") from pg_policies
   where schemaname = 'public' and tablename = 'accepted_suggestions'),
  array[
    'accepted_suggestions_insert_own:INSERT:{authenticated}',
    'accepted_suggestions_select_own:SELECT:{authenticated}',
    'accepted_suggestions_update_own:UPDATE:{authenticated}'
  ],
  'the table has exactly these three policies'
);
select ok(
  (select bool_and(
     (qual is null or qual = '(user_id = ( SELECT auth.uid() AS uid))')
     and (with_check is null or with_check like '(%user_id = ( SELECT auth.uid() AS uid))%')
     and (cmd <> 'UPDATE' or (qual is not null and with_check = '(user_id = ( SELECT auth.uid() AS uid))'))
   ) from pg_policies where schemaname = 'public' and tablename = 'accepted_suggestions'),
  'every policy is owner-only on user_id and reads auth.uid() once per statement, and the update policy checks both sides'
);
select ok(
  (select with_check like '%routine_day_id IS NULL%' and with_check like '%FROM routine_days d%' and with_check like '%d.id = accepted_suggestions.routine_day_id%'
   from pg_policies where tablename = 'accepted_suggestions' and policyname = 'accepted_suggestions_insert_own'),
  'the insert policy checks the routine day each row refers to'
);

-- Anon.
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok($$ select * from public.accepted_suggestions $$, '42501', 'permission denied for table accepted_suggestions', 'anon cannot select from accepted_suggestions');
select throws_ok($$ select pg_temp.accept(accepted_owner => null) $$, '42501', 'permission denied for table accepted_suggestions', 'anon cannot insert an accepted suggestion');
select throws_ok($$ update public.accepted_suggestions set deleted_at = now() $$, '42501', 'permission denied for table accepted_suggestions', 'anon cannot update an accepted suggestion');

reset role;

-- service_role: nothing server side reads this table yet.
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';

select throws_ok($$ select * from public.accepted_suggestions $$, '42501', 'permission denied for table accepted_suggestions', 'service_role cannot read accepted_suggestions');
select throws_ok($$ select pg_temp.accept(accepted_owner => null) $$, '42501', 'permission denied for table accepted_suggestions', 'service_role cannot insert an accepted suggestion');
select throws_ok($$ update public.accepted_suggestions set deleted_at = now() $$, '42501', 'permission denied for table accepted_suggestions', 'service_role cannot update an accepted suggestion');

reset role;

-- User A, the owner.
set local role authenticated;
set local request.jwt.claims = '{"sub":"39700000-0000-4000-8000-00000000000a","role":"authenticated"}';

select is(
  (select count(*)::int from public.accepted_suggestions where user_id <> '39700000-0000-4000-8000-00000000000a'),
  0,
  'user A sees none of the other users'' accepted suggestions'
);
select is(
  (select count(*)::int from public.accepted_suggestions where id = '39700000-0000-4000-8000-0000000009a1'),
  1,
  'user A sees their own accepted suggestion'
);
select lives_ok(
  $$ insert into public.accepted_suggestions (local_date, exercises, reasons, params_version)
     values ('2026-10-20', pg_temp.exercise_list(1), pg_temp.reasons(), 'key397-params-1') $$,
  'user A accepts a suggestion without sending user_id, which defaults to their own'
);
select is(
  (select user_id::text || '/' || coalesce(routine_day_id::text, 'null') || '/' || coalesce(deleted_at::text, 'null') from public.accepted_suggestions where local_date = '2026-10-20'),
  '39700000-0000-4000-8000-00000000000a/null/null',
  'the row is the caller''s, stands alone and is live'
);
select lives_ok(
  $$ select pg_temp.accept('2026-10-21', '39700000-0000-4000-8000-0000000004a1') $$,
  'user A accepts a suggestion into their own routine day'
);
select is(
  (select routine_day_id::text from public.accepted_suggestions where local_date = '2026-10-21'),
  '39700000-0000-4000-8000-0000000004a1',
  'the day it was folded into is stored'
);

-- Writing a row for another user, or pointing at a day that is not theirs.
select throws_ok(
  $$ select pg_temp.accept('2026-10-23', accepted_owner => '39700000-0000-4000-8000-00000000000b') $$,
  '42501', 'new row violates row-level security policy for table "accepted_suggestions"', 'user A cannot accept a suggestion for user B'
);
select throws_ok(
  $$ select pg_temp.accept('2026-10-23', '39700000-0000-4000-8000-0000000004b1') $$,
  '42501', 'new row violates row-level security policy for table "accepted_suggestions"', 'user A cannot fold a suggestion into user B''s routine day'
);
select throws_ok(
  $$ select pg_temp.accept('2026-10-23', '39700000-0000-4000-8000-00000000dead') $$,
  '42501', 'new row violates row-level security policy for table "accepted_suggestions"', 'a routine day that does not exist fails the same way'
);
select throws_ok(
  $$ select pg_temp.accept('2026-10-23', accepted_owner => '39700000-0000-4000-8000-00000000000b', accepted_day => '39700000-0000-4000-8000-0000000004b1') $$,
  '42501', 'new row violates row-level security policy for table "accepted_suggestions"', 'user A cannot accept a suggestion for user B on user B''s day'
);

-- What the grants leave out, on A's own rows.
select throws_ok(
  $$ update public.accepted_suggestions set exercises = pg_temp.exercise_list(1) where id = '39700000-0000-4000-8000-0000000009a1' $$,
  '42501', 'permission denied for table accepted_suggestions', 'an accepted suggestion''s exercises are never rewritten'
);
select throws_ok(
  $$ update public.accepted_suggestions set reasons = '{}' where id = '39700000-0000-4000-8000-0000000009a1' $$,
  '42501', 'permission denied for table accepted_suggestions', 'an accepted suggestion keeps its reasons'
);
select throws_ok(
  $$ update public.accepted_suggestions set local_date = '2026-10-30' where id = '39700000-0000-4000-8000-0000000009a1' $$,
  '42501', 'permission denied for table accepted_suggestions', 'an accepted suggestion never moves to another day'
);
select throws_ok(
  $$ update public.accepted_suggestions set routine_day_id = null where id = '39700000-0000-4000-8000-0000000009a1' $$,
  '42501', 'permission denied for table accepted_suggestions', 'an accepted suggestion never moves to another planned day'
);
select throws_ok(
  $$ update public.accepted_suggestions set params_version = 'key397-params-2' where id = '39700000-0000-4000-8000-0000000009a1' $$,
  '42501', 'permission denied for table accepted_suggestions', 'an accepted suggestion keeps its params version'
);
select throws_ok(
  $$ update public.accepted_suggestions set user_id = '39700000-0000-4000-8000-00000000000b' where id = '39700000-0000-4000-8000-0000000009a1' $$,
  '42501', 'permission denied for table accepted_suggestions', 'user A cannot hand an accepted suggestion to user B'
);
select throws_ok(
  $$ update public.accepted_suggestions set created_at = now() where id = '39700000-0000-4000-8000-0000000009a1' $$,
  '42501', 'permission denied for table accepted_suggestions', 'created_at is never written'
);
select throws_ok(
  $$ insert into public.accepted_suggestions (id, local_date, exercises, reasons, params_version)
     values ('39700000-0000-4000-8000-0000000009ff', '2026-10-24', pg_temp.exercise_list(1), pg_temp.reasons(), 'key397-params-1') $$,
  '42501', 'permission denied for table accepted_suggestions', 'a client cannot choose the id'
);
select throws_ok(
  $$ insert into public.accepted_suggestions (local_date, exercises, reasons, params_version, created_at)
     values ('2026-10-24', pg_temp.exercise_list(1), pg_temp.reasons(), 'key397-params-1', now()) $$,
  '42501', 'permission denied for table accepted_suggestions', 'a client cannot choose created_at'
);
select throws_ok(
  $$ insert into public.accepted_suggestions (local_date, exercises, reasons, params_version, deleted_at)
     values ('2026-10-24', pg_temp.exercise_list(1), pg_temp.reasons(), 'key397-params-1', now()) $$,
  '42501', 'permission denied for table accepted_suggestions', 'a suggestion cannot be accepted already deleted'
);
select throws_ok(
  $$ delete from public.accepted_suggestions where id = '39700000-0000-4000-8000-0000000009a1' $$,
  '42501', 'permission denied for table accepted_suggestions', 'user A cannot hard delete an accepted suggestion'
);

-- The exercises column. A payload must be an array of 1 to 30 objects. Each refused row breaks
-- exactly one rule, and its own check names it.
select throws_ok(
  $$ select pg_temp.accept('2026-11-01', accepted_exercises => '{"name":"key397-not-an-array"}') $$,
  '23514', 'new row for relation "accepted_suggestions" violates check constraint "accepted_suggestions_exercises_is_array"', 'exercises that is an object is refused'
);
select throws_ok(
  $$ select pg_temp.accept('2026-11-01', accepted_exercises => '"key397-not-an-array"') $$,
  '23514', 'new row for relation "accepted_suggestions" violates check constraint "accepted_suggestions_exercises_is_array"', 'exercises that is a string is refused'
);
select throws_ok(
  $$ select pg_temp.accept('2026-11-01', accepted_exercises => '3') $$,
  '23514', 'new row for relation "accepted_suggestions" violates check constraint "accepted_suggestions_exercises_is_array"', 'exercises that is a number is refused'
);
select throws_ok(
  $$ select pg_temp.accept('2026-11-01', accepted_exercises => 'null'::jsonb) $$,
  '23514', 'new row for relation "accepted_suggestions" violates check constraint "accepted_suggestions_exercises_is_array"', 'exercises that is a JSON null is refused'
);
select throws_ok(
  $$ insert into public.accepted_suggestions (local_date, exercises, reasons, params_version)
     values ('2026-11-01', null, pg_temp.reasons(), 'key397-params-1') $$,
  '23502', 'null value in column "exercises" of relation "accepted_suggestions" violates not-null constraint', 'exercises that is null is refused'
);
select throws_ok(
  $$ select pg_temp.accept('2026-11-01', accepted_exercises => '[]') $$,
  '23514', 'new row for relation "accepted_suggestions" violates check constraint "accepted_suggestions_exercises_count_check"', 'an empty exercises array is refused'
);
select throws_ok(
  $$ select pg_temp.accept('2026-11-01', accepted_exercises => pg_temp.exercise_list(31)) $$,
  '23514', 'new row for relation "accepted_suggestions" violates check constraint "accepted_suggestions_exercises_count_check"', '31 exercises are refused'
);
select throws_ok(
  $$ select pg_temp.accept('2026-11-01', accepted_exercises => pg_temp.exercise_list(100)) $$,
  '23514', 'new row for relation "accepted_suggestions" violates check constraint "accepted_suggestions_exercises_count_check"', '100 exercises are refused'
);
select throws_ok(
  $$ select pg_temp.accept('2026-11-01', accepted_exercises => '[1]') $$,
  '23514', 'new row for relation "accepted_suggestions" violates check constraint "accepted_suggestions_exercises_are_objects"', 'an array holding a number is refused'
);
select throws_ok(
  $$ select pg_temp.accept('2026-11-01', accepted_exercises => '["key397-name"]') $$,
  '23514', 'new row for relation "accepted_suggestions" violates check constraint "accepted_suggestions_exercises_are_objects"', 'an array holding a string is refused'
);
select throws_ok(
  $$ select pg_temp.accept('2026-11-01', accepted_exercises => '[null]') $$,
  '23514', 'new row for relation "accepted_suggestions" violates check constraint "accepted_suggestions_exercises_are_objects"', 'an array holding a JSON null is refused'
);
select throws_ok(
  $$ select pg_temp.accept('2026-11-01', accepted_exercises => '[[{"name":"key397-nested"}]]') $$,
  '23514', 'new row for relation "accepted_suggestions" violates check constraint "accepted_suggestions_exercises_are_objects"', 'an array holding an array is refused'
);
select throws_ok(
  $$ select pg_temp.accept('2026-11-01', accepted_exercises => jsonb_insert(pg_temp.exercise_list(2), '{1}', '7')) $$,
  '23514', 'new row for relation "accepted_suggestions" violates check constraint "accepted_suggestions_exercises_are_objects"', 'one element that is not an object spoils an array of objects'
);
select lives_ok(
  $$ select pg_temp.accept('2026-11-02', accepted_exercises => pg_temp.exercise_list(1)) $$,
  'one exercise is accepted'
);
select lives_ok(
  $$ select pg_temp.accept('2026-11-03', accepted_exercises => pg_temp.exercise_list(30)) $$,
  '30 exercises are accepted'
);
select lives_ok(
  $$ select pg_temp.accept('2026-11-04', accepted_exercises => '[{}]') $$,
  'the table checks that an element is an object and not what is in it, which core owns'
);

-- The other columns.
select throws_ok(
  $$ select pg_temp.accept('2026-11-05', accepted_reasons => '[]') $$,
  '23514', 'new row for relation "accepted_suggestions" violates check constraint "accepted_suggestions_reasons_is_object"', 'reasons that is an array is refused'
);
select throws_ok(
  $$ select pg_temp.accept('2026-11-05', accepted_reasons => '"key397-reason"') $$,
  '23514', 'new row for relation "accepted_suggestions" violates check constraint "accepted_suggestions_reasons_is_object"', 'reasons that is a string is refused'
);
select throws_ok(
  $$ select pg_temp.accept('2026-11-05', accepted_reasons => 'null'::jsonb) $$,
  '23514', 'new row for relation "accepted_suggestions" violates check constraint "accepted_suggestions_reasons_is_object"', 'reasons that is a JSON null is refused'
);
select throws_ok(
  $$ insert into public.accepted_suggestions (local_date, exercises, reasons, params_version)
     values ('2026-11-05', pg_temp.exercise_list(1), null, 'key397-params-1') $$,
  '23502', 'null value in column "reasons" of relation "accepted_suggestions" violates not-null constraint', 'reasons that is null is refused'
);
select lives_ok(
  $$ select pg_temp.accept('2026-11-06', accepted_reasons => '{}') $$,
  'reasons that is an empty object is accepted, because the table checks the shape and not the content'
);
select throws_ok(
  $$ insert into public.accepted_suggestions (local_date, exercises, reasons, params_version)
     values ('2026-11-07', pg_temp.exercise_list(1), pg_temp.reasons(), null) $$,
  '23502', 'null value in column "params_version" of relation "accepted_suggestions" violates not-null constraint', 'a null params version is refused'
);
select throws_ok(
  $$ insert into public.accepted_suggestions (local_date, exercises, reasons, params_version)
     values (null, pg_temp.exercise_list(1), pg_temp.reasons(), 'key397-params-1') $$,
  '23502', 'null value in column "local_date" of relation "accepted_suggestions" violates not-null constraint', 'a null local date is refused'
);

-- One live row per user and day. A's Monday row is live, and the partial unique index refuses a second.
select throws_ok(
  $$ select pg_temp.accept('2026-10-19') $$,
  '23505', 'duplicate key value violates unique constraint "accepted_suggestions_one_live_per_user_day"', 'a second live accepted suggestion for the same user and day is refused with 23505'
);
select throws_ok(
  $$ select pg_temp.accept('2026-10-19', '39700000-0000-4000-8000-0000000004a2') $$,
  '23505', 'duplicate key value violates unique constraint "accepted_suggestions_one_live_per_user_day"', 'a different routine day does not make a second suggestion for the same day'
);
select is(
  (select count(*)::int from public.accepted_suggestions where local_date = '2026-10-19'),
  1,
  'the refused inserts left one row for the day'
);
select lives_ok(
  $$ update public.accepted_suggestions set deleted_at = '2026-10-19 08:00+00' where id = '39700000-0000-4000-8000-0000000009a1' $$,
  'Undo soft deletes the accepted suggestion'
);
select is(
  (select deleted_at = '2026-10-19 08:00+00'::timestamptz from public.accepted_suggestions where id = '39700000-0000-4000-8000-0000000009a1'),
  true,
  'a soft deleted row stays visible to its owner'
);
select lives_ok(
  $$ select pg_temp.accept('2026-10-19', '39700000-0000-4000-8000-0000000004a2') $$,
  'once the first is soft deleted, the same day takes a new one'
);
select throws_ok(
  $$ update public.accepted_suggestions set deleted_at = null where id = '39700000-0000-4000-8000-0000000009a1' $$,
  '23505', 'duplicate key value violates unique constraint "accepted_suggestions_one_live_per_user_day"', 'restoring the old row while the new one is live is refused with 23505'
);
select lives_ok(
  $$ update public.accepted_suggestions set deleted_at = '2026-10-19 09:00+00' where local_date = '2026-10-19' and deleted_at is null $$,
  'the new row can be undone too'
);
select lives_ok(
  $$ update public.accepted_suggestions set deleted_at = null where id = '39700000-0000-4000-8000-0000000009a1' $$,
  'the old row can be restored once nothing else is live for the day'
);
select lives_ok(
  $$ update public.accepted_suggestions set deleted_at = '2026-10-19 10:00+00' where id = '39700000-0000-4000-8000-0000000009a1' $$,
  'a restored row can be soft deleted again'
);
select lives_ok(
  $$ select pg_temp.accept('2026-10-19', accepted_exercises => pg_temp.exercise_list(4), accepted_params => 'key397-params-2') $$,
  'a day can hold any number of soft deleted rows next to one live row'
);
select is(
  (select count(*)::int || '/' || count(*) filter (where deleted_at is null)::int from public.accepted_suggestions where local_date = '2026-10-19'),
  '3/1',
  'the day holds three rows, one of them live'
);
select lives_ok(
  $$ select pg_temp.accept('2026-10-18') $$,
  'a different day is not in the way'
);

-- User A against user B.
select is(
  (select count(*)::int from public.accepted_suggestions where id = '39700000-0000-4000-8000-0000000009b1'),
  0,
  'user A cannot see user B''s accepted suggestion'
);
with changed as (
  update public.accepted_suggestions set deleted_at = now() where id = '39700000-0000-4000-8000-0000000009b1' returning 1
)
select is((select count(*)::int from changed), 0, 'user A deletes none of user B''s accepted suggestions');

reset role;

-- User B, the other owner. B has a live row for Monday 19 October and A has one too, so the unique
-- index is per user.
set local role authenticated;
set local request.jwt.claims = '{"sub":"39700000-0000-4000-8000-00000000000b","role":"authenticated"}';

select is(
  (select count(*)::int from public.accepted_suggestions where user_id <> '39700000-0000-4000-8000-00000000000b'),
  0,
  'user B sees none of user A''s accepted suggestions'
);
select throws_ok(
  $$ select pg_temp.accept('2026-10-19', accepted_owner => '39700000-0000-4000-8000-00000000000b') $$,
  '23505', 'duplicate key value violates unique constraint "accepted_suggestions_one_live_per_user_day"', 'user B is held to one live row a day too'
);
select lives_ok(
  $$ select pg_temp.accept('2026-10-18', accepted_owner => '39700000-0000-4000-8000-00000000000b') $$,
  'user B accepts a suggestion for a day user A also has one for'
);
with changed as (
  update public.accepted_suggestions set deleted_at = now() where id = '39700000-0000-4000-8000-0000000009a1' returning 1
)
select is((select count(*)::int from changed), 0, 'user B deletes none of user A''s accepted suggestions');
select throws_ok(
  $$ select pg_temp.accept('2026-10-25', '39700000-0000-4000-8000-0000000004a1', accepted_owner => '39700000-0000-4000-8000-00000000000b') $$,
  '42501', 'new row violates row-level security policy for table "accepted_suggestions"', 'user B cannot fold a suggestion into user A''s routine day'
);

reset role;

select is(
  (select count(*)::int from public.accepted_suggestions where id = '39700000-0000-4000-8000-0000000009b1' and deleted_at is null),
  1,
  'user B''s fixture row is untouched by user A''s attempts'
);
select is(
  (select count(*)::int from public.accepted_suggestions where id = '39700000-0000-4000-8000-0000000009a1' and deleted_at = '2026-10-19 10:00+00'),
  1,
  'user A''s row is untouched by user B''s attempts'
);

-- A removed routine day. Removing a day clears the link and keeps the suggestion, for the live and
-- the soft deleted row alike.
set local role authenticated;
set local request.jwt.claims = '{"sub":"39700000-0000-4000-8000-00000000000a","role":"authenticated"}';

select lives_ok(
  $$ select pg_temp.accept('2026-10-26', '39700000-0000-4000-8000-0000000004a2') $$,
  'user A accepts a suggestion into their second day'
);
select is(
  (select count(*)::int from public.accepted_suggestions where routine_day_id = '39700000-0000-4000-8000-0000000004a2'),
  2,
  'two of A''s rows, one of them soft deleted, point at the second day'
);
select lives_ok(
  $$ delete from public.routine_days where id = '39700000-0000-4000-8000-0000000004a2' $$,
  'user A removes the day from their routine'
);
select is(
  (select count(*)::int from public.accepted_suggestions where routine_day_id = '39700000-0000-4000-8000-0000000004a2'),
  0,
  'no accepted suggestion points at the removed day'
);
select is(
  (select count(*)::int || '/' || count(*) filter (where routine_day_id is null)::int from public.accepted_suggestions where local_date in ('2026-10-19', '2026-10-26')),
  '4/3',
  'the two rows of the removed day are kept and stand alone, next to the standalone row of that Monday and the first day''s row'
);
select is(
  (select exercises = pg_temp.exercise_list(2) and reasons = pg_temp.reasons() from public.accepted_suggestions where local_date = '2026-10-26'),
  true,
  'a row that lost its day keeps its exercises and its reasons'
);

reset role;

-- The parent of the set null: the first day's rows stay linked while the day exists.
select is(
  (select routine_day_id::text from public.accepted_suggestions where id = '39700000-0000-4000-8000-0000000009a1'),
  '39700000-0000-4000-8000-0000000004a1',
  'a row on a day that still exists keeps its link'
);

-- Account deletion. User C has a routine with a day, a live accepted suggestion on it and a soft
-- deleted one that stands alone. Deleting the auth user removes the lot in one statement, whichever
-- table is reached first.
select is(
  (select count(*)::int from public.accepted_suggestions where user_id = '39700000-0000-4000-8000-00000000000c'),
  2,
  'user C holds a live and a soft deleted accepted suggestion before the deletion'
);
select lives_ok(
  $$ delete from auth.users where id = '39700000-0000-4000-8000-00000000000c' $$,
  'deleting an auth user with accepted suggestions succeeds'
);
select is(
  (select count(*)::int from public.accepted_suggestions where user_id = '39700000-0000-4000-8000-00000000000c'),
  0,
  'none of the deleted user''s accepted suggestions remain'
);
select is(
  (select count(*)::int from public.accepted_suggestions where id in ('39700000-0000-4000-8000-0000000009c1', '39700000-0000-4000-8000-0000000009c2')),
  0,
  'none of the deleted user''s fixture rows remain by id, the soft deleted one included'
);
select is(
  (select count(*)::int from public.routine_days where user_id = '39700000-0000-4000-8000-00000000000c'),
  0,
  'the deleted user''s routine day went with the account too'
);
select is(
  (select count(*)::int from public.accepted_suggestions where id = '39700000-0000-4000-8000-0000000009b1')
    || '/' || ((select count(*)::int from public.accepted_suggestions where user_id = '39700000-0000-4000-8000-00000000000a') > 0)::text,
  '1/true',
  'the other users'' accepted suggestions stay'
);

select * from finish();

rollback;
