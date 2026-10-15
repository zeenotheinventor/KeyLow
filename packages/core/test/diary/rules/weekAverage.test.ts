import { describe, expect, it } from "vitest";

import { weekAverage } from "../../../src/diary/rules/weekAverage";

import type { WeekAverageDay } from "../../../src/diary/rules/weekAverage";

const totals = (kcal: number, protein_g: number, carbs_g: number, fat_g: number) => ({
  kcal,
  protein_g,
  carbs_g,
  fat_g,
});

// The week of Monday 12 October 2026 on the web diary board, today the Thursday.
const monday = { localDate: "2026-10-12", totals: totals(2140, 158, 214, 66) };
const tuesday = { localDate: "2026-10-13", totals: totals(2260, 149, 231, 74) };
const wednesday = { localDate: "2026-10-14", totals: totals(1286, 111, 129, 35) };
const thursday = { localDate: "2026-10-15", totals: totals(1039, 86, 129, 19) };
const friday = { localDate: "2026-10-16", totals: null };

describe("weekAverage", () => {
  it("should average the days from Monday to today", () => {
    const days: WeekAverageDay[] = [monday, tuesday, wednesday, thursday, friday];

    expect(weekAverage(days, "2026-10-15")).toEqual(totals(1681.25, 126, 175.75, 48.5));
  });

  it("should leave out the days after today, even when they hold entries", () => {
    const logged = { localDate: "2026-10-16", totals: totals(5000, 1, 1, 1) };

    expect(weekAverage([monday, tuesday, logged], "2026-10-15")).toEqual(
      totals(2200, 153.5, 222.5, 70),
    );
  });

  it("should leave out a day up to today that has no entries, so a day not tracked does not pull it down", () => {
    const untracked = { localDate: "2026-10-13", totals: null };

    expect(weekAverage([monday, untracked, wednesday], "2026-10-15")).toEqual(
      totals(1713, 134.5, 171.5, 50.5),
    );
  });

  it("should be null when no day up to today has entries", () => {
    expect(
      weekAverage([{ localDate: "2026-10-12", totals: null }, friday], "2026-10-15"),
    ).toBeNull();
  });

  it("should count today", () => {
    expect(weekAverage([thursday], "2026-10-15")).toEqual(totals(1039, 86, 129, 19));
  });
});
