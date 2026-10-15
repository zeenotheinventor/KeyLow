-- day_totals_and_profile_targets: the `day_totals` view and the manual
-- calorie and macro target columns on `profiles` (KEY-182). The view follows
-- the frozen Decision in docs/adr/0003-data-model.md and Amendment 5 (it groups
-- by `local_date`, never by `logged_at`). The target columns, their checks and
-- their grants are exactly Amendment 4.
--
-- These are health data. Nothing here logs a row value.

-- The view sums every nutrient with a cast to numeric, so a non-number value
-- under any of them would make `select * from day_totals` fail with 22P02 for
-- that user. The entries CHECK from the diary migration type-checks the five
-- required keys only, so it is dropped and re-added with every term it had plus
-- the same number-or-null test for the three optional keys. An absent optional
-- key has a null jsonb_typeof, so it passes.
alter table public.food_log_entries
  drop constraint food_log_entries_nutrients_required_keys;

alter table public.food_log_entries
  add constraint food_log_entries_nutrients_required_keys check (
    jsonb_typeof(nutrients) = 'object'
    and nutrients ?& array['kcal', 'protein_g', 'fat_g', 'carbs_g', 'fibre_g']
    and jsonb_typeof(nutrients -> 'kcal') in ('number', 'null')
    and jsonb_typeof(nutrients -> 'protein_g') in ('number', 'null')
    and jsonb_typeof(nutrients -> 'fat_g') in ('number', 'null')
    and jsonb_typeof(nutrients -> 'carbs_g') in ('number', 'null')
    and jsonb_typeof(nutrients -> 'fibre_g') in ('number', 'null')
    and jsonb_typeof(nutrients -> 'sat_fat_g') in ('number', 'null')
    and jsonb_typeof(nutrients -> 'sugars_g') in ('number', 'null')
    and jsonb_typeof(nutrients -> 'salt_g') in ('number', 'null')
  );

-- A day's totals: one row per user per local day that has at least one live
-- entry, summing the entries' `nutrients` for the five required keys and the
-- three optional ones, plus how many entries the day has.
--
-- Null handling: a null nutrient is skipped in the sum. `sum()` ignores nulls,
-- so a day where some entries leave a key unknown (null or absent) totals the
-- entries that know it, and the total is null, never 0, only when every entry
-- leaves the key unknown. The day's total is therefore a floor for the
-- nutrient, not an exact figure, when only some entries know it. This is the
-- rule recorded on the `day_totals` line of the ADR.
--
-- Soft deleted entries (`deleted_at` set) are left out, and a day whose entries
-- are all deleted has no row. `security_invoker` makes the view run with the
-- caller's privileges, so the owner-only row level security on
-- `food_log_entries` filters it: a user sees only their own days, and the view
-- needs no policy of its own.
--
-- `entry_count` counts the live entries, including one with every nutrient
-- null.
create view public.day_totals
with (security_invoker = true) as
select
  user_id,
  local_date,
  sum((nutrients ->> 'kcal')::numeric) as kcal,
  sum((nutrients ->> 'protein_g')::numeric) as protein_g,
  sum((nutrients ->> 'fat_g')::numeric) as fat_g,
  sum((nutrients ->> 'carbs_g')::numeric) as carbs_g,
  sum((nutrients ->> 'fibre_g')::numeric) as fibre_g,
  sum((nutrients ->> 'sat_fat_g')::numeric) as sat_fat_g,
  sum((nutrients ->> 'sugars_g')::numeric) as sugars_g,
  sum((nutrients ->> 'salt_g')::numeric) as salt_g,
  count(*)::int as entry_count
from public.food_log_entries
where deleted_at is null
group by user_id, local_date;

-- Set the privileges explicitly, as for the tables (see 0001_init.sql): start
-- from a clean slate and grant back only a read for signed-in users. The anon
-- and service roles keep nothing (nothing server side reads the view, and the
-- default ACL would otherwise leave the service role every privilege on it).
-- The view is read only: it has no write grant, and it could not be written
-- through anyway because it aggregates.
revoke all on public.day_totals from anon, authenticated, service_role;

grant select on public.day_totals to authenticated;

-- The manual target (ADR 0003, Amendment 4): the daily calorie and macro
-- target a user types in More, which the diary reads until M6's live `targets`
-- replace it. Every column is nullable and independent: null means no target
-- for that column alone. A check passes on null, so none needs a null rule.
alter table public.profiles
  add column target_kcal int,
  add column target_protein_g numeric,
  add column target_carbs_g numeric,
  add column target_fat_g numeric,
  add column targets_updated_at timestamptz;

-- 800 to 6000 kcal is the app's confirmed range. The macros have no upper
-- bound. `numeric >= 0` accepts NaN and Infinity, the same accepted risk as the
-- nutrient columns on `foods`.
alter table public.profiles
  add constraint profiles_target_kcal_range
  check (target_kcal between 800 and 6000);

alter table public.profiles
  add constraint profiles_target_macros_nonnegative
  check (target_protein_g >= 0 and target_carbs_g >= 0 and target_fat_g >= 0);

-- Widen the column grants from profile_terms_acceptance by the five new
-- columns, in `insert` and in `update`. The lists are restated in full so they
-- can be read against Amendment 4:
--   * the terms columns and `created_at` stay out of both, as before.
--   * `id` stays in insert only.
--   * `targets_updated_at` is written by the client at save time. It records
--     nothing a client could gain by forging, so it needs no trigger.
-- Select and delete are unchanged, and select is table wide, so the owner
-- reads the new columns with no further grant.
revoke insert, update on public.profiles from authenticated;

grant insert (
  id, sex, birth_date, height_cm, activity, weight_unit, energy_unit, timezone,
  checkin_weekday, onboarding_weight_kg, onboarding_completed_at,
  target_kcal, target_protein_g, target_carbs_g, target_fat_g, targets_updated_at
) on public.profiles to authenticated;

grant update (
  sex, birth_date, height_cm, activity, weight_unit, energy_unit, timezone,
  checkin_weekday, onboarding_weight_kg, onboarding_completed_at,
  target_kcal, target_protein_g, target_carbs_g, target_fat_g, targets_updated_at
) on public.profiles to authenticated;
