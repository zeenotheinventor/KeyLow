import { SNAPSHOT_VERSION } from "@keylow/core/diary";
import { buildFood, buildFoodPortion } from "@keylow/core/testing";
import { render, screen, userEvent, within } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { AddIngredientAmountStep } from "../../components/AddIngredientAmountStep";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { FoodWithPortionsState, RecentFood } from "@keylow/api-client";
import type { RecipeIngredient } from "@keylow/core/recipes";

// The amount step of a food about to join a recipe: what it shows, which chips it offers, where the amount
// starts, and what Add to recipe hands back. The food's read is stood in for, so each test says what the food is.

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
jest.mock("@keylow/api-client", () => ({
  useFoodWithPortions: (id: string) => mockFoodWithPortions(id),
}));

setUpTests();

const onions = buildFood({
  id: "11111111-1111-4111-8111-111111111111",
  source: "cofid",
  name: "Onions, raw",
  kcal: 35,
  protein_g: 1,
  carbs_g: 8,
  fat_g: 0.1,
});
const onionPortions = [
  buildFoodPortion({ id: "a1", food_id: onions.id, label: "1 small", grams: 80, position: 0 }),
  buildFoodPortion({
    id: "a2",
    food_id: onions.id,
    label: "1 medium",
    grams: 110,
    position: 1,
    is_default: true,
  }),
  buildFoodPortion({ id: "a3", food_id: onions.id, label: "1 large", grams: 150, position: 2 }),
];
const oil = buildFood({
  id: "22222222-2222-4222-8222-222222222222",
  source: "cofid",
  name: "Oil, olive",
  kcal: 899,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 99.9,
  density_g_per_ml: 0.92,
});
const mysteryBar = buildFood({
  id: "33333333-3333-4333-8333-333333333333",
  source: "off",
  name: "Mystery bar",
  kcal: 400,
  protein_g: 10,
  fat_g: 20,
  carbs_g: null,
});

const oatsLoggedAt50Grams: RecentFood = {
  foodId: onions.id,
  entryId: "entry-1",
  loggedAt: "2026-10-14T07:05:00Z",
  portionId: null,
  snapshot: {
    v: SNAPSHOT_VERSION,
    kind: "food",
    ref: onions.id,
    name: "Onions, raw",
    basis: "per_100g",
    per100: { kcal: 35, protein_g: 1, fat_g: 0.1, carbs_g: 8, fibre_g: null },
    quantity: 50,
    unit: "g",
    portion: null,
    density: null,
    resolvedGrams: 50,
    engineVersion: 1,
  },
};

type Callbacks = { onAdd: jest.Mock<undefined, [RecipeIngredient]>; onBack: jest.Mock };

async function showStep(foodId: string, recent?: RecentFood) {
  const callbacks: Callbacks = {
    onAdd: jest.fn<undefined, [RecipeIngredient]>(),
    onBack: jest.fn(),
  };
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await render(
    <ThemeProvider fixedPreference="dark">
      <AddIngredientAmountStep foodId={foodId} recent={recent} {...callbacks} />
    </ThemeProvider>,
  );
  return { user, callbacks };
}

const hero = (caption: string) => screen.getByLabelText(`Energy and macros, ${caption}`);
const amountField = () => screen.getByLabelText(/^Amount/);

describe("the amount step of a food being added to a recipe", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/AddIngredientAmountStep",
      "components/PortionPicker",
      "components/FoodLoadState",
    ]);
  });

  beforeEach(() => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
    mockFoodWithPortions.mockReset();
    mockFoodWithPortions.mockImplementation((id) => {
      const food = [onions, oil, mysteryBar].find((candidate) => candidate.id === id);
      return food === undefined
        ? { status: "notFound" }
        : {
            status: "ready",
            food,
            portions: food.id === onions.id ? onionPortions : [],
          };
    });
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("what it shows", () => {
    it("should be headed by the food's name, with Back to the results", async () => {
      const { user, callbacks } = await showStep(onions.id);

      expect(screen.getByRole("heading", { name: "Onions, raw" })).toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: "Back" }));
      expect(callbacks.onBack).toHaveBeenCalledTimes(1);
    });

    it("should name the food's source under the title", async () => {
      await showStep(onions.id);

      expect(screen.getByText("UK CoFID")).toBeOnTheScreen();
    });

    it("should open on the food's default portion, with the hero for it", async () => {
      await showStep(onions.id);

      expect(amountField()).toHaveDisplayValue("1");
      expect(screen.getByRole("radio", { name: "1 medium", checked: true })).toBeOnTheScreen();
      expect(within(hero("For 1 medium (110 g)")).getByText("39")).toBeOnTheScreen();
    });

    it("should list the food's values per 100 g under the hero", async () => {
      await showStep(onions.id);

      const list = screen.getByLabelText("Per 100 g");
      expect(within(list).getByLabelText("Energy, 35 kcal")).toBeOnTheScreen();
    });

    it("should have no Time row, and Add to recipe where a logged food has Add", async () => {
      await showStep(onions.id);

      expect(screen.queryByRole("button", { name: /^Now|^Time/ })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Add" })).not.toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Add to recipe" })).toBeEnabled();
      expect(screen.queryByRole("button", { name: "Remove from recipe" })).not.toBeOnTheScreen();
    });

    it("should offer g, ml, 1 tsp and 1 tbsp, with g first, for an oil that has no portions", async () => {
      await showStep(oil.id);

      const chips = screen.getAllByRole("radio");
      expect(chips).toHaveLength(4);
      ["g", "ml", "1 tsp", "1 tbsp"].forEach((name, index) => {
        expect(chips[index]).toHaveAccessibleName(name);
      });
    });
  });

  describe("where the amount starts", () => {
    it("should be the amount a Recent food was last logged with", async () => {
      await showStep(onions.id, oatsLoggedAt50Grams);

      expect(amountField()).toHaveDisplayValue("50");
      expect(screen.getByRole("radio", { name: "g", checked: true })).toBeOnTheScreen();
    });
  });

  describe("Add to recipe", () => {
    it("should hand back the ingredient with the amount and the food's values frozen in", async () => {
      const { user, callbacks } = await showStep(onions.id);

      await user.press(screen.getByRole("button", { name: "Add to recipe" }));

      expect(callbacks.onAdd).toHaveBeenCalledTimes(1);
      const [ingredient] = callbacks.onAdd.mock.calls[0] ?? [];
      expect(ingredient).toMatchObject({
        food_id: onions.id,
        quantity: 1,
        unit: "portion",
        portion_id: "a2",
      });
      expect(ingredient?.snapshot.name).toBe("Onions, raw");
    });

    it("should hand back the amount that was typed, in the chip that was chosen", async () => {
      const { user, callbacks } = await showStep(onions.id);

      await user.press(screen.getByRole("radio", { name: "g" }));
      await user.clear(amountField());
      await user.type(amountField(), "250");
      await user.press(screen.getByRole("button", { name: "Add to recipe" }));

      expect(callbacks.onAdd.mock.calls[0]?.[0]).toMatchObject({ quantity: 250, unit: "g" });
    });

    it("should be off, with the message under the field, while the amount is not above 0", async () => {
      const { user } = await showStep(onions.id);

      await user.clear(amountField());

      expect(screen.getByText("Enter an amount above 0.")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Add to recipe" })).toBeDisabled();
    });
  });

  describe("a food that needs review", () => {
    it("should say so, turn Add to recipe off and offer no way to copy it away from the recipe", async () => {
      const { callbacks } = await showStep(mysteryBar.id);

      expect(screen.getByText("Needs review")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Add to recipe" })).toBeDisabled();
      expect(screen.queryByRole("button", { name: /Copy to your foods/ })).not.toBeOnTheScreen();
      expect(callbacks.onAdd).not.toHaveBeenCalled();
    });
  });

  describe("while the food is not there to show", () => {
    it("should keep Back, and say it is loading", async () => {
      mockFoodWithPortions.mockReturnValue({ status: "loading" });
      const { user, callbacks } = await showStep(onions.id);

      expect(screen.getByRole("status", { name: "Loading food" })).toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: "Back" }));
      expect(callbacks.onBack).toHaveBeenCalledTimes(1);
    });

    it("should say the food could not be loaded, without the failure itself", async () => {
      mockFoodWithPortions.mockReturnValue({ status: "error", debugMessage: "secret detail" });
      await showStep(onions.id);

      expect(screen.getByText("Food not loaded")).toBeOnTheScreen();
      expect(screen.queryByText(/secret detail/)).not.toBeOnTheScreen();
    });

    it("should say the food was not found", async () => {
      await showStep("44444444-4444-4444-8444-444444444444");

      expect(screen.getByText("Food not found")).toBeOnTheScreen();
    });
  });
});
