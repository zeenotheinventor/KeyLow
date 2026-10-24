-- Asserts public.programs, the activity_level and goal_type enums, the profiles.activity conversion,
-- the profiles.sex check and the marking of existing accounts as set up (ADR 0003, Amendment 12).
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so nothing
-- created here persists. Every fixture id starts with 60000000 and every email with key600-. Each
-- actor is entered with `set local role` plus the JWT claims that `auth.uid()` reads, and left with
-- `reset role`.
--
-- A program is health data. The fixtures are made up and no assertion name quotes a value except where
-- the value is the case under test (the bounds of a check). Every row is found by its owner, never by
-- a whole-table count.
--
-- Fixture users: a and b (row level security), c (account deletion), d (one active program), e (the
-- checks), f and g (the backfill), h (the profile checks).

begin;

select plan(180);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '60000000-0000-4000-8000-0000000000aa', 'authenticated', 'authenticated', 'key600-programs-a@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '60000000-0000-4000-8000-0000000000bb', 'authenticated', 'authenticated', 'key600-programs-b@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '60000000-0000-4000-8000-0000000000cc', 'authenticated', 'authenticated', 'key600-programs-c@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '60000000-0000-4000-8000-0000000000dd', 'authenticated', 'authenticated', 'key600-programs-d@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '60000000-0000-4000-8000-0000000000ee', 'authenticated', 'authenticated', 'key600-programs-e@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '60000000-0000-4000-8000-0000000000ff', 'authenticated', 'authenticated', 'key600-programs-f@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '60000000-0000-4000-8000-000000000011', 'authenticated', 'authenticated', 'key600-programs-g@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '60000000-0000-4000-8000-000000000022', 'authenticated', 'authenticated', 'key600-programs-h@keylow.test');

-- One program, with every column a case does not name set to a value that passes. It runs as whoever
-- calls it, postgres in the cases below, so it is the table's constraints that decide and not its
-- grants. `ended` defaults to a date so that rows made by the check cases never meet the one-active
-- index. The cases of the one-active index pass null explicitly.
create function pg_temp.add_program(
  owner uuid,
  program_goal public.goal_type,
  rate numeric,
  protein numeric default 1.6,
  fat numeric default 0.4,
  preset text default 'balanced',
  started date default '2026-10-01',
  ended date default '2026-10-31',
  goal_weight numeric default null,
  offsets int[] default '{0,0,0,0,0,0,0}'
)
returns void
language sql
as $$
  insert into public.programs (
    user_id, goal, rate_pct_per_week, protein_g_per_kg, fat_fraction_of_remaining, split_preset,
    dow_offsets_kcal, goal_weight_kg, started_on, ended_on
  )
  values (owner, program_goal, rate, protein, fat, preset, offsets, goal_weight, started, ended)
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

-- Shape: the enums.
select enum_has_labels(
  'public',
  'activity_level',
  array['sedentary', 'light', 'moderate', 'very', 'extra'],
  'activity_level has the five levels in the order of the activity factors'
);
select enum_has_labels(
  'public',
  'goal_type',
  array['lose', 'maintain', 'gain'],
  'goal_type has the three goals in the amendment''s order'
);
select col_type_is('public', 'profiles', 'activity', 'public', 'activity_level', 'profiles.activity is an activity_level');
select col_type_is('public', 'profiles', 'sex', 'text', 'profiles.sex stays text');

-- Shape: the table.
select has_table('public', 'programs', 'programs exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.programs'::regclass),
  'row level security is enabled on programs'
);
select columns_are(
  'public',
  'programs',
  array[
    'id', 'user_id', 'goal', 'rate_pct_per_week', 'protein_g_per_kg', 'fat_fraction_of_remaining',
    'split_preset', 'dow_offsets_kcal', 'goal_weight_kg', 'started_on', 'ended_on', 'next_checkin_date',
    'created_at', 'updated_at'
  ],
  'programs has the amendment''s columns'
);
select col_is_pk('public', 'programs', 'id', 'the primary key is id');
select col_type_is('public', 'programs', 'id', 'uuid', 'id is a uuid');
select col_default_is('public', 'programs', 'id', 'gen_random_uuid()', 'id defaults to a random uuid');
select col_type_is('public', 'programs', 'user_id', 'uuid', 'user_id is a uuid');
select col_not_null('public', 'programs', 'user_id', 'user_id is not null');
select col_default_is('public', 'programs', 'user_id', 'auth.uid()', 'user_id defaults to the caller');
select fk_ok('public', 'programs', 'user_id', 'auth', 'users', 'id', 'user_id references auth.users');
select is(
  (select confdeltype::text from pg_constraint where conrelid = 'public.programs'::regclass and contype = 'f'),
  'c',
  'the user_id foreign key cascades on delete'
);
select col_type_is('public', 'programs', 'goal', 'public', 'goal_type', 'goal is a goal_type');
select col_not_null('public', 'programs', 'goal', 'goal is not null');
select col_hasnt_default('public', 'programs', 'goal', 'goal has no default');
select col_type_is('public', 'programs', 'rate_pct_per_week', 'numeric', 'rate_pct_per_week is numeric');
select col_not_null('public', 'programs', 'rate_pct_per_week', 'rate_pct_per_week is not null');
select col_hasnt_default('public', 'programs', 'rate_pct_per_week', 'rate_pct_per_week has no default');
select col_type_is('public', 'programs', 'protein_g_per_kg', 'numeric', 'protein_g_per_kg is numeric');
select col_not_null('public', 'programs', 'protein_g_per_kg', 'protein_g_per_kg is not null');
select col_hasnt_default('public', 'programs', 'protein_g_per_kg', 'protein_g_per_kg has no default');
select col_type_is('public', 'programs', 'fat_fraction_of_remaining', 'numeric', 'fat_fraction_of_remaining is numeric');
select col_not_null('public', 'programs', 'fat_fraction_of_remaining', 'fat_fraction_of_remaining is not null');
select col_hasnt_default('public', 'programs', 'fat_fraction_of_remaining', 'fat_fraction_of_remaining has no default');
select col_type_is('public', 'programs', 'split_preset', 'text', 'split_preset is text and not an enum');
select col_not_null('public', 'programs', 'split_preset', 'split_preset is not null');
select col_hasnt_default('public', 'programs', 'split_preset', 'split_preset has no default');
select col_type_is('public', 'programs', 'dow_offsets_kcal', 'integer[]', 'dow_offsets_kcal is an integer array');
select col_not_null('public', 'programs', 'dow_offsets_kcal', 'dow_offsets_kcal is not null');
select is(
  (select pg_get_expr(d.adbin, d.adrelid) from pg_attrdef d
    where d.adrelid = 'public.programs'::regclass
      and d.adnum = (select attnum from pg_attribute where attrelid = 'public.programs'::regclass and attname = 'dow_offsets_kcal')),
  '''{0,0,0,0,0,0,0}''::integer[]',
  'dow_offsets_kcal defaults to seven zeros'
);
select col_type_is('public', 'programs', 'goal_weight_kg', 'numeric', 'goal_weight_kg is numeric');
select col_is_null('public', 'programs', 'goal_weight_kg', 'goal_weight_kg is nullable');
select col_hasnt_default('public', 'programs', 'goal_weight_kg', 'goal_weight_kg has no default');
select col_type_is('public', 'programs', 'started_on', 'date', 'started_on is a date');
select col_not_null('public', 'programs', 'started_on', 'started_on is not null');
select col_hasnt_default('public', 'programs', 'started_on', 'started_on has no default');
select col_type_is('public', 'programs', 'ended_on', 'date', 'ended_on is a date');
select col_is_null('public', 'programs', 'ended_on', 'ended_on is nullable');
select col_hasnt_default('public', 'programs', 'ended_on', 'ended_on has no default');
select col_type_is('public', 'programs', 'next_checkin_date', 'date', 'next_checkin_date is a date');
select col_is_null('public', 'programs', 'next_checkin_date', 'next_checkin_date is nullable');
select col_hasnt_default('public', 'programs', 'next_checkin_date', 'next_checkin_date has no default');
select col_type_is('public', 'programs', 'created_at', 'timestamp with time zone', 'created_at is a timestamptz');
select col_not_null('public', 'programs', 'created_at', 'created_at is not null');
select col_default_is('public', 'programs', 'created_at', 'now()', 'created_at defaults to now()');
select col_type_is('public', 'programs', 'updated_at', 'timestamp with time zone', 'updated_at is a timestamptz');
select col_not_null('public', 'programs', 'updated_at', 'updated_at is not null');
select col_default_is('public', 'programs', 'updated_at', 'now()', 'updated_at defaults to now()');
select is(
  (select count(*)::int from pg_trigger where tgrelid = 'public.programs'::regclass and not tgisinternal),
  0,
  'programs has no trigger, so the client writes updated_at'
);

-- Indexes: the primary key and the one-active index, and no other.
select is(
  (select array_agg(indexname::text order by indexname) from pg_indexes where schemaname = 'public' and tablename = 'programs'),
  array['programs_one_active_per_user', 'programs_pkey'],
  'programs has the primary key and the one-active index and no other index'
);
select is(
  (select indexdef from pg_indexes where schemaname = 'public' and indexname = 'programs_one_active_per_user'),
  'CREATE UNIQUE INDEX programs_one_active_per_user ON public.programs USING btree (user_id) WHERE (ended_on IS NULL)',
  'the one-active index is unique on user_id where ended_on is null'
);

-- Policies, read from the catalog.
select policies_are(
  'public',
  'programs',
  array['programs_select_own', 'programs_insert_own', 'programs_update_own', 'programs_delete_own'],
  'programs has exactly the four owner policies'
);
select policy_cmd_is('public', 'programs', 'programs_select_own', 'select', 'programs_select_own is for select');
select policy_cmd_is('public', 'programs', 'programs_insert_own', 'insert', 'programs_insert_own is for insert');
select policy_cmd_is('public', 'programs', 'programs_update_own', 'update', 'programs_update_own is for update');
select policy_cmd_is('public', 'programs', 'programs_delete_own', 'delete', 'programs_delete_own is for delete');
select policy_roles_are('public', 'programs', 'programs_select_own', array['authenticated'], 'programs_select_own is for authenticated only');
select policy_roles_are('public', 'programs', 'programs_insert_own', array['authenticated'], 'programs_insert_own is for authenticated only');
select policy_roles_are('public', 'programs', 'programs_update_own', array['authenticated'], 'programs_update_own is for authenticated only');
select policy_roles_are('public', 'programs', 'programs_delete_own', array['authenticated'], 'programs_delete_own is for authenticated only');

-- Each policy reads the caller as `(select auth.uid())`, which Postgres evaluates once per statement and
-- renders with the subselect. A bare `auth.uid()` would be evaluated once per row and shows no subselect.
select ok(
  (select qual from pg_policies where schemaname = 'public' and tablename = 'programs' and policyname = 'programs_select_own')
    like '%( SELECT auth.uid()%',
  'programs_select_own reads the caller as (select auth.uid())'
);
select ok(
  (select with_check from pg_policies where schemaname = 'public' and tablename = 'programs' and policyname = 'programs_insert_own')
    like '%( SELECT auth.uid()%',
  'programs_insert_own reads the caller as (select auth.uid())'
);
select ok(
  (select qual like '%( SELECT auth.uid()%' and with_check like '%( SELECT auth.uid()%'
    from pg_policies where schemaname = 'public' and tablename = 'programs' and policyname = 'programs_update_own'),
  'programs_update_own reads the caller as (select auth.uid()) in using and with check'
);
select ok(
  (select qual from pg_policies where schemaname = 'public' and tablename = 'programs' and policyname = 'programs_delete_own')
    like '%( SELECT auth.uid()%',
  'programs_delete_own reads the caller as (select auth.uid())'
);

-- Not null columns with no default.
select throws_ok(
  $$insert into public.programs (user_id, rate_pct_per_week, protein_g_per_kg, fat_fraction_of_remaining, split_preset, started_on)
    values ('60000000-0000-4000-8000-0000000000ee', 0, 1.6, 0.4, 'balanced', '2026-10-01')$$,
  '23502',
  'null value in column "goal" of relation "programs" violates not-null constraint',
  'a program without a goal is refused'
);
select throws_ok(
  $$insert into public.programs (user_id, goal, rate_pct_per_week, protein_g_per_kg, fat_fraction_of_remaining, split_preset)
    values ('60000000-0000-4000-8000-0000000000ee', 'maintain', 0, 1.6, 0.4, 'balanced')$$,
  '23502',
  'null value in column "started_on" of relation "programs" violates not-null constraint',
  'a program without a start date is refused'
);

-- The rate by goal. The rate is a magnitude and the goal is the direction.
select lives_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'maintain', 0)$$,
  'maintain with a rate of 0 is accepted'
);
select throws_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'maintain', 0.1)$$,
  '23514',
  'new row for relation "programs" violates check constraint "programs_goal_rate_check"',
  'maintain with a rate above 0 is refused'
);
select lives_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'lose', 0.25)$$,
  'lose at 0.25 is accepted'
);
select lives_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'lose', 1.0)$$,
  'lose at 1.0 is accepted'
);
select throws_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'lose', 1.1)$$,
  '23514',
  'new row for relation "programs" violates check constraint "programs_goal_rate_check"',
  'lose at 1.1 is refused'
);
select throws_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'lose', 0)$$,
  '23514',
  'new row for relation "programs" violates check constraint "programs_goal_rate_check"',
  'lose at 0 is refused'
);
select throws_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'lose', -0.5)$$,
  '23514',
  'new row for relation "programs" violates check constraint "programs_goal_rate_check"',
  'lose at a negative rate is refused, because the rate is a magnitude'
);
select lives_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'gain', 0.1)$$,
  'gain at 0.1 is accepted'
);
select lives_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'gain', 0.5)$$,
  'gain at 0.5 is accepted'
);
select throws_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'gain', 0.6)$$,
  '23514',
  'new row for relation "programs" violates check constraint "programs_goal_rate_check"',
  'gain at 0.6 is refused'
);
select throws_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'gain', 0)$$,
  '23514',
  'new row for relation "programs" violates check constraint "programs_goal_rate_check"',
  'gain at 0 is refused'
);

-- Protein: above 0 and at most 3.0.
select lives_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'maintain', 0, protein => 3.0)$$,
  'protein of 3.0 is accepted'
);
select lives_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'maintain', 0, protein => 0.1)$$,
  'protein of 0.1 is accepted'
);
select throws_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'maintain', 0, protein => 0)$$,
  '23514',
  'new row for relation "programs" violates check constraint "programs_protein_g_per_kg_check"',
  'protein of 0 is refused'
);
select throws_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'maintain', 0, protein => 3.1)$$,
  '23514',
  'new row for relation "programs" violates check constraint "programs_protein_g_per_kg_check"',
  'protein of 3.1 is refused'
);

-- Fat fraction: above 0 and below 1.
select lives_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'maintain', 0, fat => 0.99)$$,
  'a fat fraction of 0.99 is accepted'
);
select lives_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'maintain', 0, fat => 0.01)$$,
  'a fat fraction of 0.01 is accepted'
);
select throws_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'maintain', 0, fat => 0)$$,
  '23514',
  'new row for relation "programs" violates check constraint "programs_fat_fraction_of_remaining_check"',
  'a fat fraction of 0 is refused'
);
select throws_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'maintain', 0, fat => 1)$$,
  '23514',
  'new row for relation "programs" violates check constraint "programs_fat_fraction_of_remaining_check"',
  'a fat fraction of 1 is refused'
);

-- The split preset is one of three keys.
select lives_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'maintain', 0, preset => 'balanced')$$,
  'the balanced preset is accepted'
);
select lives_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'maintain', 0, preset => 'low_fat')$$,
  'the low_fat preset is accepted'
);
select lives_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'maintain', 0, preset => 'low_carb')$$,
  'the low_carb preset is accepted'
);
select throws_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'maintain', 0, preset => 'keto')$$,
  '23514',
  'new row for relation "programs" violates check constraint "programs_split_preset_check"',
  'an unknown preset is refused'
);
select throws_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'maintain', 0, preset => 'low-fat')$$,
  '23514',
  'new row for relation "programs" violates check constraint "programs_split_preset_check"',
  'the preset in kebab case is refused'
);
select throws_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'maintain', 0, preset => 'Balanced')$$,
  '23514',
  'new row for relation "programs" violates check constraint "programs_split_preset_check"',
  'the preset with a capital letter is refused'
);

-- The day of week offsets: seven elements, none null, summing to 0.
select lives_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'maintain', 0, offsets => '{0,0,0,0,0,0,0}')$$,
  'seven zeros are accepted'
);
select lives_ok(
  $$insert into public.programs (id, user_id, goal, rate_pct_per_week, protein_g_per_kg, fat_fraction_of_remaining, split_preset, started_on, ended_on)
    values ('60000000-0000-4000-8000-0000000000e1', '60000000-0000-4000-8000-0000000000ee', 'maintain', 0, 1.6, 0.4, 'balanced', '2026-10-01', '2026-10-31')$$,
  'a program that leaves out dow_offsets_kcal is accepted'
);
select is(
  (select dow_offsets_kcal from public.programs where id = '60000000-0000-4000-8000-0000000000e1'),
  array[0, 0, 0, 0, 0, 0, 0],
  'a program that leaves out dow_offsets_kcal gets seven zeros'
);
select lives_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'maintain', 0, offsets => '{100,-100,0,0,0,0,0}')$$,
  'offsets that sum to 0 are accepted'
);
select lives_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'maintain', 0, offsets => '{-250,0,0,0,0,0,250}')$$,
  'offsets that sum to 0 with a negative first element are accepted'
);
select throws_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'maintain', 0, offsets => '{100,0,0,0,0,0,0}')$$,
  '23514',
  'new row for relation "programs" violates check constraint "programs_dow_offsets_kcal_check"',
  'offsets that sum to 100 are refused'
);
select throws_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'maintain', 0, offsets => '{-1,0,0,0,0,0,0}')$$,
  '23514',
  'new row for relation "programs" violates check constraint "programs_dow_offsets_kcal_check"',
  'offsets that sum to -1 are refused'
);
select throws_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'maintain', 0, offsets => '{0,0,0,0,0,0}')$$,
  '23514',
  'new row for relation "programs" violates check constraint "programs_dow_offsets_kcal_check"',
  'six offsets are refused'
);
select throws_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'maintain', 0, offsets => '{0,0,0,0,0,0,0,0}')$$,
  '23514',
  'new row for relation "programs" violates check constraint "programs_dow_offsets_kcal_check"',
  'eight offsets are refused'
);
select throws_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'maintain', 0, offsets => '{}')$$,
  '23514',
  'new row for relation "programs" violates check constraint "programs_dow_offsets_kcal_check"',
  'an empty array of offsets is refused'
);
select throws_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'maintain', 0, offsets => '[0:6]={100,0,0,0,0,0,0}')$$,
  '23514',
  'new row for relation "programs" violates check constraint "programs_dow_offsets_kcal_check"',
  'seven offsets with a lower bound of 0 are refused'
);
select throws_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'maintain', 0, offsets => '[2:8]={0,0,0,0,0,0,0}')$$,
  '23514',
  'new row for relation "programs" violates check constraint "programs_dow_offsets_kcal_check"',
  'seven offsets with a lower bound of 2 are refused'
);
select throws_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'maintain', 0, offsets => '{{0,0,0,0,0,0,0}}')$$,
  '23514',
  'new row for relation "programs" violates check constraint "programs_dow_offsets_kcal_check"',
  'a two-dimensional array of seven offsets is refused'
);
select throws_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'maintain', 0, offsets => '{0,null,0,0,0,0,0}')$$,
  '23514',
  'new row for relation "programs" violates check constraint "programs_dow_offsets_kcal_check"',
  'a null element is refused'
);
select throws_ok(
  $$insert into public.programs (user_id, goal, rate_pct_per_week, protein_g_per_kg, fat_fraction_of_remaining, split_preset, dow_offsets_kcal, started_on, ended_on)
    values ('60000000-0000-4000-8000-0000000000ee', 'maintain', 0, 1.6, 0.4, 'balanced', null, '2026-10-01', '2026-10-31')$$,
  '23502',
  'null value in column "dow_offsets_kcal" of relation "programs" violates not-null constraint',
  'a null array of offsets is refused'
);

-- The dates and the goal weight.
select lives_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'maintain', 0, started => '2026-10-01', ended => '2026-10-01')$$,
  'a program that ends on the day it started is accepted'
);
select throws_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'maintain', 0, started => '2026-10-01', ended => '2026-09-30')$$,
  '23514',
  'new row for relation "programs" violates check constraint "programs_ended_on_check"',
  'a program that ends before it started is refused'
);
select lives_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'maintain', 0, goal_weight => 20)$$,
  'a goal weight of 20 is accepted'
);
select lives_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'maintain', 0, goal_weight => 400)$$,
  'a goal weight of 400 is accepted'
);
select throws_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'maintain', 0, goal_weight => 19)$$,
  '23514',
  'new row for relation "programs" violates check constraint "programs_goal_weight_kg_check"',
  'a goal weight of 19 is refused'
);
select throws_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'maintain', 0, goal_weight => 400.1)$$,
  '23514',
  'new row for relation "programs" violates check constraint "programs_goal_weight_kg_check"',
  'a goal weight of 400.1 is refused'
);

-- One active program per user.
select lives_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000dd', 'lose', 0.5, ended => null)$$,
  'a first active program is accepted'
);
select throws_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000dd', 'gain', 0.25, ended => null)$$,
  '23505',
  'duplicate key value violates unique constraint "programs_one_active_per_user"',
  'a second active program for the same user is refused'
);
select lives_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000dd', 'gain', 0.25, ended => '2026-10-31')$$,
  'an ended program is accepted beside the active one'
);
select lives_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000dd', 'maintain', 0, ended => '2026-10-31')$$,
  'a second ended program is accepted'
);
select lives_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000ee', 'lose', 0.5, ended => null)$$,
  'another user can have an active program at the same time'
);
select lives_ok(
  $$update public.programs set ended_on = '2026-10-31' where user_id = '60000000-0000-4000-8000-0000000000dd' and ended_on is null$$,
  'ending the active program is accepted'
);
select lives_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000dd', 'gain', 0.25, ended => null)$$,
  'a new active program is accepted once the earlier one has ended'
);

-- profiles.sex accepts the three values and null, and refuses anything else.
select lives_ok(
  $$update public.profiles set sex = 'female' where id = '60000000-0000-4000-8000-000000000022'$$,
  'profiles.sex accepts female'
);
select lives_ok(
  $$update public.profiles set sex = 'male' where id = '60000000-0000-4000-8000-000000000022'$$,
  'profiles.sex accepts male'
);
select lives_ok(
  $$update public.profiles set sex = 'other' where id = '60000000-0000-4000-8000-000000000022'$$,
  'profiles.sex accepts other'
);
select lives_ok(
  $$update public.profiles set sex = null where id = '60000000-0000-4000-8000-000000000022'$$,
  'profiles.sex accepts null'
);
select throws_ok(
  $$update public.profiles set sex = 'x' where id = '60000000-0000-4000-8000-000000000022'$$,
  '23514',
  'new row for relation "profiles" violates check constraint "profiles_sex_check"',
  'profiles.sex refuses x'
);
select throws_ok(
  $$update public.profiles set sex = 'Female' where id = '60000000-0000-4000-8000-000000000022'$$,
  '23514',
  'new row for relation "profiles" violates check constraint "profiles_sex_check"',
  'profiles.sex refuses a value with a capital letter'
);

-- profiles.activity accepts each level and null, and refuses anything else.
select lives_ok(
  $$update public.profiles set activity = 'sedentary' where id = '60000000-0000-4000-8000-000000000022'$$,
  'profiles.activity accepts sedentary'
);
select lives_ok(
  $$update public.profiles set activity = 'light' where id = '60000000-0000-4000-8000-000000000022'$$,
  'profiles.activity accepts light'
);
select lives_ok(
  $$update public.profiles set activity = 'moderate' where id = '60000000-0000-4000-8000-000000000022'$$,
  'profiles.activity accepts moderate'
);
select lives_ok(
  $$update public.profiles set activity = 'very' where id = '60000000-0000-4000-8000-000000000022'$$,
  'profiles.activity accepts very'
);
select lives_ok(
  $$update public.profiles set activity = 'extra' where id = '60000000-0000-4000-8000-000000000022'$$,
  'profiles.activity accepts extra'
);
select is(
  (select activity::text from public.profiles where id = '60000000-0000-4000-8000-000000000022'),
  'extra',
  'profiles.activity holds the level written'
);
select lives_ok(
  $$update public.profiles set activity = null where id = '60000000-0000-4000-8000-000000000022'$$,
  'profiles.activity accepts null'
);
select throws_ok(
  $$update public.profiles set activity = 'lazy' where id = '60000000-0000-4000-8000-000000000022'$$,
  '22P02',
  'invalid input value for enum activity_level: "lazy"',
  'profiles.activity refuses lazy'
);

-- Existing accounts are marked set up. The migration runs its update before this file does, so the
-- fixtures cannot be present when it runs. Instead, the fixtures hold the two cases (a profile with no
-- onboarding_completed_at, and one that already has a value) and the migration's statement is run here
-- on them, scoped to the two fixture ids so that no other row is touched. The migration's own run over
-- the profiles that exist when it deploys is not reachable from pgTAP.
select is(
  (select onboarding_completed_at from public.profiles where id = '60000000-0000-4000-8000-0000000000ff'),
  null::timestamptz,
  'a profile created after the migration has onboarding_completed_at null'
);
update public.profiles set onboarding_completed_at = '2026-10-20 09:00:00+00'
  where id = '60000000-0000-4000-8000-000000000011';
update public.profiles set onboarding_completed_at = now()
  where onboarding_completed_at is null
    and id in ('60000000-0000-4000-8000-0000000000ff', '60000000-0000-4000-8000-000000000011');
select isnt(
  (select onboarding_completed_at from public.profiles where id = '60000000-0000-4000-8000-0000000000ff'),
  null::timestamptz,
  'the backfill statement sets onboarding_completed_at on a profile that had none'
);
select is(
  (select onboarding_completed_at from public.profiles where id = '60000000-0000-4000-8000-000000000011'),
  '2026-10-20 09:00:00+00'::timestamptz,
  'the backfill statement keeps a value that was already set'
);

-- Owner only, as user A. The inserts leave user_id out, which is the form the api-client sends.
set local role authenticated;
set local request.jwt.claims = '{"sub":"60000000-0000-4000-8000-0000000000aa","role":"authenticated"}';

select lives_ok(
  $$insert into public.programs (goal, rate_pct_per_week, protein_g_per_kg, fat_fraction_of_remaining, split_preset, started_on, updated_at)
    values ('lose', 0.5, 1.6, 0.4, 'balanced', '2026-10-01', now())$$,
  'user A inserts a program with no user_id'
);
select is(
  (select count(*)::int from public.programs where user_id = '60000000-0000-4000-8000-0000000000aa'),
  1,
  'the inserted program belongs to user A'
);
select is(
  (select count(*)::int from public.programs),
  1,
  'user A selects only their own program'
);
select throws_ok(
  $$insert into public.programs (user_id, goal, rate_pct_per_week, protein_g_per_kg, fat_fraction_of_remaining, split_preset, started_on, ended_on)
    values ('60000000-0000-4000-8000-0000000000aa', 'maintain', 0, 1.6, 0.4, 'balanced', '2026-09-01', '2026-09-30')$$,
  '42501',
  'permission denied for table programs',
  'user A cannot name user_id on insert, even their own'
);
select throws_ok(
  $$insert into public.programs (id, goal, rate_pct_per_week, protein_g_per_kg, fat_fraction_of_remaining, split_preset, started_on, ended_on)
    values (gen_random_uuid(), 'maintain', 0, 1.6, 0.4, 'balanced', '2026-09-01', '2026-09-30')$$,
  '42501',
  'permission denied for table programs',
  'user A cannot name id on insert'
);
select throws_ok(
  $$insert into public.programs (created_at, goal, rate_pct_per_week, protein_g_per_kg, fat_fraction_of_remaining, split_preset, started_on, ended_on)
    values (now(), 'maintain', 0, 1.6, 0.4, 'balanced', '2026-09-01', '2026-09-30')$$,
  '42501',
  'permission denied for table programs',
  'user A cannot name created_at on insert'
);
select lives_ok(
  $$insert into public.programs (goal, rate_pct_per_week, protein_g_per_kg, fat_fraction_of_remaining, split_preset, dow_offsets_kcal, goal_weight_kg, started_on, ended_on, next_checkin_date, updated_at)
    values ('maintain', 0, 1.6, 0.4, 'balanced', '{100,-100,0,0,0,0,0}', 80, '2026-09-01', '2026-09-30', '2026-10-05', now())$$,
  'user A inserts an ended program naming every writable column'
);
select is(
  pg_temp.affected_rows($$update public.programs set goal = 'gain', rate_pct_per_week = 0.25, protein_g_per_kg = 2.0, fat_fraction_of_remaining = 0.28, split_preset = 'low_fat', updated_at = now() where ended_on is null$$),
  1::bigint,
  'user A updates their active program in place'
);
select is(
  (select split_preset from public.programs where ended_on is null),
  'low_fat',
  'the update reached the active program'
);
select throws_ok(
  $$update public.programs set user_id = '60000000-0000-4000-8000-0000000000bb' where ended_on is null$$,
  '42501',
  'permission denied for table programs',
  'user A cannot move a program to another user'
);
select throws_ok(
  $$update public.programs set id = gen_random_uuid() where ended_on is null$$,
  '42501',
  'permission denied for table programs',
  'user A cannot change id'
);
select throws_ok(
  $$update public.programs set created_at = now() where ended_on is null$$,
  '42501',
  'permission denied for table programs',
  'user A cannot change created_at'
);
select throws_ok(
  $$update public.programs set split_preset = 'keto' where ended_on is null$$,
  '23514',
  'new row for relation "programs" violates check constraint "programs_split_preset_check"',
  'a check still applies to an update by the owner'
);

reset role;

-- User B sees none of user A's programs, and can neither change nor delete them.
set local role authenticated;
set local request.jwt.claims = '{"sub":"60000000-0000-4000-8000-0000000000bb","role":"authenticated"}';

select is(
  (select count(*)::int from public.programs),
  0,
  'user B selects no program'
);
select is(
  pg_temp.affected_rows($$update public.programs set goal = 'gain', rate_pct_per_week = 0.25 where user_id = '60000000-0000-4000-8000-0000000000aa'$$),
  0::bigint,
  'user B updating user A''s programs affects no row'
);
select is(
  pg_temp.affected_rows($$update public.programs set updated_at = now()$$),
  0::bigint,
  'user B updating with no where clause affects no row'
);
select is(
  pg_temp.affected_rows($$delete from public.programs where user_id = '60000000-0000-4000-8000-0000000000aa'$$),
  0::bigint,
  'user B deleting user A''s programs affects no row'
);
select is(
  pg_temp.affected_rows($$delete from public.programs$$),
  0::bigint,
  'user B deleting with no where clause affects no row'
);
select lives_ok(
  $$insert into public.programs (goal, rate_pct_per_week, protein_g_per_kg, fat_fraction_of_remaining, split_preset, started_on)
    values ('maintain', 0, 1.6, 0.4, 'balanced', '2026-10-01')$$,
  'user B inserts their own program while user A has an active one'
);
select is(
  (select count(*)::int from public.programs),
  1,
  'user B selects only their own program'
);

reset role;

select is(
  (select goal::text from public.programs where user_id = '60000000-0000-4000-8000-0000000000aa' and ended_on is null),
  'gain',
  'user A''s active program was changed only by user A'
);
select is(
  (select count(*)::int from public.programs where user_id = '60000000-0000-4000-8000-0000000000aa'),
  2,
  'user B deleted none of user A''s programs'
);

-- User A deletes their own programs.
set local role authenticated;
set local request.jwt.claims = '{"sub":"60000000-0000-4000-8000-0000000000aa","role":"authenticated"}';

select is(
  pg_temp.affected_rows($$delete from public.programs where ended_on is not null$$),
  1::bigint,
  'user A deletes their own ended program'
);
select is(
  pg_temp.affected_rows($$delete from public.programs$$),
  1::bigint,
  'user A deletes their own active program'
);
select is(
  (select count(*)::int from public.programs),
  0,
  'user A has no program left'
);

reset role;

select is(
  (select count(*)::int from public.programs where user_id = '60000000-0000-4000-8000-0000000000bb'),
  1,
  'user A''s deletes did not touch user B''s program'
);

-- Anon can do nothing.
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  $$select * from public.programs$$,
  '42501',
  'permission denied for table programs',
  'anon cannot select from programs'
);
select throws_ok(
  $$insert into public.programs (goal, rate_pct_per_week, protein_g_per_kg, fat_fraction_of_remaining, split_preset, started_on)
    values ('maintain', 0, 1.6, 0.4, 'balanced', '2026-10-01')$$,
  '42501',
  'permission denied for table programs',
  'anon cannot insert into programs'
);
select throws_ok(
  $$update public.programs set updated_at = now()$$,
  '42501',
  'permission denied for table programs',
  'anon cannot update programs'
);
select throws_ok(
  $$delete from public.programs$$,
  '42501',
  'permission denied for table programs',
  'anon cannot delete from programs'
);

reset role;

-- Privileges, read from the catalog.
select is(
  (select array_agg(privilege_type::text order by privilege_type) from information_schema.table_privileges
    where table_schema = 'public' and table_name = 'programs' and grantee = 'authenticated'),
  array['DELETE', 'SELECT'],
  'authenticated holds table level select and delete and nothing else'
);
select is(
  (select array_agg(column_name::text order by column_name) from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'programs' and grantee = 'authenticated' and privilege_type = 'INSERT'),
  array[
    'dow_offsets_kcal', 'ended_on', 'fat_fraction_of_remaining', 'goal', 'goal_weight_kg', 'next_checkin_date',
    'protein_g_per_kg', 'rate_pct_per_week', 'split_preset', 'started_on', 'updated_at'
  ],
  'authenticated can insert every column except id, user_id and created_at'
);
select is(
  (select array_agg(column_name::text order by column_name) from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'programs' and grantee = 'authenticated' and privilege_type = 'UPDATE'),
  array[
    'dow_offsets_kcal', 'ended_on', 'fat_fraction_of_remaining', 'goal', 'goal_weight_kg', 'next_checkin_date',
    'protein_g_per_kg', 'rate_pct_per_week', 'split_preset', 'started_on', 'updated_at'
  ],
  'authenticated can update every column except id, user_id and created_at'
);
select ok(
  not has_column_privilege('authenticated', 'public.programs', 'id', 'insert')
    and not has_column_privilege('authenticated', 'public.programs', 'id', 'update')
    and not has_column_privilege('authenticated', 'public.programs', 'user_id', 'insert')
    and not has_column_privilege('authenticated', 'public.programs', 'user_id', 'update')
    and not has_column_privilege('authenticated', 'public.programs', 'created_at', 'insert')
    and not has_column_privilege('authenticated', 'public.programs', 'created_at', 'update'),
  'authenticated cannot insert or update id, user_id or created_at'
);
select ok(
  not has_table_privilege('authenticated', 'public.programs', 'insert')
    and not has_table_privilege('authenticated', 'public.programs', 'update')
    and not has_table_privilege('authenticated', 'public.programs', 'truncate')
    and not has_table_privilege('authenticated', 'public.programs', 'references')
    and not has_table_privilege('authenticated', 'public.programs', 'trigger'),
  'authenticated has no table level insert, update, truncate, references or trigger privilege'
);
select ok(
  not has_table_privilege('anon', 'public.programs', 'select')
    and not has_table_privilege('anon', 'public.programs', 'insert')
    and not has_table_privilege('anon', 'public.programs', 'update')
    and not has_table_privilege('anon', 'public.programs', 'delete')
    and not has_table_privilege('anon', 'public.programs', 'truncate')
    and not has_table_privilege('anon', 'public.programs', 'references')
    and not has_table_privilege('anon', 'public.programs', 'trigger')
    and not has_any_column_privilege('anon', 'public.programs', 'select')
    and not has_any_column_privilege('anon', 'public.programs', 'insert')
    and not has_any_column_privilege('anon', 'public.programs', 'update')
    and not has_any_column_privilege('anon', 'public.programs', 'references'),
  'anon has no privilege on programs'
);
select ok(
  has_table_privilege('service_role', 'public.programs', 'select')
    and not has_table_privilege('service_role', 'public.programs', 'insert')
    and not has_table_privilege('service_role', 'public.programs', 'update')
    and not has_table_privilege('service_role', 'public.programs', 'delete')
    and not has_table_privilege('service_role', 'public.programs', 'truncate')
    and not has_table_privilege('service_role', 'public.programs', 'references')
    and not has_table_privilege('service_role', 'public.programs', 'trigger')
    and not has_any_column_privilege('service_role', 'public.programs', 'insert')
    and not has_any_column_privilege('service_role', 'public.programs', 'update')
    and not has_any_column_privilege('service_role', 'public.programs', 'references'),
  'service_role can select from programs and holds no other privilege on it'
);

-- Account deletion on the real table: a user with an active and an ended program. Deleting the auth
-- user must succeed and leave none.
select lives_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000cc', 'lose', 0.5, ended => null)$$,
  'an active program is accepted for the account deletion case'
);
select lives_ok(
  $$select pg_temp.add_program('60000000-0000-4000-8000-0000000000cc', 'maintain', 0, ended => '2026-10-31')$$,
  'an ended program is accepted for the account deletion case'
);
select lives_ok(
  $$delete from auth.users where id = '60000000-0000-4000-8000-0000000000cc'$$,
  'deleting an auth user with an active and an ended program succeeds'
);
select is(
  (select count(*)::int from public.programs where user_id = '60000000-0000-4000-8000-0000000000cc'),
  0,
  'the programs of the deleted user, ended ones included, are gone'
);

select * from finish();

rollback;
