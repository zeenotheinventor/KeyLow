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
  pushSaturdayDayId,
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
import { latestFinishedSession, weekCaption, weekPlanDays } from "../../src/training";

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

    it("should read a day done on a rest day as an extra day, and leave its own date planned", () => {
      const legsOnWednesday = sessionOn(1, "2026-10-14", {
        routine_day_id: legsDayId,
        sets: workingSets(squatId, 4),
      });

      const plan = goldenWeekPlan({
        sessions: [legsOnWednesday],
        now: "2026-10-14T20:00:00+01:00",
      });

      expect([dayOf(plan, WEDNESDAY).status, dayOf(plan, THURSDAY).status]).toStrictEqual([
        "extra",
        "planned",
      ]);
      expect(dayOf(plan, WEDNESDAY).sessions).toStrictEqual([legsOnWednesday]);
      expect(dayOf(plan, WEDNESDAY).plannedDay).toBeNull();
      expect(weekCaption(plan).loggedDayCount).toBe(0);
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

    it("should fill Monday's slot with a Pull session logged on Monday, carrying its sets, and leave Tuesday's Pull planned", () => {
      const pullOnMonday = sessionOn(1, "2026-10-12", {
        routine_day_id: pullDayId,
        sets: workingSets(squatId, 3),
      });

      const plan = goldenWeekPlan({ sessions: [pullOnMonday], now: "2026-10-12T19:30:00+01:00" });

      expect(statusesOf(plan)).toStrictEqual([
        "logged",
        "planned",
        "rest",
        "planned",
        "rest",
        "planned",
        "rest",
      ]);
      expect([dayOf(plan, MONDAY).sessions, dayOf(plan, MONDAY).setsLogged]).toStrictEqual([
        [pullOnMonday],
        3,
      ]);
      expect(dayOf(plan, MONDAY).sessionDay).toStrictEqual({ id: pullDayId, name: "Pull" });
      expect(dayOf(plan, MONDAY).plannedDay?.name).toBe("Push");
      expect(weekCaption(plan)).toStrictEqual({
        plannedDayCount: 4,
        loggedDayCount: 1,
        loggedSessionCount: 1,
      });
    });

    it("should read Monday logged with Legs' sets and Thursday planned when Legs is finished on Monday", () => {
      const legsOnMonday = sessionOn(1, "2026-10-12", {
        routine_day_id: legsDayId,
        started_at: "2026-10-12T18:00:00+01:00",
        ended_at: "2026-10-12T18:50:00+01:00",
        sets: workingSets(squatId, 4),
      });

      const plan = goldenWeekPlan({ sessions: [legsOnMonday], now: "2026-10-12T19:00:00+01:00" });

      expect([dayOf(plan, MONDAY).status, dayOf(plan, THURSDAY).status]).toStrictEqual([
        "logged",
        "planned",
      ]);
      expect([dayOf(plan, MONDAY).setsLogged, dayOf(plan, MONDAY).sessionDay]).toStrictEqual([
        4,
        { id: legsDayId, name: "Legs" },
      ]);
      expect(weekCaption(plan)).toStrictEqual({
        plannedDayCount: 4,
        loggedDayCount: 1,
        loggedSessionCount: 1,
      });
    });

    it("should leave the day done planned, then missed once its date has passed, however many days were picked in its place", () => {
      const legsOnMonday = sessionOn(1, "2026-10-12", { routine_day_id: legsDayId });

      const onFriday = goldenWeekPlan({
        sessions: [legsOnMonday],
        now: "2026-10-16T09:00:00+01:00",
      });

      expect([dayOf(onFriday, MONDAY).status, dayOf(onFriday, THURSDAY).status]).toStrictEqual([
        "logged",
        "missed",
      ]);
    });

    it("should read a date done twice in place of its planned day as one logged day", () => {
      const first = sessionOn(1, "2026-10-12", { routine_day_id: legsDayId });
      const second = sessionOn(2, "2026-10-12", { routine_day_id: pullDayId });

      const plan = goldenWeekPlan({ sessions: [first, second], now: "2026-10-12T21:00:00+01:00" });

      expect(weekCaption(plan)).toStrictEqual({
        plannedDayCount: 4,
        loggedDayCount: 1,
        loggedSessionCount: 2,
      });
    });

    it("should read a day done on its own date as before: that date logged and nothing else", () => {
      const legsOnThursday = sessionOn(1, "2026-10-15", { routine_day_id: legsDayId });

      const plan = goldenWeekPlan({ sessions: [legsOnThursday], now: "2026-10-15T20:00:00+01:00" });

      expect(statusesOf(plan)).toStrictEqual([
        "missed",
        "missed",
        "rest",
        "logged",
        "rest",
        "planned",
        "rest",
      ]);
      expect(dayOf(plan, THURSDAY).sessionDay).toStrictEqual({ id: legsDayId, name: "Legs" });
    });

    it("should read Thursday logged for Saturday's Push, with Saturday still planned, when it is finished on Thursday", () => {
      const saturdayPushOnThursday = sessionOn(1, "2026-10-15", {
        routine_day_id: pushSaturdayDayId,
        sets: workingSets(squatId, 3),
      });

      const plan = goldenWeekPlan({ sessions: [saturdayPushOnThursday] });

      expect([dayOf(plan, THURSDAY).status, dayOf(plan, SATURDAY).status]).toStrictEqual([
        "logged",
        "planned",
      ]);
      expect(dayOf(plan, THURSDAY).sessions).toStrictEqual([saturdayPushOnThursday]);
      expect(dayOf(plan, SATURDAY).sessions).toStrictEqual([]);
    });

    it("should read Thursday in progress with Pull's sets planned, and Tuesday's Pull not credited, while Pull is open on Thursday", () => {
      const openPullOnThursday = sessionOn(1, "2026-10-15", {
        routine_day_id: pullDayId,
        ended_at: null,
      });

      const plan = goldenWeekPlan({ sessions: [openPullOnThursday] });

      expect(dayOf(plan, THURSDAY)).toMatchObject({
        status: "in_progress",
        setsPlanned: 15,
        sessionDay: { id: pullDayId, name: "Pull" },
      });
      expect(dayOf(plan, TUESDAY).status).toBe("missed");
    });

    it("should plan Legs' sets for an open session that follows no routine day", () => {
      const free = sessionOn(1, "2026-10-15", { ended_at: null });

      const plan = goldenWeekPlan({ sessions: [free] });

      expect(dayOf(plan, THURSDAY)).toMatchObject({
        status: "in_progress",
        setsPlanned: 16,
        sessionDay: null,
      });
    });

    it("should fill the slot of a planned date with an unplaced day done on it, and leave the unplaced day undone", () => {
      const armsOnMonday = sessionOn(1, "2026-10-12", {
        routine_day_id: anyDay.id,
        sets: workingSets(squatId, 4),
      });

      const plan = goldenWeekPlan({ routine: routineWithAnyDay, sessions: [armsOnMonday] });

      expect(dayOf(plan, MONDAY)).toMatchObject({
        status: "logged",
        setsLogged: 4,
        sessionDay: { id: anyDay.id },
      });
      expect(dayOf(plan, MONDAY).sessions).toStrictEqual([armsOnMonday]);
      expect(plan.unplaced.map((unplacedDay) => unplacedDay.logged)).toStrictEqual([false]);
      expect(weekCaption(plan)).toStrictEqual({
        plannedDayCount: 5,
        loggedDayCount: 1,
        loggedSessionCount: 1,
      });
    });

    it("should credit an unplaced day done on a rest day to the unplaced day, and read the date logged", () => {
      const armsOnWednesday = sessionOn(1, "2026-10-14", { routine_day_id: anyDay.id });

      const plan = goldenWeekPlan({
        routine: routineWithAnyDay,
        sessions: [armsOnWednesday],
        now: "2026-10-14T20:00:00+01:00",
      });

      expect(dayOf(plan, WEDNESDAY).status).toBe("logged");
      expect(plan.unplaced.map((unplacedDay) => unplacedDay.logged)).toStrictEqual([true]);
      expect(weekCaption(plan).loggedDayCount).toBe(1);
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

  describe("a routine active from a day", () => {
    const activeFromThursday: WeekRoutine = { ...goldenRoutine, activeFrom: "2026-10-15" };
    const activeFromWeek = (activeFrom: string, overrides: Partial<WeekPlanInput> = {}): WeekPlan =>
      goldenWeekPlan({ routine: { ...goldenRoutine, activeFrom }, sessions: [], ...overrides });

    it("should read the planned days before it rest, not missed, and the ones from it on by their date", () => {
      const plan = goldenWeekPlan({
        routine: activeFromThursday,
        sessions: [],
        now: SUNDAY_EVENING,
      });

      // Monday's Push and Tuesday's Pull come before Thursday. Thursday's Legs and Saturday's Push do not.
      expect(statusesOf(plan)).toStrictEqual([
        "rest",
        "rest",
        "rest",
        "missed",
        "rest",
        "missed",
        "rest",
      ]);
    });

    it("should plan the day it is active from", () => {
      expect(dayOf(activeFromWeek("2026-10-15"), THURSDAY).status).toBe("today");
      expect(dayOf(activeFromWeek("2026-10-16"), THURSDAY).status).toBe("rest");
    });

    it("should read a planned day before it as rest on any day of the week it is read", () => {
      for (const now of [
        THURSDAY_BEFORE_LEGS,
        "2026-10-14T09:00:00+01:00",
        "2026-10-18T09:00:00+01:00",
      ]) {
        const plan = goldenWeekPlan({ routine: activeFromThursday, sessions: [], now });

        expect(dayOf(plan, MONDAY).status).toBe("rest");
        expect(dayOf(plan, TUESDAY).status).toBe("rest");
      }
    });

    it("should read the same week as with no active date when it is active from the Monday or earlier", () => {
      const withoutDate = goldenWeekPlan({ now: SUNDAY_EVENING });

      for (const activeFrom of [goldenWeekStart, "2026-10-11", "2020-01-01"]) {
        expect(
          activeFromWeek(activeFrom, { sessions: goldenWeekPlan().sessions, now: SUNDAY_EVENING }),
        ).toStrictEqual(withoutDate);
      }
    });

    it("should keep a session logged before the active date as logged", () => {
      const plan = goldenWeekPlan({ routine: activeFromThursday, now: THURSDAY_BEFORE_LEGS });

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

    it("should refuse an active date that is not a calendar day", () => {
      for (const activeFrom of ["2026-02-30", "15/10/2026", ""]) {
        expect(() => activeFromWeek(activeFrom)).toThrow(
          new RangeError("A routine's active date must be a calendar day written YYYY-MM-DD"),
        );
      }
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

  it("should not count a day done on a rest day as a planned day done, though it is a session logged", () => {
    const plan = goldenWeekPlan({
      sessions: [sessionOn(1, "2026-10-14", { routine_day_id: legsDayId })],
      now: "2026-10-16T09:00:00+01:00",
    });

    expect(weekCaption(plan)).toStrictEqual({
      plannedDayCount: 4,
      loggedDayCount: 0,
      loggedSessionCount: 1,
    });
  });

  it("should count 2 of 4 done after Monday's Push and Tuesday's Pull, whatever a rest day or a swapped day adds", () => {
    const legsOnWednesday = sessionOn(1, "2026-10-14", { routine_day_id: legsDayId });
    const plan = goldenWeekPlan({
      sessions: [goldenMondaySession, goldenTuesdaySession, legsOnWednesday],
      now: "2026-10-14T20:00:00+01:00",
    });

    expect(weekCaption(plan)).toStrictEqual({
      plannedDayCount: 4,
      loggedDayCount: 2,
      loggedSessionCount: 3,
    });
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

describe("latestFinishedSession", () => {
  const morning = sessionOn(1, "2026-10-15", {
    started_at: "2026-10-15T07:00:00+01:00",
    ended_at: "2026-10-15T07:45:00+01:00",
  });
  const evening = sessionOn(2, "2026-10-15", {
    started_at: "2026-10-15T18:00:00+01:00",
    ended_at: "2026-10-15T18:20:00+01:00",
  });
  const open = sessionOn(3, "2026-10-15", {
    started_at: "2026-10-15T20:00:00+01:00",
    ended_at: null,
  });

  it("should give the session that ended last of several finished on one day", () => {
    expect(latestFinishedSession([evening, morning])).toBe(evening);
    expect(latestFinishedSession([morning, evening])).toBe(evening);
  });

  it("should compare the moments, so a zone offset does not reorder the sessions", () => {
    // 12:30 in New York is 16:30 in London, later than the London 15:00 one, though 12:30 is the smaller clock.
    const london = sessionOn(4, "2026-10-15", { ended_at: "2026-10-15T15:00:00+01:00" });
    const newYork = sessionOn(5, "2026-10-15", { ended_at: "2026-10-15T12:30:00-04:00" });

    expect(latestFinishedSession([newYork, london])).toBe(newYork);
  });

  it("should leave an open session out, even when it started last", () => {
    expect(latestFinishedSession([morning, open])).toBe(morning);
  });

  it("should give null when no session has finished", () => {
    expect(latestFinishedSession([open])).toBeNull();
    expect(latestFinishedSession([])).toBeNull();
  });

  it("should break a tie on the end by the later start, then the later id", () => {
    const sameEnd = "2026-10-15T19:00:00+01:00";
    // The earlier start has the larger id, so only the start rule can put the later start first.
    const earlierStart = sessionOn(9, "2026-10-15", {
      started_at: "2026-10-15T18:00:00+01:00",
      ended_at: sameEnd,
    });
    const laterStart = sessionOn(6, "2026-10-15", {
      started_at: "2026-10-15T18:30:00+01:00",
      ended_at: sameEnd,
    });
    const sameTimes = sessionOn(7, "2026-10-15", {
      started_at: "2026-10-15T18:30:00+01:00",
      ended_at: sameEnd,
    });

    expect(latestFinishedSession([earlierStart, laterStart])).toBe(laterStart);
    expect(latestFinishedSession([laterStart, earlierStart])).toBe(laterStart);
    expect(latestFinishedSession([laterStart, sameTimes])).toBe(sameTimes);
    expect(latestFinishedSession([sameTimes, laterStart])).toBe(sameTimes);
  });
});

describe("a late make-up counts for the day it replaced (KEY-531)", () => {
  /** The golden routine with a day moved to another weekday, to make the dates the cases need. */
  const withDayOn = (dayId: string, weekday: number): WeekRoutine => ({
    ...goldenRoutine,
    days: goldenRoutine.days.map((day) => (day.id === dayId ? { ...day, weekday } : day)),
  });
  // Push Monday, Pull Tuesday, Legs Thursday and Push Friday: Saturday is a rest day.
  const fridayRoutine = withDayOn(pushSaturdayDayId, 4);
  // The last Push on Sunday, so a missed Sunday can be made up on the next Monday.
  const sundayRoutine = withDayOn(pushSaturdayDayId, 6);

  const FRIDAY_EVENING = "2026-10-16T20:00:00+01:00";
  const SATURDAY_MORNING = "2026-10-17T09:00:00+01:00";

  const legsOnFriday = sessionOn(1, "2026-10-16", {
    routine_day_id: legsDayId,
    sets: workingSets(squatId, 4),
  });

  describe("Thursday's Legs missed and done on Friday, a planned Push day", () => {
    const plan = goldenWeekPlan({
      routine: fridayRoutine,
      sessions: [legsOnFriday],
      now: FRIDAY_EVENING,
    });

    it("should read Thursday logged for Legs, made up by the Friday session, with its sets", () => {
      expect(dayOf(plan, THURSDAY)).toMatchObject({
        status: "logged",
        madeUpBy: legsOnFriday,
        sessionDay: { id: legsDayId, name: "Legs" },
        sessions: [],
        setsLogged: 4,
      });
    });

    it("should read Friday as it would without the session: today, with nothing logged", () => {
      expect(dayOf(plan, FRIDAY)).toMatchObject({
        status: "today",
        madeUpBy: null,
        sessions: [],
        setsLogged: 0,
        sessionDay: null,
      });
    });

    it("should read Friday missed once its date has passed, never extra", () => {
      const later = goldenWeekPlan({
        routine: fridayRoutine,
        sessions: [legsOnFriday],
        now: SATURDAY_MORNING,
      });

      expect(dayOf(later, FRIDAY).status).toBe("missed");
    });

    it("should keep the session in the week's sessions and count Thursday among the days done", () => {
      expect(plan.sessions).toStrictEqual([legsOnFriday]);
      expect(weekCaption(plan)).toStrictEqual({
        plannedDayCount: 4,
        loggedDayCount: 1,
        loggedSessionCount: 1,
      });
    });

    it("should leave madeUpBy null on every other day", () => {
      expect(plan.days.map((day) => day.madeUpBy !== null)).toStrictEqual([
        false,
        false,
        false,
        true,
        false,
        false,
        false,
      ]);
    });
  });

  it("should read a rest-day Saturday as rest, not extra, when Thursday's Legs is made up on it", () => {
    const legsOnSaturday = sessionOn(1, "2026-10-17", { routine_day_id: legsDayId });

    const plan = goldenWeekPlan({
      routine: fridayRoutine,
      sessions: [legsOnSaturday],
      now: SATURDAY_MORNING,
    });

    expect(dayOf(plan, THURSDAY)).toMatchObject({ status: "logged", madeUpBy: legsOnSaturday });
    expect(dayOf(plan, SATURDAY)).toMatchObject({ status: "rest", sessions: [], setsLogged: 0 });
  });

  describe("two make-ups for one missed day", () => {
    const legsOnSaturday = sessionOn(2, "2026-10-17", { routine_day_id: legsDayId });

    it("should credit Thursday with the first and read the second as an extra session on a rest Saturday", () => {
      const plan = goldenWeekPlan({
        routine: fridayRoutine,
        sessions: [legsOnFriday, legsOnSaturday],
        now: "2026-10-17T20:00:00+01:00",
      });

      expect(dayOf(plan, THURSDAY).madeUpBy).toBe(legsOnFriday);
      expect(dayOf(plan, FRIDAY).status).toBe("missed");
      expect(dayOf(plan, SATURDAY)).toMatchObject({
        status: "extra",
        sessions: [legsOnSaturday],
        madeUpBy: null,
      });
    });

    it("should fill the planned Saturday's slot with the second", () => {
      const plan = goldenWeekPlan({
        sessions: [legsOnFriday, legsOnSaturday],
        now: "2026-10-17T20:00:00+01:00",
      });

      expect(dayOf(plan, THURSDAY).madeUpBy).toBe(legsOnFriday);
      expect(dayOf(plan, SATURDAY)).toMatchObject({ status: "logged", sessions: [legsOnSaturday] });
    });

    it("should credit the one that started first on one date, comparing moments and not text", () => {
      // 10:00+01:00 is 09:00Z, before 09:30Z, though its text sorts after.
      const earlier = sessionOn(8, "2026-10-16", {
        routine_day_id: legsDayId,
        started_at: "2026-10-16T10:00:00+01:00",
        ended_at: "2026-10-16T11:00:00+01:00",
      });
      const later = sessionOn(3, "2026-10-16", {
        routine_day_id: legsDayId,
        started_at: "2026-10-16T09:30:00Z",
        ended_at: "2026-10-16T10:30:00Z",
      });

      const plan = goldenWeekPlan({
        routine: fridayRoutine,
        sessions: [later, earlier],
        now: FRIDAY_EVENING,
      });

      expect(dayOf(plan, THURSDAY).madeUpBy).toBe(earlier);
      expect(dayOf(plan, FRIDAY)).toMatchObject({ status: "logged", sessions: [later] });
    });

    it("should break a tie on the start by the id", () => {
      const first = sessionOn(4, "2026-10-16", { routine_day_id: legsDayId });
      const second = sessionOn(5, "2026-10-16", { routine_day_id: legsDayId });

      const plan = goldenWeekPlan({
        routine: fridayRoutine,
        sessions: [second, first],
        now: FRIDAY_EVENING,
      });

      expect(dayOf(plan, THURSDAY).madeUpBy).toBe(first);
    });
  });

  describe("a pick that is not a make-up", () => {
    it("should fill Tuesday's slot when Tuesday does Thursday's Legs, and leave Thursday planned", () => {
      const legsOnTuesday = sessionOn(1, "2026-10-13", { routine_day_id: legsDayId });

      const plan = goldenWeekPlan({ sessions: [legsOnTuesday], now: "2026-10-13T21:00:00+01:00" });

      expect(dayOf(plan, TUESDAY)).toMatchObject({ status: "logged", sessions: [legsOnTuesday] });
      expect(dayOf(plan, THURSDAY)).toMatchObject({ status: "planned", madeUpBy: null });
    });

    it("should fill the slot of the date it names when a day is done on its own date", () => {
      const legsOnThursday = sessionOn(1, "2026-10-15", { routine_day_id: legsDayId });

      const plan = goldenWeekPlan({ sessions: [legsOnThursday], now: "2026-10-15T21:00:00+01:00" });

      expect(dayOf(plan, THURSDAY)).toMatchObject({ status: "logged", madeUpBy: null });
    });
  });

  describe("a missed day that is not open to a make-up", () => {
    it("should fall back when Thursday has a session of its own, though Friday does Legs", () => {
      const mondayPush = sessionOn(1, "2026-10-12", { routine_day_id: pushMondayDayId });
      const tuesdayPull = sessionOn(2, "2026-10-13", { routine_day_id: pullDayId });
      const pullOnThursday = sessionOn(3, "2026-10-15", { routine_day_id: pullDayId });
      const legsOnFridayAgain = sessionOn(4, "2026-10-16", { routine_day_id: legsDayId });

      const plan = goldenWeekPlan({
        routine: fridayRoutine,
        sessions: [mondayPush, tuesdayPull, pullOnThursday, legsOnFridayAgain],
        now: FRIDAY_EVENING,
      });

      expect(dayOf(plan, THURSDAY)).toMatchObject({
        status: "logged",
        sessions: [pullOnThursday],
        madeUpBy: null,
      });
      expect(dayOf(plan, FRIDAY)).toMatchObject({
        status: "logged",
        sessions: [legsOnFridayAgain],
      });
    });

    it("should fall back when the date is before the routine was made active", () => {
      const plan = goldenWeekPlan({
        routine: { ...fridayRoutine, activeFrom: "2026-10-16" },
        sessions: [legsOnFriday],
        now: FRIDAY_EVENING,
      });

      expect(dayOf(plan, THURSDAY)).toMatchObject({ status: "rest", madeUpBy: null });
      expect(dayOf(plan, FRIDAY)).toMatchObject({ status: "logged", sessions: [legsOnFriday] });
    });

    it("should make Legs up on the day the routine was made active", () => {
      const plan = goldenWeekPlan({
        routine: { ...fridayRoutine, activeFrom: "2026-10-15" },
        sessions: [legsOnFriday],
        now: FRIDAY_EVENING,
      });

      expect(dayOf(plan, THURSDAY).madeUpBy).toBe(legsOnFriday);
    });

    it("should fall back when Thursday's own session is still open", () => {
      const openLegsOnThursday = sessionOn(5, "2026-10-15", {
        routine_day_id: legsDayId,
        ended_at: null,
      });

      const plan = goldenWeekPlan({
        routine: fridayRoutine,
        sessions: [openLegsOnThursday, legsOnFriday],
        now: FRIDAY_EVENING,
      });

      expect(dayOf(plan, THURSDAY)).toMatchObject({ status: "in_progress", madeUpBy: null });
      expect(dayOf(plan, FRIDAY)).toMatchObject({ status: "logged", sessions: [legsOnFriday] });
    });

    it("should never make a day up with a session that is still open", () => {
      const openLegsOnFriday = sessionOn(5, "2026-10-16", {
        routine_day_id: legsDayId,
        ended_at: null,
      });

      const plan = goldenWeekPlan({
        routine: fridayRoutine,
        sessions: [openLegsOnFriday],
        now: FRIDAY_EVENING,
      });

      expect(dayOf(plan, THURSDAY)).toMatchObject({ status: "missed", madeUpBy: null });
      expect(dayOf(plan, FRIDAY).status).toBe("in_progress");
    });

    it("should not count a deleted session on Thursday as one of its own", () => {
      const deleted = sessionOn(6, "2026-10-15", { deleted_at: "2026-10-15T20:00:00Z" });

      const plan = goldenWeekPlan({
        routine: fridayRoutine,
        sessions: [deleted, legsOnFriday],
        now: FRIDAY_EVENING,
      });

      expect(dayOf(plan, THURSDAY).madeUpBy).toBe(legsOnFriday);
    });

    it("should credit nothing in either week for a missed Sunday done on the next Monday", () => {
      const pushOnNextMonday = sessionOn(1, "2026-10-19", { routine_day_id: pushSaturdayDayId });

      const thisWeek = goldenWeekPlan({
        routine: sundayRoutine,
        sessions: [pushOnNextMonday],
        now: "2026-10-19T20:00:00+01:00",
      });
      const nextWeek = goldenWeekPlan({
        routine: sundayRoutine,
        sessions: [pushOnNextMonday],
        weekStart: "2026-10-19",
        now: "2026-10-19T20:00:00+01:00",
      });

      expect(thisWeek.days.map((day) => day.madeUpBy)).toStrictEqual(Array(7).fill(null));
      expect(dayOf(thisWeek, SUNDAY).status).toBe("missed");
      expect(nextWeek.days.map((day) => day.madeUpBy)).toStrictEqual(Array(7).fill(null));
      expect(dayOf(nextWeek, MONDAY)).toMatchObject({
        status: "logged",
        sessions: [pushOnNextMonday],
      });
      expect(dayOf(nextWeek, SUNDAY).status).toBe("planned");
    });

    it("should leave a session that names a day with no weekday as it was", () => {
      const armsOnFriday = sessionOn(1, "2026-10-16", { routine_day_id: anyDay.id });

      const plan = goldenWeekPlan({
        routine: routineWithAnyDay,
        sessions: [armsOnFriday],
        now: FRIDAY_EVENING,
      });

      expect(plan.days.map((day) => day.madeUpBy)).toStrictEqual(Array(7).fill(null));
      expect(dayOf(plan, FRIDAY)).toMatchObject({ status: "logged", sessions: [armsOnFriday] });
    });
  });

  describe("a chain: Monday missed, Tuesday does Monday's day, Wednesday does Tuesday's day", () => {
    const pushOnTuesday = sessionOn(1, "2026-10-13", { routine_day_id: pushMondayDayId });
    const pullOnWednesday = sessionOn(2, "2026-10-14", { routine_day_id: pullDayId });
    const input = { sessions: [pushOnTuesday, pullOnWednesday], now: "2026-10-14T20:00:00+01:00" };

    it("should credit Monday with Tuesday's session and Tuesday with Wednesday's", () => {
      const plan = goldenWeekPlan(input);

      expect(statusesOf(plan)).toStrictEqual([
        "logged",
        "logged",
        "rest",
        "planned",
        "rest",
        "planned",
        "rest",
      ]);
      expect(dayOf(plan, MONDAY).madeUpBy).toBe(pushOnTuesday);
      expect(dayOf(plan, TUESDAY)).toMatchObject({ madeUpBy: pullOnWednesday, sessions: [] });
      expect(dayOf(plan, WEDNESDAY)).toMatchObject({ status: "rest", sessions: [] });
    });

    it("should give the same week whatever order the sessions come in", () => {
      expect(
        goldenWeekPlan({ ...input, sessions: [pullOnWednesday, pushOnTuesday] }).days,
      ).toStrictEqual(goldenWeekPlan(input).days);
    });
  });
});
