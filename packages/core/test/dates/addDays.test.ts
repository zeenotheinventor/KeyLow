import { describe, expect, it } from "vitest";

import { addDays, toLocalDate } from "../../src/dates";

describe("addDays", () => {
  it("should move forward by whole days", () => {
    expect(addDays(new Date("2026-10-15T12:00:00Z"), 1, "UTC").toISOString()).toBe(
      "2026-10-16T12:00:00.000Z",
    );
  });

  it("should move back by whole days", () => {
    expect(addDays(new Date("2026-10-15T12:00:00Z"), -1, "UTC").toISOString()).toBe(
      "2026-10-14T12:00:00.000Z",
    );
  });

  it("should cross a month end", () => {
    const next = addDays(new Date("2026-10-31T12:00:00Z"), 1, "UTC");

    expect(toLocalDate(next, "UTC")).toBe("2026-11-01");
  });

  it("should land on the next calendar day from midnight when the clocks go back", () => {
    // 00:00 on Sunday 25 October 2026 in London is 23:00 UTC on the 24th, and that day is 25 hours long.
    const midnight = new Date("2026-10-24T23:00:00Z");

    const next = addDays(midnight, 1, "Europe/London");

    expect(next.toISOString()).toBe("2026-10-26T00:00:00.000Z");
  });

  it("should land on the previous calendar day from midnight when the clocks went forward", () => {
    // 00:00 on Monday 30 March 2026 in London is 23:00 UTC on the 29th, the day after the 23 hour day.
    const midnight = new Date("2026-03-29T23:00:00Z");

    const previous = addDays(midnight, -1, "Europe/London");

    expect(previous.toISOString()).toBe("2026-03-29T00:00:00.000Z");
  });

  it("should step back an hour of the clock when a day forward would overshoot into the day after", () => {
    // 23:30 on 28 March 2026 in London plus 24 hours is 00:30 on the 30th, because the 29th has 23 hours.
    const lateEvening = new Date("2026-03-28T23:30:00Z");

    const next = addDays(lateEvening, 1, "Europe/London");

    expect(next.toISOString()).toBe("2026-03-29T22:30:00.000Z");
  });

  it("should step back an hour of the clock when a day back would overshoot into the day after", () => {
    // 23:30 on 25 October 2026 in London minus 24 hours is 00:30 on the 25th, because the 25th has 25 hours.
    const lateEvening = new Date("2026-10-25T23:30:00Z");

    const previous = addDays(lateEvening, -1, "Europe/London");

    expect(previous.toISOString()).toBe("2026-10-24T22:30:00.000Z");
  });
});
