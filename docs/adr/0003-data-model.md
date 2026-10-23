# 0003: Data model (Supabase Postgres)

## Status

Accepted, 2026-09-22. Amendment 1 appended 2026-10-07. Amendment 2 appended 2026-10-15. Amendment 3 appended 2026-10-15. Amendment 4 appended 2026-10-15. Amendment 5 appended 2026-10-15. Amendment 6 appended 2026-10-15. Amendment 7 appended 2026-10-15. Amendment 8 appended 2026-10-16. Amendment 9 appended 2026-10-18. Amendment 10 appended 2026-10-23. Amendment 11 appended 2026-10-23. Amendment 12 appended 2026-10-23.

## Context

M2 onward builds a Postgres schema whose shape (tables, columns, the `day_totals` view, RLS, and the CoFID/OFF field mappings) needs to be fixed before those milestones start. Per the M1 Foundations brief (KEY-1), M1 implements only `profiles`. Its migration 0001 scope is `profiles` plus `handle_new_user`, and its Out of scope section excludes any domain schema beyond `profiles` until M2 onward. Freezing the column lists here, verbatim from the Build Plan & Engineering Context document's Data model section, lets a reviewer diff a migration against this ADR instead of the source document.

## Decision

The following, transcribed verbatim from the document's Data model (Supabase Postgres) section, is frozen:

- `profiles` (id -> auth.users, sex, birth_date, height_cm, activity, weight_unit, energy_unit, timezone, checkin_weekday, onboarding_weight_kg, onboarding_completed_at)
- `weigh_ins` (user_id, measured_at, local_date, tz, weight_kg 20..400, source manual|healthkit|health_connect|import, external_id, note, deleted_at); unique `(user_id, source, external_id)` where not null (superseded in part by Amendment 9: the unique key is a plain constraint that also covers soft-deleted rows, and is not partial)
- `foods` (source off|cofid|user, source_ref, owner_id null for global, name, brand, barcode digits-only, basis per_100g|per_100ml, density_g_per_ml, kcal, protein_g, fat_g, sat_fat_g, carbs_g EU-style, sugars_g, fibre_g, salt_g, micros jsonb, quality jsonb {kcal_derived, suspect, fields_missing}, food_group, fetched_at, search tsvector, deleted_at); unique `(source, source_ref)` for non-user rows; gin on search and `name gin_trgm_ops`; check `(source='user') = (owner_id is not null)`
- `food_portions` (food_id, owner_id denormalised for RLS, label, grams or ml, is_default, position)
- `food_source_data` (food_id, import_run_id, raw jsonb) and `import_runs` (source, label, file_sha256, started/finished, row_count): service role only
- `recipes` (owner_id, name, servings > 0, yield_grams nullable, notes, computed jsonb cache, is_archived) (superseded in part by Amendment 8: `notes` is dropped and `instructions text[]` takes its place)
- `recipe_ingredients` (recipe_id, owner_id, position, food_id, quantity, unit, portion_id, resolved_grams, snapshot jsonb); sub-recipes deferred
- `food_log_entries` (user_id, local_date, meal_slot breakfast|lunch|dinner|snack, logged_at, item_type food|recipe|quick, food_id, recipe_id, quantity, unit, portion_id, resolved_grams, snapshot jsonb, nutrients jsonb, kcal generated, deleted_at); indexes on `(user_id, local_date)`, `(user_id, logged_at desc)`, `(user_id, food_id)` (superseded in part by Amendment 5: `meal_slot` is dropped, and the `(user_id, local_date)` index is replaced by `(user_id, local_date, logged_at)`)
- `day_logs` (user_id, local_date, is_complete, completed_at, note), PK `(user_id, local_date)`
- `programs` (user_id, goal, rate_pct_per_week, protein_g_per_kg, fat_fraction_of_remaining, split_preset, dow_offsets_kcal int[7], goal_weight_kg, started_on, ended_on, next_checkin_date); one active per user
- `expenditure_snapshots` (user_id, as_of_date, mu_kcal, var_kcal2, measurement jsonb, trend_weight_kg, engine_version, params jsonb); unique `(user_id, as_of_date)`
- `targets` (user_id, program_id, expenditure_snapshot_id, effective_from, effective_to null = current, calories_kcal, protein_g, fat_g, carbs_g, dow_calories_kcal int[7], basis jsonb, engine_version); one current per user
- view `day_totals` (security_invoker) summing entry `nutrients` per user per day (a null nutrient is skipped in the sum, so a day's total is null, never 0, only when every live entry leaves that nutrient null or absent; soft-deleted entries are excluded; KEY-182)

RLS: owner-only on every user table using `(select auth.uid())`; `foods` and `food_portions` readable where `owner_id is null or owner_id = uid`, writable only for `source='user'` own rows; global rows written only by the service role (CoFID import, `off-product`). pgTAP asserts every policy.

CoFID mapping: per 100 g edible portion; energy from the kcal column; `salt_g = sodium_mg × 2.5 / 1000`; fibre AOAC where present else Englyst with `quality.fibre_method`; "Tr" -> 0 with `quality.trace_fields`, "N" -> null; everything else into `micros`; full source row into `food_source_data.raw`. CoFID has no portion sizes, so `packages/db/data/portions/cofid-portions.csv` holds curated natural portions for common generic foods (KEY-256), each weight copied from a USDA FoodData Central portion and shipped to production by a generated migration (KEY-514; `import:portions` stays for a local stack).

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

## Amendment 8 (Recipes, 2026-10-16)

### Status

Recorded on 2026-10-16 under KEY-282. Implements Zee's rulings of 2026-10-16 on KEY-4 (the recipes brief). Creating or editing a recipe covers adding the foods and writing the instructions. The instructions are ordered text steps, stored on the recipe as an ordered list, `instructions text[]`, and the frozen `notes` column is dropped. Those are rulings. The recipe log entry is the part the M3 handoff asked to be decided here. The remaining details are interpretations made for implementation. They are, in full:

- the numbers in "The numbers" below (name, servings, yield, step, ingredient and ingredient amount bounds), and that a blank step is refused by the database and dropped by the editors.
- that a recipe may be stored with no instructions and with no ingredients, although the editors require at least one ingredient.
- that `recipes.computed` is `not null` with no default, the shape of the cache, and what a recipe with no ingredients computes to.
- that `recipe_ingredients` has no `update` grant, because ingredients are replaced as a whole, and that the database has no list of units.
- the name `save_recipe`, its argument names and JSON shapes, that keys it does not know are ignored and `position` is assigned from the array index, the error codes `22023` and `P0002`, that `execute` is held by `authenticated` alone, and that the database always chooses a new recipe's id.
- the content of the recipe snapshot, its two units (`serving` and `g`), that its `effectiveGrams` is above 0, that a recipe is logged from its `computed` cache, and that neither `SNAPSHOT_VERSION` nor `NUTRITION_ENGINE_VERSION` moves.
- the `no action` rule on `food_log_entries.recipe_id`, the partial index, the change to the insert policy, and the fallback to a deferred constraint if the account deletion proof fails.
- that `service_role` gets no privileges on the two new tables.
- that recipe name search is an `ilike` through PostgREST with no new function.
- the export and account deletion contract recorded for M7.

Zee confirms them by approving the PR that carries this amendment. Amendments 1 to 7 are unchanged. The frozen Decision text is unchanged except for one inline note on the `recipes` line, which "Supersedes" explains. This amendment drops one column that the frozen `recipes` line names and adds one it does not, adds one function, one foreign key and one snapshot kind, and changes one policy. It adds no table, because the frozen Decision already names both. Amendment 1's `id` and `created_at` columns apply to both tables, as they do to every new table.

### Supersedes

The frozen `recipes` line in the Decision changes in one way:

- `notes` is dropped. `instructions text[]` takes its place (see "Instructions").

Nothing else on that line or on the `recipe_ingredients` line changes. The `recipes` line carries an inline note pointing here, and the rest of the Decision is untouched.

The reason is the same shape as Amendment 5's for `meal_slot`, with a replacement. `notes` was a placeholder for free text on a recipe. Zee's ruling asks for ordered steps, and a second free text field beside them would give the editor two places for one purpose, so a user would put the method in one or the other and the screens would have to decide which to show. Nothing writes `notes`, because no `recipes` table exists in any database yet (no migration creates it, and the diary migration says as much for `recipe_id`). So no data is migrated and nothing needs a migration to remove the column. If a note on a recipe is wanted later, it is a new column and a later amendment. Nothing earlier in this ADR refers to the `notes` column of `recipes`, so no other text needs a note.

### The numbers

Every bound this amendment sets for recipes is in this table, so that core and the migration use the same ones.

| What                        | Rule                                                  |
| --------------------------- | ----------------------------------------------------- |
| Recipe name                 | Not blank, at most 200 characters.                    |
| Servings                    | Greater than 0, at most 1,000. Fractions are allowed. |
| Yield (`yield_grams`)       | Null, or greater than 0 and at most 100,000.          |
| Instruction steps           | At most 50 steps in a recipe.                         |
| One step                    | Not null, not blank, at most 1,000 characters.        |
| Ingredients                 | At most 100 in a recipe.                              |
| Ingredient `quantity`       | Greater than 0.                                       |
| Ingredient `resolved_grams` | Greater than 0, at most 100,000.                      |

- Lengths count characters, not bytes, as `foods_name_length_check` does in Amendment 6. The 200 for a name is that check's number, so a recipe name and a food name read alike.
- Blank means empty or only whitespace. The editors trim a name and every step before saving and drop blank steps (KEY-285). The database does not trim. It refuses blank text and text over the length, so a client other than the app cannot store what the app would never send.
- The ingredient count has a maximum and no minimum in the database. A recipe with no ingredients can be stored, because a client must not be locked out by a rule only the editors enforce (the argument of Amendment 4), and the editors require at least one.
- Unlike the bounds in Amendment 6, these are row rules and not only input rules. Amendment 6 left a bound off the stored food because a source records what it records. A recipe row is only ever typed by its owner, so there is no source to be tolerant of, and a bound on the row stops a direct API write from skipping it.
- The sizes are generous for a home recipe and keep the longest possible row (50 steps of 1,000 characters and 100 ingredient snapshots) well under a megabyte.
- Core exports each number as a constant from `@keylow/core/recipes` (KEY-284) and the migration (KEY-283) writes the same numbers into its checks and into `save_recipe`. If they ever differ, this table wins.

### Instructions

Answer: `recipes.instructions text[] not null default '{}'`. Step order is array order, so the first element is step 1. The whole list is replaced when a recipe is saved, so adding, editing, deleting and moving a step are all the same write: the editors build the new list (KEY-285) and `save_recipe` stores it. There is no per-step id, because M4 has no timers and no link from a step to an ingredient (Zee's ruling), so nothing refers to a single step. A recipe may have no steps, because the ruling asks that the editor can hold instructions and does not make them required.

A step is a line of text that is not null, not blank and at most 1,000 characters, and a recipe has at most 50 (see "The numbers"). A blank step is not stored. The editors drop blank steps when saving, and the database refuses one rather than dropping it, in the spirit of Amendment 7: a function that repaired its input would hide a client bug. A `check` cannot hold a subquery, so how the per-step checks are written (for example through an immutable helper function) is the migration's call. The bounds are the contract.

Why not a `recipe_steps` table. A table was considered and rejected for M4. It would need its own `owner_id`, its own policies and grants, a rewrite of the positions on every reorder (with a unique position that a naive move would collide with), and its own cascade and export handling, all for a feature that never addresses a single row. Why not a `jsonb` array. It has no advantage over `text[]`: it holds anything, so every element needs a type check, and a `text[]` already arrives and leaves PostgREST as a plain array of strings. If steps later gain timers or links to ingredients, they move to a table in a later amendment, and the move is a one-off read of the array.

Implemented by KEY-283 (the column and its checks), KEY-284 (the shape and the bounds as constants) and KEY-285 (the step operations and `normaliseSteps`).

### `recipes`

| Column         | Definition                                                                                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `owner_id`     | `uuid not null default auth.uid() references auth.users (id) on delete cascade`. The RLS with-check rejects any value but the caller's.                                               |
| `name`         | `text not null`, not blank, at most 200 characters.                                                                                                                                   |
| `servings`     | `numeric not null`, greater than 0 and at most 1,000. Fractional servings are allowed: a batch that makes 2.5 servings is a normal thing to say, and the maths divides by it as by 4. |
| `yield_grams`  | `numeric`, nullable. Null means no measured cooked weight. When present, greater than 0 and at most 100,000.                                                                          |
| `instructions` | `text[] not null default '{}'`, as in "Instructions".                                                                                                                                 |
| `computed`     | `jsonb not null`, with a check that it is an object. No default: a recipe is always saved with its cache. The shape is in "The `computed` cache".                                     |
| `is_archived`  | `boolean not null default false`.                                                                                                                                                     |

- Indexes: a plain `(owner_id, name)`, which serves the library (the caller's recipes in name order) and gives the cascade from `auth.users` an index on the referencing column, for the reason Amendment 2 gives for `portion_id`. The trigram index is in "Name search".
- A recipe is archived, never deleted. `is_archived` is set and cleared by a plain column update. An archived recipe stays readable, keeps its ingredients and stays referenced by the log entries that point at it. Row level security does not filter it. The library does, as the clients filter `deleted_at` on foods (Amendment 1).
- The library lists the caller's recipes by name, then `id`. Amendment 1 says no table has `updated_at`, so there is no "recently edited" order. If the approved M4 boards (KEY-292) ask for one, that is a later amendment that adds the column, not a silent addition.
- `owner_id` references `auth.users` with `on delete cascade`, so deleting the account deletes the recipes, and through them the ingredients.

Implemented by KEY-283.

### `recipe_ingredients`

| Column           | Definition                                                                                                                                                                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `recipe_id`      | `uuid not null references public.recipes (id) on delete cascade`. The frozen line names it.                                                                                                                                                     |
| `owner_id`       | `uuid not null default auth.uid() references auth.users (id) on delete cascade`. A denormalised copy of the recipe's `owner_id` for RLS, as `food_portions` has. The policy requires that it is the caller and that the recipe is the caller's. |
| `position`       | `integer not null`, at least 0. Unique with `recipe_id`.                                                                                                                                                                                        |
| `food_id`        | `uuid not null references public.foods (id)`, with no cascade.                                                                                                                                                                                  |
| `quantity`       | `numeric not null`, greater than 0.                                                                                                                                                                                                             |
| `unit`           | `text not null`. The unit is one of core's `quantityUnitSchema` (`g`, `ml`, `oz`, `fl_oz`, `portion`). Core validates it, as for log entries, and the database has no list of its own.                                                          |
| `portion_id`     | `uuid references public.food_portions (id) on delete set null`, with a plain index, exactly as Amendment 2 specifies for this table. Set only for the `portion` unit and only for a portion that is a table row. A spoon has `portion_id` null. |
| `resolved_grams` | `numeric not null`, greater than 0 and at most 100,000.                                                                                                                                                                                         |
| `snapshot`       | `jsonb not null`, with a check that it is an object.                                                                                                                                                                                            |

- `snapshot` is a `FoodSnapshot` exactly as `foodSnapshotSchema` in core defines it: kind `food`, `ref` the id of the food, built by `buildFoodSnapshot`. The ingredient therefore freezes the food's `per100`, its basis, the portion it was added with and the density that `densityForLogging` froze (the food's own, else the estimate for its group, else the density of its serving label such as "1 tbsp (15 g)"). A spoon ingredient has `portion_id` null and the snapshot portion `{ label, ml }`, as a log entry has. The snapshot's `quantity`, `unit`, `portion` and `resolvedGrams` repeat the columns, and core builds both from the same snapshot, as `foodEntryFields` does for entries. Amendment 2's `portion` rules apply unchanged.
- The freeze is the second invariant of the recipes brief. A later edit of the food, an Open Food Facts refresh or a retune of the density table never changes a stored ingredient. The only path by which a changed food reaches a recipe is "Refresh ingredients" (KEY-287 builds the new rows and the diff, KEY-290 saves them), which replaces the ingredients through `save_recipe` like any other edit.
- `food_id` has no cascade, the rule of `food_log_entries.food_id`. A custom food is soft deleted (Amendment 2, "Soft delete and `getFood`"), so an ingredient still resolves it. A plain index on `food_id` keeps the foreign key check from scanning the table when a user's foods go with their account, the reason Amendment 2 gives for `portion_id`.
- `position` is unique within a recipe through `unique (recipe_id, position)`. `save_recipe` assigns it from the index in the array, starting at 0, so a caller can neither repeat nor skip one. That index also serves reading a recipe's ingredients in order and the cascade from `recipes`.
- Ingredients are replaced as a whole on every save: the recipe's rows are deleted and the sent rows inserted. Their `id` is new each time, so nothing may reference an ingredient's id.
- A recipe has at most 100 ingredients (see "The numbers").

Implemented by KEY-283 (the table), KEY-284 (the shape and `buildRecipeIngredient`) and KEY-287 (the refresh).

### Saving a recipe is one transaction

Answer: a `security invoker` function, `public.save_recipe(p_recipe_id uuid, p_recipe jsonb, p_ingredients jsonb) returns uuid`. It creates the recipe when `p_recipe_id` is null and otherwise replaces the name, servings, yield, instructions, cache and ingredients of the caller's recipe, all or nothing.

Why a function. PostgREST has no transaction between calls, and a save writes the recipe row, replaces the ingredients and writes the cache. As separate requests each step has a failure that code in the client can only soften. An ingredient insert that fails after the delete leaves the recipe with no ingredients under a cache that describes the old ones. A reader between the calls sees half a recipe. Two devices saving at once can interleave and end with one device's ingredients under the other's cache. Amendment 7 made the same argument for the Open Food Facts store. The fallback, separate writes with a partial-write error as `copyDay` has (`CopyDayPartialWriteError`), is rejected. A half-copied day is still a set of valid entries. A recipe with half its ingredients is wrong data that its own cache contradicts, and the user would see a total that is not the sum of what is listed.

The function:

- is `language plpgsql volatile`, `security invoker`, with `set search_path = ''` and every name schema-qualified. It does not turn row level security off, so every policy in "Privileges and row level security" applies to its writes. The caller can only touch their own recipe, can only name foods and portions they can see, and a failed policy or constraint rolls back the whole call.
- takes `p_recipe` as an object with the keys `name`, `servings`, `yield_grams`, `instructions` (an array of strings) and `computed` (an object), and `p_ingredients` as an array of objects with the keys `food_id`, `quantity`, `unit`, `portion_id`, `resolved_grams` and `snapshot`, in the order they are to be listed. Keys the function does not know, among them `id`, `owner_id`, `is_archived`, `created_at`, `recipe_id` and `position`, are ignored, so a caller cannot set them. `is_archived` is neither read nor changed: a new recipe starts live and archiving stays a plain column update.
- refuses with `22023` (`invalid_parameter_value`), before anything is written: a `p_recipe` that is not an object, a `p_ingredients` that is not an array (a null counts as the wrong type), an ingredient that is not an object, a `computed` that is not an object, a name, a servings value or a yield outside "The numbers", an `instructions` that is not an array of strings, more than 50 steps or a null, blank or over-long step, and more than 100 ingredients. Each message states the rule and quotes no value, for example "a recipe has at most 50 steps".
- creates when `p_recipe_id` is null. The owner is the caller (the column default) and the database chooses the id, which is returned. A client never picks the id of a new recipe, so an id cannot be used to probe whether another user's recipe exists.
- updates when `p_recipe_id` is given. The update of the recipe row is the first write, with the caller's row level security. If it matches no row, because the recipe does not exist or is not the caller's (row level security makes the two look the same), the function raises `P0002` (`no_data_found`) and nothing else is written.
- then deletes the recipe's ingredients, inserts the sent ones with `position` the index in the array, and returns the recipe's id.
- is serialised per recipe by the row lock that first update takes. A second save of the same recipe waits, then replaces what the first wrote, and the last to commit wins. There is no optimistic concurrency, as for custom foods. As in Amendment 7, a constraint on the code follows: the update of the recipe row must stay the first write of the function.

`execute` is revoked from `public`, `anon` and `service_role` and granted to `authenticated` alone, as Amendment 3 does for `accept_terms`: the function acts on the caller and `service_role` has none.

Archive and unarchive stay plain column updates on `is_archived`. Duplicate is a client-side copy saved through the same function with a null `p_recipe_id`: the copy carries the stored ingredient snapshots as they are (frozen values stay frozen, and only a refresh moves them), the servings, the yield, the steps and the cache, and takes a name from the caller because the wording of "copy" is screen copy.

A table check that fails still puts the failing row in the detail of the Postgres error, and no function can remove that. The function checks everything a person types before it writes (the list above), so a step, a name or a figure does not reach a table check. A malformed ingredient row can, but core builds those rows, so only a hand-made call gets that far. The rule that no recipe value reaches a log is held at the client: an error from a recipe read or write carries the action and the code only (see "Health data").

Implemented by KEY-283 (the function and its pgTAP), KEY-289 (the repo calls it, and nothing else writes a recipe and its ingredients) and KEY-290 (the refresh saves through it).

### The `computed` cache

Answer: `recipes.computed` is written by the client with the recipe, computed by core `computeRecipe` at write time (the build plan's rule is that anything with a branch lives in core), in the same transaction as the ingredient change through `save_recipe`, so from the app it is never stale. The api-client repo computes it from the ingredients it is given and never accepts a cache from a caller (KEY-289). The database does not recompute or verify it. A hand-made call can store any cache for its own recipe. That is accepted, as it is for `nutrients` on a log entry: it is the owner's own data, and a log entry freezes its own copy of the figures it uses.

Its shape is a JSON object with these keys, named as the keys of a snapshot are:

| Key              | Value                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| `total`          | The nutrients of the whole recipe, in the `nutrientsSchema` key set.                                         |
| `perServing`     | `total` divided by `servings`.                                                                               |
| `per100g`        | `total` divided by `effectiveGrams`, times 100.                                                              |
| `totalGrams`     | The raw total: the sum of the ingredients' `resolved_grams`.                                                 |
| `effectiveGrams` | `yield_grams` when it is set, otherwise `totalGrams`.                                                        |
| `engineVersion`  | `NUTRITION_ENGINE_VERSION` at the time of the write. It is the version of the maths, as it is on a snapshot. |

- An ingredient's numbers come from `nutrientsOfSnapshot` of its own snapshot, so the cache is rebuilt from stored snapshots and never from a live food.
- Nothing is rounded. Only the screens round.
- The five required nutrient keys are always written, null when unknown. `sat_fat_g`, `sugars_g` and `salt_g` are written only when the sum has a value (Amendment 2's rule for an optional key).
- The null rule is the `day_totals` rule (KEY-182) and core `sumEntries`. A null nutrient on an ingredient is skipped in the sum, and a total is null only when every ingredient leaves it null. This is not `sumNutrients`, which makes the whole sum unknown when any term is. Consequently a total over ingredients that only partly record a nutrient is a floor for it, not an exact figure, as a day's total is. `perServing` and `per100g` keep a null as null.
- A recipe with no ingredients computes to: `totalGrams` 0, `effectiveGrams` the yield or 0, and `total`, `perServing` and `per100g` with every required key null. `per100g` is also null whenever `effectiveGrams` is 0, so the maths never divides by 0 and never produces `NaN` or `Infinity`. The database stores such a recipe. It cannot be logged, because a recipe snapshot needs an `effectiveGrams` above 0.
- The worked example is the chicken, rice and oil golden: 500 g chicken, 200 g dry rice and 20 g oil total 1496.8 kcal and 720 g raw. With a yield of 1,100 g and 4 servings, that is 374.2 kcal per serving and 136.0727 kcal per 100 g. With no yield, `effectiveGrams` is 720 and 275 g comes to 571.694 kcal (1496.8 × 275 / 720, corrected by Zee on 2026-10-16 from 571.8).

Implemented by KEY-284 (the shape, `computeRecipe` and the golden) and KEY-289 (the write).

### The recipe log entry snapshot

Answer: a new snapshot kind, `recipe`, at `v` 1, for `item_type = 'recipe'`. It freezes these fields, and only these:

| Field            | Value                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `v`              | `SNAPSHOT_VERSION`, which is 1.                                                                                                 |
| `kind`           | `recipe`.                                                                                                                       |
| `ref`            | The id of the recipe the snapshot was taken from.                                                                               |
| `name`           | The recipe's name.                                                                                                              |
| `servings`       | The recipe's servings.                                                                                                          |
| `yieldGrams`     | The recipe's yield, or null when it had none.                                                                                   |
| `effectiveGrams` | The recipe's `effectiveGrams`, greater than 0.                                                                                  |
| `total`          | The recipe's total nutrients, in the `nutrientsSchema` key set. One serving is therefore exactly `total` divided by `servings`. |
| `quantity`       | The amount logged, 0 or more.                                                                                                   |
| `unit`           | `serving` or `g`.                                                                                                               |
| `resolvedGrams`  | The grams the amount comes to.                                                                                                  |
| `engineVersion`  | `NUTRITION_ENGINE_VERSION` at the time of logging, as on a food snapshot.                                                       |

- There is no `portion` and no `density`. A recipe has neither: its grams are cooked weight.
- The entry freezes the totals and not the recipe. It does not freeze the ingredient list, the ingredients' own figures, the instructions, `totalGrams`, `perServing` or `per100g`. The entry only needs the nutrients, the rest is either derivable from `total` or none of the diary's business, and leaving the ingredients and steps out keeps a user's cooking habits out of the diary row.
- The entry's totals are read from the recipe's `computed` cache, which the user saw when they chose the amount. What the screen showed is what is logged, and logging needs one row and not the ingredients.
- Logging is by serving (unit `serving`, the quantity a number of servings) or by grams of cooked weight (unit `g`, `resolvedGrams` = the grams). These are the only two ways in M4. By serving, `resolvedGrams` is (quantity × `effectiveGrams`) / `servings`. The entry's `nutrients` are computed per nutrient key as (`total` × quantity) / `servings` for a serving and (`total` × grams) / `effectiveGrams` for grams, with nothing rounded. The evaluation order is part of the contract, because floating point makes the two orders differ in the last digits and the immutability contract promises bit-for-bit equality: core's one function evaluates in exactly that order, and the golden fixtures are generated with it. The `nutrients` carry the five required keys, plus `sat_fat_g`, `sugars_g` and `salt_g` when `total` has them, and never micronutrients (Amendment 2).
- The `nutrients` are rebuildable from the snapshot alone, bit for bit, as a food entry's are: no recipe row is read, and changing an entry's quantity or unit recomputes from its own snapshot and never from the live recipe. That is the immutability contract. One function in core builds, recomputes and previews, so the screen's number and the stored number agree to the digit.
- The entry row has `item_type = 'recipe'`, `recipe_id` the recipe's id, and `food_id` and `portion_id` null. The `food_log_entries_item_type_ids` check on main already requires exactly this for a recipe (`recipe_id is not null and food_id is null`). The columns `quantity`, `unit` and `resolved_grams` repeat the snapshot, as they do for a food.
- Editing the recipe later changes nothing about an entry already logged, and neither does archiving it. The entry keeps its frozen name and figures. Recipes are not deleted, so there is no case where a recipe vanishes.

`SNAPSHOT_VERSION` does not move. The `quick` kind was added at version 1 without a bump, so a new kind at version 1 is the precedent. `v` describes the shape of one kind, existing version 1 snapshots parse exactly as before, and no existing shape changes. `NUTRITION_ENGINE_VERSION` stays 1 for the same reason: the maths from a snapshot to its nutrients is unchanged for the kinds that exist, and the recipe snapshot records the same constant. `packages/core/test/fixtures/diary/goldenV1Snapshots.json` is untouched, and a PR that carries any change to it is wrong. A new golden fixture file for recipe snapshots is added instead (KEY-286 names it `goldenRecipeV1Snapshots.json`, beside the old one), with a test that rebuilds each entry's `nutrients` from its stored snapshot.

The unit is a separate two value enum of the recipe snapshot. `quantityUnitSchema` for foods stays as it is, with no `serving` in it (its comment says recipe servings are resolved elsewhere). Amendment 2 lists `serving` among the units that leave a food's `portion` null, which the code never carries, and this amendment does not edit that sentence.

Reads must learn the kind before any client writes it. Today core's `logEntryInsertSchema` is a union of food and quick, the api-client's `logEntrySchema` is built from it, the diary read does not select `recipe_id`, and the apps treat any entry that is not a food as a quick add. A recipe entry in a day would fail that day's parse. So core adds the kind (KEY-286) without widening what the api-client reads, the write hook (KEY-291) is exported and unused, and no client writes a recipe entry in any build whose diary cannot read one. The read support lands with the first diary screen slice, after the M4 canvas (KEY-292) is approved.

Implemented by KEY-286 (the schema, the entry builder, the recompute, the preview and the new golden file) and KEY-291 (the write).

### `food_log_entries.recipe_id`: foreign key, index and on-delete rule

Today `recipe_id` is a plain nullable uuid with no foreign key, and the diary migration says the M4 migration adds the constraint and the index when it creates `recipes`. Answer:

- `foreign key (recipe_id) references public.recipes (id)` with the default `no action` rule.
- A partial index on `food_log_entries (recipe_id) where recipe_id is not null`. Most rows are foods, so most rows have no recipe, and Postgres does not index the referencing side of a foreign key. The foreign key check does a lookup on `recipe_id = $1`, which this index serves.
- Nothing writes `recipe_id` today, so the count of rows with a non-null value should be 0. The migration checks the count before adding the constraint and reports it in its PR, because a non-zero count would make the constraint fail the deploy.
- `recipe_id` stays insert only: it is in the insert grant and not in the update grant, as on main. An entry never changes its recipe.

Why `no action`, with the others set aside:

- `on delete cascade` would delete diary history if a recipe row were ever removed. A log entry is a frozen record that must outlive its recipe, so removing a recipe must never take entries with it.
- `on delete set null` would turn a recipe entry into a row with no recipe, which `food_log_entries_item_type_ids` refuses. The delete would fail on that check, with a confusing error, and the rule would only pretend to clear the link.
- Nothing in the app deletes a recipe. Recipes are archived, and there is no `delete` grant (see "Privileges and row level security"). So the rule matters only for two things: a stray manual delete, which should be refused, and account deletion, which has to succeed.
- `restrict` is the same refusal for a stray delete, and cannot be deferred. It is not chosen because it is no safer than the default and gives the migration no way to defer the check if it ever has to.
- `no action` is the default, refuses a delete of a referenced recipe, and is the one rule that can be made `deferrable` without changing the foreign key's meaning. It was checked on PostgreSQL 17.6 in a model of this schema (users, recipes and entries, with the cascades in either order): deleting a user with a recipe and an entry on it succeeded under `no action`, under `deferrable initially deferred` and under `restrict`. Postgres queues every foreign key check and runs it after the cascade actions, which is why account deletion works. The pgTAP proof below confirms it on the real tables.

The model is not the real schema, so the migration proves it again on the real tables. The proof is a pgTAP assertion in KEY-283, in `packages/db/supabase/tests/recipes_rls.test.sql`: deleting an auth user who has recipes, ingredients and recipe log entries succeeds and leaves none of them. A throwaway user is used, in the style of the cascade check in `food_provenance_rls.test.sql`, and that user also has a custom food that one of their entries references, because the same question exists today for `food_log_entries.food_id` and a user's own foods. No test on main covers that case: the cascade check there deletes a user with foods and no entries. On main the entries' `user_id` cascade is created before `recipes` exists, so the proof exercises the entries-first order and is a regression guard. `deferrable initially deferred` stays a pre-authorised fallback only, not the rule: if the proof fails for `recipe_id`, the migration declares the foreign key that way, which moves the check to the end of the transaction, when every cascade has run. Nothing else in this section changes, and the PR says so. If it fails for `food_id`, that is reported and fixed on its own ticket and not folded into the recipes migration.

The insert policy gains a term. A foreign key is checked without row level security, so on its own it would let a user log against another user's recipe id. With `no action`, that entry would also block the other user's account deletion, because their cascade could not remove an entry owned by someone else, and a success against a failure would tell anyone whether a given id exists. This is the reason Amendment 2 and the diary migration give for `food_id` and `portion_id`. `food_log_entries_insert_own` therefore adds `recipe_id is null or exists (select 1 from public.recipes r where r.id = food_log_entries.recipe_id)`, to the terms it has. The subquery runs as the caller under the owner-only `recipes` policy, so only the caller's own recipes pass, and an id that does not exist fails the same way as one that is not theirs. The policy does not look at `is_archived`: archiving is a library filter and not a ban on logging. The update policy is unchanged because `recipe_id` is not updatable. A policy cannot be extended in place, so the migration replaces its expression with the existing terms plus this one.

Implemented by KEY-283.

### Privileges and row level security

Baseline, in the style of the diary migration: `revoke all` on both tables from `anon`, `authenticated` and `service_role`, then explicit column grants to `authenticated`. `anon` gets nothing. `service_role` gets nothing either, because nothing server side reads or writes recipes yet (M7's export decides what it needs, and grants it then). RLS is enabled on both tables.

`recipes`:

- `select` on all columns.
- `insert` on `owner_id`, `name`, `servings`, `yield_grams`, `instructions` and `computed`. `is_archived` is not insertable, so a new recipe starts live.
- `update` on `name`, `servings`, `yield_grams`, `instructions`, `computed` and `is_archived`. An update never changes `owner_id`, `id` or `created_at`.
- No `delete`. A recipe is archived, never deleted. Account deletion cascades regardless of grants, because a foreign key action does not run as the caller.

`recipe_ingredients`:

- `select` on all columns.
- `insert` on `recipe_id`, `owner_id`, `position`, `food_id`, `quantity`, `unit`, `portion_id`, `resolved_grams` and `snapshot`.
- `delete`, because ingredients are replaced as a whole.
- No `update`. A stored ingredient is never edited in place, so its frozen snapshot cannot be rewritten by a stray update. A refresh or an edit replaces the rows through `save_recipe`.

Policies, as predicates, all for `authenticated` and all using `(select auth.uid())`:

- `recipes_select_own`: using `owner_id = (select auth.uid())`.
- `recipes_insert_own`: with check `owner_id = (select auth.uid())`.
- `recipes_update_own`: using and with check `owner_id = (select auth.uid())`.
- `recipe_ingredients_select_own`: using `owner_id = (select auth.uid())`.
- `recipe_ingredients_insert_own`: with check `owner_id = (select auth.uid())`, and the recipe is the caller's (`exists (select 1 from public.recipes r where r.id = recipe_ingredients.recipe_id and r.owner_id = (select auth.uid()))`), and the food is visible to the caller (`exists (select 1 from public.foods f where f.id = recipe_ingredients.food_id)`), and the portion, when set, is visible to the caller (`portion_id is null or exists (select 1 from public.food_portions p where p.id = recipe_ingredients.portion_id)`). The `exists` subqueries run under the `foods`, `food_portions` and `recipes` policies, so only global rows and the caller's own pass, and an id that does not exist fails the same way as one that is not theirs. Without them a foreign key, which is checked without row level security, would let a user build a recipe on another user's private food, and the ingredient would then block that user's account deletion.
- `recipe_ingredients_delete_own`: using `owner_id = (select auth.uid())`.

There is no `delete` policy on `recipes`, because there is no grant. `save_recipe` is `security invoker`, so every predicate above applies to it. A column added later is not writable by clients until a migration grants it, the rule of Amendments 3 and 4.

Implemented by KEY-283, with pgTAP asserting every policy and the exact privilege set per table.

### Name search

Answer: a `gin (name extensions.gin_trgm_ops)` index on `recipes.name` (`pg_trgm` lives in the `extensions` schema and `foods` already uses it), and a case-insensitive `ilike` over the caller's own rows through PostgREST, with `%`, `_` and the escape character escaped by the client so that they match literally. There is no new search function and no RPC, so the api-client does not invent one. The table is per user and small, and row level security already scopes it to the caller.

The trigram index is not guaranteed to be used by a signed-in caller. Amendment 6 found that under row level security the planner refuses an index condition whose operator is not leakproof, and `ilike` may fall under the same restriction. That is not measured here and does not matter at this size, because the `(owner_id, name)` index narrows the read to the caller's own recipes before the pattern is applied. If a measured need ever appears, the answer is Amendment 6's helper pattern, in a later amendment.

Implemented by KEY-283 (the index) and KEY-288 (the query and the escaping).

### Health data

A recipe reveals dietary habits. Recipe and ingredient values and step text never appear in a log, an error report or an analytics event. Only ids and counts do. That covers a recipe's name, its ingredients, their amounts, the steps and every nutrient figure. The rule binds the code we write. PostgreSQL's own error log, and so the Supabase logs, can hold a failing row in the DETAIL of a check constraint violation ("Failing row contains ..."), which no client can prevent. That is why `save_recipe` checks every typed field before any write and refuses with value-free messages. The rule has three parts:

- `save_recipe` raises no `notice` or `warning` that quotes a value, and its own errors state the rule and not the value (see its section).
- No client code reads, logs or reports the message or detail of a database error from a recipe read or write. An error carries the action and the code only, which is how `targets.ts` builds its errors and what KEY-273 proposes as the shared helper (KEY-288 and KEY-289).
- Core's thrown errors state the rule and not the value (KEY-284 to KEY-287).

### Export and account deletion

There is no data export and no in-app account deletion today. Verified on main on 2026-10-16: the Privacy Policy and the Terms in `packages/core/src/copy/legal.ts` say that both are done by email for now and that the in-app versions "are on the way". The build lives in M7 (KEY-7, Settings: "export my data" and "delete account"). M4 builds neither screen. This amendment records the contract M7 will use:

- Export includes the user's recipes, ingredients and instructions: every column of their `recipes` rows (including `instructions` and `computed`) and of their `recipe_ingredients` rows in `position` order (including `snapshot`), together with their log entries and the recipe snapshots in them. The `service_role` grant that an export path needs is M7's to add.
- Account deletion works through the `on delete cascade` foreign keys from `auth.users`: `recipes.owner_id`, `recipe_ingredients.owner_id` and `recipe_ingredients.recipe_id` on the new tables, and `food_log_entries.user_id` on the diary. It needs no code, and it is the case the pgTAP proof in "`food_log_entries.recipe_id`" covers.
- The Privacy Policy already lists "Your custom foods and recipes", so no policy copy changes.

Implemented by KEY-283 (the cascades and their proof). The screens are KEY-7's.

### Sub-recipes

Sub-recipes (a recipe used as an ingredient) stay deferred, as the frozen `recipe_ingredients` line says, and belong to Housekeeping. Nothing in the schema anticipates them: `food_id` stays `not null`, and there is no second foreign key column on an ingredient.

### Implemented by

- KEY-283, the migration: `recipes` and `recipe_ingredients` with their checks and indexes, the trigram index, the foreign key and partial index on `food_log_entries.recipe_id`, the extended insert policy, the grants and policies, `save_recipe`, pgTAP (every policy, the exact privileges, the bounds, the atomic save and the account deletion proof) and the regenerated `packages/db/src/types.gen.ts`.
- KEY-284, core shapes and maths: the recipe, ingredient row and `computed` shapes, the numbers in "The numbers" as exported constants, `buildRecipeIngredient`, `computeRecipe` and the golden (with 571.694).
- KEY-285, core editor rules: the step operations, `normaliseSteps` and `validateRecipeDraft`, using those constants.
- KEY-286, core recipe log entry: the recipe snapshot and entry schemas, the builder, the recompute, the amount start and preview, and the new golden fixture file. `goldenV1Snapshots.json` is untouched.
- KEY-287, core refresh: the new ingredient rows from the current foods and the before and after diff.
- KEY-288, api-client reads: the library list in name order, one recipe with its ingredients and steps, and the name search without a function.
- KEY-289, api-client writes: create, edit, archive and duplicate through `save_recipe`, with the cache computed by `computeRecipe`.
- KEY-290, api-client refresh: preview and apply, saved through `save_recipe`.
- KEY-291, api-client log a serving: the write path only, unused by a screen until the diary reads recipe entries.
- KEY-7 (M7), outside this amendment: the export and delete account screens.

Any further deviation from the frozen Decision, from Amendments 1 to 7 or from this amendment needs an Amendment 9 before the migration or code that implements it lands.

## Amendment 9 (Weigh-ins and trend, 2026-10-18)

### Status

Recorded on 2026-10-18 under KEY-358. Implements Zee's rulings on KEY-5 (the M5 brief, weight and trend). The rulings are these:

- Of 2026-10-14, in the Build Plan: the health data rules recorded under "Health data" below.
- Of 2026-10-15: terms acceptance is not in any row level security policy, because Zee cancelled KEY-233 and left consent with the app gates.
- Of 2026-10-17: M5 builds Health Connect only, with no Apple support until Zee says otherwise. No M5 change is expected to alter the native fingerprint, so every M5 piece goes out over the air. The weight chart offers 1 week, 30 days, 90 days and 1 year (7, 30, 90 and 365 days).
- Of 2026-10-18: the Health import does not wait for KEY-278 (mobile error reporting with health data scrubbed).

The remaining details are interpretations made for implementation. They are, in full:

- the columns, types and checks of `weigh_ins`, among them `numeric(6,3)` for the weight, no default on `measured_at` and `source`, and the name `weigh_in_source` for the enum.
- the plain unique constraint that replaces the partial key, and the two reasons given for it.
- the check that pairs `external_id` with `source`, and that `import` may have either.
- the rules for `tz` and `local_date`, among them that an import uses the profile zone and that an edit of the time recomputes both.
- the note rule.
- that an imported weigh-in cannot be edited and that the api-client, and not the database, enforces it, and that soft-deleted rows are kept for good.
- the column grants and the three policies, and that `service_role` gets nothing.
- the two indexes.
- the trend output shape, the rule that gives a list row its status, and when the trend is settling.
- that the import anchor lives on the device in `expo-secure-store`, its key and value, the 7 day overlap, the 365 day first read, and when the anchor moves.
- that the 30 day Health Connect history limit is accepted and the history permission is not added.
- the accepted limits of import.
- the export and account deletion contract recorded for M7.
- the health data rules for weigh-ins.

Zee confirms them by approving the PR that carries this amendment. Amendments 1 to 8 are unchanged. The frozen Decision text is unchanged except for one inline note on the `weigh_ins` line, which "Supersedes" explains. This amendment replaces one key on the frozen `weigh_ins` line, adds one enum and fills in the columns the line names. It adds no table, because the frozen Decision already names `weigh_ins`. Amendment 1's `id` and `created_at` columns apply to it, as they do to every new table.

### Supersedes

The frozen `weigh_ins` line in the Decision changes in one way:

- `unique (user_id, source, external_id) where not null` becomes a plain `unique (user_id, source, external_id)` constraint. It is not partial, and it covers soft-deleted rows.

Nothing else on that line changes. The line carries an inline note pointing here, and the rest of the Decision is untouched. See "The import key outlives a delete" for the reasons.

No data is migrated. `weigh_ins` does not exist in any database yet (no migration creates it), so M5's migration (KEY-360) creates it with the plain constraint.

### The numbers

Every figure this amendment sets for weigh-ins is in this table, so that the migration and core use the same ones.

| What                                          | Rule                                                                                               | Core constant (KEY-361)              |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Weight (`weight_kg`)                          | `numeric(6,3)`, from 20 to 400 inclusive. Three decimals is one gram.                              | `WEIGH_IN_MIN_KG`, `WEIGH_IN_MAX_KG` |
| Weight typed and shown                        | One decimal. Core limits manual entry to one decimal. The column does not.                         |                                      |
| Weight stored                                 | The column rounds to 3 decimals, half away from zero, and the check applies to the rounded value.  |                                      |
| Note                                          | Null, or 1 to 200 characters.                                                                      | `WEIGH_IN_NOTE_MAX_CHARS`            |
| Health sample id (`external_id`)              | When present, 1 to 200 characters.                                                                 |                                      |
| Import overlap                                | Each import re-reads from 7 days before the anchor.                                                | `HEALTH_IMPORT_OVERLAP_DAYS`         |
| First import                                  | As far back as Health Connect allows, up to 365 days (the longest chart range).                    |                                      |
| Health Connect history without the permission | The 30 days before the date the read permission was first granted. A platform fact, not a choice.  |                                      |
| Chart ranges                                  | 7, 30, 90 and 365 days, in that order.                                                             | `WEIGHT_RANGES`                      |
| Settling                                      | Fewer than 7 accepted readings (days) on the last trend point.                                     | `TREND_SETTLED_OBS`                  |
| Gap that starts a new trend segment           | More than 30 days between readings. This is the engine parameter `maxGapDays`, which KEY-359 owns. |                                      |

- Lengths count characters, not bytes, as `foods_name_length_check` does in Amendment 6.
- The constants are named as KEY-361 names them. Core exports each one and the migration (KEY-360) writes the same numbers into its checks. If they ever differ, this table wins.
- Kilograms are the only stored unit. Pounds are display only (the Build Plan's rule for units).

### `weigh_ins`

| Column        | Definition                                                                                                                                   |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | `uuid primary key default gen_random_uuid()` (Amendment 1).                                                                                  |
| `user_id`     | `uuid not null default auth.uid() references auth.users (id) on delete cascade`. The RLS with-check rejects any value but the caller's.      |
| `measured_at` | `timestamptz not null`, with no default. The instant of the reading. The client always sends it, because `local_date` and `tz` depend on it. |
| `local_date`  | `date not null`. See "`local_date` and `tz`".                                                                                                |
| `tz`          | `text not null`. See "`local_date` and `tz`". The database does not validate it.                                                             |
| `weight_kg`   | `numeric(6,3) not null`, with a check that it is from 20 to 400 inclusive (`weight_kg between 20 and 400`).                                  |
| `source`      | `public.weigh_in_source not null`, with no default.                                                                                          |
| `external_id` | `text`, nullable, with the pairing check in "`source` and `external_id`".                                                                    |
| `note`        | `text`, nullable, with the check in "Note".                                                                                                  |
| `deleted_at`  | `timestamptz`, nullable. Null means live.                                                                                                    |
| `created_at`  | `timestamptz not null default now()` (Amendment 1).                                                                                          |

- Rounding. The column rounds what it is given to 3 decimals, half away from zero, and the check of 20 to 400 applies to the rounded value. So 19.9996 is stored as 20.000 and passes, and 19.9994 is stored as 19.999 and fails. A value of 1000 or more cannot be stored in `numeric(6,3)` and fails with "numeric field overflow" (SQLSTATE 22003) before the check runs. Core's Health sample mapper and manual-entry builder round to 3 decimals before sending, so the client and the column agree on what is stored.
- Precision. Three decimals keeps a smart scale's reading to the gram, so the trend sees what the scale reported. The screens show one decimal, and a manual entry is limited to one decimal by core (the entry sheet's rule, "Up to one decimal place"), not by the column.
- Several weigh-ins on one date are allowed, and nothing in the table limits them. The trend takes the median of a date's readings.
- `user_id` references `auth.users` with `on delete cascade`, so deleting the account deletes its weigh-ins, soft-deleted rows included.
- The names of the constraints are the migration's call. The rules are the contract.

Implemented by KEY-360.

### `source` and `external_id`

Answer: an enum `public.weigh_in_source ('manual', 'healthkit', 'health_connect', 'import')`. The four values are the frozen ones, in the style of Amendment 1's enums.

- M5 writes only `manual` and `health_connect`.
- There is no Apple support in M5 (Zee, 2026-10-17). `healthkit` stays in the enum so that a later HealthKit implementation needs no migration, but nothing writes it and no code reads it specially. The `HealthProvider` adapter stays, so HealthKit can be added later without rework.
- `import` is for a future file import. M5 does not build one.

`external_id` pairs with `source` in one check on the table:

- a `manual` row has a null `external_id`.
- a `healthkit` or `health_connect` row has an `external_id`, the Health sample id, of 1 to 200 characters.
- an `import` row may have either, and when it has one, it is 1 to 200 characters.

A `check` passes when its expression is null, and `char_length(null)` is null. Each branch that requires an id therefore spells out `external_id is not null and char_length(external_id) between 1 and 200`, and does not rely on the length test alone. The database does not trim `external_id`. It is a machine id and the client stores it as the platform gave it. Core's Health sample mapper returns null, and so skips the sample, for a sample id outside 1 to 200 characters, so one bad sample cannot fail a whole batch.

Implemented by KEY-360 (the enum and the check), KEY-361 (the mapper that sets both) and KEY-363 (the adapter that supplies the sample id).

### `local_date` and `tz`

Answer:

- `tz` is the IANA zone of the user's profile (`profiles.timezone`) at the moment the row is written.
- `local_date` is the calendar date of `measured_at` in that zone. The client computes it with core `toLocalDate`.
- `local_date` is never recomputed when the profile zone changes later. A stored weigh-in keeps its day, which is the precedent of Amendment 5 for a log entry. The difference from a log entry is that the weigh-in also stores the zone it used, so the day can be explained.
- An import uses the profile zone, not the zone offset of the Health sample. An offset is not a zone, and it is not safe across clock changes: the same offset belongs to many zones, and a zone's offset changes whenever its clocks change.
- When the user edits the time of a manual weigh-in, the client recomputes `local_date` and `tz` from the new `measured_at` and the profile zone at that moment, so the three change together as they do for a log entry's `logged_at` in Amendment 5. An edit of the value or the note touches none of them.
- The database does not check that `measured_at`, `local_date` and `tz` agree. The agreement depends on a zone the user can change, and a stored row keeps the day it was written on, as in Amendment 5.

The trend, the list and the chart ranges all group and filter by `local_date`, never by `measured_at`, so a day's weight does not move when a zone changes.

Implemented by KEY-361 (`buildManualWeighIn` and the Health sample mapper, which call `toLocalDate`) and KEY-362 (the edit).

### Note

Answer: `note` is optional. The client trims it and stores a blank note as null. When present it is 1 to 200 characters, enforced by a check on the column (`note is null or char_length(note) between 1 and 200`). The database does not trim, so a hand-made call can store a note of spaces. That is accepted: it is the owner's own data, and the screens treat a blank note as none.

A note is health data. It never appears in a log, an error report or an analytics event (see "Health data").

Implemented by KEY-360 (the check) and KEY-361 (`validateNote`).

### The import key outlives a delete

Answer: the frozen key becomes a plain constraint, `unique (user_id, source, external_id)`. It is not a partial index, and it covers every row, soft-deleted ones included. Postgres treats nulls as distinct in a unique constraint, so a plain constraint behaves exactly as the partial one did for manual rows, which all have a null `external_id`.

Why, in two parts:

1. A deleted import must never come back. Import re-reads an overlap window every time (see "Where the import anchor lives"), so a sample the user deleted is read again at the next import. If the key forgot the row when it was soft-deleted, the import would insert it a second time. With the key covering soft-deleted rows, the import skips it like any other duplicate. This is also what the weigh-in sheet tells the user: deleting an imported reading removes it from Ki-Lo only, and it "won't come back on the next import".
2. A partial index cannot serve the bulk import. `ON CONFLICT (user_id, source, external_id)` can infer a partial unique index only when the statement repeats the index predicate, and PostgREST's `on_conflict` takes column names only, so there is no way to repeat it. The import would fail with error 42P10. A plain constraint is inferred from the column list alone.

Part 2 was checked before it was written, on 2026-10-18, in one throwaway `psql` session against the local database (PostgreSQL 17.6, `docker exec -i supabase_db_keylow psql -U postgres -v ON_ERROR_STOP=1`, with `\set VERBOSITY verbose` so that the error shows its SQLSTATE). It used temporary tables only, which vanish when the session ends, so nothing real was created, altered or dropped. `p` has a partial unique index and `q` a plain constraint:

```sql
\set VERBOSITY verbose
create temp table p (a uuid, b text, c text);
create unique index on p (a, b, c) where c is not null;
create temp table q (a uuid, b text, c text, unique (a, b, c));
```

| Table                     | Statement                                                | Result                                                                                            |
| ------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `q`, plain constraint     | `insert ... on conflict (a, b, c) do nothing`, a new key | `INSERT 0 1`                                                                                      |
| `q`                       | the same statement with the same key                     | `INSERT 0 0`, and `q` still holds one row                                                         |
| `q`                       | the same statement twice with `c` null                   | `INSERT 0 1` both times, and `q` holds three rows, so null keys are distinct                      |
| `p`, partial unique index | `insert ... on conflict (a, b, c) do nothing`, a new key | `ERROR: 42P10: there is no unique or exclusion constraint matching the ON CONFLICT specification` |

So `p` raises 42P10 and `q` does not. With `on_error_stop` set, the session ended at that error, which is why `p` was run last.

Consequences:

- The import is one bulk insert that ignores duplicates (`on conflict (user_id, source, external_id) do nothing`, which PostgREST sends for an upsert with `ignoreDuplicates`). It needs no `update` grant on `source` or `external_id`.
- A soft-deleted row is kept for good, because it holds the key. See "Edit and delete rules".
- A user who deletes an imported reading and wants it back has no screen for that in M5. Clearing `deleted_at` restores a row, and nothing in M5 does it.

Implemented by KEY-360 (the constraint and its pgTAP) and KEY-362 (the bulk import and its proofs that a deleted import does not come back).

### Edit and delete rules

Answer:

- A manual weigh-in can be edited (value, time, note) and deleted.
- An imported weigh-in cannot be edited, only deleted. The weigh-in sheet says so ("Imported readings can only be deleted here."), and it shows a delete button and no save button for an imported reading.
- Delete is a soft delete: `deleted_at` is set. There is no `delete` grant and no hard delete.
- Clearing `deleted_at` restores a row. Nothing in M5 uses that.
- Soft-deleted rows are kept for good. They keep every column. A soft-deleted weigh-in therefore keeps its value and note until account deletion, because the row holds the import key. This matches the Privacy Policy, which keeps information until the account is deleted. Account deletion removes them through the `auth.users` cascade.

The database does not enforce the edit rule, because column grants cannot tell one row from another, and a trigger is more than the rule is worth. The api-client enforces it: it updates only rows with `source = 'manual'` (`.eq("source", "manual")`), and an update that matches no row is an error that holds no value. A soft delete applies to a row of any source, because `deleted_at` is in the update grant for every row. A hand-made call can therefore edit an imported row of its own. That is accepted, for the reason Amendment 8 gives for `computed`: it is the owner's own data, and the import key makes the next import skip the row regardless.

Implemented by KEY-362 (the repo functions and the hooks).

### Privileges and row level security

In the style of Amendment 8: `revoke all` on the table from `anon`, `authenticated` and `service_role`, then explicit column grants to `authenticated`. RLS is enabled.

- `select` on all columns.
- `insert` on `user_id`, `measured_at`, `local_date`, `tz`, `weight_kg`, `source`, `external_id` and `note`.
- `update` on `measured_at`, `local_date`, `tz`, `weight_kg`, `note` and `deleted_at`. `user_id`, `source` and `external_id` are insert only, so a row never changes owner, source or key.
- No `delete`. `id` and `created_at` are in neither list. Account deletion cascades regardless of grants, because a foreign key action does not run as the caller.
- `anon` gets nothing, and `service_role` gets nothing. Nothing server side reads or writes weigh-ins yet. M6's `run-checkin` reads weigh-ins to run `computeTrend`, and M7's export reads them too. Each grants what it needs in its own migration.

Policies, as predicates, all for `authenticated` and all using `(select auth.uid())`:

- `weigh_ins_select_own`: using `user_id = (select auth.uid())`.
- `weigh_ins_insert_own`: with check `user_id = (select auth.uid())`.
- `weigh_ins_update_own`: using and with check `user_id = (select auth.uid())`.

There is no `delete` policy, because there is no grant. Terms acceptance is not in the policies: Zee cancelled KEY-233 on 2026-10-15, and consent stays with the app gates. The select policy does not filter `deleted_at`. The clients filter it, as they do for foods (Amendment 1). A column added later is not writable by clients until a migration grants it, the rule of Amendments 3 and 4.

Implemented by KEY-360, with pgTAP asserting every policy and the exact privilege set.

### Indexes

- The unique constraint above. Its index leads with `user_id`.
- One list index, `(user_id, local_date desc, measured_at desc)`. It serves the list (newest first), the trend (the whole history of the caller, in date order) and the chart ranges (a `local_date` window). Ties are broken by `id` in the read and not in the index, as in Amendment 5.

Both indexes lead with `user_id`, so the cascade from `auth.users` has an index on the referencing column, for the reason Amendment 2 gives for `portion_id`. No other index is added. A partial index on live rows is not needed at this size.

Implemented by KEY-360.

### The trend output shape

This is the contract between core `computeTrend` and every reader of it. KEY-359 implements it, and a change to it is an amendment. `computeTrend` is the function ADR 0002 names. Its boundary and its purity rule are unchanged. M5 builds it ahead of the rest of the engine because the weight screen needs it.

<!-- prettier-ignore -->
```ts
// Input: one entry per live (not soft-deleted) weigh-in.
interface TrendInput { localDate: string; weightKg: number }   // YYYY-MM-DD, kg

// Output of computeTrend: one point per calendar day from the first to the last reading of
// each segment, in date order across segments. Nothing is rounded.
interface TrendPoint {
  date: string;          // YYYY-MM-DD
  segment: number;       // 0-based, goes up after a gap of more than maxGapDays between readings
  trendKg: number;       // the bias-corrected EWMA on that day
  rawKg: number | null;  // the daily median of that date's readings, null on a day with none
  usedKg: number;        // the value fed to the EWMA: the median, the winsorised median, or the fill
  rejected: boolean;     // the reading was rejected as an isolated spike (rawKg shows it, usedKg is the fill)
  winsorised: boolean;   // the reading was pulled to the winsor limit (84.0 used as 82.0)
  interpolated: boolean; // no accepted reading drove this day: a day with none, or a rejected day
  nObs: number;          // accepted readings (days) so far in this segment, this day included
}
```

- A weigh-in row's status in the list is the status of its date's point. The list marks a row rejected when its date's point has `rejected`, and every row of that date shares it.
- "Settling" is `nObs < 7` on the last point. The constant is `TREND_SETTLED_OBS`, and it lives in the core helpers (KEY-361).
- The last reading cannot be judged as a spike until a later one exists, so it shows as winsorised, not rejected, until then. The full rule belongs to `computeTrend` (KEY-359). A reading more than 15 per cent from the trend, once 5 accepted readings exist before it in its segment, is rejected when the next reading does not agree with it. Otherwise it is winsorised, or used as it is before 5 readings.
- The input is live rows only. Every reader drops soft-deleted rows before the call, and the api-client's list already returns live rows only.
- The trend is derived and never stored on its own. The mobile app runs `computeTrend` over its cached list (KEY-362), and the check-in function runs the same function over the same rows (M6).

Implemented by KEY-359 (the function and its golden numbers), KEY-361 (`weeklyRateKg` and `isTrendSettling`, which read these points) and KEY-362 (`useWeightTrend`, which exposes the points and a map from date to point).

### Where the import anchor lives

Answer: on the device, in `expo-secure-store`, one key per user. The key is `health-import-anchor.<user id>` and the value is an ISO instant. It is not in a table.

Why, written out:

- The anchor says how far this phone has read from this phone's Health Connect. In a table it would be shared with a second device of the same user, which would then start its read from a point the first device reached and skip data that its own Health Connect holds.
- A table needs a migration and a policy. The device store needs neither.
- The Build Plan has account deletion wipe the on-device secure store, so an anchor kept there goes with the account. AsyncStorage would not. M7 builds that deletion.
- Losing the anchor is harmless. It is an optimisation only, because the import key makes every import idempotent. With no anchor the next import reads the first-import window again and inserts nothing that is already there.
- The key uses only letters, digits, `.` and `-`, which `expo-secure-store` allows in a key.

The rules of the import, which KEY-364 implements:

- The anchor value is the timestamp of the newest sample read. It is never later than the device clock, and it never moves back.
- Each import re-reads from 7 days before the anchor, so a sample that arrives late with an older timestamp is still seen.
- The first import has no anchor and reads as far back as Health Connect allows, up to 365 days (the longest chart range).
- The anchor moves only after the save succeeded. A failed save leaves it untouched, so the next import reads the same window again.
- The import runs when the app comes to the foreground and on pull to refresh, and only while signed in.

Implemented by KEY-363 (the adapter, which reads and does not apply the overlap or move the anchor) and KEY-364 (the anchor store and the import runner).

### Health Connect's history limit

Answer: accept it. Without the `READ_HEALTH_DATA_HISTORY` permission, Android lets an app read only the 30 days before the date its read permission was first granted. `apps/mobile/app.json` declares only `android.permission.health.READ_WEIGHT`.

Why the permission is not added in M5, written out. Adding it edits the Android manifest, which changes the native fingerprint, and a new fingerprint needs a new APK. Zee ruled on 2026-10-17 that no M5 change is expected to alter the fingerprint, and that the Health Connect adapter ticket stops and comes back to Zee before any new APK. The ruling holds, so the permission waits for Zee. Adding it later loses nothing: the anchor would be cleared once so that the next import reads further back, and the import key skips every reading that is already stored.

The consequences:

- The first import brings in at most the 30 days before the permission was granted, even though the first-import window is 365 days. The window is the ceiling and the platform sets the floor.
- The limit is on the depth of history, not on new data. Once the permission is granted, every later reading is readable.
- A user's 90 day and 1 year ranges fill from there, from manual weigh-ins and from new readings.
- It is not verified here whether Android returns the allowed part of a window that starts before the limit or refuses it. If it refuses, the first import must ask for 30 days. KEY-363 reads the library and the Android documentation and reports which it is.

This is raised as a question for Zee on the pull request that carries this amendment: whether to add the permission in a later build. No code in M5 depends on the answer.

Implemented by KEY-363 (the first read) and KEY-364 (the runner).

### Accepted limits of import

- A sample edited later in Health Connect keeps its id, so the first imported value stays. The key skips the edited one.
- A sample deleted in Health Connect is not deleted here.
- A sample that reaches Health Connect more than 7 days after its timestamp, after a newer sample has already moved the anchor past it, is not imported. The overlap window is what catches late samples, and it is 7 days.
- Ki-Lo never writes weight back to Health. That is out of scope.
- There is no background delivery. Import runs on app foreground and on pull to refresh only (KEY-5, out of scope). No background task, observer or scheduled job is used.
- There is no Apple support in M5. `healthkit` stays in the enum.

### Health data

A weigh-in is health data (the Build Plan's rules of 2026-10-14). A weight value, a note and anything read from a Health sample (its id, its time and its value) never appear in a log, an error report or an analytics event. Only row ids and counts do. A row id is our own uuid. A Health sample id is not.

- An imported row keeps only the value, the timestamp and the sample id from the Health record. Nothing else the record carries (device, source app, metadata) is read or stored.
- The Privacy Policy already tells users that error reports never contain their weigh-ins, so this is a promise already made and not only a rule of the code.
- The rule binds the code we write. PostgreSQL's own error log, and so the Supabase logs, can hold a failing row in the DETAIL of a check violation, which no client can prevent. Core therefore checks the weight, the note and the sample id before they are sent, so a typed value does not reach a check.
- No client code reads, logs or reports the message or detail of a database error from a weigh-in read or write. An error carries the action and the code only, which is how `targets.ts` builds its errors.
- The import does not wait for KEY-278, by Zee's ruling of 2026-10-18. The rule is therefore held in the code that touches the data (KEY-361, KEY-362, KEY-363 and KEY-364), and not by a scrubber.

### Export and account deletion

There is no data export and no in-app account deletion today. Verified on main on 2026-10-18: the Privacy Policy and the Terms in `packages/core/src/copy/legal.ts` say that both are done by email for now and that the in-app versions "are on the way". No code on main exports or deletes an account. The build lives in M7 (KEY-7, Settings: "export my data" and "delete account"). M5 builds neither screen. This amendment records the contract M7 will use:

- Export includes every column of every `weigh_ins` row of the user, soft-deleted rows included. The `service_role` grant that an export path needs is M7's to add.
- Account deletion works through the `on delete cascade` foreign key from `auth.users` (`weigh_ins.user_id`). It needs no code. M7's deletion also wipes the on-device secure store, which holds the import anchor.
- The Privacy Policy already lists "Your weigh-ins, including any imported from Apple Health or Health Connect", so no policy copy changes. It was read in `packages/core/src/copy/legal.ts` for this amendment. The words "Apple Health" describe what the app may import, which stays true if HealthKit is added later, so they are left as they are.

Implemented by KEY-360 (the cascade and its proof). The screens are KEY-7's.

### Implemented by

- KEY-360, the migration and seed: the enum `weigh_in_source`, `weigh_ins` with its checks, the plain unique constraint and the list index, the grants and policies, pgTAP (every policy, the exact privileges, the bounds, the import key and the account deletion cascade), the regenerated `packages/db/src/types.gen.ts`, and weigh-ins in the seed.
- KEY-359, the engine: `computeTrend` and the `TrendInput` and `TrendPoint` shapes above, with the golden numbers.
- KEY-361, the core helpers: the constants in "The numbers", the weight and note checks, the manual weigh-in builder, display units, the weekly rate, settling, the chart ranges and the Health sample mapper.
- KEY-362, the api-client: the weigh-in repo and hooks (list, add, edit, delete), the trend over the cached list, and the bulk import that ignores duplicates.
- KEY-363, the Health adapter: the `HealthProvider` interface and the Health Connect implementation.
- KEY-364, the import runner: the anchor store, the runner with a single flight, and the foreground trigger.
- KEY-7 (M7), outside this amendment: the export and delete account screens.

### Consequences of Amendment 9

The migration (KEY-360) creates the enum, the table, the constraint, the index, the grants and the policies, and `packages/db/src/types.gen.ts` gains `weigh_ins` and `weigh_in_source`. Core, the api-client and the mobile app build to the numbers and the shapes above. Any further deviation from the frozen Decision, from Amendments 1 to 8 or from this amendment needs an Amendment 10 before the migration or code that implements it lands.

## Amendment 10 (Open Food Facts: products stored before the portion rules are fetched again, 2026-10-23)

### Status

Recorded on 2026-10-23 under KEY-521, part of KEY-516. It adds a rule to the `off-product` Edge Function, with no table, column, function or policy. The details are interpretations made for implementation. Zee confirms them by approving the PR that carries this amendment. The frozen Decision text and Amendments 1 to 9 are unchanged.

### The rule

Portions are written when an Open Food Facts product is stored, so a product stored before the pack portion (KEY-518) and the borrowed natural units (KEY-520) lacks them. Core exports `OFF_PORTION_RULES_FROM`, an ISO instant, and `isBeforePortionRules(fetchedAt)`, which is true when the fetch time is before it or cannot be parsed. The constant is `2026-10-23T02:16:15Z`: the moment the Deploy Supabase run for KEY-520, which also carried KEY-518, completed in production.

When `off-product` finds a cached food with `isBeforePortionRules(fetched_at)`, it fetches and stores the product inline, with the same call a first lookup makes, and charges the user and the global bucket as a first lookup does. The response carries the new portions and the new `fetched_at`. The store sets `fetched_at` from the database clock, which is after the constant, so each product is fetched again once. Re-requesting the product also brings its `packaging_tags`, so a refreshed product gets the best pack name.

If OFF fails, answers with something that cannot be used, no longer has the product (a 404), or a rate limit is reached, the cached product is returned as it is and no error is thrown. `fetched_at` is not moved then, so the next lookup tries again and is charged again. This is accepted: a product OFF has dropped, or returns in an unusable form, costs one call per lookup, which the per-user and global limits cap, and the alternative (moving `fetched_at` first, as the 90 day claim does) would leave a product that met a passing OFF failure with the old portions for 90 days.

The 90 day stale-while-revalidate rule and its claim (Amendment 7) are unchanged and apply to a food fetched at or after the constant. A food that is both before the constant and over 90 days old takes the new path.

### Changing the portion rules

Whoever changes the portion rules sets `OFF_PORTION_RULES_FROM` to the moment the change is live in production, in a change made after the deploy that carries the new rules has completed. The next lookup of each stored product then fetches it again. The date is never set earlier than the deploy: a product stored by the old rules after that date would not be fetched again. A product stored between that deploy and the date change is fetched once more, which is harmless. There is no backfill and no script. Logged diary entries are not touched: the snapshot, not the link, is the record (Amendment 2). As Amendment 2 accepts for any OFF refresh, the store replaces the food's portions, so `portion_id` is null on an entry that pointed at one of the old portions.

### Implemented by

- KEY-521: the constant and the predicate in `packages/core/src/foods/freshness.ts`, the decision in `supabase/functions/_shared/cachedLookupPlan.ts` and its use in `off-product`.

### Consequences of Amendment 10

`off-product` gains one branch and no migration. The app asking for the lookup of a product it already holds is KEY-522. Any further deviation from the frozen Decision, from Amendments 1 to 9 or from this amendment needs an Amendment 11 before the migration or code that implements it lands.

## Amendment 11 (Body measurements: body fat and lean mass, 2026-10-23)

### Status

Recorded on 2026-10-23 under KEY-569, part of KEY-5 (the M5 brief, body composition). It implements Zee's ruling of 2026-10-23 on KEY-5: body fat percentage and lean mass in kilograms are imported from Health Connect only, there is no manual entry in v1, and a smoothed trend comes later in core. The remaining details are interpretations made for implementation. They are, in full:

- that the readings live in a new table, `body_measurements`, and not in new columns on `weigh_ins`.
- the enum `body_measurement_kind` and its two values, and that the `weigh_in_source` enum is reused.
- the single `value` column, its type, and the per-kind bounds and rounding.
- the columns and the `external_id` pairing check.
- the plain import key, with `kind` in it.
- the column grants (`update` on `deleted_at` only), the three policies, and that `service_role` gets nothing.
- the list index.
- that the table is import only.
- the export and account deletion contract recorded for M7.
- the health data rules for body measurements.

Zee confirms them by approving the PR that carries this amendment. Amendments 1 to 10 are unchanged. The frozen Decision text is unchanged, because it names no table for body composition. This amendment adds one enum and one table.

### Why a new table

Health Connect delivers body fat (a `BodyFat` record) and lean mass (a `LeanBodyMass` record) as records of their own, each with its own sample id and timestamp. A smart scale writes the three at the same instant, but nothing ties them together, and either of the new two can arrive without a weight (a body fat reading from a different app, or a weight with no body composition). Columns on `weigh_ins` would need a second import key for each new column, would allow rows with no weight, and would force every weight list and the weight trend to hide them. A `kind` column also leaves room for bone mass or body water later without another table.

### The kind enum and the source enum

Answer: an enum `public.body_measurement_kind ('body_fat_pct', 'lean_mass_kg')`, in the style of Amendment 9's `weigh_in_source`. The values are listed in that order, and the order is part of the contract.

`source` reuses `public.weigh_in_source ('manual', 'healthkit', 'health_connect', 'import')`. The enum keeps its name, for three reasons:

- Renaming an enum, or adding a second one with the same four values, would touch a type that `weigh_ins` already uses in production, for no gain.
- The enum names where a reading came from, which is the same fact for a weight and for a body measurement. Both come from the same two platform stores or from a file import.
- A type name in the generated types is a name clients import. One source type for every body reading is simpler to read than two that must be kept equal.

M5 writes only `health_connect` to `body_measurements`. `manual`, `healthkit` and `import` stay valid so that a later entry screen or HealthKit needs no migration, and nothing writes them or reads them specially.

### The numbers

Every figure this amendment sets is in this table, so that the migration and core use the same ones.

| What                             | Rule                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------- |
| Body fat (`body_fat_pct`)        | Percentage points, from 1 to 75 inclusive.                                                        |
| Lean mass (`lean_mass_kg`)       | Kilograms, from 10 to 300 inclusive.                                                              |
| Value column                     | `numeric(6,3)` for both kinds. Three decimals is one thousandth of a point or of a kilogram.      |
| Value stored                     | The column rounds to 3 decimals, half away from zero, and the check applies to the rounded value. |
| Health sample id (`external_id`) | When present, 1 to 200 characters, counted in characters.                                         |

- The bounds are the planner's and they are written as one table check, so that the two kinds cannot drift apart: `(kind = 'body_fat_pct' and value between 1 and 75) or (kind = 'lean_mass_kg' and value between 10 and 300)`.
- A zero or an implausible reading is a sensor fault. Core skips it before it is sent (KEY-570), so the check is a backstop and not the first line.
- If a later amendment moves a bound, core's constants follow it. If they ever differ, this table wins.
- Kilograms are the only stored mass unit, as for weights. Pounds are display only.

### `body_measurements`

| Column        | Definition                                                                                                                              |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | `uuid primary key default gen_random_uuid()` (Amendment 1).                                                                             |
| `user_id`     | `uuid not null default auth.uid() references auth.users (id) on delete cascade`. The RLS with-check rejects any value but the caller's. |
| `kind`        | `public.body_measurement_kind not null`, with no default.                                                                               |
| `measured_at` | `timestamptz not null`, with no default. The instant of the reading, always sent by the client.                                         |
| `local_date`  | `date not null`. The rules of Amendment 9, "`local_date` and `tz`", apply unchanged.                                                    |
| `tz`          | `text not null`. The database does not validate it.                                                                                     |
| `value`       | `numeric(6,3) not null`, with the per-kind check in "The numbers".                                                                      |
| `source`      | `public.weigh_in_source not null`, with no default.                                                                                     |
| `external_id` | `text`, nullable, with the pairing check below.                                                                                         |
| `deleted_at`  | `timestamptz`, nullable. Null means live.                                                                                               |
| `created_at`  | `timestamptz not null default now()` (Amendment 1).                                                                                     |

- There is no `note` column. Nothing in M5 lets a user type against a body reading.
- Rounding works as Amendment 9 describes for the weight. So for body fat, 0.9996 is stored as 1.000 and passes, 0.9994 is stored as 0.999 and fails, 75.0004 is stored as 75.000 and passes, and 75.0006 is stored as 75.001 and fails. For lean mass, 9.9996 is stored as 10.000 and passes. A value of 1000 or more cannot be stored in `numeric(6,3)` and fails with "numeric field overflow" (SQLSTATE 22003) before the check runs.
- The check is cross-kind. A value of 30 is valid for both kinds, 5 is valid as body fat and refused as lean mass, and 150 is refused as body fat and valid as lean mass.
- Several readings of one kind on one date are allowed. A later trend takes the median of a date's readings, as the weight trend does.
- `user_id` references `auth.users` with `on delete cascade`, so deleting the account deletes its body measurements, soft-deleted rows included.
- The names of the constraints are the migration's call. The rules are the contract.

### `external_id` and the import key

`external_id` pairs with `source` in the same check as Amendment 9 sets for `weigh_ins`:

- a `manual` row has a null `external_id`.
- a `healthkit` or `health_connect` row has an `external_id`, the Health sample id, of 1 to 200 characters.
- an `import` row may have either, and when it has one, it is 1 to 200 characters.

A check passes when its expression is null, and `char_length(null)` is null, so each branch that requires an id spells out `external_id is not null`. Core's Health sample mapper returns null, and so skips the sample, for a sample id outside 1 to 200 characters.

The import key is a plain constraint, `unique (user_id, kind, source, external_id)`. It is not a partial index, and it covers every row, soft-deleted ones included. Amendment 9, "The import key outlives a delete", gives the two reasons: a deleted import must never come back at the next import, and PostgREST's `on_conflict` takes column names only, so a partial index fails with SQLSTATE 42P10. Those reasons hold here without change, and the proof recorded there is not repeated.

`kind` is in the key so that a sample id shared by two record types could never drop a reading silently. Health Connect gives each record its own id, and nothing promises that an id of a `BodyFat` record differs from an id of a `LeanBodyMass` record. With `kind` in the key, the same id under the other kind is a different reading and both are stored.

The bulk import is one insert that ignores duplicates (`on conflict (user_id, kind, source, external_id) do nothing`, which PostgREST sends for an upsert with `ignoreDuplicates`). It needs no `update` grant on any key column.

### Import only

M5 imports body fat and lean mass from Health Connect and builds no manual entry for them (Zee, 2026-10-23, who prefers sourced data to typing). If a typed body fat entry is wanted later, it is a screen and a core builder and needs no migration, because the insert grant, the `manual` source and the pairing check are already here.

Because the rows are imported, there is no edit of a value. A wrong reading is removed, not corrected, and the next import cannot bring it back, since the soft-deleted row holds the import key. Soft-deleted rows are kept for good, until the account is deleted, for the reason Amendment 9 gives in "Edit and delete rules".

### Privileges and row level security

In the style of Amendments 8 and 9: `revoke all` on the table from `anon`, `authenticated` and `service_role`, then explicit column grants to `authenticated`. RLS is enabled.

- `select` on all columns.
- `insert` on `user_id`, `kind`, `measured_at`, `local_date`, `tz`, `value`, `source` and `external_id`.
- `update` on `deleted_at` only. `user_id`, `kind`, `measured_at`, `local_date`, `tz`, `value`, `source` and `external_id` are insert only, so a row never changes owner, kind, value or key. The soft delete grant is there so that a later "remove this reading" screen needs no migration.
- No `delete`. `id` and `created_at` are in neither list. Account deletion cascades regardless of grants, because a foreign key action does not run as the caller.
- `anon` gets nothing, and `service_role` gets nothing. Nothing server side reads or writes body measurements yet. The M7 export grants what it needs in its own migration.

Policies, as predicates, all for `authenticated` and all using `(select auth.uid())`:

- `body_measurements_select_own`: using `user_id = (select auth.uid())`.
- `body_measurements_insert_own`: with check `user_id = (select auth.uid())`.
- `body_measurements_update_own`: using and with check `user_id = (select auth.uid())`.

There is no `delete` policy, because there is no grant. The select policy does not filter `deleted_at`, and the clients filter it. Terms acceptance is not in the policies, as in Amendment 9. A column added later is not writable by clients until a migration grants it.

### Indexes

- The unique constraint above. Its index leads with `user_id`.
- One list index, `(user_id, kind, local_date desc, measured_at desc)`. It serves the list of one kind, the trend over the whole history of a kind, and the range windows (a `local_date` window of one kind). Ties are broken by `id` in the read and not in the index, as in Amendment 5.

Both indexes lead with `user_id`, so the cascade from `auth.users` has an index on the referencing column. No other index is added.

### Health data

A body fat or lean mass reading is health data, under the same rules as a weigh-in (Amendment 9, "Health data"). A value and anything read from a Health sample (its id, its time and its value) never appear in a log, an error report or an analytics event. Only row ids and counts do.

- An imported row keeps only the value, the timestamp and the sample id from the Health record. Nothing else the record carries is read or stored.
- The rule binds the code we write. PostgreSQL's own error log, and so the Supabase logs, can hold a failing row in the DETAIL of a check violation, which no client can prevent. Core therefore checks the value and the sample id before they are sent (KEY-570).
- No client code reads, logs or reports the message or detail of a database error from a body measurement read or write. An error carries the action and the code only.
- The migration, the seed and the tests of KEY-569 neither log a value nor raise a notice with one.

### Export and account deletion

There is no data export and no in-app account deletion today (Amendment 9, "Export and account deletion"). This amendment adds to the contract M7 will use:

- Export includes every column of every `body_measurements` row of the user, soft-deleted rows included. The M7 export brief (KEY-7) must add this table to its list. The `service_role` grant that an export path needs is M7's to add.
- Account deletion works through the `on delete cascade` foreign key from `auth.users` (`body_measurements.user_id`) and needs no code.

The Privacy Policy lists the health data the app imports. KEY-574 names body fat and lean mass in the Privacy Policy and raises `TERMS_VERSION`, so this amendment changes no policy copy.

### Implemented by

- KEY-569, the migration and seed: the enum `body_measurement_kind`, `body_measurements` with its checks, the plain unique constraint and the list index, the grants and policies, pgTAP (every policy, the exact privileges, the bounds per kind, the import key and the account deletion cascade), the regenerated `packages/db/src/types.gen.ts`, and body measurements in the seed.
- KEY-570, the core helpers: the constants in "The numbers", the Health sample mappers and the smoothed trend. It builds to the numbers above and must not merge before this amendment is approved.
- KEY-571, the api-client: the list, the bulk import that ignores duplicates, and the trend over the cached list.
- KEY-574, the Privacy Policy: it names body fat and lean mass and raises `TERMS_VERSION`.
- KEY-7 (M7), outside this amendment: the export, which must include this table.

### Consequences of Amendment 11

The migration (KEY-569) creates the enum, the table, the constraint, the index, the grants and the policies, and `packages/db/src/types.gen.ts` gains `body_measurements` and `body_measurement_kind`. Core and the api-client build to the numbers above. The M7 export brief must add `body_measurements`. Any further deviation from the frozen Decision, from Amendments 1 to 10 or from this amendment needs an Amendment 12 before the migration or code that implements it lands.

## Amendment 12 (Setup wizard: programs, and the profile fields the wizard writes, 2026-10-23)

### Status

Recorded on 2026-10-23 under KEY-594, part of KEY-6 (the M6 brief, scopes 1 and 5). It implements Zee's rulings of 2026-10-23 on the setup wizard, quoted below. The frozen Decision names `programs` and lists its columns with no types, defaults or checks. This amendment gives them, and adds what the wizard needs around it: two enums, a type change and a check on `profiles`, and the marking of existing accounts as set up. ADR 0002, Amendment 1, holds the engine side (the starting estimate and how the wizard uses it). The remaining details are interpretations made for implementation. They are, in full:

- the enum `activity_level`, its values and their order, and the conversion of `profiles.activity` with a check that every value is null first.
- the check `sex in ('female', 'male', 'other')`, and that "prefer not to say" is stored as `other`.
- the enum `goal_type`, its values and their order.
- the types, defaults and checks of every `programs` column, among them that `rate_pct_per_week` is a magnitude checked together with `goal` in one check, the bounds of each numeric column, and that `split_preset` is `text` with a check and not an enum.
- that `dow_offsets_kcal` is an `int[]` with a length check and not `int[7]`, and that its elements are never null.
- the `updated_at` column, and that the client writes it.
- the partial unique index that makes one program active per user, that a recalculation updates the active row in place, and that the api-client reads the active row and does not upsert against that index.
- the column grants, among them that `user_id` is in no insert or update list, and the four policies. `anon` and `service_role` get nothing.
- that every profile that exists when the migration runs, with `onboarding_completed_at` null, is marked set up.
- that the wizard records the weight it was given as a `manual` weigh-in, the order in which it saves (weigh-in, program, profile last), and that "I'll set my own targets" stamps `onboarding_completed_at` and nothing else.
- that `handle_new_user()` is not changed by this amendment.
- the export and account deletion contract recorded for M7.
- the health data rules for programs.
- that `TERMS_VERSION` does not change.

Decided by the orchestrator on review, 2026-10-23. These are not Zee's rulings:

- what the wizard writes to `programs` on insert and on update, that `started_on` is insert only, and that a unique violation (SQLSTATE 23505) from a double press or a second device is step 2 with the code, after which a retry updates the active row.
- that the wizard writes `weight_unit` as `kg` or `lb` only when the stored value is null, never overwrites a stored value (`st` included), and enters weights in lb when `st` is stored.
- that the wizard skips the weigh-in whenever the weight entered equals the value of the user's latest weigh-in, not only today's.
- the exact check on `dow_offsets_kcal`, and that KEY-600 verifies its accept and reject cases.
- that `split_preset` values are the keys of the engine's params directly, with no mapping.
- that KEY-600's `seed.sql` marks the demo user set up.
- that how M6 sets the prior for an account with no stats is open.

The first list comes from the KEY-594 ticket's plan and the second was decided on review. Neither list is a ruling of Zee's: his rulings are quoted below, and he can overturn any interpretation here by a later amendment. Amendments 1 to 11 are unchanged. The frozen Decision text is unchanged except that two things on the `programs` line are realised in a form Postgres allows: `int[7]` becomes `int[]` with a length check, and "one active per user" becomes a partial unique index. Both are in "`programs`" below. This amendment adds one table and two enums, converts one `profiles` column and adds one `profiles` check.

### Zee's rulings

Zee, 2026-10-23, approved the ten recommended setup wizard answers on KEY-6 and KEY-594:

> "Yes, start M6 in its own session now, with the ten recommended setup wizard answers."

The ten answers, as approved, quoted in full with their original numbers:

> **1.** Questions. Sex (female, male, prefer not to say), date of birth, height, weight, one activity question with five levels, goal, rate, protein (moderate 1.6, high 2.0, very high 2.2 g/kg) and diet style (balanced, low fat, low carb). No keto, training type or workouts per week.
>
> **2.** Existing users. No forced wizard. Existing accounts are marked set up, and "Estimate my targets" on Targets runs the wizard prefilled.
>
> **3.** Body fat. Not asked.
>
> **4.** Safety.
>
> - Under 18 from the birth date: no "lose" goal, with a line to talk to a professional.
> - Under 13: not accepted.
> - Pregnancy and breastfeeding: a note on the goal step, with no question and nothing stored.
> - The engine guardrails apply to everyone and are shown when they change the result.
>
> **5.** Web. Mobile first. Web boards and tickets (W1 to W3) come after the mobile wizard has shipped and Zee has used it.
>
> **6.** Escape. First run offers "I'll set my own targets". Single questions cannot be skipped.
>
> **7.** Rates. Lose 0.25, 0.5, 0.75 or 1.0% a week, default 0.5. Gain 0.1, 0.25 or 0.5% a week, default 0.25. Each is also shown as kg (or lb) a week.
>
> **8.** Check-in weekday. Not asked now. M6 decides it.
>
> **9.** Landing. First run ends on the Diary. A recalculation returns to Targets.
>
> **10.** Milestone. The tickets are filed under M6, and the non-UI tickets start now.

Answers 1, 2, 3, 4, 6, 7 and 8 touch the data model, and the sections below apply them. Answers 5 (web), 9 (landing) and 10 (milestone) do not.

"Prefer not to say" is stored as `other`, as the KEY-594 comment of the same date records.

### What the wizard writes on `profiles`

The wizard adds no column to `profiles` and changes no grant. Every column it writes exists and is already granted for `insert` and `update` by Amendments 3 and 4:

| Column                                                                                    | What the wizard writes                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sex`                                                                                     | `female`, `male` or `other`. The check below applies.                                                                                                                                                                                                                  |
| `birth_date`                                                                              | The date of birth. Nothing is stored for an age under 13, which is not accepted.                                                                                                                                                                                       |
| `height_cm`                                                                               | The height.                                                                                                                                                                                                                                                            |
| `onboarding_weight_kg`                                                                    | The weight entered, on every run, so it is the weight of the most recent run. M6's first snapshot takes it as part of its prior (ADR 0002, Amendment 1).                                                                                                               |
| `activity`                                                                                | One of the five `activity_level` values.                                                                                                                                                                                                                               |
| `weight_unit`                                                                             | `kg` or `lb`, only when the stored `weight_unit` is null (the first set up). The wizard never overwrites a stored value, including `st`. When `st` is stored, the wizard's weight entry uses lb. The same goes for any other stored setting the wizard does not offer. |
| `target_kcal`, `target_protein_g`, `target_carbs_g`, `target_fat_g`, `targets_updated_at` | The result of `deriveTargets`, as the manual target (Amendment 4).                                                                                                                                                                                                     |
| `onboarding_completed_at`                                                                 | Set by the final update of a save, or alone by the escape. See "How the wizard saves".                                                                                                                                                                                 |

The wizard sets no `checkin_weekday` (Zee's ruling 8). Nothing about pregnancy or breastfeeding is stored (ruling 4), and there is no column for it. There is no body fat column (ruling 3). The wizard leaves `energy_unit` as it is, and any other stored setting it does not offer.

A column grant names the column and not its type, so converting `activity` below does not change any grant.

### How the wizard saves

"The stats" below means `sex`, `birth_date`, `height_cm`, `activity`, `weight_unit` and `onboarding_weight_kg`, the profile fields the core `startingPlan` hands the api-client (KEY-599). The api-client saves in this order (KEY-602):

1. **The weigh-in.** The weight entered is recorded as a `manual` weigh-in for today (Amendment 9), through the existing `addWeighIn` repo. It is skipped whenever the weight entered equals the value of the user's latest weigh-in, not only today's, so a recalculation does not write a stale value dated today.
2. **The program.** The active program is updated in place if there is one, and inserted if there is not. What each write carries is in "What the wizard writes to `programs`" below.
3. **The profile, last, in one update of the user's own row.** The stats, the four target columns, `targets_updated_at` and `onboarding_completed_at`, which is the client's time.

Because the profile is last, a failure at step 1 or 2 leaves `onboarding_completed_at` as it was, so the account is not marked set up and the user can try again. A retry after a failure in step 2 or 3 may add a second `manual` weigh-in for today. That is accepted, because the weight trend uses the median of a day's weigh-ins.

`onboarding_weight_kg` is the weight the wizard was given, written with the stats in step 3. The same weight is also the `manual` weigh-in of step 1, unless that step is skipped for the reason above, when a weigh-in of the same value already exists. M6's first snapshot reads `onboarding_weight_kg` as its prior's weight (ADR 0002, Amendment 1) and is not told to look at the weigh-in.

**The escape.** "I'll set my own targets" (Zee's ruling 6) writes `onboarding_completed_at` and nothing else, then opens Targets, so the first-run wizard does not appear again. It writes no stats, no program and no targets. This is how the draft of the first-run screen ticket (S7, in the KEY-6 document "Setup wizard UI tickets, to file when the canvas is approved") follows ruling 6.

### `activity_level` and `profiles.activity`

Answer: an enum `public.activity_level ('sedentary', 'light', 'moderate', 'very', 'extra')`, in that order, which is the order of the factors 1.2, 1.375, 1.55, 1.725 and 1.9 in ADR 0002, Amendment 1. The order is part of the contract.

`profiles.activity`, which `0001_init.sql` made `text`, becomes `public.activity_level`. No code writes the column today. The migration asserts that every value is null before it converts, and fails if one is not, so no value is ever guessed or lost.

### `profiles.sex`

`profiles.sex` stays `text` and gets the check `sex in ('female', 'male', 'other')`. A check passes on null, so a profile with no sex is valid. No code writes the column today, so the migration's new check fails loudly if a row holds another value, and the migration needs no separate assertion.

`other` is what the wizard stores for "prefer not to say". It is the value the engine reads as a BMR offset of −78, the mean of the two (ADR 0002, Amendment 1).

### `goal_type`

Answer: an enum `public.goal_type ('lose', 'maintain', 'gain')`, in that order.

### `programs`

| Column                      | Definition                                                                                                                                            |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                        | `uuid primary key default gen_random_uuid()` (Amendment 1).                                                                                           |
| `user_id`                   | `uuid not null default auth.uid() references auth.users (id) on delete cascade`.                                                                      |
| `goal`                      | `public.goal_type not null`, with no default.                                                                                                         |
| `rate_pct_per_week`         | `numeric not null`. A magnitude, in percent of body weight a week. Covered by the goal and rate check below.                                          |
| `protein_g_per_kg`          | `numeric not null`. Check: above 0 and at most 3.0.                                                                                                   |
| `fat_fraction_of_remaining` | `numeric not null`. Check: above 0 and below 1.                                                                                                       |
| `split_preset`              | `text not null`. Check: `split_preset in ('balanced', 'low_fat', 'low_carb')`.                                                                        |
| `dow_offsets_kcal`          | `int[] not null default '{0,0,0,0,0,0,0}'`. Check: length 7, no null element, elements sum to 0.                                                      |
| `goal_weight_kg`            | `numeric`, nullable. Check: null, or from 20 to 400 inclusive.                                                                                        |
| `started_on`                | `date not null`, with no default. The user's local date, sent by the client.                                                                          |
| `ended_on`                  | `date`, nullable. Null means the program is active. Check: null, or on or after `started_on`.                                                         |
| `next_checkin_date`         | `date`, nullable. M6 sets it. The wizard leaves it null.                                                                                              |
| `created_at`                | `timestamptz not null default now()` (Amendment 1).                                                                                                   |
| `updated_at`                | `timestamptz not null default now()`. The client writes it on every update, as it writes `targets_updated_at` (Amendment 4), and there is no trigger. |

- The goal and rate check is one check, so that the three goals cannot drift apart: `(goal = 'maintain' and rate_pct_per_week = 0) or (goal = 'lose' and rate_pct_per_week > 0 and rate_pct_per_week <= 1.0) or (goal = 'gain' and rate_pct_per_week > 0 and rate_pct_per_week <= 0.5)`. The rate is a magnitude, so a `lose` row holds 0.5, not −0.5, and the direction is the goal. The bounds are the engine's rate caps (1.0 a week to lose, 0.5 a week to gain). The wizard offers fewer rates than the check admits (Zee's ruling 7: lose 0.25, 0.5, 0.75 or 1.0, default 0.5, gain 0.1, 0.25 or 0.5, default 0.25). Because the bounds equal the engine's rate caps, a stored rate never makes the engine record `max_rate`.
- `protein_g_per_kg` and `fat_fraction_of_remaining` are the engine's protein and fat inputs. The wizard's protein presets (1.6, 2.0 and 2.2 g/kg) and the fat fractions that go with the diet styles (balanced 0.40, low fat 0.28, low carb 0.60) are core's, in `@keylow/core/setup`. No check pairs `split_preset` with `fat_fraction_of_remaining`.
- `split_preset` is stored in snake_case (`balanced`, `low_fat`, `low_carb`) and is `text` with a check, not an enum. These three values are the keys of the engine's fat fraction params directly (ADR 0002, Amendment 1), so no mapping is needed.
- `dow_offsets_kcal` is `int[]` and not the frozen `int[7]`, because Postgres ignores a declared array size, so the length is a check. The elements must not be null, because a null element would make the sum null and a check passes on null. A check cannot use a subquery, so the check is written out in full, and the migration uses it: `cardinality(dow_offsets_kcal) = 7 and array_position(dow_offsets_kcal, null) is null and dow_offsets_kcal[1] + dow_offsets_kcal[2] + dow_offsets_kcal[3] + dow_offsets_kcal[4] + dow_offsets_kcal[5] + dow_offsets_kcal[6] + dow_offsets_kcal[7] = 0`. KEY-600 verifies its accept and reject cases (seven zeros, a sum that is not 0, six or eight elements, a null element) in a rolled-back transaction. The wizard leaves the default of seven zeros, and the day-of-week UI is v2. The engine and the column support offsets in v1 (the Build Plan).
- `goal_weight_kg` is not asked by the wizard and stays null. It uses the same 20 to 400 range as a weight (Amendment 9).
- The names of the constraints are the migration's call. The rules are the contract.

### One active program per user

A unique index on `(user_id) where ended_on is null`. A user has at most one row with a null `ended_on`, which is the frozen "one active per user".

- A recalculation (the wizard run again from "Estimate my targets") updates the active row in place, and so does M6's "edit program". It does not end one row and insert another.
- Ending a program is setting `ended_on`. After that the user may start another.
- The index is partial, so PostgREST's `on_conflict` cannot name it, for the reason Amendment 9 gives in "The import key outlives a delete". The api-client therefore reads the active row (`ended_on is null`) and then inserts or updates it. It does not upsert.
- The index leads with `user_id`, so the cascade from `auth.users` has an index on the referencing column. No other index is added.

### What the wizard writes to `programs`

- **On insert** (the first save): `goal`, `rate_pct_per_week`, `protein_g_per_kg`, `fat_fraction_of_remaining`, `split_preset`, `started_on` (today, the user's local date) and `updated_at`.
- **On update of the active row** (a recalculation): `goal`, `rate_pct_per_week`, `protein_g_per_kg`, `fat_fraction_of_remaining`, `split_preset` and `updated_at` only. `started_on` is insert only, so a recalculation does not move it.
- **Never written by the wizard:** `dow_offsets_kcal`, `goal_weight_kg`, `next_checkin_date` and `ended_on`.
- A double press, or a second device saving for the first time at the same moment, can make two inserts race. The one-active index refuses the second with a unique violation (SQLSTATE 23505). That surfaces as step 2 plus the code, and a retry then finds the active row and updates it.

### Privileges and row level security

In the style of Amendments 8 and 9: `revoke all` on the table from `anon`, `authenticated` and `service_role`, then explicit grants to `authenticated`. RLS is enabled.

- `select` and `delete` on the table.
- `insert` and `update` on every column except `id`, `user_id` and `created_at`. That is `goal`, `rate_pct_per_week`, `protein_g_per_kg`, `fat_fraction_of_remaining`, `split_preset`, `dow_offsets_kcal`, `goal_weight_kg`, `started_on`, `ended_on`, `next_checkin_date` and `updated_at`.
- `user_id` is in neither list. A column default applies to a column the caller cannot write, so every inserted row gets `auth.uid()`, a row can never be inserted for another user, and no row ever changes owner.
- `anon` gets nothing, and `service_role` gets nothing. Nothing server side reads or writes programs yet. M6's amendment grants the service role what `run-checkin` needs.

Policies, as predicates, all for `authenticated` and all using `(select auth.uid())`:

- `programs_select_own`: using `user_id = (select auth.uid())`.
- `programs_insert_own`: with check `user_id = (select auth.uid())`.
- `programs_update_own`: using and with check `user_id = (select auth.uid())`.
- `programs_delete_own`: using `user_id = (select auth.uid())`.

Terms acceptance is not in the policies, as in Amendment 9. A column added later is not writable by clients until a migration grants it, the rule of Amendments 3 and 4.

### Existing accounts are marked set up

Zee's ruling 2 is that there is no forced wizard and that existing accounts are marked set up. The migration therefore sets `onboarding_completed_at = now()` on every profile that exists when it runs and has `onboarding_completed_at` null. A profile that already has a value keeps it.

An account created later has `onboarding_completed_at` null, because `handle_new_user()` is not changed by this amendment (see Amendment 3), and so sees the first-run wizard. "Estimate my targets" on Targets runs the wizard prefilled for an account already marked set up.

### Health data

A program row is health data: the goal, the rate and the goal weight are, as are the profile stats the wizard writes (Zee, 2026-10-14, in the KEY-6 brief). They are collected because the engine uses them, and nothing beyond them is. A value from a program or from the wizard's inputs never appears in a log, an error report or an analytics event. Only row ids and counts do. No client code reads, logs or reports the message or detail of a database error from a program read or write. An error carries the action and the code only. The migration, the seed and the tests neither log a value nor raise a notice with one.

The safety rules of ADR 0002, Amendment 1 (no "lose" goal under 18, nothing accepted under 13) are product rules in `@keylow/core/setup`. The database holds no check on age, and nothing about pregnancy or breastfeeding is stored.

### Export and account deletion

There is no data export and no in-app account deletion today (Amendment 9, "Export and account deletion"). This amendment adds to the contract M7 will use:

- Export includes every column of every `programs` row of the user, ended rows included. The M7 export brief (KEY-7) must add this table to its list. The `service_role` grant that an export path needs is M7's to add.
- Account deletion works through the `on delete cascade` foreign key from `auth.users` (`programs.user_id`) and needs no code.

### Terms

The Privacy Policy already lists "Your profile stats." and "Your goals, your targets and your expenditure estimates.", in `packages/core/src/copy/legal.ts`. The wizard stores nothing that is not on that list, so no policy copy changes and `TERMS_VERSION` does not change.

### Open

- The check-in weekday and `next_checkin_date`. Zee's ruling 8 is that M6 decides the weekday. The wizard writes neither.
- The service role's grants on `programs`, and the tables `expenditure_snapshots` and `targets`. M6 builds them, with their own amendment.
- The web wizard. Zee's ruling 5 puts the web boards and tickets (W1 to W3) after the mobile wizard has shipped and Zee has used it. They need no schema change.
- The prior for an account with no stats. An existing account marked set up whose profile has null stats, and a user who took the escape, has nothing to compute the starting estimate from. M6 decides what its first snapshot uses (ADR 0002, Amendment 1).

### Implemented by

- KEY-600, the migration and seed: the enums `activity_level` and `goal_type`, the conversion of `profiles.activity`, the check on `profiles.sex`, `programs` with its checks, the partial unique index, the grants and policies, existing accounts marked set up, `seed.sql` marking the demo user set up, pgTAP (every policy, the exact privileges, each check, the one-active index and the account deletion cascade), and the regenerated `packages/db/src/types.gen.ts`.
- `seed.sql` marks the demo user set up (`onboarding_completed_at` set). `handle_new_user` creates the demo profile with `onboarding_completed_at` null, after the migration's backfill has run, so without this the first-run gate would trap the demo user and any end-to-end flow. It is a file change only. Nobody reseeds the shared stack.
- KEY-601 and KEY-602, the api-client: reading and saving the setup, including the read of the active program and the insert or update that follows.
- KEY-595 to KEY-599, the core side, ADR 0002 Amendment 1.
- KEY-7 (M7), outside this amendment: the export, which must include this table.

### Consequences of Amendment 12

The migration (KEY-600) creates the enums, the table, the checks, the index, the grants and the policies, converts `profiles.activity`, adds the check on `profiles.sex` and marks existing accounts set up, and `packages/db/src/types.gen.ts` gains `programs`, `activity_level` and `goal_type`. Core and the api-client build to the numbers above. The M7 export brief must add `programs`. Any further deviation from the frozen Decision, from Amendments 1 to 11 or from this amendment needs an Amendment 13 before the migration or code that implements it lands.
