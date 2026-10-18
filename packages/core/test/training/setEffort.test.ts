import { describe, expect, it } from "vitest";

import { MAX_RIR, MIN_RIR, SET_TYPES, setEffort, TRAINING_PARAMS_V1 } from "../../src/training";

import type { EffortSet, SetType } from "../../src/training";

const effortOf = (set: Partial<EffortSet>): number =>
  setEffort({ set_type: "working", rir: null, rpe: null, ...set }, TRAINING_PARAMS_V1);

const rirs = Array.from({ length: MAX_RIR - MIN_RIR + 1 }, (_, index) => MIN_RIR + index);
const rpes = Array.from({ length: 19 }, (_, index) => 1 + index / 2);
const effortSetTypes: SetType[] = SET_TYPES.filter((setType) => setType !== "warmup");

describe("setEffort", () => {
  it("should count a warm-up as nothing whatever its effort", () => {
    expect(effortOf({ set_type: "warmup" })).toBe(0);
    for (const rir of rirs) {
      expect(effortOf({ set_type: "warmup", rir })).toBe(0);
    }
    for (const rpe of rpes) {
      expect(effortOf({ set_type: "warmup", rpe })).toBe(0);
    }
  });

  it.each([
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 1],
    [4, 0.5],
    [5, 0.5],
    [6, 0.25],
    [7, 0.25],
    [8, 0.25],
    [9, 0.25],
    [10, 0.25],
  ])("should count a set at RIR %d as %d", (rir, effort) => {
    expect(effortOf({ rir })).toBe(effort);
  });

  it.each([
    [10, 1],
    [9.5, 1],
    [9, 1],
    [8.5, 1],
    [8, 1],
    [7.5, 1],
    [7, 1],
    [6.5, 0.5],
    [6, 0.5],
    [5.5, 0.5],
    [5, 0.5],
    [4.5, 0.25],
    [4, 0.25],
    [3, 0.25],
    [2, 0.25],
    [1, 0.25],
  ])("should count a set at RPE %d as %d", (rpe, effort) => {
    expect(effortOf({ rpe })).toBe(effort);
  });

  it("should count a set with neither RIR nor RPE in full", () => {
    for (const setType of effortSetTypes) {
      expect(effortOf({ set_type: setType })).toBe(1);
    }
  });

  it("should read drop and failure sets by their effort like working sets", () => {
    for (const setType of effortSetTypes) {
      expect(effortOf({ set_type: setType, rir: 4 })).toBe(0.5);
      expect(effortOf({ set_type: setType, rpe: 4 })).toBe(0.25);
    }
  });

  it("should give RPE the band of the RIR it is 10 minus", () => {
    for (const rir of rirs.filter((value) => value <= 9)) {
      expect(effortOf({ rpe: 10 - rir })).toBe(effortOf({ rir }));
    }
  });

  it("should take its factors from the params", () => {
    const params = {
      ...TRAINING_PARAMS_V1,
      effort: { ...TRAINING_PARAMS_V1.effort, unknown: 0.75, hardMaxRir: 1 },
    };

    expect(setEffort({ set_type: "working", rir: null, rpe: null }, params)).toBe(0.75);
    expect(setEffort({ set_type: "working", rir: 2, rpe: null }, params)).toBe(0.5);
  });
});
