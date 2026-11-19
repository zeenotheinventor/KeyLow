import { describe, expect, it } from "vitest";

import { completeDay, LONDON } from "./fixtures";
import { dailyStreak } from "../../../src/achievements/streaks";

const factsOn = (localDates: string[], today: string, now: string) =>
  dailyStreak(
    localDates.map((date) => completeDay(date)),
    [],
    today,
    new Date(now),
    LONDON,
  );

describe("backOnTrack", () => {
  it("should be true for a completed day after 3 days off", () => {
    expect(
      factsOn(["2026-01-01", "2026-01-05"], "2026-01-05", "2026-01-05T22:00:00Z").backOnTrack,
    ).toBe(true);
  });

  it("should be false after only 2 days off", () => {
    expect(
      factsOn(["2026-01-01", "2026-01-04"], "2026-01-04", "2026-01-04T22:00:00Z").backOnTrack,
    ).toBe(false);
  });

  it("should be false for the very first completed day", () => {
    expect(factsOn(["2026-01-20"], "2026-01-20", "2026-01-20T22:00:00Z").backOnTrack).toBe(false);
  });

  it("should be false while the days off have not been followed by a completed day", () => {
    expect(factsOn(["2026-01-01"], "2026-01-06", "2026-01-06T22:00:00Z").backOnTrack).toBe(false);
  });

  it("should not be true while the last day off can still be completed", () => {
    const dates = ["2026-01-04", "2026-01-08"];

    expect(factsOn(dates, "2026-01-08", "2026-01-08T09:30:00Z").backOnTrack).toBe(false);
  });

  it("should be true once the last day off is settled at 12:00", () => {
    const dates = ["2026-01-04", "2026-01-08"];

    expect(factsOn(dates, "2026-01-08", "2026-01-08T12:00:00Z").backOnTrack).toBe(true);
  });

  it("should not flip back after being shown, when the last day off is then completed in its window", () => {
    const before = ["2026-01-04", "2026-01-08"];
    const after = [...before, "2026-01-07"];

    expect(factsOn(after, "2026-01-08", "2026-01-08T11:00:00Z").backOnTrack).toBe(false);
  });

  it("should stay true once earned, even when the streak later resets", () => {
    const dates = ["2026-01-01", "2026-01-05", "2026-01-12"];

    expect(factsOn(dates, "2026-01-13", "2026-01-13T22:00:00Z").backOnTrack).toBe(true);
  });
});

describe("weekendRun", () => {
  const weekend = (saturday: string, sunday: string) => [saturday, sunday];
  const fourWeekends = [
    ...weekend("2026-01-03", "2026-01-04"),
    ...weekend("2026-01-10", "2026-01-11"),
    ...weekend("2026-01-17", "2026-01-18"),
    ...weekend("2026-01-24", "2026-01-25"),
  ];

  it("should count consecutive weekends with both days counted", () => {
    expect(factsOn(fourWeekends, "2026-01-26", "2026-01-26T09:00:00Z").weekendRun).toEqual({
      current: 4,
      longest: 4,
    });
  });

  it("should break on a weekend with only one day counted and keep the longest", () => {
    const dates = fourWeekends.filter((date) => date !== "2026-01-18");

    expect(factsOn(dates, "2026-01-26", "2026-01-26T09:00:00Z").weekendRun).toEqual({
      current: 1,
      longest: 2,
    });
  });

  it("should not break a run for a weekend still going, and not count it yet", () => {
    const dates = [...fourWeekends.slice(0, 4), "2026-01-17"];

    expect(factsOn(dates, "2026-01-18", "2026-01-18T09:00:00Z").weekendRun).toEqual({
      current: 2,
      longest: 2,
    });
  });

  it("should count a weekend still going once both days are done", () => {
    const dates = fourWeekends.slice(0, 6);

    expect(factsOn(dates, "2026-01-18", "2026-01-18T22:00:00Z").weekendRun).toEqual({
      current: 3,
      longest: 3,
    });
  });

  it("should break on a Saturday that is settled as missed while Sunday is still to come", () => {
    const dates = fourWeekends.slice(0, 4);

    expect(factsOn(dates, "2026-01-18", "2026-01-18T12:30:00Z").weekendRun).toEqual({
      current: 0,
      longest: 2,
    });
  });

  it("should be zero for a user with no completed weekend", () => {
    expect(factsOn(["2026-01-05"], "2026-01-09", "2026-01-09T09:00:00Z").weekendRun).toEqual({
      current: 0,
      longest: 0,
    });
  });
});
