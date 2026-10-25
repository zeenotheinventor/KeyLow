import "react-native-gesture-handler/jestSetup";

import { KeyLowProvider } from "@keylow/api-client";
import { SNAPSHOT_VERSION } from "@keylow/core/diary";
import { MAX_RECIPE_INGREDIENTS, buildRecipeIngredient } from "@keylow/core/recipes";
import { buildFood, buildFoodPortion, buildOffCandidate } from "@keylow/core/testing";
import { onlineManager } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from "@testing-library/react-native";
import { AccessibilityInfo, ScrollView, View } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { RecipeEditor } from "../../components/RecipeEditor";
import { ToastProvider } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { trackFieldSelection } from "../support/amountFieldSelection";
import {
  createDiaryQueryClient,
  diaryBackend,
  diaryClient,
  resetDiaryBackend,
} from "../support/diaryBackend";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { RecipeEditorExisting } from "../../components/RecipeEditor";
import type {
  FoodSearchHit,
  FoodSearchResult,
  FoodWithPortionsState,
  RecentFood,
} from "@keylow/api-client";
import type { QueryClient } from "@tanstack/react-query";

// Adding an ingredient from the recipe editor: Add ingredient opens the food search in its ingredient mode
// over the editor, a row opens the amount step, and Add to recipe puts the ingredient at the end of the draft.
// The brief's frittata is the recipe. The search and the food's read are stood in for.

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

const mockMaterialiseOffProduct = jest.fn();
const mockUpdateRecipe = jest.fn<
  Promise<RecipeEditorExisting>,
  [{ ingredients: RecipeEditorExisting["ingredients"] }]
>();
const mockFoodWithPortions = jest.fn<FoodWithPortionsState, [string]>();
const mockFoodSearch = jest.fn<FoodSearchResult, [string]>();
const mockRecentFoods: { current: RecentFood[] } = { current: [] };

jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<object>("@keylow/api-client"),
  useMaterialiseOffProduct: () => ({ mutateAsync: mockMaterialiseOffProduct }),
  useCreateRecipe: () => ({ mutateAsync: jest.fn() }),
  useUpdateRecipe: () => ({ mutateAsync: mockUpdateRecipe }),
  useFoodWithPortions: (id: string) => mockFoodWithPortions(id),
  useFoodSearch: (query: string) => mockFoodSearch(query),
  useRecentFoods: () => ({
    data: mockRecentFoods.current,
    isPending: false,
    isError: false,
  }),
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
  source: "cofid",
  name: "Onions, raw",
  kcal: 35,
  protein_g: 1,
  carbs_g: 8,
  fat_g: 0.1,
});
const spinach = buildFood({
  id: uuidOf("5"),
  source: "cofid",
  name: "Spinach, baby, raw",
  kcal: 16,
  protein_g: 2.6,
  carbs_g: 0.2,
  fat_g: 0.6,
});
const matureSpinach = buildFood({
  id: uuidOf("7"),
  source: "cofid",
  name: "Spinach, mature, raw",
  kcal: 25,
  protein_g: 2.8,
  carbs_g: 1.6,
  fat_g: 0.8,
});
const cheddar = buildFood({
  id: uuidOf("6"),
  name: "Cheese, Cheddar, English",
  kcal: 416,
  protein_g: 25.4,
  carbs_g: 0.1,
  fat_g: 34.9,
});
const mysteryBar = buildFood({
  id: uuidOf("8"),
  source: "off",
  name: "Mystery bar",
  kcal: 400,
  protein_g: 10,
  fat_g: 20,
  carbs_g: null,
});

const ketchup = buildFood({
  id: uuidOf("9"),
  source: "off",
  name: "Tomato ketchup",
  kcal: 100,
  protein_g: 1,
  carbs_g: 25,
  fat_g: 0,
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
  position: 1,
  is_default: true,
});
const portionsOfFood: Record<string, ReturnType<typeof buildFoodPortion>[]> = {
  [ketchup.id]: [
    buildFoodPortion({
      id: uuidOf("f"),
      food_id: ketchup.id,
      label: "1 tbsp (15 g)",
      grams: 15,
      is_default: true,
    }),
  ],
  [onions.id]: [
    buildFoodPortion({
      id: uuidOf("c"),
      food_id: onions.id,
      label: "1 small",
      grams: 80,
      position: 0,
    }),
    mediumOnion,
    buildFoodPortion({
      id: uuidOf("e"),
      food_id: onions.id,
      label: "1 large",
      grams: 150,
      position: 2,
    }),
  ],
};
const allFoods = [eggs, milk, oil, onions, spinach, matureSpinach, cheddar, mysteryBar, ketchup];

function hitOf(food: ReturnType<typeof buildFood>, score: number): FoodSearchHit {
  return {
    id: food.id,
    source: food.source,
    name: food.name,
    brand: food.brand,
    basis: food.basis,
    kcal: food.kcal,
    protein_g: food.protein_g,
    fat_g: food.fat_g,
    carbs_g: food.carbs_g,
    fibre_g: food.fibre_g,
    quality: food.quality,
    default_portion_id: null,
    default_portion_label: null,
    default_portion_grams: null,
    default_portion_ml: null,
    score,
  };
}

const idleSearch: FoodSearchResult = {
  local: [],
  off: [],
  isLoadingLocal: false,
  isLoadingOff: false,
  isDebouncing: false,
  offError: null,
  localError: null,
};

const frittataIngredients = [
  buildRecipeIngredient(eggs, { quantity: 6, unit: "portion", portion: largeEgg }),
  buildRecipeIngredient(milk, { quantity: 100, unit: "ml" }),
  buildRecipeIngredient(oil, {
    quantity: 1,
    unit: "portion",
    portion: { id: "spoon-tbsp", label: "1 tbsp", grams: null, ml: 15 },
  }),
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

const hundredIngredients: RecipeEditorExisting = {
  ...frittata,
  ingredients: Array.from({ length: MAX_RECIPE_INGREDIENTS }, () => frittataIngredients[1]).flatMap(
    (ingredient) => (ingredient === undefined ? [] : [ingredient]),
  ),
};

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

let queryClient: QueryClient;

async function showEditor(existing?: RecipeEditorExisting) {
  queryClient = createDiaryQueryClient();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={diaryClient} queryClient={queryClient}>
        <ToastProvider>
          <RecipeEditor existing={existing ?? frittata} />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
  return user;
}

// What a screen reader's focus was sent to, by the name on it. The element itself is never put in an
// assertion, because a failure would print the whole tree of it.
const focusedNames: string[] = [];

function nameOf(node: unknown): string {
  if (typeof node !== "object" || node === null || !("props" in node)) {
    return "";
  }
  const { props } = node;
  if (typeof props !== "object" || props === null) {
    return "";
  }
  const label = "aria-label" in props ? props["aria-label"] : undefined;
  const accessibilityLabel = "accessibilityLabel" in props ? props.accessibilityLabel : undefined;
  return typeof label === "string"
    ? label
    : typeof accessibilityLabel === "string"
      ? accessibilityLabel
      : "";
}

const lastFocused = () => focusedNames.at(-1);

const card = () => within(screen.getByLabelText("Per serving"));
const addRow = () => screen.getByRole("button", { name: "Add ingredient" });
const searchField = () => screen.getByRole("searchbox", { name: "Search foods" });
const amountField = () => screen.getByLabelText(/^Amount/);
const letTypingStop = () =>
  act(() => {
    jest.advanceTimersByTime(500);
  });
const hero = (caption: string) => screen.getByLabelText(`Energy and macros, ${caption}`);
const resultRow = (name: string, serving: string) =>
  screen.getByRole("button", { name: `${name}, ${serving}, choose amount` });

async function type(text: string) {
  await fireEvent.changeText(searchField(), text);
}

function findsSpinach() {
  mockFoodSearch.mockReturnValue({
    ...idleSearch,
    local: [hitOf(spinach, 0.9), hitOf(matureSpinach, 0.8)],
  });
}

// Pressing a unit chip selects the amount, which the jest preset's text field cannot do.
trackFieldSelection();

describe("adding an ingredient from the recipe editor", () => {
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
      "components/AddIngredientSheet",
      "components/AddIngredientAmountStep",
      "components/FoodLoadState",
      "components/FoodSearch",
    ]);
  });

  beforeEach(() => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetDiaryBackend();
    mockUpdateRecipe.mockReset();
    mockMaterialiseOffProduct.mockReset();
    mockHold.isHeld = false;
    mockRecentFoods.current = [];
    mockFoodSearch.mockReset();
    mockFoodSearch.mockReturnValue(idleSearch);
    mockFoodWithPortions.mockReset();
    mockFoodWithPortions.mockImplementation((id) => {
      const food = allFoods.find((candidate) => candidate.id === id);
      return food === undefined
        ? { status: "notFound" }
        : { status: "ready", food, portions: portionsOfFood[id] ?? [] };
    });
    jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => undefined);
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    focusedNames.length = 0;
    jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent").mockImplementation((node, event) => {
      if (event === "focus") {
        focusedNames.push(nameOf(node));
      }
    });
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

  describe("the Add ingredient row", () => {
    it("should come after the last ingredient", async () => {
      await showEditor();

      const buttons = within(screen.getByLabelText("Ingredients")).getAllByRole("button");
      expect(buttons.at(-1)).toHaveAccessibleName("Add ingredient");
    });
  });

  describe("the search sheet", () => {
    it("should open over the editor, titled Add ingredient, with Close", async () => {
      const user = await showEditor();

      await user.press(addRow());

      expect(screen.getByRole("heading", { name: "Add ingredient" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Close" })).toBeOnTheScreen();
    });

    it("should offer no Quick add row and no create control, but the scanner", async () => {
      const user = await showEditor();

      await user.press(addRow());

      expect(screen.queryByRole("button", { name: /Quick add/ })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Create a food" })).not.toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Scan barcode" })).toBeOnTheScreen();
    });

    it("should hide the editor from a screen reader while it is open", async () => {
      const user = await showEditor();

      await user.press(addRow());

      expect(screen.queryByRole("heading", { name: "Ingredients · 5" })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Save" })).not.toBeOnTheScreen();
    });

    it("should say nothing is recent when no food was ever logged", async () => {
      const user = await showEditor();

      await user.press(addRow());

      expect(screen.getByText("Nothing recent")).toBeOnTheScreen();
    });
  });

  describe("the results", () => {
    it("should name each row for its food, its serving and what the row does, with a chevron and no plus", async () => {
      findsSpinach();
      const user = await showEditor();
      await user.press(addRow());

      await type("spinach");

      expect(resultRow("Spinach, baby, raw", "100 g")).toBeOnTheScreen();
      expect(resultRow("Spinach, mature, raw", "100 g")).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /^Add Spinach/ })).not.toBeOnTheScreen();
      const babyRow = within(resultRow("Spinach, baby, raw", "100 g"));
      expect(babyRow.getByText("16")).toBeOnTheScreen();
      expect(babyRow.getByText("2.6 P")).toBeOnTheScreen();
    });

    it("should group them under their source", async () => {
      findsSpinach();
      const user = await showEditor();
      await user.press(addRow());

      await type("spinach");

      expect(screen.getByText(/Common foods/)).toBeOnTheScreen();
    });

    it("should offer no recipes, even when one matches the word typed", async () => {
      diaryBackend.recipes = [
        { id: RECIPE_ID, name: "Spinach pie", servings: 4, yield_grams: 800, is_archived: false },
      ];
      findsSpinach();
      const user = await showEditor();
      await user.press(addRow());

      await type("spinach");

      expect(screen.queryByText("Spinach pie")).not.toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: /recipes/i })).not.toBeOnTheScreen();
    });

    it("should say nothing was found without offering to create a food", async () => {
      const user = await showEditor();
      await user.press(addRow());

      await type("zzzz");

      expect(screen.getByText("No foods found")).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /Create a food/ })).not.toBeOnTheScreen();
    });

    it("should name a food that needs review as one, and still open it", async () => {
      mockFoodSearch.mockReturnValue({ ...idleSearch, local: [hitOf(mysteryBar, 0.9)] });
      const user = await showEditor();
      await user.press(addRow());
      await type("mystery");

      await user.press(
        screen.getByRole("button", { name: "Mystery bar, 100 g, Needs review, choose amount" }),
      );

      expect(screen.getByRole("heading", { name: "Mystery bar" })).toBeOnTheScreen();
    });
  });

  describe("an Open Food Facts result", () => {
    const oatDrink = buildOffCandidate({
      code: "5000168001234",
      name: "Oat drink",
      brand: "Oatly",
      basis: "per_100ml",
      kcal: 46,
      protein_g: 1,
      fat_g: 1.5,
      carbs_g: 6.7,
      fibre_g: 0.8,
    });
    const oatBar = buildOffCandidate({
      code: "5000168009999",
      name: "Oat bar",
      brand: "Oatly",
      basis: "per_100g",
      kcal: 400,
      protein_g: 10,
      fat_g: 10,
      carbs_g: 60,
      fibre_g: 5,
    });

    it("should leave the rows usable when Back returns from the amount step, because the sheet never lost focus", async () => {
      mockFoodSearch.mockReturnValue({ ...idleSearch, off: [oatDrink, oatBar] });
      mockMaterialiseOffProduct.mockResolvedValue(onions);
      const user = await showEditor();
      await user.press(addRow());
      await type("oat");

      await user.press(screen.getByRole("button", { name: /^Oat drink/ }));
      expect(screen.getByRole("heading", { name: "Onions, raw" })).toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: "Back" }));

      expect(screen.queryByText("Adding to your foods")).not.toBeOnTheScreen();
      expect(screen.getByRole("button", { name: /^Oat drink/ })).toBeEnabled();
      expect(screen.getByRole("button", { name: /^Oat bar/ })).toBeEnabled();
    });
  });

  describe("the Recent foods", () => {
    it("should open the amount step with the amount the food was last logged with", async () => {
      mockRecentFoods.current = [oatsLoggedAt50Grams];
      const user = await showEditor();
      await user.press(addRow());

      expect(screen.queryByRole("button", { name: /Quick add/ })).not.toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: /^Onions, raw/ }));

      expect(screen.getByRole("heading", { name: "Onions, raw" })).toBeOnTheScreen();
      expect(amountField()).toHaveDisplayValue("50");
      expect(screen.getByRole("radio", { name: "g", checked: true })).toBeOnTheScreen();
    });
  });

  describe("choosing an amount", () => {
    async function chooseOnions() {
      mockFoodSearch.mockReturnValue({ ...idleSearch, local: [hitOf(onions, 0.9)] });
      const user = await showEditor();
      await user.press(addRow());
      await type("onions");
      await user.press(resultRow("Onions, raw", "100 g"));
      return user;
    }

    it("should open the amount step, with Add to recipe and no Time row", async () => {
      await chooseOnions();

      expect(screen.getByRole("heading", { name: "Onions, raw" })).toBeOnTheScreen();
      expect(within(hero("For 1 medium (110 g)")).getByText("39")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Add to recipe" })).toBeEnabled();
      expect(screen.queryByRole("button", { name: /^Now|^Time/ })).not.toBeOnTheScreen();
    });

    it("should go Back to the same results for the same words", async () => {
      const user = await chooseOnions();

      await user.press(screen.getByRole("button", { name: "Back" }));

      expect(screen.getByRole("heading", { name: "Add ingredient" })).toBeOnTheScreen();
      expect(searchField()).toHaveDisplayValue("onions");
      expect(resultRow("Onions, raw", "100 g")).toBeOnTheScreen();
    });

    it("should step back with the Android back button, from the amount to the results to the editor", async () => {
      await chooseOnions();
      expect(mockHold.isHeld).toBe(true);

      await act(() => {
        mockHold.onHeld({ data: { action: { type: "GO_BACK" } } });
      });
      expect(screen.getByRole("heading", { name: "Add ingredient" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Add to recipe" })).not.toBeOnTheScreen();

      await act(() => {
        mockHold.onHeld({ data: { action: { type: "GO_BACK" } } });
      });
      expect(screen.getByRole("heading", { name: "Ingredients · 5" })).toBeOnTheScreen();
      expect(screen.queryByText("Discard changes?")).not.toBeOnTheScreen();
    });
  });

  describe("Add to recipe", () => {
    async function addOnions() {
      mockFoodSearch.mockReturnValue({ ...idleSearch, local: [hitOf(onions, 0.9)] });
      const user = await showEditor();
      await user.press(addRow());
      await type("onions");
      await user.press(resultRow("Onions, raw", "100 g"));
      await user.press(screen.getByRole("button", { name: "Add to recipe" }));
      return user;
    }

    it("should return to the editor with the ingredient at the end and the count changed", async () => {
      await addOnions();

      expect(screen.queryByRole("heading", { name: "Add ingredient" })).not.toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Ingredients · 6" })).toBeOnTheScreen();
      const rows = within(screen.getByLabelText("Ingredients")).getAllByRole("button", {
        name: /change amount$/,
      });
      expect(rows).toHaveLength(6);
      expect(rows[5]).toHaveAccessibleName("Onions, raw, 1 medium (110 g), change amount");
    });

    it("should move the card by what was added: 39 kcal of onion in a pan for four", async () => {
      mockFoodSearch.mockReturnValue({ ...idleSearch, local: [hitOf(onions, 0.9)] });
      const user = await showEditor();
      expect(card().getByText("208")).toBeOnTheScreen();
      await user.press(addRow());
      await type("onions");
      await user.press(resultRow("Onions, raw", "100 g"));
      await user.press(screen.getByRole("button", { name: "Add to recipe" }));
      await letTypingStop();

      expect(card().getByText("217")).toBeOnTheScreen();
    });

    it("should freeze the density of the food's serving label into the ingredient it adds", async () => {
      mockUpdateRecipe.mockResolvedValue({ ...frittata });
      mockFoodSearch.mockReturnValue({ ...idleSearch, local: [hitOf(ketchup, 0.9)] });
      const user = await showEditor();
      await user.press(addRow());
      await type("ketchup");
      await user.press(resultRow("Tomato ketchup", "100 g"));
      await user.press(screen.getByRole("radio", { name: "1 tbsp" }));
      await user.press(screen.getByRole("button", { name: "Add to recipe" }));

      await user.press(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(mockUpdateRecipe).toHaveBeenCalledTimes(1);
      });
      const added = mockUpdateRecipe.mock.calls[0]?.[0].ingredients.at(-1);
      expect(added?.snapshot.density).toBe(1);
      expect(added?.resolved_grams).toBeCloseTo(15, 10);
    });

    it("should save nothing until the recipe is saved, and then send it with the others", async () => {
      mockUpdateRecipe.mockResolvedValue({ ...frittata });
      const user = await addOnions();
      expect(mockUpdateRecipe).not.toHaveBeenCalled();

      await user.press(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(mockUpdateRecipe).toHaveBeenCalledTimes(1);
      });
      const sent = mockUpdateRecipe.mock.calls[0]?.[0].ingredients;
      expect(sent).toHaveLength(6);
      expect(sent?.[5]).toMatchObject({ food_id: onions.id, quantity: 1, unit: "portion" });
    });

    it("should hold the recipe against being left, because it now has a change", async () => {
      await addOnions();

      expect(mockHold.isHeld).toBe(true);
    });

    it("should send a screen reader's focus back to the Add ingredient row", async () => {
      await addOnions();

      expect(lastFocused()).toBe("Add ingredient");
    });

    it("should scroll forward to the end of the Ingredients when it is out of view", async () => {
      const scrollTo = jest
        .spyOn(ScrollView.prototype, "scrollTo")
        .mockImplementation(() => undefined);
      jest.spyOn(View.prototype, "measureLayout").mockImplementation((_relativeTo, onSuccess) => {
        onSuccess(0, 900, 358, 500);
      });
      mockFoodSearch.mockReturnValue({ ...idleSearch, local: [hitOf(onions, 0.9)] });
      const user = await showEditor();
      // The scroll view reports its height, which the heading sits inside.
      await fireEvent(screen.getByRole("heading", { name: "Ingredients · 5" }), "layout", {
        nativeEvent: { layout: { height: 600 } },
      });
      await user.press(addRow());
      await type("onions");
      await user.press(resultRow("Onions, raw", "100 g"));

      await user.press(screen.getByRole("button", { name: "Add to recipe" }));

      expect(scrollTo).toHaveBeenCalledWith({ y: 900 + 500 - 600 + 16, animated: false });
    });
  });

  describe("a toast with an Undo", () => {
    it("should be taken down when the sheet opens, so it neither covers the search nor changes the list behind it", async () => {
      const user = await showEditor();
      await user.press(screen.getByRole("button", { name: "Remove Oil, olive" }));
      expect(screen.getByRole("button", { name: "Undo" })).toBeOnTheScreen();

      await user.press(addRow());

      expect(screen.queryByRole("button", { name: "Undo" })).not.toBeOnTheScreen();
      expect(screen.queryByText("Ingredient removed")).not.toBeOnTheScreen();
    });
  });

  describe("Close", () => {
    it("should return to the editor with the draft as it was, and the focus on the Add ingredient row", async () => {
      const user = await showEditor();
      await user.press(addRow());
      focusedNames.length = 0;

      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(screen.queryByRole("heading", { name: "Add ingredient" })).not.toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Ingredients · 5" })).toBeOnTheScreen();
      expect(mockHold.isHeld).toBe(false);
      expect(lastFocused()).toBe("Add ingredient");
    });

    it("should keep what was typed in the details, because the editor stays under the sheet", async () => {
      const user = await showEditor();
      const name = screen.getByLabelText(/^Name/);
      await user.clear(name);
      await user.type(name, "Frittata for two");
      await user.press(addRow());

      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(screen.getByLabelText(/^Name/)).toHaveDisplayValue("Frittata for two");
    });

    it("should start the next search afresh", async () => {
      findsSpinach();
      const user = await showEditor();
      await user.press(addRow());
      await type("spinach");
      await user.press(screen.getByRole("button", { name: "Close" }));

      await user.press(addRow());

      expect(searchField()).toHaveDisplayValue("");
    });
  });

  describe("a food that needs review", () => {
    it("should not add it, offer no way to copy it away, and leave the draft and the screen where they were", async () => {
      mockFoodSearch.mockReturnValue({ ...idleSearch, local: [hitOf(mysteryBar, 0.9)] });
      const user = await showEditor();
      const name = screen.getByLabelText(/^Name/);
      await user.clear(name);
      await user.type(name, "Frittata for two");
      await user.press(addRow());
      await type("mystery");

      await user.press(
        screen.getByRole("button", { name: "Mystery bar, 100 g, Needs review, choose amount" }),
      );

      expect(screen.getByText("Needs review")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Add to recipe" })).toBeDisabled();
      expect(screen.queryByRole("button", { name: /Copy to your foods/ })).not.toBeOnTheScreen();
      expect(routerMock.push).not.toHaveBeenCalled();

      await user.press(screen.getByRole("button", { name: "Back" }));
      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(screen.getByRole("heading", { name: "Ingredients · 5" })).toBeOnTheScreen();
      expect(screen.getByLabelText(/^Name/)).toHaveDisplayValue("Frittata for two");
    });
  });

  describe("at the most a recipe holds", () => {
    it("should turn the row off and say why, and not open the sheet", async () => {
      const user = await showEditor(hundredIngredients);

      await user.press(addRow());

      expect(addRow()).toBeDisabled();
      expect(screen.getByText("Up to 100 ingredients")).toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: "Add ingredient" })).not.toBeOnTheScreen();
    });

    it("should not say it below the most", async () => {
      await showEditor();

      expect(screen.queryByText("Up to 100 ingredients")).not.toBeOnTheScreen();
    });

    it("should take a screen reader's focus to the line that says why when the last one is added", async () => {
      const ninetyNine: RecipeEditorExisting = {
        ...hundredIngredients,
        ingredients: hundredIngredients.ingredients.slice(1),
      };
      mockFoodSearch.mockReturnValue({ ...idleSearch, local: [hitOf(onions, 0.9)] });
      const user = await showEditor(ninetyNine);
      await user.press(addRow());
      await type("onions");
      await user.press(resultRow("Onions, raw", "100 g"));

      await user.press(screen.getByRole("button", { name: "Add to recipe" }));

      expect(addRow()).toBeDisabled();
      expect(lastFocused()).toBe("Up to 100 ingredients");
    });
  });

  describe("offline", () => {
    it("should still search, choose and add, because only Save needs the connection", async () => {
      mockFoodSearch.mockReturnValue({ ...idleSearch, local: [hitOf(onions, 0.9)] });
      const user = await showEditor();
      await act(() => {
        onlineManager.setOnline(false);
      });
      await user.press(addRow());
      await type("onions");
      await user.press(resultRow("Onions, raw", "100 g"));

      await user.press(screen.getByRole("button", { name: "Add to recipe" }));

      expect(screen.getByRole("heading", { name: "Ingredients · 6" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    });
  });

  describe("while the recipe is saving", () => {
    it("should not open the sheet", async () => {
      let finishSave: (recipe: RecipeEditorExisting) => void = () => undefined;
      mockUpdateRecipe.mockReturnValue(
        new Promise<RecipeEditorExisting>((resolve) => {
          finishSave = resolve;
        }),
      );
      const user = await showEditor();
      await user.press(screen.getByRole("button", { name: "Save" }));

      await user.press(addRow());

      expect(screen.queryByRole("heading", { name: "Add ingredient" })).not.toBeOnTheScreen();
      await act(() => {
        finishSave(frittata);
      });
    });
  });

  describe("a new recipe", () => {
    it("should end the card of rows, and be the card's only row for a new recipe", async () => {
      queryClient = createDiaryQueryClient();
      await render(
        <ThemeProvider fixedPreference="dark">
          <KeyLowProvider client={diaryClient} queryClient={queryClient}>
            <ToastProvider>
              <RecipeEditor />
            </ToastProvider>
          </KeyLowProvider>
        </ThemeProvider>,
      );

      const list = within(screen.getByLabelText("Ingredients"));
      expect(list.getByRole("button", { name: "Add ingredient" })).toBeEnabled();
      expect(list.getAllByRole("button")).toHaveLength(1);
      expect(screen.getByText("Add the foods that go into it.")).toBeOnTheScreen();
    });
  });
});
