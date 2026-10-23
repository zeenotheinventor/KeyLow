-- programs_and_setup: the `activity_level` and `goal_type` enums, the conversion of `profiles.activity`,
-- the check on `profiles.sex`, the `programs` table, and every existing account marked set up (KEY-600).
-- Everything here is set out in docs/adr/0003-data-model.md, Amendment 12, which wins over any other
-- description.
--
-- This is a health data table. Nothing here logs a row value or raises a notice with one. A check
-- constraint failure can quote the failing row in PostgreSQL's own error log, which no client can
-- prevent (Amendment 12, "Health data"), so core checks a value before it is sent.

-- The five activity levels, in the order of the activity factors 1.2, 1.375, 1.55, 1.725 and 1.9 (ADR
-- 0002, Amendment 1). The order is part of the contract.
create type public.activity_level as enum ('sedentary', 'light', 'moderate', 'very', 'extra');

-- `profiles.activity` was `text` in 0001_init.sql and no code writes it. Zee ruled on 2026-10-23 that the
-- migration must deploy safely whatever production holds, with no manual check and no raise
-- (Amendment 12). A value that is one of the five levels is kept and any other value becomes null. The
-- notice carries the count and never a value.
do $$
declare
  stray_count bigint;
begin
  select count(*) into stray_count from public.profiles
    where activity is not null
      and activity not in ('sedentary', 'light', 'moderate', 'very', 'extra');
  raise notice 'profiles.activity: % value(s) that are not an activity level will be set to null', stray_count;
end;
$$;

-- A column privilege names the column and not its type, so the grants on `profiles` are unchanged.
alter table public.profiles
  alter column activity type public.activity_level
  using (
    case
      when activity in ('sedentary', 'light', 'moderate', 'very', 'extra') then activity::public.activity_level
      else null
    end
  );

-- "Prefer not to say" is stored as `other`. A check passes on null, so a profile with no sex is valid.
-- No code writes the column today. As with `activity`, a value that is not allowed becomes null, with a
-- count-only notice, so the check below cannot fail the deploy.
do $$
declare
  stray_count bigint;
begin
  update public.profiles set sex = null
    where sex is not null and sex not in ('female', 'male', 'other');
  get diagnostics stray_count = row_count;
  raise notice 'profiles.sex: % value(s) that are not female, male or other were set to null', stray_count;
end;
$$;

alter table public.profiles
  add constraint profiles_sex_check check (sex in ('female', 'male', 'other'));

-- The order is part of the contract.
create type public.goal_type as enum ('lose', 'maintain', 'gain');

-- A user's program. Amendment 1 gives the table its `id` and `created_at`. `goal` and `started_on` have
-- no default, because the client always sends them (`started_on` is the user's local date). There is
-- no trigger on `updated_at`: the client writes it on every update, as it writes `targets_updated_at`
-- (Amendment 4). `split_preset` is text with a check and not an enum, and its values are the keys of
-- the engine's fat fraction params. `dow_offsets_kcal` is an `int[]` and not `int[7]`, because
-- Postgres ignores a declared array size.
create table public.programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal public.goal_type not null,
  rate_pct_per_week numeric not null,
  protein_g_per_kg numeric not null,
  fat_fraction_of_remaining numeric not null,
  split_preset text not null,
  dow_offsets_kcal int[] not null default '{0,0,0,0,0,0,0}',
  goal_weight_kg numeric,
  started_on date not null,
  ended_on date,
  next_checkin_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One check for the three goals, so they cannot drift apart. The rate is a magnitude in percent of
  -- body weight a week and the goal is the direction, so a `lose` row holds 0.5 and not -0.5. The
  -- bounds are the engine's rate caps (1.0 to lose, 0.5 to gain), so a stored rate never makes the
  -- engine record `max_rate`.
  constraint programs_goal_rate_check check (
    (goal = 'maintain' and rate_pct_per_week = 0)
    or (goal = 'lose' and rate_pct_per_week > 0 and rate_pct_per_week <= 1.0)
    or (goal = 'gain' and rate_pct_per_week > 0 and rate_pct_per_week <= 0.5)
  ),

  constraint programs_protein_g_per_kg_check check (protein_g_per_kg > 0 and protein_g_per_kg <= 3.0),

  constraint programs_fat_fraction_of_remaining_check check (
    fat_fraction_of_remaining > 0 and fat_fraction_of_remaining < 1
  ),

  constraint programs_split_preset_check check (split_preset in ('balanced', 'low_fat', 'low_carb')),

  -- A check cannot use a subquery, so this is written out in full, as Amendment 12 gives it. An element
  -- must not be null, because a null element would make the sum null and a check passes on null. For the
  -- same reason the array must be one dimensional and start at index 1: with another lower bound,
  -- `dow_offsets_kcal[7]` is out of bounds, the sum is null and the check would pass.
  constraint programs_dow_offsets_kcal_check check (
    array_ndims(dow_offsets_kcal) = 1
    and array_lower(dow_offsets_kcal, 1) = 1
    and cardinality(dow_offsets_kcal) = 7
    and array_position(dow_offsets_kcal, null) is null
    and dow_offsets_kcal[1] + dow_offsets_kcal[2] + dow_offsets_kcal[3] + dow_offsets_kcal[4]
      + dow_offsets_kcal[5] + dow_offsets_kcal[6] + dow_offsets_kcal[7] = 0
  ),

  -- Null, or the same range as a weight (Amendment 9). A check passes on null.
  constraint programs_goal_weight_kg_check check (goal_weight_kg between 20 and 400),

  -- A check passes on null, and a null `ended_on` means the program is active.
  constraint programs_ended_on_check check (ended_on >= started_on)
);

-- One active program per user: at most one row with a null `ended_on`. It leads with `user_id`, so the
-- cascade from `auth.users` has an index on the referencing column, and no other index is added. The
-- index is partial, so PostgREST's `on_conflict` cannot name it and the api-client reads the active
-- row and then inserts or updates it (Amendment 12, "One active program per user").
create unique index programs_one_active_per_user on public.programs (user_id) where ended_on is null;

alter table public.programs enable row level security;

-- Set the table privileges explicitly so nothing relies on the default ones (see 0001_init.sql).
-- Start from a clean slate, then grant back only what the clients use. The anon role keeps nothing.
-- The service role keeps nothing either, because nothing server side reads or writes programs yet (M6
-- grants what `run-checkin` needs in its own migration, and M7 what the export needs).
revoke all on public.programs from anon, authenticated, service_role;

-- `id`, `user_id` and `created_at` are in neither column list. A column default applies to a column the
-- caller cannot write, so every inserted row gets `auth.uid()` as its owner, a row can never be
-- inserted for another user and no row ever changes owner. A column added later is not writable until
-- a migration grants it (Amendments 3 and 4).
grant select, delete on public.programs to authenticated;

grant insert (
  goal, rate_pct_per_week, protein_g_per_kg, fat_fraction_of_remaining, split_preset, dow_offsets_kcal,
  goal_weight_kg, started_on, ended_on, next_checkin_date, updated_at
) on public.programs to authenticated;

grant update (
  goal, rate_pct_per_week, protein_g_per_kg, fat_fraction_of_remaining, split_preset, dow_offsets_kcal,
  goal_weight_kg, started_on, ended_on, next_checkin_date, updated_at
) on public.programs to authenticated;

-- Owner only. Terms acceptance is not in these policies (Amendment 9, "Privileges and row level
-- security").
create policy "programs_select_own" on public.programs
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "programs_insert_own" on public.programs
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "programs_update_own" on public.programs
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "programs_delete_own" on public.programs
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Existing accounts are marked set up, because Zee ruled that there is no forced wizard for them
-- (ruling 2, recorded on KEY-594). A profile that already has a value keeps it. An account created
-- later keeps a null value, because `handle_new_user()` is unchanged, and so sees the first-run wizard.
update public.profiles set onboarding_completed_at = now() where onboarding_completed_at is null;
