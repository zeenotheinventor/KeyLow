-- Asserts the food table hardening of KEY-70: foods.name is capped at 200 characters in the database as
-- it is in core, and service_role holds only the DML privileges on the food tables (rate_limits does the
-- same), so it cannot TRUNCATE them, reference them or attach triggers to them.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so nothing
-- created here persists.

begin;

select plan(8);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '64000003-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'hardening-user@keylow.test');

select lives_ok(
  $$ insert into public.foods (source, source_ref, name, basis) values ('cofid', 'CF-KEY64-N1', repeat('n', 200), 'per_100g') $$,
  'a name of 200 characters is accepted'
);

select throws_ok(
  $$ insert into public.foods (source, source_ref, name, basis) values ('cofid', 'CF-KEY64-N2', repeat('n', 201), 'per_100g') $$,
  '23514',
  'new row for relation "foods" violates check constraint "foods_name_length_check"',
  'a name of 201 characters is refused'
);

select lives_ok(
  $$ insert into public.foods (source, source_ref, name, basis) values ('cofid', 'CF-KEY64-N3', repeat('é', 200), 'per_100g') $$,
  'the cap counts characters, not bytes'
);

-- A direct insert by a signed in user goes through the same constraint.
set local role authenticated;
set local request.jwt.claims = '{"sub":"64000003-0000-4000-8000-00000000000a","role":"authenticated"}';

select throws_ok(
  $$ insert into public.foods (source, owner_id, name, basis) values ('user', '64000003-0000-4000-8000-00000000000a', repeat('n', 201), 'per_100g') $$,
  '23514',
  'new row for relation "foods" violates check constraint "foods_name_length_check"',
  'a user cannot skip the cap by inserting through the API'
);

reset role;

-- The privileges service_role keeps on each food table.
select is(
  (
    select array_agg(privilege order by privilege)
    from unnest(array['DELETE', 'INSERT', 'REFERENCES', 'SELECT', 'TRIGGER', 'TRUNCATE', 'UPDATE']) as privilege
    where has_table_privilege('service_role', 'public.foods', privilege)
  ),
  array['DELETE', 'INSERT', 'SELECT', 'UPDATE'],
  'service_role keeps only select, insert, update and delete on foods'
);

select is(
  (
    select array_agg(privilege order by privilege)
    from unnest(array['DELETE', 'INSERT', 'REFERENCES', 'SELECT', 'TRIGGER', 'TRUNCATE', 'UPDATE']) as privilege
    where has_table_privilege('service_role', 'public.food_portions', privilege)
  ),
  array['DELETE', 'INSERT', 'SELECT', 'UPDATE'],
  'service_role keeps only select, insert, update and delete on food_portions'
);

select is(
  (
    select array_agg(privilege order by privilege)
    from unnest(array['DELETE', 'INSERT', 'REFERENCES', 'SELECT', 'TRIGGER', 'TRUNCATE', 'UPDATE']) as privilege
    where has_table_privilege('service_role', 'public.food_source_data', privilege)
  ),
  array['DELETE', 'INSERT', 'SELECT', 'UPDATE'],
  'service_role keeps only select, insert, update and delete on food_source_data'
);

select is(
  (
    select array_agg(privilege order by privilege)
    from unnest(array['DELETE', 'INSERT', 'REFERENCES', 'SELECT', 'TRIGGER', 'TRUNCATE', 'UPDATE']) as privilege
    where has_table_privilege('service_role', 'public.import_runs', privilege)
  ),
  array['DELETE', 'INSERT', 'SELECT', 'UPDATE'],
  'service_role keeps only select, insert, update and delete on import_runs'
);

select * from finish();

rollback;
