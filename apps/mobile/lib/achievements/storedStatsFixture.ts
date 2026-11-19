import type { AchievementSnapshot } from "@keylow/api-client";
import type { StoredAchievementStats } from "@keylow/core";

// Synthetic stats for the tests of the sync. One food has been logged and nothing else has happened.
export const storedStatsWithOneEntry: StoredAchievementStats = {
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

export const snapshotHolding = (held: AchievementSnapshot["held"] = []): AchievementSnapshot => ({
  stats: storedStatsWithOneEntry,
  weighInDates: [],
  held,
  ledger: [],
});
