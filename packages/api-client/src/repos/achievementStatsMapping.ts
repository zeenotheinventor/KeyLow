import { storedAchievementStatsSchema } from "@keylow/core";
import { toLocalDate } from "@keylow/core/dates";
import { MUSCLE_GROUPS } from "@keylow/core/training";
import { z } from "zod";

import { repoError } from "./repoError";

import type { FreezeRow, StoredAchievementStats } from "@keylow/core";

/*
 * `achievement_stats` (KEY-1084) answers one jsonb in snake_case, and `StoredAchievementStats` (KEY-1082)
 * is camelCase with other shapes in places. This is the one place the two meet. The payload is read with
 * the schema below, mapped field by field, and the result is checked once more with the core schema, so
 * a drift on either side fails here and never inside an evaluator. A failure names the action and the
 * code `invalid`, never a key or a value, because every number here is health data.
 */

const ACTION = "read the achievement stats";

const count = z.number();
const instant = z.string();
const nullableInstant = z.string().nullable();
const date = z.string();

const payloadSchema = z.object({
  profile_created_at: instant,
  onboarding_completed_at: nullableInstant,
  targets_updated_at: nullableInstant,
  time_zone: z.string(),
  manual_targets: z.object({
    kcal: count.nullable(),
    protein_g: count.nullable(),
    carbs_g: count.nullable(),
    fat_g: count.nullable(),
  }),
  targets: z.array(
    z.object({
      effective_from: date,
      calories_kcal: count,
      protein_g: count,
      carbs_g: count,
      fat_g: count,
      dow_calories_kcal: z
        .tuple([count, count, count, count, count, count, count])
        .nullable()
        .optional(),
    }),
  ),
  days: z.array(
    z.object({
      local_date: date,
      entry_count: count,
      kcal: count.nullable(),
      protein_g: count.nullable(),
      carbs_g: count.nullable(),
      fat_g: count.nullable(),
      fibre_g: count.nullable(),
      is_complete: z.boolean(),
      completed_at: nullableInstant,
      earliest_entry_local_time: z.string().nullable(),
      logged_between_midnight_and_four: z.boolean(),
    }),
  ),
  entry_totals: z.object({
    entries: count,
    distinct_foods: count,
    new_foods_per_week: z.array(z.object({ week_start: date, new_foods: count })),
    most_logs_of_favourite_food: count,
    own_recipe_entries: count,
    most_days_for_one_recipe: count,
  }),
  weigh_ins: z.object({
    count,
    dates: z.array(date),
    before_nine_count: count,
  }),
  body_measurement_count: count,
  workouts: z.object({
    sessions: count,
    before_seven_count: count,
    from_twenty_one_count: count,
    working_sets: count,
    tonnage_kg: count,
    most_sets_in_session: count,
    legs_sessions: count,
    distinct_exercises: count,
    weeks: z.array(
      z.object({
        week_start: date,
        sessions: count,
        muscle_groups: z.array(z.enum(MUSCLE_GROUPS)),
      }),
    ),
    session_best_sets: z.array(
      z.object({
        started_at: instant,
        sets: z.array(
          z.object({ exercise_id: z.string(), load_kg: count.nullable(), reps: count }),
        ),
      }),
    ),
  }),
  training_goals: z.array(
    z.object({
      days_per_week: count,
      effective_from: instant,
      effective_to: nullableInstant,
    }),
  ),
  active_routine_day_count: count.nullable(),
  routines: count,
  recipes: count,
  favourites: count,
  meal_plans: count,
  longest_meal_plan_days: count,
  distinct_planned_days: count,
  shopping_list_items: count,
  assistant_user_messages: count,
  assistant_conversations: count,
  assistant_log_entry_actions: count,
  assistant_create_recipe_actions: count,
  feature_requests: count,
  event_counts: z.object({
    distinct_barcodes_scanned: count,
    exercise_demos_watched: count,
    week_view_opens: count,
    data_exports: count,
    logs_from_favourites: count,
    shopping_items_ticked_off: count,
    assistant_drafts_saved: count,
  }),
  checkin_dates: z.array(date),
  programmes: z.array(z.object({ started_on: date, ended_on: date.nullable() })),
  achievements: z.array(
    z.object({
      achievement_id: z.string(),
      unlocked_at: instant,
      seen_at: nullableInstant,
      backfilled: z.boolean(),
    }),
  ),
  streak_freeze_events: z.array(
    z.object({
      kind: z.enum(["earned", "used"]),
      reason: z.string(),
      ref: z.string(),
      count,
      local_date: date,
    }),
  ),
});

type Payload = z.infer<typeof payloadSchema>;

/** An achievement the person holds, as the database keeps it. */
export type HeldAchievement = {
  id: string;
  unlockedAt: string;
  seenAt: string | null;
  backfilled: boolean;
};

/** What one read of the stats gives the engine, and the rows a screen shows beside it. */
export type AchievementSnapshot = {
  stats: StoredAchievementStats;
  /** The local date of each weigh-in. The stats only count them, and the weigh-in streak needs the weeks. */
  weighInDates: string[];
  held: HeldAchievement[];
  ledger: FreezeRow[];
};

/**
 * Postgres writes a timestamp with microseconds. A date parser is only promised milliseconds, so the
 * fraction is cut to three digits, which no evaluator can tell apart.
 */
const toMilliseconds = (instantText: string): string => instantText.replace(/(\.\d{3})\d+/, "$1");

const orNull = (instantText: string | null): string | null =>
  instantText === null ? null : toMilliseconds(instantText);

/** `HH:MM:SS` to the `HH:MM` the core schema reads. */
const toClockTime = (time: string): string => time.slice(0, 5);

const localDateOf = (instantText: string, zone: string): string =>
  toLocalDate(new Date(instantText), zone);

const mapStats = (payload: Payload): StoredAchievementStats => {
  const zone = payload.time_zone;
  return {
    profileCreatedAt: toMilliseconds(payload.profile_created_at),
    // There is no separate stamp for the setup finishing with its targets, so the onboarding one stands for it.
    setupCompletedAt: orNull(payload.onboarding_completed_at),
    onboardingCompletedAt: orNull(payload.onboarding_completed_at),
    targetsUpdatedAt: orNull(payload.targets_updated_at),
    timeZone: zone,
    days: payload.days.map((day) => ({
      localDate: day.local_date,
      entryCount: day.entry_count,
      kcal: day.kcal ?? 0,
      proteinG: day.protein_g ?? 0,
      carbsG: day.carbs_g ?? 0,
      fatG: day.fat_g ?? 0,
      fibreG: day.fibre_g ?? 0,
      isComplete: day.is_complete,
      completedAt: orNull(day.completed_at),
      earliestEntryCreatedTime:
        day.earliest_entry_local_time === null ? null : toClockTime(day.earliest_entry_local_time),
      hasEntryCreatedBetweenMidnightAndFour: day.logged_between_midnight_and_four,
    })),
    entries: {
      total: payload.entry_totals.entries,
      distinctFoods: payload.entry_totals.distinct_foods,
      newFoodsByWeek: payload.entry_totals.new_foods_per_week.map((week) => ({
        weekStart: week.week_start,
        count: week.new_foods,
      })),
      mostLogsOfOneFavourite: payload.entry_totals.most_logs_of_favourite_food,
      ownRecipeEntries: payload.entry_totals.own_recipe_entries,
      mostDistinctDaysForOneRecipe: payload.entry_totals.most_days_for_one_recipe,
    },
    engineTargetsRows: payload.targets.map((row) => ({
      effectiveFrom: row.effective_from,
      kcal: row.calories_kcal,
      proteinG: row.protein_g,
      carbsG: row.carbs_g,
      fatG: row.fat_g,
      ...(row.dow_calories_kcal ? { dowCaloriesKcal: row.dow_calories_kcal } : {}),
    })),
    manualTargets: {
      kcal: payload.manual_targets.kcal,
      proteinG: payload.manual_targets.protein_g,
      carbsG: payload.manual_targets.carbs_g,
      fatG: payload.manual_targets.fat_g,
    },
    weighIns: {
      count: payload.weigh_ins.count,
      distinctLocalDates: payload.weigh_ins.dates.length,
      beforeNineAmCount: payload.weigh_ins.before_nine_count,
    },
    bodyCompositionReadingCount: payload.body_measurement_count,
    workouts: {
      finishedSessions: payload.workouts.sessions,
      startedBeforeSevenAmCount: payload.workouts.before_seven_count,
      startedAtOrAfterNinePmCount: payload.workouts.from_twenty_one_count,
      workingSets: payload.workouts.working_sets,
      tonnageKg: payload.workouts.tonnage_kg,
      mostSetsInOneSession: payload.workouts.most_sets_in_session,
      sessionsTrainingLegs: payload.workouts.legs_sessions,
      distinctExercises: payload.workouts.distinct_exercises,
      weeks: payload.workouts.weeks.map((week) => ({
        weekStart: week.week_start,
        sessionCount: week.sessions,
        primaryMuscleGroups: week.muscle_groups,
      })),
      sessionBests: payload.workouts.session_best_sets.map((session) => ({
        startedAt: toMilliseconds(session.started_at),
        exercises: session.sets.map((set) => ({
          exerciseId: set.exercise_id,
          loadKg: set.load_kg,
          reps: set.reps,
        })),
      })),
    },
    trainingGoals: payload.training_goals.map((goal) => ({
      daysPerWeek: goal.days_per_week,
      effectiveFrom: localDateOf(goal.effective_from, zone),
      effectiveTo: goal.effective_to === null ? null : localDateOf(goal.effective_to, zone),
    })),
    activeRoutineDayCount: payload.active_routine_day_count,
    routineCount: payload.routines,
    recipeCount: payload.recipes,
    favouriteCount: payload.favourites,
    mealPlans: {
      count: payload.meal_plans,
      longestPlanDays: payload.longest_meal_plan_days,
      distinctPlannedDays: payload.distinct_planned_days,
    },
    shoppingListItemCount: payload.shopping_list_items,
    assistant: {
      userMessages: payload.assistant_user_messages,
      conversations: payload.assistant_conversations,
      logEntryActions: payload.assistant_log_entry_actions,
      // A draft saved through the recipe editor writes no assistant action, so its event is added: either
      // path unlocks Sous Chef.
      createRecipeActions:
        payload.assistant_create_recipe_actions + payload.event_counts.assistant_drafts_saved,
    },
    featureRequestCount: payload.feature_requests,
    eventCounters: {
      distinctBarcodesScanned: payload.event_counts.distinct_barcodes_scanned,
      exerciseDemosWatched: payload.event_counts.exercise_demos_watched,
      shoppingItemsTickedOff: payload.event_counts.shopping_items_ticked_off,
      dataExports: payload.event_counts.data_exports,
      logsFromFavourites: payload.event_counts.logs_from_favourites,
      weekViewOpens: payload.event_counts.week_view_opens,
    },
    checkinLocalDates: payload.checkin_dates,
    programmes: payload.programmes.map((programme) => ({
      startedOn: programme.started_on,
      endedOn: programme.ended_on,
    })),
  };
};

/**
 * The one mapping from the `achievement_stats` jsonb to the engine's input: the stats the core schema
 * defines, the weigh-in dates, the achievements held and the freeze ledger. Throws an error carrying the
 * action and the code `invalid` when the payload is not the shape or the result breaks the core schema.
 */
export const mapAchievementStats = (payload: unknown): AchievementSnapshot => {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw repoError(ACTION, { code: "invalid" });
  }
  const checked = storedAchievementStatsSchema.safeParse(mapStats(parsed.data));
  if (!checked.success) {
    throw repoError(ACTION, { code: "invalid" });
  }

  return {
    stats: checked.data,
    weighInDates: parsed.data.weigh_ins.dates,
    held: parsed.data.achievements.map((row) => ({
      id: row.achievement_id,
      unlockedAt: row.unlocked_at,
      seenAt: row.seen_at,
      backfilled: row.backfilled,
    })),
    ledger: parsed.data.streak_freeze_events.map((row) => ({
      kind: row.kind,
      reason: row.reason,
      reference: row.ref,
      date: row.local_date,
      count: row.count,
    })),
  };
};
