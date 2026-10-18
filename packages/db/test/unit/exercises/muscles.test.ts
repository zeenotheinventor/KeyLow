import { MUSCLE_IDS as CORE_MUSCLE_IDS, isMuscleId as coreIsMuscleId } from "@keylow/core";
import { describe, expect, it } from "vitest";

import { MUSCLE_IDS, isMuscleId } from "../../../scripts/exercises/muscles";

describe("the muscle list of the exercise scripts", () => {
  it("should be core's list itself, not a copy that could drift", () => {
    expect(MUSCLE_IDS).toBe(CORE_MUSCLE_IDS);
    expect(isMuscleId).toBe(coreIsMuscleId);
  });
});
