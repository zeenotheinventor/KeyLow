import { describe, expect, it } from "vitest";

import {
  WEEK_GRID,
  describeWeekGridBarName,
  describeWeekGridBarValue,
  describeWeekGridDay,
  describeWeekGridMacros,
  describeWeekGridTitle,
} from "../../src/copy";

describe("the week view's words", () => {
  it("should name the states as the board writes them", () => {
    expect(WEEK_GRID.complete).toBe("Complete");
    expect(WEEK_GRID.incomplete).toBe("Incomplete");
    expect(WEEK_GRID.noEntries).toBe("No entries yet");
    expect(WEEK_GRID.average).toBe("Average");
    expect(WEEK_GRID.averageCaption).toBe("Mon to today");
  });

  it("should write a day as its short weekday and date", () => {
    expect(describeWeekGridDay("2026-10-12")).toBe("Mon 12");
    expect(describeWeekGridDay("2026-10-18")).toBe("Sun 18");
  });

  it("should title the week by its Monday, with a short month", () => {
    expect(describeWeekGridTitle("2026-10-12")).toBe("Week of Mon 12 Oct");
    expect(describeWeekGridTitle("2026-12-28")).toBe("Week of Mon 28 Dec");
  });

  it("should always list the macros as P, C, F with one unit at the end", () => {
    expect(describeWeekGridMacros({ protein_g: 158, carbs_g: 214, fat_g: 66 })).toBe(
      "P 158 · C 214 · F 66 g",
    );
    expect(describeWeekGridMacros({ protein_g: 5.55, carbs_g: 0, fat_g: 9.04 })).toBe(
      "P 5.6 · C 0 · F 9 g",
    );
  });

  it("should name a day's calories bar for the day", () => {
    expect(describeWeekGridBarName("Mon 12")).toBe("Mon 12 calories");
    expect(describeWeekGridBarName("Average")).toBe("Average calories");
  });

  it("should say what the bar holds against the target, and when it is over", () => {
    expect(describeWeekGridBarValue(2140, 2200)).toBe("2,140 of 2,200 kilocalories");
    expect(describeWeekGridBarValue(2260, 2200)).toBe("2,260 of 2,200 kilocalories, over target");
    expect(describeWeekGridBarValue(2200, 2200)).toBe("2,200 of 2,200 kilocalories");
  });
});
