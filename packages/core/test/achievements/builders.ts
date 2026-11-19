import { addCalendarDays } from "../../src/dates/calendarDay";

import type { AchievementStats, DayStats, StreakInput } from "../../src/achievements";

// Everything here is synthetic. 2026-11-19 is a Thursday.
export const NOW = new Date("2026-11-19T12:00:00Z");

export const MANUAL_TARGETS = { kcal: 2000, proteinG: 100, carbsG: 200, fatG: 70 };

export const aStats = (overrides: Partial<AchievementStats> = {}): AchievementStats => ({
  profileCreatedAt: "2026-01-10T09:00:00+00:00",
  setupCompletedAt: null,
  onboardingCompletedAt: null,
  targetsUpdatedAt: null,
  timeZone: "UTC",
  days: [],
  entries: {
    total: 0,
    distinctFoods: 0,
    newFoodsByWeek: [],
    mostLogsOfOneFavourite: 0,
    ownRecipeEntries: 0,
    mostDistinctDaysForOneRecipe: 0,
  },
  engineTargetsRows: [],
  manualTargets: MANUAL_TARGETS,
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
  reminderEnabled: false,
  ...overrides,
});

export const aDay = (localDate: string, overrides: Partial<DayStats> = {}): DayStats => ({
  localDate,
  entryCount: 1,
  kcal: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fibreG: 0,
  isComplete: true,
  completedAt: `${localDate}T21:00:00+00:00`,
  earliestEntryCreatedTime: "12:00",
  hasEntryCreatedBetweenMidnightAndFour: false,
  ...overrides,
});

/** `count` consecutive days from 2026-01-01, each built by `build`. */
export const consecutiveDays = (
  count: number,
  build: (localDate: string) => DayStats = aDay,
): DayStats[] =>
  Array.from({ length: count }, (_, index) => build(addCalendarDays("2026-01-01", index)));

export const NO_STREAKS: StreakInput = {
  daily: { current: 0, longest: 0 },
  training: { current: 0, longest: 0 },
  weighIn: { current: 0, longest: 0 },
  freezesHeld: 0,
  freezesUsed: 0,
  backOnTrack: false,
  weekendRun: 0,
};

export const aStreakRun = (longest: number) => ({ current: longest, longest });
