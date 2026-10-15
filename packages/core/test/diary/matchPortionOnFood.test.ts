import { describe, expect, it } from "vitest";

import { matchPortionOnFood } from "../../src/diary/matchPortionOnFood";
import { buildFoodPortion } from "../../src/testing";

const slice = buildFoodPortion({
  id: "00000000-0000-4000-8000-0000000000c1",
  label: "Slice",
  grams: 35,
});
const roll = buildFoodPortion({
  id: "00000000-0000-4000-8000-0000000000c2",
  label: "Roll",
  grams: 60,
});
const previous = {
  quantity: 2,
  portionId: null,
  portion: { label: "Slice", grams: 35 },
} as const;

describe("matchPortionOnFood", () => {
  it("should prefer the portion the link still points to", () => {
    const renamed = buildFoodPortion({ ...slice, label: "Thick slice" });

    expect(matchPortionOnFood({ ...previous, portionId: slice.id }, [roll, renamed])).toEqual({
      quantity: 2,
      unit: "portion",
      portion: renamed,
    });
  });

  it("should match by label when the link is gone", () => {
    const reinserted = buildFoodPortion({ ...slice, id: "00000000-0000-4000-8000-0000000000c9" });

    expect(matchPortionOnFood(previous, [roll, reinserted]).portion).toEqual(reinserted);
  });

  it("should ignore the default portion and keep the amount when there is no label match", () => {
    const defaultRoll = buildFoodPortion({ ...roll, is_default: true });

    expect(matchPortionOnFood(previous, [defaultRoll])).toEqual({ quantity: 70, unit: "g" });
  });

  it("should fall back to grams when the old portion was in grams", () => {
    expect(matchPortionOnFood(previous, [roll])).toEqual({ quantity: 70, unit: "g" });
  });

  it("should fall back to millilitres when the old portion was in millilitres", () => {
    const glass = { quantity: 1.5, portionId: null, portion: { label: "Glass", ml: 200 } } as const;

    expect(matchPortionOnFood(glass, [])).toEqual({ quantity: 300, unit: "ml" });
  });
});
