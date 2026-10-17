import {
  MAX_RECIPE_INGREDIENTS,
  buildRecipeIngredient,
  newRecipeDraft,
} from "@keylow/core/recipes";
import { buildFood } from "@keylow/core/testing";
import { render, screen, userEvent } from "@testing-library/react-native";
import { useState } from "react";
import { AccessibilityInfo, Text } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { useIngredientEdits } from "../../components/RecipeEditor/useIngredientEdits";
import { ToastProvider } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { RecipeDraft, RecipeIngredient } from "@keylow/core/recipes";

// The list changes the editor's Ingredients section makes, and the Undo that follows a removal. The list is
// core's, so these tests are about what the hook does around it: a full list, a list that changed since.

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

setUpTests();

const ingredientNamed = (name: string, grams = 100): RecipeIngredient =>
  buildRecipeIngredient(buildFood({ name }), { quantity: grams, unit: "g" });

const names = (draft: RecipeDraft) =>
  draft.ingredients.map((ingredient) => ingredient.snapshot.name);

// A screen holding a draft, with a button for each thing the hook does and one for an edit made elsewhere,
// such as adding an ingredient, which a later ticket gives the editor.
function Harness({ start }: { start: RecipeDraft }) {
  const [draft, setDraft] = useState(start);
  const edits = useIngredientEdits(draft.ingredients, setDraft);

  return (
    <>
      <Text accessibilityLabel="In the draft">{names(draft).join(", ")}</Text>
      <Text accessibilityLabel="Number in the draft">{draft.ingredients.length}</Text>
      <Text accessibilityLabel="Amount of the first">{draft.ingredients[0]?.quantity}</Text>
      <Text
        onPress={() => {
          edits.remove(1);
        }}
      >
        Remove second
      </Text>
      <Text
        onPress={() => {
          edits.remove(5);
        }}
      >
        Remove sixth
      </Text>
      <Text
        onPress={() => {
          edits.replace(0, ingredientNamed("Replaced", 250));
        }}
      >
        Replace first
      </Text>
      <Text
        onPress={() => {
          setDraft((current) => ({
            ...current,
            ingredients: [...current.ingredients, ingredientNamed("Added elsewhere")],
          }));
        }}
      >
        Add elsewhere
      </Text>
    </>
  );
}

async function showHarness(ingredients: RecipeIngredient[]) {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await render(
    <ThemeProvider fixedPreference="dark">
      <ToastProvider>
        <Harness start={{ ...newRecipeDraft("Frittata"), ingredients }} />
      </ToastProvider>
    </ThemeProvider>,
  );
  return user;
}

const inTheDraft = () => screen.getByLabelText("In the draft");
const count = () => screen.getByLabelText("Number in the draft");
const undo = () => screen.getByRole("button", { name: "Undo" });

describe("useIngredientEdits", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
    jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => undefined);
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const three = () => ["Eggs", "Milk", "Oil"].map((name) => ingredientNamed(name));

  it("should replace the ingredient in its place", async () => {
    const user = await showHarness(three());

    await user.press(screen.getByText("Replace first"));

    expect(inTheDraft()).toHaveTextContent("Replaced, Milk, Oil");
    expect(screen.getByLabelText("Amount of the first")).toHaveTextContent("250");
  });

  it("should remove the ingredient at once and say so with an Undo", async () => {
    const user = await showHarness(three());

    await user.press(screen.getByText("Remove second"));

    expect(inTheDraft()).toHaveTextContent("Eggs, Oil");
    expect(screen.getByText("Ingredient removed")).toBeOnTheScreen();
    expect(undo()).toBeOnTheScreen();
  });

  it("should put the ingredient back in its place on Undo", async () => {
    const user = await showHarness(three());
    await user.press(screen.getByText("Remove second"));

    await user.press(undo());

    expect(inTheDraft()).toHaveTextContent("Eggs, Milk, Oil");
  });

  it("should put the last ingredient back at the end", async () => {
    const six = ["A", "B", "C", "D", "E", "F"].map((name) => ingredientNamed(name));
    const user = await showHarness(six);
    await user.press(screen.getByText("Remove sixth"));

    await user.press(undo());

    expect(inTheDraft()).toHaveTextContent("A, B, C, D, E, F");
  });

  it("should put it back in the list as it is by then, when another edit was made after the removal", async () => {
    const user = await showHarness(three());
    await user.press(screen.getByText("Remove second"));
    await user.press(screen.getByText("Add elsewhere"));

    await user.press(undo());

    expect(inTheDraft()).toHaveTextContent("Eggs, Milk, Oil, Added elsewhere");
  });

  describe("at the limit", () => {
    const full = () =>
      Array.from({ length: MAX_RECIPE_INGREDIENTS }, (_, place) =>
        ingredientNamed(`Food ${place}`),
      );

    it("should say there is no room, and change nothing, when Undo comes after the list was filled again", async () => {
      const user = await showHarness(full());
      await user.press(screen.getByText("Remove second"));
      await user.press(screen.getByText("Add elsewhere"));
      expect(count()).toHaveTextContent(String(MAX_RECIPE_INGREDIENTS));

      await user.press(undo());

      expect(count()).toHaveTextContent(String(MAX_RECIPE_INGREDIENTS));
      expect(inTheDraft()).not.toHaveTextContent(/Food 1,/);
      expect(screen.getByText("Up to 100 ingredients")).toBeOnTheScreen();
    });

    it("should still put the ingredient back when there is room", async () => {
      const user = await showHarness(full());
      await user.press(screen.getByText("Remove second"));

      await user.press(undo());

      expect(count()).toHaveTextContent(String(MAX_RECIPE_INGREDIENTS));
      expect(inTheDraft()).toHaveTextContent("Food 0, Food 1, Food 2,", { exact: false });
    });
  });

  it("should leave the draft alone for a place that is not in the list", async () => {
    const user = await showHarness(["Eggs", "Milk"].map((name) => ingredientNamed(name)));

    await user.press(screen.getByText("Remove sixth"));

    expect(inTheDraft()).toHaveTextContent("Eggs, Milk");
    expect(screen.queryByText("Ingredient removed")).not.toBeOnTheScreen();
  });
});
