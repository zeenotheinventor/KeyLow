import { describe, expect, it } from "vitest";

import { formatDateTime } from "../../src/dates";

describe("formatDateTime", () => {
  it.each([
    ["the date and time in UTC", "2026-10-15T10:00:00Z", "UTC", "15 Oct 2026, 10:00"],
    [
      "a zone ahead of UTC, where both the date and the time move",
      "2026-10-15T23:30:00Z",
      "Pacific/Auckland",
      "16 Oct 2026, 12:30",
    ],
    [
      "a zone behind UTC, where the date goes back across midnight",
      "2026-10-16T01:15:00Z",
      "America/Los_Angeles",
      "15 Oct 2026, 18:15",
    ],
    [
      "midnight, with no leading zero on the day and two digits for the clock",
      "2026-10-06T00:05:00Z",
      "UTC",
      "6 Oct 2026, 00:05",
    ],
    ["the last minute of the year", "2026-12-31T23:59:59Z", "UTC", "31 Dec 2026, 23:59"],
  ])("should give %s", (_case, instant, timeZone, expected) => {
    expect(formatDateTime(new Date(instant), timeZone)).toBe(expected);
  });
});
