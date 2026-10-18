import { z } from "zod";

import { characterCount } from "../recipes/characterCount";
import {
  MAX_DAYS_PER_ROUTINE,
  MAX_DAYS_PER_WEEK,
  MAX_EXERCISE_NAME_LENGTH,
  MAX_EXERCISES_PER_ROUTINE_DAY,
  MAX_LOAD_KG,
  MAX_MUSCLE_WEIGHT,
  MAX_MUSCLES_PER_EXERCISE,
  MAX_REPS,
  MAX_RIR,
  MAX_ROUTINE_DAY_NAME_LENGTH,
  MAX_ROUTINE_NAME_LENGTH,
  MAX_RPE,
  MAX_SESSION_MINUTES,
  MAX_SESSION_NOTE_LENGTH,
  MAX_SESSION_TIME_ZONE_LENGTH,
  MAX_SETS_PER_SESSION,
  MAX_TARGET_REPS,
  MAX_TARGET_SETS,
  MAX_WEEKDAY,
  MIN_DAYS_PER_WEEK,
  MIN_REPS,
  MIN_RIR,
  MIN_RPE,
  MIN_SESSION_MINUTES,
  MIN_TARGET_REPS,
  MIN_TARGET_SETS,
  MIN_WEEKDAY,
  RPE_STEP,
} from "../training/bounds";
import {
  EQUIPMENT,
  EXERCISE_MECHANICS,
  EXERCISE_SOURCES,
  EXPERIENCE_LEVELS,
  MUSCLE_ROLES,
  SET_TYPES,
  TRAINING_FOCUSES,
  TRAINING_GOALS,
} from "../training/enums";
import {
  MUSCLE_GROUPS,
  MUSCLE_IDS,
  MUSCLE_LIST_VERSION,
  MUSCLE_SIZE_CLASSES,
} from "../training/muscles";
import { SET_SNAPSHOT_VERSION } from "../training/versions";

/*
 * The training rows of ADR 0005, Amendment 1, as PostgREST returns them, with every check the
 * migrations (KEY-347, KEY-348) put on them. Clients parse a row before they write it, so a write that
 * breaks a bound never reaches the database. Messages state the rule and never quote a value, because
 * training logs are health data.
 */

// z.guid() rather than z.uuid(), as for foods: seed and fixture ids need not be RFC 4122 variants.
const rowIdSchema = z.guid();
const timestampSchema = z.iso.datetime({ offset: true });

export const muscleIdSchema = z.enum(MUSCLE_IDS);
export const muscleGroupSchema = z.enum(MUSCLE_GROUPS);
export const muscleSizeClassSchema = z.enum(MUSCLE_SIZE_CLASSES);
export const equipmentSchema = z.enum(EQUIPMENT);
export const exerciseSourceSchema = z.enum(EXERCISE_SOURCES);
export const exerciseMechanicSchema = z.enum(EXERCISE_MECHANICS);
export const muscleRoleSchema = z.enum(MUSCLE_ROLES);
export const setTypeSchema = z.enum(SET_TYPES);
export const trainingGoalSchema = z.enum(TRAINING_GOALS);
export const experienceLevelSchema = z.enum(EXPERIENCE_LEVELS);
export const trainingFocusSchema = z.enum(TRAINING_FOCUSES);

/** Text that is not blank and has at most `maximumLength` characters, counted as code points. */
const nonBlankTextOfAtMost = (maximumLength: number) =>
  z
    .string()
    .refine((text) => text.trim() !== "", { message: "Text must not be blank" })
    .refine((text) => characterCount(text) <= maximumLength, {
      message: `Text must be at most ${maximumLength} characters`,
    });

const integerBetween = (minimum: number, maximum: number) =>
  z.number().int().min(minimum).max(maximum);

const positionSchema = z.number().int().nonnegative();

const weekdaySchema = integerBetween(MIN_WEEKDAY, MAX_WEEKDAY);

/** An exercise's share of a set on one muscle: above 0, because a muscle with no share is not listed. */
const muscleWeightSchema = z.number().positive().max(MAX_MUSCLE_WEIGHT);

const muscleEntryShape = {
  muscle_id: muscleIdSchema,
  role: muscleRoleSchema,
  weight: muscleWeightSchema,
};

type MuscleEntryLike = { muscle_id: string; role: string };

/**
 * The rules every muscle map follows, whether it is about to be saved or frozen in a snapshot: at least
 * one primary muscle (the `exercise_has_primary_muscle` trigger), one entry per muscle at most (the
 * `unique (exercise_id, muscle_id)` index), and so never more entries than the list has muscles.
 */
const muscleMapOf = <Entry extends MuscleEntryLike>(entry: z.ZodType<Entry>) =>
  z
    .array(entry)
    .max(MAX_MUSCLES_PER_EXERCISE, {
      message: `An exercise has at most ${MAX_MUSCLES_PER_EXERCISE} muscles`,
    })
    .refine((muscles) => muscles.some((muscle) => muscle.role === "primary"), {
      message: "An exercise needs at least one primary muscle",
    })
    .refine(
      (muscles) => new Set(muscles.map((muscle) => muscle.muscle_id)).size === muscles.length,
      { message: "An exercise lists each muscle at most once" },
    );

/** An `exercises` row. User rows have an owner and no source ref; imported rows the reverse. */
export const exerciseRowSchema = z
  .object({
    id: rowIdSchema,
    owner_id: rowIdSchema.nullable(),
    source: exerciseSourceSchema,
    source_ref: z.string().nullable(),
    name: nonBlankTextOfAtMost(MAX_EXERCISE_NAME_LENGTH),
    equipment: equipmentSchema,
    mechanic: exerciseMechanicSchema,
    deleted_at: timestampSchema.nullable(),
    created_at: timestampSchema,
  })
  .refine((exercise) => (exercise.source === "user") === (exercise.owner_id !== null), {
    message: "An exercise has an owner exactly when its source is user",
    path: ["owner_id"],
  })
  .refine((exercise) => (exercise.source === "user") === (exercise.source_ref === null), {
    message: "An exercise has a source ref exactly when its source is not user",
    path: ["source_ref"],
  });

/** An `exercise_muscles` row: one muscle's role and share in one exercise. */
export const exerciseMuscleRowSchema = z.object({
  id: rowIdSchema,
  exercise_id: rowIdSchema,
  owner_id: rowIdSchema.nullable(),
  ...muscleEntryShape,
  created_at: timestampSchema,
});

/** One muscle of a map as it is written, without the columns the save fills in. */
export const exerciseMuscleEntrySchema = z.object(muscleEntryShape);

/** A whole muscle map, as `save_exercise` replaces it. */
export const exerciseMusclesSchema = muscleMapOf(exerciseMuscleEntrySchema);

/** A `workout_sessions` row. `local_date` is the user's calendar day of `started_at`. */
export const workoutSessionRowSchema = z
  .object({
    id: rowIdSchema,
    user_id: rowIdSchema,
    started_at: timestampSchema,
    /** Null while the session is in progress. */
    ended_at: timestampSchema.nullable(),
    local_date: z.iso.date(),
    tz: nonBlankTextOfAtMost(MAX_SESSION_TIME_ZONE_LENGTH),
    routine_day_id: rowIdSchema.nullable(),
    note: z
      .string()
      .refine((note) => characterCount(note) <= MAX_SESSION_NOTE_LENGTH, {
        message: `A note must be at most ${MAX_SESSION_NOTE_LENGTH} characters`,
      })
      .nullable(),
    deleted_at: timestampSchema.nullable(),
    created_at: timestampSchema,
  })
  .refine(
    (session) =>
      session.ended_at === null || Date.parse(session.ended_at) >= Date.parse(session.started_at),
    { message: "A session cannot end before it starts", path: ["ended_at"] },
  );

/** One muscle of a snapshot's frozen map. */
export const setSnapshotMuscleSchema = z.strictObject(muscleEntryShape);

/**
 * What an exercise looked like when a set was logged (ADR 0005, Amendment 1, "The set snapshot"), so
 * editing the exercise's muscles never rewrites past heat. `ref` is the exercise's id, and
 * `muscleListVersion` is the muscle list the map was written against.
 *
 * When SET_SNAPSHOT_VERSION or MUSCLE_LIST_VERSION moves to 2, this must become a union of the known
 * versions with an upgrade step, so that stored v1 snapshots still parse.
 */
export const setSnapshotSchema = z.strictObject({
  version: z.literal(SET_SNAPSHOT_VERSION),
  kind: z.literal("exercise"),
  ref: rowIdSchema,
  name: z.string(),
  equipment: equipmentSchema,
  mechanic: exerciseMechanicSchema,
  muscleListVersion: z.literal(MUSCLE_LIST_VERSION),
  muscles: muscleMapOf(setSnapshotMuscleSchema),
});

const rpeSchema = z
  .number()
  .min(MIN_RPE)
  .max(MAX_RPE)
  .refine((rpe) => Number.isInteger(rpe / RPE_STEP), {
    message: `RPE must be in steps of ${RPE_STEP}`,
  });

/** A `workout_sets` row. Its snapshot is taken from the exercise it names and is never rewritten. */
export const workoutSetRowSchema = z
  .object({
    id: rowIdSchema,
    session_id: rowIdSchema,
    user_id: rowIdSchema,
    exercise_id: rowIdSchema,
    position: positionSchema,
    set_type: setTypeSchema,
    reps: integerBetween(MIN_REPS, MAX_REPS),
    /** Null for an unloaded bodyweight set. */
    load_kg: z.number().nonnegative().max(MAX_LOAD_KG).nullable(),
    rir: integerBetween(MIN_RIR, MAX_RIR).nullable(),
    rpe: rpeSchema.nullable(),
    performed_at: timestampSchema,
    snapshot: setSnapshotSchema,
    deleted_at: timestampSchema.nullable(),
    created_at: timestampSchema,
  })
  .refine((set) => set.rir === null || set.rpe === null, {
    message: "A set has at most one of RIR and RPE",
    path: ["rpe"],
  })
  .refine((set) => set.snapshot.ref === set.exercise_id, {
    message: "A set's snapshot must be taken from the set's exercise",
    path: ["snapshot", "ref"],
  });

/** The sets of one session. Only live sets count towards the limit, so a deleted set frees a place. */
export const workoutSessionSetsSchema = z
  .array(workoutSetRowSchema)
  .refine((sets) => sets.filter((set) => set.deleted_at === null).length <= MAX_SETS_PER_SESSION, {
    message: `A session holds at most ${MAX_SETS_PER_SESSION} sets`,
  });

/** A `routines` row. Routines are archived, never deleted, and an archived routine is not active. */
export const routineRowSchema = z
  .object({
    id: rowIdSchema,
    user_id: rowIdSchema,
    name: nonBlankTextOfAtMost(MAX_ROUTINE_NAME_LENGTH),
    is_active: z.boolean(),
    is_archived: z.boolean(),
    created_at: timestampSchema,
  })
  .refine((routine) => !(routine.is_active && routine.is_archived), {
    message: "An archived routine cannot be active",
    path: ["is_active"],
  });

/** A `routine_days` row. A null weekday means any day. */
export const routineDayRowSchema = z.object({
  id: rowIdSchema,
  routine_id: rowIdSchema,
  user_id: rowIdSchema,
  position: positionSchema,
  weekday: weekdaySchema.nullable(),
  name: nonBlankTextOfAtMost(MAX_ROUTINE_DAY_NAME_LENGTH),
  created_at: timestampSchema,
});

const hasNoRepeats = (values: readonly unknown[]): boolean =>
  new Set(values).size === values.length;

/** The days of one routine: at most seven, no two in the same position or on the same weekday. */
export const routineDaysSchema = z
  .array(routineDayRowSchema)
  .max(MAX_DAYS_PER_ROUTINE, { message: `A routine has at most ${MAX_DAYS_PER_ROUTINE} days` })
  .refine((days) => hasNoRepeats(days.map((day) => day.position)), {
    message: "Two days of a routine cannot share a position",
  })
  .refine(
    (days) => hasNoRepeats(days.flatMap((day) => (day.weekday === null ? [] : [day.weekday]))),
    { message: "A routine has at most one day per weekday" },
  );

/** A `routine_exercises` row: the plan for one exercise on one routine day. */
export const routineExerciseRowSchema = z
  .object({
    id: rowIdSchema,
    routine_day_id: rowIdSchema,
    user_id: rowIdSchema,
    position: positionSchema,
    exercise_id: rowIdSchema,
    target_sets: integerBetween(MIN_TARGET_SETS, MAX_TARGET_SETS),
    rep_min: integerBetween(MIN_TARGET_REPS, MAX_TARGET_REPS),
    rep_max: integerBetween(MIN_TARGET_REPS, MAX_TARGET_REPS),
    target_rir: integerBetween(MIN_RIR, MAX_RIR).nullable(),
    created_at: timestampSchema,
  })
  .refine((exercise) => exercise.rep_min <= exercise.rep_max, {
    message: "The lowest rep target cannot be above the highest",
    path: ["rep_max"],
  });

/** The exercises of one routine day: at most thirty, no two in the same position. */
export const routineDayExercisesSchema = z
  .array(routineExerciseRowSchema)
  .max(MAX_EXERCISES_PER_ROUTINE_DAY, {
    message: `A routine day has at most ${MAX_EXERCISES_PER_ROUTINE_DAY} exercises`,
  })
  .refine((exercises) => hasNoRepeats(exercises.map((exercise) => exercise.position)), {
    message: "Two exercises of a routine day cannot share a position",
  });

/**
 * A `training_goals` row. `muscle_priority` maps muscle ids to a priority number, derived in core from
 * the answers with the `TrainingParams` version in `params_version`. Null `effective_to` means current.
 */
export const trainingGoalsRowSchema = z
  .object({
    id: rowIdSchema,
    user_id: rowIdSchema,
    goal: trainingGoalSchema,
    focus: z.array(trainingFocusSchema).refine(hasNoRepeats, {
      message: "A focus can be chosen at most once",
    }),
    days_per_week: integerBetween(MIN_DAYS_PER_WEEK, MAX_DAYS_PER_WEEK),
    session_minutes: integerBetween(MIN_SESSION_MINUTES, MAX_SESSION_MINUTES),
    equipment: z.array(equipmentSchema),
    experience: experienceLevelSchema,
    muscle_priority: z.partialRecord(muscleIdSchema, z.number()),
    params_version: z.string().min(1),
    effective_from: timestampSchema,
    effective_to: timestampSchema.nullable(),
    created_at: timestampSchema,
  })
  .refine(
    (goals) =>
      goals.effective_to === null ||
      Date.parse(goals.effective_to) > Date.parse(goals.effective_from),
    { message: "A goal must end after it starts", path: ["effective_to"] },
  );

export type ExerciseRow = z.infer<typeof exerciseRowSchema>;
export type ExerciseMuscleRow = z.infer<typeof exerciseMuscleRowSchema>;
export type ExerciseMuscleEntry = z.infer<typeof exerciseMuscleEntrySchema>;
export type WorkoutSessionRow = z.infer<typeof workoutSessionRowSchema>;
export type WorkoutSetRow = z.infer<typeof workoutSetRowSchema>;
export type SetSnapshot = z.infer<typeof setSnapshotSchema>;
export type SetSnapshotMuscle = z.infer<typeof setSnapshotMuscleSchema>;
export type RoutineRow = z.infer<typeof routineRowSchema>;
export type RoutineDayRow = z.infer<typeof routineDayRowSchema>;
export type RoutineExerciseRow = z.infer<typeof routineExerciseRowSchema>;
export type TrainingGoalsRow = z.infer<typeof trainingGoalsRowSchema>;
