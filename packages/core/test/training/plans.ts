import type { ExerciseMuscleEntry } from "../../src/schemas";
import type {
  LoggedSession,
  LoggedSet,
  PlanExercise,
  PlannedSet,
  PlanRoutineDay,
  SnapshotExercise,
} from "../../src/training";

/** A row id that `z.guid()` accepts, numbered so tests can tell ids apart. */
export const id = (prefix: number, n: number): string =>
  `${String(prefix).padStart(8, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;

const EXERCISE = 1;
const ROUTINE_EXERCISE = 2;
const DAY = 3;
const SESSION = 4;

export const exerciseId = (n: number): string => id(EXERCISE, n);
export const dayId = (n: number): string => id(DAY, n);
export const sessionId = (n: number): string => id(SESSION, n);

/** Monday 19 October 2026. London is on BST (UTC+1) until the clocks go back on Sunday 25 October. */
export const WEEK = "2026-10-19";
export const PREVIOUS_WEEK = "2026-10-12";
export const LONDON = "Europe/London";

export const bench: SnapshotExercise = {
  id: exerciseId(1),
  name: "Barbell bench press",
  equipment: "barbell",
  mechanic: "compound",
};
export const benchMuscles: ExerciseMuscleEntry[] = [
  { muscle_id: "chest_lower", role: "primary", weight: 1 },
  { muscle_id: "chest_upper", role: "secondary", weight: 0.6 },
  { muscle_id: "triceps", role: "secondary", weight: 0.5 },
];

export const squat: SnapshotExercise = {
  id: exerciseId(2),
  name: "Back squat",
  equipment: "barbell",
  mechanic: "compound",
};
export const squatMuscles: ExerciseMuscleEntry[] = [
  { muscle_id: "quads", role: "primary", weight: 1 },
  { muscle_id: "glute_max", role: "secondary", weight: 0.5 },
];

export const row: SnapshotExercise = {
  id: exerciseId(3),
  name: "Cable row",
  equipment: "cable",
  mechanic: "compound",
};
export const rowMuscles: ExerciseMuscleEntry[] = [
  { muscle_id: "lats", role: "primary", weight: 1 },
  { muscle_id: "biceps", role: "secondary", weight: 0.5 },
];

export const curl: SnapshotExercise = {
  id: exerciseId(4),
  name: "Dumbbell curl",
  equipment: "dumbbell",
  mechanic: "isolation",
};
export const curlMuscles: ExerciseMuscleEntry[] = [
  { muscle_id: "biceps", role: "primary", weight: 1 },
];

let routineExerciseCount = 0;

/** A routine exercise of `exercise` with its current map, at full effort when `targetRir` is null. */
export const planExercise = (
  exercise: SnapshotExercise,
  muscles: readonly ExerciseMuscleEntry[],
  targetSets: number,
  targetRir: number | null,
  position: number,
): PlanExercise => {
  routineExerciseCount += 1;
  return {
    id: id(ROUTINE_EXERCISE, routineExerciseCount),
    position,
    exercise_id: exercise.id,
    target_sets: targetSets,
    target_rir: targetRir,
    exercise,
    muscles,
  };
};

/** Push on Monday, legs on Wednesday, pull on Friday, and arms on any day. */
export const push: PlanRoutineDay = {
  id: dayId(1),
  position: 0,
  weekday: 0,
  exercises: [planExercise(bench, benchMuscles, 3, 2, 0)],
};
export const legs: PlanRoutineDay = {
  id: dayId(2),
  position: 1,
  weekday: 2,
  exercises: [planExercise(squat, squatMuscles, 4, 2, 0)],
};
export const pull: PlanRoutineDay = {
  id: dayId(3),
  position: 2,
  weekday: 4,
  exercises: [planExercise(row, rowMuscles, 3, 1, 0)],
};
export const arms: PlanRoutineDay = {
  id: dayId(4),
  position: 3,
  weekday: null,
  exercises: [planExercise(curl, curlMuscles, 3, 1, 0)],
};

export const routine = { days: [push, legs, pull, arms] };

/** A live session, from a routine day when `routineDayId` is given. */
export const session = (
  n: number,
  localDate: string,
  routineDayId: string | null,
  overrides: Partial<LoggedSession> = {},
): LoggedSession => ({
  id: sessionId(n),
  local_date: localDate,
  routine_day_id: routineDayId,
  deleted_at: null,
  ...overrides,
});

/** `count` live working sets of an exercise in a session, at `performedAt`. */
export const loggedSets = (
  session: LoggedSession,
  exercise: SnapshotExercise,
  muscles: readonly ExerciseMuscleEntry[],
  count: number,
  performedAt: string,
  overrides: Partial<Omit<LoggedSet, "snapshot" | "session_id">> = {},
): LoggedSet[] =>
  Array.from({ length: count }, () => ({
    session_id: session.id,
    set_type: "working",
    rir: 2,
    rpe: null,
    performed_at: performedAt,
    deleted_at: null,
    ...overrides,
    snapshot: { muscles: [...muscles] },
  }));

/** The planned sets logged exactly as planned in a session, at `performedAt`. */
export const asLogged = (
  planned: readonly PlannedSet[],
  session: LoggedSession,
  performedAt: string,
): LoggedSet[] =>
  planned.map((set) => ({
    session_id: session.id,
    set_type: set.set_type,
    rir: set.rir,
    rpe: set.rpe,
    performed_at: performedAt,
    deleted_at: null,
    snapshot: set.snapshot,
  }));
