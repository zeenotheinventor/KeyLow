import { describe, expect, it } from "vitest";

import {
  GOAL_PRESETS_V1,
  SESSION_TIME_PARAMS_V1,
  SUGGEST_PARAMS_V1,
  TRAINING_PARAMS_V1,
  TRAINING_PARAMS_VERSION,
} from "../../src/training";

/*
 * The suggestion parameters Zee agreed on 2026-10-18 (Linear document "Goal presets and golden
 * suggestions", Part 3, on KEY-396). Every number is a literal copied from that document, never computed
 * from the params. A change to one is a new params version (ADR 0002), never an edit of this table.
 */

describe("SUGGEST_PARAMS_V1", () => {
  it("should carry the training params version", () => {
    expect(SUGGEST_PARAMS_V1.version).toBe(TRAINING_PARAMS_VERSION);
  });

  it("should hold the agreed hot threshold of 0.5", () => {
    expect(SUGGEST_PARAMS_V1.hotHeatThreshold).toBe(0.5);
  });

  it("should hold the agreed caps of 8 exercises in a fresh session and 2 added to a planned day", () => {
    expect(SUGGEST_PARAMS_V1.maxExercises).toStrictEqual({ fresh: 8, addedToPlannedDay: 2 });
  });

  it("should hold the agreed tie-break order for exercises", () => {
    expect(SUGGEST_PARAMS_V1.exerciseTieBreak).toStrictEqual([
      "exercise_score",
      "compound_first",
      "name",
      "id",
    ]);
  });

  it("should read heat and volume from the training params, sets and reps from the presets, and length from the session time params", () => {
    expect(SUGGEST_PARAMS_V1.training).toBe(TRAINING_PARAMS_V1);
    expect(SUGGEST_PARAMS_V1.presets).toBe(GOAL_PRESETS_V1);
    expect(SUGGEST_PARAMS_V1.sessionTime).toBe(SESSION_TIME_PARAMS_V1);
  });

  it("should hold exactly these keys, so a new value is noticed here", () => {
    expect(Object.keys(SUGGEST_PARAMS_V1).sort()).toStrictEqual([
      "exerciseTieBreak",
      "hotHeatThreshold",
      "maxExercises",
      "presets",
      "sessionTime",
      "training",
      "version",
    ]);
  });
});
