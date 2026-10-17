import "react-native-gesture-handler/jestSetup";

import { KeyLowProvider } from "@keylow/api-client";
import { buildRecipeIngredient } from "@keylow/core/recipes";
import { buildFood, buildFoodPortion } from "@keylow/core/testing";
import { onlineManager } from "@tanstack/react-query";
import {
  act,
  cleanup,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { RecipeEditor } from "../../components/RecipeEditor";
import { ToastProvider } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { createDiaryQueryClient, diaryClient, resetDiaryBackend } from "../support/diaryBackend";
import { resetRouterMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { RecipeEditorExisting } from "../../components/RecipeEditor";
import type { FoodWithPortionsState } from "@keylow/api-client";
import type { QueryClient } from "@tanstack/react-query";

// The ingredient rows of the recipe editor: opening one to change its amount, removing one with an Undo, and
// what each does to the Per serving card and to what Save sends. The brief's frittata is the recipe.

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

type HoldEvent = { data: { action: { type: string } } };
const mockHold: { isHeld: boolean; onHeld: (event: HoldEvent) => void } = {
  isHeld: false,
  onHeld: () => undefined,
};
jest.mock("expo-router/react-navigation", () => ({
  usePreventRemove: (isHeld: boolean, onHeld: (event: HoldEvent) => void) => {
    mockHold.isHeld = isHeld;
    mockHold.onHeld = onHeld;
  },
}));

const mockUpdateRecipe = jest.fn<
  Promise<RecipeEditorExisting>,
  [{ ingredients: RecipeEditorExisting["ingredients"] }]
>();
const mockFoodWithPortions = jest.fn<FoodWithPortionsState, [string]>();

jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<object>("@keylow/api-client"),
  useCreateRecipe: () => ({ mutateAsync: jest.fn() }),
  useUpdateRecipe: () => ({ mutateAsync: mockUpdateRecipe }),
  useFoodWithPortions: (id: string) => mockFoodWithPortions(id),
}));

setUpTests();

const RECIPE_ID = "55555555-5555-4555-8555-555555555555";

const uuidOf = (digit: string) =>
  `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;

const eggs = buildFood({
  id: uuidOf("1"),
  name: "Eggs, chicken, whole, raw",
  kcal: 131,
  protein_g: 12.6,
  carbs_g: 0,
  fat_g: 9,
});
const milk = buildFood({
  id: uuidOf("2"),
  name: "Milk, semi-skimmed, pasteurised, average",
  kcal: 46,
  protein_g: 3.5,
  carbs_g: 4.7,
  fat_g: 1.7,
  density_g_per_ml: 1.03,
});
const oil = buildFood({
  id: uuidOf("3"),
  name: "Oil, olive",
  kcal: 899,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 99.9,
  density_g_per_ml: 0.92,
});
const onions = buildFood({
  id: uuidOf("4"),
  name: "Onions, raw",
  kcal: 35,
  protein_g: 1,
  carbs_g: 8,
  fat_g: 0.1,
});
const spinach = buildFood({
  id: uuidOf("5"),
  name: "Spinach, baby, raw",
  kcal: 16,
  protein_g: 2.6,
  carbs_g: 0.2,
  fat_g: 0.6,
});
const cheddar = buildFood({
  id: uuidOf("6"),
  name: "Cheese, Cheddar, English",
  kcal: 416,
  protein_g: 25.4,
  carbs_g: 0.1,
  fat_g: 34.9,
});

const largeEgg = buildFoodPortion({
  id: uuidOf("b"),
  food_id: eggs.id,
  label: "1 large",
  grams: 50,
});
const mediumOnion = buildFoodPortion({
  id: uuidOf("d"),
  food_id: onions.id,
  label: "1 medium",
  grams: 110,
});
const portionsOfFood: Record<string, ReturnType<typeof buildFoodPortion>[]> = {
  [eggs.id]: [
    buildFoodPortion({
      id: uuidOf("a"),
      food_id: eggs.id,
      label: "1 small",
      grams: 40,
      position: 0,
    }),
    largeEgg,
  ],
  [onions.id]: [
    buildFoodPortion({
      id: uuidOf("c"),
      food_id: onions.id,
      label: "1 small",
      grams: 80,
      position: 0,
    }),
    { ...mediumOnion, position: 1 },
    buildFoodPortion({
      id: uuidOf("e"),
      food_id: onions.id,
      label: "1 large",
      grams: 150,
      position: 2,
    }),
  ],
};
const allFoods = [eggs, milk, oil, onions, spinach, cheddar];

const frittataIngredients = [
  buildRecipeIngredient(eggs, { quantity: 6, unit: "portion", portion: largeEgg }),
  buildRecipeIngredient(milk, { quantity: 100, unit: "ml" }),
  buildRecipeIngredient(oil, {
    quantity: 1,
    unit: "portion",
    portion: { id: "spoon-tbsp", label: "1 tbsp", grams: null, ml: 15 },
  }),
  buildRecipeIngredient(onions, { quantity: 1, unit: "portion", portion: mediumOnion }),
  buildRecipeIngredient(spinach, { quantity: 100, unit: "g" }),
  buildRecipeIngredient(cheddar, { quantity: 60, unit: "g" }),
];

const frittata: RecipeEditorExisting = {
  id: RECIPE_ID,
  name: "Spinach and cheddar frittata",
  servings: 4,
  yield_grams: 620,
  instructions: ["Whisk the eggs."],
  ingredients: frittataIngredients,
};

let queryClient: QueryClient;

async function showEditor(existing: RecipeEditorExisting = frittata) {
  queryClient = createDiaryQueryClient();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={diaryClient} queryClient={queryClient}>
        <ToastProvider>
          <RecipeEditor existing={existing} />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
  return user;
}

const card = () => within(screen.getByLabelText("Per serving"));
const rowOf = (name: string, amount: string) =>
  screen.getByRole("button", { name: `${name}, ${amount}, change amount` });
const removeButton = (name: string) => screen.getByRole("button", { name: `Remove ${name}` });
const amountField = () => screen.getByLabelText(/^Amount/);
const letTypingStop = () =>
  act(() => {
    jest.advanceTimersByTime(500);
  });
const hero = (caption: string) => screen.getByLabelText(`Energy and macros, ${caption}`);

function expectChips(names: string[]) {
  const chips = screen.getAllByRole("radio");
  expect(chips).toHaveLength(names.length);
  names.forEach((name, index) => {
    expect(chips[index]).toHaveAccessibleName(name);
  });
}

describe("the recipe editor's ingredient rows", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/RecipeEditor",
      "components/RecipeDetailsFields",
      "components/RecipeIngredientsSection",
      "components/PerServingCard",
      "components/DiscardRecipeSheet",
      "components/FoodDetail",
      "components/PortionPicker",
      "components/IngredientAmountStep",
    ]);
  });

  beforeEach(() => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetDiaryBackend();
    mockUpdateRecipe.mockReset();
    mockHold.isHeld = false;
    mockFoodWithPortions.mockReset();
    mockFoodWithPortions.mockImplementation((id) => {
      const food = allFoods.find((candidate) => candidate.id === id);
      return food === undefined
        ? { status: "notFound" }
        : { status: "ready", food, portions: portionsOfFood[id] ?? [] };
    });
    jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => undefined);
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("the rows", () => {
    it("should list the frittata's six, counted in the heading, with the amount each is used in", async () => {
      await showEditor();

      expect(screen.getByRole("heading", { name: "Ingredients · 6" })).toBeOnTheScreen();
      const list = within(screen.getByLabelText("Ingredients"));
      [
        "Eggs, chicken, whole, raw",
        "Milk, semi-skimmed, pasteurised, average",
        "Oil, olive",
        "Onions, raw",
        "Spinach, baby, raw",
        "Cheese, Cheddar, English",
      ].forEach((name) => {
        expect(list.getByText(name)).toBeOnTheScreen();
      });
      [
        "6 × 1 large (300 g)",
        "100 ml",
        "1 tbsp (15 ml)",
        "1 medium (110 g)",
        "100 g",
        "60 g",
      ].forEach((amount) => {
        expect(list.getByText(amount)).toBeOnTheScreen();
      });
    });

    it("should write each row's energy and macros on its stats line", async () => {
      await showEditor();

      const oilRow = within(rowOf("Oil, olive", "1 tbsp (15 ml)"));
      expect(oilRow.getByText("124")).toBeOnTheScreen();
      expect(oilRow.getByText("0 P")).toBeOnTheScreen();
      expect(oilRow.getByText("14 F")).toBeOnTheScreen();
    });

    it("should give every row an X named for its food, and show the card at 217 kcal", async () => {
      await showEditor();

      expect(removeButton("Onions, raw")).toBeOnTheScreen();
      expect(screen.getAllByRole("button", { name: /^Remove / })).toHaveLength(6);
      expect(card().getByText("217")).toBeOnTheScreen();
    });
  });

  describe("opening an ingredient", () => {
    it("should open the onion's amount step with its chips, none of them a spoon", async () => {
      const user = await showEditor();

      await user.press(rowOf("Onions, raw", "1 medium (110 g)"));

      expect(screen.getByRole("heading", { name: "Onions, raw" })).toBeOnTheScreen();
      expect(within(hero("For 1 medium (110 g)")).getByText("39")).toBeOnTheScreen();
      expect(amountField()).toHaveDisplayValue("1");
      expectChips(["1 small", "1 medium", "1 large", "g"]);
      expect(screen.getByRole("radio", { name: "1 medium", checked: true })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Remove from recipe" })).toBeEnabled();
    });

    it("should open the oil on 1 tbsp with g, ml, 1 tsp and 1 tbsp", async () => {
      const user = await showEditor();

      await user.press(rowOf("Oil, olive", "1 tbsp (15 ml)"));

      expectChips(["g", "ml", "1 tsp", "1 tbsp"]);
      expect(screen.getByRole("radio", { name: "1 tbsp", checked: true })).toBeOnTheScreen();
      expect(within(hero("For 1 tbsp (15 ml, 14 g)")).getByText("124")).toBeOnTheScreen();
    });

    it("should reset the amount when a chip is pressed", async () => {
      const user = await showEditor();
      await user.press(rowOf("Oil, olive", "1 tbsp (15 ml)"));

      await user.press(screen.getByRole("radio", { name: "g" }));

      expect(amountField()).toHaveDisplayValue("100");
    });

    it("should hide the editor from a screen reader while the step is open, and show it again after", async () => {
      const user = await showEditor();
      await user.press(rowOf("Onions, raw", "1 medium (110 g)"));

      expect(screen.queryByRole("heading", { name: "Ingredients · 6" })).not.toBeOnTheScreen();

      await user.press(screen.getByRole("button", { name: "Back" }));

      expect(screen.getByRole("heading", { name: "Ingredients · 6" })).toBeOnTheScreen();
    });

    it("should leave the draft alone on Back, and take a screen reader to the Ingredients heading", async () => {
      const user = await showEditor();
      await user.press(rowOf("Onions, raw", "1 medium (110 g)"));
      jest.mocked(AccessibilityInfo.sendAccessibilityEvent).mockClear();

      await user.press(screen.getByRole("button", { name: "Back" }));

      expect(screen.getByText("1 medium (110 g)")).toBeOnTheScreen();
      expect(mockHold.isHeld).toBe(false);
      expect(AccessibilityInfo.sendAccessibilityEvent).toHaveBeenCalledWith(
        expect.anything(),
        "focus",
      );
    });

    it("should close the step, and not ask about discarding, on the Android back button", async () => {
      const user = await showEditor();
      await user.press(rowOf("Onions, raw", "1 medium (110 g)"));
      expect(mockHold.isHeld).toBe(true);

      await act(() => {
        mockHold.onHeld({ data: { action: { type: "GO_BACK" } } });
      });

      expect(screen.getByRole("heading", { name: "Ingredients · 6" })).toBeOnTheScreen();
      expect(screen.queryByText("Discard changes?")).not.toBeOnTheScreen();
    });
  });

  describe("changing an amount", () => {
    it("should put the new amount in the ingredient's place and move the card", async () => {
      const user = await showEditor();
      await user.press(rowOf("Oil, olive", "1 tbsp (15 ml)"));

      await user.clear(amountField());
      await user.type(amountField(), "2");
      await user.press(screen.getByRole("button", { name: "Save" }));
      await letTypingStop();

      expect(screen.getByRole("heading", { name: "Ingredients · 6" })).toBeOnTheScreen();
      expect(screen.getByText("2 tbsp (30 ml)")).toBeOnTheScreen();
      expect(card().getByText("248")).toBeOnTheScreen();
      const rows = within(screen.getByLabelText("Ingredients")).getAllByRole("button", {
        name: /change amount$/,
      });
      expect(rows[2]).toHaveAccessibleName("Oil, olive, 2 tbsp (30 ml), change amount");
    });

    it("should keep the values the ingredient was added with when the food has changed since", async () => {
      mockFoodWithPortions.mockImplementation((id) =>
        id === onions.id
          ? {
              status: "ready",
              food: { ...onions, kcal: 90 },
              portions: portionsOfFood[onions.id] ?? [],
            }
          : { status: "notFound" },
      );
      const user = await showEditor();
      await user.press(rowOf("Onions, raw", "1 medium (110 g)"));

      expect(within(hero("For 1 medium (110 g)")).getByText("39")).toBeOnTheScreen();
    });

    it("should not save an amount that is not above 0, and say why", async () => {
      const user = await showEditor();
      await user.press(rowOf("Onions, raw", "1 medium (110 g)"));

      await user.clear(amountField());
      await user.type(amountField(), "0");

      expect(screen.getByText("Enter an amount above 0.")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    });

    it("should send the changed ingredient when the recipe is saved", async () => {
      mockUpdateRecipe.mockResolvedValue({ ...frittata });
      const user = await showEditor();
      await user.press(rowOf("Oil, olive", "1 tbsp (15 ml)"));
      await user.clear(amountField());
      await user.type(amountField(), "2");
      await user.press(screen.getByRole("button", { name: "Save" }));

      await user.press(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(mockUpdateRecipe).toHaveBeenCalledTimes(1);
      });
      const sent = mockUpdateRecipe.mock.calls[0]?.[0].ingredients;
      expect(sent).toHaveLength(6);
      expect(sent?.[2]).toMatchObject({ quantity: 2, unit: "portion", portion_id: null });
    });
  });

  describe("opening a step after a removal", () => {
    it("should take the toast and its Undo down when a step opens, so neither covers it nor changes the list behind it", async () => {
      const user = await showEditor();
      await user.press(removeButton("Oil, olive"));
      expect(screen.getByText("Ingredient removed")).toBeOnTheScreen();

      await user.press(rowOf("Onions, raw", "1 medium (110 g)"));

      expect(screen.queryByText("Ingredient removed")).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Undo" })).not.toBeOnTheScreen();
    });

    it("should change the ingredient that was opened, in its new place, after another was removed", async () => {
      const user = await showEditor();
      await user.press(removeButton("Oil, olive"));
      await user.press(rowOf("Onions, raw", "1 medium (110 g)"));

      await user.clear(amountField());
      await user.type(amountField(), "2");
      await user.press(screen.getByRole("button", { name: "Save" }));

      expect(screen.getByRole("heading", { name: "Ingredients · 5" })).toBeOnTheScreen();
      const rows = within(screen.getByLabelText("Ingredients")).getAllByRole("button", {
        name: /change amount$/,
      });
      expect(rows[2]).toHaveAccessibleName("Onions, raw, 2 × 1 medium (220 g), change amount");
      expect(screen.queryByText("Oil, olive")).not.toBeOnTheScreen();
    });

    it("should remove the ingredient that was opened, and not the one that now has its old place", async () => {
      const user = await showEditor();
      await user.press(removeButton("Oil, olive"));
      await user.press(rowOf("Onions, raw", "1 medium (110 g)"));

      await user.press(screen.getByRole("button", { name: "Remove from recipe" }));

      expect(screen.getByRole("heading", { name: "Ingredients · 4" })).toBeOnTheScreen();
      expect(screen.queryByText("Onions, raw")).not.toBeOnTheScreen();
      expect(screen.getByText("Spinach, baby, raw")).toBeOnTheScreen();
    });

    it("should open each step afresh, with the amount of its own ingredient", async () => {
      const user = await showEditor();
      await user.press(rowOf("Onions, raw", "1 medium (110 g)"));
      await user.clear(amountField());
      await user.type(amountField(), "3");
      await user.press(screen.getByRole("button", { name: "Back" }));

      await user.press(rowOf("Onions, raw", "1 medium (110 g)"));
      expect(amountField()).toHaveDisplayValue("1");
      await user.press(screen.getByRole("button", { name: "Back" }));
      await user.press(rowOf("Spinach, baby, raw", "100 g"));

      expect(screen.getByRole("heading", { name: "Spinach, baby, raw" })).toBeOnTheScreen();
      expect(amountField()).toHaveDisplayValue("100");
    });
  });

  describe("removing an ingredient", () => {
    it("should remove it at once with the X, with no question, and say so with an Undo", async () => {
      const user = await showEditor();

      await user.press(removeButton("Oil, olive"));
      await letTypingStop();

      expect(screen.getByRole("heading", { name: "Ingredients · 5" })).toBeOnTheScreen();
      expect(screen.queryByText("Oil, olive")).not.toBeOnTheScreen();
      expect(screen.getByText("Ingredient removed")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Undo" })).toBeOnTheScreen();
      expect(card().getByText("186")).toBeOnTheScreen();
    });

    it("should put the ingredient back in its place on Undo", async () => {
      const user = await showEditor();
      await user.press(removeButton("Oil, olive"));

      await user.press(screen.getByRole("button", { name: "Undo" }));
      await letTypingStop();

      expect(screen.getByRole("heading", { name: "Ingredients · 6" })).toBeOnTheScreen();
      const rows = within(screen.getByLabelText("Ingredients")).getAllByRole("button", {
        name: /change amount$/,
      });
      expect(rows[2]).toHaveAccessibleName("Oil, olive, 1 tbsp (15 ml), change amount");
      expect(card().getByText("217")).toBeOnTheScreen();
    });

    it("should remove it from the amount step with Remove from recipe, and return to the editor", async () => {
      const user = await showEditor();
      await user.press(rowOf("Oil, olive", "1 tbsp (15 ml)"));

      await user.press(screen.getByRole("button", { name: "Remove from recipe" }));
      await letTypingStop();

      expect(screen.getByRole("heading", { name: "Ingredients · 5" })).toBeOnTheScreen();
      expect(screen.getByText("Ingredient removed")).toBeOnTheScreen();
      expect(card().getByText("186")).toBeOnTheScreen();
    });

    it("should bring an ingredient removed from the step back with Undo", async () => {
      const user = await showEditor();
      await user.press(rowOf("Onions, raw", "1 medium (110 g)"));
      await user.press(screen.getByRole("button", { name: "Remove from recipe" }));

      await user.press(screen.getByRole("button", { name: "Undo" }));

      expect(screen.getByRole("heading", { name: "Ingredients · 6" })).toBeOnTheScreen();
      expect(screen.getByText("1 medium (110 g)")).toBeOnTheScreen();
    });

    it("should take a screen reader to the Ingredients heading, since the row it was on is gone", async () => {
      const user = await showEditor();
      jest.mocked(AccessibilityInfo.sendAccessibilityEvent).mockClear();

      await user.press(removeButton("Oil, olive"));

      expect(AccessibilityInfo.sendAccessibilityEvent).toHaveBeenCalledWith(
        expect.anything(),
        "focus",
      );
    });

    it("should count a removal as a change to leave behind, and no change once it is undone", async () => {
      const user = await showEditor();
      await user.press(removeButton("Oil, olive"));
      expect(mockHold.isHeld).toBe(true);

      await user.press(screen.getByRole("button", { name: "Undo" }));

      expect(mockHold.isHeld).toBe(false);
    });
  });

  describe("offline", () => {
    it("should still edit, remove and undo, and leave only Save dimmed", async () => {
      const user = await showEditor();
      await act(() => {
        onlineManager.setOnline(false);
      });

      await user.press(removeButton("Oil, olive"));
      await user.press(screen.getByRole("button", { name: "Undo" }));
      await user.press(rowOf("Onions, raw", "1 medium (110 g)"));
      await user.clear(amountField());
      await user.type(amountField(), "2");

      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
      await user.press(screen.getByRole("button", { name: "Remove from recipe" }));
      await user.press(screen.getByRole("button", { name: "Undo" }));
      expect(screen.getByRole("heading", { name: "Ingredients · 6" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    });
  });

  describe("while the recipe is saving", () => {
    it("should not open or remove an ingredient", async () => {
      let finishSave: (recipe: RecipeEditorExisting) => void = () => undefined;
      mockUpdateRecipe.mockReturnValue(
        new Promise<RecipeEditorExisting>((resolve) => {
          finishSave = resolve;
        }),
      );
      const user = await showEditor();
      await user.press(removeButton("Oil, olive"));
      await user.press(screen.getByRole("button", { name: "Save" }));

      await user.press(removeButton("Onions, raw"));
      await user.press(rowOf("Spinach, baby, raw", "100 g"));

      expect(screen.getByRole("heading", { name: "Ingredients · 5" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Remove from recipe" })).not.toBeOnTheScreen();
      await act(() => {
        finishSave({ ...frittata, ingredients: frittataIngredients.slice(0, 5) });
      });
    });
  });
});
