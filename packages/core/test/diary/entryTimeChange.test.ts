import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { formatClockTime } from "../../src/dates";
import { entryTimeChange } from "../../src/diary";

const London = "Europe/London";
const entry = { logged_at: "2026-10-15T11:40:10.000Z", local_date: "2026-10-15" };

describe("entryTimeChange", () => {
  it("should be nothing while the row reads the entry's own time", () => {
    expect(entryTimeChange(entry, "12:40", London)).toBeUndefined();
  });

  it("should not write an unchanged time back, so the entry's seconds keep its place", () => {
    expect(entryTimeChange(entry, formatClockTime(new Date(entry.logged_at), "UTC"), "UTC")).toBe(
      undefined,
    );
  });

  it("should write a changed time on the entry's own day, in the profile's zone", () => {
    expect(entryTimeChange(entry, "08:30", London)).toEqual({
      loggedAt: "2026-10-15T07:30:00.000Z",
      timeZone: London,
    });
  });

  it("should read the time in the zone it is given, not London", () => {
    expect(entryTimeChange(entry, "08:30", "America/New_York")).toEqual({
      loggedAt: "2026-10-15T12:30:00.000Z",
      timeZone: "America/New_York",
    });
  });

  it("should write a time that the zone puts on another date as that instant", () => {
    expect(entryTimeChange(entry, "00:30", "Pacific/Auckland")).toEqual({
      loggedAt: "2026-10-14T11:30:00.000Z",
      timeZone: "Pacific/Auckland",
    });
  });

  it("should be nothing for any entry whose own clock time is given back", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2026-01-01"), max: new Date("2026-12-31"), noInvalidDate: true }),
        fc.constantFrom(London, "UTC", "America/New_York", "Pacific/Auckland"),
        (instant, timeZone) => {
          const logged = { logged_at: instant.toISOString(), local_date: "2026-06-15" };

          expect(entryTimeChange(logged, formatClockTime(instant, timeZone), timeZone)).toBe(
            undefined,
          );
        },
      ),
    );
  });
});
