import { z } from "zod";

import { goldenLegsDay, goldenPullDay, goldenRoutineDays, goldenRoutineName } from "./routines";
import { setTypeSchema } from "../../src/schemas";
import goldenWeek from "../fixtures/training/goldenWeek.json";

import type { WeekPlan, WeekPlanDay, WeekRoutine, WeekSession, WeekSet } from "../../src/training";

/*
 * The golden week of KEY-353 as the rows the week plan reads: the Push Pull Legs routine, and its three
 * sessions (Monday and Tuesday finished, Thursday's Legs still open with 8 working sets and 2 warm-ups).
 */

export const goldenWeekStart = "2026-10-12";
export const goldenTimeZone = "Europe/London";

const fixtureSchema = z.object({
  exercises: z.array(z.object({ sourceRef: z.string(), id: z.string() })),
  sessions: z.array(
    z.object({
      id: z.string(),
      localDate: z.string(),
      startedAt: z.string(),
      endedAt: z.string().nullable(),
      routineDayId: z.string(),
    }),
  ),
  sets: z.array(z.object({ sessionId: z.string(), exercise: z.string(), setType: setTypeSchema })),
});

const fixture = fixtureSchema.parse(goldenWeek);

const exerciseIdOf = (sourceRef: string): string => {
  const exercise = fixture.exercises.find((candidate) => candidate.sourceRef === sourceRef);
  if (exercise === undefined) {
    throw new Error("The golden fixture names an exercise it does not hold");
  }
  return exercise.id;
};

export const goldenRoutine: WeekRoutine = { name: goldenRoutineName, days: goldenRoutineDays };

export const goldenSessions: WeekSession[] = fixture.sessions.map((session) => ({
  id: session.id,
  local_date: session.localDate,
  started_at: session.startedAt,
  ended_at: session.endedAt,
  routine_day_id: session.routineDayId,
  deleted_at: null,
  sets: fixture.sets
    .filter((set) => set.sessionId === session.id)
    .map((set) => ({
      exercise_id: exerciseIdOf(set.exercise),
      set_type: set.setType,
      deleted_at: null,
    })),
}));

const requireGoldenSession = (index: number): WeekSession => {
  const session = goldenSessions[index];
  if (session === undefined) {
    throw new Error("The golden week has no session there");
  }
  return session;
};

export const goldenMondaySession: WeekSession = requireGoldenSession(0);
export const goldenTuesdaySession: WeekSession = requireGoldenSession(1);
/** Thursday's Legs, open: 8 working sets of the 16 planned and 2 warm-ups. */
export const goldenOpenThursdaySession: WeekSession = requireGoldenSession(2);
/** The same Thursday session, finished at 19:00 local time. */
export const goldenFinishedThursdaySession: WeekSession = {
  ...goldenOpenThursdaySession,
  ended_at: "2026-10-15T19:00:00+01:00",
};

const requireValue = <Value>(value: Value | undefined): Value => {
  if (value === undefined) {
    throw new Error("The golden week has no such value");
  }
  return value;
};

export const pushMondayDayId: string = requireValue(goldenRoutineDays[0]).id;
export const pullDayId: string = goldenPullDay.id;
export const legsDayId: string = goldenLegsDay.id;
export const pushSaturdayDayId: string = requireValue(goldenRoutineDays[3]).id;

export const squatId: string = requireValue(goldenLegsDay.exercises[0]).exercise_id;
export const romanianDeadliftId: string = requireValue(goldenLegsDay.exercises[1]).exercise_id;
export const legPressId: string = requireValue(goldenLegsDay.exercises[2]).exercise_id;

/** A row id that `z.guid()` accepts, numbered so tests can tell sessions apart. */
const sessionRowId = (number: number): string =>
  `00000009-0000-4000-8000-${String(number).padStart(12, "0")}`;

export const workingSets = (exerciseId: string, count: number): WeekSet[] =>
  Array.from({ length: count }, () => ({
    exercise_id: exerciseId,
    set_type: "working",
    deleted_at: null,
  }));

/**
 * A finished live session of `local_date`, 18:00 to 19:00 UTC of that date, with no routine day and no
 * sets until the override gives them.
 */
export const sessionOn = (
  number: number,
  localDate: string,
  overrides: Partial<WeekSession> = {},
): WeekSession => ({
  id: sessionRowId(number),
  local_date: localDate,
  started_at: `${localDate}T18:00:00Z`,
  ended_at: `${localDate}T19:00:00Z`,
  routine_day_id: null,
  deleted_at: null,
  sets: [],
  ...overrides,
});

export const MONDAY = 0;
export const TUESDAY = 1;
export const WEDNESDAY = 2;
export const THURSDAY = 3;
export const FRIDAY = 4;
export const SATURDAY = 5;
export const SUNDAY = 6;

/** The day of the week at that index, 0 (Monday) to 6 (Sunday). */
export const dayOf = (plan: WeekPlan, index: number): WeekPlanDay => requireValue(plan.days[index]);
