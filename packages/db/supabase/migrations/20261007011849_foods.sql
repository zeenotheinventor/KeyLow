-- foods: the food catalogue (CoFID, Open Food Facts and user-created foods),
-- its portions, and the two service-only provenance tables.
-- Column lists frozen in docs/adr/0003-data-model.md and filled in by its
-- Amendment 1 (M2). Every statement below follows that text.

create type public.food_source as enum ('off', 'cofid', 'user');
create type public.nutrient_basis as enum ('per_100g', 'per_100ml');

-- Created before food_source_data, which references it. Never visible to
-- the API roles, only the import scripts (service role) write it.
create table public.import_runs (
  id uuid primary key default gen_random_uuid(),
  source public.food_source not null,
  label text not null,
  file_sha256 text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  row_count integer,
  created_at timestamptz not null default now(),
  -- An import run describes a bulk source, and user foods are never imported.
  constraint import_runs_source_not_user check (source <> 'user')
);

-- Global rows (cofid, off) have a null owner_id and are written only by the
-- service role. User rows belong to one auth user. Missing nutrient data is
-- null, never 0.
create table public.foods (
  id uuid primary key default gen_random_uuid(),
  source public.food_source not null,
  source_ref text,
  owner_id uuid references auth.users (id) on delete cascade,
  name text not null,
  brand text,
  -- Digits only. Canonical form and check digits are enforced by the
  -- application, so the lengths here are deliberately wider than canonical.
  barcode text constraint foods_barcode_check check (barcode ~ '^[0-9]{8,14}$'),
  basis public.nutrient_basis not null,
  density_g_per_ml numeric constraint foods_density_g_per_ml_check check (density_g_per_ml > 0),
  kcal numeric constraint foods_kcal_check check (kcal >= 0),
  protein_g numeric constraint foods_protein_g_check check (protein_g >= 0),
  fat_g numeric constraint foods_fat_g_check check (fat_g >= 0),
  sat_fat_g numeric constraint foods_sat_fat_g_check check (sat_fat_g >= 0),
  carbs_g numeric constraint foods_carbs_g_check check (carbs_g >= 0),
  sugars_g numeric constraint foods_sugars_g_check check (sugars_g >= 0),
  fibre_g numeric constraint foods_fibre_g_check check (fibre_g >= 0),
  salt_g numeric constraint foods_salt_g_check check (salt_g >= 0),
  micros jsonb not null default '{}',
  quality jsonb not null default '{}',
  food_group text,
  fetched_at timestamptz,
  search tsvector generated always as (
    setweight(to_tsvector('english', coalesce(name, '')), 'A')
    || setweight(to_tsvector('english', coalesce(brand, '')), 'B')
  ) stored,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  -- The frozen rule: only user rows have an owner.
  constraint foods_owner_matches_source check ((source = 'user') = (owner_id is not null)),
  -- User rows never have a source_ref, which keeps them out of the unique
  -- constraint below (nulls are distinct), and every other row must have one.
  constraint foods_source_ref_matches_source check ((source = 'user') = (source_ref is null)),
  -- Every OFF row records when it was fetched, and no other row does.
  constraint foods_fetched_at_matches_source check ((source = 'off') = (fetched_at is not null)),
  -- A plain constraint, not a partial index, so PostgREST upsert can target
  -- it with onConflict: 'source,source_ref'.
  unique (source, source_ref)
);

create table public.food_portions (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.foods (id) on delete cascade,
  -- A copy of the parent food's owner_id so the policies can read it without
  -- a join. The join in food_portions_write_own keeps the two equal.
  owner_id uuid references auth.users (id) on delete cascade,
  label text not null,
  grams numeric constraint food_portions_grams_check check (grams > 0),
  ml numeric constraint food_portions_ml_check check (ml > 0),
  is_default boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  constraint food_portions_exactly_one_of_grams_ml check (num_nonnulls(grams, ml) = 1)
);

-- One row per food. import_run_id is null for OFF payloads, which have no run.
create table public.food_source_data (
  food_id uuid primary key references public.foods (id) on delete cascade,
  import_run_id uuid references public.import_runs (id),
  raw jsonb not null,
  created_at timestamptz not null default now()
);

create index foods_search_idx on public.foods using gin (search);
create index foods_name_trgm_idx on public.foods using gin (name extensions.gin_trgm_ops);
create index foods_barcode_idx on public.foods (barcode)
  where barcode is not null and deleted_at is null;
create index foods_owner_id_idx on public.foods (owner_id) where owner_id is not null;

create index food_portions_food_id_idx on public.food_portions (food_id);
-- At most one default portion per food.
create unique index food_portions_one_default_per_food_idx on public.food_portions (food_id)
  where is_default;

alter table public.foods enable row level security;
alter table public.food_portions enable row level security;
alter table public.food_source_data enable row level security;
alter table public.import_runs enable row level security;

-- Set the table privileges explicitly so nothing relies on the default ones
-- (see 0001_init.sql). Start from a clean slate on every table, then grant
-- back only what the policies below narrow further. The anon role keeps
-- nothing.
revoke all on public.foods, public.food_portions, public.food_source_data, public.import_runs
  from anon, authenticated;

-- Row visibility comes from RLS, so every column is readable, including
-- quality, source_ref and fetched_at.
grant select on public.foods to authenticated;

-- Column-scoped writes. source_ref, quality, fetched_at, id, search and
-- created_at stay with the service role. owner_id and source can be set on
-- insert but never changed afterwards. There is no delete grant: a custom
-- food is removed by setting deleted_at, so log entries can keep pointing
-- at it.
grant insert (
  name, brand, barcode, basis, density_g_per_ml,
  kcal, protein_g, fat_g, sat_fat_g, carbs_g, sugars_g, fibre_g, salt_g,
  micros, food_group, deleted_at, owner_id, source
) on public.foods to authenticated;

grant update (
  name, brand, barcode, basis, density_g_per_ml,
  kcal, protein_g, fat_g, sat_fat_g, carbs_g, sugars_g, fibre_g, salt_g,
  micros, food_group, deleted_at
) on public.foods to authenticated;

-- Portions have no deleted_at, and editing a food replaces its portions by
-- deleting the user's own and inserting the new ones, so delete is granted.
-- RLS limits all three writes to the owner's rows.
grant select, insert, update, delete on public.food_portions to authenticated;

-- food_source_data and import_runs get nothing for anon or authenticated.
-- With RLS on and no policies they are service role only.

-- The CLI default ACL grants the API roles no DML on tables created by a
-- migration, so the service role's access is set explicitly here too.
grant select, insert, update, delete
  on public.foods, public.food_portions, public.food_source_data, public.import_runs
  to service_role;

-- Everyone signed in sees the global catalogue and their own foods. Soft
-- deleted rows stay visible, the search function and the clients filter on
-- deleted_at. `(select auth.uid())` is evaluated once per statement instead
-- of once per row.
create policy "foods_select" on public.foods
  for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));

create policy "foods_insert_own" on public.foods
  for insert to authenticated
  with check (source = 'user' and owner_id = (select auth.uid()));

create policy "foods_update_own" on public.foods
  for update to authenticated
  using (source = 'user' and owner_id = (select auth.uid()))
  with check (source = 'user' and owner_id = (select auth.uid()));

create policy "food_portions_select" on public.food_portions
  for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));

-- One policy for insert, update and delete. The join to foods proves the
-- parent is the caller's own user food, so a portion cannot be attached to
-- someone else's food or to a global one, and owner_id cannot disagree
-- with its parent.
create policy "food_portions_write_own" on public.food_portions
  for all to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.foods f
      where f.id = food_id and f.owner_id = (select auth.uid()) and f.source = 'user'
    )
  )
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.foods f
      where f.id = food_id and f.owner_id = (select auth.uid()) and f.source = 'user'
    )
  );
