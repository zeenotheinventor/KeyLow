import { MUSCLE_IDS } from "@keylow/core/training";
import { describe, expect, it } from "vitest";

import { RESTING_HEAT } from "../src/restingHeat";

describe("RESTING_HEAT", () => {
  it("should give every muscle the rested step, and no other key", () => {
    expect(Object.keys(RESTING_HEAT).sort()).toStrictEqual([...MUSCLE_IDS].sort());
    expect(Object.values(RESTING_HEAT).every((step) => step === 0)).toBe(true);
  });
});
