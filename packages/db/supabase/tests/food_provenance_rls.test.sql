-- Asserts the privileges and constraints on public.food_source_data and
-- public.import_runs (ADR 0003 and its Amendment 1): both tables are service
-- role only, so neither anon nor any signed-in user can read or write them,
-- and the tables' own rules keep one raw payload per food and keep user foods
-- out of import runs.
--
-- `supabase test db` runs this file as postgres inside a transaction that is
-- rolled back, so nothing created here persists. Each actor is entered with
-- `set local role` plus the JWT claims that `auth.uid()` reads, and left with
-- `reset role`.

begin;

select plan(35);

-- Two users. The on_auth_user_created trigger creates their profiles rows.
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '36000003-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'provenance-user-a@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '36000003-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'provenance-user-b@keylow.test');

-- Fixture rows, inserted as postgres so row level security does not apply.
-- A global food and a user food, one import run, and a raw payload for the
-- global food.
insert into public.foods (id, source, source_ref, owner_id, name, basis) values
  ('36000003-0000-4000-8000-000000000101', 'cofid', 'CF-PROVENANCE-1', null, 'Fixture global oats', 'per_100g'),
  ('36000003-0000-4000-8000-0000000001a1', 'user', null, '36000003-0000-4000-8000-00000000000a', 'Fixture A bread', 'per_100g');

insert into public.import_runs (id, source, label) values
  ('36000003-0000-4000-8000-000000000301', 'cofid', 'fixture CoFID run');

insert into public.food_source_data (food_id, import_run_id, raw) values
  ('36000003-0000-4000-8000-000000000101', '36000003-0000-4000-8000-000000000301', '{"Food Code": "CF-PROVENANCE-1"}');

-- Table level facts.
select ok(
  (select relrowsecurity from pg_class where oid = 'public.food_source_data'::regclass),
  'row level security is enabled on food_source_data'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.import_runs'::regclass),
  'row level security is enabled on import_runs'
);

select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename in ('food_source_data', 'import_runs')),
  0,
  'neither table has a policy, so row level security alone denies the API roles'
);

-- Anon.
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  $$ select * from public.food_source_data $$,
  '42501',
  'permission denied for table food_source_data',
  'anon cannot select from food_source_data'
);

select throws_ok(
  $$ insert into public.food_source_data (food_id, raw) values ('36000003-0000-4000-8000-0000000001a1', '{}') $$,
  '42501',
  'permission denied for table food_source_data',
  'anon cannot insert into food_source_data'
);

select throws_ok(
  $$ select * from public.import_runs $$,
  '42501',
  'permission denied for table import_runs',
  'anon cannot select from import_runs'
);

select throws_ok(
  $$ insert into public.import_runs (source, label) values ('cofid', 'forged run') $$,
  '42501',
  'permission denied for table import_runs',
  'anon cannot insert into import_runs'
);

reset role;

-- User A.
set local role authenticated;
set local request.jwt.claims = '{"sub":"36000003-0000-4000-8000-00000000000a","role":"authenticated"}';

select throws_ok(
  $$ select * from public.food_source_data $$,
  '42501',
  'permission denied for table food_source_data',
  'user A cannot select from food_source_data'
);

select throws_ok(
  $$ insert into public.food_source_data (food_id, raw) values ('36000003-0000-4000-8000-0000000001a1', '{}') $$,
  '42501',
  'permission denied for table food_source_data',
  'user A cannot insert into food_source_data'
);

select throws_ok(
  $$ update public.food_source_data set raw = '{}' $$,
  '42501',
  'permission denied for table food_source_data',
  'user A cannot update food_source_data'
);

select throws_ok(
  $$ delete from public.food_source_data $$,
  '42501',
  'permission denied for table food_source_data',
  'user A cannot delete from food_source_data'
);

select throws_ok(
  $$ select * from public.import_runs $$,
  '42501',
  'permission denied for table import_runs',
  'user A cannot select from import_runs'
);

select throws_ok(
  $$ insert into public.import_runs (source, label) values ('cofid', 'forged run') $$,
  '42501',
  'permission denied for table import_runs',
  'user A cannot insert into import_runs'
);

select throws_ok(
  $$ update public.import_runs set label = 'forged' $$,
  '42501',
  'permission denied for table import_runs',
  'user A cannot update import_runs'
);

select throws_ok(
  $$ delete from public.import_runs $$,
  '42501',
  'permission denied for table import_runs',
  'user A cannot delete from import_runs'
);

reset role;

-- User B.
set local role authenticated;
set local request.jwt.claims = '{"sub":"36000003-0000-4000-8000-00000000000b","role":"authenticated"}';

select throws_ok(
  $$ select * from public.food_source_data $$,
  '42501',
  'permission denied for table food_source_data',
  'user B cannot select from food_source_data'
);

select throws_ok(
  $$ insert into public.food_source_data (food_id, raw) values ('36000003-0000-4000-8000-0000000001a1', '{}') $$,
  '42501',
  'permission denied for table food_source_data',
  'user B cannot insert into food_source_data'
);

select throws_ok(
  $$ select * from public.import_runs $$,
  '42501',
  'permission denied for table import_runs',
  'user B cannot select from import_runs'
);

select throws_ok(
  $$ insert into public.import_runs (source, label) values ('cofid', 'forged run') $$,
  '42501',
  'permission denied for table import_runs',
  'user B cannot insert into import_runs'
);

reset role;

-- Fixture rows survive the denied statements above.
select is(
  (select count(*)::int from public.food_source_data) || '/' || (select count(*)::int from public.import_runs),
  '1/1',
  'the rows in both tables are untouched after the denied statements'
);

-- Table rules, exercised as postgres.
select throws_ok(
  $$insert into public.import_runs (source, label) values ('user', 'user run')$$,
  '23514',
  'new row for relation "import_runs" violates check constraint "import_runs_source_not_user"',
  'an import run for the user source is rejected'
);

select throws_ok(
  $$insert into public.import_runs (source) values ('off')$$,
  '23502',
  'null value in column "label" of relation "import_runs" violates not-null constraint',
  'an import run without a label is rejected'
);

select ok(
  (select started_at is not null and finished_at is null and file_sha256 is null and row_count is null from public.import_runs where id = '36000003-0000-4000-8000-000000000301'),
  'an import run gets started_at by default and leaves finished_at, file_sha256 and row_count null'
);

select throws_ok(
  $$insert into public.food_source_data (food_id, raw) values ('36000003-0000-4000-8000-000000000101', '{}')$$,
  '23505',
  'duplicate key value violates unique constraint "food_source_data_pkey"',
  'a food cannot have a second food_source_data row'
);

select lives_ok(
  $$insert into public.food_source_data (food_id, import_run_id, raw) values ('36000003-0000-4000-8000-0000000001a1', null, '{"code": "5000000000017"}')$$,
  'a food_source_data row can have a null import_run_id, as OFF payloads do'
);

select throws_ok(
  $$insert into public.food_source_data (food_id, raw) values (gen_random_uuid(), '{}')$$,
  '23503',
  'insert or update on table "food_source_data" violates foreign key constraint "food_source_data_food_id_fkey"',
  'a food_source_data row must point at an existing food'
);

select throws_ok(
  $$update public.food_source_data set import_run_id = gen_random_uuid() where food_id = '36000003-0000-4000-8000-000000000101'$$,
  '23503',
  'insert or update on table "food_source_data" violates foreign key constraint "food_source_data_import_run_id_fkey"',
  'a food_source_data row must point at an existing import run'
);

select throws_ok(
  $$insert into public.food_source_data (food_id, raw) values (null, '{}')$$,
  '23502',
  'null value in column "food_id" of relation "food_source_data" violates not-null constraint',
  'a food_source_data row must name a food'
);

select throws_ok(
  $$update public.food_source_data set raw = null where food_id = '36000003-0000-4000-8000-000000000101'$$,
  '23502',
  'null value in column "raw" of relation "food_source_data" violates not-null constraint',
  'a food_source_data row must have a raw payload'
);

-- Service role: the only writer of both tables.
set local role service_role;

select lives_ok(
  $$insert into public.import_runs (source, label, file_sha256, row_count) values ('cofid', 'service run', 'abc123', 10)$$,
  'service_role can insert an import run'
);

select lives_ok(
  $$update public.food_source_data set raw = '{"Food Code": "changed"}' where food_id = '36000003-0000-4000-8000-000000000101'$$,
  'service_role can update a food_source_data row'
);

select is(
  (select raw ->> 'Food Code' from public.food_source_data where food_id = '36000003-0000-4000-8000-000000000101'),
  'changed',
  'service_role can read back the food_source_data row it updated'
);

reset role;

-- Cascade from the owning user. A throwaway user with a food, a portion and a
-- raw payload loses all three when the auth user is deleted.
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '36000004-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'provenance-cascade@keylow.test');

insert into public.foods (id, source, source_ref, owner_id, name, basis) values
  ('36000004-0000-4000-8000-0000000001a1', 'user', null, '36000004-0000-4000-8000-00000000000a', 'Cascade fixture food', 'per_100g');

insert into public.food_portions (id, food_id, owner_id, label, grams) values
  ('36000004-0000-4000-8000-0000000002a1', '36000004-0000-4000-8000-0000000001a1', '36000004-0000-4000-8000-00000000000a', 'cascade portion', 10);

insert into public.food_source_data (food_id, raw) values
  ('36000004-0000-4000-8000-0000000001a1', '{}');

delete from auth.users where id = '36000004-0000-4000-8000-00000000000a';

select is(
  (select count(*)::int from public.foods where id = '36000004-0000-4000-8000-0000000001a1')
  || '/' || (select count(*)::int from public.food_portions where id = '36000004-0000-4000-8000-0000000002a1')
  || '/' || (select count(*)::int from public.food_source_data where food_id = '36000004-0000-4000-8000-0000000001a1'),
  '0/0/0',
  'deleting an auth user deletes their foods, and through them the portions and food_source_data rows'
);

-- Cascade from the food.
delete from public.foods where id = '36000003-0000-4000-8000-000000000101';

select is(
  (select count(*)::int from public.food_source_data where food_id = '36000003-0000-4000-8000-000000000101'),
  0,
  'deleting a food deletes its food_source_data row'
);

select is(
  (select count(*)::int from public.import_runs where id = '36000003-0000-4000-8000-000000000301'),
  1,
  'deleting a food leaves its import run in place'
);

select * from finish();

rollback;
