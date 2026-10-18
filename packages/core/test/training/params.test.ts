import { describe, expect, it } from "vitest";

import {
  MUSCLE_IDS,
  MUSCLE_SIZE_CLASSES,
  MUSCLES,
  muscleParams,
  TRAINING_PARAMS_V1,
  TRAINING_PARAMS_VERSION,
} from "../../src/training";

import type { TrainingParams } from "../../src/training";

describe("TRAINING_PARAMS_V1", () => {
  it("should carry the keylow-training-v1 version", () => {
    expect(TRAINING_PARAMS_VERSION).toBe("keylow-training-v1");
    expect(TRAINING_PARAMS_V1.version).toBe("keylow-training-v1");
  });

  // Every v1 value, written out. Changing one is a new params version, never an edit of this one.
  it("should hold exactly the v1 values of ADR 0005", () => {
    expect(TRAINING_PARAMS_V1).toStrictEqual({
      version: "keylow-training-v1",
      effort: {
        warmup: 0,
        unknown: 1,
        hard: 1,
        moderate: 0.5,
        easy: 0.25,
        hardMaxRir: 3,
        moderateMaxRir: 5,
        hardMinRpe: 7,
        moderateMinRpe: 5,
      },
      sizeClasses: {
        small: {
          tauHours: 24,
          capacity: 8,
          threshold: 2,
          mev: 6,
          mav: { low: 10, high: 16 },
          mrv: 22,
        },
        medium: {
          tauHours: 32,
          capacity: 10,
          threshold: 2.5,
          mev: 8,
          mav: { low: 12, high: 18 },
          mrv: 22,
        },
        large: {
          tauHours: 40,
          capacity: 10,
          threshold: 2.5,
          mev: 6,
          mav: { low: 10, high: 16 },
          mrv: 20,
        },
      },
      muscleOverrides: {},
      heatWindowDays: 14,
      volumeWindowDays: 7,
    } satisfies TrainingParams);
  });

  it("should set each class's ready threshold at a quarter of its capacity", () => {
    for (const sizeClass of MUSCLE_SIZE_CLASSES) {
      const { capacity, threshold } = TRAINING_PARAMS_V1.sizeClasses[sizeClass];
      expect(threshold).toBe(0.25 * capacity);
    }
  });

  it("should keep each class's landmarks in order", () => {
    for (const sizeClass of MUSCLE_SIZE_CLASSES) {
      const { mev, mav, mrv } = TRAINING_PARAMS_V1.sizeClasses[sizeClass];
      expect(mev).toBeLessThanOrEqual(mav.low);
      expect(mav.low).toBeLessThanOrEqual(mav.high);
      expect(mav.high).toBeLessThanOrEqual(mrv);
    }
  });

  it("should order the effort bands from hardest to easiest", () => {
    const { effort } = TRAINING_PARAMS_V1;
    expect(effort.hard).toBeGreaterThan(effort.moderate);
    expect(effort.moderate).toBeGreaterThan(effort.easy);
    expect(effort.easy).toBeGreaterThan(effort.warmup);
    // RPE is read as 10 minus RIR, so the two scales start their bands at the same effort.
    expect(effort.hardMinRpe).toBe(10 - effort.hardMaxRir);
    expect(effort.moderateMinRpe).toBe(10 - effort.moderateMaxRir);
  });
});

describe("muscleParams", () => {
  it("should give every muscle its size class's values in v1", () => {
    for (const muscle of MUSCLE_IDS) {
      expect(muscleParams(muscle, TRAINING_PARAMS_V1)).toStrictEqual(
        TRAINING_PARAMS_V1.sizeClasses[MUSCLES[muscle].sizeClass],
      );
    }
  });

  it("should put an override's fields in place of the class's and keep the rest", () => {
    const params: TrainingParams = {
      ...TRAINING_PARAMS_V1,
      muscleOverrides: { neck: { tauHours: 12, mrv: 12 } },
    };

    expect(muscleParams("neck", params)).toStrictEqual({
      ...TRAINING_PARAMS_V1.sizeClasses.small,
      tauHours: 12,
      mrv: 12,
    });
    expect(muscleParams("biceps", params)).toStrictEqual(TRAINING_PARAMS_V1.sizeClasses.small);
  });
});
