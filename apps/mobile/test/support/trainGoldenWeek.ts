import { buildSetSnapshot } from "@keylow/core/training";

type Row = Record<string, unknown>;

/*
 * The agreed golden week (KEY-353), as the database returns it: Push Pull Legs, Push on Monday, Pull on
 * Tuesday, Legs on Thursday and Push on Saturday, in Europe/London. Monday and Tuesday are done and Thursday's
 * Legs holds 16 sets over 5 exercises. The sets of Monday and Tuesday are left out, since the Today card
 * reads the sets of today only.
 */

const idWith = (group: string, n: number): string =>
  `0000000${group}-0000-4000-8000-${String(n).padStart(12, "0")}`;

type ExerciseKey = "bench" | "row" | "squat" | "romanianDeadlift" | "legPress" | "legCurl" | "calf";

const EXERCISES: Record<ExerciseKey, { id: string; name: string }> = {
  bench: { id: idWith("1", 1), name: "Barbell Bench Press" },
  row: { id: idWith("1", 2), name: "Bent Over Barbell Row" },
  squat: { id: idWith("1", 3), name: "Barbell Squat" },
  romanianDeadlift: { id: idWith("1", 4), name: "Romanian Deadlift" },
  legPress: { id: idWith("1", 5), name: "Leg Press" },
  legCurl: { id: idWith("1", 6), name: "Seated Leg Curl" },
  calf: { id: idWith("1", 7), name: "Standing Calf Raises" },
};

const PRIMARY_QUADS = [{ muscle_id: "quads", role: "primary", weight: 1 }] as const;

const routineDay = (
  n: number,
  name: string,
  weekday: number,
  exercises: readonly (readonly [ExerciseKey, number])[],
): Row => ({
  id: idWith("3", n),
  name,
  position: n - 1,
  weekday,
  routine_exercises: exercises.map(([key, targetSets], position) => ({
    id: idWith("2", n * 10 + position),
    position,
    exercise_id: EXERCISES[key].id,
    target_sets: targetSets,
    target_rir: 2,
    exercises: {
      id: EXERCISES[key].id,
      name: EXERCISES[key].name,
      equipment: "barbell",
      mechanic: "compound",
      exercise_muscles: PRIMARY_QUADS,
    },
  })),
});

const PUSH_EXERCISES = [["bench", 3]] as const;

export const LEGS_ID = idWith("3", 3);

/** Push Pull Legs, with the plan placed on Monday, Tuesday, Thursday and Saturday. Legs holds 5 exercises and 16 sets. */
export const goldenRoutine: Row = {
  id: idWith("8", 1),
  name: "Push Pull Legs",
  // Made active before the week starts, so the whole week is planned.
  activated_at: "2026-10-01T09:00:00+01:00",
  routine_days: [
    routineDay(1, "Push", 0, PUSH_EXERCISES),
    routineDay(2, "Pull", 1, [["row", 3]]),
    routineDay(3, "Legs", 3, [
      ["squat", 3],
      ["romanianDeadlift", 3],
      ["legPress", 3],
      ["legCurl", 3],
      ["calf", 4],
    ]),
    routineDay(4, "Push", 5, PUSH_EXERCISES),
  ],
};

const sessionRow = (
  n: number,
  localDate: string,
  startedAt: string,
  endedAt: string | null,
  routineDayId: string,
  sets: readonly Row[],
): Row => ({
  id: idWith("4", n),
  local_date: localDate,
  started_at: startedAt,
  ended_at: endedAt,
  routine_day_id: routineDayId,
  deleted_at: null,
  workout_sets: sets,
});

/** Monday's Push, done. */
export const mondayPush: Row = sessionRow(
  1,
  "2026-10-12",
  "2026-10-12T18:00:00+01:00",
  "2026-10-12T18:48:00+01:00",
  idWith("3", 1),
  [],
);

/** Tuesday's Pull, done. */
export const tuesdayPull: Row = sessionRow(
  2,
  "2026-10-13",
  "2026-10-13T18:00:00+01:00",
  "2026-10-13T18:51:00+01:00",
  idWith("3", 2),
  [],
);

const THURSDAY_SESSION_ID = idWith("4", 3);

// Two warm-ups and three working sets of squat, three of Romanian deadlift and two of leg press: 8 of the
// 16 sets, with the third set of leg press next. The first set is at 18:30.
const thursdaySets: readonly (readonly [ExerciseKey, "warmup" | "working", string])[] = [
  ["squat", "warmup", "18:30"],
  ["squat", "warmup", "18:33"],
  ["squat", "working", "18:36"],
  ["squat", "working", "18:39"],
  ["squat", "working", "18:42"],
  ["romanianDeadlift", "working", "18:45"],
  ["romanianDeadlift", "working", "18:48"],
  ["romanianDeadlift", "working", "18:51"],
  ["legPress", "working", "18:54"],
  ["legPress", "working", "18:57"],
];

const setRow = (
  [key, setType, time]: readonly [ExerciseKey, "warmup" | "working", string],
  position: number,
): Row => ({
  id: idWith("5", position + 1),
  session_id: THURSDAY_SESSION_ID,
  exercise_id: EXERCISES[key].id,
  set_type: setType,
  rir: setType === "working" ? 2 : null,
  rpe: null,
  performed_at: `2026-10-15T${time}:00+01:00`,
  snapshot: buildSetSnapshot(
    {
      id: EXERCISES[key].id,
      name: EXERCISES[key].name,
      equipment: "barbell",
      mechanic: "compound",
    },
    PRIMARY_QUADS,
  ),
  deleted_at: null,
});

const thursdaySession = (endedAt: string | null): Row =>
  sessionRow(
    3,
    "2026-10-15",
    "2026-10-15T18:30:00+01:00",
    endedAt,
    LEGS_ID,
    thursdaySets.map(setRow),
  );

/** Thursday's Legs as the week read returns it, open or ended. Eight working sets are logged. */
export const thursdayLegsInTheWeek = (endedAt: string | null): Row => thursdaySession(endedAt);

/** The open session as the read of the session in progress returns it: with its routine day's name and the place and values of each set. */
export const thursdayLegsActive: Row = {
  id: THURSDAY_SESSION_ID,
  started_at: "2026-10-15T18:30:00+01:00",
  ended_at: null,
  local_date: "2026-10-15",
  routine_day_id: LEGS_ID,
  note: null,
  deleted_at: null,
  routine_days: { name: "Legs" },
  workout_sets: thursdaySets.map((set, position) => ({
    ...setRow(set, position),
    position,
    reps: 8,
    load_kg: 100,
  })),
};

const OPEN_SESSION_ID = idWith("4", 9);

/**
 * A Legs session still open with no sets logged, started at `startedAt` on the local day `localDate`: as
 * the week read returns it, and as the read of the session in progress returns it.
 */
export function openLegsSession(
  localDate: string,
  startedAt: string,
): { inTheWeek: Row; active: Row } {
  return {
    inTheWeek: sessionRow(9, localDate, startedAt, null, LEGS_ID, []),
    active: {
      id: OPEN_SESSION_ID,
      started_at: startedAt,
      ended_at: null,
      local_date: localDate,
      routine_day_id: LEGS_ID,
      note: null,
      deleted_at: null,
      routine_days: { name: "Legs" },
      workout_sets: [],
    },
  };
}
