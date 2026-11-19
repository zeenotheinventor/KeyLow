import { z } from "zod";

import { MUSCLE_GROUPS } from "../training/muscles";

/*
 * The stats snapshot the achievement evaluators read (KEY-1082). `storedAchievementStatsSchema` is the
 * contract the database's stats RPC (KEY-1084) returns, with these camelCase names. `deviceInputsSchema`
 * is what only the phone knows, passed in beside it. Counts are whole numbers of zero or more.
 *
 * Health data stays out by design: there is no field for a body weight value or a weight goal. Weigh-ins
 * are counted, never read.
 */

const count = z.number().int().min(0);
const amount = z.number().min(0);
/** A calendar day in the user's time zone, `YYYY-MM-DD`. */
const localDate = z.iso.date();
const instant = z.iso.datetime({ offset: true });
/** A clock time in the user's time zone, `HH:MM` on a 24-hour clock. */
const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const dayStatsSchema = z.object({
  localDate,
  entryCount: count,
  kcal: amount,
  proteinG: amount,
  carbsG: amount,
  fatG: amount,
  fibreG: amount,
  isComplete: z.boolean(),
  completedAt: instant.nullable(),
  /** The earliest time of day an entry of this day was created, or null for a day with no entries. */
  earliestEntryCreatedTime: clockTime.nullable(),
  /** Whether an entry of this day was created from 00:00 up to 04:00. */
  hasEntryCreatedBetweenMidnightAndFour: z.boolean(),
});

/** An engine targets row: the targets in force from `effectiveFrom` until the next row's date. */
const targetsRowSchema = z.object({
  effectiveFrom: localDate,
  kcal: amount,
  proteinG: amount,
  carbsG: amount,
  fatG: amount,
});

/** The targets on the profile itself. A target the person never set is null. */
const manualTargetsSchema = z.object({
  kcal: amount.nullable(),
  proteinG: amount.nullable(),
  carbsG: amount.nullable(),
  fatG: amount.nullable(),
});

const weekOfTrainingSchema = z.object({
  /** The Monday that starts the week. */
  weekStart: localDate,
  sessionCount: count,
  /** The muscle groups trained as a primary muscle in that week's finished sessions. */
  primaryMuscleGroups: z.array(z.enum(MUSCLE_GROUPS)),
});

/** One finished session and the best counted set it holds for each exercise (warm-ups excluded). */
const sessionBestsSchema = z.object({
  startedAt: instant,
  exercises: z.array(
    z.object({
      exerciseId: z.string().min(1),
      loadKg: amount.nullable(),
      reps: count,
    }),
  ),
});

const trainingGoalSchema = z.object({
  daysPerWeek: count,
  effectiveFrom: localDate,
  effectiveTo: localDate.nullable(),
});

const programmeSchema = z.object({
  startedOn: localDate,
  endedOn: localDate.nullable(),
});

export const storedAchievementStatsSchema = z.object({
  profileCreatedAt: instant,
  /** When the setup was finished with its targets, or null while it is not. */
  setupCompletedAt: instant.nullable(),
  /** `profiles.onboarding_completed_at`. */
  onboardingCompletedAt: instant.nullable(),
  /** `profiles.targets_updated_at`: the last time the person edited their targets. */
  targetsUpdatedAt: instant.nullable(),
  timeZone: z.string().min(1),

  /** One item per local day with an entry or a day-complete mark. */
  days: z.array(dayStatsSchema),
  entries: z.object({
    total: count,
    distinctFoods: count,
    /** For each Monday week, how many foods were logged for the first time in it. */
    newFoodsByWeek: z.array(z.object({ weekStart: localDate, count })),
    /** The most times one food that is a favourite now has been logged. */
    mostLogsOfOneFavourite: count,
    ownRecipeEntries: count,
    /** The most distinct days one recipe has been logged on. */
    mostDistinctDaysForOneRecipe: count,
  }),

  engineTargetsRows: z.array(targetsRowSchema),
  manualTargets: manualTargetsSchema.nullable(),

  weighIns: z.object({
    count,
    distinctLocalDates: count,
    beforeNineAmCount: count,
  }),
  bodyCompositionReadingCount: count,

  workouts: z.object({
    finishedSessions: count,
    startedBeforeSevenAmCount: count,
    startedAtOrAfterNinePmCount: count,
    workingSets: count,
    tonnageKg: amount,
    mostSetsInOneSession: count,
    sessionsTrainingLegs: count,
    distinctExercises: count,
    weeks: z.array(weekOfTrainingSchema),
    sessionBests: z.array(sessionBestsSchema),
  }),
  trainingGoals: z.array(trainingGoalSchema),
  activeRoutineDayCount: count.nullable(),

  routineCount: count,
  recipeCount: count,
  favouriteCount: count,
  mealPlans: z.object({
    count,
    longestPlanDays: count,
    distinctPlannedDays: count,
  }),
  shoppingListItemCount: count,

  assistant: z.object({
    userMessages: count,
    conversations: count,
    /** `log_entry` actions that were not undone. */
    logEntryActions: count,
    /** `create_recipe` actions that were not undone. */
    createRecipeActions: count,
  }),
  featureRequestCount: count,
  /** The local date of each `expenditure_snapshots` row with `kind = 'checkin'`. */
  checkinLocalDates: z.array(localDate),
  programmes: z.array(programmeSchema),
});

/** Counters of events the database does not record. Each is absent until the follow-up that tracks it. */
export const eventCountersSchema = z.object({
  distinctBarcodesScanned: count.optional(),
  exerciseDemosWatched: count.optional(),
  shoppingItemsTickedOff: count.optional(),
  dataExports: count.optional(),
  logsFromFavourites: count.optional(),
  weekViewOpens: count.optional(),
});

/** What only the phone knows, passed in beside the stored stats. */
export const deviceInputsSchema = z.object({
  reminderEnabled: z.boolean(),
  eventCounters: eventCountersSchema.optional(),
});

export const achievementStatsSchema = storedAchievementStatsSchema.extend(deviceInputsSchema.shape);

export type StoredAchievementStats = z.infer<typeof storedAchievementStatsSchema>;
export type EventCounters = z.infer<typeof eventCountersSchema>;
export type DeviceInputs = z.infer<typeof deviceInputsSchema>;
export type AchievementStats = z.infer<typeof achievementStatsSchema>;
export type DayStats = z.infer<typeof dayStatsSchema>;
