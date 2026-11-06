import { describe, expect, it } from "vitest";

import { plateLoggedAt } from "../../src/plate";

// Wednesday 14 October 2026, 19:20 in London (BST), which is 18:20 UTC.
const now = new Date("2026-10-14T18:20:00.000Z");
const London = "Europe/London";

describe("plateLoggedAt", () => {
  it("should be the moment of the press on today when the time is Now and no day is given", () => {
    expect(plateLoggedAt({ now, day: undefined, time: { isNow: true }, timeZone: London })).toEqual(
      { loggedAt: now, localDate: "2026-10-14" },
    );
  });

  it("should be the current clock time on a past day when the time is Now", () => {
    const logged = plateLoggedAt({
      now,
      day: "2026-10-12",
      time: { isNow: true },
      timeZone: London,
    });

    expect(logged.loggedAt.toISOString()).toBe("2026-10-12T18:20:00.000Z");
    expect(logged.localDate).toBe("2026-10-12");
  });

  it("should be the chosen clock time on the plate's day, read in the profile's zone", () => {
    const logged = plateLoggedAt({
      now,
      day: "2026-10-14",
      time: { isNow: false, time: "19:20" },
      timeZone: London,
    });

    expect(logged.loggedAt.toISOString()).toBe("2026-10-14T18:20:00.000Z");
    expect(logged.localDate).toBe("2026-10-14");
  });

  it("should read a chosen time on today when no day is given", () => {
    const logged = plateLoggedAt({
      now,
      day: undefined,
      time: { isNow: false, time: "08:05" },
      timeZone: London,
    });

    expect(logged.loggedAt.toISOString()).toBe("2026-10-14T07:05:00.000Z");
    expect(logged.localDate).toBe("2026-10-14");
  });

  it("should read the clock in UTC when that is the zone", () => {
    const logged = plateLoggedAt({
      now,
      day: "2026-10-14",
      time: { isNow: false, time: "12:00" },
      timeZone: "UTC",
    });

    expect(logged.loggedAt.toISOString()).toBe("2026-10-14T12:00:00.000Z");
  });

  it("should move the day when the zone's clock time falls on another UTC day", () => {
    const logged = plateLoggedAt({
      now,
      day: "2026-10-14",
      time: { isNow: false, time: "00:30" },
      timeZone: "Pacific/Auckland",
    });

    expect(logged.localDate).toBe("2026-10-14");
    expect(logged.loggedAt.toISOString()).toBe("2026-10-13T11:30:00.000Z");
  });
});
