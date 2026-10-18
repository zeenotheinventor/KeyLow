import { describe, expect, it } from "vitest";

import {
  estimateSessionMinutes,
  SESSION_TIME_PARAMS_V1,
  TRAINING_PARAMS_VERSION,
} from "../../src/training";

import type { SessionTimeParams } from "../../src/training";

/*
 * The expected minutes are literals worked by hand from the values Zee agreed on KEY-396 (2 minutes an
 * exercise, 2.5 a set, rounded to the nearest 5, a half going up), never computed from the params. A
 * change to one is a new params version.
 */

describe("SESSION_TIME_PARAMS_V1", () => {
  it("should carry the training params version", () => {
    expect(SESSION_TIME_PARAMS_V1.version).toBe(TRAINING_PARAMS_VERSION);
  });

  it("should hold exactly the agreed values", () => {
    expect(SESSION_TIME_PARAMS_V1).toStrictEqual({
      version: "keylow-training-v1",
      minutesPerSet: 2.5,
      minutesPerExercise: 2,
      roundTo: 5,
    });
  });
});

describe("estimateSessionMinutes", () => {
  it("should estimate 50 minutes for 5 exercises and 16 sets", () => {
    expect(estimateSessionMinutes({ exercises: 5, sets: 16 }, SESSION_TIME_PARAMS_V1)).toBe(50);
  });

  it("should round 47.5 minutes half up to 50, not down to 45", () => {
    expect(estimateSessionMinutes({ exercises: 5, sets: 15 }, SESSION_TIME_PARAMS_V1)).toBe(50);
  });

  it("should round to the nearest 5, up or down", () => {
    // 1 exercise and 4 sets: 2 + 10 = 12, which is nearer 10 than 15.
    expect(estimateSessionMinutes({ exercises: 1, sets: 4 }, SESSION_TIME_PARAMS_V1)).toBe(10);
    // 1 exercise and 3 sets: 2 + 7.5 = 9.5, nearer 10. 1 exercise and 1 set: 4.5, nearer 5.
    expect(estimateSessionMinutes({ exercises: 1, sets: 3 }, SESSION_TIME_PARAMS_V1)).toBe(10);
    expect(estimateSessionMinutes({ exercises: 1, sets: 1 }, SESSION_TIME_PARAMS_V1)).toBe(5);
  });

  it("should give 60 for 6 exercises and 19 sets, the suggestion's length", () => {
    // 12 + 47.5 = 59.5, which rounds to 60.
    expect(estimateSessionMinutes({ exercises: 6, sets: 19 }, SESSION_TIME_PARAMS_V1)).toBe(60);
  });

  it("should give 0 for a session with nothing in it", () => {
    expect(estimateSessionMinutes({ exercises: 0, sets: 0 }, SESSION_TIME_PARAMS_V1)).toBe(0);
  });

  it("should read every number from the params it is given", () => {
    const params: SessionTimeParams = {
      version: TRAINING_PARAMS_VERSION,
      minutesPerSet: 4,
      minutesPerExercise: 1,
      roundTo: 10,
    };
    // 2 + 20 = 22, nearest 10 is 20.
    expect(estimateSessionMinutes({ exercises: 2, sets: 5 }, params)).toBe(20);
  });
});
