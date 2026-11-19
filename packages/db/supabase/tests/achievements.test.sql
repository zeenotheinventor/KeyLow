-- Asserts the achievements storage and its one read (ADR 0003, Amendment 26): the user_achievements
-- table, the streak_freeze_events ledger, profiles.achievements_backfilled_at, record_achievements and
-- achievement_stats.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so nothing
-- created here persists. Every fixture id starts with 10840000 and every name or email with k1084 or
-- key1084. Each assertion reads one fixture user's rows, never a whole table. Each actor is entered
-- with `set local role` plus the JWT claims that `auth.uid()` reads, and left with `reset role`.
--
-- Four users. A has a little of everything and is the user whose stats are read in full. B is a
-- stranger with rows of their own, to prove nothing crosses. C has nothing, and calls
-- record_achievements. D has the backfill mark already set.

begin;

select plan(116);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '10840000-0000-4000-8000-0000000000aa', 'authenticated', 'authenticated', 'key1084-a@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '10840000-0000-4000-8000-0000000000bb', 'authenticated', 'authenticated', 'key1084-b@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '10840000-0000-4000-8000-0000000000cc', 'authenticated', 'authenticated', 'key1084-c@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '10840000-0000-4000-8000-0000000000dd', 'authenticated', 'authenticated', 'key1084-d@keylow.test');

-- ---------------------------------------------------------------------------------------------
-- Fixtures, inserted as postgres so row level security does not apply.
-- ---------------------------------------------------------------------------------------------

-- Profiles exist through the on_auth_user_created trigger. A lives in New York, which is UTC-5 in
-- January, so every local time below is its UTC time minus five hours.
update public.profiles set
  timezone = 'America/New_York',
  created_at = '2026-01-01 12:00:00+00',
  onboarding_completed_at = '2026-01-02 12:00:00+00',
  targets_updated_at = '2026-01-20 12:00:00+00',
  target_kcal = 2100, target_protein_g = 150, target_carbs_g = 220, target_fat_g = 70
where id = '10840000-0000-4000-8000-0000000000aa';

update public.profiles set achievements_backfilled_at = '2026-01-01 00:00:00+00'
where id = '10840000-0000-4000-8000-0000000000dd';

-- Foods, recipes and exercises of A. F1 is a favourite and has two live logs and one deleted log. F2
-- is not a favourite and has three live logs, to prove only favourites count.
insert into public.foods (id, source, owner_id, name, basis) values
  ('10840000-0000-4000-8000-00000000f1f1', 'user', '10840000-0000-4000-8000-0000000000aa', 'k1084-food-1', 'per_100g'),
  ('10840000-0000-4000-8000-00000000f1f2', 'user', '10840000-0000-4000-8000-0000000000aa', 'k1084-food-2', 'per_100g'),
  ('10840000-0000-4000-8000-00000000f1f3', 'user', '10840000-0000-4000-8000-0000000000aa', 'k1084-food-3', 'per_100g'),
  ('10840000-0000-4000-8000-00000000f1fb', 'user', '10840000-0000-4000-8000-0000000000bb', 'k1084-food-b', 'per_100g');

insert into public.recipes (id, owner_id, name, servings, is_archived, computed) values
  ('10840000-0000-4000-8000-00000000c001', '10840000-0000-4000-8000-0000000000aa', 'k1084-recipe-1', 2, false, '{}'),
  ('10840000-0000-4000-8000-00000000c002', '10840000-0000-4000-8000-0000000000aa', 'k1084-recipe-2', 2, false, '{}'),
  ('10840000-0000-4000-8000-00000000c003', '10840000-0000-4000-8000-0000000000aa', 'k1084-recipe-archived', 2, true, '{}');

insert into public.food_favourites (owner_id, food_id) values
  ('10840000-0000-4000-8000-0000000000aa', '10840000-0000-4000-8000-00000000f1f1');
insert into public.recipe_favourites (owner_id, recipe_id) values
  ('10840000-0000-4000-8000-0000000000aa', '10840000-0000-4000-8000-00000000c001');

-- Diary entries of A. Local time is created_at minus five hours.
--   a0  F2, 2025-12-20, before the window.
--   a1  quick, 2026-01-10, 09:00 local.
--   a2  F1, 2026-01-10, 01:30 local, inside 00:00 to 04:00.
--   a3  soft deleted, 2026-01-10, 00:00 local, with huge nutrients that would move every total.
--   a4  F1, 2026-01-11, 10:00 local.      a5  recipe 1, 2026-01-11, 12:00 local.
--   a6  recipe 1, 2026-01-12, 08:00 local.
--   a7  recipe 1, 2026-01-13, 09:00 local.  a8  F2, 2026-01-13, 11:00 local.
--   a11 F2, 2026-01-13, 03:15 local, inside 00:00 to 04:00.
--   a9  F3, 2026-01-19, exactly 04:00:00 local, which is outside the window (it ends before 04:00).
--   a10 soft deleted F3 on 2026-01-02, so F3 is not first logged then.
--   a12 soft deleted F1.
insert into public.food_log_entries (id, user_id, local_date, logged_at, created_at, item_type, food_id, recipe_id, snapshot, nutrients, deleted_at) values
  ('10840000-0000-4000-8000-0000000003a0', '10840000-0000-4000-8000-0000000000aa', '2025-12-20', '2025-12-20 15:00:00+00', '2025-12-20 15:00:00+00', 'food', '10840000-0000-4000-8000-00000000f1f2', null, '{"kind":"food"}',
    '{"kcal":100,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}', null),
  ('10840000-0000-4000-8000-0000000003a1', '10840000-0000-4000-8000-0000000000aa', '2026-01-10', '2026-01-10 14:00:00+00', '2026-01-10 14:00:00+00', 'quick', null, null, '{"kind":"quick","label":"k1084-1"}',
    '{"kcal":500,"protein_g":30,"fat_g":10,"carbs_g":50,"fibre_g":5}', null),
  ('10840000-0000-4000-8000-0000000003a2', '10840000-0000-4000-8000-0000000000aa', '2026-01-10', '2026-01-10 06:30:00+00', '2026-01-10 06:30:00+00', 'food', '10840000-0000-4000-8000-00000000f1f1', null, '{"kind":"food"}',
    '{"kcal":300,"protein_g":20,"fat_g":5,"carbs_g":30,"fibre_g":3}', null),
  ('10840000-0000-4000-8000-0000000003a3', '10840000-0000-4000-8000-0000000000aa', '2026-01-10', '2026-01-10 05:00:00+00', '2026-01-10 05:00:00+00', 'quick', null, null, '{"kind":"quick","label":"k1084-deleted"}',
    '{"kcal":9000,"protein_g":900,"fat_g":900,"carbs_g":900,"fibre_g":900}', '2026-01-10 05:05:00+00'),
  ('10840000-0000-4000-8000-0000000003a4', '10840000-0000-4000-8000-0000000000aa', '2026-01-11', '2026-01-11 15:00:00+00', '2026-01-11 15:00:00+00', 'food', '10840000-0000-4000-8000-00000000f1f1', null, '{"kind":"food"}',
    '{"kcal":400,"protein_g":25,"fat_g":8,"carbs_g":40,"fibre_g":4}', null),
  ('10840000-0000-4000-8000-0000000003a5', '10840000-0000-4000-8000-0000000000aa', '2026-01-11', '2026-01-11 17:00:00+00', '2026-01-11 17:00:00+00', 'recipe', null, '10840000-0000-4000-8000-00000000c001', '{"kind":"recipe"}',
    '{"kcal":600,"protein_g":35,"fat_g":20,"carbs_g":60,"fibre_g":6}', null),
  ('10840000-0000-4000-8000-0000000003a6', '10840000-0000-4000-8000-0000000000aa', '2026-01-12', '2026-01-12 13:00:00+00', '2026-01-12 13:00:00+00', 'recipe', null, '10840000-0000-4000-8000-00000000c001', '{"kind":"recipe"}',
    '{"kcal":700,"protein_g":40,"fat_g":25,"carbs_g":70,"fibre_g":7}', null),
  ('10840000-0000-4000-8000-0000000003a7', '10840000-0000-4000-8000-0000000000aa', '2026-01-13', '2026-01-13 14:00:00+00', '2026-01-13 14:00:00+00', 'recipe', null, '10840000-0000-4000-8000-00000000c001', '{"kind":"recipe"}',
    '{"kcal":500,"protein_g":30,"fat_g":15,"carbs_g":50,"fibre_g":5}', null),
  ('10840000-0000-4000-8000-0000000003a8', '10840000-0000-4000-8000-0000000000aa', '2026-01-13', '2026-01-13 16:00:00+00', '2026-01-13 16:00:00+00', 'food', '10840000-0000-4000-8000-00000000f1f2', null, '{"kind":"food"}',
    '{"kcal":200,"protein_g":10,"fat_g":5,"carbs_g":20,"fibre_g":2}', null),
  ('10840000-0000-4000-8000-0000000003b1', '10840000-0000-4000-8000-0000000000aa', '2026-01-13', '2026-01-13 08:15:00+00', '2026-01-13 08:15:00+00', 'food', '10840000-0000-4000-8000-00000000f1f2', null, '{"kind":"food"}',
    '{"kcal":100,"protein_g":5,"fat_g":2,"carbs_g":10,"fibre_g":1}', null),
  ('10840000-0000-4000-8000-0000000003a9', '10840000-0000-4000-8000-0000000000aa', '2026-01-19', '2026-01-19 09:00:00+00', '2026-01-19 09:00:00+00', 'food', '10840000-0000-4000-8000-00000000f1f3', null, '{"kind":"food"}',
    '{"kcal":300,"protein_g":20,"fat_g":10,"carbs_g":30,"fibre_g":3}', null),
  ('10840000-0000-4000-8000-0000000003b0', '10840000-0000-4000-8000-0000000000aa', '2026-01-02', '2026-01-02 12:00:00+00', '2026-01-02 12:00:00+00', 'food', '10840000-0000-4000-8000-00000000f1f3', null, '{"kind":"food"}',
    '{"kcal":50,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}', '2026-01-02 12:05:00+00'),
  ('10840000-0000-4000-8000-0000000003b2', '10840000-0000-4000-8000-0000000000aa', '2026-01-14', '2026-01-14 12:00:00+00', '2026-01-14 12:00:00+00', 'food', '10840000-0000-4000-8000-00000000f1f1', null, '{"kind":"food"}',
    '{"kcal":50,"protein_g":1,"fat_g":1,"carbs_g":1,"fibre_g":1}', '2026-01-14 12:05:00+00');

-- Day completion of A. The 15th is complete with no entry, the 16th is open with no entry.
insert into public.day_logs (user_id, local_date, is_complete, completed_at) values
  ('10840000-0000-4000-8000-0000000000aa', '2026-01-11', true, '2026-01-12 03:00:00+00'),
  ('10840000-0000-4000-8000-0000000000aa', '2026-01-15', true, '2026-01-15 23:00:00+00'),
  ('10840000-0000-4000-8000-0000000000aa', '2026-01-16', false, null);

-- Weigh-ins of A. Each reads in its own row's zone: w1 and w3 are before 09:00 in New York, w5 is
-- 08:00 in Auckland (which would be 14:00 in New York). w4 is soft deleted, w0 is before the window.
insert into public.weigh_ins (user_id, measured_at, local_date, tz, weight_kg, deleted_at, source) values
  ('10840000-0000-4000-8000-0000000000aa', '2025-12-20 20:00:00+00', '2025-12-20', 'America/New_York', 71, null, 'manual'),
  ('10840000-0000-4000-8000-0000000000aa', '2026-01-10 11:00:00+00', '2026-01-10', 'America/New_York', 71, null, 'manual'),
  ('10840000-0000-4000-8000-0000000000aa', '2026-01-12 15:00:00+00', '2026-01-12', 'America/New_York', 71, null, 'manual'),
  ('10840000-0000-4000-8000-0000000000aa', '2026-01-12 12:00:00+00', '2026-01-12', 'America/New_York', 71, null, 'manual'),
  ('10840000-0000-4000-8000-0000000000aa', '2026-01-14 11:00:00+00', '2026-01-14', 'America/New_York', 71, '2026-01-14 12:00:00+00', 'manual'),
  ('10840000-0000-4000-8000-0000000000aa', '2026-01-13 19:00:00+00', '2026-01-14', 'Pacific/Auckland', 71, null, 'manual');

insert into public.body_measurements (user_id, kind, measured_at, local_date, tz, value, source, deleted_at) values
  ('10840000-0000-4000-8000-0000000000aa', 'body_fat_pct', '2026-01-10 11:00:00+00', '2026-01-10', 'America/New_York', 20, 'manual', null),
  ('10840000-0000-4000-8000-0000000000aa', 'lean_mass_kg', '2026-01-10 11:00:00+00', '2026-01-10', 'America/New_York', 60, 'manual', null),
  ('10840000-0000-4000-8000-0000000000aa', 'body_fat_pct', '2026-01-11 11:00:00+00', '2026-01-11', 'America/New_York', 21, 'manual', '2026-01-11 12:00:00+00');

-- Exercises of A. E1 trains quads (legs) and, as a secondary muscle, lats (back). E2 trains the upper
-- chest. E3 trains lats (back). Only primary muscles count for a week's groups.
insert into public.exercises (id, owner_id, source, name, equipment, mechanic) values
  ('10840000-0000-4000-8000-00000000e001', '10840000-0000-4000-8000-0000000000aa', 'user', 'k1084-exercise-1', 'barbell', 'compound'),
  ('10840000-0000-4000-8000-00000000e002', '10840000-0000-4000-8000-0000000000aa', 'user', 'k1084-exercise-2', 'barbell', 'compound'),
  ('10840000-0000-4000-8000-00000000e003', '10840000-0000-4000-8000-0000000000aa', 'user', 'k1084-exercise-3', 'cable', 'compound');
insert into public.exercise_muscles (exercise_id, owner_id, muscle_id, role, weight) values
  ('10840000-0000-4000-8000-00000000e001', '10840000-0000-4000-8000-0000000000aa', 'quads', 'primary', 1),
  ('10840000-0000-4000-8000-00000000e001', '10840000-0000-4000-8000-0000000000aa', 'lats', 'secondary', 0.5),
  ('10840000-0000-4000-8000-00000000e002', '10840000-0000-4000-8000-0000000000aa', 'chest_upper', 'primary', 1),
  ('10840000-0000-4000-8000-00000000e002', '10840000-0000-4000-8000-0000000000aa', 'triceps', 'secondary', 0.5),
  ('10840000-0000-4000-8000-00000000e003', '10840000-0000-4000-8000-0000000000aa', 'lats', 'primary', 1),
  ('10840000-0000-4000-8000-00000000e003', '10840000-0000-4000-8000-0000000000aa', 'biceps', 'secondary', 0.5);

-- Sessions of A, all in New York.
--   s1 finished, 2026-01-12, started 06:30 local (before 07:00).
--   s2 finished, 2026-01-13, started 21:30 local (from 21:00).
--   s3 finished, 2026-01-20, started 10:00 local, six working sets.
--   s4 finished then soft deleted, with a heavy set that must not count.
--   s6 finished, 2025-12-22, before the window.
--   s5 still open, with a set that must not count.
insert into public.workout_sessions (id, user_id, started_at, ended_at, local_date, tz, deleted_at) values
  ('10840000-0000-4000-8000-00000000a001', '10840000-0000-4000-8000-0000000000aa', '2026-01-12 11:30:00+00', '2026-01-12 12:30:00+00', '2026-01-12', 'America/New_York', null),
  ('10840000-0000-4000-8000-00000000a002', '10840000-0000-4000-8000-0000000000aa', '2026-01-14 02:30:00+00', '2026-01-14 03:30:00+00', '2026-01-13', 'America/New_York', null),
  ('10840000-0000-4000-8000-00000000a003', '10840000-0000-4000-8000-0000000000aa', '2026-01-20 15:00:00+00', '2026-01-20 16:00:00+00', '2026-01-20', 'America/New_York', null),
  ('10840000-0000-4000-8000-00000000a004', '10840000-0000-4000-8000-0000000000aa', '2026-01-15 15:00:00+00', '2026-01-15 16:00:00+00', '2026-01-15', 'America/New_York', null),
  ('10840000-0000-4000-8000-00000000a006', '10840000-0000-4000-8000-0000000000aa', '2025-12-22 15:00:00+00', '2025-12-22 16:00:00+00', '2025-12-22', 'America/New_York', null),
  ('10840000-0000-4000-8000-00000000a005', '10840000-0000-4000-8000-0000000000aa', '2026-01-21 15:00:00+00', null, '2026-01-21', 'America/New_York', null);

insert into public.workout_sets (session_id, user_id, exercise_id, position, set_type, reps, load_kg, performed_at, snapshot, deleted_at) values
  ('10840000-0000-4000-8000-00000000a001', '10840000-0000-4000-8000-0000000000aa', '10840000-0000-4000-8000-00000000e001', 0, 'working', 5, 100, '2026-01-12 11:40:00+00', '{"version":"1"}', null),
  ('10840000-0000-4000-8000-00000000a001', '10840000-0000-4000-8000-0000000000aa', '10840000-0000-4000-8000-00000000e001', 1, 'working', 3, 110, '2026-01-12 11:50:00+00', '{"version":"1"}', null),
  ('10840000-0000-4000-8000-00000000a001', '10840000-0000-4000-8000-0000000000aa', '10840000-0000-4000-8000-00000000e001', 2, 'warmup', 10, 40, '2026-01-12 11:35:00+00', '{"version":"1"}', null),
  ('10840000-0000-4000-8000-00000000a001', '10840000-0000-4000-8000-0000000000aa', '10840000-0000-4000-8000-00000000e002', 3, 'working', 8, 60, '2026-01-12 12:00:00+00', '{"version":"1"}', null),
  ('10840000-0000-4000-8000-00000000a001', '10840000-0000-4000-8000-0000000000aa', '10840000-0000-4000-8000-00000000e002', 4, 'working', 12, null, '2026-01-12 12:10:00+00', '{"version":"1"}', null),
  ('10840000-0000-4000-8000-00000000a001', '10840000-0000-4000-8000-0000000000aa', '10840000-0000-4000-8000-00000000e001', 5, 'working', 5, 200, '2026-01-12 12:20:00+00', '{"version":"1"}', '2026-01-12 12:21:00+00'),
  ('10840000-0000-4000-8000-00000000a002', '10840000-0000-4000-8000-0000000000aa', '10840000-0000-4000-8000-00000000e003', 0, 'working', 10, 80, '2026-01-14 02:40:00+00', '{"version":"1"}', null),
  ('10840000-0000-4000-8000-00000000a002', '10840000-0000-4000-8000-0000000000aa', '10840000-0000-4000-8000-00000000e003', 1, 'working', 12, 80, '2026-01-14 02:50:00+00', '{"version":"1"}', null),
  ('10840000-0000-4000-8000-00000000a002', '10840000-0000-4000-8000-0000000000aa', '10840000-0000-4000-8000-00000000e002', 2, 'working', 8, 62.5, '2026-01-14 03:00:00+00', '{"version":"1"}', null),
  ('10840000-0000-4000-8000-00000000a003', '10840000-0000-4000-8000-0000000000aa', '10840000-0000-4000-8000-00000000e001', 0, 'working', 5, 100, '2026-01-20 15:10:00+00', '{"version":"1"}', null),
  ('10840000-0000-4000-8000-00000000a003', '10840000-0000-4000-8000-0000000000aa', '10840000-0000-4000-8000-00000000e001', 1, 'working', 5, 100, '2026-01-20 15:15:00+00', '{"version":"1"}', null),
  ('10840000-0000-4000-8000-00000000a003', '10840000-0000-4000-8000-0000000000aa', '10840000-0000-4000-8000-00000000e001', 2, 'working', 5, 100, '2026-01-20 15:20:00+00', '{"version":"1"}', null),
  ('10840000-0000-4000-8000-00000000a003', '10840000-0000-4000-8000-0000000000aa', '10840000-0000-4000-8000-00000000e001', 3, 'working', 5, 100, '2026-01-20 15:25:00+00', '{"version":"1"}', null),
  ('10840000-0000-4000-8000-00000000a003', '10840000-0000-4000-8000-0000000000aa', '10840000-0000-4000-8000-00000000e001', 4, 'drop', 5, 100, '2026-01-20 15:30:00+00', '{"version":"1"}', null),
  ('10840000-0000-4000-8000-00000000a003', '10840000-0000-4000-8000-0000000000aa', '10840000-0000-4000-8000-00000000e001', 5, 'failure', 5, 100, '2026-01-20 15:35:00+00', '{"version":"1"}', null),
  ('10840000-0000-4000-8000-00000000a004', '10840000-0000-4000-8000-0000000000aa', '10840000-0000-4000-8000-00000000e002', 0, 'working', 5, 500, '2026-01-15 15:10:00+00', '{"version":"1"}', null),
  ('10840000-0000-4000-8000-00000000a006', '10840000-0000-4000-8000-0000000000aa', '10840000-0000-4000-8000-00000000e001', 0, 'working', 5, 90, '2025-12-22 15:10:00+00', '{"version":"1"}', null),
  ('10840000-0000-4000-8000-00000000a005', '10840000-0000-4000-8000-0000000000aa', '10840000-0000-4000-8000-00000000e001', 0, 'working', 5, 50, '2026-01-21 15:10:00+00', '{"version":"1"}', null);

update public.workout_sessions set deleted_at = '2026-01-15 17:00:00+00' where id = '10840000-0000-4000-8000-00000000a004';

-- Training goals, routines and the active routine's days.
insert into public.training_goals (user_id, goal, focus, days_per_week, session_minutes, equipment, experience, muscle_priority, params_version, effective_from, effective_to) values
  ('10840000-0000-4000-8000-0000000000aa', 'strength', '{}', 3, 45, '{barbell}', 'beginner', '{}', 'k1084-params', '2026-01-01 00:00:00+00', '2026-01-15 00:00:00+00'),
  ('10840000-0000-4000-8000-0000000000aa', 'strength', '{}', 4, 45, '{barbell}', 'beginner', '{}', 'k1084-params', '2026-01-15 00:00:00+00', null);

insert into public.routines (id, user_id, name, is_active, is_archived) values
  ('10840000-0000-4000-8000-00000000b001', '10840000-0000-4000-8000-0000000000aa', 'k1084-routine-active', true, false),
  ('10840000-0000-4000-8000-00000000b002', '10840000-0000-4000-8000-0000000000aa', 'k1084-routine-archived', false, true),
  ('10840000-0000-4000-8000-00000000b003', '10840000-0000-4000-8000-0000000000aa', 'k1084-routine-idle', false, false);
insert into public.routine_days (routine_id, user_id, position, name) values
  ('10840000-0000-4000-8000-00000000b001', '10840000-0000-4000-8000-0000000000aa', 0, 'k1084-day-1'),
  ('10840000-0000-4000-8000-00000000b001', '10840000-0000-4000-8000-0000000000aa', 1, 'k1084-day-2'),
  ('10840000-0000-4000-8000-00000000b001', '10840000-0000-4000-8000-0000000000aa', 2, 'k1084-day-3'),
  ('10840000-0000-4000-8000-00000000b002', '10840000-0000-4000-8000-0000000000aa', 0, 'k1084-day-archived'),
  ('10840000-0000-4000-8000-00000000b003', '10840000-0000-4000-8000-0000000000aa', 0, 'k1084-day-idle');

-- Meal plans. The archived plan repeats the first plan's days, so the distinct days are 7 + 5.
insert into public.meal_plans (id, owner_id, start_date, day_count, rules, source, archived_at) values
  ('10840000-0000-4000-8000-00000000d001', '10840000-0000-4000-8000-0000000000aa', '2026-01-05', 7, '{}', 'app', null),
  ('10840000-0000-4000-8000-00000000d002', '10840000-0000-4000-8000-0000000000aa', '2026-01-05', 3, '{}', 'app', '2026-01-06 00:00:00+00'),
  ('10840000-0000-4000-8000-00000000d003', '10840000-0000-4000-8000-0000000000aa', '2026-01-12', 5, '{}', 'app', null);
insert into public.meal_plan_days (plan_id, owner_id, local_date, target)
select plan.id, '10840000-0000-4000-8000-0000000000aa', plan.start_date + day.offset_days, '{}'
from public.meal_plans plan
cross join lateral generate_series(0, plan.day_count - 1) as day(offset_days)
where plan.owner_id = '10840000-0000-4000-8000-0000000000aa';

insert into public.shopping_list_items (owner_id, name, position, checked_at) values
  ('10840000-0000-4000-8000-0000000000aa', 'k1084-item-1', 0, null),
  ('10840000-0000-4000-8000-0000000000aa', 'k1084-item-2', 1, '2026-01-10 12:00:00+00'),
  ('10840000-0000-4000-8000-0000000000aa', 'k1084-item-3', 2, null);

-- The assistant: two conversations, three user messages and two assistant messages for A.
insert into public.assistant_conversations (id, user_id) values
  ('10840000-0000-4000-8000-00000000a1c1', '10840000-0000-4000-8000-0000000000aa'),
  ('10840000-0000-4000-8000-00000000a1c2', '10840000-0000-4000-8000-0000000000aa'),
  ('10840000-0000-4000-8000-00000000a1cb', '10840000-0000-4000-8000-0000000000bb');
insert into public.assistant_turns (id, conversation_id, user_id, user_message_id, status) values
  ('10840000-0000-4000-8000-00000000a2a1', '10840000-0000-4000-8000-00000000a1c1', '10840000-0000-4000-8000-0000000000aa', gen_random_uuid(), 'complete'),
  ('10840000-0000-4000-8000-00000000a2a2', '10840000-0000-4000-8000-00000000a1c2', '10840000-0000-4000-8000-0000000000aa', gen_random_uuid(), 'complete'),
  ('10840000-0000-4000-8000-00000000a2b1', '10840000-0000-4000-8000-00000000a1cb', '10840000-0000-4000-8000-0000000000bb', gen_random_uuid(), 'complete');
insert into public.assistant_messages (conversation_id, turn_id, user_id, role, content, seq) values
  ('10840000-0000-4000-8000-00000000a1c1', '10840000-0000-4000-8000-00000000a2a1', '10840000-0000-4000-8000-0000000000aa', 'user', '[]', 1),
  ('10840000-0000-4000-8000-00000000a1c1', '10840000-0000-4000-8000-00000000a2a1', '10840000-0000-4000-8000-0000000000aa', 'assistant', '[]', 2),
  ('10840000-0000-4000-8000-00000000a1c1', '10840000-0000-4000-8000-00000000a2a1', '10840000-0000-4000-8000-0000000000aa', 'user', '[]', 3),
  ('10840000-0000-4000-8000-00000000a1c2', '10840000-0000-4000-8000-00000000a2a2', '10840000-0000-4000-8000-0000000000aa', 'user', '[]', 1),
  ('10840000-0000-4000-8000-00000000a1c2', '10840000-0000-4000-8000-00000000a2a2', '10840000-0000-4000-8000-0000000000aa', 'assistant', '[]', 2),
  ('10840000-0000-4000-8000-00000000a1cb', '10840000-0000-4000-8000-00000000a2b1', '10840000-0000-4000-8000-0000000000bb', 'user', '[]', 1);
-- Actions of A: one live log_entry and one undone, one live create_recipe and one undone, and an
-- archive_recipe that no count reads.
insert into public.assistant_actions (user_id, turn_seq, tool, target_table, undone_at) values
  ('10840000-0000-4000-8000-0000000000aa', 1, 'log_entry', 'food_log_entries', null),
  ('10840000-0000-4000-8000-0000000000aa', 2, 'log_entry', 'food_log_entries', '2026-01-10 13:00:00+00'),
  ('10840000-0000-4000-8000-0000000000aa', 3, 'create_recipe', 'recipes', null),
  ('10840000-0000-4000-8000-0000000000aa', 4, 'create_recipe', 'recipes', '2026-01-10 13:00:00+00'),
  ('10840000-0000-4000-8000-0000000000aa', 5, 'archive_recipe', 'recipes', null);

insert into public.feature_requests (user_id, source, request) values
  ('10840000-0000-4000-8000-0000000000aa', 'more_menu', 'k1084 request one'),
  ('10840000-0000-4000-8000-0000000000aa', 'more_menu', 'k1084 request two');

-- Programmes, check-ins and engine targets of A. A start snapshot is not a check-in.
insert into public.programs (id, user_id, goal, rate_pct_per_week, protein_g_per_kg, fat_fraction_of_remaining, split_preset, dow_offsets_kcal, started_on, ended_on) values
  ('10840000-0000-4000-8000-00000000a901', '10840000-0000-4000-8000-0000000000aa', 'maintain', 0, 1.6, 0.4, 'balanced', '{0,0,0,0,0,0,0}', '2026-01-05', '2026-02-02'),
  ('10840000-0000-4000-8000-00000000a902', '10840000-0000-4000-8000-0000000000aa', 'maintain', 0, 1.6, 0.4, 'balanced', '{0,0,0,0,0,0,0}', '2026-02-03', null);
insert into public.expenditure_snapshots (user_id, program_id, as_of_date, kind, mu_kcal, var_kcal2, measurement, engine_version, params) values
  ('10840000-0000-4000-8000-0000000000aa', '10840000-0000-4000-8000-00000000a901', '2026-01-05', 'start', 2500, 10000, null, 'k1084-1', '{}'),
  ('10840000-0000-4000-8000-0000000000aa', '10840000-0000-4000-8000-00000000a901', '2026-01-12', 'checkin', 2500, 10000, '{}', 'k1084-1', '{}'),
  ('10840000-0000-4000-8000-0000000000aa', '10840000-0000-4000-8000-00000000a901', '2026-01-19', 'checkin', 2500, 10000, '{}', 'k1084-1', '{}');
insert into public.targets (user_id, effective_from, effective_to, calories_kcal, protein_g, fat_g, carbs_g, dow_calories_kcal, basis, engine_version, params) values
  ('10840000-0000-4000-8000-0000000000aa', '2026-01-05', '2026-01-18', 2000, 150, 60, 200, '{2000,2000,2000,2000,2000,2000,2000}', '{}', 'k1084-1', '{}'),
  ('10840000-0000-4000-8000-0000000000aa', '2026-01-19', null, 2100, 160, 65, 210, '{2100,2100,2100,2100,2100,2100,2100}', '{}', 'k1084-1', '{}');

-- Held achievements and the freeze ledger of A, and the rows of B that must stay hidden from A.
insert into public.user_achievements (user_id, achievement_id, unlocked_at, seen_at, backfilled) values
  ('10840000-0000-4000-8000-0000000000aa', 'first-bite', '2026-01-10 12:00:00+00', null, true),
  ('10840000-0000-4000-8000-0000000000aa', 'full-week', '2026-01-17 12:00:00+00', '2026-01-17 13:00:00+00', false),
  ('10840000-0000-4000-8000-0000000000bb', 'k1084-only-b', '2026-01-10 12:00:00+00', null, false);
insert into public.streak_freeze_events (user_id, kind, reason, ref, count, local_date, created_at) values
  ('10840000-0000-4000-8000-0000000000aa', 'earned', 'daily_streak', '7', 1, '2026-01-17', '2026-01-17 12:00:00+00'),
  ('10840000-0000-4000-8000-0000000000aa', 'used', 'missed_day', '2026-01-18', 1, '2026-01-19', '2026-01-19 12:00:00+00'),
  ('10840000-0000-4000-8000-0000000000bb', 'earned', 'daily_streak', '7', 1, '2026-01-17', '2026-01-17 12:00:00+00');

-- B's own small fixture: one entry, one weigh-in, one session with one set, one check-in.
insert into public.food_log_entries (user_id, local_date, logged_at, item_type, snapshot, nutrients) values
  ('10840000-0000-4000-8000-0000000000bb', '2026-01-10', '2026-01-10 10:00:00+00', 'quick', '{"kind":"quick","label":"k1084-b"}',
    '{"kcal":5000,"protein_g":500,"fat_g":500,"carbs_g":500,"fibre_g":500}');
insert into public.weigh_ins (user_id, measured_at, local_date, tz, weight_kg, source) values
  ('10840000-0000-4000-8000-0000000000bb', '2026-01-10 08:00:00+00', '2026-01-10', 'UTC', 90, 'manual');

-- ---------------------------------------------------------------------------------------------
-- Shape.
-- ---------------------------------------------------------------------------------------------

select has_table('public', 'user_achievements', 'user_achievements exists');
select has_table('public', 'streak_freeze_events', 'streak_freeze_events exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.user_achievements'::regclass),
  'row level security is enabled on user_achievements'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.streak_freeze_events'::regclass),
  'row level security is enabled on streak_freeze_events'
);
select col_is_pk('public', 'user_achievements', array['user_id', 'achievement_id'], 'the primary key is (user_id, achievement_id)');
select col_type_is('public', 'user_achievements', 'achievement_id', 'text', 'achievement_id is text');
select col_not_null('public', 'user_achievements', 'unlocked_at', 'unlocked_at is not null');
select col_default_is('public', 'user_achievements', 'unlocked_at', 'now()', 'unlocked_at defaults to now()');
select col_is_null('public', 'user_achievements', 'seen_at', 'seen_at is nullable');
select col_not_null('public', 'user_achievements', 'backfilled', 'backfilled is not null');
select col_default_is('public', 'user_achievements', 'backfilled', 'false', 'backfilled defaults to false');
select col_default_is('public', 'user_achievements', 'user_id', 'auth.uid()', 'user_id defaults to the caller');
select fk_ok('public', 'user_achievements', 'user_id', 'auth', 'users', 'id', 'user_achievements.user_id references auth.users');
select col_is_pk('public', 'streak_freeze_events', 'id', 'the ledger primary key is id');
select col_default_is('public', 'streak_freeze_events', 'user_id', 'auth.uid()', 'the ledger user_id defaults to the caller');
select col_not_null('public', 'streak_freeze_events', 'ref', 'ref is not null, so the unique key cannot be dodged with a null');
select col_type_is('public', 'streak_freeze_events', 'count', 'smallint', 'count is a smallint');
select col_type_is('public', 'streak_freeze_events', 'local_date', 'date', 'local_date is a date');
select fk_ok('public', 'streak_freeze_events', 'user_id', 'auth', 'users', 'id', 'streak_freeze_events.user_id references auth.users');
select col_type_is('public', 'profiles', 'achievements_backfilled_at', 'timestamp with time zone', 'profiles.achievements_backfilled_at is a timestamptz');
select col_is_null('public', 'profiles', 'achievements_backfilled_at', 'achievements_backfilled_at is nullable');

-- ---------------------------------------------------------------------------------------------
-- Privileges, read from the catalog.
-- ---------------------------------------------------------------------------------------------

select ok(
  not has_table_privilege('anon', 'public.user_achievements', 'select')
    and not has_table_privilege('anon', 'public.streak_freeze_events', 'select'),
  'anon has no privilege on either table'
);
select ok(
  has_table_privilege('authenticated', 'public.user_achievements', 'select')
    and not has_table_privilege('authenticated', 'public.user_achievements', 'insert')
    and not has_table_privilege('authenticated', 'public.user_achievements', 'delete')
    and not has_table_privilege('authenticated', 'public.user_achievements', 'update'),
  'authenticated can select user_achievements and has no table wide insert, update or delete'
);
select ok(
  has_column_privilege('authenticated', 'public.user_achievements', 'seen_at', 'update')
    and not has_column_privilege('authenticated', 'public.user_achievements', 'unlocked_at', 'update')
    and not has_column_privilege('authenticated', 'public.user_achievements', 'achievement_id', 'update')
    and not has_column_privilege('authenticated', 'public.user_achievements', 'user_id', 'update')
    and not has_column_privilege('authenticated', 'public.user_achievements', 'backfilled', 'update'),
  'authenticated can update seen_at and nothing else on user_achievements'
);
select ok(
  not has_column_privilege('authenticated', 'public.user_achievements', 'achievement_id', 'insert'),
  'authenticated has no insert privilege on any user_achievements column'
);
select ok(
  has_table_privilege('authenticated', 'public.streak_freeze_events', 'select')
    and not has_table_privilege('authenticated', 'public.streak_freeze_events', 'update')
    and not has_table_privilege('authenticated', 'public.streak_freeze_events', 'delete')
    and has_column_privilege('authenticated', 'public.streak_freeze_events', 'reason', 'insert')
    and not has_column_privilege('authenticated', 'public.streak_freeze_events', 'user_id', 'insert')
    and not has_column_privilege('authenticated', 'public.streak_freeze_events', 'created_at', 'insert'),
  'authenticated reads and appends to the ledger, with no update or delete and no user_id or created_at on insert'
);
select ok(
  has_table_privilege('service_role', 'public.user_achievements', 'select')
    and not has_table_privilege('service_role', 'public.user_achievements', 'insert')
    and not has_table_privilege('service_role', 'public.user_achievements', 'update')
    and not has_table_privilege('service_role', 'public.user_achievements', 'delete')
    and has_table_privilege('service_role', 'public.streak_freeze_events', 'select')
    and not has_table_privilege('service_role', 'public.streak_freeze_events', 'insert')
    and not has_table_privilege('service_role', 'public.streak_freeze_events', 'update')
    and not has_table_privilege('service_role', 'public.streak_freeze_events', 'delete'),
  'service_role can only select from either table'
);
select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'achievements_backfilled_at', 'update')
    and not has_column_privilege('authenticated', 'public.profiles', 'achievements_backfilled_at', 'insert')
    and has_column_privilege('authenticated', 'public.profiles', 'achievements_backfilled_at', 'select'),
  'a client can read the backfill mark and cannot write it'
);

-- Functions.
select ok(
  has_function_privilege('authenticated', 'public.achievement_stats(date)', 'execute')
    and not has_function_privilege('anon', 'public.achievement_stats(date)', 'execute')
    and not has_function_privilege('service_role', 'public.achievement_stats(date)', 'execute')
    and has_function_privilege('authenticated', 'public.record_achievements(text[], boolean)', 'execute')
    and not has_function_privilege('anon', 'public.record_achievements(text[], boolean)', 'execute')
    and not has_function_privilege('service_role', 'public.record_achievements(text[], boolean)', 'execute'),
  'both functions are executable by authenticated and by no other API role'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.achievement_stats(date)'::regprocedure),
  false,
  'achievement_stats is security invoker, so row level security applies to every read'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.record_achievements(text[], boolean)'::regprocedure),
  true,
  'record_achievements is security definer, because no client holds an insert privilege on user_achievements'
);
select ok(
  (select proconfig[1] = 'search_path=""' from pg_proc where oid = 'public.achievement_stats(date)'::regprocedure)
    and (select proconfig[1] = 'search_path=""' from pg_proc where oid = 'public.record_achievements(text[], boolean)'::regprocedure),
  'both functions pin an empty search_path'
);
select ok(
  (select provolatile = 's' from pg_proc where oid = 'public.achievement_stats(date)'::regprocedure),
  'achievement_stats is stable'
);
select ok(
  (select prosrc !~* 'raise\s+(notice|warning|log|info|debug)' and prosrc !~* 'raise\s+exception[^;]*%'
     from pg_proc where oid = 'public.achievement_stats(date)'::regprocedure)
    and (select prosrc !~* 'raise\s+(notice|warning|log|info|debug)' and prosrc !~* 'raise\s+exception[^;]*%'
     from pg_proc where oid = 'public.record_achievements(text[], boolean)'::regprocedure),
  'no function raises a notice or quotes a value in an exception (Amendment 9)'
);

-- ---------------------------------------------------------------------------------------------
-- user_achievements: own rows only, select and update of seen_at only.
-- ---------------------------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"10840000-0000-4000-8000-0000000000aa","role":"authenticated"}';

select is(
  (select array_agg(achievement_id order by achievement_id) from public.user_achievements),
  array['first-bite', 'full-week'],
  'A sees exactly its own achievements and not B''s'
);
select throws_ok(
  $$insert into public.user_achievements (achievement_id) values ('hat-trick')$$,
  '42501',
  'permission denied for table user_achievements',
  'A cannot insert into user_achievements directly'
);
select throws_ok(
  $$insert into public.user_achievements (user_id, achievement_id) values ('10840000-0000-4000-8000-0000000000bb', 'hat-trick')$$,
  '42501',
  'permission denied for table user_achievements',
  'A cannot insert a row for B either'
);
select throws_ok(
  $$delete from public.user_achievements where achievement_id = 'first-bite'$$,
  '42501',
  'permission denied for table user_achievements',
  'A cannot delete an achievement'
);
select throws_ok(
  $$update public.user_achievements set unlocked_at = now() where achievement_id = 'first-bite'$$,
  '42501',
  'permission denied for table user_achievements',
  'A cannot move unlocked_at'
);
select throws_ok(
  $$update public.user_achievements set backfilled = false where achievement_id = 'first-bite'$$,
  '42501',
  'permission denied for table user_achievements',
  'A cannot change backfilled'
);
select lives_ok(
  $$update public.user_achievements set seen_at = '2026-01-18 09:00:00+00' where achievement_id = 'first-bite'$$,
  'A can set seen_at on its own row'
);
select is(
  (select seen_at from public.user_achievements where achievement_id = 'first-bite'),
  '2026-01-18 09:00:00+00'::timestamptz,
  'the seen_at update stuck'
);
select lives_ok(
  $$update public.user_achievements set seen_at = now() where achievement_id = 'k1084-only-b'$$,
  'A updating B''s achievement matches no row and raises nothing'
);

set local request.jwt.claims = '{"sub":"10840000-0000-4000-8000-0000000000bb","role":"authenticated"}';

select is(
  (select array_agg(achievement_id) from public.user_achievements),
  array['k1084-only-b'],
  'B sees only its own achievement'
);
select is(
  (select seen_at from public.user_achievements where achievement_id = 'k1084-only-b'),
  null,
  'A did not change B''s row'
);
reset role;

-- ---------------------------------------------------------------------------------------------
-- streak_freeze_events: own rows, select and insert, append only.
-- ---------------------------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"10840000-0000-4000-8000-0000000000aa","role":"authenticated"}';

select is(
  (select count(*) from public.streak_freeze_events),
  2::bigint,
  'A sees its own two ledger rows and not B''s'
);
select lives_ok(
  $$insert into public.streak_freeze_events (kind, reason, ref, count, local_date) values ('earned', 'level_reached', '2', 1, '2026-01-20')$$,
  'A appends an earned row, with user_id defaulted'
);
select is(
  (select count(*) from public.streak_freeze_events where reason = 'level_reached'),
  1::bigint,
  'the appended row is A''s'
);
select throws_ok(
  $$insert into public.streak_freeze_events (kind, reason, ref, count, local_date) values ('earned', 'level_reached', '2', 1, '2026-01-21')$$,
  '23505',
  'duplicate key value violates unique constraint "streak_freeze_events_user_id_kind_reason_ref_key"',
  'the ledger refuses a duplicate (user, kind, reason, ref)'
);
select lives_ok(
  $$insert into public.streak_freeze_events (kind, reason, ref, count, local_date) values ('used', 'missed_day', '2026-01-18', 1, '2026-01-19') on conflict do nothing$$,
  'on conflict do nothing makes a repeated append harmless'
);
select throws_ok(
  $$insert into public.streak_freeze_events (user_id, kind, reason, ref, count, local_date) values ('10840000-0000-4000-8000-0000000000bb', 'earned', 'level_reached', '3', 1, '2026-01-20')$$,
  '42501',
  'permission denied for table streak_freeze_events',
  'A cannot name B as the owner of a ledger row'
);
select throws_ok(
  $$update public.streak_freeze_events set count = 5 where reason = 'level_reached'$$,
  '42501',
  'permission denied for table streak_freeze_events',
  'the ledger refuses an update'
);
select throws_ok(
  $$delete from public.streak_freeze_events where reason = 'level_reached'$$,
  '42501',
  'permission denied for table streak_freeze_events',
  'the ledger refuses a delete'
);
select throws_ok(
  $$insert into public.streak_freeze_events (kind, reason, ref, count, local_date) values ('earned', 'not_a_reason', 'x', 1, '2026-01-20')$$,
  '23514',
  'new row for relation "streak_freeze_events" violates check constraint "streak_freeze_events_reason_check"',
  'an unknown reason is refused'
);
select throws_ok(
  $$insert into public.streak_freeze_events (kind, reason, ref, count, local_date) values ('used', 'level_reached', 'x', 1, '2026-01-20')$$,
  '23514',
  'new row for relation "streak_freeze_events" violates check constraint "streak_freeze_events_reason_check"',
  'a used row with an earned reason is refused'
);
select throws_ok(
  $$insert into public.streak_freeze_events (kind, reason, ref, count, local_date) values ('earned', 'missed_day', 'x', 1, '2026-01-20')$$,
  '23514',
  'new row for relation "streak_freeze_events" violates check constraint "streak_freeze_events_reason_check"',
  'an earned row with the used reason is refused'
);
select throws_ok(
  $$insert into public.streak_freeze_events (kind, reason, ref, count, local_date) values ('earned', 'achievement_gold', 'hat-trick', 0, '2026-01-20')$$,
  '23514',
  'new row for relation "streak_freeze_events" violates check constraint "streak_freeze_events_count_check"',
  'a count of 0 is refused'
);
select throws_ok(
  $$insert into public.streak_freeze_events (kind, reason, ref, count, local_date) values ('gifted', 'level_reached', 'x', 1, '2026-01-20')$$,
  '23514',
  'new row for relation "streak_freeze_events" violates check constraint "streak_freeze_events_kind_check"',
  'a kind other than earned or used is refused'
);
select throws_ok(
  $$insert into public.streak_freeze_events (kind, reason, ref, count, local_date) values ('earned', 'achievement_platinum', '', 3, '2026-01-20')$$,
  '23514',
  'new row for relation "streak_freeze_events" violates check constraint "streak_freeze_events_ref_check"',
  'an empty ref is refused'
);

set local request.jwt.claims = '{"sub":"10840000-0000-4000-8000-0000000000bb","role":"authenticated"}';
select is(
  (select count(*) from public.streak_freeze_events),
  1::bigint,
  'B sees only its own ledger row'
);
reset role;

-- ---------------------------------------------------------------------------------------------
-- record_achievements.
-- ---------------------------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"10840000-0000-4000-8000-0000000000cc","role":"authenticated"}';

select is(
  public.record_achievements(array['hat-trick', 'notebook'], false),
  array['hat-trick', 'notebook'],
  'a first call returns every id it inserted'
);
select is(
  public.record_achievements(array['hat-trick', 'bullseye', 'notebook'], false),
  array['bullseye'],
  'a second call returns only the id that was new'
);
select is(
  public.record_achievements(array['hat-trick', 'bullseye', 'notebook'], false),
  array[]::text[],
  'a repeated call returns nothing, so a second device gets no id to notify about'
);
select is(
  public.record_achievements(array['full-week', 'full-week'], false),
  array['full-week'],
  'an id sent twice in one call is inserted and returned once'
);
select is(
  public.record_achievements(array[]::text[], false),
  array[]::text[],
  'an empty list returns an empty list'
);
select is(
  public.record_achievements(null, false),
  array[]::text[],
  'a null list returns an empty list'
);
select is(
  (select count(*) from public.user_achievements where achievement_id in ('hat-trick', 'notebook', 'bullseye', 'full-week')),
  4::bigint,
  'the four distinct ids are held once each'
);
select is(
  (select bool_or(backfilled) from public.user_achievements),
  false,
  'a call without p_backfill leaves backfilled false'
);
select is(
  (select unlocked_at = now() from public.user_achievements where achievement_id = 'hat-trick'),
  true,
  'unlocked_at is the database clock'
);
select is(
  (select seen_at from public.user_achievements where achievement_id = 'hat-trick'),
  null,
  'a new row is unseen'
);
select is(
  (select achievements_backfilled_at from public.profiles where id = '10840000-0000-4000-8000-0000000000cc'),
  null,
  'a call without p_backfill leaves the backfill mark null'
);
select throws_ok(
  $$select public.record_achievements(array['Hat Trick'], false)$$,
  '22023',
  'record_achievements: invalid achievement id list',
  'an id that is not a lowercase kebab slug is refused with a message that names no value'
);
select throws_ok(
  $$select public.record_achievements(array['hat-trick', null], false)$$,
  '22023',
  'record_achievements: invalid achievement id list',
  'a null id in the list is refused'
);
select throws_ok(
  $$select public.record_achievements(array(select 'id-' || n from generate_series(1, 201) n), false)$$,
  '22023',
  'record_achievements: invalid achievement id list',
  'a list of more than 200 ids is refused'
);
select is(
  (select count(*) from public.user_achievements),
  4::bigint,
  'a refused call inserted nothing'
);

-- The backfill: the first backfilling call sets the mark and flags its rows, later ones keep the mark.
select is(
  public.record_achievements(array['first-bite', 'jotter'], true),
  array['first-bite', 'jotter'],
  'a backfilling call returns what it inserted'
);
select is(
  (select achievements_backfilled_at = now() from public.profiles where id = '10840000-0000-4000-8000-0000000000cc'),
  true,
  'p_backfill sets the mark to the database clock'
);
select is(
  (select array_agg(achievement_id order by achievement_id) from public.user_achievements where backfilled),
  array['first-bite', 'jotter'],
  'only the rows of the backfilling call are flagged backfilled'
);
reset role;

-- D holds a mark from the past. A later backfilling call must keep it.
set local role authenticated;
set local request.jwt.claims = '{"sub":"10840000-0000-4000-8000-0000000000dd","role":"authenticated"}';
select is(
  public.record_achievements(array['jotter'], true),
  array['jotter'],
  'a backfilling call by a user who already has a mark still records its ids'
);
select is(
  (select achievements_backfilled_at from public.profiles where id = '10840000-0000-4000-8000-0000000000dd'),
  '2026-01-01 00:00:00+00'::timestamptz,
  'the mark is set once and never moved'
);
reset role;

-- No signed-in person: the claims of the last actor are cleared.
set local request.jwt.claims = '{}';
select throws_ok(
  $$select public.record_achievements(array['hat-trick'], false)$$,
  '42501',
  'record_achievements needs a signed-in person',
  'record_achievements refuses a call with no signed-in person'
);
select throws_ok(
  $$select public.achievement_stats('2026-01-01')$$,
  '42501',
  'achievement_stats needs a signed-in person',
  'achievement_stats refuses a call with no signed-in person'
);
set local role anon;
select throws_ok(
  $$select public.record_achievements(array['hat-trick'], false)$$,
  '42501',
  'permission denied for function record_achievements',
  'anon cannot execute record_achievements'
);
select throws_ok(
  $$select public.achievement_stats('2026-01-01')$$,
  '42501',
  'permission denied for function achievement_stats',
  'anon cannot execute achievement_stats'
);
reset role;

-- ---------------------------------------------------------------------------------------------
-- achievement_stats, read as A with the window starting on 2026-01-01.
-- ---------------------------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"10840000-0000-4000-8000-0000000000aa","role":"authenticated"}';

select is(
  (select array_agg(key order by key) from jsonb_object_keys(public.achievement_stats('2026-01-01')) as key),
  array[
    'achievements', 'active_routine_day_count', 'assistant_conversations', 'assistant_create_recipe_actions',
    'assistant_log_entry_actions', 'assistant_user_messages', 'body_measurement_count', 'checkin_dates',
    'days', 'distinct_planned_days', 'entry_totals', 'event_counts', 'favourites', 'feature_requests', 'longest_meal_plan_days', 'manual_targets',
    'meal_plans', 'onboarding_completed_at', 'profile_created_at', 'programmes', 'recipes',
    'routines', 'shopping_list_items', 'streak_freeze_events', 'targets', 'targets_updated_at', 'time_zone',
    'training_goals', 'weigh_ins', 'workouts'
  ],
  'the top level keys of the snapshot'
);
select is(
  (select array_agg(key order by key) from jsonb_object_keys(public.achievement_stats('2026-01-01') -> 'workouts') as key),
  array[
    'before_seven_count', 'distinct_exercises', 'from_twenty_one_count', 'legs_sessions', 'most_sets_in_session',
    'session_best_sets', 'sessions', 'tonnage_kg', 'weeks', 'working_sets'
  ],
  'the keys of the workouts group'
);
select ok(
  (public.achievement_stats('2026-01-01')::text) !~ '(weight_kg|"weight|goal_weight)',
  'the snapshot carries no body weight value and no weight goal'
);

select is(
  (public.achievement_stats('2026-01-01') ->> 'time_zone'),
  'America/New_York',
  'the time zone is the profile''s'
);
select is(
  ((public.achievement_stats('2026-01-01') ->> 'profile_created_at')::timestamptz,
   (public.achievement_stats('2026-01-01') ->> 'onboarding_completed_at')::timestamptz,
   (public.achievement_stats('2026-01-01') ->> 'targets_updated_at')::timestamptz),
  ('2026-01-01 12:00:00+00'::timestamptz, '2026-01-02 12:00:00+00'::timestamptz, '2026-01-20 12:00:00+00'::timestamptz),
  'profile created, setup completed and targets updated come from the profile'
);
select is(
  public.achievement_stats('2026-01-01') -> 'manual_targets',
  '{"kcal":2100,"protein_g":150,"carbs_g":220,"fat_g":70}'::jsonb,
  'the manual profile targets'
);
select is(
  public.achievement_stats('2026-01-01') -> 'targets',
  '[
    {"effective_from":"2026-01-05","effective_to":"2026-01-18","calories_kcal":2000,"protein_g":150,"carbs_g":200,"fat_g":60,"dow_calories_kcal":[2000,2000,2000,2000,2000,2000,2000]},
    {"effective_from":"2026-01-19","effective_to":null,"calories_kcal":2100,"protein_g":160,"carbs_g":210,"fat_g":65,"dow_calories_kcal":[2100,2100,2100,2100,2100,2100,2100]}
  ]'::jsonb,
  'the engine targets rows, oldest first'
);

-- Days: the soft deleted entry, the entry before the window and the open empty day add nothing, and
-- the complete empty day appears. Times are New York local time.
select is(
  (select jsonb_agg(day - 'completed_at') from jsonb_array_elements(public.achievement_stats('2026-01-01') -> 'days') as day),
  '[
    {"local_date":"2026-01-10","entry_count":2,"kcal":800,"protein_g":50,"carbs_g":80,"fat_g":15,"fibre_g":8,"is_complete":false,"earliest_entry_local_time":"01:30:00","logged_between_midnight_and_four":true},
    {"local_date":"2026-01-11","entry_count":2,"kcal":1000,"protein_g":60,"carbs_g":100,"fat_g":28,"fibre_g":10,"is_complete":true,"earliest_entry_local_time":"10:00:00","logged_between_midnight_and_four":false},
    {"local_date":"2026-01-12","entry_count":1,"kcal":700,"protein_g":40,"carbs_g":70,"fat_g":25,"fibre_g":7,"is_complete":false,"earliest_entry_local_time":"08:00:00","logged_between_midnight_and_four":false},
    {"local_date":"2026-01-13","entry_count":3,"kcal":800,"protein_g":45,"carbs_g":80,"fat_g":22,"fibre_g":8,"is_complete":false,"earliest_entry_local_time":"03:15:00","logged_between_midnight_and_four":true},
    {"local_date":"2026-01-15","entry_count":0,"kcal":null,"protein_g":null,"carbs_g":null,"fat_g":null,"fibre_g":null,"is_complete":true,"earliest_entry_local_time":null,"logged_between_midnight_and_four":false},
    {"local_date":"2026-01-19","entry_count":1,"kcal":300,"protein_g":20,"carbs_g":30,"fat_g":10,"fibre_g":3,"is_complete":false,"earliest_entry_local_time":"04:00:00","logged_between_midnight_and_four":false}
  ]'::jsonb,
  'the per day rows, with soft deleted entries left out and 04:00:00 exactly outside the night window'
);
select is(
  (select (day ->> 'completed_at')::timestamptz
     from jsonb_array_elements(public.achievement_stats('2026-01-01') -> 'days') as day
    where day ->> 'local_date' = '2026-01-11'),
  '2026-01-12 03:00:00+00'::timestamptz,
  'a completed day carries its completed_at'
);
select is(
  (select jsonb_array_length(public.achievement_stats('2025-12-20') -> 'days')),
  7,
  'a window that starts earlier brings the earlier day in'
);

select is(
  public.achievement_stats('2026-01-01') -> 'entry_totals',
  '{
    "entries": 10,
    "distinct_foods": 3,
    "new_foods_per_week": [
      {"week_start":"2026-01-05","new_foods":1},
      {"week_start":"2026-01-19","new_foods":1}
    ],
    "most_logs_of_favourite_food": 2,
    "own_recipe_entries": 3,
    "most_days_for_one_recipe": 3
  }'::jsonb,
  'entry totals count live entries over all time, new foods per Monday week inside the window, and only favourites for the favourite maximum'
);

select is(
  public.achievement_stats('2026-01-01') -> 'weigh_ins',
  '{"count":5,"dates":["2026-01-10","2026-01-12","2026-01-14"],"before_nine_count":3}'::jsonb,
  'weigh-ins: soft deleted ones are left out, dates are distinct, and before 09:00 is read in each row''s zone'
);
select is(
  (public.achievement_stats('2026-01-01') -> 'body_measurement_count')::int,
  2,
  'body measurements exclude the soft deleted reading'
);

select is(
  (public.achievement_stats('2026-01-01') -> 'workouts') - 'weeks' - 'session_best_sets',
  '{"sessions":4,"before_seven_count":1,"from_twenty_one_count":1,"working_sets":14,"tonnage_kg":7020,"most_sets_in_session":6,"legs_sessions":3,"distinct_exercises":3}'::jsonb,
  'workout aggregates: finished and not deleted sessions, working sets only, null load as 0 in the tonnage'
);
select is(
  (public.achievement_stats('2026-01-01') -> 'workouts' -> 'weeks'),
  '[
    {"week_start":"2026-01-12","sessions":2,"muscle_groups":["back","chest","legs"]},
    {"week_start":"2026-01-19","sessions":1,"muscle_groups":["legs"]}
  ]'::jsonb,
  'per Monday week: the session count and the primary muscle groups only'
);
select is(
  (select jsonb_agg(session - 'started_at') from jsonb_array_elements(public.achievement_stats('2026-01-01') -> 'workouts' -> 'session_best_sets') as session),
  '[
    {"local_date":"2026-01-12","sets":[
      {"exercise_id":"10840000-0000-4000-8000-00000000e001","load_kg":110,"reps":3},
      {"exercise_id":"10840000-0000-4000-8000-00000000e002","load_kg":60,"reps":8}
    ]},
    {"local_date":"2026-01-13","sets":[
      {"exercise_id":"10840000-0000-4000-8000-00000000e002","load_kg":62.5,"reps":8},
      {"exercise_id":"10840000-0000-4000-8000-00000000e003","load_kg":80,"reps":12}
    ]},
    {"local_date":"2026-01-20","sets":[
      {"exercise_id":"10840000-0000-4000-8000-00000000e001","load_kg":100,"reps":5}
    ]}
  ]'::jsonb,
  'the best counted set per exercise per session: heavier load first, then more reps, and not a warm-up'
);
select is(
  (select (session ->> 'started_at')::timestamptz
     from jsonb_array_elements(public.achievement_stats('2026-01-01') -> 'workouts' -> 'session_best_sets') as session
    where session ->> 'local_date' = '2026-01-12'),
  '2026-01-12 11:30:00+00'::timestamptz,
  'a session carries its started_at, so the order of sessions is known'
);

select is(
  (select jsonb_agg(goal - 'effective_from' - 'effective_to') from jsonb_array_elements(public.achievement_stats('2026-01-01') -> 'training_goals') as goal),
  '[{"days_per_week":3},{"days_per_week":4}]'::jsonb,
  'training goals, oldest first'
);
select is(
  (select ((public.achievement_stats('2026-01-01') -> 'training_goals' -> 0 ->> 'effective_to')::timestamptz,
           (public.achievement_stats('2026-01-01') -> 'training_goals' -> 1 ->> 'effective_from')::timestamptz)),
  ('2026-01-15 00:00:00+00'::timestamptz, '2026-01-15 00:00:00+00'::timestamptz),
  'training goals carry their effective dates'
);
select is(
  public.achievement_stats('2026-01-01') -> 'training_goals' -> 1 -> 'effective_to',
  'null'::jsonb,
  'the current training goal has a null effective_to'
);

select is(
  (select jsonb_build_object(
      'active_routine_day_count', s -> 'active_routine_day_count',
      'routines', s -> 'routines',
      'recipes', s -> 'recipes',
      'favourites', s -> 'favourites',
      'meal_plans', s -> 'meal_plans',
      'longest_meal_plan_days', s -> 'longest_meal_plan_days',
      'distinct_planned_days', s -> 'distinct_planned_days',
      'shopping_list_items', s -> 'shopping_list_items',
      'assistant_user_messages', s -> 'assistant_user_messages',
      'assistant_conversations', s -> 'assistant_conversations',
      'assistant_log_entry_actions', s -> 'assistant_log_entry_actions',
      'assistant_create_recipe_actions', s -> 'assistant_create_recipe_actions',
      'feature_requests', s -> 'feature_requests'
    ) from (select public.achievement_stats('2026-01-01') as s) as snapshot),
  '{
    "active_routine_day_count": 3,
    "routines": 2,
    "recipes": 2,
    "favourites": 2,
    "meal_plans": 3,
    "longest_meal_plan_days": 7,
    "distinct_planned_days": 12,
    "shopping_list_items": 3,
    "assistant_user_messages": 3,
    "assistant_conversations": 2,
    "assistant_log_entry_actions": 1,
    "assistant_create_recipe_actions": 1,
    "feature_requests": 2
  }'::jsonb,
  'the counts: archived routines and recipes are left out, undone assistant actions are left out, the other counts are plain'
);
select is(
  public.achievement_stats('2026-01-01') -> 'checkin_dates',
  '["2026-01-12","2026-01-19"]'::jsonb,
  'check-ins are a dated list and a start snapshot is not one'
);
select is(
  public.achievement_stats('2026-01-01') -> 'programmes',
  '[{"started_on":"2026-01-05","ended_on":"2026-02-02"},{"started_on":"2026-02-03","ended_on":null}]'::jsonb,
  'the programmes, with started_on and ended_on'
);
select is(
  (select jsonb_agg(held - 'unlocked_at' order by held ->> 'achievement_id') from jsonb_array_elements(public.achievement_stats('2026-01-01') -> 'achievements') as held),
  '[
    {"achievement_id":"first-bite","seen_at":"2026-01-18T09:00:00+00:00","backfilled":true},
    {"achievement_id":"full-week","seen_at":"2026-01-17T13:00:00+00:00","backfilled":false}
  ]'::jsonb,
  'the held achievements of A and not B''s'
);
select is(
  (select jsonb_agg(entry - 'created_at' order by entry ->> 'local_date') from jsonb_array_elements(public.achievement_stats('2026-01-01') -> 'streak_freeze_events') as entry),
  '[
    {"kind":"earned","reason":"daily_streak","ref":"7","count":1,"local_date":"2026-01-17"},
    {"kind":"used","reason":"missed_day","ref":"2026-01-18","count":1,"local_date":"2026-01-19"},
    {"kind":"earned","reason":"level_reached","ref":"2","count":1,"local_date":"2026-01-20"}
  ]'::jsonb,
  'the freeze ledger of A, including the row A appended above, and not B''s'
);

-- B reads only its own rows through the function.
set local request.jwt.claims = '{"sub":"10840000-0000-4000-8000-0000000000bb","role":"authenticated"}';
select is(
  (public.achievement_stats('2026-01-01') -> 'entry_totals' ->> 'entries')::int,
  1,
  'B''s stats count only B''s entry'
);
select is(
  (select jsonb_build_array(s -> 'weigh_ins' -> 'count', s -> 'workouts' -> 'sessions', s -> 'recipes', s -> 'assistant_conversations', s -> 'assistant_user_messages', s -> 'days' -> 0 -> 'entry_count')
     from (select public.achievement_stats('2026-01-01') as s) as snapshot),
  '[1, 0, 0, 1, 1, 1]'::jsonb,
  'B''s stats hold B''s rows and none of A''s'
);
select is(
  (select jsonb_agg(held ->> 'achievement_id') from jsonb_array_elements(public.achievement_stats('2026-01-01') -> 'achievements') as held),
  '["k1084-only-b"]'::jsonb,
  'B''s held achievements are B''s alone'
);
select is(
  jsonb_array_length(public.achievement_stats('2026-01-01') -> 'streak_freeze_events'),
  1,
  'B''s ledger is B''s alone'
);

-- C has nothing but the achievements it recorded above: every count is 0 and every list is empty.
set local request.jwt.claims = '{"sub":"10840000-0000-4000-8000-0000000000cc","role":"authenticated"}';
select is(
  (select jsonb_build_array(
      s -> 'days', s -> 'targets', s -> 'training_goals', s -> 'checkin_dates', s -> 'programmes', s -> 'streak_freeze_events',
      s -> 'entry_totals' -> 'new_foods_per_week', s -> 'weigh_ins' -> 'dates', s -> 'workouts' -> 'weeks', s -> 'workouts' -> 'session_best_sets',
      s -> 'entry_totals' -> 'entries', s -> 'workouts' -> 'tonnage_kg', s -> 'workouts' -> 'most_sets_in_session', s -> 'weigh_ins' -> 'count',
      s -> 'favourites', s -> 'meal_plans', s -> 'longest_meal_plan_days', s -> 'distinct_planned_days',
      s -> 'active_routine_day_count', s -> 'body_measurement_count'
    ) from (select public.achievement_stats('2026-01-01') as s) as snapshot),
  '[[], [], [], [], [], [], [], [], [], [], 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]'::jsonb,
  'a user with nothing gets empty lists and zero counts, never null'
);
select is(
  (select jsonb_agg(held ->> 'achievement_id' order by held ->> 'achievement_id') from jsonb_array_elements(public.achievement_stats('2026-01-01') -> 'achievements') as held),
  '["bullseye","first-bite","full-week","hat-trick","jotter","notebook"]'::jsonb,
  'what record_achievements recorded for C is what achievement_stats lists'
);
select is(
  (public.achievement_stats(null) -> 'entry_totals' ->> 'entries')::int,
  0,
  'a null window start is accepted and means no lower bound'
);
reset role;

select * from finish();

rollback;
