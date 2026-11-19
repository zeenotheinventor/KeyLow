import { describe, expect, it } from "vitest";

import { mapAchievementStats } from "../../src/repos/achievementStatsMapping";

/*
 * A literal of what `achievement_stats` returns, key for key as the migration builds it with
 * `jsonb_build_object`: snake_case, `numeric` as numbers, `timestamptz` with microseconds and an offset,
 * `date` as `YYYY-MM-DD`, a time as `HH:MM:SS`, and a null where a sum had nothing to add up.
 * Every value is synthetic.
 */
const PAYLOAD = {
  profile_created_at: "2026-01-10T09:00:00.123456+00:00",
  onboarding_completed_at: "2026-01-10T09:30:00.5+00:00",
  targets_updated_at: "2026-02-01T10:00:00+00:00",
  time_zone: "Europe/London",
  manual_targets: { kcal: 2100, protein_g: 120, carbs_g: null, fat_g: 70 },
  targets: [
    {
      effective_from: "2026-01-10",
      effective_to: "2026-02-01",
      calories_kcal: 2000,
      protein_g: 110,
      carbs_g: 220,
      fat_g: 65,
      dow_calories_kcal: [2000, 2000, 2000, 2000, 2000, 2000, 2000],
    },
    {
      effective_from: "2026-02-01",
      effective_to: null,
      calories_kcal: 2200,
      protein_g: 130,
      carbs_g: 240,
      fat_g: 70,
      dow_calories_kcal: [2200, 2200, 2200, 2200, 2200, 2200, 2200],
    },
  ],
  days: [
    {
      local_date: "2026-11-17",
      entry_count: 3,
      kcal: 2050.5,
      protein_g: 101,
      carbs_g: 210,
      fat_g: 60,
      fibre_g: 26,
      is_complete: true,
      completed_at: "2026-11-17T20:15:30.654321+00:00",
      earliest_entry_local_time: "07:45:10",
      logged_between_midnight_and_four: false,
    },
    {
      local_date: "2026-11-18",
      entry_count: 0,
      kcal: null,
      protein_g: null,
      carbs_g: null,
      fat_g: null,
      fibre_g: null,
      is_complete: true,
      completed_at: "2026-11-18T22:00:00+00:00",
      earliest_entry_local_time: null,
      logged_between_midnight_and_four: false,
    },
    {
      local_date: "2026-11-19",
      entry_count: 1,
      kcal: 300,
      protein_g: 5,
      carbs_g: 40,
      fat_g: 8,
      fibre_g: 2,
      is_complete: false,
      completed_at: null,
      earliest_entry_local_time: "02:05:00",
      logged_between_midnight_and_four: true,
    },
  ],
  entry_totals: {
    entries: 412,
    distinct_foods: 60,
    new_foods_per_week: [{ week_start: "2026-11-16", new_foods: 7 }],
    most_logs_of_favourite_food: 12,
    own_recipe_entries: 9,
    most_days_for_one_recipe: 4,
  },
  weigh_ins: {
    count: 5,
    dates: ["2026-11-02", "2026-11-09", "2026-11-17"],
    before_nine_count: 2,
  },
  body_measurement_count: 6,
  workouts: {
    sessions: 20,
    before_seven_count: 3,
    from_twenty_one_count: 1,
    working_sets: 300,
    tonnage_kg: 15432.5,
    most_sets_in_session: 18,
    legs_sessions: 6,
    distinct_exercises: 24,
    weeks: [
      { week_start: "2026-11-09", sessions: 3, muscle_groups: ["chest", "legs"] },
      { week_start: "2026-11-16", sessions: 2, muscle_groups: [] },
    ],
    session_best_sets: [
      {
        started_at: "2026-11-17T18:00:00.111111+00:00",
        local_date: "2026-11-17",
        sets: [
          { exercise_id: "squat", load_kg: 100, reps: 5 },
          { exercise_id: "pull-up", load_kg: null, reps: 8 },
        ],
      },
    ],
  },
  training_goals: [
    {
      days_per_week: 3,
      effective_from: "2026-01-10T09:30:00.25+00:00",
      effective_to: "2026-09-01T23:30:00.5+00:00",
    },
    { days_per_week: 4, effective_from: "2026-09-01T23:30:00.5+00:00", effective_to: null },
  ],
  active_routine_day_count: 4,
  routines: 2,
  recipes: 8,
  favourites: 5,
  meal_plans: 3,
  longest_meal_plan_days: 7,
  distinct_planned_days: 12,
  shopping_list_items: 30,
  assistant_user_messages: 14,
  assistant_conversations: 4,
  assistant_log_entry_actions: 6,
  assistant_create_recipe_actions: 1,
  feature_requests: 1,
  checkin_dates: ["2026-03-01", "2026-03-08"],
  programmes: [{ started_on: "2026-01-10", ended_on: null }],
  achievements: [
    {
      achievement_id: "first-bite",
      unlocked_at: "2026-01-10T10:00:00.5+00:00",
      seen_at: null,
      backfilled: false,
    },
  ],
  streak_freeze_events: [
    {
      kind: "earned",
      reason: "level_reached",
      ref: "level-1",
      count: 1,
      local_date: "2026-03-01",
      created_at: "2026-03-01T10:00:00.5+00:00",
    },
    {
      kind: "used",
      reason: "missed_day",
      ref: "2026-03-05",
      count: 1,
      local_date: "2026-03-05",
      created_at: "2026-03-06T10:00:00+00:00",
    },
  ],
};

describe("mapAchievementStats", () => {
  // Mapped inside each test, so a break in the mapping fails the tests it touches by name.
  const mapPayload = () => mapAchievementStats(PAYLOAD);

  it("should map the profile fields, taking setup completed from the onboarding stamp", () => {
    expect(mapPayload().stats.profileCreatedAt).toBe("2026-01-10T09:00:00.123+00:00");
    expect(mapPayload().stats.onboardingCompletedAt).toBe("2026-01-10T09:30:00.5+00:00");
    expect(mapPayload().stats.setupCompletedAt).toBe("2026-01-10T09:30:00.5+00:00");
    expect(mapPayload().stats.targetsUpdatedAt).toBe("2026-02-01T10:00:00+00:00");
    expect(mapPayload().stats.timeZone).toBe("Europe/London");
  });

  it("should leave setup completed null while onboarding is not completed", () => {
    const mapped = mapAchievementStats({ ...PAYLOAD, onboarding_completed_at: null });

    expect(mapped.stats.setupCompletedAt).toBeNull();
    expect(mapped.stats.onboardingCompletedAt).toBeNull();
  });

  it("should map the manual targets, keeping a target never set as null", () => {
    expect(mapPayload().stats.manualTargets).toEqual({
      kcal: 2100,
      proteinG: 120,
      carbsG: null,
      fatG: 70,
    });
  });

  it("should map the targets rows and drop the end date and the weekday calories", () => {
    expect(mapPayload().stats.engineTargetsRows).toEqual([
      { effectiveFrom: "2026-01-10", kcal: 2000, proteinG: 110, carbsG: 220, fatG: 65 },
      { effectiveFrom: "2026-02-01", kcal: 2200, proteinG: 130, carbsG: 240, fatG: 70 },
    ]);
  });

  it("should map each day, with a missing sum as zero and the time as HH:MM", () => {
    expect(mapPayload().stats.days).toEqual([
      {
        localDate: "2026-11-17",
        entryCount: 3,
        kcal: 2050.5,
        proteinG: 101,
        carbsG: 210,
        fatG: 60,
        fibreG: 26,
        isComplete: true,
        completedAt: "2026-11-17T20:15:30.654+00:00",
        earliestEntryCreatedTime: "07:45",
        hasEntryCreatedBetweenMidnightAndFour: false,
      },
      {
        localDate: "2026-11-18",
        entryCount: 0,
        kcal: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        fibreG: 0,
        isComplete: true,
        completedAt: "2026-11-18T22:00:00+00:00",
        earliestEntryCreatedTime: null,
        hasEntryCreatedBetweenMidnightAndFour: false,
      },
      {
        localDate: "2026-11-19",
        entryCount: 1,
        kcal: 300,
        proteinG: 5,
        carbsG: 40,
        fatG: 8,
        fibreG: 2,
        isComplete: false,
        completedAt: null,
        earliestEntryCreatedTime: "02:05",
        hasEntryCreatedBetweenMidnightAndFour: true,
      },
    ]);
  });

  it("should map the entry totals", () => {
    expect(mapPayload().stats.entries).toEqual({
      total: 412,
      distinctFoods: 60,
      newFoodsByWeek: [{ weekStart: "2026-11-16", count: 7 }],
      mostLogsOfOneFavourite: 12,
      ownRecipeEntries: 9,
      mostDistinctDaysForOneRecipe: 4,
    });
  });

  it("should count the weigh-in dates and keep the list beside the stats", () => {
    expect(mapPayload().stats.weighIns).toEqual({
      count: 5,
      distinctLocalDates: 3,
      beforeNineAmCount: 2,
    });
    expect(mapPayload().weighInDates).toEqual(["2026-11-02", "2026-11-09", "2026-11-17"]);
  });

  it("should map the body composition readings and the workouts", () => {
    expect(mapPayload().stats.bodyCompositionReadingCount).toBe(6);
    expect(mapPayload().stats.workouts).toEqual({
      finishedSessions: 20,
      startedBeforeSevenAmCount: 3,
      startedAtOrAfterNinePmCount: 1,
      workingSets: 300,
      tonnageKg: 15432.5,
      mostSetsInOneSession: 18,
      sessionsTrainingLegs: 6,
      distinctExercises: 24,
      weeks: [
        { weekStart: "2026-11-09", sessionCount: 3, primaryMuscleGroups: ["chest", "legs"] },
        { weekStart: "2026-11-16", sessionCount: 2, primaryMuscleGroups: [] },
      ],
      sessionBests: [
        {
          startedAt: "2026-11-17T18:00:00.111+00:00",
          exercises: [
            { exerciseId: "squat", loadKg: 100, reps: 5 },
            { exerciseId: "pull-up", loadKg: null, reps: 8 },
          ],
        },
      ],
    });
  });

  it("should turn a training goal's instants into local dates in the profile's zone", () => {
    // 23:30 UTC on 1 September is already 2 September in London, which is on summer time.
    expect(mapPayload().stats.trainingGoals).toEqual([
      { daysPerWeek: 3, effectiveFrom: "2026-01-10", effectiveTo: "2026-09-02" },
      { daysPerWeek: 4, effectiveFrom: "2026-09-02", effectiveTo: null },
    ]);
    expect(mapPayload().stats.activeRoutineDayCount).toBe(4);
  });

  it("should map the counts of the rest of the app", () => {
    expect(mapPayload().stats.routineCount).toBe(2);
    expect(mapPayload().stats.recipeCount).toBe(8);
    expect(mapPayload().stats.favouriteCount).toBe(5);
    expect(mapPayload().stats.mealPlans).toEqual({
      count: 3,
      longestPlanDays: 7,
      distinctPlannedDays: 12,
    });
    expect(mapPayload().stats.shoppingListItemCount).toBe(30);
    expect(mapPayload().stats.assistant).toEqual({
      userMessages: 14,
      conversations: 4,
      logEntryActions: 6,
      createRecipeActions: 1,
    });
    expect(mapPayload().stats.featureRequestCount).toBe(1);
    expect(mapPayload().stats.checkinLocalDates).toEqual(["2026-03-01", "2026-03-08"]);
    expect(mapPayload().stats.programmes).toEqual([{ startedOn: "2026-01-10", endedOn: null }]);
  });

  it("should keep the held achievements with their seen state", () => {
    expect(mapPayload().held).toEqual([
      {
        id: "first-bite",
        unlockedAt: "2026-01-10T10:00:00.5+00:00",
        seenAt: null,
        backfilled: false,
      },
    ]);
  });

  it("should map the freeze ledger, calling the ref a reference and the local date a date", () => {
    expect(mapPayload().ledger).toEqual([
      {
        kind: "earned",
        reason: "level_reached",
        reference: "level-1",
        date: "2026-03-01",
        count: 1,
      },
      { kind: "used", reason: "missed_day", reference: "2026-03-05", date: "2026-03-05", count: 1 },
    ]);
  });

  it("should refuse a payload that is not the shape, naming the action and a code only", () => {
    const failure = (() => {
      try {
        return mapAchievementStats({ ...PAYLOAD, time_zone: 42, secret_note: "private" });
      } catch (error) {
        return error;
      }
    })();

    expect(failure).toHaveProperty("message", "Could not read the achievement stats (invalid)");
    expect(failure).toHaveProperty("cause", { code: "invalid" });
  });
});
