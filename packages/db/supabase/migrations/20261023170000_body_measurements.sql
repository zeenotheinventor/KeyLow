-- body_measurements: the `body_measurement_kind` enum and the `body_measurements` table (KEY-569).
-- Everything here is set out in docs/adr/0003-data-model.md, Amendment 11, which wins over any other
-- description. The bounds are the table in its "The numbers".
--
-- This is a health data table. Nothing here logs a row value or raises a notice with one. A check
-- constraint failure can quote the failing row in PostgreSQL's own error log, which no client can
-- prevent (Amendment 11, "Health data"), so core checks a value and a sample id before they are sent.
--
-- The migration is additive. It creates a new type and a new table and changes nothing that exists.
-- It reuses `public.weigh_in_source` for `source` (Amendment 11, "The kind enum and the source enum").

-- The two readings Health Connect delivers as records of their own (`BodyFat` and `LeanBodyMass`).
-- The order is part of the contract. A later kind (bone mass, body water) is another value here and
-- needs no new table.
create type public.body_measurement_kind as enum ('body_fat_pct', 'lean_mass_kg');

-- A body measurement belongs to its owner and is soft deleted, never deleted. `kind`, `measured_at`
-- and `source` have no default, because the client always sends them (`local_date` and `tz` depend on
-- the instant, and the source says where the reading came from). The column rounds the value to 3
-- decimals, half away from zero, and the range check applies to the rounded value, so 0.9996 is stored
-- as 1.000 and passes as body fat, and 0.9994 is stored as 0.999 and fails. A value of 1000 or more
-- cannot be stored in `numeric(6,3)` and fails with SQLSTATE 22003 before the check runs.
-- Amendment 1 gives the table its `id` and `created_at`. `tz` is not validated, and nothing checks
-- that `measured_at`, `local_date` and `tz` agree (Amendment 9, "`local_date` and `tz`").
create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind public.body_measurement_kind not null,
  measured_at timestamptz not null,
  local_date date not null,
  tz text not null,
  value numeric(6, 3) not null,
  source public.weigh_in_source not null,
  external_id text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),

  -- One check for both kinds, so the two ranges cannot drift apart. Body fat is in percentage
  -- points and lean mass in kilograms. Core skips a reading outside these before it is sent.
  constraint body_measurements_value_check check (
    (kind = 'body_fat_pct' and value between 1 and 75)
    or (kind = 'lean_mass_kg' and value between 10 and 300)
  ),

  -- A check passes when its expression is null, and `char_length(null)` is null. Each branch that
  -- requires an id therefore says `external_id is not null` itself and does not rely on the length
  -- test alone. A manual row has no id, a Health row has one of 1 to 200 characters, and an
  -- import row may have either.
  constraint body_measurements_external_id_pairing_check check (
    (source = 'manual' and external_id is null)
    or (
      source in ('healthkit', 'health_connect')
      and external_id is not null
      and pg_catalog.char_length(external_id) between 1 and 200
    )
    or (
      source = 'import'
      and (external_id is null or pg_catalog.char_length(external_id) between 1 and 200)
    )
  ),

  -- The import key is a plain constraint on purpose, and covers every row, soft-deleted ones
  -- included. A deleted import then cannot come back at the next import, and `on conflict (user_id,
  -- kind, source, external_id)` can be inferred from the column list alone, which PostgREST sends. A
  -- partial index would fail with 42P10 there (Amendment 9, "The import key outlives a delete").
  -- `kind` is in the key so that a sample id shared by two record types never drops a reading.
  -- Nulls are distinct in a unique constraint, so any number of manual rows never conflict.
  constraint body_measurements_import_key unique (user_id, kind, source, external_id)
);

-- The list of one kind (newest first), the trend over a kind's whole history (in date order) and the
-- range windows (a `local_date` window of one kind) all read this. Ties are broken by `id` in the read
-- and not in the index. Both indexes lead with `user_id`, so the cascade from `auth.users` has an
-- index on the referencing column.
create index body_measurements_list_idx
  on public.body_measurements (user_id, kind, local_date desc, measured_at desc);

alter table public.body_measurements enable row level security;

-- Set the table privileges explicitly so nothing relies on the default ones (see 0001_init.sql).
-- Start from a clean slate, then grant back only what the clients use. The anon role keeps nothing.
-- The service role keeps nothing either, because nothing server side reads or writes body
-- measurements yet (the M7 export grants what it needs in its own migration).
revoke all on public.body_measurements from anon, authenticated, service_role;

-- The rows are imported, so no column but `deleted_at` is ever changed after the insert. `id`,
-- `created_at` and `deleted_at` are never written on insert, so a new reading has the database's id
-- and starts live. There is no delete grant: a reading is soft deleted by setting `deleted_at`, and
-- clearing it restores the row. The update grant is there so that a later "remove this reading"
-- screen needs no migration. Account deletion cascades regardless, because a foreign key action does
-- not run as the caller.
grant select on public.body_measurements to authenticated;

grant insert (user_id, kind, measured_at, local_date, tz, value, source, external_id)
  on public.body_measurements to authenticated;

grant update (deleted_at) on public.body_measurements to authenticated;

-- Owner only. The select policy does not filter `deleted_at`: the clients do. Terms acceptance is
-- not in these policies (Amendment 9, "Privileges and row level security"). There is no delete
-- policy, because there is no delete grant.
create policy "body_measurements_select_own" on public.body_measurements
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "body_measurements_insert_own" on public.body_measurements
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "body_measurements_update_own" on public.body_measurements
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
