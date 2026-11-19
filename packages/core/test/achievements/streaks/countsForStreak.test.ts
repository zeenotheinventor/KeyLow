import { describe, expect, it } from "vitest";

import {
  DAY_COMPLETE_CUTOFF_HOUR,
  countsForStreak,
  dayCompleteCutoff,
  isBeforeDayCompleteCutoff,
} from "../../../src/achievements/streaks";

import type { StreakDay } from "../../../src/achievements/streaks";

const LONDON = "Europe/London";

const completedAt = (instant: string): StreakDay => ({
  localDate: "2026-03-02",
  isComplete: true,
  completedAt: instant,
  entryCount: 3,
});

describe("countsForStreak", () => {
  it("should count a day completed at 23:59 on the day itself", () => {
    expect(countsForStreak(completedAt("2026-03-02T23:59:00+00:00"), LONDON)).toBe(true);
  });

  it("should count a day completed at 11:59 the next day", () => {
    expect(countsForStreak(completedAt("2026-03-03T11:59:00+00:00"), LONDON)).toBe(true);
  });

  it("should not count a day completed at 12:00 the next day", () => {
    expect(countsForStreak(completedAt("2026-03-03T12:00:00+00:00"), LONDON)).toBe(false);
  });

  it("should not count a day completed after the window, as when it is undone and redone", () => {
    expect(countsForStreak(completedAt("2026-03-03T18:30:00+00:00"), LONDON)).toBe(false);
  });

  it("should not count a day with no entries", () => {
    expect(
      countsForStreak({ ...completedAt("2026-03-02T21:00:00+00:00"), entryCount: 0 }, LONDON),
    ).toBe(false);
  });

  it("should not count a day that is not complete", () => {
    expect(
      countsForStreak(
        { localDate: "2026-03-02", isComplete: false, completedAt: null, entryCount: 3 },
        LONDON,
      ),
    ).toBe(false);
  });

  it("should not count a complete day that has no completion time", () => {
    expect(
      countsForStreak(
        { localDate: "2026-03-02", isComplete: true, completedAt: null, entryCount: 3 },
        LONDON,
      ),
    ).toBe(false);
  });

  it("should read the cutoff in the zone, so 11:59 in New York counts and 12:00 does not", () => {
    // 2026-03-03 is before the US clocks go forward, so New York is UTC-5.
    expect(countsForStreak(completedAt("2026-03-03T11:59:00-05:00"), "America/New_York")).toBe(
      true,
    );
    expect(countsForStreak(completedAt("2026-03-03T12:00:00-05:00"), "America/New_York")).toBe(
      false,
    );
  });

  it("should read the cutoff on British Summer Time clocks", () => {
    const day = { ...completedAt("x"), localDate: "2026-03-30" };

    expect(countsForStreak({ ...day, completedAt: "2026-03-31T11:59:00+01:00" }, LONDON)).toBe(
      true,
    );
    expect(countsForStreak({ ...day, completedAt: "2026-03-31T12:00:00+01:00" }, LONDON)).toBe(
      false,
    );
  });
});

describe("dayCompleteCutoff", () => {
  it("should be noon on the next local day, written out as a literal", () => {
    expect(DAY_COMPLETE_CUTOFF_HOUR).toBe(12);
    expect(dayCompleteCutoff("2026-03-02", LONDON).toISOString()).toBe("2026-03-03T12:00:00.000Z");
  });

  it("should move with the clocks when they go forward", () => {
    // 29 March 2026 is the day British Summer Time starts, so noon on 30 March is 11:00 UTC.
    expect(dayCompleteCutoff("2026-03-29", LONDON).toISOString()).toBe("2026-03-30T11:00:00.000Z");
  });
});

describe("isBeforeDayCompleteCutoff", () => {
  const zones = [
    "Europe/London",
    "America/New_York",
    "Pacific/Kiritimati",
    "Pacific/Pago_Pago",
    "Asia/Kolkata",
    "Australia/Lord_Howe",
  ];
  const localDates = ["2026-01-15", "2026-03-28", "2026-03-29", "2026-10-24", "2026-10-25"];

  it("should agree with the exact cutoff in every zone, a millisecond either side and far from it", () => {
    for (const zone of zones) {
      for (const localDate of localDates) {
        const cutoff = dayCompleteCutoff(localDate, zone).getTime();
        for (const instant of [
          cutoff - 86_400_000,
          cutoff - 1,
          cutoff,
          cutoff + 1,
          cutoff + 86_400_000,
        ]) {
          expect(
            isBeforeDayCompleteCutoff(instant, localDate, zone),
            `${zone} ${localDate} ${instant - cutoff}`,
          ).toBe(instant < cutoff);
        }
      }
    }
  });
});
