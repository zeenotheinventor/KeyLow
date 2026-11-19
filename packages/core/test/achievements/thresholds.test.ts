import { describe, expect, it } from "vitest";

import { NOW, NO_STREAKS, aDay, aStats, aStreakRun, consecutiveDays } from "./builders";
import { ACHIEVEMENTS, evaluateAchievements } from "../../src/achievements";
import { addCalendarDays } from "../../src/dates/calendarDay";

import type { AchievementStats, StreakInput } from "../../src/achievements";
import type { MeasureKey } from "../../src/achievements/rules";

type Scenario = { stats: AchievementStats; streaks?: StreakInput; now?: Date };

type ThresholdCase = {
  /** The thresholds of the spec for this rule, written out as literals. */
  targets: readonly number[];
  /** A scenario in which the rule measures exactly `value`. */
  build: (value: number) => Scenario;
};

const workouts = (overrides: Partial<AchievementStats["workouts"]>) => ({
  ...aStats().workouts,
  ...overrides,
});
const counters = (overrides: NonNullable<AchievementStats["eventCounters"]>) => ({
  eventCounters: overrides,
});
const streaks = (overrides: Partial<StreakInput>): StreakInput => ({ ...NO_STREAKS, ...overrides });

const TARGET_DAY = { kcal: 2000, proteinG: 100, carbsG: 200, fatG: 70 };
const onTargetDay = (localDate: string) => aDay(localDate, { ...TARGET_DAY });

const MAIN_GROUPS = ["chest", "shoulders", "back", "arms", "core", "legs"] as const;
const recordSessions = (records: number) =>
  Array.from({ length: records + 1 }, (_, index) => ({
    startedAt: `2026-03-${String(index + 1).padStart(2, "0")}T10:00:00+00:00`,
    exercises: [{ exerciseId: "bench", loadKg: 50 + index, reps: 5 }],
  }));

const CASES: Record<MeasureKey, ThresholdCase> = {
  "entries-logged": {
    targets: [1, 10, 50, 100, 250, 500, 1000, 2500, 5000],
    build: (value) => ({ stats: aStats({ entries: { ...aStats().entries, total: value } }) }),
  },
  "setup-completed": {
    targets: [1],
    build: (value) => ({
      stats: aStats({ setupCompletedAt: value > 0 ? "2026-01-10T10:00:00+00:00" : null }),
    }),
  },
  "weigh-ins": {
    targets: [1, 10, 50, 100],
    build: (value) => ({
      stats: aStats({ weighIns: { count: value, distinctLocalDates: 0, beforeNineAmCount: 0 } }),
    }),
  },
  "weigh-in-days": {
    targets: [365],
    build: (value) => ({
      stats: aStats({ weighIns: { count: 0, distinctLocalDates: value, beforeNineAmCount: 0 } }),
    }),
  },
  "barcodes-scanned": {
    targets: [1, 10, 50, 100],
    build: (value) => ({ stats: aStats(counters({ distinctBarcodesScanned: value })) }),
  },
  "recipes-saved": {
    targets: [1, 5, 10, 25],
    build: (value) => ({ stats: aStats({ recipeCount: value }) }),
  },
  "favourites-saved": {
    targets: [1],
    build: (value) => ({ stats: aStats({ favouriteCount: value }) }),
  },
  "workouts-finished": {
    targets: [1, 5, 10, 25, 50, 100, 250, 500],
    build: (value) => ({ stats: aStats({ workouts: workouts({ finishedSessions: value }) }) }),
  },
  "planned-days": {
    targets: [1, 28],
    build: (value) => ({
      stats: aStats({ mealPlans: { count: 1, longestPlanDays: 0, distinctPlannedDays: value } }),
    }),
  },
  "assistant-questions": {
    targets: [1],
    build: (value) => ({
      stats: aStats({ assistant: { ...aStats().assistant, userMessages: value } }),
    }),
  },
  "reminder-enabled": {
    targets: [1],
    build: (value) => ({ stats: aStats({ reminderEnabled: value > 0 }) }),
  },
  "body-composition-readings": {
    targets: [1, 10, 50],
    build: (value) => ({ stats: aStats({ bodyCompositionReadingCount: value }) }),
  },
  "days-completed": {
    targets: [1],
    build: (value) => ({ stats: aStats({ days: consecutiveDays(value) }) }),
  },
  "days-logged": {
    targets: [30, 100, 365],
    build: (value) => ({ stats: aStats({ days: consecutiveDays(value) }) }),
  },
  "daily-streak": {
    targets: [3, 7, 14, 21, 30, 60, 90, 180, 365, 500],
    build: (value) => ({
      stats: aStats(),
      streaks: streaks({ daily: aStreakRun(value) }),
    }),
  },
  "back-on-track": {
    targets: [1],
    build: (value) => ({ stats: aStats(), streaks: streaks({ backOnTrack: value > 0 }) }),
  },
  "freezes-used": {
    targets: [1],
    build: (value) => ({ stats: aStats(), streaks: streaks({ freezesUsed: value }) }),
  },
  "weekend-run": {
    targets: [4],
    build: (value) => ({ stats: aStats(), streaks: streaks({ weekendRun: value }) }),
  },
  "freezes-held": {
    targets: [10],
    build: (value) => ({ stats: aStats(), streaks: streaks({ freezesHeld: value }) }),
  },
  "protein-days": {
    targets: [1, 7, 30, 100],
    build: (value) => ({ stats: aStats({ days: consecutiveDays(value, onTargetDay) }) }),
  },
  "calorie-days": {
    targets: [1, 7, 30, 100],
    build: (value) => ({ stats: aStats({ days: consecutiveDays(value, onTargetDay) }) }),
  },
  "balanced-days": {
    targets: [1],
    build: (value) => ({ stats: aStats({ days: consecutiveDays(value, onTargetDay) }) }),
  },
  "perfect-week-run": {
    targets: [7],
    build: (value) => ({ stats: aStats({ days: consecutiveDays(value, onTargetDay) }) }),
  },
  "fibre-days": {
    targets: [7],
    build: (value) => ({
      stats: aStats({ days: consecutiveDays(value, (date) => aDay(date, { fibreG: 25 })) }),
    }),
  },
  "morning-log-days": {
    targets: [30],
    build: (value) => ({
      stats: aStats({
        days: consecutiveDays(value, (date) => aDay(date, { earliestEntryCreatedTime: "09:59" })),
      }),
    }),
  },
  "distinct-foods": {
    targets: [25, 50, 100, 250],
    build: (value) => ({
      stats: aStats({ entries: { ...aStats().entries, distinctFoods: value } }),
    }),
  },
  "new-foods-in-a-week": {
    targets: [10],
    build: (value) => ({
      stats: aStats({
        entries: {
          ...aStats().entries,
          newFoodsByWeek: [{ weekStart: "2026-11-09", count: value }],
        },
      }),
    }),
  },
  "favourite-repeats": {
    targets: [30],
    build: (value) => ({
      stats: aStats({ entries: { ...aStats().entries, mostLogsOfOneFavourite: value } }),
    }),
  },
  "own-recipe-entries": {
    targets: [10, 50],
    build: (value) => ({
      stats: aStats({ entries: { ...aStats().entries, ownRecipeEntries: value } }),
    }),
  },
  "recipe-days": {
    targets: [3],
    build: (value) => ({
      stats: aStats({ entries: { ...aStats().entries, mostDistinctDaysForOneRecipe: value } }),
    }),
  },
  "longest-plan-days": {
    targets: [7],
    build: (value) => ({
      stats: aStats({ mealPlans: { count: 1, longestPlanDays: value, distinctPlannedDays: 0 } }),
    }),
  },
  "shopping-list-items": {
    targets: [1],
    build: (value) => ({ stats: aStats({ shoppingListItemCount: value }) }),
  },
  "shopping-items-ticked": {
    targets: [50],
    build: (value) => ({ stats: aStats(counters({ shoppingItemsTickedOff: value })) }),
  },
  "routines-created": {
    targets: [1],
    build: (value) => ({ stats: aStats({ routineCount: value }) }),
  },
  "working-sets": {
    targets: [100, 1000, 10000],
    build: (value) => ({ stats: aStats({ workouts: workouts({ workingSets: value }) }) }),
  },
  "tonnage-kg": {
    targets: [10000, 100000, 1000000],
    build: (value) => ({ stats: aStats({ workouts: workouts({ tonnageKg: value }) }) }),
  },
  "most-sets-in-session": {
    targets: [25],
    build: (value) => ({ stats: aStats({ workouts: workouts({ mostSetsInOneSession: value }) }) }),
  },
  "training-streak": {
    targets: [2, 4, 8, 12, 26, 52],
    build: (value) => ({ stats: aStats(), streaks: streaks({ training: aStreakRun(value) }) }),
  },
  "early-workouts": {
    targets: [10],
    build: (value) => ({
      stats: aStats({ workouts: workouts({ startedBeforeSevenAmCount: value }) }),
    }),
  },
  "late-workouts": {
    targets: [10],
    build: (value) => ({
      stats: aStats({ workouts: workouts({ startedAtOrAfterNinePmCount: value }) }),
    }),
  },
  "personal-records": {
    targets: [1, 10, 50, 100],
    build: (value) => ({
      stats: aStats({ workouts: workouts({ sessionBests: recordSessions(value) }) }),
    }),
  },
  "full-body-week": {
    targets: [6],
    build: (value) => ({
      stats: aStats({
        workouts: workouts({
          weeks: [
            {
              weekStart: "2026-11-09",
              sessionCount: 3,
              primaryMuscleGroups: MAIN_GROUPS.slice(0, value),
            },
          ],
        }),
      }),
    }),
  },
  "leg-sessions": {
    targets: [25],
    build: (value) => ({ stats: aStats({ workouts: workouts({ sessionsTrainingLegs: value }) }) }),
  },
  "distinct-exercises": {
    targets: [50],
    build: (value) => ({ stats: aStats({ workouts: workouts({ distinctExercises: value }) }) }),
  },
  "exercise-demos-watched": {
    targets: [1],
    build: (value) => ({ stats: aStats(counters({ exerciseDemosWatched: value })) }),
  },
  "weigh-in-streak": {
    targets: [4, 12, 52],
    build: (value) => ({ stats: aStats(), streaks: streaks({ weighIn: aStreakRun(value) }) }),
  },
  "early-weigh-ins": {
    targets: [30],
    build: (value) => ({
      stats: aStats({ weighIns: { count: 0, distinctLocalDates: 0, beforeNineAmCount: value } }),
    }),
  },
  "programme-weeks": {
    targets: [4],
    build: (value) => ({
      stats: aStats({
        programmes: [
          { startedOn: "2026-09-01", endedOn: addCalendarDays("2026-09-01", value * 7) },
        ],
      }),
    }),
  },
  "check-ins": {
    targets: [1, 4, 12],
    build: (value) => ({
      stats: aStats({
        checkinLocalDates: Array.from({ length: value }, (_, index) =>
          addCalendarDays("2026-02-01", index * 7),
        ),
      }),
    }),
  },
  "check-ins-on-one-programme": {
    targets: [12],
    build: (value) => ({
      stats: aStats({
        programmes: [{ startedOn: "2026-02-01", endedOn: null }],
        checkinLocalDates: Array.from({ length: value }, (_, index) =>
          addCalendarDays("2026-02-01", index * 7),
        ),
      }),
    }),
  },
  "targets-edited": {
    targets: [1],
    build: (value) => ({
      stats: aStats({
        onboardingCompletedAt: "2026-01-10T10:00:00+00:00",
        targetsUpdatedAt: value > 0 ? "2026-02-01T10:00:00+00:00" : "2026-01-10T10:00:00+00:00",
      }),
    }),
  },
  "assistant-conversations": {
    targets: [10],
    build: (value) => ({
      stats: aStats({ assistant: { ...aStats().assistant, conversations: value } }),
    }),
  },
  "assistant-logged-meals": {
    targets: [1],
    build: (value) => ({
      stats: aStats({ assistant: { ...aStats().assistant, logEntryActions: value } }),
    }),
  },
  "assistant-saved-recipes": {
    targets: [1],
    build: (value) => ({
      stats: aStats({ assistant: { ...aStats().assistant, createRecipeActions: value } }),
    }),
  },
  "data-exports": {
    targets: [1],
    build: (value) => ({ stats: aStats(counters({ dataExports: value })) }),
  },
  "feature-requests": {
    targets: [1],
    build: (value) => ({ stats: aStats({ featureRequestCount: value }) }),
  },
  "favourite-logs": {
    targets: [25],
    build: (value) => ({ stats: aStats(counters({ logsFromFavourites: value })) }),
  },
  "week-view-opens": {
    targets: [10],
    build: (value) => ({ stats: aStats(counters({ weekViewOpens: value })) }),
  },
  "logged-on-new-year": {
    targets: [1],
    build: (value) => ({ stats: aStats({ days: value > 0 ? [aDay("2026-01-01")] : [] }) }),
  },
  "logged-on-christmas": {
    targets: [1],
    build: (value) => ({ stats: aStats({ days: value > 0 ? [aDay("2025-12-25")] : [] }) }),
  },
  "logged-on-halloween": {
    targets: [1],
    build: (value) => ({ stats: aStats({ days: value > 0 ? [aDay("2025-10-31")] : [] }) }),
  },
  "logged-on-leap-day": {
    targets: [1],
    build: (value) => ({ stats: aStats({ days: value > 0 ? [aDay("2028-02-29")] : [] }) }),
  },
  "midnight-log": {
    targets: [1],
    build: (value) => ({
      stats: aStats({
        days: [aDay("2026-03-03", { hasEntryCreatedBetweenMidnightAndFour: value > 0 })],
      }),
    }),
  },
  anniversary: {
    targets: [365],
    build: (value) => ({
      stats: aStats({ profileCreatedAt: "2025-01-10T09:00:00+00:00" }),
      now: new Date(`${addCalendarDays("2025-01-10", value)}T12:00:00Z`),
    }),
  },
};

const evaluateOne = (scenario: Scenario, rule: string, target: number) => {
  const { stats, streaks: scenarioStreaks = NO_STREAKS, now = NOW } = scenario;
  const entry = ACHIEVEMENTS.find(
    (candidate) => candidate.rule === rule && candidate.target === target,
  );
  const result = evaluateAchievements(stats, scenarioStreaks, now).find(
    (candidate) => candidate.id === entry?.id,
  );
  return { entry, result };
};

describe("every rule at, below and above its threshold", () => {
  it("covers exactly the rule and threshold pairs of the catalogue", () => {
    const covered = Object.entries(CASES).flatMap(([rule, { targets }]) =>
      targets.map((target) => `${rule}:${target}`),
    );
    const catalogued = ACHIEVEMENTS.filter((entry) => entry.rule !== "achievements-earned").map(
      (entry) => `${entry.rule}:${entry.target}`,
    );
    expect(covered.sort()).toEqual(catalogued.sort());
  });

  for (const [rule, { targets, build }] of Object.entries(CASES)) {
    describe(rule, () => {
      it.each(targets)("target %i is locked just below, with its progress", (target) => {
        const { entry, result } = evaluateOne(build(target - 1), rule, target);
        expect(entry).toBeDefined();
        expect(result).toEqual({
          id: entry?.id,
          earned: false,
          progress: { current: target - 1, target },
        });
      });

      it.each(targets)("target %i is earned exactly at it", (target) => {
        const { entry, result } = evaluateOne(build(target), rule, target);
        expect(result).toEqual({ id: entry?.id, earned: true });
      });

      it.each(targets)("target %i is earned above it", (target) => {
        const { entry, result } = evaluateOne(build(target + 1), rule, target);
        expect(result).toEqual({ id: entry?.id, earned: true });
      });
    });
  }
});
