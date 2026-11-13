import { describe, expect, it } from "vitest";

import { FIT_TOLERANCE } from "../../../src/recipes";

describe("FIT_TOLERANCE", () => {
  it("is 5 % on calories, 5 g on protein and 5 g on carbs or fat (Zee, 2026-11-13)", () => {
    expect(FIT_TOLERANCE).toEqual({ kcalPercent: 5, proteinGrams: 5, macroGrams: 5 });
  });
});
