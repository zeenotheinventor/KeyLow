import { describe, expect, it } from "vitest";

import { formatClockTime } from "../../../src/dates";
import { defaultLoggedAt } from "../../../src/diary/rules";

const LONDON = "Europe/London";

describe("defaultLoggedAt", () => {
  describe("from the tab bar plus or the search dock on today", () => {
    it("should be now, and the day it is in the zone", () => {
      const now = new Date("2026-10-15T11:40:25Z");

      const result = defaultLoggedAt({ now, viewedDate: "2026-10-15" }, LONDON);

      expect(result.loggedAt.toISOString()).toBe("2026-10-15T11:40:25.000Z");
      expect(result.localDate).toBe("2026-10-15");
    });

    it("should belong to the zone's day, not the UTC day, just after midnight", () => {
      const now = new Date("2026-10-14T23:30:00Z");

      const result = defaultLoggedAt({ now, viewedDate: "2026-10-15" }, LONDON);

      expect(result.loggedAt.toISOString()).toBe("2026-10-14T23:30:00.000Z");
      expect(result.localDate).toBe("2026-10-15");
    });
  });

  describe("from the tab bar plus or the search dock on a past day", () => {
    it("should be the current clock time on the viewed day", () => {
      // 12:40 in London now (11:40 UTC, British Summer Time), viewing Monday 12 October.
      const now = new Date("2026-10-15T11:40:25Z");

      const result = defaultLoggedAt({ now, viewedDate: "2026-10-12" }, LONDON);

      expect(result.loggedAt.toISOString()).toBe("2026-10-12T11:40:00.000Z");
      expect(result.localDate).toBe("2026-10-12");
    });

    it("should keep the clock time across a clock change, not the elapsed hours", () => {
      // 12:40 in London now, viewing 24 October, the day before the clocks go back at 02:00.
      // 25 October 12:40 would be GMT, but the viewed day is still in summer time.
      const now = new Date("2026-10-27T12:40:00Z");

      const result = defaultLoggedAt({ now, viewedDate: "2026-10-24" }, LONDON);

      expect(result.loggedAt.toISOString()).toBe("2026-10-24T11:40:00.000Z");
      expect(result.localDate).toBe("2026-10-24");
    });

    it("should use the viewed day's own offset when the time is in winter and the day in summer", () => {
      const now = new Date("2026-12-15T12:40:00Z");

      const result = defaultLoggedAt({ now, viewedDate: "2026-07-01" }, LONDON);

      expect(result.loggedAt.toISOString()).toBe("2026-07-01T11:40:00.000Z");
    });

    it("should resolve a clock time that does not exist on the viewed day the compatible way", () => {
      // 01:30 in London now (01:30 UTC on 25 October, GMT), viewing 29 March, when 01:30 is skipped.
      const now = new Date("2026-10-25T01:30:10Z");

      const result = defaultLoggedAt({ now, viewedDate: "2026-03-29" }, LONDON);

      expect(result.loggedAt.toISOString()).toBe("2026-03-29T01:30:00.000Z");
      expect(result.localDate).toBe("2026-03-29");
    });
  });

  describe("from an hour's plus", () => {
    it("should be that hour at :00 on the viewed day, whatever the time is now", () => {
      const now = new Date("2026-10-15T14:40:25Z");

      const result = defaultLoggedAt({ now, viewedDate: "2026-10-15", hour: 12 }, LONDON);

      expect(result.loggedAt.toISOString()).toBe("2026-10-15T11:00:00.000Z");
      expect(formatClockTime(result.loggedAt, LONDON)).toBe("12:00");
      expect(result.localDate).toBe("2026-10-15");
    });

    it("should use the viewed day on a past day", () => {
      const now = new Date("2026-10-15T14:40:25Z");

      const result = defaultLoggedAt({ now, viewedDate: "2026-10-12", hour: 8 }, LONDON);

      expect(result.loggedAt.toISOString()).toBe("2026-10-12T07:00:00.000Z");
      expect(result.localDate).toBe("2026-10-12");
    });

    it("should allow hour 0, the start of the day", () => {
      const now = new Date("2026-10-15T14:40:25Z");

      const result = defaultLoggedAt({ now, viewedDate: "2026-10-15", hour: 0 }, LONDON);

      expect(result.loggedAt.toISOString()).toBe("2026-10-14T23:00:00.000Z");
      expect(result.localDate).toBe("2026-10-15");
    });

    it("should resolve the skipped hour 01 on 29 March 2026 to 02:00 summer time, still that day", () => {
      const now = new Date("2026-03-29T10:00:00Z");

      const result = defaultLoggedAt({ now, viewedDate: "2026-03-29", hour: 1 }, LONDON);

      expect(result.loggedAt.toISOString()).toBe("2026-03-29T01:00:00.000Z");
      expect(formatClockTime(result.loggedAt, LONDON)).toBe("02:00");
      expect(result.localDate).toBe("2026-03-29");
    });

    it("should take the first pass of the repeated hour 01 on 25 October 2026", () => {
      const now = new Date("2026-10-25T10:00:00Z");

      const result = defaultLoggedAt({ now, viewedDate: "2026-10-25", hour: 1 }, LONDON);

      expect(result.loggedAt.toISOString()).toBe("2026-10-25T00:00:00.000Z");
    });

    it.each([-1, 24, 1.5])("should reject the hour %s", (hour) => {
      const now = new Date("2026-10-15T14:40:25Z");

      expect(() => defaultLoggedAt({ now, viewedDate: "2026-10-15", hour }, LONDON)).toThrow(
        RangeError,
      );
    });
  });

  it("should follow the zone it is given", () => {
    const now = new Date("2026-10-15T14:40:25Z");

    const result = defaultLoggedAt({ now, viewedDate: "2026-10-15", hour: 12 }, "America/New_York");

    expect(result.loggedAt.toISOString()).toBe("2026-10-15T16:00:00.000Z");
  });

  it("should throw a RangeError for a zone that is not a valid IANA zone", () => {
    const now = new Date("2026-10-15T14:40:25Z");

    expect(() => defaultLoggedAt({ now, viewedDate: "2026-10-15" }, "Not/AZone")).toThrow(
      RangeError,
    );
  });
});
