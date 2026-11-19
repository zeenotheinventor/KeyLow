import { describe, expect, it } from "vitest";

import { completeDay, completeRun, LONDON } from "./fixtures";
import { dailyStreak, freezeEventsDue } from "../../../src/achievements/streaks";
import { addCalendarDays } from "../../../src/dates";

import type { FreezeRow, StreakDay, WeekRecord } from "../../../src/achievements/streaks";

const earned = (date: string, count = 1, reason = "level", reference = date): FreezeRow => ({
  kind: "earned",
  reason,
  reference,
  date,
  count,
});

const streakWith = (days: StreakDay[], ledger: FreezeRow[], today: string, now: string) =>
  dailyStreak(days, ledger, today, new Date(now), LONDON, { from: "2026-01-01", to: today });

const stateOn = (result: ReturnType<typeof streakWith>, localDate: string) =>
  result.calendar.find((cell) => cell.localDate === localDate)?.state;

// Seven days in a row from 1 January earn a freeze on 7 January. 8 January is then missed.
const week = completeRun("2026-01-01", 7);

describe("dailyStreak with freezes", () => {
  it("should use a freeze earned on the streak to cover a missed day", () => {
    const days = [...week, completeDay("2026-01-09")];
    const result = streakWith(days, [], "2026-01-10", "2026-01-10T09:00:00Z");

    expect(stateOn(result, "2026-01-08")).toBe("frozen");
    expect(result.current).toBe(8);
    expect(result.freezesUsed).toBe(1);
    expect(result.freezesHeld).toBe(0);
  });

  it("should not count the same streak freeze twice once it is written to the ledger", () => {
    const written = earned("2026-01-07", 1, "daily_streak", "2026-01-07");
    const days = [...week, completeDay("2026-01-09")];
    const result = streakWith(days, [written], "2026-01-10", "2026-01-10T09:00:00Z");

    expect(result.freezesUsed).toBe(1);
    expect(result.freezesHeld).toBe(0);
  });

  it("should reset a missed day when there is no freeze", () => {
    const days = [...completeRun("2026-01-01", 3), completeDay("2026-01-05")];
    const result = streakWith(days, [], "2026-01-06", "2026-01-06T09:00:00Z");

    expect(stateOn(result, "2026-01-04")).toBe("missed");
    expect(result.current).toBe(1);
    expect(result.longest).toBe(3);
  });

  it("should cover only one of two missed days with one freeze, then reset", () => {
    const days = [...week, completeDay("2026-01-10")];
    const result = streakWith(days, [], "2026-01-11", "2026-01-11T09:00:00Z");

    expect(stateOn(result, "2026-01-08")).toBe("frozen");
    expect(stateOn(result, "2026-01-09")).toBe("missed");
    expect(result.current).toBe(1);
    expect(result.longest).toBe(7);
  });

  it("should cover two missed days with two freezes", () => {
    const days = [...week, completeDay("2026-01-10")];
    const result = streakWith(days, [earned("2026-01-05")], "2026-01-11", "2026-01-11T09:00:00Z");

    expect(stateOn(result, "2026-01-08")).toBe("frozen");
    expect(stateOn(result, "2026-01-09")).toBe("frozen");
    expect(result.current).toBe(8);
  });

  it("should not let a freeze earned after the miss save it", () => {
    const days = completeRun("2026-01-01", 3);
    const result = streakWith(days, [earned("2026-01-05")], "2026-01-06", "2026-01-06T09:00:00Z");

    expect(stateOn(result, "2026-01-04")).toBe("missed");
    expect(result.current).toBe(0);
    expect(result.freezesHeld).toBe(1);
  });

  it("should let a freeze earned on the missed day itself save it", () => {
    const days = completeRun("2026-01-01", 3);
    const result = streakWith(days, [earned("2026-01-04")], "2026-01-05", "2026-01-05T12:00:00Z");

    expect(stateOn(result, "2026-01-04")).toBe("frozen");
    expect(result.current).toBe(3);
  });

  it("should not use a freeze while the missed day can still be completed", () => {
    const days = completeRun("2026-01-01", 3);
    const result = streakWith(days, [earned("2026-01-01")], "2026-01-05", "2026-01-05T11:59:00Z");

    expect(stateOn(result, "2026-01-04")).toBe("at_risk");
    expect(result.freezesUsed).toBe(0);
    expect(result.freezesHeld).toBe(1);
  });

  it("should not spend a freeze when there is no streak to keep", () => {
    const result = streakWith([], [earned("2026-01-01", 2)], "2026-01-06", "2026-01-06T09:00:00Z");

    expect(result.freezesUsed).toBe(0);
    expect(result.freezesHeld).toBe(2);
  });

  it("should hold any number of freezes, with no cap", () => {
    const grants = [earned("2026-01-01", 3), earned("2026-01-02", 3), earned("2026-01-03", 9)];
    const result = streakWith([], grants, "2026-01-06", "2026-01-06T09:00:00Z");

    expect(result.freezesHeld).toBe(15);
  });

  it("should keep the streak count when a frozen day sits inside it", () => {
    const days = [...week, completeDay("2026-01-09"), completeDay("2026-01-10")];
    const result = streakWith(days, [], "2026-01-10", "2026-01-10T22:00:00Z");

    expect(result.current).toBe(9);
    expect(result.longest).toBe(9);
  });

  it("should use a freeze for a day still open when today is already complete", () => {
    const days = [...week, completeDay("2026-01-09", "08:00")];
    const result = streakWith(days, [], "2026-01-09", "2026-01-09T08:30:00Z");

    expect(result.current).toBe(8);
  });
});

describe("freezeEventsDue", () => {
  const due = (
    days: StreakDay[],
    ledger: FreezeRow[],
    today: string,
    now: string,
    grants: FreezeRow[] = [],
  ) =>
    freezeEventsDue({
      days,
      ledger,
      grants: grants.map(({ reason, reference, date, count }) => ({
        reason,
        reference,
        date,
        count,
      })),
      trainingWeeks: [],
      weighInWeeks: [],
      today,
      now: new Date(now),
      zone: LONDON,
    });

  it("should earn a freeze for every 7 days in a row, dated on the seventh day", () => {
    expect(due(week, [], "2026-01-08", "2026-01-08T12:00:00Z")).toEqual([
      {
        kind: "earned",
        reason: "daily_streak",
        reference: "2026-01-07",
        date: "2026-01-07",
        count: 1,
      },
    ]);
  });

  it("should earn nothing for six days", () => {
    expect(due(completeRun("2026-01-01", 6), [], "2026-01-07", "2026-01-07T09:00:00Z")).toEqual([]);
  });

  it("should earn a second freeze on the fourteenth day", () => {
    const rows = due(completeRun("2026-01-01", 14), [], "2026-01-15", "2026-01-15T12:00:00Z");

    expect(rows.map((row) => row.reference)).toEqual(["2026-01-07", "2026-01-14"]);
  });

  it("should wait to earn until the seventh day is settled, because it can still be undone", () => {
    expect(due(week, [], "2026-01-07", "2026-01-07T21:30:00Z")).toEqual([]);
    expect(due(week, [], "2026-01-08", "2026-01-08T11:59:00Z")).toEqual([]);
    expect(due(week, [], "2026-01-08", "2026-01-08T12:00:00Z")).toHaveLength(1);
  });

  it("should write a used row for each missed day, in date order", () => {
    const days = [...week, completeDay("2026-01-10")];
    const rows = due(days, [], "2026-01-11", "2026-01-11T09:00:00Z", [earned("2026-01-05")]);

    expect(rows.filter((row) => row.kind === "used")).toEqual([
      { kind: "used", reason: "missed_day", reference: "2026-01-08", date: "2026-01-08", count: 1 },
      { kind: "used", reason: "missed_day", reference: "2026-01-09", date: "2026-01-09", count: 1 },
    ]);
  });

  it("should write nothing when every row is already in the ledger", () => {
    const days = [...week, completeDay("2026-01-10")];
    const first = due(days, [], "2026-01-11", "2026-01-11T09:00:00Z");

    expect(due(days, first, "2026-01-11", "2026-01-11T09:00:00Z")).toEqual([]);
  });

  it("should pass external grants through once, keyed by reason and reference", () => {
    const grant = earned("2026-01-03", 3, "platinum", "badge-9");
    const first = due([], [], "2026-01-04", "2026-01-04T09:00:00Z", [grant]);
    const again = due([], first, "2026-01-04", "2026-01-04T09:00:00Z", [grant]);

    expect(first).toEqual([grant]);
    expect(again).toEqual([]);
  });

  it("should not count a grant twice when it is both in the ledger and given again", () => {
    const grant = earned("2026-01-02", 1, "level", "level-2");
    const rows = due(completeRun("2026-01-01", 3), [grant], "2026-01-07", "2026-01-07T09:00:00Z", [
      grant,
    ]);

    expect(rows.filter((row) => row.kind === "used").map((row) => row.reference)).toEqual([
      "2026-01-04",
    ]);
  });

  it("should use a granted freeze for a missed day in the same run", () => {
    const grant = earned("2026-01-02", 1, "level", "level-2");
    const rows = due(completeRun("2026-01-01", 3), [], "2026-01-06", "2026-01-06T09:00:00Z", [
      grant,
    ]);

    expect(rows.map((row) => `${row.kind}:${row.reference}`)).toEqual([
      "earned:level-2",
      "used:2026-01-04",
    ]);
  });

  it("should not write a used row for a freeze earned after the miss", () => {
    const grant = earned("2026-01-05", 1, "level", "level-2");
    const rows = due(completeRun("2026-01-01", 3), [], "2026-01-06", "2026-01-06T09:00:00Z", [
      grant,
    ]);

    expect(rows.filter((row) => row.kind === "used")).toEqual([]);
  });
});

describe("freezeEventsDue for the weekly streaks", () => {
  const counted = (weekStart: string): WeekRecord => ({ weekStart, achieved: 3, required: 3 });
  const weighedIn = (weekStart: string): WeekRecord => ({ weekStart, achieved: 1, required: 1 });
  const dueFor = (
    trainingWeeks: WeekRecord[],
    weighInWeeks: WeekRecord[],
    today: string,
    ledger: FreezeRow[] = [],
  ) =>
    freezeEventsDue({
      days: [],
      ledger,
      grants: [],
      trainingWeeks,
      weighInWeeks,
      today,
      now: new Date(`${today}T09:00:00Z`),
      zone: LONDON,
    });

  it("should earn a freeze for every week the training streak continues, not for the week it starts", () => {
    const weeks = [counted("2025-12-29"), counted("2026-01-05"), counted("2026-01-12")];

    expect(dueFor(weeks, [], "2026-01-19")).toEqual([
      {
        kind: "earned",
        reason: "training_streak",
        reference: "2026-01-05",
        date: "2026-01-11",
        count: 1,
      },
      {
        kind: "earned",
        reason: "training_streak",
        reference: "2026-01-12",
        date: "2026-01-18",
        count: 1,
      },
    ]);
  });

  it("should not earn for a week that has not ended", () => {
    const weeks = [counted("2026-01-05"), counted("2026-01-12")];

    expect(dueFor(weeks, [], "2026-01-14").map((row) => row.reference)).toEqual([]);
  });

  it("should earn nothing when the training streak was broken in between", () => {
    const weeks = [counted("2025-12-29"), counted("2026-01-12")];

    expect(dueFor(weeks, [], "2026-01-19")).toEqual([]);
  });

  it("should earn a freeze every 4 weeks the weigh-in streak continues", () => {
    const weeks = Array.from({ length: 8 }, (_, at) =>
      weighedIn(addCalendarDays("2025-12-01", at * 7)),
    );

    expect(dueFor([], weeks, "2026-01-26")).toEqual([
      {
        kind: "earned",
        reason: "weigh_in_streak",
        reference: "2025-12-22",
        date: "2025-12-28",
        count: 1,
      },
      {
        kind: "earned",
        reason: "weigh_in_streak",
        reference: "2026-01-19",
        date: "2026-01-25",
        count: 1,
      },
    ]);
  });

  it("should not earn on 3 weigh-in weeks", () => {
    const weeks = [weighedIn("2026-01-05"), weighedIn("2026-01-12"), weighedIn("2026-01-19")];

    expect(dueFor([], weeks, "2026-01-26")).toEqual([]);
  });

  it("should write each weekly freeze once", () => {
    const weeks = [counted("2025-12-29"), counted("2026-01-05")];
    const first = dueFor(weeks, [], "2026-01-12");

    expect(first).toHaveLength(1);
    expect(dueFor(weeks, [], "2026-01-12", first)).toEqual([]);
  });

  it("should let a weekly freeze cover a missed day after it was earned", () => {
    const weeks = [counted("2025-12-29"), counted("2026-01-05")];
    const rows = freezeEventsDue({
      days: [...completeRun("2026-01-12", 2)],
      ledger: [],
      grants: [],
      trainingWeeks: weeks,
      weighInWeeks: [],
      today: "2026-01-16",
      now: new Date("2026-01-16T09:00:00Z"),
      zone: LONDON,
    });

    expect(rows.map((row) => `${row.kind}:${row.reference}`)).toEqual([
      "earned:2026-01-05",
      "used:2026-01-14",
    ]);
  });
});
