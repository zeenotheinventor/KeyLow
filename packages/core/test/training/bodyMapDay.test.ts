import { describe, expect, it } from "vitest";

import { actualReadDateOf, bodyMapViewOf, heatDateOf, selectedDateOf } from "../../src/training";

// The golden week: Monday 12 to Sunday 18 October 2026, and Thursday 15 is today.
const WEEK_START = "2026-10-12";
const TODAY = "2026-10-15";

describe("heatDateOf", () => {
  it.each(["2026-10-12", "2026-10-13", "2026-10-16", "2026-10-18"])(
    "should take %s, a day of the week other than today",
    (day) => {
      expect(heatDateOf(day, TODAY, WEEK_START)).toBe(day);
    },
  );

  it("should read today as no day at all, so it follows the clock", () => {
    expect(heatDateOf(TODAY, TODAY, WEEK_START)).toBeUndefined();
  });

  it.each([
    ["the day before the week", "2026-10-11"],
    ["the Monday after the week", "2026-10-19"],
    ["a day of the week with text after it", "2026-10-14x"],
    ["a day of the week with text before it", " 2026-10-14"],
    ["a date that does not exist", "2026-02-30"],
    ["text", "banana"],
    ["nothing", ""],
    ["a parameter given twice", ["2026-10-14", "2026-10-15"]],
    ["a number", 20261014],
    ["null", null],
    ["undefined", undefined],
  ])("should never take %s, so it is never sent to a read", (_name, candidate) => {
    expect(heatDateOf(candidate, TODAY, WEEK_START)).toBeUndefined();
  });
});

describe("bodyMapViewOf", () => {
  it("should show Projected when it was chosen and there is a routine", () => {
    expect(bodyMapViewOf("projected", true)).toBe("projected");
  });

  it("should show Actual when Projected was chosen and there is no routine", () => {
    expect(bodyMapViewOf("projected", false)).toBe("actual");
  });

  it.each([true, false])("should show Actual when Actual was chosen (routine: %s)", (routine) => {
    expect(bodyMapViewOf("actual", routine)).toBe("actual");
  });

  it("should show Actual while the routine is not known", () => {
    expect(bodyMapViewOf("projected", undefined)).toBe("actual");
  });
});

describe("actualReadDateOf", () => {
  it("should read Actual at a day before today", () => {
    expect(actualReadDateOf("2026-10-13", TODAY, false)).toBe("2026-10-13");
  });

  it("should never ask Actual for a day after today on its own", () => {
    expect(actualReadDateOf("2026-10-17", TODAY, false)).toBeUndefined();
  });

  it("should ask Actual for a day after today when the side by side view shows both", () => {
    expect(actualReadDateOf("2026-10-17", TODAY, true)).toBe("2026-10-17");
  });

  it("should read Actual now when no day is picked", () => {
    expect(actualReadDateOf(undefined, TODAY, true)).toBeUndefined();
  });
});

describe("selectedDateOf", () => {
  const days = [
    { date: "2026-10-13", selectable: true },
    { date: "2026-10-15", selectable: true },
    { date: "2026-10-17", selectable: false },
  ];

  it("should be the day picked when the view shown can choose it", () => {
    expect(selectedDateOf("2026-10-13", days, TODAY)).toBe("2026-10-13");
  });

  it("should fall back to today when the view shown cannot choose the day", () => {
    expect(selectedDateOf("2026-10-17", days, TODAY)).toBe(TODAY);
  });

  it("should fall back to today when the days do not hold it", () => {
    expect(selectedDateOf("2026-10-14", days, TODAY)).toBe(TODAY);
  });

  it("should be today when no day is picked, and while the days are not read", () => {
    expect(selectedDateOf(undefined, days, TODAY)).toBe(TODAY);
    expect(selectedDateOf("2026-10-13", [], TODAY)).toBe(TODAY);
  });
});
