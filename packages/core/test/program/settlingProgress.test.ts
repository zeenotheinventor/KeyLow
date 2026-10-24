import { describe, expect, it } from "vitest";

import { runCheckin, snapshotOf } from "./checkinRows";
import { settlingProgress } from "../../src/program";
import { goldenCheckinFixture, ineligibleCheckinFixture } from "../../src/testing";

import type { CheckinResult } from "../../src/engine";
import type { ProgramSnapshot } from "../../src/program";

/*
 * Settling lasts while the start snapshot is the newest snapshot (ADR 0002, Amendment 2, "The start
 * snapshot and the schedule", points 3 and 4): any check-in snapshot, eligible or not, ends it.
 */

const START = { kind: "start", asOfDate: "2026-10-23" } as const;
const FIRST_CHECKIN = "2026-11-06";

/** A check-in snapshot of the fixture, moved to the first check-in's date, so that it is newer than `START`. */
function checkinOnFirstCheckinDate(result: CheckinResult): ProgramSnapshot {
  return { ...snapshotOf(result), asOfDate: FIRST_CHECKIN };
}
const PROGRAM = { nextCheckinDate: FIRST_CHECKIN };

describe("settlingProgress", () => {
  it("should be settling on day 3 after the start, with 11 days left", () => {
    expect(settlingProgress(PROGRAM, [START], "2026-10-26")).toEqual({
      settling: true,
      firstCheckinDate: "2026-11-06",
      daysLeft: 11,
    });
  });

  it("should have 14 days left on the day the schedule was set", () => {
    expect(settlingProgress(PROGRAM, [START], "2026-10-23").daysLeft).toBe(14);
  });

  it("should have 0 days left on the first check-in day", () => {
    expect(settlingProgress(PROGRAM, [START], FIRST_CHECKIN)).toEqual({
      settling: true,
      firstCheckinDate: "2026-11-06",
      daysLeft: 0,
    });
  });

  it("should not count below 0 when the check-in is overdue", () => {
    expect(settlingProgress(PROGRAM, [START], "2026-11-08").daysLeft).toBe(0);
  });

  it("should stop settling after a first check-in that measured", () => {
    const measured = checkinOnFirstCheckinDate(runCheckin(goldenCheckinFixture("2026-04-02"), 14));

    expect(measured.measurement?.eligible).toBe(true);
    expect(
      settlingProgress({ nextCheckinDate: "2026-11-13" }, [START, measured], "2026-11-07"),
    ).toEqual({ settling: false, firstCheckinDate: null, daysLeft: null });
  });

  it("should stop settling after a first check-in that could not measure", () => {
    const notMeasured = checkinOnFirstCheckinDate(
      runCheckin(ineligibleCheckinFixture("2026-04-02"), 14),
    );

    expect(notMeasured.measurement?.eligible).toBe(false);
    expect(
      settlingProgress({ nextCheckinDate: "2026-11-13" }, [START, notMeasured], "2026-11-07"),
    ).toEqual({ settling: false, firstCheckinDate: null, daysLeft: null });
  });

  it("should read the newest snapshot whatever order the snapshots come in", () => {
    const checkin = { kind: "checkin", asOfDate: "2026-11-06" } as const;

    expect(settlingProgress(PROGRAM, [checkin, START], "2026-11-07").settling).toBe(false);
    expect(settlingProgress(PROGRAM, [START, checkin], "2026-11-07").settling).toBe(false);
  });

  it("should settle again when a new start snapshot is newer than an old check-in", () => {
    const oldCheckin = { kind: "checkin", asOfDate: "2026-08-01" } as const;

    expect(settlingProgress(PROGRAM, [oldCheckin, START], "2026-10-26").settling).toBe(true);
  });

  it("should settle with no snapshot yet, between the wizard save and the first recompute", () => {
    expect(settlingProgress(PROGRAM, [], "2026-10-26")).toEqual({
      settling: true,
      firstCheckinDate: "2026-11-06",
      daysLeft: 11,
    });
  });

  it("should settle with no snapshot and no schedule, with nothing to count down", () => {
    expect(settlingProgress({ nextCheckinDate: null }, [], "2026-10-26")).toEqual({
      settling: true,
      firstCheckinDate: null,
      daysLeft: null,
    });
  });

  it("should let a check-in win over a start snapshot of the same date, whatever the order", () => {
    const checkin = { kind: "checkin", asOfDate: "2026-10-23" } as const;

    expect(settlingProgress(PROGRAM, [START, checkin], "2026-10-26").settling).toBe(false);
    expect(settlingProgress(PROGRAM, [checkin, START], "2026-10-26").settling).toBe(false);
  });

  it("should settle with no first check-in date while the schedule is not set", () => {
    expect(settlingProgress({ nextCheckinDate: null }, [START], "2026-10-26")).toEqual({
      settling: true,
      firstCheckinDate: null,
      daysLeft: null,
    });
  });
});
