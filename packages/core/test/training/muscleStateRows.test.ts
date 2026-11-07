import { describe, expect, it } from "vitest";

import { MUSCLE_IDS, currentMuscleState, muscleStateRows } from "../../src/training";

import type { HeatSet } from "../../src/training";

const NOW = "2026-10-14T12:00:00+00:00";
const NINE_HOURS_AGO = "2026-10-14T03:00:00+00:00";
const SIX_DAYS_AGO = "2026-10-08T18:00:00+00:00";

const workingSet = (
  performedAt: string,
  muscles: { muscle_id: "lats" | "biceps" | "quads"; weight: number }[],
): HeatSet => ({
  set_type: "working",
  rir: 0,
  rpe: null,
  performed_at: performedAt,
  deleted_at: null,
  snapshot: { muscles: muscles.map((muscle) => ({ ...muscle, role: "primary" })) },
});

const sets = [
  ...Array.from({ length: 10 }, () =>
    workingSet(NINE_HOURS_AGO, [{ muscle_id: "lats", weight: 1 }]),
  ),
  ...Array.from({ length: 8 }, () => workingSet(SIX_DAYS_AGO, [{ muscle_id: "lats", weight: 1 }])),
  workingSet(SIX_DAYS_AGO, [{ muscle_id: "biceps", weight: 0.5 }]),
];
const states = currentMuscleState(sets, NOW);
const ALL = new Set(MUSCLE_IDS);

describe("muscleStateRows", () => {
  it("should give one row for each of the 22 muscles, in the order of the muscle list", () => {
    const { rows } = muscleStateRows(states, {
      now: NOW,
      timeZone: "UTC",
      area: null,
      targeted: ALL,
    });

    expect(rows).toHaveLength(22);
    expect(rows[0]?.muscle).toBe("Upper chest");
    expect(rows[21]?.muscle).toBe("Neck");
  });

  it("should word a muscle's heat, ready time, sets, target and status as the body map does", () => {
    const { rows } = muscleStateRows(states, {
      now: NOW,
      timeZone: "UTC",
      area: null,
      targeted: ALL,
    });

    const lats = rows.find((row) => row.muscle === "Lats");
    expect(lats).toMatchObject({
      heat: "Very hot",
      sets: 18,
      target: 10,
      status: "Productive",
    });
    expect(lats?.heat_percent).toBe(Math.round(states.lats.heat * 100));
  });

  it("should say now for a muscle that is ready, and a weekday and local time for one that is not", () => {
    const { rows } = muscleStateRows(states, {
      now: NOW,
      timeZone: "Europe/London",
      area: null,
      targeted: ALL,
    });

    expect(rows.find((row) => row.muscle === "Neck")?.ready_at).toBe("now");
    expect(rows.find((row) => row.muscle === "Lats")?.ready_at).toMatch(
      /^[A-Z][a-z]{2} \d\d:\d\d$/,
    );
  });

  it("should read the ready time in the user's zone", () => {
    const utc = muscleStateRows(states, { now: NOW, timeZone: "UTC", area: null, targeted: ALL });
    const tokyo = muscleStateRows(states, {
      now: NOW,
      timeZone: "Asia/Tokyo",
      area: null,
      targeted: ALL,
    });

    const hourOf = (rows: typeof utc.rows) =>
      Number(rows.find((row) => row.muscle === "Lats")?.ready_at.slice(-5, -3));
    expect((hourOf(tokyo.rows) - hourOf(utc.rows) + 24) % 24).toBe(9);
  });

  it("should round the sets as the body map does, to two decimals at most", () => {
    const { rows } = muscleStateRows(states, {
      now: NOW,
      timeZone: "UTC",
      area: null,
      targeted: ALL,
    });

    expect(rows.find((row) => row.muscle === "Biceps")?.sets).toBe(0.5);
  });

  it("should narrow the rows to an area and sum its sets and its target over the muscles of the area", () => {
    const { rows, area } = muscleStateRows(states, {
      now: NOW,
      timeZone: "UTC",
      area: "back",
      targeted: ALL,
    });

    expect(rows.map((row) => row.muscle)).toEqual([
      "Lats",
      "Upper traps",
      "Mid traps",
      "Lower back",
    ]);
    expect(area).toEqual({ name: "back", sets: 18, target: 40 });
  });

  it("should give no area totals when no area is asked for, but the sets across all the muscles", () => {
    const { area, totalSets } = muscleStateRows(states, {
      now: NOW,
      timeZone: "UTC",
      area: null,
      targeted: ALL,
    });

    expect(area).toBeNull();
    expect(totalSets).toBe(18.5);
  });

  it("should round a sum of sets that floating point leaves a hair off", () => {
    const tenthSets = Array.from({ length: 3 }, () =>
      workingSet(NINE_HOURS_AGO, [{ muscle_id: "biceps", weight: 0.1 }]),
    );
    const { totalSets } = muscleStateRows(currentMuscleState(tenthSets, NOW), {
      now: NOW,
      timeZone: "UTC",
      area: null,
      targeted: ALL,
    });

    expect(totalSets).toBe(0.3);
  });

  it("should mark each row targeted or not", () => {
    const { rows } = muscleStateRows(states, {
      now: NOW,
      timeZone: "UTC",
      area: null,
      targeted: new Set(["lats"]),
    });

    expect(rows.find((row) => row.muscle === "Lats")?.targeted).toBe(true);
    expect(rows.find((row) => row.muscle === "Biceps")?.targeted).toBe(false);
  });

  it("should sum an area's sets and target over the targeted muscles only, so both describe the same muscles", () => {
    const { rows, area } = muscleStateRows(states, {
      now: NOW,
      timeZone: "UTC",
      area: "back",
      targeted: new Set(["lats", "traps_mid"]),
    });

    expect(area).toEqual({ name: "back", sets: 18, target: 20 });
    expect(rows.map((row) => [row.muscle, row.targeted])).toEqual([
      ["Lats", true],
      ["Upper traps", false],
      ["Mid traps", true],
      ["Lower back", false],
    ]);
  });

  it("should sum the whole area when the plan targets none of its muscles", () => {
    const { area } = muscleStateRows(states, {
      now: NOW,
      timeZone: "UTC",
      area: "back",
      targeted: new Set(["biceps"]),
    });

    expect(area).toEqual({ name: "back", sets: 18, target: 40 });
  });
});
