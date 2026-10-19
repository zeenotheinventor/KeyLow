import { describe, expect, it } from "vitest";

import {
  goldenFinishedThursdaySession,
  goldenMondaySession,
  goldenOpenThursdaySession,
  goldenRoutine,
  goldenTimeZone,
  goldenTuesdaySession,
  goldenWeekStart,
  legPressId,
  legsDayId,
  pullDayId,
  romanianDeadliftId,
  sessionOn,
  squatId,
  workingSets,
} from "./weekPlanRows";
import {
  SESSION_TIME_PARAMS_V1,
  todayCard,
  todaySessionToView,
  weekPlanDays,
} from "../../src/training";

import type { TodayCardInput, WeekPlanInput, WeekRoutine } from "../../src/training";

const THURSDAY_BEFORE_LEGS = "2026-10-15T17:55:00+01:00";
const THURSDAY_MID_LEGS = "2026-10-15T19:00:00+01:00";
const THURSDAY_AFTER_LEGS = "2026-10-15T19:01:00+01:00";

const finishedWeek = [goldenMondaySession, goldenTuesdaySession];

/** The card for the golden week, built from the week plan the Train screen would hold. */
const cardFor = (
  plan: Partial<WeekPlanInput> = {},
  card: Partial<Omit<TodayCardInput, "week" | "now">> = {},
) => {
  const input: WeekPlanInput = {
    routine: goldenRoutine,
    sessions: finishedWeek,
    now: THURSDAY_BEFORE_LEGS,
    tz: goldenTimeZone,
    weekStart: goldenWeekStart,
    ...plan,
  };
  return todayCard({
    week: weekPlanDays(input),
    now: input.now,
    sessionTimeParams: SESSION_TIME_PARAMS_V1,
    hasEverLoggedSession: true,
    ...card,
  });
};

describe("todayCard", () => {
  describe("a planned day, nothing started", () => {
    it("should read Legs, day 3 of 4, with 5 exercises, 16 sets and about 50 minutes at Thursday 17:55", () => {
      expect(cardFor()).toStrictEqual({
        kind: "planned",
        routineName: "Push Pull Legs",
        dayName: "Legs",
        dayNumber: 3,
        dayCount: 4,
        exerciseCount: 5,
        setCount: 16,
        estimatedMinutes: 50,
      });
    });

    it("should estimate the minutes with the session time params it is given", () => {
      const card = cardFor(
        {},
        { sessionTimeParams: { ...SESSION_TIME_PARAMS_V1, minutesPerSet: 3, roundTo: 1 } },
      );

      expect(card).toMatchObject({ kind: "planned", estimatedMinutes: 58 });
    });
  });

  describe("a session in progress", () => {
    const inProgress = (overrides: Partial<WeekPlanInput> = {}) =>
      cardFor({
        sessions: [...finishedWeek, goldenOpenThursdaySession],
        now: THURSDAY_MID_LEGS,
        ...overrides,
      });

    it("should read 30 minutes in, 8 of 16 sets and leg press set 3 next at Thursday 19:00", () => {
      expect(inProgress()).toStrictEqual({
        kind: "in_progress",
        dayName: "Legs",
        minutesSoFar: 30,
        setsLogged: 8,
        setsPlanned: 16,
        nextSet: { exerciseId: legPressId, setNumber: 3 },
      });
    });

    it("should take the next set from the first exercise short of its target sets, in position order", () => {
      const skippedSquat = sessionOn(1, "2026-10-15", {
        ended_at: null,
        routine_day_id: legsDayId,
        sets: [...workingSets(romanianDeadliftId, 3), ...workingSets(squatId, 1)],
      });

      expect(cardFor({ sessions: [skippedSquat], now: THURSDAY_MID_LEGS })).toMatchObject({
        nextSet: { exerciseId: squatId, setNumber: 2 },
      });
    });

    it("should count a warm-up for nothing when it picks the next set", () => {
      const warmupOnly = sessionOn(1, "2026-10-15", {
        ended_at: null,
        routine_day_id: legsDayId,
        sets: [{ exercise_id: squatId, set_type: "warmup", deleted_at: null }],
      });

      expect(cardFor({ sessions: [warmupOnly], now: THURSDAY_MID_LEGS })).toMatchObject({
        setsLogged: 0,
        nextSet: { exerciseId: squatId, setNumber: 1 },
      });
    });

    it("should read no next set once every planned set is logged", () => {
      const everySet = sessionOn(1, "2026-10-15", {
        ended_at: null,
        routine_day_id: legsDayId,
        sets: [
          ...workingSets(squatId, 3),
          ...workingSets(romanianDeadliftId, 3),
          ...workingSets(legPressId, 3),
          ...workingSets("00000001-0000-4000-8000-000000000014", 3),
          ...workingSets("00000001-0000-4000-8000-000000000015", 4),
        ],
      });

      expect(cardFor({ sessions: [everySet], now: THURSDAY_MID_LEGS })).toMatchObject({
        setsLogged: 16,
        nextSet: null,
      });
    });

    it("should share the logged sets of an exercise a day lists twice between its two entries", () => {
      const twice: WeekRoutine = {
        name: "Twice",
        days: [
          {
            id: legsDayId,
            name: "Legs",
            position: 0,
            weekday: 3,
            exercises: [
              { position: 0, exercise_id: squatId, target_sets: 2 },
              { position: 1, exercise_id: legPressId, target_sets: 2 },
              { position: 2, exercise_id: squatId, target_sets: 2 },
            ],
          },
        ],
      };
      const session = sessionOn(1, "2026-10-15", {
        ended_at: null,
        sets: [...workingSets(squatId, 3), ...workingSets(legPressId, 2)],
      });

      expect(
        cardFor({ routine: twice, sessions: [session], now: THURSDAY_MID_LEGS }),
      ).toMatchObject({ nextSet: { exerciseId: squatId, setNumber: 2 } });
    });

    it("should follow the routine day the open session was started from, not the day planned for today", () => {
      const pullOnThursday = sessionOn(1, "2026-10-15", {
        ended_at: null,
        routine_day_id: pullDayId,
        started_at: "2026-10-15T18:30:00+01:00",
      });

      expect(cardFor({ sessions: [pullOnThursday], now: THURSDAY_MID_LEGS })).toMatchObject({
        dayName: "Pull",
        setsPlanned: 15,
      });
    });

    it("should read a free session on a rest day with no day name and nothing planned", () => {
      const free = sessionOn(1, "2026-10-14", {
        ended_at: null,
        started_at: "2026-10-14T18:00:00+01:00",
        sets: workingSets(squatId, 2),
      });

      expect(cardFor({ sessions: [free], now: "2026-10-14T18:20:00+01:00" })).toStrictEqual({
        kind: "in_progress",
        dayName: null,
        minutesSoFar: 20,
        setsLogged: 2,
        setsPlanned: 0,
        nextSet: null,
      });
    });

    it("should not run the minutes below zero when the clock is a little behind the session", () => {
      expect(inProgress({ now: "2026-10-15T18:29:00+01:00" })).toMatchObject({ minutesSoFar: 0 });
    });
  });

  describe("a session finished today", () => {
    const done = (overrides: Partial<WeekPlanInput> = {}) =>
      cardFor({
        sessions: [...finishedWeek, goldenFinishedThursdaySession],
        now: THURSDAY_AFTER_LEGS,
        ...overrides,
      });

    it("should read 30 minutes, 8 of 16 sets and Saturday's Push next after Legs", () => {
      expect(done()).toStrictEqual({
        kind: "done",
        dayName: "Legs",
        minutes: 30,
        setsLogged: 8,
        setsPlanned: 16,
        next: { date: "2026-10-17", id: "00000003-0000-4000-8000-000000000004", name: "Push" },
      });
    });

    it("should add up the minutes and sets of two sessions finished on one day", () => {
      const morning = sessionOn(1, "2026-10-15", {
        routine_day_id: legsDayId,
        started_at: "2026-10-15T07:00:00+01:00",
        ended_at: "2026-10-15T07:45:00+01:00",
        sets: workingSets(squatId, 5),
      });
      const evening = sessionOn(2, "2026-10-15", {
        started_at: "2026-10-15T18:00:00+01:00",
        ended_at: "2026-10-15T18:20:30+01:00",
        sets: workingSets(legPressId, 3),
      });

      expect(done({ sessions: [morning, evening] })).toMatchObject({
        minutes: 65,
        setsLogged: 8,
      });
    });

    it("should read a planned day done when its session was logged on an earlier date", () => {
      const legsOnWednesday = sessionOn(1, "2026-10-14", {
        routine_day_id: legsDayId,
        started_at: "2026-10-14T18:00:00+01:00",
        ended_at: "2026-10-14T18:50:00+01:00",
        sets: workingSets(squatId, 9),
      });

      expect(done({ sessions: [legsOnWednesday], now: "2026-10-15T09:00:00+01:00" })).toMatchObject(
        {
          kind: "done",
          dayName: "Legs",
          minutes: 50,
          setsLogged: 9,
          setsPlanned: 16,
        },
      );
    });

    it("should skip a planned day that is already logged when it names the next one", () => {
      const legsOnWednesday = sessionOn(1, "2026-10-14", {
        routine_day_id: legsDayId,
        started_at: "2026-10-14T18:00:00+01:00",
        ended_at: "2026-10-14T18:50:00+01:00",
      });

      expect(done({ sessions: [legsOnWednesday], now: "2026-10-14T19:00:00+01:00" })).toMatchObject(
        {
          kind: "done",
          dayName: "Legs",
          next: { date: "2026-10-17", name: "Push", id: "00000003-0000-4000-8000-000000000004" },
        },
      );
    });

    it("should read a session on a rest day as done with no day name", () => {
      const extra = sessionOn(1, "2026-10-14", {
        started_at: "2026-10-14T18:00:00+01:00",
        ended_at: "2026-10-14T18:40:00+01:00",
        sets: workingSets(squatId, 6),
      });

      expect(done({ sessions: [extra], now: "2026-10-14T19:00:00+01:00" })).toStrictEqual({
        kind: "done",
        dayName: null,
        minutes: 40,
        setsLogged: 6,
        setsPlanned: 0,
        next: { date: "2026-10-15", id: legsDayId, name: "Legs" },
      });
    });

    it("should wrap to Monday of the following week after the last planned day", () => {
      const saturday = sessionOn(1, "2026-10-17", {
        started_at: "2026-10-17T18:00:00+01:00",
        ended_at: "2026-10-17T19:00:00+01:00",
      });

      expect(done({ sessions: [saturday], now: "2026-10-17T20:00:00+01:00" })).toMatchObject({
        next: { date: "2026-10-19", name: "Push", id: "00000003-0000-4000-8000-000000000001" },
      });
    });

    it("should read no next day when the routine has only unplaced days", () => {
      const unplacedOnly: WeekRoutine = {
        name: "Any day",
        days: [
          {
            id: legsDayId,
            name: "Legs",
            position: 0,
            weekday: null,
            exercises: [{ position: 0, exercise_id: squatId, target_sets: 3 }],
          },
        ],
      };
      const free = sessionOn(1, "2026-10-15", {
        started_at: "2026-10-15T18:00:00+01:00",
        ended_at: "2026-10-15T19:00:00+01:00",
        routine_day_id: legsDayId,
      });

      expect(done({ routine: unplacedOnly, sessions: [free] })).toMatchObject({
        dayName: "Legs",
        next: null,
      });
    });
  });

  describe("a rest day", () => {
    it("should name Monday of the following week as next on the Sunday for a routine active from Thursday", () => {
      const activeFromThursday: WeekRoutine = { ...goldenRoutine, activeFrom: "2026-10-15" };

      expect(
        cardFor({ routine: activeFromThursday, sessions: [], now: "2026-10-18T20:00:00+01:00" }),
      ).toMatchObject({ kind: "rest", next: { date: "2026-10-19", name: "Push" } });
    });

    it("should read a rest day, not the planned day, when the routine was made active after today", () => {
      // A device clock behind the server's: active from Friday while now is still Thursday.
      const activeFromFriday: WeekRoutine = { ...goldenRoutine, activeFrom: "2026-10-16" };

      expect(cardFor({ routine: activeFromFriday, sessions: [] })).toStrictEqual({
        kind: "rest",
        next: { date: "2026-10-17", id: "00000003-0000-4000-8000-000000000004", name: "Push" },
      });
    });

    it("should read the next planned day, Legs on Thursday, on the Wednesday before it", () => {
      expect(cardFor({ now: "2026-10-14T12:00:00+01:00" })).toStrictEqual({
        kind: "rest",
        next: { date: "2026-10-15", id: legsDayId, name: "Legs" },
      });
    });

    it("should skip a planned day that is already logged when it names the next one", () => {
      const legsOnTuesday = sessionOn(1, "2026-10-13", {
        routine_day_id: legsDayId,
        started_at: "2026-10-13T18:00:00+01:00",
        ended_at: "2026-10-13T18:50:00+01:00",
      });

      expect(
        cardFor({ sessions: [legsOnTuesday], now: "2026-10-14T12:00:00+01:00" }),
      ).toStrictEqual({
        kind: "rest",
        next: { date: "2026-10-17", id: "00000003-0000-4000-8000-000000000004", name: "Push" },
      });
    });

    it("should read a rest day on the Sunday whatever session was left open on a past date", () => {
      const neverFinished = sessionOn(1, "2026-10-12", { ended_at: null });

      expect(
        cardFor({ sessions: [neverFinished], now: "2026-10-18T20:00:00+01:00" }),
      ).toMatchObject({ kind: "rest", next: { date: "2026-10-19", name: "Push" } });
    });

    it("should read Monday of the following week as the next planned day on the Sunday", () => {
      expect(cardFor({ now: "2026-10-18T20:00:00+01:00" })).toMatchObject({
        kind: "rest",
        next: { date: "2026-10-19", name: "Push" },
      });
    });
  });

  describe("no routine", () => {
    it("should read no routine when the person has trained before but has none", () => {
      expect(cardFor({ routine: null })).toStrictEqual({ kind: "no_routine" });
    });

    it("should read first time when there is no routine and nothing was ever logged", () => {
      expect(
        cardFor({ routine: null, sessions: [] }, { hasEverLoggedSession: false }),
      ).toStrictEqual({ kind: "first_time" });
    });

    it("should leave the first time flag alone when there is a routine", () => {
      expect(cardFor({}, { hasEverLoggedSession: false })).toMatchObject({ kind: "planned" });
    });
  });

  describe("the rules it refuses", () => {
    it("should refuse a week that does not hold today", () => {
      const weekOver = "2026-10-26T09:00:00+00:00";

      expect(() => cardFor({ now: weekOver })).toThrow(
        new RangeError("The today card needs a week that holds today"),
      );
    });

    it("should refuse a session time that is not an ISO timestamp with a zone", () => {
      const open = sessionOn(1, "2026-10-15", { ended_at: null, started_at: "2026-10-15 18:30" });

      expect(() => cardFor({ sessions: [open], now: THURSDAY_MID_LEGS })).toThrow(
        new RangeError("A session time must be an ISO timestamp with a zone"),
      );
    });
  });
});

describe("todaySessionToView", () => {
  const weekAt = (sessions: WeekPlanInput["sessions"], now: string) =>
    weekPlanDays({
      routine: goldenRoutine,
      sessions,
      now,
      tz: goldenTimeZone,
      weekStart: goldenWeekStart,
    });

  it("should give the session the Done card counts, the golden Thursday Legs", () => {
    const week = weekAt([...finishedWeek, goldenFinishedThursdaySession], THURSDAY_AFTER_LEGS);

    expect(todaySessionToView(week)).toBe(goldenFinishedThursdaySession);
  });

  it("should give the later of two sessions finished today", () => {
    const morning = sessionOn(1, "2026-10-15", {
      routine_day_id: legsDayId,
      started_at: "2026-10-15T07:00:00+01:00",
      ended_at: "2026-10-15T07:45:00+01:00",
    });
    const evening = sessionOn(2, "2026-10-15", {
      started_at: "2026-10-15T18:00:00+01:00",
      ended_at: "2026-10-15T18:20:30+01:00",
    });

    expect(todaySessionToView(weekAt([evening, morning], THURSDAY_AFTER_LEGS))).toBe(evening);
  });

  it("should give a planned day's own session logged on an earlier date, as the Done card counts it", () => {
    const legsOnWednesday = sessionOn(1, "2026-10-14", {
      routine_day_id: legsDayId,
      started_at: "2026-10-14T18:00:00+01:00",
      ended_at: "2026-10-14T18:50:00+01:00",
    });

    expect(todaySessionToView(weekAt([legsOnWednesday], "2026-10-15T09:00:00+01:00"))).toBe(
      legsOnWednesday,
    );
  });

  it("should give null while today's session is still open and nothing else finished", () => {
    const week = weekAt([goldenOpenThursdaySession], THURSDAY_MID_LEGS);

    expect(todaySessionToView(week)).toBeNull();
  });

  it("should give null on a day with nothing logged", () => {
    expect(todaySessionToView(weekAt(finishedWeek, THURSDAY_BEFORE_LEGS))).toBeNull();
  });
});
