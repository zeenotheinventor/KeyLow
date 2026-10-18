-- weigh_ins: the `weigh_in_source` enum and the `weigh_ins` table (KEY-360). Everything here is set
-- out in docs/adr/0003-data-model.md, Amendment 9, which wins over any other description. The bounds
-- are the table in its "The numbers".
--
-- This is a health data table. Nothing here logs a row value or raises a notice with one. A check
-- constraint failure can quote the failing row in PostgreSQL's own error log, which no client can
-- prevent (Amendment 9, "Health data"), so core checks a weight, a note and a sample id before they
-- are sent.
--
-- The migration is additive. It creates a new type and a new table and changes nothing that exists.

-- The frozen values, in the style of Amendment 1's enums. M5 writes only `manual` and
-- `health_connect`. `healthkit` stays so that a later HealthKit implementation needs no migration,
-- and `import` is for a future file import.
create type public.weigh_in_source as enum ('manual', 'healthkit', 'health_connect', 'import');

-- A weigh-in belongs to its owner and is soft deleted, never deleted. `measured_at` and `source`
-- have no default, because the client always sends them (`local_date` and `tz` depend on the
-- instant, and the source says where the reading came from). The column rounds the weight to 3
-- decimals, half away from zero, and the range check applies to the rounded value, so 19.9996 is
-- stored as 20.000 and passes, and 19.9994 is stored as 19.999 and fails. A value of 1000 or more
-- cannot be stored in `numeric(6,3)` and fails with SQLSTATE 22003 before the check runs.
-- Amendment 1 gives the table its `id` and `created_at`. `tz` is not validated, and nothing checks
-- that `measured_at`, `local_date` and `tz` agree (Amendment 9, "`local_date` and `tz`").
create table public.weigh_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  measured_at timestamptz not null,
  local_date date not null,
  tz text not null,
  weight_kg numeric(6, 3) not null,
  source public.weigh_in_source not null,
  external_id text,
  note text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),

  constraint weigh_ins_weight_kg_check check (weight_kg between 20 and 400),

  -- Null, or 1 to 200 characters. The database does not trim, so a note of spaces is stored.
  constraint weigh_ins_note_length_check check (note is null or pg_catalog.char_length(note) between 1 and 200),

  -- A check passes when its expression is null, and `char_length(null)` is null. Each branch that
  -- requires an id therefore says `external_id is not null` itself and does not rely on the length
  -- test alone. A manual row has no id, a Health row has one of 1 to 200 characters, and an
  -- import row may have either.
  constraint weigh_ins_external_id_pairing_check check (
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
  -- source, external_id)` can be inferred from the column list alone, which PostgREST sends. A
  -- partial index would fail with 42P10 there (Amendment 9, "The import key outlives a delete").
  -- Nulls are distinct in a unique constraint, so any number of manual rows never conflict.
  constraint weigh_ins_import_key unique (user_id, source, external_id)
);

-- The list (newest first), the trend (the whole history of the caller, in date order) and the chart
-- ranges (a `local_date` window) all read this. Ties are broken by `id` in the read and not in the
-- index. Both indexes lead with `user_id`, so the cascade from `auth.users` has an index on the
-- referencing column.
create index weigh_ins_list_idx on public.weigh_ins (user_id, local_date desc, measured_at desc);

alter table public.weigh_ins enable row level security;

-- Set the table privileges explicitly so nothing relies on the default ones (see 0001_init.sql).
-- Start from a clean slate, then grant back only what the clients use. The anon role keeps nothing.
-- The service role keeps nothing either, because nothing server side reads or writes weigh-ins yet
-- (M6's run-checkin and M7's export grant what they need in their own migrations).
revoke all on public.weigh_ins from anon, authenticated, service_role;

-- `id`, `created_at` and `deleted_at` are never written on insert, so a new weigh-in has the
-- database's id and starts live. `user_id`, `source` and `external_id` are insert only, so a row
-- never changes owner, source or key. There is no delete grant: a weigh-in is soft deleted by
-- setting `deleted_at`, and clearing it restores the row. Account deletion cascades regardless,
-- because a foreign key action does not run as the caller.
grant select on public.weigh_ins to authenticated;

grant insert (user_id, measured_at, local_date, tz, weight_kg, source, external_id, note)
  on public.weigh_ins to authenticated;

grant update (measured_at, local_date, tz, weight_kg, note, deleted_at)
  on public.weigh_ins to authenticated;

-- Owner only. The select policy does not filter `deleted_at`: the clients do. Terms acceptance is
-- not in these policies (Amendment 9, "Privileges and row level security"). There is no delete
-- policy, because there is no delete grant.
create policy "weigh_ins_select_own" on public.weigh_ins
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "weigh_ins_insert_own" on public.weigh_ins
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "weigh_ins_update_own" on public.weigh_ins
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
