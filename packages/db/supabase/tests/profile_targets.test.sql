-- Asserts the manual target columns on public.profiles (ADR 0003, Amendment 4):
-- five independent nullable columns, the two named checks, and the column
-- grants that make exactly those columns writable on top of the ones from
-- Amendment 3, for the owner only.
--
-- `supabase test db` runs this file as postgres inside a transaction that is
-- rolled back, so nothing created here persists. Every fixture id starts with
-- 18200000 and every email with key182-. Each actor is entered with
-- `set local role` plus the JWT claims that `auth.uid()` reads, and left with
-- `reset role`.

begin;

select plan(38);

-- Two users. The on_auth_user_created trigger creates their profiles rows.
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '18200000-0000-4000-8000-0000000000fa', 'authenticated', 'authenticated', 'key182-targets-a@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '18200000-0000-4000-8000-0000000000fb', 'authenticated', 'authenticated', 'key182-targets-b@keylow.test');

-- Columns: the type of each and that all five are nullable.
select col_type_is('public', 'profiles', 'target_kcal', 'integer', 'target_kcal is an integer');
select col_type_is('public', 'profiles', 'target_protein_g', 'numeric', 'target_protein_g is numeric');
select col_type_is('public', 'profiles', 'target_carbs_g', 'numeric', 'target_carbs_g is numeric');
select col_type_is('public', 'profiles', 'target_fat_g', 'numeric', 'target_fat_g is numeric');
select col_type_is('public', 'profiles', 'targets_updated_at', 'timestamp with time zone', 'targets_updated_at is a timestamptz');
select ok(
  (
    select bool_and(not attnotnull)
    from pg_attribute
    where attrelid = 'public.profiles'::regclass
      and attname in ('target_kcal', 'target_protein_g', 'target_carbs_g', 'target_fat_g', 'targets_updated_at')
  ),
  'all five target columns are nullable'
);
select results_eq(
  $$select target_kcal is null, target_protein_g is null, target_carbs_g is null, target_fat_g is null, targets_updated_at is null
    from public.profiles where id = '18200000-0000-4000-8000-0000000000fa'$$,
  $$values (true, true, true, true, true)$$,
  'a new profile has no target'
);

-- The two named checks exist.
select ok(
  exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_target_kcal_range' and contype = 'c'),
  'the check profiles_target_kcal_range exists'
);
select ok(
  exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_target_macros_nonnegative' and contype = 'c'),
  'the check profiles_target_macros_nonnegative exists'
);

-- profiles_target_kcal_range: 800 to 6000 inclusive, null passes.
select throws_ok(
  $$update public.profiles set target_kcal = 799 where id = '18200000-0000-4000-8000-0000000000fa'$$,
  '23514',
  'new row for relation "profiles" violates check constraint "profiles_target_kcal_range"',
  'a calorie target of 799 is rejected'
);
select lives_ok(
  $$update public.profiles set target_kcal = 800 where id = '18200000-0000-4000-8000-0000000000fa'$$,
  'a calorie target of 800 is accepted'
);
select lives_ok(
  $$update public.profiles set target_kcal = 6000 where id = '18200000-0000-4000-8000-0000000000fa'$$,
  'a calorie target of 6000 is accepted'
);
select throws_ok(
  $$update public.profiles set target_kcal = 6001 where id = '18200000-0000-4000-8000-0000000000fa'$$,
  '23514',
  'new row for relation "profiles" violates check constraint "profiles_target_kcal_range"',
  'a calorie target of 6001 is rejected'
);
select throws_ok(
  $$update public.profiles set target_kcal = 0 where id = '18200000-0000-4000-8000-0000000000fa'$$,
  '23514',
  'new row for relation "profiles" violates check constraint "profiles_target_kcal_range"',
  'a calorie target of 0 is rejected'
);
select lives_ok(
  $$update public.profiles set target_kcal = null where id = '18200000-0000-4000-8000-0000000000fa'$$,
  'a null calorie target means no target and is accepted'
);

-- profiles_target_macros_nonnegative: each macro >= 0, no upper bound, null passes.
select throws_ok(
  $$update public.profiles set target_protein_g = -0.1 where id = '18200000-0000-4000-8000-0000000000fa'$$,
  '23514',
  'new row for relation "profiles" violates check constraint "profiles_target_macros_nonnegative"',
  'a negative protein target is rejected'
);
select throws_ok(
  $$update public.profiles set target_carbs_g = -1 where id = '18200000-0000-4000-8000-0000000000fa'$$,
  '23514',
  'new row for relation "profiles" violates check constraint "profiles_target_macros_nonnegative"',
  'a negative carbs target is rejected'
);
select throws_ok(
  $$update public.profiles set target_fat_g = -1 where id = '18200000-0000-4000-8000-0000000000fa'$$,
  '23514',
  'new row for relation "profiles" violates check constraint "profiles_target_macros_nonnegative"',
  'a negative fat target is rejected'
);
select lives_ok(
  $$update public.profiles set target_protein_g = 0, target_carbs_g = 0, target_fat_g = 0 where id = '18200000-0000-4000-8000-0000000000fa'$$,
  'a zero macro target is accepted'
);
select lives_ok(
  $$update public.profiles set target_protein_g = 100000, target_carbs_g = 100000, target_fat_g = 100000 where id = '18200000-0000-4000-8000-0000000000fa'$$,
  'macro targets have no upper bound'
);

-- The columns are independent: macros with no calories, and the reverse.
select lives_ok(
  $$update public.profiles set target_kcal = null, target_protein_g = 150, target_carbs_g = null, target_fat_g = null where id = '18200000-0000-4000-8000-0000000000fa'$$,
  'a macro target with no calorie target is accepted'
);
select lives_ok(
  $$update public.profiles set target_kcal = 2150, target_protein_g = null, target_carbs_g = null, target_fat_g = null where id = '18200000-0000-4000-8000-0000000000fa'$$,
  'a calorie target with no macro targets is accepted'
);

-- Grants, read from the catalog: the exact column lists of Amendment 4.
select is(
  (
    select array_agg(attname::text order by attname)
    from pg_attribute
    where attrelid = 'public.profiles'::regclass and attnum > 0 and not attisdropped
      and has_column_privilege('authenticated', attrelid, attnum, 'insert')
  ),
  array[
    'activity', 'birth_date', 'checkin_weekday', 'energy_unit', 'height_cm', 'id', 'onboarding_completed_at',
    'onboarding_weight_kg', 'sex', 'target_carbs_g', 'target_fat_g', 'target_kcal', 'target_protein_g',
    'targets_updated_at', 'timezone', 'weight_unit'
  ],
  'authenticated can insert exactly the Amendment 4 columns of profiles'
);
select is(
  (
    select array_agg(attname::text order by attname)
    from pg_attribute
    where attrelid = 'public.profiles'::regclass and attnum > 0 and not attisdropped
      and has_column_privilege('authenticated', attrelid, attnum, 'update')
  ),
  array[
    'activity', 'birth_date', 'checkin_weekday', 'energy_unit', 'height_cm', 'onboarding_completed_at',
    'onboarding_weight_kg', 'sex', 'target_carbs_g', 'target_fat_g', 'target_kcal', 'target_protein_g',
    'targets_updated_at', 'timezone', 'weight_unit'
  ],
  'authenticated can update exactly the Amendment 4 columns of profiles, without id'
);
select ok(
  not exists (
    select 1
    from unnest(array['target_kcal', 'target_protein_g', 'target_carbs_g', 'target_fat_g', 'targets_updated_at']) as column_name
    where has_column_privilege('anon', 'public.profiles', column_name, 'select')
      or has_column_privilege('anon', 'public.profiles', column_name, 'insert')
      or has_column_privilege('anon', 'public.profiles', column_name, 'update')
  ),
  'anon holds no privilege on the target columns'
);
select ok(
  has_table_privilege('authenticated', 'public.profiles', 'select'),
  'authenticated can still select every profiles column, including the targets'
);
select ok(
  not (
    select bool_or(has_column_privilege('authenticated', 'public.profiles', column_name, 'insert')
      or has_column_privilege('authenticated', 'public.profiles', column_name, 'update'))
    from unnest(array['created_at', 'terms_accepted_at', 'terms_version']) as column_name
  ),
  'created_at and the terms columns stay unwritable by authenticated'
);

-- User A writes their own targets as a client would.
set local role authenticated;
set local request.jwt.claims = '{"sub":"18200000-0000-4000-8000-0000000000fa","role":"authenticated"}';

select lives_ok(
  $$update public.profiles set target_kcal = 2150, target_protein_g = 160, target_carbs_g = 200, target_fat_g = 70, targets_updated_at = '2026-10-15 09:00:00+00' where id = '18200000-0000-4000-8000-0000000000fa'$$,
  'user A saves all five targets on their own profile'
);
select results_eq(
  $$select target_kcal, target_protein_g, target_carbs_g, target_fat_g, targets_updated_at from public.profiles where id = '18200000-0000-4000-8000-0000000000fa'$$,
  $$values (2150, 160::numeric, 200::numeric, 70::numeric, '2026-10-15 09:00:00+00'::timestamptz)$$,
  'user A reads their targets back'
);
select throws_ok(
  $$update public.profiles set target_kcal = 700 where id = '18200000-0000-4000-8000-0000000000fa'$$,
  '23514',
  'new row for relation "profiles" violates check constraint "profiles_target_kcal_range"',
  'the calorie range holds for a client write'
);
select lives_ok(
  $$update public.profiles set target_kcal = 3000 where id = '18200000-0000-4000-8000-0000000000fb'$$,
  'user A updating user B''s targets is filtered, not an error'
);
select is(
  (select count(*)::int from public.profiles where id = '18200000-0000-4000-8000-0000000000fb'),
  0,
  'user A cannot read user B''s profile'
);

reset role;

select is(
  (select target_kcal from public.profiles where id = '18200000-0000-4000-8000-0000000000fb'),
  null::int,
  'user B''s targets were not changed by user A'
);

-- User B sees only their own targets.
set local role authenticated;
set local request.jwt.claims = '{"sub":"18200000-0000-4000-8000-0000000000fb","role":"authenticated"}';

select is(
  (select count(*)::int from public.profiles where id = '18200000-0000-4000-8000-0000000000fa'),
  0,
  'user B cannot read user A''s targets'
);
select results_eq(
  $$select target_kcal is null, targets_updated_at is null from public.profiles where id = '18200000-0000-4000-8000-0000000000fb'$$,
  $$values (true, true)$$,
  'user B reads their own profile with no target'
);

reset role;

-- A client can insert a profile row with targets (the grant is on insert too).
delete from public.profiles where id = '18200000-0000-4000-8000-0000000000fb';

set local role authenticated;
set local request.jwt.claims = '{"sub":"18200000-0000-4000-8000-0000000000fb","role":"authenticated"}';

select lives_ok(
  $$insert into public.profiles (id, target_kcal, target_protein_g, targets_updated_at) values ('18200000-0000-4000-8000-0000000000fb', 1800, 120, '2026-10-15 10:00:00+00')$$,
  'a client can insert its own profile row with targets'
);
select throws_ok(
  $$insert into public.profiles (id, target_fat_g) values ('18200000-0000-4000-8000-0000000000fb', -5)$$,
  '23514',
  'new row for relation "profiles" violates check constraint "profiles_target_macros_nonnegative"',
  'the macro check holds for a client insert'
);

reset role;

-- Anon.
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  'select target_kcal from public.profiles',
  '42501',
  'permission denied for table profiles',
  'anon cannot read the targets'
);

reset role;

select * from finish();

rollback;
