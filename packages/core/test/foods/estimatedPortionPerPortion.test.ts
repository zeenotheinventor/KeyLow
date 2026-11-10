import { describe, expect, it } from "vitest";

import { estimatedPortion, isOurEstimate } from "../../src/foods/estimatedPortion";
import { buildFood, buildFoodPortion } from "../../src/testing";

describe("estimatedPortion for a food per portion", () => {
  it("should refuse, because the food has a portion of its own and no weight to size an estimate", () => {
    expect(() => estimatedPortion({ basis: "per_portion", kcal: 1250 })).toThrow(RangeError);
  });
});

describe("isOurEstimate for a food per portion", () => {
  const bucket = buildFood({ source: "restaurant", basis: "per_portion", kcal: 1250 });

  it("should not take its count portion for an estimate, whatever it is called", () => {
    const portion = buildFoodPortion({
      label: "1 typical serving",
      grams: null,
      ml: null,
      is_default: true,
      owner_id: bucket.owner_id,
    });

    expect(isOurEstimate(bucket, portion, [portion])).toBe(false);
  });
});
