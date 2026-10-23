-- expenditure_snapshots_and_targets: the `expenditure_snapshots` and `targets` tables, select-only for
-- clients, and the check on `profiles.checkin_weekday` (KEY-610).
-- Everything here is set out in docs/adr/0003-data-model.md, Amendment 13, which wins over any other
-- description. The two functions that write these tables, and the hourly job, are other migrations.
--
-- These are health data tables. Nothing here logs a row value or raises a notice with one. A check
-- constraint failure can quote the failing row in PostgreSQL's own error log, which no client can
-- prevent (Amendment 9, "Health data"), and no client can write these tables in any case.

-- A check-in's estimate of expenditure, or the start snapshot made at setup. `id`, `program_id`, `kind`
-- and `created_at` are added to the frozen columns. `user_id` has no default, because no client inserts.
-- `kind` is text with a check and not an enum. `program_id` is set null on delete, so ending or
-- deleting a program leaves its history. `measurement` is null exactly when `kind = 'start'`.
create table public.expenditure_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  program_id uuid references public.programs (id) on delete set null,
  as_of_date date not null,
  kind text not null,
  mu_kcal numeric not null,
  var_kcal2 numeric not null,
  measurement jsonb,
  trend_weight_kg numeric,
  engine_version text not null,
  params jsonb not null,
  created_at timestamptz not null default now(),

  -- The idempotency key of `run-checkin`. It leads with `user_id`, so the cascade from `auth.users` has
  -- an index on the referencing column.
  constraint expenditure_snapshots_user_id_as_of_date_key unique (user_id, as_of_date),

  constraint expenditure_snapshots_kind_check check (kind in ('start', 'checkin')),

  -- The engine's `z` clamp (ADR 0002, Amendment 1).
  constraint expenditure_snapshots_mu_kcal_check check (mu_kcal between 800 and 6000),

  constraint expenditure_snapshots_var_kcal2_check check (var_kcal2 > 0),

  -- Null, or the same range as a weight (Amendment 9). A check passes on null.
  constraint expenditure_snapshots_trend_weight_kg_check check (trend_weight_kg between 20 and 400),

  -- One check for both directions: a `start` row has no measurement and a `checkin` row always has
  -- one. `kind` is not null, so neither side of the comparison is null.
  constraint expenditure_snapshots_measurement_kind_check check ((kind = 'start') = (measurement is null))
);

-- So that deleting a program does not scan the table to set `program_id` null.
create index expenditure_snapshots_program_id_idx on public.expenditure_snapshots (program_id);

-- The calorie and macro targets in force over a range of dates. `effective_from` is inclusive and
-- `effective_to` is exclusive, and a null `effective_to` means the row is current. `params` is not in
-- the frozen column list, and is here because every target row carries the params it was computed with.
-- `user_id` has no default, because no client inserts. `program_id` and `expenditure_snapshot_id` are set
-- null on delete, so a deleted program or snapshot leaves the target history readable.
create table public.targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  program_id uuid references public.programs (id) on delete set null,
  expenditure_snapshot_id uuid references public.expenditure_snapshots (id) on delete set null,
  effective_from date not null,
  effective_to date,
  calories_kcal integer not null,
  protein_g numeric not null,
  fat_g numeric not null,
  carbs_g numeric not null,
  dow_calories_kcal integer[] not null,
  basis jsonb not null,
  engine_version text not null,
  params jsonb not null,
  created_at timestamptz not null default now(),

  -- A check passes on null. The bound may equal `effective_from`, which is the empty interval of a
  -- replacement on the same day.
  constraint targets_effective_to_check check (effective_to >= effective_from),

  -- The range of `profiles_target_kcal_range` (Amendment 4).
  constraint targets_calories_kcal_check check (calories_kcal between 800 and 6000),

  constraint targets_protein_g_check check (protein_g >= 0),
  constraint targets_fat_g_check check (fat_g >= 0),
  constraint targets_carbs_g_check check (carbs_g >= 0),

  -- `integer[]` and not the frozen `int[7]`, because Postgres ignores a declared array size. The array
  -- must be one dimensional and start at index 1, as for `programs.dow_offsets_kcal`, so that
  -- `dow_calories_kcal[1]` is always the first day. The days are not checked one by one, because the
  -- engine builds them. An empty array has no dimension, and its length of 0 still fails the check.
  constraint targets_dow_calories_kcal_check check (
    array_ndims(dow_calories_kcal) = 1
    and array_lower(dow_calories_kcal, 1) = 1
    and cardinality(dow_calories_kcal) = 7
  )
);

-- One current target per user. The index is partial, so it does not serve the cascade from `auth.users`,
-- which looks up every row of the user. The list index below does.
create unique index targets_one_current_per_user on public.targets (user_id) where effective_to is null;

-- For the targets history and for the cascade from `auth.users`.
create index targets_user_id_effective_from_idx on public.targets (user_id, effective_from desc);

-- So that deleting a program or a snapshot does not scan the table to set the column null.
create index targets_program_id_idx on public.targets (program_id);
create index targets_expenditure_snapshot_id_idx on public.targets (expenditure_snapshot_id);

alter table public.expenditure_snapshots enable row level security;
alter table public.targets enable row level security;

-- Set the table privileges explicitly so nothing relies on the default ones (see 0001_init.sql).
-- Start from a clean slate, then grant back only what is needed. A client can read and never write, so
-- it cannot write a snapshot, a target or its `params`. The anon role keeps nothing. The service role
-- reads, and writes only through the functions of a later migration.
revoke all on public.expenditure_snapshots from anon, authenticated, service_role;
revoke all on public.targets from anon, authenticated, service_role;

grant select on public.expenditure_snapshots to authenticated;
grant select on public.targets to authenticated;
grant select on public.expenditure_snapshots to service_role;
grant select on public.targets to service_role;

-- Owner only. Terms acceptance is not in these policies (Amendment 9, "Privileges and row level
-- security").
create policy "expenditure_snapshots_select_own" on public.expenditure_snapshots
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "targets_select_own" on public.targets
  for select to authenticated
  using (user_id = (select auth.uid()));

-- The check-in weekday is ISO 1 (Monday) to 7 (Sunday). Zee ruled on 2026-10-23 that the migration must
-- deploy safely whatever production holds, with no manual check and no raise (Amendment 13). The wizard
-- never writes the column, so no value is expected, and a value outside 1 to 7 becomes null. The notice
-- carries the count and never a value.
do $$
declare
  stray_count bigint;
begin
  update public.profiles set checkin_weekday = null
    where checkin_weekday is not null and checkin_weekday not between 1 and 7;
  get diagnostics stray_count = row_count;
  raise notice 'profiles.checkin_weekday: % value(s) outside 1 to 7 were set to null', stray_count;
end;
$$;

-- A check passes on null, so a profile with no weekday is valid. The grants on `profiles` are unchanged.
alter table public.profiles
  add constraint profiles_checkin_weekday_check check (checkin_weekday between 1 and 7);
