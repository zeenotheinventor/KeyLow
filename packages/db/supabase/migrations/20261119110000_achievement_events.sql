-- Achievement events and the counts that read them (KEY-1094, part of KEY-1079). Everything here is set out
-- in docs/adr/0003-data-model.md, Amendment 27, which wins over any other description.
--
-- Seven achievements rely on actions the database did not record. This adds one append only table for
-- them and one more key in the achievement_stats snapshot. The migration inserts no row, so it applies to
-- a database that holds any data.

-- ---------------------------------------------------------------------------------------------
-- achievement_events: one row for each countable action of a person.
-- ---------------------------------------------------------------------------------------------

create table public.achievement_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null,
  ref text,
  created_at timestamptz not null default now(),

  -- A null ref never conflicts, so an action with no ref counts every time. A barcode or an exercise
  -- always has a ref, so it counts once.
  constraint achievement_events_user_id_kind_ref_key unique (user_id, kind, ref),
  constraint achievement_events_kind_check check (kind in (
    'barcode_scanned', 'exercise_demo_opened', 'week_view_opened', 'data_exported',
    'log_from_favourites', 'shopping_item_ticked', 'recipe_draft_saved'
  )),
  -- The ref is a barcode or an exercise id and nothing else, never a health value. The two kinds that
  -- count distinct things must carry one, so a missing ref cannot dodge the unique key, and the others
  -- must not carry one.
  constraint achievement_events_ref_check check (
    (kind in ('barcode_scanned', 'exercise_demo_opened') and ref is not null and char_length(ref) between 1 and 64)
    or (kind not in ('barcode_scanned', 'exercise_demo_opened') and ref is null)
  )
);

alter table public.achievement_events enable row level security;

-- Append only: select and insert, no update and no delete. `user_id`, `id` and `created_at` are not in
-- the insert grant, so a client cannot name another owner or backdate a row.
revoke all on public.achievement_events from anon, authenticated, service_role;
grant select on public.achievement_events to authenticated;
grant insert (kind, ref) on public.achievement_events to authenticated;
grant select on public.achievement_events to service_role;

create policy "achievement_events_select_own" on public.achievement_events
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "achievement_events_insert_own" on public.achievement_events
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------
-- achievement_stats: the same snapshot with the event counts added.
-- ---------------------------------------------------------------------------------------------

-- Replaces the function of 20261119100000_achievements.sql with one more key, `event_counts`, and nothing
-- else changed. `create or replace` keeps the grants of the original.
--
-- Security invoker, so row level security applies to every read, and every query also filters on the
-- caller. Arithmetic and grouping only: no threshold, window or rule lives here.
--
-- Entry times use `profiles.timezone`, because `food_log_entries` has no zone column. An entry's time
-- is its `created_at` in that zone. Weigh-ins and sessions read in their own row's `tz`.
--
-- `p_from` bounds only the lists that grow with time and that a streak or a week rule walks: `days`,
-- `new_foods_per_week` (by the date a food was first logged, over all history), `weigh_ins.dates`,
-- `workouts.weeks` and `workouts.session_best_sets`. Every count and total covers all time, and the
-- short lists (targets, goals, check-ins, programmes, held achievements, the ledger) are whole. A null
-- `p_from` means no lower bound.
--
-- Counted sets are every set that is not a warm-up, in a finished, not deleted session. Weeks run
-- Monday to Sunday by the session's `local_date`. The 00:00 to 04:00 flag is true for a time from
-- 00:00:00 up to but not including 04:00:00. No value from a row is ever raised or logged.
create or replace function public.achievement_stats(p_from date)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  from_date date := coalesce(p_from, date '-infinity');
  zone text;
  result jsonb;
begin
  if caller is null then
    raise exception 'achievement_stats needs a signed-in person' using errcode = '42501';
  end if;

  select profile.timezone into zone from public.profiles profile where profile.id = caller;
  if zone is null then
    raise exception 'achievement_stats needs a profile' using errcode = 'P0002';
  end if;

  with
  live_entries as (
    select entry.local_date, entry.food_id, entry.recipe_id, entry.nutrients,
           (entry.created_at at time zone zone)::time as created_time
    from public.food_log_entries entry
    where entry.user_id = caller and entry.deleted_at is null
  ),
  entry_days as (
    select entry.local_date,
           count(*)::integer as entry_count,
           sum((entry.nutrients ->> 'kcal')::numeric) as kcal,
           sum((entry.nutrients ->> 'protein_g')::numeric) as protein_g,
           sum((entry.nutrients ->> 'carbs_g')::numeric) as carbs_g,
           sum((entry.nutrients ->> 'fat_g')::numeric) as fat_g,
           sum((entry.nutrients ->> 'fibre_g')::numeric) as fibre_g,
           min(entry.created_time) as earliest_time,
           bool_or(entry.created_time < time '04:00') as between_midnight_and_four
    from live_entries entry
    where entry.local_date >= from_date
    group by entry.local_date
  ),
  completion as (
    select log.local_date, log.is_complete, log.completed_at
    from public.day_logs log
    where log.user_id = caller and log.local_date >= from_date
  ),
  day_keys as (
    select local_date from entry_days
    union
    select local_date from completion where is_complete
  ),
  days as (
    select jsonb_build_object(
             'local_date', key.local_date,
             'entry_count', coalesce(entry_day.entry_count, 0),
             'kcal', entry_day.kcal,
             'protein_g', entry_day.protein_g,
             'carbs_g', entry_day.carbs_g,
             'fat_g', entry_day.fat_g,
             'fibre_g', entry_day.fibre_g,
             'is_complete', coalesce(day_completion.is_complete, false),
             'completed_at', day_completion.completed_at,
             'earliest_entry_local_time', to_char(entry_day.earliest_time, 'HH24:MI:SS'),
             'logged_between_midnight_and_four', coalesce(entry_day.between_midnight_and_four, false)
           ) as item,
           key.local_date
    from day_keys key
    left join entry_days entry_day on entry_day.local_date = key.local_date
    left join completion day_completion on day_completion.local_date = key.local_date
  ),
  first_food_day as (
    select entry.food_id, min(entry.local_date) as first_date
    from live_entries entry
    where entry.food_id is not null
    group by entry.food_id
  ),
  new_foods as (
    select date_trunc('week', first.first_date::timestamp)::date as week_start, count(*)::integer as new_foods
    from first_food_day first
    where first.first_date >= from_date
    group by 1
  ),
  favourite_food_logs as (
    select count(*) as logs
    from live_entries entry
    join public.food_favourites favourite
      on favourite.food_id = entry.food_id and favourite.owner_id = caller
    group by entry.food_id
  ),
  recipe_days as (
    select count(distinct entry.local_date) as day_count
    from live_entries entry
    where entry.recipe_id is not null
    group by entry.recipe_id
  ),
  live_weigh_ins as (
    select weigh_in.local_date, weigh_in.measured_at, weigh_in.tz
    from public.weigh_ins weigh_in
    where weigh_in.user_id = caller and weigh_in.deleted_at is null
  ),
  finished_sessions as (
    select session.id, session.started_at, session.local_date, session.tz
    from public.workout_sessions session
    where session.user_id = caller and session.deleted_at is null and session.ended_at is not null
  ),
  counted_sets as (
    select workout_set.session_id, workout_set.exercise_id, workout_set.reps, workout_set.load_kg
    from public.workout_sets workout_set
    join finished_sessions session on session.id = workout_set.session_id
    where workout_set.user_id = caller
      and workout_set.deleted_at is null
      and workout_set.set_type <> 'warmup'
  ),
  session_set_counts as (
    select counted.session_id, count(*) as set_count from counted_sets counted group by counted.session_id
  ),
  session_primary_groups as (
    select distinct counted.session_id, muscle."group"::text as muscle_group
    from counted_sets counted
    join public.exercise_muscles link on link.exercise_id = counted.exercise_id and link.role = 'primary'
    join public.muscles muscle on muscle.id = link.muscle_id
  ),
  week_sessions as (
    select date_trunc('week', session.local_date::timestamp)::date as week_start, count(*)::integer as sessions
    from finished_sessions session
    where session.local_date >= from_date
    group by 1
  ),
  week_groups as (
    select date_trunc('week', session.local_date::timestamp)::date as week_start,
           jsonb_agg(distinct grouped.muscle_group order by grouped.muscle_group) as muscle_groups
    from finished_sessions session
    join session_primary_groups grouped on grouped.session_id = session.id
    where session.local_date >= from_date
    group by 1
  ),
  best_sets as (
    select distinct on (counted.session_id, counted.exercise_id)
           counted.session_id, counted.exercise_id, counted.load_kg, counted.reps
    from counted_sets counted
    order by counted.session_id, counted.exercise_id, coalesce(counted.load_kg, 0) desc, counted.reps desc
  )
  select jsonb_build_object(
    'profile_created_at', (select profile.created_at from public.profiles profile where profile.id = caller),
    'onboarding_completed_at', (select profile.onboarding_completed_at from public.profiles profile where profile.id = caller),
    'targets_updated_at', (select profile.targets_updated_at from public.profiles profile where profile.id = caller),
    'time_zone', zone,
    'manual_targets', (
      select jsonb_build_object(
        'kcal', profile.target_kcal,
        'protein_g', profile.target_protein_g,
        'carbs_g', profile.target_carbs_g,
        'fat_g', profile.target_fat_g
      )
      from public.profiles profile where profile.id = caller
    ),
    'targets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'effective_from', target.effective_from,
        'effective_to', target.effective_to,
        'calories_kcal', target.calories_kcal,
        'protein_g', target.protein_g,
        'carbs_g', target.carbs_g,
        'fat_g', target.fat_g,
        'dow_calories_kcal', target.dow_calories_kcal
      ) order by target.effective_from)
      from public.targets target where target.user_id = caller
    ), '[]'::jsonb),
    'days', coalesce((select jsonb_agg(day.item order by day.local_date) from days day), '[]'::jsonb),
    'entry_totals', jsonb_build_object(
      'entries', (select count(*) from live_entries),
      'distinct_foods', (select count(*) from first_food_day),
      'new_foods_per_week', coalesce((
        select jsonb_agg(jsonb_build_object('week_start', new_food.week_start, 'new_foods', new_food.new_foods)
                         order by new_food.week_start)
        from new_foods new_food
      ), '[]'::jsonb),
      'most_logs_of_favourite_food', coalesce((select max(logs) from favourite_food_logs), 0),
      'own_recipe_entries', (select count(*) from live_entries entry where entry.recipe_id is not null),
      'most_days_for_one_recipe', coalesce((select max(day_count) from recipe_days), 0)
    ),
    'weigh_ins', jsonb_build_object(
      'count', (select count(*) from live_weigh_ins),
      'dates', coalesce((
        select jsonb_agg(distinct_dates.local_date order by distinct_dates.local_date)
        from (select distinct weigh_in.local_date from live_weigh_ins weigh_in where weigh_in.local_date >= from_date) as distinct_dates
      ), '[]'::jsonb),
      'before_nine_count', (
        select count(*) from live_weigh_ins weigh_in
        where (weigh_in.measured_at at time zone weigh_in.tz)::time < time '09:00'
      )
    ),
    'body_measurement_count', (
      select count(*) from public.body_measurements measurement
      where measurement.user_id = caller and measurement.deleted_at is null
    ),
    'workouts', jsonb_build_object(
      'sessions', (select count(*) from finished_sessions),
      'before_seven_count', (
        select count(*) from finished_sessions session
        where (session.started_at at time zone session.tz)::time < time '07:00'
      ),
      'from_twenty_one_count', (
        select count(*) from finished_sessions session
        where (session.started_at at time zone session.tz)::time >= time '21:00'
      ),
      'working_sets', (select count(*) from counted_sets),
      'tonnage_kg', coalesce((select sum(counted.reps * coalesce(counted.load_kg, 0)) from counted_sets counted), 0),
      'most_sets_in_session', coalesce((select max(set_count) from session_set_counts), 0),
      'legs_sessions', (select count(*) from session_primary_groups where muscle_group = 'legs'),
      'distinct_exercises', (select count(distinct counted.exercise_id) from counted_sets counted),
      'weeks', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'week_start', week.week_start,
                 'sessions', week.sessions,
                 'muscle_groups', coalesce(groups.muscle_groups, '[]'::jsonb)
               ) order by week.week_start)
        from week_sessions week
        left join week_groups groups on groups.week_start = week.week_start
      ), '[]'::jsonb),
      'session_best_sets', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'started_at', session.started_at,
                 'local_date', session.local_date,
                 'sets', coalesce((
                   select jsonb_agg(jsonb_build_object(
                            'exercise_id', best.exercise_id,
                            'load_kg', best.load_kg,
                            'reps', best.reps
                          ) order by best.exercise_id)
                   from best_sets best where best.session_id = session.id
                 ), '[]'::jsonb)
               ) order by session.started_at)
        from finished_sessions session
        where session.local_date >= from_date
      ), '[]'::jsonb)
    ),
    'training_goals', coalesce((
      select jsonb_agg(jsonb_build_object(
               'days_per_week', goal.days_per_week,
               'effective_from', goal.effective_from,
               'effective_to', goal.effective_to
             ) order by goal.effective_from)
      from public.training_goals goal where goal.user_id = caller
    ), '[]'::jsonb),
    'active_routine_day_count', (
      select count(*)
      from public.routine_days routine_day
      join public.routines routine on routine.id = routine_day.routine_id
      where routine.user_id = caller and routine.is_active
    ),
    'routines', (select count(*) from public.routines routine where routine.user_id = caller and not routine.is_archived),
    'recipes', (select count(*) from public.recipes recipe where recipe.owner_id = caller and not recipe.is_archived),
    'favourites', (
      (select count(*) from public.food_favourites favourite where favourite.owner_id = caller)
      + (select count(*) from public.recipe_favourites favourite where favourite.owner_id = caller)
    ),
    'meal_plans', (select count(*) from public.meal_plans plan where plan.owner_id = caller),
    'longest_meal_plan_days', coalesce((select max(plan.day_count) from public.meal_plans plan where plan.owner_id = caller), 0),
    'distinct_planned_days', (
      select count(distinct plan_day.local_date) from public.meal_plan_days plan_day where plan_day.owner_id = caller
    ),
    'shopping_list_items', (select count(*) from public.shopping_list_items item where item.owner_id = caller),
    'assistant_user_messages', (
      select count(*) from public.assistant_messages message where message.user_id = caller and message.role = 'user'
    ),
    'assistant_conversations', (
      select count(*) from public.assistant_conversations conversation where conversation.user_id = caller
    ),
    'assistant_log_entry_actions', (
      select count(*) from public.assistant_actions action
      where action.user_id = caller and action.tool = 'log_entry' and action.undone_at is null
    ),
    'assistant_create_recipe_actions', (
      select count(*) from public.assistant_actions action
      where action.user_id = caller and action.tool = 'create_recipe' and action.undone_at is null
    ),
    'feature_requests', (select count(*) from public.feature_requests request where request.user_id = caller),
    'event_counts', jsonb_build_object(
      'distinct_barcodes_scanned', (
        select count(distinct recorded.ref) from public.achievement_events recorded
        where recorded.user_id = caller and recorded.kind = 'barcode_scanned'
      ),
      'exercise_demos_watched', (
        select count(distinct recorded.ref) from public.achievement_events recorded
        where recorded.user_id = caller and recorded.kind = 'exercise_demo_opened'
      ),
      'week_view_opens', (
        select count(*) from public.achievement_events recorded
        where recorded.user_id = caller and recorded.kind = 'week_view_opened'
      ),
      'data_exports', (
        select count(*) from public.achievement_events recorded
        where recorded.user_id = caller and recorded.kind = 'data_exported'
      ),
      'logs_from_favourites', (
        select count(*) from public.achievement_events recorded
        where recorded.user_id = caller and recorded.kind = 'log_from_favourites'
      ),
      'shopping_items_ticked_off', (
        select count(*) from public.achievement_events recorded
        where recorded.user_id = caller and recorded.kind = 'shopping_item_ticked'
      ),
      'assistant_drafts_saved', (
        select count(*) from public.achievement_events recorded
        where recorded.user_id = caller and recorded.kind = 'recipe_draft_saved'
      )
    ),
    'checkin_dates', coalesce((
      select jsonb_agg(snapshot.as_of_date order by snapshot.as_of_date)
      from public.expenditure_snapshots snapshot
      where snapshot.user_id = caller and snapshot.kind = 'checkin'
    ), '[]'::jsonb),
    'programmes', coalesce((
      select jsonb_agg(jsonb_build_object('started_on', program.started_on, 'ended_on', program.ended_on)
                       order by program.started_on)
      from public.programs program where program.user_id = caller
    ), '[]'::jsonb),
    'achievements', coalesce((
      select jsonb_agg(jsonb_build_object(
               'achievement_id', held.achievement_id,
               'unlocked_at', held.unlocked_at,
               'seen_at', held.seen_at,
               'backfilled', held.backfilled
             ) order by held.unlocked_at, held.achievement_id)
      from public.user_achievements held where held.user_id = caller
    ), '[]'::jsonb),
    'streak_freeze_events', coalesce((
      select jsonb_agg(jsonb_build_object(
               'kind', ledger_row.kind,
               'reason', ledger_row.reason,
               'ref', ledger_row.ref,
               'count', ledger_row.count,
               'local_date', ledger_row.local_date,
               'created_at', ledger_row.created_at
             ) order by ledger_row.created_at, ledger_row.id)
      from public.streak_freeze_events ledger_row where ledger_row.user_id = caller
    ), '[]'::jsonb)
  )
  into result;

  return result;
end;
$$;
