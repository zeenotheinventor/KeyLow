import { describe, expect, it } from "vitest";

import {
  dayOf,
  FRIDAY,
  goldenFinishedThursdaySession,
  goldenMondaySession,
  goldenOpenThursdaySession,
  goldenRoutine,
  goldenTimeZone,
  goldenTuesdaySession,
  goldenWeekStart,
  legsDayId,
  MONDAY,
  pullDayId,
  pushMondayDayId,
  romanianDeadliftId,
  SATURDAY,
  sessionOn,
  squatId,
  SUNDAY,
  THURSDAY,
  TUESDAY,
  WEDNESDAY,
  workingSets,
} from "./weekPlanRows";
import { weekCaption, weekPlanDays } from "../../src/training";

import type { WeekPlan, WeekPlanInput, WeekRoutine } from "../../src/training";

const THURSDAY_BEFORE_LEGS = "2026-10-15T17:55:00+01:00";
const THURSDAY_MID_LEGS = "2026-10-15T19:00:00+01:00";
const THURSDAY_AFTER_LEGS = "2026-10-15T19:01:00+01:00";
const SUNDAY_EVENING = "2026-10-18T20:00:00+01:00";

/** A routine day with no weekday. */
const anyDay = {
  id: "00000003-0000-4000-8000-000000000009",
  name: "Arms",
  position: 4,
  weekday: null,
  exercises: [{ position: 0, exercise_id: squatId, target_sets: 4 }],
};
const routineWithAnyDay: WeekRoutine = {
  name: goldenRoutine.name,
  days: [anyDay, ...goldenRoutine.days],
};

const goldenWeekPlan = (overrides: Partial<WeekPlanInput> = {}): WeekPlan =>
  weekPlanDays({
    routine: goldenRoutine,
    sessions: [goldenMondaySession, goldenTuesdaySession],
    now: THURSDAY_BEFORE_LEGS,
    tz: goldenTimeZone,
    weekStart: goldenWeekStart,
    ...overrides,
  });

const statusesOf = (plan: WeekPlan): string[] => plan.days.map((day) => day.status);

describe("weekPlanDays", () => {
  describe("the golden week at Thursday 17:55 in Europe/London", () => {
    const plan = goldenWeekPlan();

    it("should list the seven days from Monday 12 to Sunday 18 October", () => {
      expect(plan.days.map((day) => [day.weekday, day.date])).toStrictEqual([
        [0, "2026-10-12"],
        [1, "2026-10-13"],
        [2, "2026-10-14"],
        [3, "2026-10-15"],
        [4, "2026-10-16"],
        [5, "2026-10-17"],
        [6, "2026-10-18"],
      ]);
    });

    it("should read Monday and Tuesday logged, Wednesday rest, Thursday today, Friday rest, Saturday planned and Sunday rest", () => {
      expect(statusesOf(plan)).toStrictEqual([
        "logged",
        "logged",
        "rest",
        "today",
        "rest",
        "planned",
        "rest",
      ]);
    });

    it("should mark Thursday as today and no other day", () => {
      expect(plan.days.map((day) => day.isToday)).toStrictEqual([
        false,
        false,
        false,
        true,
        false,
        false,
        false,
      ]);
    });

    it("should count the working sets logged each day, leaving the warm-up out", () => {
      expect(plan.days.map((day) => day.setsLogged)).toStrictEqual([16, 17, 0, 0, 0, 0, 0]);
    });

    it("should count the sets the routine plans each day", () => {
      expect(plan.days.map((day) => day.setsPlanned)).toStrictEqual([16, 15, 0, 16, 0, 16, 0]);
    });

    it("should name Legs on Thursday, the third of the routine's four days, with 5 exercises and 16 sets", () => {
      const legs = dayOf(plan, THURSDAY).plannedDay;

      expect(legs).toMatchObject({
        id: "00000003-0000-4000-8000-000000000003",
        name: "Legs",
        dayNumber: 3,
        setCount: 16,
      });
      expect(legs?.exercises).toHaveLength(5);
    });

    it("should hold no planned day on Wednesday, Friday and Sunday", () => {
      expect(
        [WEDNESDAY, FRIDAY, SUNDAY].map((index) => dayOf(plan, index).plannedDay),
      ).toStrictEqual([null, null, null]);
    });

    it("should carry the sessions of each date", () => {
      expect(plan.days.map((day) => day.sessions.length)).toStrictEqual([1, 1, 0, 0, 0, 0, 0]);
    });

    it("should name the routine and count its four days", () => {
      expect([plan.routineName, plan.routineDayCount]).toStrictEqual(["Push Pull Legs", 4]);
    });
  });

  describe("Thursday during and after Legs", () => {
    it("should read Thursday in progress with 8 of 16 sets while the session is open", () => {
      const plan = goldenWeekPlan({
        sessions: [goldenMondaySession, goldenTuesdaySession, goldenOpenThursdaySession],
        now: THURSDAY_MID_LEGS,
      });
      const thursday = dayOf(plan, THURSDAY);

      expect([thursday.status, thursday.setsLogged, thursday.setsPlanned]).toStrictEqual([
        "in_progress",
        8,
        16,
      ]);
    });

    it("should read Thursday logged once the session is finished", () => {
      const plan = goldenWeekPlan({
        sessions: [goldenMondaySession, goldenTuesdaySession, goldenFinishedThursdaySession],
        now: THURSDAY_AFTER_LEGS,
      });

      expect(dayOf(plan, THURSDAY).status).toBe("logged");
    });

    it("should read a day in progress when a finished session and an open one share it", () => {
      const morning = sessionOn(1, "2026-10-15", { routine_day_id: legsDayId });
      const evening = sessionOn(2, "2026-10-15", { ended_at: null });

      const plan = goldenWeekPlan({ sessions: [morning, evening], now: THURSDAY_MID_LEGS });

      expect(dayOf(plan, THURSDAY).status).toBe("in_progress");
    });

    it("should read a rest day in progress when a session with no routine day is open on it", () => {
      const plan = goldenWeekPlan({
        sessions: [sessionOn(1, "2026-10-14", { ended_at: null })],
        now: "2026-10-14T19:00:00+01:00",
      });

      expect(dayOf(plan, WEDNESDAY).status).toBe("in_progress");
    });
  });

  describe("Sunday 20:00", () => {
    const plan = goldenWeekPlan({
      sessions: [goldenMondaySession, goldenTuesdaySession, goldenFinishedThursdaySession],
      now: SUNDAY_EVENING,
    });

    it("should read Saturday missed, not planned, when nothing was logged on it", () => {
      expect(dayOf(plan, SATURDAY).status).toBe("missed");
    });

    it("should read the whole week around the three sessions", () => {
      expect(statusesOf(plan)).toStrictEqual([
        "logged",
        "logged",
        "rest",
        "logged",
        "rest",
        "missed",
        "rest",
      ]);
    });

    it("should keep Sunday, which has no planned day, as rest and mark it as today", () => {
      expect([dayOf(plan, SUNDAY).status, dayOf(plan, SUNDAY).isToday]).toStrictEqual([
        "rest",
        true,
      ]);
    });
  });

  describe("the day boundary", () => {
    it("should read a planned day today until its day is over and missed after it", () => {
      const beforeMidnight = goldenWeekPlan({ sessions: [], now: "2026-10-15T23:59:00+01:00" });
      const afterMidnight = goldenWeekPlan({ sessions: [], now: "2026-10-16T00:01:00+01:00" });

      expect([
        dayOf(beforeMidnight, THURSDAY).status,
        dayOf(afterMidnight, THURSDAY).status,
      ]).toStrictEqual(["today", "missed"]);
    });

    it("should read the planned days after today planned and the ones before it missed", () => {
      const plan = goldenWeekPlan({ sessions: [], now: "2026-10-15T09:00:00+01:00" });

      expect(statusesOf(plan)).toStrictEqual([
        "missed",
        "missed",
        "rest",
        "today",
        "rest",
        "planned",
        "rest",
      ]);
    });

    it("should read every planned day of a week that has not started planned", () => {
      const plan = goldenWeekPlan({ sessions: [], now: "2026-10-11T20:00:00+01:00" });

      expect(statusesOf(plan)).toStrictEqual([
        "planned",
        "planned",
        "rest",
        "planned",
        "rest",
        "planned",
        "rest",
      ]);
    });

    it("should read every planned day of a week that is over missed", () => {
      const plan = goldenWeekPlan({ sessions: [], now: "2026-10-26T09:00:00+00:00" });

      expect(statusesOf(plan)).toStrictEqual([
        "missed",
        "missed",
        "rest",
        "missed",
        "rest",
        "missed",
        "rest",
      ]);
    });
  });

  describe("the time zone", () => {
    const nextWeekStart = "2026-10-19";
    // 00:30 on Monday 19 October in Europe/London (BST) is still Sunday 18 October in UTC.
    const mondayHalfPastMidnight = "2026-10-18T23:30:00Z";

    it("should take today from the zone, so 00:30 on Monday is Monday and not Sunday", () => {
      const plan = weekPlanDays({
        routine: goldenRoutine,
        sessions: [],
        now: mondayHalfPastMidnight,
        tz: goldenTimeZone,
        weekStart: nextWeekStart,
      });

      expect([dayOf(plan, MONDAY).status, dayOf(plan, MONDAY).isToday]).toStrictEqual([
        "today",
        true,
      ]);
    });

    it("should take today from the zone for the same moment in Los Angeles, where it is still Sunday", () => {
      const plan = weekPlanDays({
        routine: goldenRoutine,
        sessions: [],
        now: mondayHalfPastMidnight,
        tz: "America/Los_Angeles",
        weekStart: nextWeekStart,
      });

      expect(dayOf(plan, MONDAY).status).toBe("planned");
    });

    it("should put a session logged at 00:30 on Monday on Monday, not on the Sunday of its UTC date", () => {
      const justAfterMidnight = sessionOn(1, "2026-10-19", {
        started_at: mondayHalfPastMidnight,
        ended_at: "2026-10-19T00:20:00+01:00",
      });
      const planFor = (weekStart: string) =>
        weekPlanDays({
          routine: goldenRoutine,
          sessions: [justAfterMidnight],
          now: "2026-10-19T12:00:00+01:00",
          tz: goldenTimeZone,
          weekStart,
        });

      const newWeek = planFor(nextWeekStart);
      const oldWeek = planFor(goldenWeekStart);

      expect(dayOf(newWeek, MONDAY).sessions).toHaveLength(1);
      expect(dayOf(oldWeek, SUNDAY).sessions).toHaveLength(0);
      expect(dayOf(oldWeek, SUNDAY).status).toBe("rest");
    });
  });

  describe("what counts as logged", () => {
    it("should read a session on a rest day extra", () => {
      const plan = goldenWeekPlan({
        sessions: [sessionOn(1, "2026-10-14", { sets: workingSets(squatId, 4) })],
      });
      const wednesday = dayOf(plan, WEDNESDAY);

      expect([wednesday.status, wednesday.setsLogged, wednesday.setsPlanned]).toStrictEqual([
        "extra",
        4,
        0,
      ]);
    });

    it("should read a session of a day that is not in the routine on a rest day extra", () => {
      const plan = goldenWeekPlan({
        sessions: [
          sessionOn(1, "2026-10-14", { routine_day_id: "00000003-0000-4000-8000-0000000000ff" }),
        ],
      });

      expect(dayOf(plan, WEDNESDAY).status).toBe("extra");
    });

    it("should read two sessions on one planned day as one logged day", () => {
      const first = sessionOn(1, "2026-10-12", { sets: workingSets(squatId, 3) });
      const second = sessionOn(2, "2026-10-12", {
        started_at: "2026-10-12T20:00:00Z",
        ended_at: "2026-10-12T20:30:00Z",
        sets: workingSets(romanianDeadliftId, 2),
      });

      const plan = goldenWeekPlan({ sessions: [first, second] });
      const monday = dayOf(plan, MONDAY);

      expect(statusesOf(plan).filter((status) => status === "logged")).toHaveLength(1);
      expect([monday.status, monday.sessions.length, monday.setsLogged]).toStrictEqual([
        "logged",
        2,
        5,
      ]);
    });

    it("should count a session with no routine day as the planned day of its date", () => {
      const plan = goldenWeekPlan({
        sessions: [sessionOn(1, "2026-10-15")],
        now: "2026-10-15T20:00:00+01:00",
      });

      expect(dayOf(plan, THURSDAY).status).toBe("logged");
    });

    it("should count a session of a planned day as that day whichever date it was logged on", () => {
      const legsOnWednesday = sessionOn(1, "2026-10-14", { routine_day_id: legsDayId });

      const plan = goldenWeekPlan({
        sessions: [legsOnWednesday],
        now: "2026-10-16T09:00:00+01:00",
      });

      expect([dayOf(plan, WEDNESDAY).status, dayOf(plan, THURSDAY).status]).toStrictEqual([
        "logged",
        "logged",
      ]);
      expect(dayOf(plan, WEDNESDAY).plannedDay).toBeNull();
    });

    it("should not count a session still open as logging the planned day it names", () => {
      const openLegsOnWednesday = sessionOn(1, "2026-10-14", {
        routine_day_id: legsDayId,
        ended_at: null,
      });

      const plan = goldenWeekPlan({
        sessions: [openLegsOnWednesday],
        now: "2026-10-16T09:00:00+01:00",
      });

      expect(dayOf(plan, THURSDAY).status).toBe("missed");
    });

    it("should credit a Pull session logged on Monday to Pull, leaving Monday's Push missed", () => {
      const pullOnMonday = sessionOn(1, "2026-10-12", {
        routine_day_id: pullDayId,
        sets: workingSets(squatId, 3),
      });

      const plan = goldenWeekPlan({ sessions: [pullOnMonday] });

      expect(statusesOf(plan)).toStrictEqual([
        "missed",
        "logged",
        "rest",
        "today",
        "rest",
        "planned",
        "rest",
      ]);
      expect([dayOf(plan, MONDAY).sessions, dayOf(plan, MONDAY).setsLogged]).toStrictEqual([
        [pullOnMonday],
        3,
      ]);
      expect(weekCaption(plan)).toStrictEqual({
        plannedDayCount: 4,
        loggedDayCount: 1,
        loggedSessionCount: 1,
      });
    });

    it("should read Monday today, not logged, when the Pull session of the swap is on Monday itself", () => {
      const pullOnMonday = sessionOn(1, "2026-10-12", { routine_day_id: pullDayId });

      const plan = goldenWeekPlan({ sessions: [pullOnMonday], now: "2026-10-12T19:30:00+01:00" });

      expect([dayOf(plan, MONDAY).status, dayOf(plan, TUESDAY).status]).toStrictEqual([
        "today",
        "logged",
      ]);
    });

    it("should credit an unplaced day logged on a planned date to the unplaced day only", () => {
      const armsOnMonday = sessionOn(1, "2026-10-12", { routine_day_id: anyDay.id });

      const plan = goldenWeekPlan({ routine: routineWithAnyDay, sessions: [armsOnMonday] });

      expect(dayOf(plan, MONDAY).status).toBe("missed");
      expect(plan.unplaced.map((unplacedDay) => unplacedDay.logged)).toStrictEqual([true]);
      expect(weekCaption(plan)).toStrictEqual({
        plannedDayCount: 5,
        loggedDayCount: 1,
        loggedSessionCount: 1,
      });
    });

    it("should read a past date in progress for good when its session was never finished", () => {
      const neverFinished = sessionOn(1, "2026-10-12", { ended_at: null });

      const plan = goldenWeekPlan({ sessions: [neverFinished], now: SUNDAY_EVENING });

      expect(dayOf(plan, MONDAY).status).toBe("in_progress");
      expect(weekCaption(plan)).toStrictEqual({
        plannedDayCount: 4,
        loggedDayCount: 0,
        loggedSessionCount: 0,
      });
    });

    it("should leave a soft-deleted session out, so its day reads missed", () => {
      const deleted = { ...goldenMondaySession, deleted_at: "2026-10-12T20:00:00+01:00" };

      const plan = goldenWeekPlan({ sessions: [deleted, goldenTuesdaySession] });

      expect([dayOf(plan, MONDAY).status, dayOf(plan, MONDAY).sessions]).toStrictEqual([
        "missed",
        [],
      ]);
    });

    it("should leave warm-ups and soft-deleted sets out of the sets logged and count drop sets", () => {
      const session = sessionOn(1, "2026-10-12", {
        sets: [
          ...workingSets(squatId, 2),
          { exercise_id: squatId, set_type: "warmup", deleted_at: null },
          { exercise_id: squatId, set_type: "working", deleted_at: "2026-10-12T19:30:00Z" },
          { exercise_id: squatId, set_type: "drop", deleted_at: null },
        ],
      });

      expect(dayOf(goldenWeekPlan({ sessions: [session] }), MONDAY).setsLogged).toBe(3);
    });

    it("should leave a session of another week out, so it does not log a day of this one", () => {
      const lastSunday = sessionOn(1, "2026-10-11", { routine_day_id: pushMondayDayId });

      const plan = goldenWeekPlan({ sessions: [lastSunday] });

      expect([dayOf(plan, MONDAY).status, dayOf(plan, MONDAY).sessions]).toStrictEqual([
        "missed",
        [],
      ]);
    });
  });

  describe("the routine's days", () => {
    const reversedRoutine: WeekRoutine = {
      name: goldenRoutine.name,
      days: [...goldenRoutine.days].reverse(),
    };

    it("should place the days by weekday and number them in the week's order whatever order they come in", () => {
      const plan = goldenWeekPlan({ routine: reversedRoutine });

      expect(plan.days.map((day) => day.plannedDay?.dayNumber ?? null)).toStrictEqual([
        1,
        2,
        null,
        3,
        null,
        4,
        null,
      ]);
    });

    it("should list the exercises of a day in position order", () => {
      const legs = goldenRoutine.days.find((day) => day.id === legsDayId);
      const shuffled: WeekRoutine = {
        name: goldenRoutine.name,
        days: goldenRoutine.days.map((day) =>
          day === legs ? { ...day, exercises: [...day.exercises].reverse() } : day,
        ),
      };

      const plan = goldenWeekPlan({ routine: shuffled });

      expect(
        dayOf(plan, THURSDAY).plannedDay?.exercises.map((exercise) => exercise.targetSets),
      ).toStrictEqual([3, 3, 3, 3, 4]);
    });

    it("should list a day with no weekday as unplaced, after the dated ones, and never on a date", () => {
      const plan = goldenWeekPlan({
        routine: routineWithAnyDay,
      });

      expect(plan.unplaced).toStrictEqual([
        {
          plannedDay: {
            id: anyDay.id,
            name: "Arms",
            dayNumber: 5,
            exercises: [{ exerciseId: squatId, targetSets: 4 }],
            setCount: 4,
          },
          logged: false,
        },
      ]);
      expect(plan.routineDayCount).toBe(5);
      expect(plan.days.map((day) => day.plannedDay?.name)).toStrictEqual([
        "Push",
        "Pull",
        undefined,
        "Legs",
        undefined,
        "Push",
        undefined,
      ]);
    });

    it("should read a session of an unplaced day as logging its date, not as an extra session", () => {
      const armsOnWednesday = sessionOn(1, "2026-10-14", { routine_day_id: anyDay.id });

      const plan = goldenWeekPlan({
        routine: routineWithAnyDay,
        sessions: [armsOnWednesday],
      });

      expect(dayOf(plan, WEDNESDAY).status).toBe("logged");
      expect(plan.unplaced.map((unplacedDay) => unplacedDay.logged)).toStrictEqual([true]);
    });

    it("should read every day a rest day, and a session an extra one, when there is no routine", () => {
      const plan = goldenWeekPlan({
        routine: null,
        sessions: [goldenMondaySession, goldenTuesdaySession],
      });

      expect(statusesOf(plan)).toStrictEqual([
        "extra",
        "extra",
        "rest",
        "rest",
        "rest",
        "rest",
        "rest",
      ]);
      expect([plan.routineName, plan.routineDayCount, plan.unplaced]).toStrictEqual([null, 0, []]);
    });
  });

  describe("the rules it refuses", () => {
    it("should refuse a week that does not start on a Monday", () => {
      expect(() => goldenWeekPlan({ weekStart: "2026-10-13" })).toThrow(
        new RangeError("A week must start on a Monday, written YYYY-MM-DD"),
      );
    });

    it("should refuse a time zone that is not an IANA name", () => {
      expect(() => goldenWeekPlan({ tz: "+01:00" })).toThrow(
        new RangeError("A week's time zone must be an IANA zone name"),
      );
    });

    it("should refuse a moment with no zone designator", () => {
      expect(() => goldenWeekPlan({ now: "2026-10-15T17:55:00" })).toThrow(
        new RangeError("The moment to compute at must be an ISO timestamp with a zone"),
      );
    });

    it("should refuse a session whose local date is not a calendar day", () => {
      expect(() => goldenWeekPlan({ sessions: [sessionOn(1, "2026-02-30")] })).toThrow(
        new RangeError("A session's local date must be a calendar day written YYYY-MM-DD"),
      );
    });

    it("should refuse a weekday out of range", () => {
      const routine: WeekRoutine = {
        name: "Bad",
        days: [{ id: pullDayId, name: "Pull", position: 0, weekday: 7, exercises: [] }],
      };

      expect(() => goldenWeekPlan({ routine })).toThrow(
        new RangeError("A routine day's weekday must be 0 (Monday) to 6 (Sunday) or null"),
      );
    });

    it("should refuse two days on one weekday", () => {
      const [first] = goldenRoutine.days;
      const routine: WeekRoutine = {
        name: "Bad",
        days: first === undefined ? [] : [first, { ...first, id: pullDayId }],
      };

      expect(() => goldenWeekPlan({ routine })).toThrow(
        new RangeError("A routine has at most one day per weekday"),
      );
    });
  });
});

describe("weekCaption", () => {
  it("should read 2 of 4 done and 2 sessions for the golden week on Thursday before Legs", () => {
    expect(weekCaption(goldenWeekPlan())).toStrictEqual({
      plannedDayCount: 4,
      loggedDayCount: 2,
      loggedSessionCount: 2,
    });
  });

  it("should read 3 of 4 done once Thursday's Legs is finished", () => {
    const plan = goldenWeekPlan({
      sessions: [goldenMondaySession, goldenTuesdaySession, goldenFinishedThursdaySession],
      now: THURSDAY_AFTER_LEGS,
    });

    expect(weekCaption(plan)).toStrictEqual({
      plannedDayCount: 4,
      loggedDayCount: 3,
      loggedSessionCount: 3,
    });
  });

  it("should count neither an open session as done nor as a logged session", () => {
    const plan = goldenWeekPlan({
      sessions: [goldenMondaySession, goldenTuesdaySession, goldenOpenThursdaySession],
      now: THURSDAY_MID_LEGS,
    });

    expect(weekCaption(plan)).toStrictEqual({
      plannedDayCount: 4,
      loggedDayCount: 2,
      loggedSessionCount: 2,
    });
  });

  it("should count a day with two sessions once among the days done and twice among the sessions", () => {
    const plan = goldenWeekPlan({
      sessions: [
        sessionOn(1, "2026-10-12", { routine_day_id: pushMondayDayId }),
        sessionOn(2, "2026-10-12", { started_at: "2026-10-12T20:00:00Z" }),
      ],
    });

    expect(weekCaption(plan)).toStrictEqual({
      plannedDayCount: 4,
      loggedDayCount: 1,
      loggedSessionCount: 2,
    });
  });

  it("should not count an extra session as a planned day done, though it is a session logged", () => {
    const plan = goldenWeekPlan({ sessions: [sessionOn(1, "2026-10-14")] });

    expect(weekCaption(plan)).toStrictEqual({
      plannedDayCount: 4,
      loggedDayCount: 0,
      loggedSessionCount: 1,
    });
  });

  it("should count a planned day logged on another date once", () => {
    const plan = goldenWeekPlan({
      sessions: [sessionOn(1, "2026-10-14", { routine_day_id: legsDayId })],
      now: "2026-10-16T09:00:00+01:00",
    });

    expect(weekCaption(plan).loggedDayCount).toBe(1);
  });

  it("should count the sessions logged for a week with no routine", () => {
    const plan = goldenWeekPlan({
      routine: null,
      sessions: [goldenMondaySession, goldenTuesdaySession],
    });

    expect(weekCaption(plan)).toStrictEqual({
      plannedDayCount: 0,
      loggedDayCount: 0,
      loggedSessionCount: 2,
    });
  });
});

describe("one session credits at most one day", () => {
  const arrangements: [string, Partial<WeekPlanInput>][] = [
    ["the golden week", { sessions: [goldenMondaySession, goldenTuesdaySession] }],
    [
      "a Pull session on Monday",
      { sessions: [sessionOn(1, "2026-10-12", { routine_day_id: pullDayId })] },
    ],
    [
      "Legs logged on Wednesday",
      { sessions: [sessionOn(1, "2026-10-14", { routine_day_id: legsDayId })] },
    ],
    [
      "two sessions on Monday",
      {
        sessions: [
          sessionOn(1, "2026-10-12"),
          sessionOn(2, "2026-10-12", { routine_day_id: pushMondayDayId }),
        ],
      },
    ],
    [
      "an unplaced day on Monday",
      {
        routine: routineWithAnyDay,
        sessions: [sessionOn(1, "2026-10-12", { routine_day_id: anyDay.id })],
      },
    ],
    [
      "a free session on every day",
      {
        sessions: ["12", "13", "14", "15", "16", "17", "18"].map((day, index) =>
          sessionOn(index + 1, `2026-10-${day}`),
        ),
      },
    ],
  ];

  it.each(arrangements)(
    "should count no more days done than sessions logged for %s",
    (_name, input) => {
      const caption = weekCaption(goldenWeekPlan({ now: SUNDAY_EVENING, ...input }));

      expect(caption.loggedDayCount).toBeLessThanOrEqual(caption.loggedSessionCount);
    },
  );
});
