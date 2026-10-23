import { buildRecipeIngredient } from "@keylow/core/recipes";
import { buildFood, buildFoodPortion } from "@keylow/core/testing";
import { render, screen, userEvent, within } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { IngredientAmountStep } from "../../components/IngredientAmountStep";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { FoodWithPortionsState } from "@keylow/api-client";
import type { RecipeIngredient } from "@keylow/core/recipes";
import type { Food } from "@keylow/core/schemas";

// The amount step of an ingredient that is already in the recipe: what it shows, which chips it offers, and
// what Save and Remove from recipe hand back. The food's read is stood in for, so each test says what the
// food is now.

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

const mockFoodWithPortions = jest.fn<FoodWithPortionsState, [string]>();
const mockRefreshOutdatedOffFood = jest.fn<undefined, [Food | null | undefined]>();
jest.mock("@keylow/api-client", () => ({
  useFoodWithPortions: (id: string) => mockFoodWithPortions(id),
  useRefreshOutdatedOffFood: (food: Food | null | undefined) => {
    mockRefreshOutdatedOffFood(food);
  },
}));

setUpTests();

const onions = buildFood({
  id: "11111111-1111-4111-8111-111111111111",
  name: "Onions, raw",
  kcal: 35,
  protein_g: 1,
  carbs_g: 8,
  fat_g: 0.1,
});
const small = buildFoodPortion({
  id: "a1",
  food_id: onions.id,
  label: "1 small",
  grams: 80,
  position: 0,
});
const medium = buildFoodPortion({
  id: "a2",
  food_id: onions.id,
  label: "1 medium",
  grams: 110,
  position: 1,
  is_default: true,
});
const large = buildFoodPortion({
  id: "a3",
  food_id: onions.id,
  label: "1 large",
  grams: 150,
  position: 2,
});
const onionPortions = [small, medium, large];
const oil = buildFood({
  id: "22222222-2222-4222-8222-222222222222",
  name: "Oil, olive",
  kcal: 899,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 99.9,
  density_g_per_ml: 0.92,
});

const oneMediumOnion = buildRecipeIngredient(onions, {
  quantity: 1,
  unit: "portion",
  portion: medium,
});
const oneTablespoonOfOil = buildRecipeIngredient(oil, {
  quantity: 1,
  unit: "portion",
  portion: { id: "spoon-tbsp", label: "1 tbsp", grams: null, ml: 15 },
});

type Callbacks = { onSave: jest.Mock; onRemove: jest.Mock; onBack: jest.Mock };

async function showStep(ingredient: RecipeIngredient): Promise<{
  user: ReturnType<typeof userEvent.setup>;
  callbacks: Callbacks;
}> {
  const callbacks: Callbacks = { onSave: jest.fn(), onRemove: jest.fn(), onBack: jest.fn() };
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await render(
    <ThemeProvider fixedPreference="dark">
      <IngredientAmountStep ingredient={ingredient} {...callbacks} />
    </ThemeProvider>,
  );
  return { user, callbacks };
}

const hero = (caption: string) => screen.getByLabelText(`Energy and macros, ${caption}`);
const amountField = () => screen.getByLabelText(/^Amount/);
function expectChips(names: string[]) {
  const chips = screen.getAllByRole("radio");
  expect(chips).toHaveLength(names.length);
  names.forEach((name, index) => {
    expect(chips[index]).toHaveAccessibleName(name);
  });
}

describe("the amount step of an ingredient", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/IngredientAmountStep"]);
  });

  beforeEach(() => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
    mockRefreshOutdatedOffFood.mockReset();
    mockFoodWithPortions.mockReset();
    mockFoodWithPortions.mockReturnValue({
      status: "ready",
      food: onions,
      portions: onionPortions,
    });
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("what it shows", () => {
    it("should be headed by the food's name, with Back", async () => {
      const { user, callbacks } = await showStep(oneMediumOnion);

      expect(screen.getByRole("heading", { name: "Onions, raw" })).toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: "Back" }));
      expect(callbacks.onBack).toHaveBeenCalledTimes(1);
    });

    it("should open on the amount it has, with the hero for it", async () => {
      await showStep(oneMediumOnion);

      expect(amountField()).toHaveDisplayValue("1");
      expect(screen.getByRole("radio", { name: "1 medium", checked: true })).toBeOnTheScreen();
      expect(within(hero("For 1 medium (110 g)")).getByText("39")).toBeOnTheScreen();
    });

    it("should list the food's own values per 100 g under the hero", async () => {
      await showStep(oneMediumOnion);

      const list = screen.getByLabelText("Per 100 g");
      expect(within(list).getByLabelText("Energy, 35 kcal")).toBeOnTheScreen();
      expect(within(list).getByLabelText("Fat, 0.1 g")).toBeOnTheScreen();
    });

    it("should have no Time row and no Add, because an ingredient is not logged at a time", async () => {
      await showStep(oneMediumOnion);

      expect(screen.queryByRole("button", { name: /^Now|^Time/ })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Add" })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Add to recipe" })).not.toBeOnTheScreen();
    });

    it("should offer Save and, under it, Remove from recipe", async () => {
      await showStep(oneMediumOnion);

      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Remove from recipe" })).toBeEnabled();
    });
  });

  describe("the chips", () => {
    it("should be the food's portions, then g, with no spoon for a food with no volume measure", async () => {
      await showStep(oneMediumOnion);

      expectChips(["1 small", "1 medium", "1 large", "g"]);
    });

    it("should be g, ml, 1 tsp and 1 tbsp for a food with no portions that is measured by volume", async () => {
      mockFoodWithPortions.mockReturnValue({ status: "ready", food: oil, portions: [] });
      await showStep(oneTablespoonOfOil);

      expectChips(["g", "ml", "1 tsp", "1 tbsp"]);
      expect(screen.getByRole("radio", { name: "1 tbsp", checked: true })).toBeOnTheScreen();
      expect(within(hero("For 1 tbsp (15 ml, 14 g)")).getByText("124")).toBeOnTheScreen();
    });

    it("should take another portion the food has now, and keep the size the ingredient was added with", async () => {
      mockFoodWithPortions.mockReturnValue({
        status: "ready",
        food: onions,
        portions: [small, { ...medium, grams: 120 }, large],
      });
      await showStep(oneMediumOnion);

      expectChips(["1 small", "1 medium", "1 large", "g"]);
      expect(hero("For 1 medium (110 g)")).toBeOnTheScreen();
    });

    it("should be the ingredient's own while the food is not known, or gone", async () => {
      mockFoodWithPortions.mockReturnValue({ status: "loading" });
      await showStep(oneMediumOnion);

      expectChips(["1 medium", "g"]);
    });

    it("should be the ingredient's own when the food has been deleted", async () => {
      mockFoodWithPortions.mockReturnValue({
        status: "ready",
        food: { ...onions, deleted_at: "2026-10-16T09:00:00Z" },
        portions: onionPortions,
      });
      await showStep(oneMediumOnion);

      expectChips(["1 medium", "g"]);
    });

    it("should reset the amount to 1 for a portion and 100 for g when a chip is pressed", async () => {
      const { user } = await showStep(oneMediumOnion);

      await user.press(screen.getByRole("radio", { name: "g" }));
      expect(amountField()).toHaveDisplayValue("100");
      expect(hero("For 100 g")).toBeOnTheScreen();

      await user.press(screen.getByRole("radio", { name: "1 large" }));
      expect(amountField()).toHaveDisplayValue("1");
      expect(hero("For 1 large (150 g)")).toBeOnTheScreen();
    });
  });

  describe("the values come from what the ingredient was added with", () => {
    it("should work the hero out from the frozen values when the food has changed since", async () => {
      mockFoodWithPortions.mockReturnValue({
        status: "ready",
        food: { ...onions, kcal: 90 },
        portions: onionPortions,
      });
      await showStep(oneMediumOnion);

      expect(within(hero("For 1 medium (110 g)")).getByText("39")).toBeOnTheScreen();
      expect(
        within(screen.getByLabelText("Per 100 g")).getByLabelText("Energy, 35 kcal"),
      ).toBeOnTheScreen();
    });
  });

  describe("an amount that is not above 0", () => {
    it("should say so, turn Save off and draw dashes in the hero", async () => {
      const { user, callbacks } = await showStep(oneMediumOnion);

      await user.clear(amountField());
      await user.type(amountField(), "0");

      expect(screen.getByText("Enter an amount above 0.")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
      expect(within(hero("For this amount")).getAllByText("–")).toHaveLength(4);
      await user.press(screen.getByRole("button", { name: "Save" }));
      expect(callbacks.onSave).not.toHaveBeenCalled();
    });

    it("should still let the ingredient be removed", async () => {
      const { user, callbacks } = await showStep(oneMediumOnion);
      await user.clear(amountField());

      await user.press(screen.getByRole("button", { name: "Remove from recipe" }));

      expect(callbacks.onRemove).toHaveBeenCalledTimes(1);
    });
  });

  describe("Save", () => {
    it("should hand back the ingredient with the new amount", async () => {
      const { user, callbacks } = await showStep(oneMediumOnion);

      await user.clear(amountField());
      await user.type(amountField(), "2");
      await user.press(screen.getByRole("button", { name: "Save" }));

      expect(callbacks.onSave).toHaveBeenCalledTimes(1);
      expect(callbacks.onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          food_id: oneMediumOnion.food_id,
          quantity: 2,
          unit: "portion",
          portion_id: "a2",
          resolved_grams: 220,
        }),
      );
    });

    it("should hand back the ingredient as it is when the amount was not changed", async () => {
      const { user, callbacks } = await showStep(oneMediumOnion);

      await user.press(screen.getByRole("button", { name: "Save" }));

      expect(callbacks.onSave).toHaveBeenCalledWith(oneMediumOnion);
    });

    it("should hand back a change of unit", async () => {
      const { user, callbacks } = await showStep(oneMediumOnion);

      await user.press(screen.getByRole("radio", { name: "g" }));
      await user.press(screen.getByRole("button", { name: "Save" }));

      expect(callbacks.onSave).toHaveBeenCalledWith(
        expect.objectContaining({ unit: "g", quantity: 100, portion_id: null }),
      );
    });
  });

  describe("Remove from recipe", () => {
    it("should ask for the ingredient to be removed", async () => {
      const { user, callbacks } = await showStep(oneMediumOnion);

      await user.press(screen.getByRole("button", { name: "Remove from recipe" }));

      expect(callbacks.onRemove).toHaveBeenCalledTimes(1);
      expect(callbacks.onSave).not.toHaveBeenCalled();
    });
  });

  describe("the refresh of a branded food stored before the portion rules", () => {
    it("should ask for the refresh of the live food when it is there", async () => {
      await showStep(oneMediumOnion);

      expect(mockRefreshOutdatedOffFood).toHaveBeenLastCalledWith(onions);
    });

    it("should ask for the refresh of no food while the live food is not read yet", async () => {
      mockFoodWithPortions.mockReturnValue({ status: "loading" });

      await showStep(oneMediumOnion);

      expect(mockRefreshOutdatedOffFood).toHaveBeenLastCalledWith(undefined);
    });

    it("should ask for the refresh of no food that has been deleted", async () => {
      mockFoodWithPortions.mockReturnValue({
        status: "ready",
        food: { ...onions, deleted_at: "2026-10-16T09:00:00Z" },
        portions: onionPortions,
      });

      await showStep(oneMediumOnion);

      expect(mockRefreshOutdatedOffFood).toHaveBeenLastCalledWith(undefined);
    });
  });
});
