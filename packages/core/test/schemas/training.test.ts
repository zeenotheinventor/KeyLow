import { describe, expect, it } from "vitest";

import {
  exerciseMuscleEntrySchema,
  exerciseMuscleRowSchema,
  exerciseMusclesSchema,
  exerciseRowSchema,
  routineDayExercisesSchema,
  routineDayRowSchema,
  routineDaysSchema,
  routineExerciseRowSchema,
  routineRowSchema,
  setSnapshotSchema,
  trainingGoalsRowSchema,
  workoutSessionRowSchema,
  workoutSessionSetsSchema,
  workoutSetRowSchema,
} from "../../src/schemas";
import { MUSCLE_IDS } from "../../src/training";

import type {
  ExerciseMuscleEntry,
  ExerciseMuscleRow,
  ExerciseRow,
  RoutineDayRow,
  RoutineExerciseRow,
  RoutineRow,
  SetSnapshot,
  TrainingGoalsRow,
  WorkoutSessionRow,
  WorkoutSetRow,
} from "../../src/schemas";
import type { z } from "zod";

/*
 * ADR 0005, Amendment 1: each schema accepts a valid row, and each bound it lists is broken once, on its
 * own, so a test fails for that rule alone.
 */

const USER_ID = "00000000-0000-4000-8000-0000000000a1";
const EXERCISE_ID = "6f1c2b9e-0000-4000-8000-000000000001";
const SESSION_ID = "00000000-0000-4000-8000-0000000000c1";
const ROUTINE_ID = "00000000-0000-4000-8000-0000000000d1";
const ROUTINE_DAY_ID = "00000000-0000-4000-8000-0000000000d2";
const CREATED_AT = "2026-10-18T08:00:00+00:00";

const messagesOf = (schema: z.ZodType, value: unknown): string[] => {
  const result = schema.safeParse(value);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

const expectAccepted = (schema: z.ZodType, value: unknown): void => {
  expect(messagesOf(schema, value)).toEqual([]);
};

const expectRejected = (schema: z.ZodType, value: unknown, message?: string): void => {
  const messages = messagesOf(schema, value);
  expect(messages).not.toEqual([]);
  if (message !== undefined) {
    expect(messages).toContain(message);
  }
};

const importedExercise = (overrides: Partial<ExerciseRow> = {}): ExerciseRow => ({
  id: EXERCISE_ID,
  owner_id: null,
  source: "free_exercise_db",
  source_ref: "Side_Lateral_Raise",
  name: "Dumbbell lateral raise",
  equipment: "dumbbell",
  mechanic: "isolation",
  deleted_at: null,
  created_at: CREATED_AT,
  ...overrides,
});

const userExercise = (overrides: Partial<ExerciseRow> = {}): ExerciseRow =>
  importedExercise({ owner_id: USER_ID, source: "user", source_ref: null, ...overrides });

describe("exerciseRowSchema", () => {
  it("should accept an imported exercise", () => {
    expectAccepted(exerciseRowSchema, importedExercise());
  });

  it("should accept a user's own exercise", () => {
    expectAccepted(exerciseRowSchema, userExercise());
  });

  it("should accept a name of 200 characters counted as code points", () => {
    expectAccepted(exerciseRowSchema, importedExercise({ name: "💪".repeat(200) }));
  });

  it.each<[string, Partial<ExerciseRow>, string?]>([
    ["a blank name", { name: "   " }, "Text must not be blank"],
    [
      "a name over 200 characters",
      { name: "a".repeat(201) },
      "Text must be at most 200 characters",
    ],
    ["an unknown equipment", { equipment: "rings" as ExerciseRow["equipment"] }],
    ["an unknown mechanic", { mechanic: "hybrid" as ExerciseRow["mechanic"] }],
    ["an unknown source", { source: "wger" as ExerciseRow["source"] }],
    [
      "an imported exercise with an owner",
      { owner_id: USER_ID },
      "An exercise has an owner exactly when its source is user",
    ],
    [
      "an imported exercise without a source ref",
      { source_ref: null },
      "An exercise has a source ref exactly when its source is not user",
    ],
    ["an id that is not a uuid", { id: "exercise-1" }],
  ])("should reject %s", (_case, overrides, message) => {
    expectRejected(exerciseRowSchema, importedExercise(overrides), message);
  });

  it("should reject a user exercise without an owner", () => {
    expectRejected(
      exerciseRowSchema,
      userExercise({ owner_id: null }),
      "An exercise has an owner exactly when its source is user",
    );
  });

  it("should reject a user exercise with a source ref", () => {
    expectRejected(
      exerciseRowSchema,
      userExercise({ source_ref: "Side_Lateral_Raise" }),
      "An exercise has a source ref exactly when its source is not user",
    );
  });

  it("should state the rule without quoting the value", () => {
    const name = "Secret name ".repeat(20);

    for (const message of messagesOf(exerciseRowSchema, importedExercise({ name }))) {
      expect(message).not.toContain("Secret");
    }
  });
});

const muscleRow = (overrides: Partial<ExerciseMuscleRow> = {}): ExerciseMuscleRow => ({
  id: "00000000-0000-4000-8000-0000000000e1",
  exercise_id: EXERCISE_ID,
  owner_id: null,
  muscle_id: "delt_side",
  role: "primary",
  weight: 1,
  created_at: CREATED_AT,
  ...overrides,
});

describe("exerciseMuscleRowSchema", () => {
  it("should accept a valid row", () => {
    expectAccepted(exerciseMuscleRowSchema, muscleRow());
  });

  it("should accept a small share", () => {
    expectAccepted(exerciseMuscleRowSchema, muscleRow({ weight: 0.05 }));
  });

  it.each<[string, Partial<ExerciseMuscleRow>]>([
    ["a weight of 0", { weight: 0 }],
    ["a negative weight", { weight: -0.5 }],
    ["a weight above 1", { weight: 1.01 }],
    ["an unknown muscle", { muscle_id: "delts" as ExerciseMuscleRow["muscle_id"] }],
    ["an unknown role", { role: "synergist" as ExerciseMuscleRow["role"] }],
  ])("should reject %s", (_case, overrides) => {
    expectRejected(exerciseMuscleRowSchema, muscleRow(overrides));
  });
});

const entry = (
  muscle_id: ExerciseMuscleEntry["muscle_id"],
  role: ExerciseMuscleEntry["role"] = "secondary",
  weight = 0.5,
): ExerciseMuscleEntry => ({ muscle_id, role, weight });

describe("exerciseMusclesSchema", () => {
  it("should accept the bench press map of ADR 0005", () => {
    expectAccepted(exerciseMusclesSchema, [
      entry("chest_lower", "primary", 1),
      entry("chest_upper", "secondary", 0.6),
      entry("delt_front", "secondary", 0.5),
      entry("triceps", "secondary", 0.5),
    ]);
  });

  it("should accept every muscle once", () => {
    expectAccepted(
      exerciseMusclesSchema,
      MUSCLE_IDS.map((id, index) => entry(id, index === 0 ? "primary" : "stabiliser")),
    );
  });

  it("should reject an empty map", () => {
    expectRejected(exerciseMusclesSchema, [], "An exercise needs at least one primary muscle");
  });

  it("should reject a map without a primary muscle", () => {
    expectRejected(
      exerciseMusclesSchema,
      [entry("delt_side", "secondary"), entry("traps_upper", "stabiliser")],
      "An exercise needs at least one primary muscle",
    );
  });

  it("should reject a muscle listed twice", () => {
    expectRejected(
      exerciseMusclesSchema,
      [entry("delt_side", "primary", 1), entry("delt_side", "secondary", 0.3)],
      "An exercise lists each muscle at most once",
    );
  });

  it("should reject more than 22 muscles", () => {
    expectRejected(
      exerciseMusclesSchema,
      [...MUSCLE_IDS.map((id) => entry(id, "primary")), entry("neck")],
      "An exercise has at most 22 muscles",
    );
  });

  it("should reject an entry that breaks its own bounds", () => {
    expectRejected(exerciseMusclesSchema, [entry("delt_side", "primary", 0)]);
    expectRejected(exerciseMuscleEntrySchema, entry("delt_side", "primary", 1.5));
  });
});

const session = (overrides: Partial<WorkoutSessionRow> = {}): WorkoutSessionRow => ({
  id: SESSION_ID,
  user_id: USER_ID,
  started_at: "2026-10-18T09:00:00+01:00",
  ended_at: "2026-10-18T10:05:00+01:00",
  local_date: "2026-10-18",
  tz: "Europe/London",
  routine_day_id: null,
  note: null,
  deleted_at: null,
  created_at: CREATED_AT,
  ...overrides,
});

describe("workoutSessionRowSchema", () => {
  it("should accept a finished session", () => {
    expectAccepted(workoutSessionRowSchema, session());
  });

  it("should accept a session in progress from a routine day, with a note", () => {
    expectAccepted(
      workoutSessionRowSchema,
      session({ ended_at: null, routine_day_id: ROUTINE_DAY_ID, note: "n".repeat(1000) }),
    );
  });

  it("should accept a session that ends the moment it starts", () => {
    expectAccepted(workoutSessionRowSchema, session({ ended_at: "2026-10-18T08:00:00Z" }));
  });

  it.each<[string, Partial<WorkoutSessionRow>, string?]>([
    [
      "an end before the start",
      { ended_at: "2026-10-18T08:59:59+01:00" },
      "A session cannot end before it starts",
    ],
    ["a blank time zone", { tz: " " }, "Text must not be blank"],
    [
      "a time zone over 64 characters",
      { tz: "Z".repeat(65) },
      "Text must be at most 64 characters",
    ],
    [
      "a note over 1,000 characters",
      { note: "n".repeat(1001) },
      "A note must be at most 1000 characters",
    ],
    ["a local date that is not a date", { local_date: "18/10/2026" }],
    ["a start without an offset", { started_at: "2026-10-18T09:00:00" }],
  ])("should reject %s", (_case, overrides, message) => {
    expectRejected(workoutSessionRowSchema, session(overrides), message);
  });
});

const snapshot = (overrides: Partial<SetSnapshot> = {}): SetSnapshot => ({
  version: 1,
  kind: "exercise",
  ref: EXERCISE_ID,
  name: "Dumbbell lateral raise",
  equipment: "dumbbell",
  mechanic: "isolation",
  muscleListVersion: 1,
  muscles: [
    { muscle_id: "delt_side", role: "primary", weight: 1 },
    { muscle_id: "traps_upper", role: "secondary", weight: 0.3 },
  ],
  ...overrides,
});

describe("setSnapshotSchema", () => {
  it("should accept the snapshot of Amendment 1", () => {
    expectAccepted(setSnapshotSchema, snapshot());
  });

  it.each<[string, Record<string, unknown>]>([
    ["an unknown version", { version: 2 }],
    ["another kind", { kind: "food" }],
    ["an unknown muscle list version", { muscleListVersion: 2 }],
    ["an unknown muscle", { muscles: [{ muscle_id: "delts", role: "primary", weight: 1 }] }],
    [
      "a map without a primary muscle",
      { muscles: [{ muscle_id: "delt_side", role: "secondary", weight: 1 }] },
    ],
    ["a key the shape does not have", { reps: 10 }],
  ])("should reject %s", (_case, overrides) => {
    expectRejected(setSnapshotSchema, { ...snapshot(), ...overrides });
  });
});

const set = (overrides: Partial<WorkoutSetRow> = {}): WorkoutSetRow => ({
  id: "00000000-0000-4000-8000-0000000000f1",
  session_id: SESSION_ID,
  user_id: USER_ID,
  exercise_id: EXERCISE_ID,
  position: 0,
  set_type: "working",
  reps: 12,
  load_kg: 10,
  rir: 2,
  rpe: null,
  performed_at: "2026-10-18T09:10:00+01:00",
  snapshot: snapshot(),
  deleted_at: null,
  created_at: CREATED_AT,
  ...overrides,
});

describe("workoutSetRowSchema", () => {
  it("should accept a working set with RIR", () => {
    expectAccepted(workoutSetRowSchema, set());
  });

  it.each<[string, Partial<WorkoutSetRow>]>([
    ["an RPE of 7.5 instead of RIR", { rir: null, rpe: 7.5 }],
    ["no effort measure", { rir: null, rpe: null }],
    ["an unloaded bodyweight set", { load_kg: null }],
    ["a load of 0 kg", { load_kg: 0 }],
    ["a load of 1,000 kg", { load_kg: 1000 }],
    ["the lowest RIR", { rir: 0 }],
    ["the highest RIR", { rir: 10 }],
    ["the lowest RPE", { rir: null, rpe: 1 }],
    ["the highest RPE", { rir: null, rpe: 10 }],
    ["1 rep", { reps: 1 }],
    ["100 reps", { reps: 100 }],
  ])("should accept %s", (_case, overrides) => {
    expectAccepted(workoutSetRowSchema, set(overrides));
  });

  it.each<[string, Partial<WorkoutSetRow>, string?]>([
    ["0 reps", { reps: 0 }],
    ["more than 100 reps", { reps: 101 }],
    ["a fraction of a rep", { reps: 8.5 }],
    ["a negative load", { load_kg: -1 }],
    ["a load above 1,000 kg", { load_kg: 1000.5 }],
    ["a negative RIR", { rir: -1 }],
    ["an RIR above 10", { rir: 11 }],
    ["a fractional RIR", { rir: 2.5 }],
    ["an RPE below 1", { rir: null, rpe: 0.5 }],
    ["an RPE above 10", { rir: null, rpe: 10.5 }],
    ["an RPE off the half steps", { rir: null, rpe: 7.25 }, "RPE must be in steps of 0.5"],
    ["both RIR and RPE", { rir: 2, rpe: 8 }, "A set has at most one of RIR and RPE"],
    ["an unknown set type", { set_type: "amrap" as WorkoutSetRow["set_type"] }],
    ["a negative position", { position: -1 }],
    ["a fractional position", { position: 1.5 }],
    [
      "a snapshot of another exercise",
      { snapshot: snapshot({ ref: "00000000-0000-4000-8000-000000000099" }) },
      "A set's snapshot must be taken from the set's exercise",
    ],
  ])("should reject %s", (_case, overrides, message) => {
    expectRejected(workoutSetRowSchema, set(overrides), message);
  });

  it("should reject a snapshot of an unknown version", () => {
    expectRejected(workoutSetRowSchema, { ...set(), snapshot: { ...snapshot(), version: 2 } });
  });
});

const sets = (live: number, deleted = 0): WorkoutSetRow[] => [
  ...Array.from({ length: live }, (_, position) => set({ position })),
  ...Array.from({ length: deleted }, (_, position) =>
    set({ position, deleted_at: "2026-10-18T09:30:00+01:00" }),
  ),
];

describe("workoutSessionSetsSchema", () => {
  it("should accept 200 live sets", () => {
    expectAccepted(workoutSessionSetsSchema, sets(200));
  });

  it("should not count a deleted set", () => {
    expectAccepted(workoutSessionSetsSchema, sets(200, 1));
  });

  it("should reject more than 200 live sets", () => {
    expectRejected(workoutSessionSetsSchema, sets(201), "A session holds at most 200 sets");
  });
});

const routine = (overrides: Partial<RoutineRow> = {}): RoutineRow => ({
  id: ROUTINE_ID,
  user_id: USER_ID,
  name: "Upper lower",
  is_active: true,
  is_archived: false,
  created_at: CREATED_AT,
  ...overrides,
});

describe("routineRowSchema", () => {
  it("should accept an active routine", () => {
    expectAccepted(routineRowSchema, routine());
  });

  it("should accept an archived routine that is not active", () => {
    expectAccepted(routineRowSchema, routine({ is_active: false, is_archived: true }));
  });

  it.each<[string, Partial<RoutineRow>, string?]>([
    ["a blank name", { name: "" }, "Text must not be blank"],
    [
      "a name over 200 characters",
      { name: "r".repeat(201) },
      "Text must be at most 200 characters",
    ],
    [
      "a routine that is active and archived",
      { is_archived: true },
      "An archived routine cannot be active",
    ],
  ])("should reject %s", (_case, overrides, message) => {
    expectRejected(routineRowSchema, routine(overrides), message);
  });
});

const day = (overrides: Partial<RoutineDayRow> = {}): RoutineDayRow => ({
  id: ROUTINE_DAY_ID,
  routine_id: ROUTINE_ID,
  user_id: USER_ID,
  position: 0,
  weekday: 0,
  name: "Upper A",
  created_at: CREATED_AT,
  ...overrides,
});

describe("routineDayRowSchema", () => {
  it.each<[string, Partial<RoutineDayRow>]>([
    ["a Monday", { weekday: 0 }],
    ["a Sunday", { weekday: 6 }],
    ["any day", { weekday: null }],
    ["a name of 100 characters", { name: "d".repeat(100) }],
  ])("should accept %s", (_case, overrides) => {
    expectAccepted(routineDayRowSchema, day(overrides));
  });

  it.each<[string, Partial<RoutineDayRow>, string?]>([
    ["a weekday below 0", { weekday: -1 }],
    ["a weekday above 6", { weekday: 7 }],
    ["a fractional weekday", { weekday: 2.5 }],
    ["a blank name", { name: "\t" }, "Text must not be blank"],
    [
      "a name over 100 characters",
      { name: "d".repeat(101) },
      "Text must be at most 100 characters",
    ],
    ["a negative position", { position: -1 }],
  ])("should reject %s", (_case, overrides, message) => {
    expectRejected(routineDayRowSchema, day(overrides), message);
  });
});

const week = (weekdays: (number | null)[]): RoutineDayRow[] =>
  weekdays.map((weekday, position) => day({ position, weekday }));

describe("routineDaysSchema", () => {
  it("should accept a day on every weekday", () => {
    expectAccepted(routineDaysSchema, week([0, 1, 2, 3, 4, 5, 6]));
  });

  it("should accept several days on any day", () => {
    expectAccepted(routineDaysSchema, week([null, null, 2]));
  });

  it("should reject more than 7 days", () => {
    expectRejected(
      routineDaysSchema,
      week([null, null, null, null, null, null, null, null]),
      "A routine has at most 7 days",
    );
  });

  it("should reject two days on the same weekday", () => {
    expectRejected(routineDaysSchema, week([0, 2, 0]), "A routine has at most one day per weekday");
  });

  it("should reject two days in the same position", () => {
    expectRejected(
      routineDaysSchema,
      [day({ position: 1, weekday: 0 }), day({ position: 1, weekday: 3 })],
      "Two days of a routine cannot share a position",
    );
  });
});

const plannedExercise = (overrides: Partial<RoutineExerciseRow> = {}): RoutineExerciseRow => ({
  id: "00000000-0000-4000-8000-0000000000d3",
  routine_day_id: ROUTINE_DAY_ID,
  user_id: USER_ID,
  position: 0,
  exercise_id: EXERCISE_ID,
  target_sets: 3,
  rep_min: 10,
  rep_max: 15,
  target_rir: 2,
  created_at: CREATED_AT,
  ...overrides,
});

describe("routineExerciseRowSchema", () => {
  it.each<[string, Partial<RoutineExerciseRow>]>([
    ["a rep range", {}],
    ["a fixed rep target", { rep_min: 5, rep_max: 5 }],
    ["no RIR target", { target_rir: null }],
    ["the widest targets", { target_sets: 20, rep_min: 1, rep_max: 100, target_rir: 10 }],
  ])("should accept %s", (_case, overrides) => {
    expectAccepted(routineExerciseRowSchema, plannedExercise(overrides));
  });

  it.each<[string, Partial<RoutineExerciseRow>, string?]>([
    ["0 target sets", { target_sets: 0 }],
    ["more than 20 target sets", { target_sets: 21 }],
    ["a fraction of a target set", { target_sets: 2.5 }],
    ["a lowest rep target of 0", { rep_min: 0 }],
    ["a highest rep target above 100", { rep_max: 101 }],
    ["a fractional rep target", { rep_min: 8.5 }],
    [
      "a lowest rep target above the highest",
      { rep_min: 12, rep_max: 8 },
      "The lowest rep target cannot be above the highest",
    ],
    ["a negative RIR target", { target_rir: -1 }],
    ["an RIR target above 10", { target_rir: 11 }],
    ["a negative position", { position: -1 }],
  ])("should reject %s", (_case, overrides, message) => {
    expectRejected(routineExerciseRowSchema, plannedExercise(overrides), message);
  });
});

const dayPlan = (count: number): RoutineExerciseRow[] =>
  Array.from({ length: count }, (_, position) => plannedExercise({ position }));

describe("routineDayExercisesSchema", () => {
  it("should accept 30 exercises", () => {
    expectAccepted(routineDayExercisesSchema, dayPlan(30));
  });

  it("should reject more than 30 exercises", () => {
    expectRejected(
      routineDayExercisesSchema,
      dayPlan(31),
      "A routine day has at most 30 exercises",
    );
  });

  it("should reject two exercises in the same position", () => {
    expectRejected(
      routineDayExercisesSchema,
      [plannedExercise(), plannedExercise()],
      "Two exercises of a routine day cannot share a position",
    );
  });
});

const goals = (overrides: Partial<TrainingGoalsRow> = {}): TrainingGoalsRow => ({
  id: "00000000-0000-4000-8000-0000000000b9",
  user_id: USER_ID,
  goal: "aesthetic",
  focus: ["v_taper", "arms"],
  days_per_week: 4,
  session_minutes: 60,
  equipment: ["barbell", "dumbbell", "cable"],
  experience: "intermediate",
  muscle_priority: { delt_side: 1.5, lats: 1.5, chest_upper: 1.25, obliques: 0.5 },
  params_version: "keylow-training-v1",
  effective_from: "2026-10-18T08:00:00+00:00",
  effective_to: null,
  created_at: CREATED_AT,
  ...overrides,
});

describe("trainingGoalsRowSchema", () => {
  it.each<[string, Partial<TrainingGoalsRow>]>([
    ["the current goals", {}],
    ["goals that ended", { effective_to: "2026-10-25T08:00:00+00:00" }],
    [
      "goals that ended less than a millisecond after they began, as two quick saves store them",
      {
        effective_from: "2026-10-18T08:00:00.843291+00:00",
        effective_to: "2026-10-18T08:00:00.843953+00:00",
      },
    ],
    [
      "goals that ended a microsecond after they began, read in another offset",
      {
        effective_from: "2026-10-18T09:00:00.000001+01:00",
        effective_to: "2026-10-18T08:00:00.000002+00:00",
      },
    ],
    ["no focus and no equipment", { focus: [], equipment: [] }],
    ["every focus once", { focus: ["v_taper", "chest", "arms", "glutes", "legs", "overall"] }],
    ["the fewest days and minutes", { days_per_week: 1, session_minutes: 15 }],
    ["the most days and minutes", { days_per_week: 7, session_minutes: 180 }],
  ])("should accept %s", (_case, overrides) => {
    expectAccepted(trainingGoalsRowSchema, goals(overrides));
  });

  it.each<[string, Partial<TrainingGoalsRow>, string?]>([
    ["0 days a week", { days_per_week: 0 }],
    ["more than 7 days a week", { days_per_week: 8 }],
    ["a fraction of a day a week", { days_per_week: 3.5 }],
    ["sessions under 15 minutes", { session_minutes: 14 }],
    ["sessions over 180 minutes", { session_minutes: 181 }],
    ["a fraction of a minute", { session_minutes: 45.5 }],
    ["an unknown focus", { focus: ["shoulders" as TrainingGoalsRow["focus"][number]] }],
    ["a focus chosen twice", { focus: ["arms", "arms"] }, "A focus can be chosen at most once"],
    ["an unknown goal", { goal: "endurance" as TrainingGoalsRow["goal"] }],
    ["an unknown experience", { experience: "elite" as TrainingGoalsRow["experience"] }],
    ["an unknown equipment", { equipment: ["rings" as TrainingGoalsRow["equipment"][number]] }],
    [
      "a priority for an unknown muscle",
      { muscle_priority: { delts: 1 } as TrainingGoalsRow["muscle_priority"] },
    ],
    ["a blank params version", { params_version: "" }],
    [
      "an end a microsecond before the start",
      {
        effective_from: "2026-10-18T08:00:00.843953+00:00",
        effective_to: "2026-10-18T08:00:00.843291+00:00",
      },
      "A goal must end after it starts",
    ],
    [
      "an end at the same microsecond as the start",
      {
        effective_from: "2026-10-18T08:00:00.843291+00:00",
        effective_to: "2026-10-18T08:00:00.843291+00:00",
      },
      "A goal must end after it starts",
    ],
    [
      "an end at the start",
      { effective_to: "2026-10-18T08:00:00+00:00" },
      "A goal must end after it starts",
    ],
  ])("should reject %s", (_case, overrides, message) => {
    expectRejected(trainingGoalsRowSchema, goals(overrides), message);
  });

  it("should reject a priority that is not a number", () => {
    expectRejected(trainingGoalsRowSchema, { ...goals(), muscle_priority: { lats: "high" } });
  });
});
