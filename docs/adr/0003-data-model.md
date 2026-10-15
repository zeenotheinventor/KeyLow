# 0003: Data model (Supabase Postgres)

## Status

Accepted, 2026-09-22. Amendment 1 appended 2026-10-07. Amendment 2 appended 2026-10-15. Amendment 3 appended 2026-10-15. Amendment 4 appended 2026-10-15. Amendment 5 appended 2026-10-15. Amendment 6 appended 2026-10-15. Amendment 7 appended 2026-10-15.

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
- `food_log_entries` (user_id, local_date, meal_slot breakfast|lunch|dinner|snack, logged_at, item_type food|recipe|quick, food_id, recipe_id, quantity, unit, portion_id, resolved_grams, snapshot jsonb, nutrients jsonb, kcal generated, deleted_at); indexes on `(user_id, local_date)`, `(user_id, logged_at desc)`, `(user_id, food_id)` (superseded in part by Amendment 5: `meal_slot` is dropped, and the `(user_id, local_date)` index is replaced by `(user_id, local_date, logged_at)`)
- `day_logs` (user_id, local_date, is_complete, completed_at, note), PK `(user_id, local_date)`
- `programs` (user_id, goal, rate_pct_per_week, protein_g_per_kg, fat_fraction_of_remaining, split_preset, dow_offsets_kcal int[7], goal_weight_kg, started_on, ended_on, next_checkin_date); one active per user
- `expenditure_snapshots` (user_id, as_of_date, mu_kcal, var_kcal2, measurement jsonb, trend_weight_kg, engine_version, params jsonb); unique `(user_id, as_of_date)`
- `targets` (user_id, program_id, expenditure_snapshot_id, effective_from, effective_to null = current, calories_kcal, protein_g, fat_g, carbs_g, dow_calories_kcal int[7], basis jsonb, engine_version); one current per user
- view `day_totals` (security_invoker) summing entry `nutrients` per user per day (a null nutrient is skipped in the sum, so a day's total is null, never 0, only when every live entry leaves that nutrient null or absent; soft-deleted entries are excluded; KEY-182)

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

There are three exceptions (the third was added with the diary migration, KEY-181):

- `food_source_data` is keyed by `food_id` and has no `id`.
- `rate_limits` has the composite primary key `(bucket, window_start)` and has neither `id` nor `created_at`.
- `day_logs` has the frozen primary key `(user_id, local_date)` and so has no `id`. It keeps `created_at`.

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

Implemented by KEY-154 (the schema keys, the drop rules in `@keylow/core` and the carrying in `@keylow/api-client`) and by KEY-155 (the apps' copy flow, which calls the core helper `withCarriedNutrients`, which wraps `carriedNutrients`, where the drop rules are applied).

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

## Amendment 5 (Diary: a timeline by time, no meal slots, 2026-10-15)

### Status

Recorded on 2026-10-15 under KEY-221. Implements Zee's ruling of 2026-10-15 on the M3 diary canvas review (KEY-178, brief 16): the diary is a timeline by time and not a set of meal slots. Food is logged at a time, the user can change that time, and there is no Breakfast, Lunch, Dinner or Snacks. Brief 17 (the hour-by-hour log) builds on it and needs no schema of its own, because a client groups a day's entries by the hour of `logged_at`. The remaining details are interpretations made for implementation. They are, in full: the rule that the database does not check `local_date` against `logged_at`, the rule that a copy keeps the wall-clock time in the profile's time zone, the rule that the `now()` default serves a new entry only when the client sends no time, the rule that times display in the current profile time zone, the `id` tie-break in the ordering, the grants on the time columns, and the handling of daylight saving changes when copying. Zee confirms them by approving the PR that carries this amendment. Unlike Amendments 1 to 4, this amendment changes the frozen Decision text, in one place only, and says so in the "Supersedes" section below and inline on that line. Amendments 1 to 4 are unchanged.

### Supersedes

The frozen `food_log_entries` line in the Decision changes in two ways:

- `meal_slot breakfast|lunch|dinner|snack` is dropped. No column replaces it.
- The index on `(user_id, local_date)` is replaced by an index on `(user_id, local_date, logged_at)`. The indexes on `(user_id, logged_at desc)` and `(user_id, food_id)` stay.

Nothing else on that line changes. The line carries an inline note pointing here, and the rest of the Decision is untouched.

No data is migrated. `food_log_entries` does not exist in any database yet, so M3's diary migration (KEY-181) creates it without `meal_slot` and with the new index. Nothing earlier in this ADR refers to meal slots, so no other text needs a note.

### `food_log_entries` time columns

| Column       | Definition                                                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `logged_at`  | `timestamptz not null default now()`. The entry's time. The user can edit it. It is the time the food was eaten, not only the time it was saved. |
| `local_date` | `date not null`. The day the entry belongs to, in the time zone of the user's profile (`profiles.timezone`).                                     |

- Adding food stamps the current time. The client sends no `logged_at` then, and the `now()` default applies. The client sends one in two cases: on a past day, where it is the current clock time on that day, and when the user adds at an hour (the hour's "+"), where it is that hour, for example 12:00. Future times on today are allowed (an interpretation).
- When the user edits `logged_at`, the client recomputes `local_date` from the new value, so an entry moved across midnight moves to the other day. The two always change together.
- The database does not check that `local_date` agrees with `logged_at`. The agreement depends on the profile's time zone, which the user can change, and a stored entry keeps the day it was logged on. This is an interpretation.
- Quick entries (`item_type = 'quick'`) have a `logged_at` like any other entry.
- The clock time and the hour the diary shows use the current `profiles.timezone`. There is no `tz` column on a log entry in v1. After the user changes time zone, an old entry's shown hour can shift, and can even fall outside its stored `local_date`. That is the accepted consequence (an interpretation).
- `day_totals` and `day_logs` group by `local_date` and never by `logged_at`, so a day's totals do not move when a time zone changes.

### Ordering and index

The diary lists a day by `logged_at`, then `created_at` (the audit column from Amendment 1), then `id`. Entries logged at the same time therefore appear in the order they were saved. Rows saved in one statement share a `created_at`, because it is the transaction time, so the order among them falls to `id`, which is a random uuid: stable from one read to the next, but otherwise arbitrary. The index is on `(user_id, local_date, logged_at)`, which serves the day query. `created_at` and `id` are only the tie-breaks and are not in the index. The `id` tie-break is an interpretation.

### Copy yesterday

Copy yesterday copies a whole day. There is no copy of a single meal. The same rule serves the web week view's "Copy to today", which copies a past day whole.

- Each copied entry keeps its clock time on the target day. The clock time is the wall-clock time in the profile's time zone, and `local_date` is the target day (an interpretation).
- A copy goes after anything already logged at the same time, because it is saved later and so has a later `created_at`. Copies from one statement share a `created_at`, so their order among themselves follows the tie-break above.
- A copied wall-clock time that falls in a daylight saving gap or overlap on the target day takes the platform's standard (compatible) resolution (an interpretation).

### Privileges

M3's diary migration (KEY-181) sets the full column grants for `food_log_entries`. This amendment fixes only the time columns among them, in the style of Amendment 3:

- `logged_at` and `local_date` are in both the `insert` and the `update` column lists, because the client sets them on insert and rewrites both when the user edits an entry's time.
- `created_at` is in neither list, as an audit column the database fills in. `id` is in neither list either.

### Consequences of Amendment 5

M3's diary migration (KEY-181) creates `food_log_entries` with the time columns and index above and without `meal_slot`. KEY-183 (merged in #119) already takes `loggedAt` and `localDate` in place of a slot and drops the slot schema. KEY-184 is the one follow-on: it drops the slot helper and adds time formatting and copying a whole day, and it matches this amendment. Any further deviation from the frozen Decision, from Amendments 1 to 4 or from this amendment needs an Amendment 6 before the migration or code that implements it lands.

## Amendment 6 (Food search: ranking, index use, lean rows, and database hardening, 2026-10-15)

### Status

Recorded on 2026-10-15 under KEY-64, KEY-59 and KEY-70. Implements Zee's ruling on the plausibility bounds for a food typed in by a person (KEY-70): at most 900 kcal and at most 100 g of each of protein, fat, carbohydrate, fibre, sugars and salt per 100 g or 100 ml, and saturated fat no more than fat. The remaining details are interpretations made for implementation. They are, in full:

- the way the ranking is fixed (a cap on the trigram term, not a change to the matching), the first word bonus and its three sizes, and the tie-break order of fewer commas, then shorter, then name, then id;
- that `search_foods` keeps its weights and that the score is rounded to four decimal places;
- the security definer helper `search_food_candidate_ids`, its `rows 50` estimate, its being an RPC the API roles can call, and the `service_role` clause in its visibility filter;
- the lean column list of `search_foods`, including `fibre_g` and `quality` although no list draws them yet;
- the four default portion columns and the rule that the join sits in the invoker function;
- the 200 character limit as a check constraint that counts characters, and the cut of Open Food Facts names to fit it;
- the exact set of privileges revoked from `service_role`;
- that the plausibility bounds are an input rule and not a row rule;
- the wording of the "too large" form sentence, and that a saturated fat issue is shown in the form's summary because the form has no saturated fat field.

Zee confirms them by approving the PR that carries this amendment. The frozen Decision text and Amendments 1 to 5 are unchanged. This amendment changes the return type of `search_foods` (from Amendment 1), adds one function, one check constraint and a narrowing of grants, and corrects two statements of Amendment 1 by restating them below.

### Supersedes

- Amendment 1's `search_foods` return shape ("every column of `foods` except `search`, then `score`") is replaced by the lean shape below. The ranking in the header of migration `20261007020200_search_foods.sql` is replaced by the ranking below, and its note that the gin indexes are not used under row level security (KEY-59) no longer holds. The migrations themselves are immutable and are not edited.
- Two statements in Amendment 1 are wrong, and the text above is left as it was written:
  - Amendment 1, "Privileges and RLS", says the Supabase CLI default ACL grants the API roles no DML on tables created by a migration. The live database showed the opposite: `service_role` held every table privilege, `TRUNCATE`, `REFERENCES` and `TRIGGER` included, which is why only `rate_limits` revoked them. The privileges are now narrowed as set out in "Privileges" below.
  - Amendment 1, "`foods.quality` key set", says `carbs_convention` is `'eu'` by default. In the code the key is left absent unless a US label was seen (`resolveCarbs` in `offRules.ts`): absent means no US-specific handling happened, `'eu'` means a US label was converted by subtracting fibre, and `'us_total'` means a US label could not be converted because fibre was missing.

### Ranking

`search_foods` still scores a food as `ts_rank_cd` plus the trigram weight times `word_similarity`, plus the own food boost of 0.3 and the CoFID boost of 0.1, with those weights unchanged. Three things change:

- The word being typed is a prefix, not a word. `word_similarity` scores a whole word higher than a longer word that starts with it (the closing trigram of "chick" is in "chick peas" and not in "chicken"), so "chick" returned chick peas before every chicken. The trigram term is now capped at what a food would score if every word matched and the last one only began with the query. The cap is computed from the query alone. Spelling variants stay below the cap and keep their order.
- A name that begins with the word being typed is the better match. The first word of the name (the first run of letters and digits) earns a bonus against the query's last word, or only word: 0.2 when the two are the same word, 0.15 when they are the same by English stem ("onions" for "onion"), and 0.1 when the first word only starts with the query's word. Exact beats prefix, and both beat a match deeper in the name. This is KEY-64's own suggestion, "weight a match on the first word of the name". Without it, the cap alone left finished words tied and let the simplest name win, and "stew" lost "Stew, beef, homemade" to "Damsons, stewed". Measured on the full CoFID import, for each distinct first word (about 650 of them), the best rank of a food whose first word is exactly that word, against the ranking before this amendment: 135 better, the rest the same, none worse.
- Equal scores are ordered by fewer commas in the name, then shorter name, then name, then id. This replaces the earlier name, then id. The score is rounded to four decimal places so floating point noise cannot hide a tie. `@keylow/api-client` keeps the order the function returns, and no longer sorts again by score and name, so the same order reaches both apps.

The weights, with the first word bonuses, stay in the `weights` CTE of the function. The tsquery is built as before: the last word gets `:*`, every other word is a stemmed exact match, and no part of the query is parsed as tsquery syntax. On the CoFID data "chick" now returns foods named Chicken in its first three results. "chicken breast" still puts "Chicken breast/steak, coated, baked" first, because it is the only tied row with two commas and the others have three or more. That is accepted: it is a reasonable first result for that query.

### Index use for an authenticated caller

Under row level security the planner refuses an index condition whose operator is not leakproof, and neither `@@` on a `tsvector` nor `%>` from pg_trgm is, so `foods_search_idx` and `foods_name_trgm_idx` were never used by a signed-in caller. The fix is a function, not a policy change.

`public.search_food_candidate_ids(search_phrase text, search_tsquery tsquery) returns setof uuid` is `security definer`, with `search_path = ''` and `row_security = off`. It returns the ids of live foods that match the tsquery or are word-similar to the phrase, so the planner can use both gin indexes. Its visibility filter mirrors `foods_select`: `owner_id is null or owner_id = auth.uid()`, with `deleted_at is null` added because search never returns a soft deleted food. It also lets the service role through, since the service role bypasses row level security everywhere else and `search_foods` has always shown it every live food. It tells the service role apart by `current_setting('role')`, which PostgREST and `set role` establish and a function cannot change. If `foods_select` changes, the filter changes with it.

`search_foods` stays `security invoker` and reads the candidate rows again under the caller's row level security, so row level security still has the last word: a wrong id from the helper can only be dropped, never leak a row. Execute on the helper is revoked from `public` and `anon` and granted to `authenticated` and `service_role`. As a `public` function it is also an RPC, which returns only ids the caller could already see. Its row estimate is 50, because the default of 1,000 made the planner read the whole of `foods` in the outer query. Measured with `auto_explain` as an authenticated user for "chicken breast" on 2,893 foods: a bitmap `OR` of both gin indexes in the helper, then a `foods_pkey` lookup per candidate, in 6 to 7 ms and with no sequential scan.

### Lean search rows

`search_foods(q text, lim integer default 25)` now returns, in this order: `id`, `source`, `name`, `brand`, `basis`, `kcal`, `protein_g`, `fat_g`, `carbs_g`, `fibre_g`, `quality`, `default_portion_id`, `default_portion_label`, `default_portion_grams`, `default_portion_ml`, `score`. It no longer returns `source_ref`, `owner_id`, `barcode`, `density_g_per_ml`, `sat_fat_g`, `sugars_g`, `salt_g`, `micros`, `food_group`, `fetched_at`, `deleted_at` or `created_at`. A full food is read by id with `getFood`, which is unchanged. The reason is size: a row with `micros` averaged 2.3 KB on CoFID, and 25 rows of "chicken" came to about 90 KB. `fibre_g` and `quality` are kept although no result list draws them yet, for the review flag and the carbs convention.

The default portion is the food's `food_portions` row with `is_default`, of which there is at most one (the unique index from Amendment 1). All four `default_portion_*` columns are null when the food has none, and `default_portion_grams` and `_ml` are mutually exclusive. The join is a left join in the invoker function, never in the definer helper, so `food_portions_select` applies and another user's portion cannot appear in a row.

### `foods.name` length

`foods` gets the check `foods_name_length_check`: `char_length(name) <= 200`, the same cap as `name` in `@keylow/core`. It counts characters, not bytes. The longest name in the seed and the full CoFID import is 91 characters, so no existing data is touched. The cap is the one `customFoodInputSchema` in `@keylow/core` already applies to a name typed by a person (the source of the number 200), and the check closes the gap that a direct API insert skipped it. It applies to Open Food Facts writes as well, so the OFF normaliser in core (`pickName`, through `capFoodName`) cuts a name to at most 200 characters before it is written: the name is trimmed, then cut at the last space at or before the 200th character, so no word is split, and any spaces or commas left at the cut are dropped. A name with no space in its first 200 characters is cut at 200, backing up one if that would split a character written as a surrogate pair. A name with nothing left after the cut, such as one made only of commas, is passed over like a missing name, and the normaliser tries the other name. A name of 200 characters or fewer is untouched.

### Privileges

`service_role` loses `TRUNCATE`, `REFERENCES` and `TRIGGER` on `foods`, `food_portions`, `food_source_data` and `import_runs`, and keeps `SELECT`, `INSERT`, `UPDATE` and `DELETE`. That is what `rate_limits` already does, and what the import scripts need. pgTAP asserts the exact privilege set per table.

### Plausibility bounds on typed input

A food a person types in or copies has plausible limits per 100 g or 100 ml: energy at most 900 kcal, each of protein, fat, carbohydrate, fibre, sugars and salt at most 100 g, and saturated fat no more than fat. They live in `customFoodInputSchema` in `@keylow/core`, through `MAX_KCAL_PER_100` and `MAX_GRAMS_PER_100` and the `kcalPer100InputSchema` and `gramsPer100InputSchema` in `nutrients.ts`. The saturated fat rule is a refinement whose issue sits on `sat_fat_g`.

These are an input rule, not a row rule. They do not apply to `foodRowSchema`, `nutrientAmountSchema`, the diary entry and day total schemas, or the Open Food Facts and CoFID reads. A day's energy is far above 900, a source records what it records, and a bad source value is flagged by `quality` and not rejected, so a bound on a read would make one bad product throw on a barcode lookup. The form maps a nutrient over its limit to a new "too large" sentence on that field ("Energy cannot be more than 900 kcal per 100 g or 100 ml"). The form has no saturated fat, sugars or salt field, so an issue on those keys shows in the form's summary.

One consequence is recorded, with the CoFID figures measured on the full import of 2,885 foods: energy peaks at exactly 900, so no CoFID food fails the energy bound. Five CoFID foods have carbohydrate above 100 g per 100 g (brown sugar 101.3, Demerara 104.5, icing 104.9, white 105 and peppermints 102.7), because CoFID states sugars as monosaccharide equivalents. Copying one of them asks the user to lower the carbohydrate, which is the accepted cost of the bound. One CoFID food (bananas, weighed with skin) has saturated fat of 0.03 against fat of 0, which a copy already drops under Amendment 2's rule, so it never reaches the new refinement.

### Consequences of Amendment 6

The migration `20261015180000_search_foods_ranking_and_index_use.sql` creates the helper, the check and the revokes, and replaces `search_foods`. `@keylow/api-client` parses the lean row as `FoodSearchHit` and no longer expects a whole food from the search. `getFood` and `listFoodPortions` are unchanged. Any further deviation from the frozen Decision, from Amendments 1 to 5 or from this amendment needs an Amendment 7 before the migration or code that implements it lands.

## Amendment 7 (Open Food Facts store: one transaction, 2026-10-15)

### Status

Recorded on 2026-10-15 under KEY-60. It replaces the three separate writes the `off-product` Edge Function made to store an Open Food Facts product with one database function that does them in one transaction. The details are interpretations made for implementation. They are, in full:

- that the function takes and returns JSON, and the three argument names `p_food`, `p_portions` and `p_raw`;
- that the database, not the caller, sets `fetched_at`, and from the statement clock (`clock_timestamp()`), not the transaction start;
- that the writers of one barcode are serialised by the row lock of the food upsert, with no advisory lock, and that the portions are replaced by delete and insert and not by a diff;
- that a payload which is not an object, is not an `off` food, has an owner, has no `source_ref` or has more than one default portion is refused with `22023` before anything is written, and that every other bad value is left to the table's own check;
- that an empty portions array is valid and clears the food's portions, and a null one is refused;
- that `execute` is held by `service_role` alone;
- that the stale-refresh claim stays in the Edge Function.

Zee confirms them by approving the PR that carries this amendment. The frozen Decision text and Amendments 1 to 6 are unchanged. This amendment adds one function and no table, column or policy.

### Why

PostgREST has no transaction between calls, so the three writes (upsert the food, delete and insert its global portions, upsert its raw data) had three failures that code in the Edge Function could only soften:

- Simultaneous first lookups of one barcode raced on the portions insert and collided on `food_portions_one_default_per_food_idx` (`23505`). The function treated that error as "another writer won" and re-read.
- A reader could see a fresh food with no portions between the delete and the insert of a refresh.
- A portions insert that failed after the delete left the food without portions until its next refresh, which is 90 days away.

### `store_off_product(p_food jsonb, p_portions jsonb, p_raw jsonb) returns jsonb`

`security definer`, `set search_path = ''` and `set row_security = off`, with every name schema-qualified, as `search_food_candidate_ids` is. Row security is off so that a policy can never silently hide the row being updated: the function sees it or fails. In one transaction it:

1. Upserts the food on `(source, source_ref)`. The columns and the conflict rule are the ones the Edge Function used: on a conflict every sent column is updated, and `id`, `created_at` and `deleted_at` are left alone. `source` is `'off'`, `owner_id` is null, and `fetched_at` is the database clock.
2. Upserts `food_source_data` (`import_run_id` null, `raw` replaced).
3. Deletes the food's portions and inserts the sent ones as global rows (`owner_id` null), in the order sent, with `position` the index in the array.

`p_food` holds the columns the OFF normaliser fills plus `source` and `source_ref`. Keys the function does not know, including `id`, `fetched_at`, `deleted_at` and `created_at`, are ignored, so a caller cannot set them. Each value is read with its column's type. `p_portions` is an array of `{ label, grams, ml, is_default }`. `p_raw` is the product as OFF sent it.

It returns `{ food, portions }`: the stored food with every column except the generated `search`, and the stored portions in order. That is the body of the `off-product` response, which the Edge Function parses with `offProductResponseSchema`, so one round trip stores a product and reads it back. When callers race for one barcode, each answers with what its own call stored, and the last writer replaces the portions, so a losing caller's response can carry portion ids that no longer exist. The old code had the same gap. It is accepted for a personal app, where concurrent first lookups of one barcode are rare.

### Input checks

Before any write, `22023` (`invalid_parameter_value`) with a message that says what is wrong, for: a food, raw product or portions list of the wrong JSON type (a null counts as the wrong type); a `source` other than `off`; a non-null `owner_id`; a missing or blank `source_ref`; and more than one portion with `is_default` true. The last is checked up front so the caller gets a clear error and not the unique violation. Everything else is left to the tables: a portion with both `grams` and `ml`, or an amount of zero or less, fails the table's check (`23514`), a missing `name`, `basis`, `micros` or `quality` fails `not null` (`23502`), and the whole call rolls back. `jsonb_populate_record` applies no column defaults, so `micros` and `quality` do not fall back to `{}`; the Edge Function always sends both.

### Concurrency

Two calls for one barcode are serialised by the row lock that the food upsert takes, and no advisory lock is used. `insert ... on conflict do update` on `(source, source_ref)` inserts the row or locks the existing one until the transaction ends. A second writer waits at that statement for the first to commit, then updates the row, and only then deletes and inserts the portions, in a statement of its own that sees what the first committed. So a writer never inserts a default portion beside another writer's, no `23505` can come back, both calls succeed and the last to commit wins, with its food columns, portions and raw data all from one writer. Two writers take their locks in one order (the food, its raw data, its portions), so they cannot deadlock.

An advisory lock on a hash of `source_ref` was the alternative. It would also serialise the writers, but it takes a lock on a made up key that nothing else respects, it needs a hash of text with a chance of a collision between two barcodes, and it adds a statement that does nothing the upsert's lock does not already do. The cost of the chosen design is a constraint on the code: the food upsert must stay the first write of the function. A comment in the migration says so, and the integration test `test/integration/database/store-off-product.test.ts` fails when it does not hold. That test runs eight simultaneous calls on separate connections, for a first store and for a refresh, and it fails against a variant that does not lock the existing row.

Replacing the portions by delete and insert and not by a diff means the portion rows get new ids on every refresh. Amendment 2 already accepts this for an OFF refresh: nothing references a global portion by id that must survive it, because `portion_id` on a log entry is `on delete set null` and the entry keeps its own snapshot. A diff would keep the ids, at the price of matching portions by label, and OFF gives a product at most one portion, so it was not worth it.

### Privileges

`execute` is revoked from `public`, `anon` and `authenticated` and granted to `service_role` alone. It is not an RPC for a signed-in user: it writes the shared catalogue, which only the Edge Function does, with the service role key. pgTAP asserts the exact set of roles that can execute it, and that an `authenticated` and an `anon` call fail with `42501`.

### The stale-refresh claim stays in the Edge Function

`claimRefresh` moves `fetched_at` forward with a compare-and-set before a refresh so that one request in a burst refreshes. It happens before the OFF call, when there is nothing to store yet, and it is a decision about whether to call OFF at all. Moving it into `store_off_product` would put the decision after the call it exists to avoid. It is unchanged.

### Consequences of Amendment 7

The migration `20261015190000_store_off_product.sql` creates the function and its grants. The `off-product` Edge Function calls it through `.rpc` and no longer treats `23505` as a lost race or re-reads the cache after a store: a failed store is an error (500 `internal_error`), and nothing is half written. `packages/db/src/types.gen.ts` gains `store_off_product`. Any further deviation from the frozen Decision, from Amendments 1 to 6 or from this amendment needs an Amendment 8 before the migration or code that implements it lands.
