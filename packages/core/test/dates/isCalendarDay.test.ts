import { describe, expect, it } from "vitest";

import { isCalendarDay } from "../../src/dates";

describe("isCalendarDay", () => {
  it.each(["2026-10-14", "2026-02-28", "2028-02-29", "2026-12-31"])("should accept %s", (text) => {
    expect(isCalendarDay(text)).toBe(true);
  });

  it.each([
    "",
    "2026-10-1",
    "26-10-14",
    "2026/10/14",
    "2026-13-01",
    "2026-00-10",
    "2026-02-29",
    "2026-04-31",
    "2026-10-14T00:00",
    " 2026-10-14",
  ])("should refuse %j", (text) => {
    expect(isCalendarDay(text)).toBe(false);
  });
});
