import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { weekPlanDays } from "../../src/training";

import type {
  WeekDayStatus,
  WeekPlanInput,
  WeekRoutine,
  WeekRoutineDay,
  WeekSession,
  WeekSet,
} from "../../src/training";

const WEEK_START = "2026-10-12";
const TIME_ZONE = "Europe/London";
const DATES = [
  "2026-10-12",
  "2026-10-13",
  "2026-10-14",
  "2026-10-15",
  "2026-10-16",
  "2026-10-17",
  "2026-10-18",
];
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

type DayPlan = Readonly<{
  /** Whether the routine plans a day on this weekday. */
  isPlanned: boolean;
  /** Whether a finished session is logged on this date, if it can be. */
  hasSession: boolean;
  workingSets: number;
  warmUpSets: number;
}>;

const anyDayPlan: fc.Arbitrary<DayPlan> = fc.record({
  isPlanned: fc.boolean(),
  hasSession: fc.boolean(),
  workingSets: fc.integer({ min: 0, max: 5 }),
  warmUpSets: fc.integer({ min: 0, max: 2 }),
});

const anyWeek = fc.record({
  days: fc.array(anyDayPlan, { minLength: 7, maxLength: 7 }),
  /** The index of the date the routine became active, or none. */
  activeFromIndex: fc.option(fc.integer({ min: 0, max: 7 }), { nil: undefined }),
  /** The index of today within the week, and an hour of it. */
  todayIndex: fc.integer({ min: 0, max: 6 }),
});

const setsOf = (workingSets: number, warmUpSets: number): WeekSet[] => [
  ...Array.from({ length: workingSets }, (): WeekSet => ({
    exercise_id: "exercise",
    set_type: "working",
    deleted_at: null,
  })),
  ...Array.from({ length: warmUpSets }, (): WeekSet => ({
    exercise_id: "exercise",
    set_type: "warmup",
    deleted_at: null,
  })),
];

type Week = Readonly<{
  input: WeekPlanInput;
  /** The session logged on each weekday, if any. */
  sessionByWeekday: readonly (WeekSession | null)[];
  dayPlans: readonly DayPlan[];
  activeFrom: string | undefined;
  today: string;
}>;

/** A week of a plan-follower: a session is on the date of its own routine day, or free on a rest date. */
const buildWeek = ({
  days,
  activeFromIndex,
  todayIndex,
}: {
  days: readonly DayPlan[];
  activeFromIndex: number | undefined;
  todayIndex: number;
}): Week => {
  const activeFrom = activeFromIndex === undefined ? undefined : DATES[activeFromIndex];
  const routineDays: WeekRoutineDay[] = WEEKDAYS.flatMap((weekday) =>
    days[weekday]?.isPlanned === true
      ? [
          {
            id: `day-${weekday}`,
            name: `Day ${weekday}`,
            position: weekday,
            weekday,
            exercises: [{ position: 0, exercise_id: "exercise", target_sets: 3 }],
          },
        ]
      : [],
  );
  const sessionByWeekday = WEEKDAYS.map((weekday): WeekSession | null => {
    const day = days[weekday];
    const date = DATES[weekday];
    if (day === undefined || date === undefined || !day.hasSession) {
      return null;
    }
    if (activeFrom !== undefined && date < activeFrom) {
      return null;
    }
    return {
      id: `session-${weekday}`,
      local_date: date,
      started_at: `${date}T18:00:00Z`,
      ended_at: `${date}T19:00:00Z`,
      routine_day_id: day.isPlanned ? `day-${weekday}` : null,
      deleted_at: null,
      sets: setsOf(day.workingSets, day.warmUpSets),
    };
  });
  const routine: WeekRoutine = {
    name: "Routine",
    days: routineDays,
    ...(activeFrom === undefined ? {} : { activeFrom }),
  };
  const today = DATES[todayIndex] ?? WEEK_START;
  return {
    input: {
      routine,
      sessions: sessionByWeekday.filter((session) => session !== null),
      now: `${today}T12:00:00+01:00`,
      tz: TIME_ZONE,
      weekStart: WEEK_START,
    },
    sessionByWeekday,
    dayPlans: days,
    activeFrom,
    today,
  };
};

/** The existing rule for a plan-follower's day, written out plainly. */
const plainStatusOf = (week: Week, weekday: number): WeekDayStatus => {
  const date = DATES[weekday] ?? WEEK_START;
  const isPlanned = week.dayPlans[weekday]?.isPlanned === true;
  const hasSession = week.sessionByWeekday[weekday] !== null;
  if (isPlanned) {
    if (hasSession) {
      return "logged";
    }
    if (week.activeFrom !== undefined && date < week.activeFrom) {
      return "rest";
    }
    if (date < week.today) {
      return "missed";
    }
    return date === week.today ? "today" : "planned";
  }
  return hasSession ? "extra" : "rest";
};

describe("weekPlanDays, for a week that follows the plan", () => {
  it("should read every day as the plain rule does, and make up no day", () => {
    fc.assert(
      fc.property(anyWeek, (generated) => {
        const week = buildWeek(generated);

        const plan = weekPlanDays(week.input);

        for (const weekday of WEEKDAYS) {
          const day = plan.days[weekday];
          const session = week.sessionByWeekday[weekday] ?? null;
          expect(day?.madeUpBy).toBeNull();
          expect(day?.status).toBe(plainStatusOf(week, weekday));
          expect(day?.sessions).toStrictEqual(session === null ? [] : [session]);
          expect(day?.setsLogged).toBe(
            session === null ? 0 : (week.dayPlans[weekday]?.workingSets ?? 0),
          );
        }
      }),
    );
  });

  it("should give the same week whatever order the sessions come in", () => {
    fc.assert(
      fc.property(anyWeek, (generated) => {
        const week = buildWeek(generated);

        const reversed = weekPlanDays({
          ...week.input,
          sessions: [...week.input.sessions].reverse(),
        });

        expect(reversed.days).toStrictEqual(weekPlanDays(week.input).days);
      }),
    );
  });
});
