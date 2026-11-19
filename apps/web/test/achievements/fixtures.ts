import { runAchievements, trainingWeeksThroughOf, weighInWeeksOf } from "@keylow/core";
import { toLocalDate } from "@keylow/core/dates";

import type { AchievementState } from "@keylow/api-client";
import type { StoredAchievementStats } from "@keylow/core";

// Synthetic stats. One food has been logged and nothing else has happened.
const storedStatsWithOneEntry: StoredAchievementStats = {
  profileCreatedAt: "2026-01-10T09:00:00+00:00",
  setupCompletedAt: null,
  onboardingCompletedAt: null,
  targetsUpdatedAt: null,
  timeZone: "UTC",
  days: [],
  entries: {
    total: 1,
    distinctFoods: 1,
    newFoodsByWeek: [],
    mostLogsOfOneFavourite: 0,
    ownRecipeEntries: 0,
    mostDistinctDaysForOneRecipe: 0,
  },
  engineTargetsRows: [],
  manualTargets: { kcal: 2000, proteinG: 100, carbsG: 200, fatG: 70 },
  weighIns: { count: 0, distinctLocalDates: 0, beforeNineAmCount: 0 },
  bodyCompositionReadingCount: 0,
  workouts: {
    finishedSessions: 0,
    startedBeforeSevenAmCount: 0,
    startedAtOrAfterNinePmCount: 0,
    workingSets: 0,
    tonnageKg: 0,
    mostSetsInOneSession: 0,
    sessionsTrainingLegs: 0,
    distinctExercises: 0,
    weeks: [],
    sessionBests: [],
  },
  trainingGoals: [],
  activeRoutineDayCount: null,
  routineCount: 0,
  recipeCount: 0,
  favouriteCount: 0,
  mealPlans: { count: 0, longestPlanDays: 0, distinctPlannedDays: 0 },
  shoppingListItemCount: 0,
  assistant: { userMessages: 0, conversations: 0, logEntryActions: 0, createRecipeActions: 0 },
  featureRequestCount: 0,
  checkinLocalDates: [],
  programmes: [],
};

export const snapshotWithOneEntry = {
  stats: storedStatsWithOneEntry,
  weighInDates: [],
  ledger: [],
};

const NOW = new Date("2026-11-19T12:00:00.000Z");

/** What `useAchievementState` returns for a user who has logged one food and been recorded as holding First Bite. */
export function stateWithOneEntry(): AchievementState {
  const held = [
    {
      id: "first-bite",
      unlockedAt: "2026-11-06T12:00:00.000Z",
      seenAt: null,
      backfilled: false,
    },
  ];
  const today = toLocalDate(NOW, storedStatsWithOneEntry.timeZone);
  return {
    run: runAchievements({
      ...snapshotWithOneEntry,
      held: held.map(({ id }) => id),
      device: { reminderEnabled: false },
      now: NOW,
      isBackfill: false,
    }),
    held,
    today,
    weeks: {
      training: trainingWeeksThroughOf(storedStatsWithOneEntry, today),
      weighIn: weighInWeeksOf(snapshotWithOneEntry.weighInDates),
    },
  };
}
