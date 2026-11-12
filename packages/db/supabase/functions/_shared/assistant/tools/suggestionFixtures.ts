// The rows the muscle and suggestion read tools' tests share: a time zone, logged sets, the active routine,
// the current goal and an exercise library, laid out as the repos read them. Nothing in production imports this.
import { MUSCLE_IDS, toLocalDate } from "../../core.ts";
import { userId } from "../testing.ts";
import { exerciseId, exerciseRow, goalsRow, routineId } from "./trainingFixtures.ts";

import type { StubData } from "./testing.ts";

// A Wednesday at noon in London, so the routine day planned for today is the one with weekday 2.
export const fixedNow = "2026-10-14T11:00:00.000Z";
export const fixedToday = "2026-10-14";

// Makes `new Date()` and `Date.now()` answer the moment given while `run` is awaited, so a tool that reads
// the clock gives the same answer every run.
export async function atFixedNow<Result>(moment: string, run: () => Promise<Result>) {
  const RealDate = Date;
  const frozen = RealDate.parse(moment);
  class FrozenDate extends RealDate {
    constructor(...args: [] | [string | number | Date]) {
      super(args.length === 0 ? frozen : args[0]);
    }
    static override now() {
      return frozen;
    }
  }
  const install = (value: unknown) =>
    Object.defineProperty(globalThis, "Date", { value, configurable: true, writable: true });
  install(FrozenDate);
  try {
    return await run();
  } finally {
    install(RealDate);
  }
}

export const profileRow = { timezone: "Europe/London", user_id: userId };

const hoursBefore = (moment: string, hours: number) =>
  new Date(Date.parse(moment) - hours * 3_600_000).toISOString();

const muscleEntry = (muscle: string, role: "primary" | "secondary", weight: number) => ({
  muscle_id: muscle,
  role,
  weight,
});

// A `workout_sets` row as the sets read selects it. The embedded session holds its local date, which the
// stub filters on as the database filters the joined session.
export const loggedSetRow = (
  number: number,
  hoursAgo: number,
  muscles: ReturnType<typeof muscleEntry>[],
  overrides: Record<string, unknown> = {},
) => {
  const performedAt = hoursBefore(fixedNow, hoursAgo);
  return {
    id: `00000000-0000-4000-8000-00000b${String(number).padStart(6, "0")}`,
    session_id: "00000000-0000-4000-8000-0000000000e1",
    exercise_id: exerciseId(1),
    set_type: "working",
    rir: 0,
    rpe: null,
    performed_at: performedAt,
    deleted_at: null,
    snapshot: {
      version: 1,
      kind: "exercise",
      ref: exerciseId(1),
      name: "Barbell row",
      equipment: "barbell",
      mechanic: "compound",
      muscleListVersion: 1,
      muscles,
    },
    workout_sessions: { local_date: toLocalDate(new Date(performedAt), "Europe/London") },
    ...overrides,
  };
};

export const rowMuscles = [
  muscleEntry("lats", "primary", 1),
  muscleEntry("biceps", "secondary", 0.5),
  muscleEntry("lower_back", "secondary", 0.25),
];

// A week of back work: 10 sets of rows nine hours ago and 8 sets of pulldowns six days ago.
export const backWeekSets = () => [
  ...Array.from({ length: 10 }, (_, index) => loggedSetRow(index + 1, 9, rowMuscles)),
  ...Array.from({ length: 8 }, (_, index) =>
    loggedSetRow(index + 11, 6 * 24 - 3, [muscleEntry("lats", "primary", 1)]),
  ),
];

// Every muscle trained, so every row of a result has real numbers in it.
export const fullWeekSets = () =>
  MUSCLE_IDS.flatMap((muscle, muscleIndex) =>
    Array.from({ length: 3 }, (_, setIndex) =>
      loggedSetRow(100 + muscleIndex * 3 + setIndex, 12 + muscleIndex * 6 + setIndex, [
        muscleEntry(muscle, "primary", 1),
      ]),
    ),
  );

// The active routine in the shape both the active read (with muscle maps) and the detail read (with rep
// ranges) take. Its Wednesday day holds one chest exercise.
export const activeRoutineRow = (overrides: Record<string, unknown> = {}) => ({
  id: routineId(1),
  name: "Push Pull Legs",
  is_active: true,
  is_archived: false,
  activated_at: "2026-09-01T08:00:00+00:00",
  user_id: userId,
  routine_days: [
    {
      id: exerciseId(900),
      position: 0,
      weekday: 2,
      name: "Push",
      routine_exercises: [
        {
          id: exerciseId(800),
          position: 0,
          exercise_id: exerciseId(10),
          target_sets: 3,
          rep_min: 6,
          rep_max: 10,
          target_rir: 2,
          exercises: {
            id: exerciseId(10),
            name: "Barbell bench press",
            equipment: "barbell",
            mechanic: "compound",
            exercise_muscles: [
              muscleEntry("chest_upper", "primary", 1),
              muscleEntry("triceps", "secondary", 0.5),
            ],
          },
        },
      ],
    },
  ],
  ...overrides,
});

// A library of back, arm and leg exercises across three kinds of equipment, with real muscle maps.
export const libraryRows = () => [
  exerciseRow(20, {
    name: "Barbell Row",
    equipment: "barbell",
    exercise_muscles: [muscleEntry("lats", "primary", 1), muscleEntry("biceps", "secondary", 0.5)],
  }),
  exerciseRow(21, {
    name: "Dumbbell Curl",
    equipment: "dumbbell",
    mechanic: "isolation",
    exercise_muscles: [muscleEntry("biceps", "primary", 1)],
  }),
  exerciseRow(22, {
    name: "Cable Pulldown",
    equipment: "cable",
    exercise_muscles: [muscleEntry("lats", "primary", 1), muscleEntry("biceps", "secondary", 0.5)],
  }),
  exerciseRow(23, {
    name: "Barbell Squat",
    equipment: "barbell",
    exercise_muscles: [
      muscleEntry("quads", "primary", 1),
      muscleEntry("glute_max", "secondary", 0.5),
    ],
  }),
  exerciseRow(24, {
    name: "Dumbbell Lateral Raise",
    equipment: "dumbbell",
    mechanic: "isolation",
    exercise_muscles: [muscleEntry("delt_side", "primary", 1)],
  }),
];

// More than the 1,000 rows one request returns, so the library is read in two pages.
export const bigLibraryRows = () => [
  ...libraryRows(),
  ...Array.from({ length: 1_200 }, (_, index) =>
    exerciseRow(1_000 + index, {
      name: `Library exercise ${1_000 + index}`,
      equipment: "barbell",
      exercise_muscles: [muscleEntry("quads", "primary", 1)],
    }),
  ),
];

// The same routine with its one day on another weekday and under another name, so today is a rest day or not.
export const routineWithDay = (weekday: number, name: string) => {
  const routine = activeRoutineRow();
  const [day] = routine.routine_days;
  return { ...routine, routine_days: [{ ...day, weekday, name }] };
};

// A live `workout_sessions` row, finished unless `ended_at` is overridden, in the shape both the week read and
// the session in progress read take. It holds no sets.
export const sessionRow = (overrides: Record<string, unknown> = {}) => ({
  id: "00000000-0000-4000-8000-0000000000e2",
  local_date: fixedToday,
  routine_day_id: exerciseId(900),
  started_at: "2026-10-14T08:00:00+00:00",
  ended_at: "2026-10-14T09:00:00+00:00",
  deleted_at: null,
  note: null,
  routine_days: null,
  workout_sets: [],
  ...overrides,
});

// An accepted suggestion for today's Push: 3 sets of the row, as an accept stores it.
export const acceptedSuggestionRow = (overrides: Record<string, unknown> = {}) => ({
  id: "00000000-0000-4000-8000-0000000000f2",
  local_date: fixedToday,
  routine_day_id: exerciseId(900),
  exercises: [
    {
      id: exerciseId(700),
      position: 1,
      exercise_id: exerciseId(20),
      target_sets: 3,
      target_rir: 2,
      rep_min: 8,
      rep_max: 10,
      exercise: {
        id: exerciseId(20),
        name: "Barbell Row",
        equipment: "barbell",
        mechanic: "compound",
      },
      muscles: [muscleEntry("lats", "primary", 1)],
      snapshot: {
        version: 1,
        kind: "exercise",
        ref: exerciseId(20),
        name: "Barbell Row",
        equipment: "barbell",
        mechanic: "compound",
        muscleListVersion: 1,
        muscles: [muscleEntry("lats", "primary", 1)],
      },
    },
  ],
  reasons: { picks: [] },
  params_version: "keylow-suggest-v2",
  deleted_at: null,
  ...overrides,
});

export const trainingTables = (overrides: NonNullable<StubData["tables"]> = {}): StubData => ({
  tables: {
    profiles: [profileRow],
    workout_sets: backWeekSets(),
    routines: [activeRoutineRow()],
    training_goals: [goalsRow({ muscle_priority: { lats: 3, biceps: 2 } })],
    exercises: libraryRows(),
    workout_sessions: [],
    accepted_suggestions: [],
    ...overrides,
  },
});
