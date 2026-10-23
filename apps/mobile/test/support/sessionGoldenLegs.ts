import { buildSetSnapshot } from "@keylow/core/training";

import type { Equipment, HeatSet, MuscleId } from "@keylow/core/training";

type Row = Record<string, unknown>;

/*
 * The golden Thursday Legs session (KEY-353, as the `session · active` and `session · from-routine` boards
 * draw it) as the database returns it: the Legs day with its rep ranges, equipment and RIR, the session open
 * at 19:00 with 8 of 16 sets logged, a fresh one, and the sets of Thursday 8 October that the Previous
 * column shows. Loads are kilograms, as stored.
 */

const idWith = (group: number, n: number): string =>
  `0000000${group}-0000-4000-8000-${String(n).padStart(12, "0")}`;

type ExerciseKey = "squat" | "romanianDeadlift" | "legPress" | "legCurl" | "calf";

const EXERCISES: Record<
  ExerciseKey,
  {
    id: string;
    name: string;
    equipment: Equipment;
    sets: number;
    repMin: number;
    repMax: number;
    rir: number;
  }
> = {
  squat: {
    id: idWith(6, 1),
    name: "Barbell squat",
    equipment: "barbell",
    sets: 3,
    repMin: 5,
    repMax: 8,
    rir: 2,
  },
  romanianDeadlift: {
    id: idWith(6, 2),
    name: "Romanian deadlift",
    equipment: "barbell",
    sets: 3,
    repMin: 8,
    repMax: 10,
    rir: 2,
  },
  legPress: {
    id: idWith(6, 3),
    name: "Leg press",
    equipment: "machine",
    sets: 3,
    repMin: 10,
    repMax: 12,
    rir: 1,
  },
  legCurl: {
    id: idWith(6, 4),
    name: "Seated leg curl",
    equipment: "machine",
    sets: 3,
    repMin: 10,
    repMax: 12,
    rir: 1,
  },
  calf: {
    id: idWith(6, 5),
    name: "Standing calf raise",
    equipment: "machine",
    sets: 4,
    repMin: 12,
    repMax: 15,
    rir: 1,
  },
};

type Muscle = { muscle_id: MuscleId; role: "primary" | "secondary" | "stabiliser"; weight: number };

const QUADS = [{ muscle_id: "quads", role: "primary", weight: 1 }] as const;

export const LEGS_DAY_ID = idWith(6, 90);
export const LEGS_ROUTINE_ID = idWith(6, 91);

/** The active routine, read for the plan's day and for the day's rep ranges: one day, Legs, with five exercises. */
export const legsRoutine: Row = {
  id: LEGS_ROUTINE_ID,
  name: "Push Pull Legs",
  is_active: true,
  is_archived: false,
  activated_at: "2026-10-01T09:00:00+01:00",
  routine_days: [
    {
      id: LEGS_DAY_ID,
      name: "Legs",
      position: 0,
      weekday: 3,
      routine_exercises: Object.values(EXERCISES).map((exercise, position) => ({
        id: idWith(6, 100 + position),
        position,
        exercise_id: exercise.id,
        target_sets: exercise.sets,
        rep_min: exercise.repMin,
        rep_max: exercise.repMax,
        target_rir: exercise.rir,
        exercises: {
          id: exercise.id,
          name: exercise.name,
          equipment: exercise.equipment,
          mechanic: "compound",
          exercise_muscles: QUADS,
        },
      })),
    },
  ],
};

// The muscles the exercises really work, as the golden week's fixture has them: squatting, pressing and
// pulling the leg train hamstrings, glutes, lower back and calves as well as the quads.
const LEG_MUSCLES: Record<ExerciseKey, readonly Muscle[]> = {
  squat: [
    { muscle_id: "quads", role: "primary", weight: 1 },
    { muscle_id: "glute_max", role: "secondary", weight: 0.5 },
    { muscle_id: "hamstrings", role: "secondary", weight: 0.5 },
    { muscle_id: "lower_back", role: "stabiliser", weight: 0.2 },
    { muscle_id: "calves", role: "stabiliser", weight: 0.2 },
  ],
  romanianDeadlift: [
    { muscle_id: "hamstrings", role: "primary", weight: 1 },
    { muscle_id: "lower_back", role: "secondary", weight: 0.5 },
    { muscle_id: "glute_max", role: "secondary", weight: 0.5 },
    { muscle_id: "calves", role: "stabiliser", weight: 0.2 },
  ],
  legPress: [
    { muscle_id: "quads", role: "primary", weight: 1 },
    { muscle_id: "glute_max", role: "secondary", weight: 0.5 },
    { muscle_id: "hamstrings", role: "secondary", weight: 0.5 },
    { muscle_id: "calves", role: "stabiliser", weight: 0.2 },
  ],
  legCurl: [{ muscle_id: "hamstrings", role: "primary", weight: 1 }],
  calf: [{ muscle_id: "calves", role: "primary", weight: 1 }],
};

/** Which muscles the sets of a session are snapshotted with: every exercise on the quads alone, or what each really works. */
export type SnapshotMuscles = "quads" | "legs";

export const snapshotOf = (key: ExerciseKey, muscles: SnapshotMuscles = "quads") =>
  buildSetSnapshot(
    {
      id: EXERCISES[key].id,
      name: EXERCISES[key].name,
      equipment: EXERCISES[key].equipment,
      mechanic: "compound",
    },
    muscles === "legs" ? LEG_MUSCLES[key] : QUADS,
  );

export const GOLDEN_SESSION_ID = idWith(6, 80);
export const FRESH_SESSION_ID = idWith(6, 81);

export const exerciseIdOf = (key: ExerciseKey): string => EXERCISES[key].id;

type LoggedSet = readonly [
  ExerciseKey,
  "warmup" | "working",
  string,
  number,
  number,
  number | null,
];

// [exercise, type, time, load, reps, rir] as the board draws them at 19:00.
const GOLDEN_SETS: readonly LoggedSet[] = [
  ["squat", "warmup", "18:30", 60, 8, null],
  ["squat", "warmup", "18:33", 80, 5, null],
  ["squat", "working", "18:36", 100, 8, 2],
  ["squat", "working", "18:39", 100, 7, 2],
  ["squat", "working", "18:42", 100, 6, 2],
  ["romanianDeadlift", "working", "18:45", 90, 10, 2],
  ["romanianDeadlift", "working", "18:48", 90, 9, 2],
  ["romanianDeadlift", "working", "18:51", 90, 8, 2],
  ["legPress", "working", "18:54", 180, 12, 1],
  ["legPress", "working", "18:57", 180, 11, 1],
];

/** The golden Legs sets as core's heat model reads them, snapshotted with the muscles each exercise really works. */
export const goldenLegsHeatSets: HeatSet[] = GOLDEN_SETS.map(([key, setType, time, , , rir]) => ({
  set_type: setType,
  rir,
  rpe: null,
  performed_at: `2026-10-15T${time}:00+01:00`,
  deleted_at: null,
  snapshot: snapshotOf(key, "legs"),
}));

/** One logged set as the read of the session in progress returns it. `n` keeps ids and positions apart. */
export const loggedSetRow = (
  sessionId: string,
  key: ExerciseKey,
  n: number,
  overrides: Row = {},
): Row => ({
  id: idWith(7, n),
  session_id: sessionId,
  exercise_id: EXERCISES[key].id,
  position: n,
  set_type: "working",
  reps: 10,
  load_kg: 100,
  rir: 2,
  rpe: null,
  performed_at: `2026-10-15T20:${String(n % 60).padStart(2, "0")}:00+01:00`,
  snapshot: snapshotOf(key),
  deleted_at: null,
  ...overrides,
});

const sessionRow = (
  id: string,
  startedAt: string,
  sets: readonly Row[],
  dayId: string | null,
): Row => ({
  id,
  started_at: startedAt,
  ended_at: null,
  local_date: "2026-10-15",
  routine_day_id: dayId,
  note: null,
  deleted_at: null,
  routine_days: dayId === null ? null : { name: "Legs" },
  workout_sets: sets,
});

/** The golden Legs session open at 19:00, started at 18:30: 8 of 16 sets and 2 warm-ups, as the board draws it. */
export const goldenLegsOpen = (
  dayId: string | null = LEGS_DAY_ID,
  extraSets: readonly Row[] = [],
  snapshotMuscles: SnapshotMuscles = "quads",
): Row =>
  sessionRow(
    GOLDEN_SESSION_ID,
    "2026-10-15T18:30:00+01:00",
    [
      ...GOLDEN_SETS.map(([key, setType, time, load, reps, rir], n) =>
        loggedSetRow(GOLDEN_SESSION_ID, key, n + 1, {
          set_type: setType,
          performed_at: `2026-10-15T${time}:00+01:00`,
          load_kg: load,
          reps,
          rir,
          snapshot: snapshotOf(key, snapshotMuscles),
        }),
      ),
      ...extraSets,
    ],
    dayId,
  );

/** A Legs session just started: nothing logged. */
export const freshLegsOpen = (startedAt: string): Row =>
  sessionRow(FRESH_SESSION_ID, startedAt, [], LEGS_DAY_ID);

let lastTimeCount = 0;

const lastTime = (
  key: ExerciseKey,
  loads: readonly [number, number, number],
  reps: readonly [number, number, number],
): Row[] =>
  loads.map((load, index) => ({
    id: idWith(8, ++lastTimeCount),
    session_id: idWith(6, 70),
    exercise_id: EXERCISES[key].id,
    position: index,
    set_type: "working",
    reps: reps[index],
    load_kg: load,
    rir: 2,
    rpe: null,
    performed_at: `2026-10-08T18:${String(10 + index)}:00+01:00`,
    deleted_at: null,
    workout_sessions: { local_date: "2026-10-08" },
  }));

/**
 * What the Previous column shows, from Thursday 8 October (made up on the board): squat 97.5 × 8, 7, 6,
 * Romanian deadlift 87.5 × 10, 9, 8, leg press 170 × 12, 11, 10 and seated leg curl 45 × 12, 11, 10.
 */
export const previousThursday: Row[] = [
  ...lastTime("squat", [97.5, 97.5, 97.5], [8, 7, 6]),
  ...lastTime("romanianDeadlift", [87.5, 87.5, 87.5], [10, 9, 8]),
  ...lastTime("legPress", [170, 170, 170], [12, 11, 10]),
  ...lastTime("legCurl", [45, 45, 45], [12, 11, 10]),
];

/**
 * The same read with a set of the open golden session in it, as the read returns it when the open session is
 * not left out: it is newer than Thursday's, so a screen that does not leave it out shows it as the Previous.
 */
export const previousThursdayAndOpenSession: Row[] = [
  ...previousThursday,
  {
    ...loggedSetRow(GOLDEN_SESSION_ID, "squat", 99),
    reps: 99,
    load_kg: 1,
    workout_sessions: { local_date: "2026-10-15" },
  },
];
