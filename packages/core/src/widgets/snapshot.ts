import { z } from "zod";

import { EXERCISE_NAMES_LIMIT, RECENT_FOODS_LIMIT, WIDGET_SNAPSHOT_VERSION } from "./constants";
import { addCalendarDays, daysSinceMonday, isCalendarDay } from "../dates/calendarDay";
import { isValidTimeZone } from "../dates/isValidTimeZone";
import { recipeEntryUnitSchema } from "../diary/schemas";
import { quantityUnitSchema } from "../nutrition/units";
import { SET_TYPES } from "../training/enums";
import { MUSCLE_IDS } from "../training/muscles";

/*
 * The snapshot the app writes for the widgets to read (ADR 0007, "The snapshot contract, in core"). It is
 * plain data and holds no token, session, user id or email. It holds the least the widgets need: the
 * inputs of the pure functions they call, not their results, so a widget redrawn later in the day still
 * agrees with the app.
 */

/** The fewest characters a nonce has, so a guess is not worth trying. */
export const NONCE_MINIMUM_LENGTH = 16;

const instantSchema = z.iso.datetime({ offset: true });
const calendarDaySchema = z.string().refine(isCalendarDay, { message: "Not a calendar day" });
const rowIdSchema = z.guid();
const muscleIdSchema = z.enum(MUSCLE_IDS);
const nonNegativeSchema = z.number().nonnegative();

const dayTotalsSchema = z.strictObject({
  kcal: nonNegativeSchema,
  proteinG: nonNegativeSchema,
  carbsG: nonNegativeSchema,
  fatG: nonNegativeSchema,
});

/** What a day added up to. */
export type WidgetDayTotals = z.infer<typeof dayTotalsSchema>;

const weekDaySchema = z.strictObject({
  localDate: calendarDaySchema,
  /** Whether the person marked the day complete. */
  isComplete: z.boolean(),
  /** Null when nothing is logged that day. */
  totals: dayTotalsSchema.nullable(),
});

const targetsSchema = z.strictObject({
  /** The week's calories, which a weekday without its own figure falls back to. */
  caloriesKcal: z.number().positive(),
  /** The calories for each weekday, Monday first, as `dayTarget` reads them. Absent for a manual target. */
  weekdayCaloriesKcal: z
    .tuple([
      z.number().positive(),
      z.number().positive(),
      z.number().positive(),
      z.number().positive(),
      z.number().positive(),
      z.number().positive(),
      z.number().positive(),
    ])
    .optional(),
  proteinG: z.number().positive().nullable(),
  carbsG: z.number().positive().nullable(),
  fatG: z.number().positive().nullable(),
});

/** The set fields `muscleState` reads, and nothing else of the set. */
const heatSetSchema = z.strictObject({
  performedAt: instantSchema,
  setType: z.enum(SET_TYPES),
  rir: z.number().int().nullable(),
  rpe: z.number().nullable(),
  muscles: z.array(z.strictObject({ muscleId: muscleIdSchema, weight: z.number().positive() })),
});

const nextSetSchema = z.strictObject({
  exerciseId: rowIdSchema,
  exerciseName: z.string().min(1),
  /** Its place among the session's exercises, from 1. */
  exerciseNumber: z.number().int().positive(),
  exerciseCount: z.number().int().positive(),
  /** Its place among the exercise's sets, from 1. */
  setNumber: z.number().int().positive(),
  setCount: z.number().int().positive(),
  /** The prefilled load in kilograms, null for a bodyweight set. */
  loadKg: z.number().nonnegative().nullable(),
  reps: z.number().int().positive().nullable(),
  lastTime: z
    .strictObject({
      loadKg: z.number().nonnegative().nullable(),
      reps: z.number().int().positive(),
    })
    .nullable(),
});

const sessionSchema = z.strictObject({
  id: rowIdSchema,
  startedAt: instantSchema,
  /** Null for a session that follows no routine day. */
  dayName: z.string().min(1).nullable(),
  /** Null when no set is left to prefill, as in a session with no plan. */
  next: nextSetSchema.nullable(),
});

const planSchema = z.strictObject({
  dayName: z.string().min(1),
  exerciseCount: z.number().int().positive(),
  setCount: z.number().int().positive(),
  /** The first names only, so the widget can say "and 2 more". */
  exerciseNames: z.array(z.string().min(1)).max(EXERCISE_NAMES_LIMIT),
});

const recentFoodSchema = z.strictObject({
  /** The entry Log again repeats. */
  entryId: rowIdSchema,
  name: z.string().min(1),
  kcal: nonNegativeSchema,
  /** The amount the entry repeats. */
  amount: z.strictObject({
    quantity: nonNegativeSchema,
    unit: z.union([quantityUnitSchema, recipeEntryUnitSchema]),
  }),
});

const isWeekFromMonday = (week: readonly { localDate: string }[], today: string): boolean => {
  const monday = week[0]?.localDate;
  return (
    monday !== undefined &&
    daysSinceMonday(monday) === 0 &&
    week.every((day, position) => day.localDate === addCalendarDays(monday, position)) &&
    week.some((day) => day.localDate === today)
  );
};

export const widgetSnapshotSchema = z
  .strictObject({
    version: z.literal(WIDGET_SNAPSHOT_VERSION),
    /** A random value the app checks a link against before the link writes anything (ADR 0007, "Deep links and the nonce rule"). */
    nonce: z.string().min(NONCE_MINIMUM_LENGTH),
    builtAt: instantSchema,
    timeZone: z.string().refine(isValidTimeZone, { message: "Not a time zone" }),
    weightUnit: z.enum(["kg", "lb"]),
    /** The local day the snapshot is for, `YYYY-MM-DD`. */
    today: calendarDaySchema,
    /** Null when no target is set. */
    targets: targetsSchema.nullable(),
    /** The seven days of the week that holds today, Monday to Sunday. Today's totals are the eaten figure. */
    week: z.array(weekDaySchema).length(7),
    training: z.strictObject({
      /** Today's planned day. Null on a rest day and when there is no programme. */
      plan: planSchema.nullable(),
      session: sessionSchema.nullable(),
    }),
    bodyMap: z.strictObject({
      /** The scale chosen in More. */
      scale: z.enum(["heat", "volume"]),
      figure: z.enum(["male", "female"]),
      /** This week's volume status of every muscle, as its index in `VOLUME_STATUSES`. */
      volumeValues: z.record(muscleIdSchema, z.number().int().min(0).max(4)),
      /** The live sets of the heat window, minimised to what `muscleState` reads. */
      heatSets: z.array(heatSetSchema),
    }),
    recentFoods: z.array(recentFoodSchema).max(RECENT_FOODS_LIMIT),
    /** Null when the person has never weighed in. */
    lastWeighIn: z
      .strictObject({ weightKg: z.number().positive(), localDate: calendarDaySchema })
      .nullable(),
  })
  .refine((snapshot) => isWeekFromMonday(snapshot.week, snapshot.today), {
    message: "The week must run Monday to Sunday and hold today",
    path: ["week"],
  });

export type WidgetSnapshot = z.infer<typeof widgetSnapshotSchema>;

/** The record the handler keeps beside the snapshot after a one-tap write (ADR 0007, "One-tap actions"). */
export const pendingUndoSchema = z.strictObject({
  action: z.enum(["log_again", "log_set"]),
  /** The id of the row the action wrote, which Undo removes. */
  rowId: rowIdSchema,
  /** For Log again, the recent food entry the tap repeated, so its row is the one that turns into "Logged". */
  sourceEntryId: rowIdSchema.optional(),
  /** When the row was written, which starts the Undo window. */
  at: instantSchema,
});

export type PendingUndo = z.infer<typeof pendingUndoSchema>;
