import { describe, expect, it } from "vitest";

import { suggestionTargetOf, todayPlanOf, withSessionInProgress } from "../../src/training";

import type { TodayCard, WeekSession } from "../../src/training";

const TODAY = "2026-10-14";
const TOMORROW = "2026-10-15";
const NEXT = { date: "2026-10-16", id: "day-legs", name: "Legs" };

const input = (
  card: TodayCard | null,
  overrides: Partial<Parameters<typeof suggestionTargetOf>[0]> = {},
) => ({
  today: TODAY,
  card,
  plannedDayId: null,
  hasRoutine: true,
  hasLoggedSession: true,
  ...overrides,
});

describe("suggestionTargetOf", () => {
  it("should ask for today on a planned day, under the routine day today plans", () => {
    const card: TodayCard = {
      kind: "planned",
      routineName: "PPL",
      dayName: "Push",
      dayNumber: 1,
      dayCount: 3,
      exerciseCount: 4,
      setCount: 12,
      estimatedMinutes: 50,
    };

    expect(suggestionTargetOf(input(card, { plannedDayId: "day-push" }))).toEqual({
      status: "day",
      target: { day: TODAY, routineDayId: "day-push", routineDayName: "Push", isRestDay: false },
    });
  });

  it("should ask for the next planned day on a rest day, and say it is a rest day", () => {
    expect(suggestionTargetOf(input({ kind: "rest", next: NEXT }))).toEqual({
      status: "day",
      target: { day: NEXT.date, routineDayId: NEXT.id, routineDayName: "Legs", isRestDay: true },
    });
  });

  it("should ask for tomorrow as a fresh session on a rest day with no planned day to come", () => {
    expect(suggestionTargetOf(input({ kind: "rest", next: null }))).toEqual({
      status: "day",
      target: { day: TOMORROW, routineDayId: null, routineDayName: null, isRestDay: true },
    });
  });

  it("should give no suggestion while a session is in progress", () => {
    const card: TodayCard = {
      kind: "in_progress",
      dayName: "Push",
      minutesSoFar: 10,
      setsLogged: 2,
      setsPlanned: 12,
      nextSet: null,
    };

    expect(suggestionTargetOf(input(card))).toEqual({ status: "in_progress" });
  });

  it("should ask for the next planned day once today's session is done", () => {
    const card: TodayCard = {
      kind: "done",
      dayName: "Push",
      minutes: 55,
      setsLogged: 12,
      setsPlanned: 12,
      next: NEXT,
    };

    expect(suggestionTargetOf(input(card))).toEqual({
      status: "done",
      next: { day: NEXT.date, routineDayId: NEXT.id, routineDayName: "Legs", isRestDay: false },
    });
  });

  it("should ask for tomorrow as a fresh session once today is done with no planned day to come", () => {
    const card: TodayCard = {
      kind: "done",
      dayName: null,
      minutes: 40,
      setsLogged: 8,
      setsPlanned: 0,
      next: null,
    };

    expect(suggestionTargetOf(input(card))).toEqual({
      status: "done",
      next: { day: TOMORROW, routineDayId: null, routineDayName: null, isRestDay: false },
    });
  });

  it("should ask for tomorrow as a fresh session with no routine once a session was ever logged", () => {
    expect(suggestionTargetOf(input({ kind: "no_routine" }, { hasRoutine: false }))).toEqual({
      status: "day",
      target: { day: TOMORROW, routineDayId: null, routineDayName: null, isRestDay: false },
    });
    expect(suggestionTargetOf(input(null, { hasRoutine: false }))).toEqual({
      status: "day",
      target: { day: TOMORROW, routineDayId: null, routineDayName: null, isRestDay: false },
    });
  });

  it("should give no suggestion on the first visit, which has its own Set your goal", () => {
    expect(
      suggestionTargetOf(
        input({ kind: "first_time" }, { hasRoutine: false, hasLoggedSession: false }),
      ),
    ).toEqual({ status: "none" });
  });
});

describe("withSessionInProgress", () => {
  const session = (id: string, localDate: string): WeekSession => ({
    id,
    local_date: localDate,
    routine_day_id: null,
    started_at: `${localDate}T17:00:00+00:00`,
    ended_at: null,
    deleted_at: null,
    sets: [],
  });

  it("should leave the week's sessions alone when none is in progress", () => {
    const week = [session("a", "2026-10-12")];

    expect(withSessionInProgress(week, null, TODAY)).toEqual(week);
  });

  it("should put the session in progress on the given day in place of its own row", () => {
    const week = [session("a", "2026-10-12"), session("open", "2026-10-13")];

    expect(withSessionInProgress(week, session("open", "2026-10-13"), TODAY)).toEqual([
      session("a", "2026-10-12"),
      { ...session("open", "2026-10-13"), local_date: TODAY },
    ]);
  });
});

describe("todayPlanOf", () => {
  it("should read a rest day of an empty week as no_routine with no routine, and first_time when never logged", () => {
    const base = {
      routine: null,
      weekSessions: [],
      sessionInProgress: null,
      now: "2026-10-14T11:00:00.000Z",
      tz: "UTC",
      weekStart: "2026-10-12",
    };

    expect(todayPlanOf({ ...base, hasEverLoggedSession: true }).card).toEqual({
      kind: "no_routine",
    });
    expect(todayPlanOf({ ...base, hasEverLoggedSession: false }).card).toEqual({
      kind: "first_time",
    });
  });
});
