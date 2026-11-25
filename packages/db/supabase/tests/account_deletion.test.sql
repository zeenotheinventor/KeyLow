-- Asserts account deletion (ADR 0003, Amendment 28): deleting an auth user removes every row the
-- account owns, in all 39 user-owned tables, in rate_limits and in the auth audit log, and nothing
-- that belongs to another account or to the shared reference data.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so
-- nothing created here persists. Every fixture id starts with 11210000 and every email with
-- key1121-. Nothing asserts a whole-table count, because other sessions write to the same local
-- database, so every count is filtered on a fixture owner or a fixture id. Each actor is entered
-- with `set local role` plus the JWT claims that `auth.uid()` reads, and left with `reset role`.
--
-- Health data: the fixtures are made up and no assertion quotes a value.
--
-- The delete runs as postgres. The local `postgres` role cannot assume `supabase_auth_admin`, the
-- role GoTrue deletes users as. The `delete-account` HTTP suite deletes through GoTrue itself, but
-- it cannot read rate_limits or the auth schema, so it proves that a deletion succeeds with the
-- trigger in place and not that the purge ran. Here the trigger is proven by its catalogue facts
-- instead: the function is security definer and owned by a role that can delete from rate_limits,
-- while supabase_auth_admin cannot. The purge under supabase_auth_admin was also shown by hand on
-- the local stack, with counts only.
--
-- The completeness guard reads the catalogue, so a new user-owned table, a new base table or a new
-- `no action` key between two user-owned tables turns this file red until it is classified here.

begin;

select plan(172);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '11210000-0000-4000-8000-0000000000aa', 'authenticated', 'authenticated', 'key1121-account-a@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '11210000-0000-4000-8000-0000000000bb', 'authenticated', 'authenticated', 'key1121-account-b@keylow.test');

insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('key1121-account-a@keylow.test', '11210000-0000-4000-8000-0000000000aa', '{"email":"key1121-account-a@keylow.test"}', 'email'),
  ('key1121-account-b@keylow.test', '11210000-0000-4000-8000-0000000000bb', '{"email":"key1121-account-b@keylow.test"}', 'email');

-- The 39 user-owned tables and the column that holds the owner, written out so that the catalogue
-- is checked against a list and not against itself.
create function pg_temp.owner_columns()
returns table (table_name text, owner_column text)
language sql
as $$
  values
    ('accepted_suggestions', 'user_id'),
    ('achievement_events', 'user_id'),
    ('assistant_actions', 'user_id'),
    ('assistant_conversations', 'user_id'),
    ('assistant_messages', 'user_id'),
    ('assistant_turns', 'user_id'),
    ('assistant_usage', 'user_id'),
    ('body_measurements', 'user_id'),
    ('day_logs', 'user_id'),
    ('entitlements', 'user_id'),
    ('exercise_muscles', 'owner_id'),
    ('exercises', 'owner_id'),
    ('expenditure_snapshots', 'user_id'),
    ('feature_requests', 'user_id'),
    ('food_favourites', 'owner_id'),
    ('food_log_entries', 'user_id'),
    ('food_portions', 'owner_id'),
    ('foods', 'owner_id'),
    ('meal_plan_days', 'owner_id'),
    ('meal_plan_items', 'owner_id'),
    ('meal_plans', 'owner_id'),
    ('palate_preferences', 'owner_id'),
    ('profiles', 'id'),
    ('programs', 'user_id'),
    ('push_tokens', 'user_id'),
    ('recipe_favourites', 'owner_id'),
    ('recipe_ingredients', 'owner_id'),
    ('recipes', 'owner_id'),
    ('routine_days', 'user_id'),
    ('routine_exercises', 'user_id'),
    ('routines', 'user_id'),
    ('shopping_list_items', 'owner_id'),
    ('streak_freeze_events', 'user_id'),
    ('targets', 'user_id'),
    ('training_goals', 'user_id'),
    ('user_achievements', 'user_id'),
    ('weigh_ins', 'user_id'),
    ('workout_sessions', 'user_id'),
    ('workout_sets', 'user_id')
$$;

-- The rows an owner has in one table, counted with a statement built from the two names.
create function pg_temp.owned_rows(table_name text, owner_column text, owner uuid)
returns bigint
language plpgsql
as $$
declare
  owned bigint;
begin
  execute format('select count(*) from public.%I where %I = %L', table_name, owner_column, owner) into owned;
  return owned;
end;
$$;

-- A fixture id that is the same every time for one owner and one label.
create function pg_temp.row_id(owner uuid, label text)
returns uuid
language plpgsql
immutable
as $$
declare
  labels constant text[] := array[
    'food', 'portion', 'deleted_food', 'recipe', 'exercise', 'routine', 'routine_day', 'session',
    'program', 'snapshot', 'plan', 'plan_day', 'plan_item', 'conversation', 'turn', 'user_message',
    'spare_food', 'spare_recipe'
  ];
  slot integer := array_position(labels, label);
begin
  if slot is null then
    raise exception 'unknown fixture label';
  end if;
  return format('11210000-%s-4000-8000-%s', lpad(slot::text, 4, '0'), right(owner::text, 12))::uuid;
end;
$$;

create function pg_temp.nutrients()
returns jsonb
language sql
immutable
as $$
  select '{"kcal":100,"protein_g":5,"fat_g":2,"carbs_g":15,"fibre_g":1}'::jsonb
$$;

-- The shared reference rows an account can point at: a CoFID food with a portion, and a library
-- exercise with a primary muscle. They have no owner, so deleting an account must leave them.
insert into public.foods (id, source, source_ref, owner_id, name, basis, kcal) values
  ('11210000-0000-4000-8000-000000000f01', 'cofid', 'KEY1121-CF-1', null, 'key1121-shared-oats', 'per_100g', 372);

insert into public.food_portions (id, food_id, owner_id, label, grams) values
  ('11210000-0000-4000-8000-000000000f02', '11210000-0000-4000-8000-000000000f01', null, 'key1121-shared-bowl', 40);

insert into public.exercises (id, owner_id, source, source_ref, name, equipment, mechanic) values
  ('11210000-0000-4000-8000-000000000e01', null, 'free_exercise_db', 'KEY1121-EX-1', 'key1121-shared-press', 'barbell', 'compound');

insert into public.exercise_muscles (id, exercise_id, owner_id, muscle_id, role, weight) values
  ('11210000-0000-4000-8000-000000000e02', '11210000-0000-4000-8000-000000000e01', null, 'chest_lower', 'primary', 1),
  ('11210000-0000-4000-8000-000000000e03', '11210000-0000-4000-8000-000000000e01', null, 'triceps', 'secondary', 0.5);

-- One row in every user-owned table for one account, inserted as postgres so the fixtures are the
-- subject and the policies are not. Several rows point at each other through `no action` keys and
-- at the shared rows above. The rate limit buckets cover the four per-user formats.
create function pg_temp.seed_account(owner uuid)
returns void
language plpgsql
as $$
declare
  suffix text := right(owner::text, 12);
  spare_conversation uuid := gen_random_uuid();
  spare_turn uuid := gen_random_uuid();
  hit_offset integer := case when suffix = '0000000000aa' then 0 else 1 end;
begin
  insert into public.profiles (id) values (owner) on conflict (id) do nothing;

  insert into public.foods (id, source, owner_id, name, basis, kcal) values
    (pg_temp.row_id(owner, 'food'), 'user', owner, 'key1121-own-food', 'per_100g', 250);
  insert into public.foods (id, source, owner_id, name, basis, kcal, deleted_at) values
    (pg_temp.row_id(owner, 'deleted_food'), 'user', owner, 'key1121-own-deleted-food', 'per_100g', 100, '2026-11-02 09:00:00+00');
  insert into public.foods (id, source, owner_id, name, basis, kcal) values
    (pg_temp.row_id(owner, 'spare_food'), 'user', owner, 'key1121-spare-food', 'per_100g', 120);
  insert into public.food_portions (id, food_id, owner_id, label, grams) values
    (pg_temp.row_id(owner, 'portion'), pg_temp.row_id(owner, 'food'), owner, 'key1121-own-slice', 30);

  insert into public.recipes (id, owner_id, name, servings, computed) values
    (pg_temp.row_id(owner, 'recipe'), owner, 'key1121-own-recipe', 2, '{}'),
    (pg_temp.row_id(owner, 'spare_recipe'), owner, 'key1121-spare-recipe', 1, '{}');
  insert into public.recipe_ingredients (recipe_id, owner_id, position, food_id, portion_id, quantity, unit, resolved_grams, snapshot) values
    (pg_temp.row_id(owner, 'recipe'), owner, 0, pg_temp.row_id(owner, 'food'), pg_temp.row_id(owner, 'portion'), 2, 'portion', 60, '{}');

  insert into public.food_log_entries (user_id, local_date, item_type, food_id, portion_id, snapshot, nutrients) values
    (owner, '2026-11-01', 'food', pg_temp.row_id(owner, 'food'), pg_temp.row_id(owner, 'portion'), '{}', pg_temp.nutrients());
  insert into public.food_log_entries (user_id, local_date, item_type, recipe_id, snapshot, nutrients) values
    (owner, '2026-11-01', 'recipe', pg_temp.row_id(owner, 'recipe'), '{}', pg_temp.nutrients());
  insert into public.food_log_entries (user_id, local_date, item_type, food_id, snapshot, nutrients) values
    (owner, '2026-11-01', 'food', '11210000-0000-4000-8000-000000000f01', '{}', pg_temp.nutrients());
  insert into public.food_log_entries (user_id, local_date, item_type, snapshot, nutrients, deleted_at) values
    (owner, '2026-11-01', 'quick', '{}', pg_temp.nutrients(), '2026-11-02 09:00:00+00');

  insert into public.food_favourites (owner_id, food_id) values (owner, pg_temp.row_id(owner, 'food'));
  insert into public.recipe_favourites (owner_id, recipe_id) values (owner, pg_temp.row_id(owner, 'recipe'));
  insert into public.palate_preferences (owner_id, kind, food_id) values (owner, 'not_usual', pg_temp.row_id(owner, 'food'));
  insert into public.shopping_list_items (owner_id, food_id, name, position) values
    (owner, pg_temp.row_id(owner, 'food'), 'key1121-own-item', 0);

  insert into public.exercises (id, owner_id, source, name, equipment, mechanic) values
    (pg_temp.row_id(owner, 'exercise'), owner, 'user', 'key1121-own-exercise', 'dumbbell', 'isolation');
  insert into public.exercise_muscles (exercise_id, owner_id, muscle_id, role, weight) values
    (pg_temp.row_id(owner, 'exercise'), owner, 'biceps', 'primary', 1);

  insert into public.routines (id, user_id, name) values (pg_temp.row_id(owner, 'routine'), owner, 'key1121-own-routine');
  insert into public.routine_days (id, routine_id, user_id, position, name) values
    (pg_temp.row_id(owner, 'routine_day'), pg_temp.row_id(owner, 'routine'), owner, 0, 'key1121-own-day');
  insert into public.routine_exercises (routine_day_id, user_id, position, exercise_id, target_sets, rep_min, rep_max) values
    (pg_temp.row_id(owner, 'routine_day'), owner, 0, pg_temp.row_id(owner, 'exercise'), 3, 8, 12),
    (pg_temp.row_id(owner, 'routine_day'), owner, 1, '11210000-0000-4000-8000-000000000e01', 3, 5, 8);

  insert into public.workout_sessions (id, user_id, started_at, local_date, tz, deleted_at) values
    (pg_temp.row_id(owner, 'session'), owner, '2026-11-01 08:00:00+00', '2026-11-01', 'Europe/London', null);
  insert into public.workout_sets (session_id, user_id, exercise_id, position, reps, snapshot) values
    (pg_temp.row_id(owner, 'session'), owner, pg_temp.row_id(owner, 'exercise'), 0, 10, '{"version":1}'),
    (pg_temp.row_id(owner, 'session'), owner, '11210000-0000-4000-8000-000000000e01', 1, 5, '{"version":1}');

  insert into public.accepted_suggestions (user_id, local_date, routine_day_id, exercises, reasons, params_version) values
    (owner, '2026-11-01', pg_temp.row_id(owner, 'routine_day'), '[{"slot":1}]', '{}', 'key1121-v1');

  insert into public.weigh_ins (user_id, measured_at, local_date, tz, weight_kg, source) values
    (owner, '2026-11-01 07:00:00+00', '2026-11-01', 'Europe/London', 70, 'manual'),
    (owner, '2026-11-02 07:00:00+00', '2026-11-02', 'Europe/London', 71, 'manual');
  update public.weigh_ins set deleted_at = '2026-11-03 09:00:00+00' where user_id = owner and local_date = '2026-11-02';
  insert into public.body_measurements (user_id, kind, measured_at, local_date, tz, value, source) values
    (owner, 'body_fat_pct', '2026-11-01 07:00:00+00', '2026-11-01', 'Europe/London', 20, 'manual'),
    (owner, 'lean_mass_kg', '2026-11-02 07:00:00+00', '2026-11-02', 'Europe/London', 55, 'manual');
  update public.body_measurements set deleted_at = '2026-11-03 09:00:00+00' where user_id = owner and local_date = '2026-11-02';

  insert into public.programs (id, user_id, goal, rate_pct_per_week, protein_g_per_kg, fat_fraction_of_remaining, split_preset, started_on) values
    (pg_temp.row_id(owner, 'program'), owner, 'maintain', 0, 1.6, 0.3, 'balanced', '2026-11-01');
  insert into public.expenditure_snapshots (id, user_id, program_id, as_of_date, kind, mu_kcal, var_kcal2, engine_version, params) values
    (pg_temp.row_id(owner, 'snapshot'), owner, pg_temp.row_id(owner, 'program'), '2026-11-01', 'start', 2400, 400, 'key1121-v1', '{}');
  insert into public.targets (user_id, program_id, expenditure_snapshot_id, effective_from, calories_kcal, protein_g, fat_g, carbs_g, dow_calories_kcal, basis, engine_version, params) values
    (owner, pg_temp.row_id(owner, 'program'), pg_temp.row_id(owner, 'snapshot'), '2026-11-01', 2400, 150, 70, 280, array[2400, 2400, 2400, 2400, 2400, 2400, 2400], '{}', 'key1121-v1', '{}');
  insert into public.training_goals (user_id, goal, days_per_week, session_minutes, experience, muscle_priority, params_version) values
    (owner, 'hybrid', 3, 60, 'beginner', '{}', 'key1121-v1');

  insert into public.meal_plans (id, owner_id, start_date, day_count, rules, source) values
    (pg_temp.row_id(owner, 'plan'), owner, '2026-11-02', 1, '{}', 'app');
  insert into public.meal_plan_days (id, plan_id, owner_id, local_date, target) values
    (pg_temp.row_id(owner, 'plan_day'), pg_temp.row_id(owner, 'plan'), owner, '2026-11-02', '{}');
  insert into public.meal_plan_items (id, day_id, owner_id, position, item_type, food_id, portion_id, grams, nutrients, snapshot) values
    (pg_temp.row_id(owner, 'plan_item'), pg_temp.row_id(owner, 'plan_day'), owner, 0, 'food', pg_temp.row_id(owner, 'food'), pg_temp.row_id(owner, 'portion'), 100, '{}', '{}');
  insert into public.meal_plan_items (day_id, owner_id, position, item_type, recipe_id, servings, leftover_of, nutrients, snapshot) values
    (pg_temp.row_id(owner, 'plan_day'), owner, 1, 'recipe', pg_temp.row_id(owner, 'recipe'), 1, pg_temp.row_id(owner, 'plan_item'), '{}', '{}');

  insert into public.assistant_conversations (id, user_id) values (pg_temp.row_id(owner, 'conversation'), owner);
  insert into public.assistant_turns (id, conversation_id, user_id, user_message_id) values
    (pg_temp.row_id(owner, 'turn'), pg_temp.row_id(owner, 'conversation'), owner, pg_temp.row_id(owner, 'user_message'));
  insert into public.assistant_messages (id, conversation_id, turn_id, user_id, role, content, seq) values
    (pg_temp.row_id(owner, 'user_message'), pg_temp.row_id(owner, 'conversation'), pg_temp.row_id(owner, 'turn'), owner, 'user', '{}', 1);
  insert into public.assistant_actions (user_id, conversation_id, turn_id, turn_seq, tool, target_table) values
    (owner, pg_temp.row_id(owner, 'conversation'), pg_temp.row_id(owner, 'turn'), 1, 'key1121-tool', 'food_log_entries');
  -- An action whose conversation has been deleted keeps its row with a null conversation.
  insert into public.assistant_conversations (id, user_id) values (spare_conversation, owner);
  insert into public.assistant_turns (id, conversation_id, user_id, user_message_id) values
    (spare_turn, spare_conversation, owner, gen_random_uuid());
  insert into public.assistant_actions (user_id, conversation_id, turn_id, turn_seq, tool, target_table) values
    (owner, spare_conversation, spare_turn, 1, 'key1121-tool', 'food_log_entries');
  delete from public.assistant_conversations where id = spare_conversation;
  insert into public.assistant_usage (user_id, turn_id, route, model, input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens, cost_usd_micros, latency_ms, transport) values
    (owner, pg_temp.row_id(owner, 'turn'), 'describe_or_ask', 'key1121-model', 1, 1, 0, 0, 1, 1, 'none');
  insert into public.entitlements (user_id, feature, plan, source) values (owner, 'assistant', 'free', 'key1121');

  insert into public.achievement_events (user_id, kind) values (owner, 'week_view_opened');
  insert into public.user_achievements (user_id, achievement_id) values (owner, 'key1121-first');
  insert into public.streak_freeze_events (user_id, kind, reason, ref, count, local_date) values
    (owner, 'earned', 'first_use', 'key1121', 1, '2026-11-01');
  insert into public.day_logs (user_id, local_date) values (owner, '2026-11-01');
  insert into public.push_tokens (user_id, token, platform) values (owner, 'ExponentPushToken[key1121-' || suffix || ']', 'ios');
  insert into public.feature_requests (user_id, source, request) values (owner, 'more_menu', 'key1121 request');

  insert into public.rate_limits (bucket, window_start, hits) values
    ('off-search:user:' || owner, '2001-01-01 00:00:00+00', 2 + hit_offset),
    ('off-product:user:' || owner, '2001-01-01 00:00:00+00', 4 + hit_offset),
    ('assistant:turns:' || owner, '2001-01-01 00:00:00+00', 6 + hit_offset),
    ('delete-account:user:' || owner, '2001-01-01 00:00:00+00', 8 + hit_offset);
end;
$$;

select pg_temp.seed_account('11210000-0000-4000-8000-0000000000aa');
select pg_temp.seed_account('11210000-0000-4000-8000-0000000000bb');

-- Rate limit rows that are not an account's four per-user buckets: the two global buckets, and a
-- bucket that contains the id of account A without ending in it, which is not a per-user bucket by
-- the naming rule and so must survive. Every window start is a fixture-only date.
insert into public.rate_limits (bucket, window_start, hits) values
  ('off-search:global', '2001-01-01 00:00:00+00', 10),
  ('off-product:global', '2001-01-01 00:00:00+00', 11),
  ('assistant:turns:11210000-0000-4000-8000-0000000000aa:shadow', '2001-01-01 00:00:00+00', 12);

-- Audit log entries in both shapes GoTrue writes: one that names the account as its actor, and a
-- `user_deleted` entry that names it in `traits`. The admin id is a made up actor for the second.
insert into auth.audit_log_entries (instance_id, id, payload) values
  ('00000000-0000-0000-0000-000000000000', '11210000-0000-4000-8000-0000000a0001', '{"action":"login","actor_id":"11210000-0000-4000-8000-0000000000aa","actor_username":"key1121-account-a@keylow.test","log_type":"account"}'),
  ('00000000-0000-0000-0000-000000000000', '11210000-0000-4000-8000-0000000a0002', '{"action":"user_deleted","actor_id":"11210000-0000-4000-8000-0000000000ad","actor_username":"service_role","log_type":"team","traits":{"user_id":"11210000-0000-4000-8000-0000000000aa","user_email":"key1121-account-a@keylow.test"}}'),
  ('00000000-0000-0000-0000-000000000000', '11210000-0000-4000-8000-0000000b0001', '{"action":"login","actor_id":"11210000-0000-4000-8000-0000000000bb","actor_username":"key1121-account-b@keylow.test","log_type":"account"}'),
  ('00000000-0000-0000-0000-000000000000', '11210000-0000-4000-8000-0000000b0002', '{"action":"user_deleted","actor_id":"11210000-0000-4000-8000-0000000000ad","actor_username":"service_role","log_type":"team","traits":{"user_id":"11210000-0000-4000-8000-0000000000bb","user_email":"key1121-account-b@keylow.test"}}');

-- Cross-account cases. Each statement is one insert by account B whose only foreign reference
-- (the %1$L placeholder) is a row of account A. The control is the same statement pointing at a row
-- of B (`control_kind` names a different row of B where the first one would repeat a seeded row),
-- which proves the statement is well formed and that the reference alone is what is refused.
-- `writable` is false for the tables the API roles cannot write at all, which have no control.
create temp table cross_account_cases (
  label text primary key,
  reference_kind text not null,
  control_kind text,
  statement text not null,
  writable boolean not null,
  refusal_code text not null default '42501'
);
grant select on cross_account_cases to authenticated;

insert into cross_account_cases (label, reference_kind, statement, writable) values
    ('diary entry on a private food', 'food', $stmt$insert into public.food_log_entries (user_id, local_date, item_type, food_id, snapshot, nutrients) values (%2$L, '2026-11-05', 'food', %1$L, '{}', pg_temp.nutrients())$stmt$, true),
    ('diary entry on a recipe', 'recipe', $stmt$insert into public.food_log_entries (user_id, local_date, item_type, recipe_id, snapshot, nutrients) values (%2$L, '2026-11-05', 'recipe', %1$L, '{}', pg_temp.nutrients())$stmt$, true),
    ('recipe ingredient on a private food', 'food', $stmt$insert into public.recipe_ingredients (recipe_id, owner_id, position, food_id, quantity, unit, resolved_grams, snapshot) values (pg_temp.row_id(%2$L, 'recipe'), %2$L, 10, %1$L, 1, 'g', 100, '{}')$stmt$, true),
    ('routine exercise on a custom exercise', 'exercise', $stmt$insert into public.routine_exercises (routine_day_id, user_id, position, exercise_id, target_sets, rep_min, rep_max) values (pg_temp.row_id(%2$L, 'routine_day'), %2$L, 10, %1$L, 3, 8, 12)$stmt$, true),
    ('workout set on a custom exercise', 'exercise', $stmt$insert into public.workout_sets (session_id, user_id, exercise_id, position, reps, snapshot) values (pg_temp.row_id(%2$L, 'session'), %2$L, %1$L, 10, 5, '{"version":1}')$stmt$, true),
    ('food favourite of a private food', 'food', $stmt$insert into public.food_favourites (owner_id, food_id) values (%2$L, %1$L)$stmt$, true),
    ('recipe favourite of a recipe', 'recipe', $stmt$insert into public.recipe_favourites (owner_id, recipe_id) values (%2$L, %1$L)$stmt$, true),
    ('exercise muscle on a custom exercise', 'exercise', $stmt$insert into public.exercise_muscles (exercise_id, owner_id, muscle_id, role, weight) values (%1$L, %2$L, 'forearms', 'secondary', 0.5)$stmt$, true),
    ('accepted suggestion on a routine day', 'routine_day', $stmt$insert into public.accepted_suggestions (user_id, local_date, routine_day_id, exercises, reasons, params_version) values (%2$L, '2026-11-05', %1$L, '[{"slot":1}]', '{}', 'key1121-v1')$stmt$, true),
    ('assistant action on a conversation', 'conversation', $stmt$insert into public.assistant_actions (user_id, conversation_id, turn_seq, tool, target_table) values (%2$L, %1$L, 3, 'key1121-tool', 'food_log_entries')$stmt$, false),
    ('assistant action on a turn', 'turn', $stmt$insert into public.assistant_actions (user_id, turn_id, turn_seq, tool, target_table) values (%2$L, %1$L, 4, 'key1121-tool', 'food_log_entries')$stmt$, false),
    ('assistant message in a conversation', 'conversation', $stmt$insert into public.assistant_messages (conversation_id, turn_id, user_id, role, content, seq) values (%1$L, pg_temp.row_id(%2$L, 'turn'), %2$L, 'user', '{}', 7)$stmt$, false),
    ('assistant message on a turn', 'turn', $stmt$insert into public.assistant_messages (conversation_id, turn_id, user_id, role, content, seq) values (pg_temp.row_id(%2$L, 'conversation'), %1$L, %2$L, 'user', '{}', 8)$stmt$, false),
    ('assistant turn in a conversation', 'conversation', $stmt$insert into public.assistant_turns (conversation_id, user_id, user_message_id) values (%1$L, %2$L, gen_random_uuid())$stmt$, false),
    ('expenditure snapshot on a program', 'program', $stmt$insert into public.expenditure_snapshots (user_id, program_id, as_of_date, kind, mu_kcal, var_kcal2, engine_version, params) values (%2$L, %1$L, '2026-11-09', 'start', 2400, 400, 'key1121-v1', '{}')$stmt$, false),
    ('diary entry on a food portion', 'portion', $stmt$insert into public.food_log_entries (user_id, local_date, item_type, food_id, portion_id, snapshot, nutrients) values (%2$L, '2026-11-05', 'food', pg_temp.row_id(%2$L, 'food'), %1$L, '{}', pg_temp.nutrients())$stmt$, true),
    ('food portion on a private food', 'food', $stmt$insert into public.food_portions (food_id, owner_id, label, grams) values (%1$L, %2$L, 'key1121-other-slice', 10)$stmt$, true),
    ('meal plan day on a meal plan', 'plan', $stmt$insert into public.meal_plan_days (plan_id, owner_id, local_date, target) values (%1$L, %2$L, '2026-11-09', '{}')$stmt$, true),
    ('meal plan item on a meal plan day', 'plan_day', $stmt$insert into public.meal_plan_items (day_id, owner_id, position, item_type, food_id, grams, nutrients, snapshot) values (%1$L, %2$L, 11, 'food', pg_temp.row_id(%2$L, 'food'), 10, '{}', '{}')$stmt$, true),
    ('meal plan item on a private food', 'food', $stmt$insert into public.meal_plan_items (day_id, owner_id, position, item_type, food_id, grams, nutrients, snapshot) values (pg_temp.row_id(%2$L, 'plan_day'), %2$L, 12, 'food', %1$L, 10, '{}', '{}')$stmt$, true),
    ('meal plan item leftover of another item', 'plan_item', $stmt$insert into public.meal_plan_items (day_id, owner_id, position, item_type, food_id, grams, leftover_of, nutrients, snapshot) values (pg_temp.row_id(%2$L, 'plan_day'), %2$L, 13, 'food', pg_temp.row_id(%2$L, 'food'), 10, %1$L, '{}', '{}')$stmt$, true),
    ('meal plan item on a food portion', 'portion', $stmt$insert into public.meal_plan_items (day_id, owner_id, position, item_type, food_id, portion_id, grams, nutrients, snapshot) values (pg_temp.row_id(%2$L, 'plan_day'), %2$L, 14, 'food', pg_temp.row_id(%2$L, 'food'), %1$L, 10, '{}', '{}')$stmt$, true),
    ('meal plan item on a recipe', 'recipe', $stmt$insert into public.meal_plan_items (day_id, owner_id, position, item_type, recipe_id, servings, nutrients, snapshot) values (pg_temp.row_id(%2$L, 'plan_day'), %2$L, 15, 'recipe', %1$L, 1, '{}', '{}')$stmt$, true),
    ('palate preference on a private food', 'food', $stmt$insert into public.palate_preferences (owner_id, kind, food_id) values (%2$L, 'not_usual', %1$L)$stmt$, true),
    ('palate preference on a recipe', 'recipe', $stmt$insert into public.palate_preferences (owner_id, kind, recipe_id) values (%2$L, 'not_usual', %1$L)$stmt$, true),
    ('recipe ingredient on a food portion', 'portion', $stmt$insert into public.recipe_ingredients (recipe_id, owner_id, position, food_id, portion_id, quantity, unit, resolved_grams, snapshot) values (pg_temp.row_id(%2$L, 'recipe'), %2$L, 11, pg_temp.row_id(%2$L, 'food'), %1$L, 1, 'portion', 10, '{}')$stmt$, true),
    ('recipe ingredient in a recipe', 'recipe', $stmt$insert into public.recipe_ingredients (recipe_id, owner_id, position, food_id, quantity, unit, resolved_grams, snapshot) values (%1$L, %2$L, 12, pg_temp.row_id(%2$L, 'food'), 1, 'g', 10, '{}')$stmt$, true),
    ('routine day in a routine', 'routine', $stmt$insert into public.routine_days (routine_id, user_id, position, name) values (%1$L, %2$L, 10, 'key1121-other-day')$stmt$, true),
    ('routine exercise on a routine day', 'routine_day', $stmt$insert into public.routine_exercises (routine_day_id, user_id, position, exercise_id, target_sets, rep_min, rep_max) values (%1$L, %2$L, 11, pg_temp.row_id(%2$L, 'exercise'), 3, 8, 12)$stmt$, true),
    ('shopping list item on a private food', 'food', $stmt$insert into public.shopping_list_items (owner_id, food_id, name, position) values (%2$L, %1$L, 'key1121-other-item', 10)$stmt$, true),
    ('target on an expenditure snapshot', 'snapshot', $stmt$insert into public.targets (user_id, expenditure_snapshot_id, effective_from, calories_kcal, protein_g, fat_g, carbs_g, dow_calories_kcal, basis, engine_version, params) values (%2$L, %1$L, '2026-11-09', 2400, 1, 1, 1, array[1, 1, 1, 1, 1, 1, 1], '{}', 'key1121-v1', '{}')$stmt$, false),
    ('target on a program', 'program', $stmt$insert into public.targets (user_id, program_id, effective_from, calories_kcal, protein_g, fat_g, carbs_g, dow_calories_kcal, basis, engine_version, params) values (%2$L, %1$L, '2026-11-09', 2400, 1, 1, 1, array[1, 1, 1, 1, 1, 1, 1], '{}', 'key1121-v1', '{}')$stmt$, false),
    ('workout session on a routine day', 'routine_day', $stmt$insert into public.workout_sessions (user_id, started_at, ended_at, local_date, tz, routine_day_id) values (%2$L, '2026-11-09 08:00:00+00', '2026-11-09 09:00:00+00', '2026-11-09', 'Europe/London', %1$L)$stmt$, true),
    ('workout set in a workout session', 'session', $stmt$insert into public.workout_sets (session_id, user_id, exercise_id, position, reps, snapshot) values (%1$L, %2$L, pg_temp.row_id(%2$L, 'exercise'), 11, 5, '{"version":1}')$stmt$, true);

update cross_account_cases set refusal_code = '23503' where label = 'meal plan item leftover of another item';
update cross_account_cases set control_kind = 'spare_food' where label in ('food favourite of a private food', 'palate preference on a private food');
update cross_account_cases set control_kind = 'spare_recipe' where label = 'recipe favourite of a recipe';

-- Guard (a): every foreign key to auth.users outside the auth schema cascades.
select is_empty(
  $$select conrelid::regclass::text from pg_constraint
    where contype = 'f' and confrelid = 'auth.users'::regclass
      and connamespace <> 'auth'::regnamespace and confdeltype <> 'c'$$,
  'every foreign key to auth.users outside the auth schema cascades on delete'
);

-- Guard (b): the tables with a foreign key to auth.users, and the column that holds it, are the 39
-- written out above.
select set_eq(
  $$select conrelid::regclass::text, (select attname::text from pg_attribute where attrelid = conrelid and attnum = conkey[1])
    from pg_constraint
    where contype = 'f' and confrelid = 'auth.users'::regclass and connamespace = 'public'::regnamespace$$,
  $$select table_name, owner_column from pg_temp.owner_columns()$$,
  'the tables with a foreign key to auth.users are the 39 user-owned tables'
);

-- Guard (c): every base table in public is user-owned or one of the 8 that are not.
select set_eq(
  $$select relname::text from pg_class
    where relnamespace = 'public'::regnamespace and relkind in ('r', 'p') and not relispartition$$,
  $$select table_name from pg_temp.owner_columns()
    union all
    select unnest(array[
      'muscles', 'exercise_form_videos', 'exercise_source_data', 'exercise_import_runs',
      'food_source_data', 'import_runs', 'off_search_results', 'rate_limits'
    ])$$,
  'every base table in public is classified as user-owned or as not the user''s'
);

-- Guard (d): the keys that do not cascade or null, from one user-owned table to another, are the
-- five that a cross-account row could use to block a deletion.
select set_eq(
  $$select conrelid::regclass::text || '.' || (select string_agg(attname, ',' order by attnum) from pg_attribute where attrelid = conrelid and attnum = any(conkey))
    from pg_constraint
    where contype = 'f' and connamespace = 'public'::regnamespace and confdeltype in ('a', 'r')
      and conrelid::regclass::text in (select table_name from pg_temp.owner_columns())
      and confrelid::regclass::text in (select table_name from pg_temp.owner_columns())$$,
  $$values
    ('food_log_entries.food_id'),
    ('recipe_ingredients.food_id'),
    ('food_log_entries.recipe_id'),
    ('routine_exercises.exercise_id'),
    ('workout_sets.exercise_id')$$,
  'the no action keys between user-owned tables are the five known ones'
);

-- The trigger that purges rate limit buckets.
select has_function('public', 'purge_deleted_user_traces', array[]::text[], 'purge_deleted_user_traces exists');
select function_returns('public', 'purge_deleted_user_traces', array[]::text[], 'trigger', 'purge_deleted_user_traces returns trigger');
select function_lang_is('public', 'purge_deleted_user_traces', array[]::text[], 'plpgsql', 'purge_deleted_user_traces is plpgsql');
select is_definer('public', 'purge_deleted_user_traces', array[]::text[], 'purge_deleted_user_traces is security definer');
select is(
  (select proconfig from pg_proc where oid = to_regprocedure('public.purge_deleted_user_traces()')),
  array['search_path=""'],
  'purge_deleted_user_traces pins an empty search_path'
);
select is_empty(
  $$select a.grantee from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid = to_regprocedure('public.purge_deleted_user_traces()') and a.privilege_type = 'EXECUTE'
      and (a.grantee = 0 or a.grantee in (select oid from pg_roles where rolname in ('anon', 'authenticated', 'service_role')))$$,
  'purge_deleted_user_traces is executable by neither public, anon, authenticated nor service_role'
);
select trigger_is(
  'auth', 'users', 'on_auth_user_deleted_purge_traces', 'public', 'purge_deleted_user_traces',
  'the purge is a trigger on auth.users'
);
select is(
  (select tgtype::integer from pg_trigger where tgrelid = 'auth.users'::regclass and tgname = 'on_auth_user_deleted_purge_traces'),
  9,
  'the purge runs after delete, once per row, and not on insert, update or truncate'
);
select is(
  (select tgenabled::text from pg_trigger where tgrelid = 'auth.users'::regclass and tgname = 'on_auth_user_deleted_purge_traces'),
  'O',
  'the purge is enabled'
);
select is(
  has_table_privilege('supabase_auth_admin', 'public.rate_limits', 'delete'),
  false,
  'supabase_auth_admin, the role that deletes users, cannot delete from rate_limits itself'
);
select is(
  has_table_privilege((select proowner::regrole::text from pg_proc where oid = to_regprocedure('public.purge_deleted_user_traces()')), 'public.rate_limits', 'delete'),
  true,
  'the owner of purge_deleted_user_traces can delete from rate_limits'
);
select is(
  has_table_privilege((select proowner::regrole::text from pg_proc where oid = to_regprocedure('public.purge_deleted_user_traces()')), 'auth.audit_log_entries', 'delete'),
  true,
  'the owner of purge_deleted_user_traces can delete from the auth audit log'
);

-- Before the delete: both accounts have rows in every user-owned table, and the buckets are there.
select ok(
  pg_temp.owned_rows(table_name, owner_column, '11210000-0000-4000-8000-0000000000aa') >= 1,
  'the account to delete has a row in ' || table_name
)
from pg_temp.owner_columns()
order by table_name;

select is_empty(
  $$select table_name from pg_temp.owner_columns()
    where pg_temp.owned_rows(table_name, owner_column, '11210000-0000-4000-8000-0000000000bb') = 0$$,
  'the account to keep has a row in every user-owned table'
);

select is(
  (select count(*)::integer from public.assistant_actions
   where user_id = '11210000-0000-4000-8000-0000000000aa' and conversation_id is null),
  1,
  'an assistant action whose conversation was deleted is among the rows to delete'
);

select set_eq(
  $$select bucket, hits, window_start from public.rate_limits
    where window_start = '2001-01-01 00:00:00+00' and bucket like '%11210000-0000-4000-8000-0000000000aa'$$,
  $$values
    ('off-search:user:11210000-0000-4000-8000-0000000000aa', 2, '2001-01-01 00:00:00+00'::timestamptz),
    ('off-product:user:11210000-0000-4000-8000-0000000000aa', 4, '2001-01-01 00:00:00+00'::timestamptz),
    ('assistant:turns:11210000-0000-4000-8000-0000000000aa', 6, '2001-01-01 00:00:00+00'::timestamptz),
    ('delete-account:user:11210000-0000-4000-8000-0000000000aa', 8, '2001-01-01 00:00:00+00'::timestamptz)$$,
  'the account to delete has its four per-user buckets'
);

select is(
  (select count(*)::integer from auth.audit_log_entries
   where id in ('11210000-0000-4000-8000-0000000a0001', '11210000-0000-4000-8000-0000000a0002')),
  2,
  'the account to delete has an actor entry and a user_deleted entry in the audit log'
);

create temp table before_counts as
select table_name, owner_column, pg_temp.owned_rows(table_name, owner_column, '11210000-0000-4000-8000-0000000000bb') as row_count
from pg_temp.owner_columns();

-- The red team: account B tries to point its own rows at rows of account A.
select is_empty(
  $$select label from cross_account_cases where not writable
    and has_table_privilege('authenticated', 'public.' || split_part(substring(statement from 'insert into public\.(\w+)'), ' ', 1), 'insert')$$,
  'the tables that account B cannot write are not writable by the authenticated role'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"11210000-0000-4000-8000-0000000000bb","role":"authenticated"}';

select throws_ok(
  format(statement, pg_temp.row_id('11210000-0000-4000-8000-0000000000aa', reference_kind), '11210000-0000-4000-8000-0000000000bb'),
  refusal_code,
  null,
  'account B cannot insert a ' || label || ' that points at a row of account A'
)
from cross_account_cases
order by label;

reset role;

select is_empty(
  $$select table_name from before_counts
    where row_count <> pg_temp.owned_rows(table_name, owner_column, '11210000-0000-4000-8000-0000000000bb')$$,
  'no refused insert wrote a row for account B'
);

-- `set constraints all immediate` is what runs the deferred primary muscle checks in this file,
-- because it never commits. This control shows it does: an exercise without a primary muscle fails
-- on it.
select throws_ok(
  $$insert into public.exercises (id, owner_id, source, source_ref, name, equipment, mechanic)
    values ('11210000-0000-4000-8000-000000000e99', null, 'free_exercise_db', 'KEY1121-EX-99', 'key1121-no-muscle', 'barbell', 'compound');
    set constraints all immediate$$,
  '23514',
  'an exercise needs at least one primary muscle',
  'set constraints all immediate runs the deferred primary muscle check'
);

-- The delete, as postgres (see the header). The second statement runs the deferred checks that a
-- commit would run, which this file never reaches because it rolls back.
select lives_ok(
  $$delete from auth.users where id = '11210000-0000-4000-8000-0000000000aa'; set constraints all immediate$$,
  'deleting the auth user of account A succeeds, with the deferred checks run'
);

-- After the delete.
select is(
  pg_temp.owned_rows(table_name, owner_column, '11210000-0000-4000-8000-0000000000aa'),
  0::bigint,
  'the deleted account has no row left in ' || table_name
)
from pg_temp.owner_columns()
order by table_name;

select is(
  (select count(*)::integer from auth.identities where user_id = '11210000-0000-4000-8000-0000000000aa'),
  0,
  'the deleted account has no identity left'
);
select is(
  (select count(*)::integer from public.assistant_actions where user_id = '11210000-0000-4000-8000-0000000000aa'),
  0,
  'the assistant action with no conversation went with the account'
);

select is_empty(
  $$select bucket from public.rate_limits
    where bucket = any(array[
      'off-search:user:11210000-0000-4000-8000-0000000000aa',
      'off-product:user:11210000-0000-4000-8000-0000000000aa',
      'assistant:turns:11210000-0000-4000-8000-0000000000aa',
      'delete-account:user:11210000-0000-4000-8000-0000000000aa'
    ])$$,
  'the four per-user rate limit buckets of the deleted account are gone'
);

select set_eq(
  $$select bucket, hits, window_start from public.rate_limits
    where window_start = '2001-01-01 00:00:00+00'
      and (bucket like '%11210000-0000-4000-8000-0000000000bb' or bucket like '%:global')$$,
  $$values
    ('off-search:user:11210000-0000-4000-8000-0000000000bb', 3, '2001-01-01 00:00:00+00'::timestamptz),
    ('off-product:user:11210000-0000-4000-8000-0000000000bb', 5, '2001-01-01 00:00:00+00'::timestamptz),
    ('assistant:turns:11210000-0000-4000-8000-0000000000bb', 7, '2001-01-01 00:00:00+00'::timestamptz),
    ('delete-account:user:11210000-0000-4000-8000-0000000000bb', 9, '2001-01-01 00:00:00+00'::timestamptz),
    ('off-search:global', 10, '2001-01-01 00:00:00+00'::timestamptz),
    ('off-product:global', 11, '2001-01-01 00:00:00+00'::timestamptz)$$,
  'the four buckets of the kept account and the two global buckets are unchanged'
);

select set_eq(
  $$select bucket, hits from public.rate_limits
    where window_start = '2001-01-01 00:00:00+00' and bucket like '%11210000-0000-4000-8000-0000000000aa:shadow'$$,
  $$values ('assistant:turns:11210000-0000-4000-8000-0000000000aa:shadow', 12)$$,
  'a bucket that contains the deleted id without ending in it is not purged'
);

select is(
  (select count(*)::integer from auth.audit_log_entries
   where id in ('11210000-0000-4000-8000-0000000a0001', '11210000-0000-4000-8000-0000000a0002')),
  0,
  'both audit log entries of the deleted account are gone'
);
select is(
  (select count(*)::integer from auth.audit_log_entries
   where id in ('11210000-0000-4000-8000-0000000b0001', '11210000-0000-4000-8000-0000000b0002')),
  2,
  'both audit log entries of the kept account are unchanged'
);

select is_empty(
  $$select table_name from before_counts
    where row_count <> pg_temp.owned_rows(table_name, owner_column, '11210000-0000-4000-8000-0000000000bb')$$,
  'every row of the kept account is still there, table by table'
);

select is(
  (select count(*)::integer from auth.identities where user_id = '11210000-0000-4000-8000-0000000000bb'),
  1,
  'the kept account still has its identity'
);

select set_eq(
  $$select id from public.foods where id = '11210000-0000-4000-8000-000000000f01'
    union all select id from public.food_portions where id = '11210000-0000-4000-8000-000000000f02'
    union all select id from public.exercises where id = '11210000-0000-4000-8000-000000000e01'
    union all select id from public.exercise_muscles where exercise_id = '11210000-0000-4000-8000-000000000e01'$$,
  $$values
    ('11210000-0000-4000-8000-000000000f01'::uuid),
    ('11210000-0000-4000-8000-000000000f02'),
    ('11210000-0000-4000-8000-000000000e01'),
    ('11210000-0000-4000-8000-000000000e02'),
    ('11210000-0000-4000-8000-000000000e03')$$,
  'the shared food, its portion, the library exercise and its muscles that the deleted account used are still there'
);

-- Controls: the cross-account statements that were refused are well formed, because the same
-- statement pointing at a row of B succeeds.
set local role authenticated;
set local request.jwt.claims = '{"sub":"11210000-0000-4000-8000-0000000000bb","role":"authenticated"}';

select lives_ok(
  format(statement, pg_temp.row_id('11210000-0000-4000-8000-0000000000bb', coalesce(control_kind, reference_kind)), '11210000-0000-4000-8000-0000000000bb'),
  'control: account B can insert a ' || label || ' that points at its own row'
)
from cross_account_cases
where writable
order by label;

reset role;

select * from finish();

rollback;
