import { daysSinceMonday } from "@keylow/core/dates";
import { describe, expect, it } from "vitest";

import { mondayOf } from "../src/trainingWorld.ts";

// The week reads of the repos refuse a day that is not a Monday ("A training week must start on a Monday"), and
// the eval user's anchor date is today, which is any weekday, so every read of a week goes through `mondayOf`.
describe("mondayOf", () => {
  it("should give the Monday of the week for each weekday, Sunday last", () => {
    const week = [
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
    ];

    expect(week.map(mondayOf)).toEqual(week.map(() => "2026-11-02"));
  });

  it("should give a Monday for any day of a year, across a month and a year end", () => {
    for (let day = 0; day < 366; day += 1) {
      const date = new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10);

      expect(daysSinceMonday(mondayOf(date))).toBe(0);
    }
    expect(mondayOf("2027-01-01")).toBe("2026-12-28");
  });
});
