import { estimatedPortion } from "@keylow/core/foods";
import { buildFood, buildFoodPortion } from "@keylow/core/testing";

import { foodToFormValues } from "../../components/FoodForm";

// The folder's index also loads the form, which reads the theme from storage.
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

describe("foodToFormValues", () => {
  it("should leave the generated estimate out, so the form holds only what the person typed", () => {
    const food = buildFood();
    const generated = estimatedPortion({ basis: food.basis, kcal: food.kcal });
    const estimate = buildFoodPortion({
      label: generated.label,
      grams: generated.grams,
      ml: generated.ml,
      is_default: true,
    });

    expect(foodToFormValues(food, [estimate]).portions).toEqual([]);
  });

  it("should keep a portion the person typed as 1 typical slice", () => {
    const typed = buildFoodPortion({ label: "1 typical slice", grams: 35, is_default: true });

    expect(foodToFormValues(buildFood(), [typed]).portions).toEqual([
      { label: "1 typical slice", amount: "35", isDefault: true },
    ]);
  });
});
