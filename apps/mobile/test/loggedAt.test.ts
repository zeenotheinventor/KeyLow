import { clockTimeOn, openingLoggedAt } from "../lib/loggedAt";

// 15 October 2026, 11:40 UTC, which is 12:40 in London (British Summer Time).
const now = new Date("2026-10-15T11:40:30Z");
const london = "Europe/London";

describe("openingLoggedAt", () => {
  it("should be now, with the clock time, from the dock or the centre plus on today", () => {
    expect(openingLoggedAt(now, { day: "2026-10-15" }, london)).toEqual({
      loggedAt: now,
      localDate: "2026-10-15",
      clockTime: "12:40",
    });
  });

  it("should be the current clock time on a past day", () => {
    const { loggedAt, localDate, clockTime } = openingLoggedAt(now, { day: "2026-10-14" }, london);

    expect(localDate).toBe("2026-10-14");
    expect(clockTime).toBe("12:40");
    expect(loggedAt.toISOString()).toBe("2026-10-14T11:40:00.000Z");
  });

  it("should be the hour of an hour's plus, on the hour", () => {
    const { loggedAt, localDate, clockTime } = openingLoggedAt(
      now,
      { day: "2026-10-14", time: "12:00" },
      london,
    );

    expect(localDate).toBe("2026-10-14");
    expect(clockTime).toBe("12:00");
    expect(loggedAt.toISOString()).toBe("2026-10-14T11:00:00.000Z");
  });

  it("should use the hour of the time and drop its minutes, because an hour's plus is always on the hour", () => {
    expect(openingLoggedAt(now, { day: "2026-10-15", time: "08:30" }, london).clockTime).toBe(
      "08:00",
    );
  });

  it("should be now on today when there is no log context at all", () => {
    expect(openingLoggedAt(now, undefined, london)).toEqual({
      loggedAt: now,
      localDate: "2026-10-15",
      clockTime: "12:40",
    });
  });

  it("should take the day of the zone and not of the instant", () => {
    const lateEvening = new Date("2026-10-15T23:30:00Z");

    expect(openingLoggedAt(lateEvening, undefined, london).localDate).toBe("2026-10-16");
  });
});

describe("clockTimeOn", () => {
  it("should be the instant the zone's clock reads that time on that day", () => {
    const { loggedAt, localDate } = clockTimeOn("2026-10-14", "17:25", london);

    expect(loggedAt.toISOString()).toBe("2026-10-14T16:25:00.000Z");
    expect(localDate).toBe("2026-10-14");
  });

  it("should belong to the day it was asked for, also at the ends of it", () => {
    expect(clockTimeOn("2026-10-14", "00:00", london).localDate).toBe("2026-10-14");
    expect(clockTimeOn("2026-10-14", "23:59", london).localDate).toBe("2026-10-14");
  });

  it("should use Greenwich Mean Time after the clocks go back", () => {
    expect(clockTimeOn("2026-12-01", "12:00", london).loggedAt.toISOString()).toBe(
      "2026-12-01T12:00:00.000Z",
    );
  });

  it("should refuse a time that is not a 24-hour time", () => {
    expect(() => clockTimeOn("2026-10-14", "25:00", london)).toThrow(RangeError);
  });
});
