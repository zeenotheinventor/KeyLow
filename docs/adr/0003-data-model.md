# 0003: Data model (Supabase Postgres)

## Status

Accepted, 2026-09-22. Amendment 1 appended 2026-10-07. Amendment 2 appended 2026-10-15. Amendment 3 appended 2026-10-15. Amendment 4 appended 2026-10-15.

## Context

M2 onward builds a Postgres schema whose shape (tables, columns, the `day_totals` view, RLS, and the CoFID/OFF field mappings) needs to be fixed before those milestones start. Per the M1 Foundations brief (KEY-1), M1 implements only `profiles`. Its migration 0001 scope is `profiles` plus `handle_new_user`, and its Out of scope section excludes any domain schema beyond `profiles` until M2 onward. Freezing the column lists here, verbatim from the Build Plan & Engineering Context document's Data model section, lets a reviewer diff a migration against this ADR instead of the source document.

## Decision

The following, transcribed verbatim from the document's Data model (Supabase Postgres) section, is frozen:

- `profiles` (id -> auth.users, sex, birth_date, height_cm, activity, weight_unit, energy_unit, timezone, checkin_weekday, onboarding_weight_kg, onboarding_completed_at)
- `weigh_ins` (user_id, measured_at, local_date, tz, weight_kg 20..400, source manual|healthkit|health_connect|import, external_id, note, deleted_at); unique `(user_id, source, external_id)` where not null
- `foods` (source off|cofid|user, source_ref, owner_id null for global, name, brand, barcode digits-only, basis per_100g|per_100ml, density_g_per_ml, kcal, protein_g, fat_g, sat_fat_g, carbs_g EU-style, sugars_g, fibre_g, salt_g, micros jsonb, quality jsonb {kcal_derived, suspect, fields_missing}, food_group, fetched_at, search tsvector, deleted_at); unique `(source, source_ref)` for non-user rows; gin on search and `name gin_trgm_ops`; check `(source='user') = (owner_id is not null)`
- `food_portions` (food_id, owner_id denormalised for RLS, label, grams or ml, is_default, position)
- `food_source_data` (food_id, import_run_id, raw jsonb) and `import_runs` (source, label, file_sha256, started/finished, row_count): service role only
- `recipes` (owner_id, name, servings > 0, yield_grams nullable, notes, computed jsonb cache, is_archived)
- `recipe_ingredients` (recipe_id, owner_id, position, food_id, quantity, unit, portion_id, resolved_grams, snapshot jsonb); sub-recipes deferred
- `food_log_entries` (user_id, local_date, meal_slot breakfast|lunch|dinner|snack, logged_at, item_type food|recipe|quick, food_id, recipe_id, quantity, unit, portion_id, resolved_grams, snapshot jsonb, nutrients jsonb, kcal generated, deleted_at); indexes on `(user_id, local_date)`, `(user_id, logged_at desc)`, `(user_id, food_id)`
- `day_logs` (user_id, local_date, is_complete, completed_at, note), PK `(user_id, local_date)`
- `programs` (user_id, goal, rate_pct_per_week, protein_g_per_kg, fat_fraction_of_remaining, split_preset, dow_offsets_kcal int[7], goal_weight_kg, started_on, ended_on, next_checkin_date); one active per user
- `expenditure_snapshots` (user_id, as_of_date, mu_kcal, var_kcal2, measurement jsonb, trend_weight_kg, engine_version, params jsonb); unique `(user_id, as_of_date)`
- `targets` (user_id, program_id, expenditure_snapshot_id, effective_from, effective_to null = current, calories_kcal, protein_g, fat_g, carbs_g, dow_calories_kcal int[7], basis jsonb, engine_version); one current per user
- view `day_totals` (security_invoker) summing entry `nutrients` per user per day

RLS: owner-only on every user table using `(select auth.uid())`; `foods` and `food_portions` readable where `owner_id is null or owner_id = uid`, writable only for `source='user'` own rows; global rows written only by the service role (CoFID import, `off-product`). pgTAP asserts every policy.

CoFID mapping: per 100 g edible portion; energy from the kcal column; `salt_g = sodium_mg × 2.5 / 1000`; fibre AOAC where present else Englyst with `quality.fibre_method`; "Tr" -> 0 with `quality.trace_fields`, "N" -> null; everything else into `micros`; full source row into `food_source_data.raw`. CoFID has no portion sizes, so a hand-curated `food_portions` seed for common generic foods is a Housekeeping item.

OFF mapping: prefer `energy-kcal_100g`, else kJ / 4.184, else derive `4P + 9F + 4C + 2·fibre` with `quality.kcal_derived`; per-serving-only data converted via `serving_quantity` or flagged; liquids get `per_100ml`; products missing any of the four macros are stored `quality.suspect` and must be confirmed before first log; US-labelled carbs (fibre included) need a country-of-sale heuristic and a UI note.

## Consequences

- Per the M1 Foundations brief (KEY-1), M1 implements only `profiles`. Every other table, the `day_totals` view, RLS, and the CoFID/OFF mappings above are a forward contract: M2 onward migrations match these column lists exactly, they do not redesign them.
- Any change to a frozen column list, the RLS rule, or a mapping paragraph is a schema decision and needs a new ADR or an explicit amendment to this one before the migration that implements it lands.
- pgTAP is expected to assert every RLS policy named above, per the source document's testing conventions.

## Amendment 1 (M2, 2026-10-07)

### Status

Recorded on 2026-10-07 by the M2 planning session. Implements decisions Q7 to Q10 on KEY-2 (Zee, 2026-10-07). The remaining details (among them the barcode rules, the `carbs_convention` semantics, the `micros` default, the `fetched_at` check, the fixed-uuid seed rule and the `delete` grant on portions) are interpretations made for implementation. Zee confirms them by approving the PR that carries this amendment. The frozen Decision text above is unchanged. This amendment fills in details the frozen text leaves open and overrides nothing in it. It also admits one new table, `rate_limits`.

### Surrogate and audit columns

Every new table carries these two columns, with these exact definitions:

- `id uuid primary key default gen_random_uuid()`
- `created_at timestamptz not null default now()`

There are two exceptions:

- `food_source_data` is keyed by `food_id` and has no `id`.
- `rate_limits` has the composite primary key `(bucket, window_start)` and has neither `id` nor `created_at`.

There is no `updated_at` on any table, matching `profiles`.

### Enums

- `food_source ('off', 'cofid', 'user')`
- `nutrient_basis ('per_100g', 'per_100ml')`

### `foods` columns

| Column                                                                                | Definition                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kcal`, `protein_g`, `fat_g`, `sat_fat_g`, `carbs_g`, `sugars_g`, `fibre_g`, `salt_g` | Nullable `numeric`, each with a `>= 0` check. Missing data is null, never 0.                                                                                                                                                                                                                            |
| `name`                                                                                | `text not null`.                                                                                                                                                                                                                                                                                        |
| `brand`                                                                               | `text`, nullable.                                                                                                                                                                                                                                                                                       |
| `barcode`                                                                             | `text`, nullable, with check `barcode ~ '^[0-9]{8,14}$'`. Stored in canonical form (see below).                                                                                                                                                                                                         |
| `basis`                                                                               | `nutrient_basis not null`.                                                                                                                                                                                                                                                                              |
| `density_g_per_ml`                                                                    | `numeric`, nullable, `> 0` when present.                                                                                                                                                                                                                                                                |
| `micros`                                                                              | `jsonb not null default '{}'`. An empty object means none recorded.                                                                                                                                                                                                                                     |
| `quality`                                                                             | `jsonb not null default '{}'`. Semantics are in the `quality` section below.                                                                                                                                                                                                                            |
| `food_group`                                                                          | `text`, nullable.                                                                                                                                                                                                                                                                                       |
| `fetched_at`                                                                          | `timestamptz`, nullable, with check `((source = 'off') = (fetched_at is not null))`. Every OFF row has it and no other row does.                                                                                                                                                                        |
| `search`                                                                              | `tsvector generated always as (setweight(to_tsvector('english', coalesce(name, '')), 'A') \|\| setweight(to_tsvector('english', coalesce(brand, '')), 'B')) stored`.                                                                                                                                    |
| `deleted_at`                                                                          | `timestamptz`, nullable.                                                                                                                                                                                                                                                                                |
| `owner_id`                                                                            | `uuid references auth.users (id) on delete cascade`, nullable, with no default. Null exactly when the row is global (`source` is `cofid` or `off`), which is the frozen check `(source = 'user') = (owner_id is not null)`. The client sends `auth.uid()` and the RLS with-check rejects anything else. |
| `source`                                                                              | `food_source not null`.                                                                                                                                                                                                                                                                                 |
| `source_ref`                                                                          | `text`, nullable. See the uniqueness section.                                                                                                                                                                                                                                                           |

Indexes on `foods`:

- `unique (source, source_ref)` (the constraint described below).
- `gin (search)`.
- `gin (name extensions.gin_trgm_ops)` (`pg_trgm` lives in the `extensions` schema).
- Partial `(barcode) where barcode is not null and deleted_at is null`.
- Partial `(owner_id) where owner_id is not null`.

### Barcode canonical form

Decision Q8 fixes the canonical form: digits only, UPC-A zero-padded to 13, UPC-E expanded to its UPC-A form and then padded, EAN-8 kept at 8, check digit validated by the application before storage. The following rules make that implementable. The 8-digit disambiguation and the GTIN-14 handling are an interpretation of decision Q8 by the planning session, 2026-10-07, and are additions for Zee to confirm.

`normaliseBarcode(raw, symbology?)` strips spaces and hyphens and accepts an optional symbology hint (the camera reports one, manual entry has none). Then, by digit count:

- 13 digits: EAN-13. The check digit is validated and the code is kept.
- 12 digits: UPC-A. The check digit is validated and the code is zero-padded to 13.
- 8 digits: with a hint, the hint decides and there is no fallback to the other reading (EAN-8 is validated as a GTIN-8 and kept at 8, UPC-E is expanded to UPC-A, validated and padded to 13). The hint only matters at 8 digits and is ignored for 12, 13 and 14. Its vocabulary is the camera's symbology names, fixed by KEY-37. Without a hint, the code is treated as EAN-8 when the GTIN-8 check digit validates. Otherwise it is treated as UPC-E when the first digit is 0 or 1 and its expansion to UPC-A has a valid check digit (then padded to 13). Otherwise it is invalid.
- 14 digits: a GTIN-14 whose indicator digit is 0 is the same product as its 13-digit EAN, so its check digit is validated, the leading 0 is stripped and 13 digits are stored. Any other indicator digit is kept at 14 digits with its check digit validated.
- Anything else is invalid and is never looked up.

The database check `^[0-9]{8,14}$` is deliberately wider than the set of canonical lengths (8, 13 and 14). Canonical form and check digits are enforced by the application.

### Uniqueness of `(source, source_ref)`

The frozen "unique `(source, source_ref)` for non-user rows" is implemented as a plain `unique (source, source_ref)` constraint plus `check ((source = 'user') = (source_ref is null))`. Nulls are distinct in a unique constraint, so user rows (which always have a null `source_ref`) never collide. PostgREST `upsert(..., { onConflict: 'source,source_ref' })` can target a plain constraint but cannot target a partial unique index. A consequence is that non-user rows must carry a non-null `source_ref`.

### Privileges and RLS

Baseline for every one of the five tables (`foods`, `food_portions`, `food_source_data`, `import_runs`, `rate_limits`): `revoke all on <table> from anon, authenticated` comes first, then grants. `anon` gets nothing on any of the five tables.

`foods`:

- `authenticated` gets `select` on all columns, including `quality`, `source_ref` and `fetched_at`. RLS, not column grants, limits which rows are visible.
- `authenticated` gets column-scoped `insert` and `update` on exactly these columns: `name`, `brand`, `barcode`, `basis`, `density_g_per_ml`, `kcal`, `protein_g`, `fat_g`, `sat_fat_g`, `carbs_g`, `sugars_g`, `fibre_g`, `salt_g`, `micros`, `food_group`, `deleted_at`. Insert additionally gets `owner_id` and `source`.
- Not granted for write: `id`, `source_ref`, `quality`, `fetched_at`, `search`, `created_at`, and (on update) `owner_id` and `source`.
- `authenticated` is never granted `delete` on `foods` (decision Q10). Removing a custom food sets `deleted_at`.

`food_portions`:

- `authenticated` gets `select` on all columns and `insert`, `update` and `delete` on all columns.
- Decision Q10 is about `foods`: a custom food is removed with `deleted_at` so log entries can keep pointing at it. Portions are child rows with no `deleted_at`. The plan's KEY-36 and KEY-45 tickets (approved 2026-10-07) replace a food's portions by deleting the user's own portions and then inserting the new ones, so `delete` on portions is granted and RLS limits it to own rows.

`food_source_data` and `import_runs`: no privileges for `anon` or `authenticated`. RLS is enabled with no policies.

`rate_limits`: RLS is enabled with no policies. The revoke also covers `service_role`. The function is `security definer`, so `service_role` needs no DML on the table, and the CLI default ACL would otherwise leave it `TRUNCATE`, `REFERENCES` and `TRIGGER`.

`service_role` gets explicit `select`, `insert`, `update` and `delete` on `foods`, `food_portions`, `food_source_data` and `import_runs`. The Supabase CLI default ACL grants the API roles no DML on tables created by a migration, and the privileges are set explicitly so nothing relies on a changing default (the same approach as `0001_init.sql`).

Policies, as predicates (RLS is enabled on all five tables):

- `foods_select`: using `owner_id is null or owner_id = (select auth.uid())`.
- `foods_insert_own`: with check `source = 'user' and owner_id = (select auth.uid())`.
- `foods_update_own`: using and with check `source = 'user' and owner_id = (select auth.uid())`.
- `food_portions_select`: using `owner_id is null or owner_id = (select auth.uid())`.
- `food_portions_write_own`: one `for all` policy (or three, with `using` omitted on insert) whose using and with check are `owner_id = (select auth.uid()) and exists (select 1 from public.foods f where f.id = food_id and f.owner_id = (select auth.uid()) and f.source = 'user')`.

Soft-deleted rows stay selectable through RLS. Filtering on `deleted_at` is done by `search_foods` and the clients, not by policy.

### `food_portions`

| Column       | Definition                                                                                                                                                                                                                                            |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `food_id`    | `uuid not null references foods (id) on delete cascade`.                                                                                                                                                                                              |
| `owner_id`   | `uuid references auth.users (id) on delete cascade`, nullable. A denormalised copy of the parent food's `owner_id`, null exactly when the parent is global. Supplied by the writer (the client for user foods, the service role for global portions). |
| `label`      | `text not null`.                                                                                                                                                                                                                                      |
| `grams`      | `numeric`, nullable, `> 0` when present.                                                                                                                                                                                                              |
| `ml`         | `numeric`, nullable, `> 0` when present.                                                                                                                                                                                                              |
| `is_default` | `boolean not null default false`.                                                                                                                                                                                                                     |
| `position`   | `integer not null default 0`.                                                                                                                                                                                                                         |

- `check (num_nonnulls(grams, ml) = 1)`: exactly one of `grams` and `ml` is set.
- A partial unique index on `(food_id) where is_default` allows at most one default portion per food.
- A plain index on `(food_id)`.
- Invariant: a portion's `owner_id` equals its parent food's `owner_id`. The join to `foods` in the `food_portions_write_own` policy is what enforces the equality.

### `food_source_data`

- `food_id uuid primary key references foods (id) on delete cascade`: one row per food.
- `import_run_id uuid references import_runs (id)`, nullable, because OFF raw payloads have no import run.
- `raw jsonb not null`.

### `import_runs`

- `source food_source not null check (source <> 'user')`.
- `label text not null`.
- `file_sha256 text`, nullable.
- `started_at timestamptz not null default now()`.
- `finished_at timestamptz`, nullable.
- `row_count integer`, nullable.

### `foods.quality` key set

| Key                     | Type                    | Origin                  |
| ----------------------- | ----------------------- | ----------------------- |
| `kcal_derived`          | boolean                 | Frozen list             |
| `suspect`               | boolean                 | Frozen list             |
| `fields_missing`        | text array              | Frozen list             |
| `fibre_method`          | `'aoac'` or `'englyst'` | CoFID mapping paragraph |
| `trace_fields`          | text array              | CoFID mapping paragraph |
| `per_serving_converted` | boolean                 | OFF mapping paragraph   |
| `carbs_convention`      | `'eu'` or `'us_total'`  | OFF mapping paragraph   |

The zod schema in `@keylow/core` is the source of truth for this key set and its types.

Semantics:

- Keys are optional. An absent boolean reads as false and an absent array reads as empty, so `'{}'` is the neutral value.
- `carbs_convention` describes the stored `carbs_g`. It is `'eu'` by default, including after a successful conversion from a US label by subtracting fibre. It is `'us_total'` only when the source label was US-style and fibre was missing, so the value could not be converted. In that case `suspect` is also true and `fields_missing` includes `fibre_g`.
- A CoFID "Tr" is a recorded 0 listed in `quality.trace_fields`, not missing data. So "missing is null, never 0" and "Tr to 0" both hold.

### `rate_limits` and `consume_rate_limit()`

New table `public.rate_limits`:

- `bucket text not null`.
- `window_start timestamptz not null`.
- `hits integer not null default 0`.
- `primary key (bucket, window_start)`.
- RLS is enabled with no policies, and all privileges are revoked from `anon`, `authenticated` and `service_role` (see the privileges section).

Bucket names are `off-search:user:<uuid>`, `off-search:global`, `off-product:user:<uuid>` and `off-product:global`. The Edge Function derives the per-user bucket from the verified caller, never from the request body.

New function `public.consume_rate_limit(p_bucket text, p_max integer, p_window_seconds integer)`:

- Returns `table (allowed boolean, retry_after_seconds integer)`.
- `language plpgsql volatile`, `security definer`, with `set search_path = ''`.
- Upsert-increments `hits` for the current window, where `window_start` is the `date_bin` bucket of `now()` for `p_window_seconds`, anchored at the epoch.
- Deletes that bucket's expired windows in the same call.
- Returns `allowed = hits <= p_max`.
- `retry_after_seconds` is the whole seconds left in the current window, rounded up, so it is between 1 and `p_window_seconds` whether the call was allowed or refused.
- `execute` is revoked from `public`, `anon` and `authenticated`, and granted to `service_role` only. A caller able to execute it could burn the global bucket.

Limits are not stored in the database. They live in Edge Function environment variables with defaults in code, so they can be retuned without a migration (decision Q7):

| Environment variable           | Default per minute |
| ------------------------------ | ------------------ |
| `OFF_SEARCH_PER_USER_PER_MIN`  | 4                  |
| `OFF_SEARCH_GLOBAL_PER_MIN`    | 8                  |
| `OFF_PRODUCT_PER_USER_PER_MIN` | 30                 |
| `OFF_PRODUCT_GLOBAL_PER_MIN`   | 80                 |

### Migration file naming and the schema lane

- New migrations are created with `supabase migration new <snake_name>` from `packages/db` and carry the CLI timestamp prefix (`YYYYMMDDHHMMSS_<snake_name>.sql`). `0001_init.sql` stays as it is. The CLI orders versions as strings, so `0001` sorts before every timestamp.
- Out-of-order rule: if `origin/main` holds a migration with a later timestamp than yours, rename yours to a fresh timestamp before merging, because production `supabase db push` refuses a local migration older than the newest remote one.
- Migrations are applied locally with `supabase migration up --local`, and never by `supabase db reset` on the shared database.
- `packages/db/src/types.gen.ts` is generated from the shared database, so at most one migration-bearing ticket is in flight at a time across M2 and M5. Two branches with unmerged applied migrations would each generate types containing the other's tables, and the CI drift check would fail.

### Seed files

- Seeds live in `supabase/seeds/*.sql` and are loaded through `[db.seed] sql_paths`, after `seed.sql`, in file name order.
- Every seed insert is idempotent, so a seed can be applied to a running database without a reset. Rows with a natural key (`foods`, via `(source, source_ref)`) use `on conflict (source, source_ref) do update`. Rows without one (`import_runs` and `food_portions`) use fixed literal uuids chosen by the seed generator and `on conflict (id) do nothing`. `food_source_data` is keyed by `food_id` and uses `on conflict (food_id) do update`.
- The CoFID subset seed is generated by the import script and committed.
- M5 adds its own numbered seed file.

### Consequences of Amendment 1

Migrations KEY-36, KEY-40 and KEY-41 implement exactly this amendment, and the core zod schemas in KEY-37 mirror it. Any further deviation from the frozen Decision or from this amendment needs an Amendment 2 before the migration that implements it lands.

## Amendment 2 (M3 prerequisites, 2026-10-15)

### Status

Recorded on 2026-10-15 under KEY-153. Implements the five rulings Zee made on 2026-10-15 on KEY-68 (M3 prerequisites). The remaining details are interpretations made for implementation. They are, in full: the plain (non-unique) index on each `portion_id`, the rule for when the snapshot `portion` is set and its shape, the rule that "log again" uses `portion_id` while it is still set, the rule that an optional nutrient key is present only when the source food has a non-null value, and the rules that the drop comparisons are strict `>` and apply only at copy time and that an absent optional input key is never written on update. Zee confirms them by approving the PR that carries this amendment. The frozen Decision text and Amendment 1 are unchanged. This amendment fills in details they leave open and overrides nothing in them. It adds no table or column and needs no migration at M2. M3's diary migration implements the `portion_id` rules below.

### `portion_id` on log entries and recipe ingredients

The frozen Decision lists `portion_id` on `food_log_entries` and `recipe_ingredients` and says nothing about what it references. M3's diary migration declares both columns as nullable:

- `food_log_entries.portion_id uuid references public.food_portions (id) on delete set null`.
- `recipe_ingredients.portion_id uuid references public.food_portions (id) on delete set null`.
- Each table gets a plain index on `portion_id`. Postgres does not index the referencing side of a foreign key, and without the index every portion delete scans the whole table to find the rows to clear.

The reason is the delete-and-reinsert pattern recorded in the "Privileges and RLS" section above (decision Q10, under `food_portions`). Editing a custom food deletes the user's portions and inserts the new ones, so every portion comes back with a new id. An OFF refresh does the same for the shared portions of an OFF food. With `on delete set null`, those deletes clear the link and succeed, and no log row or ingredient row is ever deleted or blocked by them. There is no portion diff-update, which means no matching of old portions to new ones and no remapping of ids.

The snapshot, not the link, is the record. A log entry's and an ingredient's snapshot stores the portion it was logged with in `portion`:

- `portion` is `{ label: string, grams: number }` or `{ label: string, ml: number }`, with the other key absent. That mirrors the `food_portions` check `num_nonnulls(grams, ml) = 1`.
- `portion` is non-null exactly when the entry's `unit` is `'portion'`. It is null for every other unit (g, ml, oz, fl_oz, serving) and for quick entries. This shape and this null rule are interpretations, the rulings do not state them.
- `resolved_grams` and the snapshot's `per100` keep the entry's numbers, so nutrients are rebuilt from the snapshot alone and never from `food_portions`.

The accepted trade-off: after a food edit or an OFF refresh, `portion_id` is null on the affected entries. "Log again" uses the portion `portion_id` points to while it is still set (an interpretation). When it is null, the order of fallbacks is not fixed by this ADR and is M3's call. The options are a label match on `portion.label` from the old snapshot, the food's default portion, or a direct amount.

Implemented by M3's diary migration (the two columns and their indexes) and by M3's `buildFoodSnapshot` (the `portion` shape).

### Log entry `nutrients` key set

A `food_log_entries.nutrients` object holds the five required keys `kcal`, `protein_g`, `fat_g`, `carbs_g` and `fibre_g`, plus `sat_fat_g`, `sugars_g` and `salt_g` when present. It never holds micronutrients. The key set is the one `nutrientsSchema` in `@keylow/core` already defines, and `scaleNutrients` already produces it from a snapshot's `per100`: the five required keys are always written, an optional key is written only when `per100` carries it, and an absent optional key stays absent. Each of the five required keys may be null, because `nutrientsSchema` allows it and `scaleNutrients` keeps a null as null, so `buildFoodSnapshot` and its callers must handle null. An optional key is "present" when the source food records a non-null value for it. It is `buildFoodSnapshot`'s duty to omit a null `sat_fat_g`, `sugars_g` or `salt_g` column from `per100`, because `scaleNutrients` passes a null through as null rather than dropping the key (an interpretation, the rulings do not state it). The view `day_totals` sums these keys per user per day as the frozen Decision says.

The display contract does not change for M2:

- Food detail follows the boards, which show none of saturated fat, sugars, salt or micronutrients.
- A CoFID "Tr" is a recorded 0 listed in `quality.trace_fields` (see the "`foods.quality` key set" section above), so a food detail or log row showing it as 0 g is correct.
- The log row's visual content comes from the M3 diary frames.
- The label saying a value was converted from kilojoules stays off, because no `quality` key records that conversion.

Implemented by M3's `buildFoodSnapshot` and the M3 diary screens. No M2 ticket changes the display.

### `micros` and `food_group` stay raw source data

`foods.micros` and `foods.food_group` hold what the source gave, in the source's own vocabulary (OFF nutriment names and categories, CoFID column names and food groups). Two sources do not share a vocabulary, so the columns have no common meaning yet. Therefore:

- Nothing in v1 reads them. They are not part of a snapshot, a log entry's `nutrients` or any screen.
- They are never copied to a `source = 'user'` food. A user food is created with `micros = '{}'` and a null `food_group`, as `createFood` already does, and the "Copy to your foods" flow does not carry them.
- Any layer that maps source vocabularies to one set of names is post-v1. Until then the columns keep their Amendment 1 definitions and are not dropped.

This matches the build plan, whose line 24 puts `micros` out of v1. The three frozen columns `sat_fat_g`, `sugars_g` and `salt_g` stay stored and are carried by the copy flow, per Zee's ruling. Implemented by KEY-154 (the copy carries neither column).

### Soft delete and `getFood`

Removing a custom food sets its `deleted_at`, as decision Q10 and the "Privileges and RLS" section above already say. This amendment adds only how reads treat a deleted food:

- `getFood` is deliberately unfiltered on `deleted_at`. A log entry or a recipe ingredient that points at a deleted food must still resolve it, which is why Q10 uses a soft delete at all. A caller that has to hide a deleted food reads `deleted_at` from the row it gets back.
- List and lookup reads filter `deleted_at is null`: `search_foods` (in the database), and `getFoodByBarcode` and `listOwnFoods` (in `@keylow/api-client`). This is the existing "Filtering on `deleted_at` is done by `search_foods` and the clients, not by policy" rule, and it stands.
- The API lands now and the screen later. `@keylow/api-client` gains `softDeleteFood` (an update setting `deleted_at`, which the existing column grant already allows) and the `useDeleteFood` hook. The delete UI waits for a board and is not part of the M3 diary brief.

Implemented by KEY-156.

### Copy flow carries saturated fat, sugars and salt

"Copy to your foods" creates a `source = 'user'` food from a shared food. The boards give the form no fields for saturated fat, sugars or salt, so the copy carries them invisibly from the source food into the new food's `sat_fat_g`, `sugars_g` and `salt_g` columns. The `foods` insert grant already covers all three columns, so no migration is needed. The drop rules apply once, at copy time, to the values the user submitted in the form:

- `sat_fat_g` is dropped (written as null) when it is greater than the edited `fat_g`.
- `sugars_g` is dropped (written as null) when it is greater than the edited `carbs_g`.
- `salt_g` has no rule and is carried as it is.
- A carried value that is null stays null.

Updates never clear the three columns. `updateFood` already leaves them untouched, because the editable columns it writes exclude them. The drop rules do not run on update, so a later edit of fat or carbs can leave a stored value above it. That is accepted.

`customFoodInputSchema` in `@keylow/core` gains `sat_fat_g`, `sugars_g` and `salt_g` as optional keys, each a non-negative number and not nullable, like `fibre_g`. A null value on the source food is omitted from the input, never passed as null, so an update can never clear a column. An absent key on create is stored as null. An absent key on update is never written, so the existing value stays (an interpretation of "updates never clear them"). The ordinary create and edit forms do not send these keys, so for them nothing changes.

Implemented by KEY-154 (the schema keys, the drop rules in `@keylow/core` and the carrying in `@keylow/api-client`) and by KEY-155 (the apps' copy flow, which calls the core helper `carriedNutrients`, and that helper applies the drop rules).

### Consequences of Amendment 2

M3's diary migration matches the `portion_id` rules above, and its `buildFoodSnapshot` produces the `portion` and `nutrients` shapes above. KEY-154, KEY-155 and KEY-156 implement the rest, and none of them needs a schema change. Any further deviation from the frozen Decision, from Amendment 1 or from this amendment needs an Amendment 3 before the migration or code that implements it lands.

## Amendment 3 (Profiles: terms acceptance, 2026-10-15)

### Status

Recorded on 2026-10-15 under KEY-157. Implements Zee's rulings on KEY-136 (2026-10-14 and 2026-10-15). Sign-up requires ticking acceptance of the Terms and the Privacy Policy, and that acceptance is the explicit consent for health data. It is recorded on the profile in the same step that creates the account. On the Google path the user ticks first and the acceptance is recorded straight after sign-in. An accept-to-continue gate catches any signed-in account without a current acceptance. The remaining details are interpretations made for implementation. They are, in full: the check that pairs the two columns, the rule that a blank version counts as no version, the narrowing of `insert` as well as `update`, the exclusion of `id` and `created_at` from both column lists, the grant of `accept_terms` to `authenticated` only, and the error raised when the caller has no profile row. Zee confirms them by approving the PR that carries this amendment. The frozen Decision text, Amendment 1 and Amendment 2 are unchanged. This amendment adds two columns to `profiles`, which the frozen column list does not name, and narrows two grants that `0001_init.sql` set wide.

### `profiles` columns

| Column              | Definition                                                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `terms_accepted_at` | `timestamptz`, nullable. When the user accepted, taken from the database clock.                                                        |
| `terms_version`     | `text`, nullable. The version of the Terms and Privacy Policy the user accepted. The app's `TERMS_VERSION` constant in `@keylow/core`. |

Both are null until the user accepts. A check, `profiles_terms_acceptance_paired`, requires `(terms_accepted_at is null) = (terms_version is null)`, so a row never carries a version without a time or a time without a version. The database does not know which version is current, so it does not validate the value. Deciding whether a stored version is current is the app's job and is what the accept-to-continue gate does. A stored version is the version the user saw, not a claim that it is the latest.

### Sign-up trigger

`handle_new_user()` keeps everything it did before (insert the `profiles` row for the new `auth.users` row, security definer, empty `search_path`, execute revoked) and now also reads `raw_user_meta_data ->> 'terms_version'`:

- When it is a non-blank string, the new row gets that `terms_version` and `terms_accepted_at = now()`.
- When it is missing, null or blank (empty or only whitespace), both columns stay null.
- The time is always the database's. A `terms_accepted_at` key in the metadata is ignored.

The client sends the version as user metadata in the same call that creates the account (`options.data.terms_version`), so the account and its acceptance are written in one transaction. The trigger fires on insert only, so changing user metadata later does not change the profile. The value is client-supplied, so a client could claim any version string. That is accepted. The record shows what the app said it showed, and the timestamp is the part that cannot be chosen by the client.

### `accept_terms(p_version text)`

`public.accept_terms(p_version text) returns void`, security definer, `search_path = ''`:

- Raises `28000` when there is no signed-in user (`auth.uid()` is null).
- Raises `22023` when `p_version` is null or blank.
- Updates the caller's own row only (`where id = (select auth.uid())`), setting `terms_version = p_version` and `terms_accepted_at = now()`.
- Raises `P0002` when the caller has no `profiles` row, so a user without a profile does not get a silent success.
- Accepting a newer version overwrites both columns. The earlier acceptance is not kept. History of acceptances is out of scope.

Execute is revoked from `public` and `anon` and granted to `authenticated`. `service_role` is not granted it, unlike `search_foods`, because the function acts on the caller and `service_role` has none.

It serves the Google path (record the acceptance straight after sign-in) and the accept-to-continue gate (record a newer version).

### Privileges

`0001_init.sql` granted `authenticated` `insert` and `update` on every column of `profiles`. Both are now explicit column lists, the same approach as `foods` in Amendment 1:

- `insert`: `id`, `sex`, `birth_date`, `height_cm`, `activity`, `weight_unit`, `energy_unit`, `timezone`, `checkin_weekday`, `onboarding_weight_kg`, `onboarding_completed_at`.
- `update`: the same list without `id`.
- Neither list has `terms_accepted_at`, `terms_version` or `created_at`. The terms columns are written only by the trigger and by `accept_terms`, because a client that could write them could record consent it never gave. `created_at` is an audit column the database fills in.
- `id` is not updatable. A row's id is its `auth.users` id and no client changes it. This turns the one existing case where an update to `id` failed on the `profiles_update_own` check into a failure on privileges instead, which is still an error with code `42501`.
- `id` stays insertable and `insert` is narrowed rather than removed. No app code inserts `profiles` rows, because the trigger does. The grant is kept so the `profiles_insert_own` policy still has a statement to guard. A user who deletes their row and inserts it again gets a row with no acceptance, which the accept-to-continue gate then catches.
- `select` and `delete` are unchanged. The four owner-only policies are unchanged.

A column added to `profiles` later is not writable by clients until the migration that adds it grants it.

### Consequences of Amendment 3

The sign-up screens (KEY-159 and KEY-160), the Google path and the accept-to-continue gate (KEY-161 and KEY-162) read and write acceptance only through the `terms_version` metadata key and `accept_terms`. The api-client functions that wrap them are KEY-158. M3's target columns on `profiles` are not part of this amendment. They follow in an Amendment 4 and must add their own column grants on top of the lists above. Any further deviation from the frozen Decision, from Amendment 1, Amendment 2 or this amendment needs an Amendment 4 before the migration or code that implements it lands.

## Amendment 4 (Profiles: manual calorie and macro target, 2026-10-15)

### Status

Recorded on 2026-10-15 under KEY-180. Implements the manual target that KEY-3 scope 4 asks for and the targets brief (brief 14) describes: a calorie and macro target the user types in More, which the diary reads until M6's live `targets` replace it. The calorie range of 800 to 6000 kcal is Zee's confirmed range for the app, from the canvas review on 2026-10-15 (KEY-178: "targets of 800 to 6,000 kcal"). Enforcing that range as a database check, and the checks that each macro is `>= 0` with no upper bound, come from the KEY-180 ticket spec, not from a ruling. The remaining details are interpretations made for implementation. They are, in full: the choice that each target column is independently nullable with no check pairing them, the rule that a null macro column means no bar for that macro alone, the decision that the client writes `targets_updated_at`, the widening of `insert` as well as `update`, and the rule that the diary reads no target from a null `target_kcal`. Zee confirms them by approving the PR that carries this amendment. The frozen Decision text and Amendments 1 to 3 are unchanged. This amendment adds five columns to `profiles`, which the frozen column list does not name, and extends the two column grants that Amendment 3 narrowed.

### `profiles` columns

| Column               | Definition                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `target_kcal`        | `int`, nullable. The daily calorie target. Check `profiles_target_kcal_range`: `target_kcal between 800 and 6000`.       |
| `target_protein_g`   | `numeric`, nullable. The daily protein target in grams. Covered by `profiles_target_macros_nonnegative`.                 |
| `target_carbs_g`     | `numeric`, nullable. The daily carbohydrate target in grams (EU-style). Covered by `profiles_target_macros_nonnegative`. |
| `target_fat_g`       | `numeric`, nullable. The daily fat target in grams. Covered by `profiles_target_macros_nonnegative`.                     |
| `targets_updated_at` | `timestamptz`, nullable. When the user last saved their targets. Null until a target has been saved.                     |

- Null means no target is set. A Postgres check passes on null, so a null column needs no extra rule.
- Two named checks, which KEY-182's pgTAP asserts: `profiles_target_kcal_range` and `profiles_target_macros_nonnegative`. The second is one check, `target_protein_g >= 0 and target_carbs_g >= 0 and target_fat_g >= 0`, and a null column passes it. The macros have no upper bound, and `numeric >= 0` accepts `NaN` and `Infinity`, the same accepted risk as the `foods` nutrient columns.
- The columns are independent. There is no check that pairs them, and no check that the macros add up to `target_kcal`. Brief 14 shows "Macros add up to 2,150 kcal" as information only, computed in the app, as quick add is. A user can therefore hold a calorie target with no macros, or the reverse.
- The diary treats a null `target_kcal` as no calorie target. Its progress bars show the day's total with no bar for that column, and the `diary.no-target` board and its "Set target" banner follow from it. A null macro column does the same for that macro alone. The diary shows a target exactly as the user typed it, with no "(est.)" marker.
- The app, not the database, requires `target_kcal` on the targets screen: the form refuses a blank calorie field. The database allows a row with macros and no calories, so a client other than the app cannot be locked out by a rule only one screen enforces.
- `targets_updated_at` is set by the client to the time of the save. Unlike `terms_accepted_at`, it records nothing a client could gain by forging, so it needs no trigger or function, and the table grants below let the client write it.
- No other table changes. `day_totals` does not read these columns. The diary reads them from the user's own `profiles` row.

### Privileges

Amendment 3 made the `insert` and `update` grants on `profiles` explicit column lists. This amendment adds the five columns above to both, so the lists become:

- `insert`: `id`, `sex`, `birth_date`, `height_cm`, `activity`, `weight_unit`, `energy_unit`, `timezone`, `checkin_weekday`, `onboarding_weight_kg`, `onboarding_completed_at`, `target_kcal`, `target_protein_g`, `target_carbs_g`, `target_fat_g`, `targets_updated_at`.
- `update`: the same list without `id`.
- Amendment 3's exclusions stand: neither list has `terms_accepted_at`, `terms_version` or `created_at`, and `id` is not updatable.
- `select` and `delete` are unchanged, and `select` is table-wide, so the new columns are readable by the owner with no further grant. The four owner-only policies are unchanged, so a user reads and writes only their own targets.

The migration that adds the columns grants them. The rule at the end of Amendment 3's Privileges section still applies to every later `profiles` column.

### Lifetime

The columns are a stopgap. In M6 the adaptive engine writes live rows to `targets`, and once a user has one, the app stops reading these five columns. They are not dropped in v1, so nothing needs a migration to remove them. How M6 treats a user with typed targets and no `targets` row yet is M6's call.

### Consequences of Amendment 4

The diary migration (KEY-182) adds the five columns, their checks and the extended column grants, and matches the lists above. The targets screens on mobile and web, and the diary's progress bars and `no-target` state, read and write them through the owner's `profiles` row. Any further deviation from the frozen Decision, from Amendments 1 to 3 or from this amendment needs an Amendment 5 before the migration or code that implements it lands.
