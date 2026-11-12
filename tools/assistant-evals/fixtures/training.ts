// The synthetic training history of the eval user. Every exercise, load, rep count and note here is made up
// for the evals, and none is copied from a person. The exercises are named by their library `source_ref`,
// because their ids are made when the migration runs, and the one custom exercise by its name.
//
// The sessions are dated back from the anchor date the diary uses: 1 day before is yesterday. Everything is
// a number of days before the anchor, never a date, so the history is the same on any day it is written.
//
// There are three sessions a week for six weeks, each exercise once a week at a fixed number of days before
// the anchor. That makes every Monday to Sunday week hold exactly one session of each kind, whichever
// weekday the anchor falls on, so the weekly trend of an exercise reads like the list of its loads below.
//
// The story the questions can ask about:
// - the bench press stops improving: its load rises for three weeks and then stays, with the effort rising
//   to meet it, so the last three weeks have no gain;
// - the squat improves every week;
// - there is little back work: two light sets of one row a week;
// - the quads were trained hard yesterday, so their heat is high.
import { addCalendarDays } from "@keylow/core/dates";
import { EQUIPMENT } from "@keylow/core/training";

import type { GoalAnswers, SetType } from "@keylow/core/training";

export const TRAINING_WEEK_COUNT = 6;

const DAYS_PER_WEEK = 7;
const MILLISECONDS_PER_MINUTE = 60_000;
const SET_SPACING_MINUTES = 2;

export const LIBRARY_EXERCISE_KEYS = [
  "squat",
  "legPress",
  "romanianDeadlift",
  "benchPress",
  "overheadPress",
  "tricepsPushdown",
  "barbellCurl",
  "seatedRow",
] as const;

export type LibraryExercise = (typeof LIBRARY_EXERCISE_KEYS)[number];

/** The library exercises the history uses, by the `source_ref` the exercise library gives them. */
export const LIBRARY_EXERCISES: Readonly<Record<LibraryExercise, string>> = {
  squat: "Barbell_Full_Squat",
  legPress: "Leg_Press",
  romanianDeadlift: "Romanian_Deadlift",
  benchPress: "Barbell_Bench_Press_-_Medium_Grip",
  overheadPress: "Standing_Military_Press",
  tricepsPushdown: "Triceps_Pushdown",
  barbellCurl: "Barbell_Curl",
  seatedRow: "Seated_Cable_Rows",
};

/** The eval user's own exercise. It is made by the writer, so it has a name and no `source_ref`. */
export const CUSTOM_EXERCISE = {
  name: "Eval face pull",
  equipment: "cable",
  muscles: [
    { muscle_id: "delt_rear", role: "primary" },
    { muscle_id: "traps_mid", role: "secondary" },
  ],
} as const;

export type TrainingExercise = LibraryExercise | "facePull";

export type PlannedSet = Readonly<{
  setType: SetType;
  loadKg: number;
  reps: number;
  /** Null on a warm-up, which has no effort. */
  rir: number | null;
}>;

export type PlannedExercise = Readonly<{
  exercise: TrainingExercise;
  sets: readonly PlannedSet[];
}>;

export type PlannedSession = Readonly<{
  /** Which of the six weeks, 0 the oldest. */
  week: number;
  /** The number of days before the anchor date: 1 is yesterday. */
  daysBefore: number;
  /** The time of day the session starts, in UTC, `HH:MM`. */
  startTime: string;
  exercises: readonly PlannedExercise[];
  note: string | null;
}>;

export type ExerciseSlot = Readonly<{
  exercise: TrainingExercise;
  /** The heaviest load of each week, oldest first. */
  loadsKg: readonly number[];
  /** The reps of each working set, in order. */
  reps: readonly number[];
  /** The reps in reserve of the working sets: one for every week, or one for each week, oldest first. */
  rir: number | readonly number[];
  /** A lighter set of 5 first, which the trend and the heat both ignore. */
  warmUp?: true;
}>;

export type SessionSlot = Readonly<{
  /** The number of days before the anchor in the latest week. The earlier weeks are 7 days apart. */
  daysBefore: number;
  startTime: string;
  exercises: readonly ExerciseSlot[];
}>;

// Arms and back first, then push, then the lower body, which is what ends the history, yesterday.
export const SESSION_SLOTS: readonly SessionSlot[] = [
  {
    daysBefore: 5,
    startTime: "17:30",
    exercises: [
      {
        exercise: "barbellCurl",
        loadsKg: [30, 30, 32.5, 32.5, 35, 35],
        reps: [10, 10, 10],
        rir: 2,
      },
      // Light on purpose: this is the only back work of the week.
      { exercise: "seatedRow", loadsKg: [45, 45, 45, 50, 50, 50], reps: [12, 12], rir: 4 },
    ],
  },
  {
    daysBefore: 3,
    startTime: "18:00",
    exercises: [
      {
        exercise: "benchPress",
        loadsKg: [70, 72.5, 75, 75, 75, 75],
        reps: [5, 5, 5, 5],
        rir: [3, 2, 2, 1, 1, 0],
        warmUp: true,
      },
      {
        exercise: "overheadPress",
        loadsKg: [40, 40, 42.5, 42.5, 42.5, 42.5],
        reps: [8, 8, 8],
        rir: 2,
      },
      {
        exercise: "tricepsPushdown",
        loadsKg: [30, 32.5, 32.5, 35, 35, 37.5],
        reps: [12, 12, 12],
        rir: 2,
      },
      { exercise: "facePull", loadsKg: [15, 15, 17.5, 17.5, 17.5, 20], reps: [15, 15], rir: 2 },
    ],
  },
  {
    daysBefore: 1,
    startTime: "20:00",
    exercises: [
      {
        exercise: "squat",
        loadsKg: [100, 102.5, 105, 107.5, 110, 112.5],
        reps: [5, 5, 5, 5, 5],
        rir: 2,
        warmUp: true,
      },
      {
        exercise: "legPress",
        loadsKg: [160, 170, 170, 180, 180, 190],
        reps: [10, 10, 10, 10, 10],
        rir: 2,
      },
      {
        exercise: "romanianDeadlift",
        loadsKg: [80, 80, 85, 85, 90, 90],
        reps: [8, 8, 8],
        rir: 2,
      },
    ],
  },
];

// A note on one session, so a question about notes has one to find. Nothing in it is a health claim.
const NOTE_WEEK = 2;
const NOTE_SLOT_DAYS_BEFORE = 3;
const NOTE = "Eval note: a busy gym, so the order of the exercises was changed.";

const WARM_UP_SHARE_OF_LOAD = 0.6;
const WARM_UP_REPS = 5;
const SMALLEST_PLATE_KG = 2.5;

// Rounded to the smallest plate, so a warm-up is a load a bar can be loaded to.
const warmUpLoadKg = (loadKg: number): number =>
  Math.round((loadKg * WARM_UP_SHARE_OF_LOAD) / SMALLEST_PLATE_KG) * SMALLEST_PLATE_KG;

// A short list is a mistake in the plan, and a default would log a 0 kg set without a word.
const forWeek = (values: readonly number[], week: number, what: string): number => {
  const value = values[week];
  if (value === undefined) {
    throw new Error(`The training plan has no ${what} for week ${week}`);
  }
  return value;
};

const rirOfWeek = (rir: ExerciseSlot["rir"], week: number): number =>
  typeof rir === "number" ? rir : forWeek(rir, week, "RIR");

function exerciseOfWeek(slot: ExerciseSlot, week: number): PlannedExercise {
  const loadKg = forWeek(slot.loadsKg, week, `load of ${slot.exercise}`);
  const rir = rirOfWeek(slot.rir, week);
  const working = slot.reps.map((reps): PlannedSet => ({ setType: "working", loadKg, reps, rir }));
  return {
    exercise: slot.exercise,
    sets:
      slot.warmUp === undefined
        ? working
        : [
            { setType: "warmup", loadKg: warmUpLoadKg(loadKg), reps: WARM_UP_REPS, rir: null },
            ...working,
          ],
  };
}

/** The 18 sessions of the history, the oldest first. The newest, the lower body, was yesterday. */
export function trainingSessions(): readonly PlannedSession[] {
  return Array.from({ length: TRAINING_WEEK_COUNT }, (_, week) =>
    SESSION_SLOTS.map((slot): PlannedSession => ({
      week,
      daysBefore: slot.daysBefore + DAYS_PER_WEEK * (TRAINING_WEEK_COUNT - 1 - week),
      startTime: slot.startTime,
      exercises: slot.exercises.map((exercise) => exerciseOfWeek(exercise, week)),
      note: week === NOTE_WEEK && slot.daysBefore === NOTE_SLOT_DAYS_BEFORE ? NOTE : null,
    })),
  )
    .flat()
    .sort((first, second) => second.daysBefore - first.daysBefore);
}

/** The sets of a session in the order they are logged. */
export const setsOfSession = ({
  exercises,
}: PlannedSession): readonly (PlannedSet & {
  exercise: TrainingExercise;
})[] => exercises.flatMap(({ exercise, sets }) => sets.map((set) => ({ ...set, exercise })));

/** The calendar date, `YYYY-MM-DD`, of a number of days before the anchor date. 1 is yesterday. */
export const trainingDateOf = (anchorDate: string, daysBefore: number): string =>
  addCalendarDays(anchorDate, -daysBefore);

export type SessionMoments = Readonly<{
  /** The session's local day: the eval user's zone is UTC and no session crosses midnight. */
  localDate: string;
  startedAt: Date;
  /** One for each set of the session, in the order they are logged. */
  setTimes: readonly Date[];
  endedAt: Date;
}>;

/** When a session starts, when each of its sets is logged and when it ends. Every moment is in the past. */
export function sessionMoments(anchorDate: string, session: PlannedSession): SessionMoments {
  const localDate = trainingDateOf(anchorDate, session.daysBefore);
  const startedAt = new Date(`${localDate}T${session.startTime}:00Z`);
  const at = (position: number) =>
    new Date(startedAt.getTime() + position * SET_SPACING_MINUTES * MILLISECONDS_PER_MINUTE);
  const setCount = setsOfSession(session).length;
  return {
    localDate,
    startedAt,
    setTimes: Array.from({ length: setCount }, (_, index) => at(index + 1)),
    endedAt: at(setCount + 1),
  };
}

export type RoutinePlan = Readonly<{
  name: string;
  days: readonly Readonly<{
    /** 0 (Monday) to 6 (Sunday), or null for any day. */
    weekday: number | null;
    name: string;
    exercises: readonly Readonly<{
      exercise: TrainingExercise;
      sets: number;
      repMin: number;
      repMax: number;
      rir: number;
    }>[];
  }>[];
}>;

/** The routine that is active. It plans the back work the history does little of. */
export const ACTIVE_ROUTINE: RoutinePlan = {
  name: "Eval lower, push and arms",
  days: [
    {
      weekday: 0,
      name: "Lower",
      exercises: [
        { exercise: "squat", sets: 5, repMin: 3, repMax: 5, rir: 2 },
        { exercise: "legPress", sets: 4, repMin: 8, repMax: 12, rir: 2 },
        { exercise: "romanianDeadlift", sets: 3, repMin: 6, repMax: 8, rir: 2 },
      ],
    },
    {
      weekday: 2,
      name: "Push",
      exercises: [
        { exercise: "benchPress", sets: 4, repMin: 3, repMax: 5, rir: 2 },
        { exercise: "overheadPress", sets: 3, repMin: 6, repMax: 10, rir: 2 },
        { exercise: "tricepsPushdown", sets: 3, repMin: 10, repMax: 15, rir: 2 },
      ],
    },
    {
      weekday: 4,
      name: "Arms and back",
      exercises: [
        { exercise: "seatedRow", sets: 4, repMin: 8, repMax: 12, rir: 2 },
        { exercise: "barbellCurl", sets: 3, repMin: 8, repMax: 12, rir: 2 },
      ],
    },
  ],
};

/** The routine that was archived: an older plan the person moved on from. It is never active. */
export const ARCHIVED_ROUTINE: RoutinePlan = {
  name: "Eval old full body",
  days: [
    {
      weekday: null,
      name: "Full body",
      exercises: [
        { exercise: "squat", sets: 3, repMin: 8, repMax: 12, rir: 3 },
        { exercise: "benchPress", sets: 3, repMin: 8, repMax: 12, rir: 3 },
        { exercise: "seatedRow", sets: 3, repMin: 8, repMax: 12, rir: 3 },
      ],
    },
  ],
};

// Every kind of equipment but `other`, which the app calls a full gym.
const FULL_GYM = EQUIPMENT.filter((equipment) => equipment !== "other");

/** The goal the person had before. It is closed when the current one is saved. */
export const EARLIER_GOAL: GoalAnswers = {
  goal: "aesthetic",
  focus: ["chest", "arms"],
  days_per_week: 3,
  session_minutes: 60,
  equipment: FULL_GYM,
  experience: "intermediate",
};

/** The goal the person has now. */
export const CURRENT_GOAL: GoalAnswers = {
  goal: "strength",
  focus: [],
  days_per_week: 3,
  session_minutes: 75,
  equipment: FULL_GYM,
  experience: "intermediate",
};
