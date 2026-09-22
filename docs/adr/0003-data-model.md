# 0003: Data model (Supabase Postgres)

## Status

Accepted, 2026-09-22

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
