import { describe, expect, it } from "vitest";

import { describeProjectedAssumption } from "../../src/copy";
import { plannedSessionsOf } from "../../src/training";

import type { PlannedSessionSource } from "../../src/training";

const dayOf = (
  date: string,
  status: PlannedSessionSource["status"],
  plannedDayName: string | null,
): PlannedSessionSource => ({ date, status, plannedDayName });

// Thursday 15 October is today in the golden week, and Saturday's Push is still to do.
const week = [
  dayOf("2026-10-12", "logged", "Push"),
  dayOf("2026-10-13", "logged", "Pull"),
  dayOf("2026-10-15", "today", "Legs"),
  dayOf("2026-10-16", "planned", "Upper"),
  dayOf("2026-10-17", "planned", "Push"),
  dayOf("2026-10-18", "rest", null),
];

describe("plannedSessionsOf", () => {
  it("should count the planned sessions from the day after today up to the day shown", () => {
    expect(plannedSessionsOf(week, "2026-10-15", "2026-10-17")).toStrictEqual([
      { localDate: "2026-10-16", routineDayName: "Upper" },
      { localDate: "2026-10-17", routineDayName: "Push" },
    ]);
  });

  it("should count none on today, which shows what is logged", () => {
    expect(plannedSessionsOf(week, "2026-10-15", "2026-10-15")).toStrictEqual([]);
  });

  it("should not count a planned day that is today or earlier, since it counts from the day after", () => {
    const late = [
      dayOf("2026-10-13", "planned", "Pull"),
      dayOf("2026-10-15", "planned", "Legs"),
      dayOf("2026-10-16", "planned", "Upper"),
    ];

    expect(plannedSessionsOf(late, "2026-10-15", "2026-10-15")).toStrictEqual([]);
    expect(plannedSessionsOf(late, "2026-10-15", "2026-10-16")).toStrictEqual([
      { localDate: "2026-10-16", routineDayName: "Upper" },
    ]);
  });

  it("should leave out a day that is not planned, and a planned day past the day shown", () => {
    expect(plannedSessionsOf(week, "2026-10-15", "2026-10-16")).toStrictEqual([
      { localDate: "2026-10-16", routineDayName: "Upper" },
    ]);
  });

  it("should feed the assumption line of the side by side view", () => {
    expect(describeProjectedAssumption(plannedSessionsOf(week, "2026-10-15", "2026-10-17"))).toBe(
      "If you do Friday's Upper and Saturday's Push",
    );
  });
});
