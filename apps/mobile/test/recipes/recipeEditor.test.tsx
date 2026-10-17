import "react-native-gesture-handler/jestSetup";

import { KeyLowProvider } from "@keylow/api-client";
import { DISCARD_SHEET, RECIPE_EDITOR, SAVE_FAILED_BANNER } from "@keylow/core/copy";
import { buildChickenAndRiceRecipe } from "@keylow/core/testing";
import { onlineManager } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  userEvent,
  within,
} from "@testing-library/react-native";
import { AccessibilityInfo, TextInput } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { RecipeEditor } from "../../components/RecipeEditor";
import { ToastProvider } from "../../components/ui";
import { editRecipePath, recipePath, recipesPath } from "../../lib/recipeRoutes";
import { ThemeProvider } from "../../lib/theme";
import { createDiaryQueryClient, diaryClient, resetDiaryBackend } from "../support/diaryBackend";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { RecipeEditorExisting } from "../../components/RecipeEditor";
import type { RecipeDraft } from "@keylow/core/recipes";
import type { QueryClient } from "@tanstack/react-query";

// The recipe editor with a recipe handed to it, as the recipe view will give it: what it shows, how Save and
// leaving behave. The hooks that talk to the database are stood in for, so each test says what Save answers.

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

// What the navigator is told about holding the screen back, so a test can press the Android back button or
// swipe back as the navigator would.
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

const mockCreateRecipe = jest.fn();
const mockUpdateRecipe = jest.fn();
const mockStartingDraft: { current: RecipeDraft | undefined } = { current: undefined };

jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<object>("@keylow/api-client"),
  useCreateRecipe: () => ({ mutateAsync: mockCreateRecipe }),
  useUpdateRecipe: () => ({ mutateAsync: mockUpdateRecipe }),
}));

// A test that stands in for the ingredients a later ticket adds gives the new recipe some.
jest.mock("@keylow/core/recipes", () => {
  const actual = jest.requireActual<typeof import("@keylow/core/recipes")>("@keylow/core/recipes");
  return {
    ...actual,
    newRecipeDraft: (name?: string) => mockStartingDraft.current ?? actual.newRecipeDraft(name),
  };
});

setUpTests();

const RECIPE_ID = "55555555-5555-4555-8555-555555555555";
const golden = buildChickenAndRiceRecipe({ servings: 4, yieldGrams: 1100 });

const chickenAndRice: RecipeEditorExisting = {
  id: RECIPE_ID,
  name: "Chicken and rice",
  servings: golden.servings,
  yield_grams: golden.yieldGrams,
  instructions: ["Cook the rice.", "Fry the chicken."],
  ingredients: golden.ingredients,
};

type SavePayload = {
  name: string;
  servings: number;
  yieldGrams: number | null;
  steps: string[];
  ingredients: RecipeEditorExisting["ingredients"];
};

// What the database gives back for a save: the recipe as stored.
function storedOf(payload: SavePayload): RecipeEditorExisting {
  return {
    id: RECIPE_ID,
    name: payload.name,
    servings: payload.servings,
    yield_grams: payload.yieldGrams,
    instructions: payload.steps,
    ingredients: payload.ingredients,
  };
}

let queryClient: QueryClient;

async function showEditor(props: { existing?: RecipeEditorExisting; initialName?: string } = {}) {
  queryClient = createDiaryQueryClient();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={diaryClient} queryClient={queryClient}>
        <ToastProvider>
          <RecipeEditor {...props} />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
  return user;
}

const nameField = () => screen.getByLabelText("Name");
const servingsField = () => screen.getByLabelText("Servings");
const cookedWeightField = () => screen.getByLabelText(RECIPE_EDITOR.cookedWeightName);
const saveButton = () => screen.getByRole("button", { name: "Save" });
const card = () => within(screen.getByLabelText("Per serving"));

async function type(field: ReturnType<typeof screen.getByLabelText>, text: string) {
  await fireEvent.changeText(field, text);
}

// The card follows the fields once typing has stopped.
const letTypingStop = () =>
  act(() => {
    jest.advanceTimersByTime(500);
  });

const goOffline = () =>
  act(() => {
    onlineManager.setOnline(false);
  });

describe("the recipe editor", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/RecipeEditor",
      "components/RecipeDetailsFields",
      "components/RecipeIngredientsSection",
      "components/PerServingCard",
      "components/DiscardRecipeSheet",
      "components/FoodDetail",
    ]);
  });

  beforeEach(() => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetDiaryBackend();
    mockCreateRecipe.mockReset();
    mockUpdateRecipe.mockReset();
    mockStartingDraft.current = undefined;
    mockHold.isHeld = false;
    jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => undefined);
    // The mock's calls are kept between tests when the spy is not restored in time, so the count starts at 0.
    jest.mocked(AccessibilityInfo.announceForAccessibility).mockClear();
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
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

  describe("a saved recipe", () => {
    it("should head the screen with Back and the recipe's name, and no other control", async () => {
      await showEditor({ existing: chickenAndRice });

      expect(screen.getByRole("heading", { name: "Chicken and rice" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Back" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /more/i })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Close" })).not.toBeOnTheScreen();
    });

    it("should show the name, servings and cooked weight, with the helper naming the raw total", async () => {
      await showEditor({ existing: chickenAndRice });

      expect(nameField()).toHaveDisplayValue("Chicken and rice");
      expect(servingsField()).toHaveDisplayValue("4");
      expect(cookedWeightField()).toHaveDisplayValue("1100");
      expect(
        screen.getByText(
          "The whole dish once cooked. Leave it blank and per 100 g uses the raw total (720 g).",
        ),
      ).toBeOnTheScreen();
    });

    it("should show the golden in the Per serving card", async () => {
      await showEditor({ existing: chickenAndRice });

      expect(card().getByText("374")).toBeOnTheScreen();
      expect(card().getByText("Per serving (275 g)")).toBeOnTheScreen();
      expect(card().getByLabelText(/^Protein, 32 g/)).toBeOnTheScreen();
      expect(card().getByText("Per 100 g cooked: 136 kcal")).toBeOnTheScreen();
    });

    it("should follow a blank cooked weight with the raw total once typing stops", async () => {
      await showEditor({ existing: chickenAndRice });

      await type(cookedWeightField(), "");
      await letTypingStop();

      expect(card().getByText("374")).toBeOnTheScreen();
      expect(card().getByText("Per serving (180 g)")).toBeOnTheScreen();
      expect(card().getByText("Per 100 g raw: 208 kcal")).toBeOnTheScreen();
    });

    it("should follow 5 servings with 299 kcal and a 220 g serving", async () => {
      await showEditor({ existing: chickenAndRice });

      await type(servingsField(), "5");
      await letTypingStop();

      expect(card().getByText("299")).toBeOnTheScreen();
      expect(card().getByText("Per serving (220 g)")).toBeOnTheScreen();
    });

    it("should leave the card as it was until typing has stopped, and tell a screen reader then", async () => {
      await showEditor({ existing: chickenAndRice });

      await type(servingsField(), "5");
      await act(() => {
        jest.advanceTimersByTime(499);
      });
      expect(card().getByText("374")).toBeOnTheScreen();
      expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalledWith(
        expect.stringContaining("kilocalories per serving"),
      );

      await act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
        expect.stringContaining("299 kilocalories per serving"),
      );
    });

    it("should list the ingredients, counted in the heading, each to open and to remove, and end with Add ingredient", async () => {
      await showEditor({ existing: chickenAndRice });

      expect(screen.getByRole("heading", { name: "Ingredients · 3" })).toBeOnTheScreen();
      const list = within(screen.getByLabelText("Ingredients"));
      expect(list.getByText("Chicken breast")).toBeOnTheScreen();
      expect(list.getByText("500 g")).toBeOnTheScreen();
      expect(list.getByText("Dry rice")).toBeOnTheScreen();
      expect(list.getByText("Olive oil")).toBeOnTheScreen();
      expect(list.getByRole("button", { name: "Remove Chicken breast" })).toBeOnTheScreen();
      expect(
        list.getByRole("button", { name: "Chicken breast, 500 g, change amount" }),
      ).toBeOnTheScreen();
      expect(list.getByRole("button", { name: "Add ingredient" })).toBeEnabled();
    });
  });

  describe("a new recipe", () => {
    it("should head the screen with Close and New recipe", async () => {
      await showEditor();

      expect(screen.getByRole("heading", { name: "New recipe" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Close" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Back" })).not.toBeOnTheScreen();
    });

    it("should start with one serving, no name, no cooked weight and a card of dashes", async () => {
      await showEditor();

      expect(nameField()).toHaveDisplayValue("");
      expect(screen.getByPlaceholderText("e.g. Veggie chilli")).toBeOnTheScreen();
      expect(servingsField()).toHaveDisplayValue("1");
      expect(cookedWeightField()).toHaveDisplayValue("");
      expect(card().getByText("Per serving")).toBeOnTheScreen();
      expect(card().getByLabelText("Protein, no amount")).toBeOnTheScreen();
      expect(card().queryByText(/Per 100 g/)).not.toBeOnTheScreen();
      expect(screen.getByText("Add the foods that go into it.")).toBeOnTheScreen();
      expect(
        screen.getByText(
          "The whole dish once cooked. Leave it blank and per 100 g uses the raw total.",
        ),
      ).toBeOnTheScreen();
    });

    it("should start with the word the library carried over as the name", async () => {
      await showEditor({ initialName: "pasta" });

      expect(nameField()).toHaveDisplayValue("pasta");
    });
  });

  describe("pressing Save with problems", () => {
    async function pressSaveOnAnInvalidRecipe() {
      const user = await showEditor();
      await type(servingsField(), "0");
      await type(cookedWeightField(), "-5");
      await user.press(saveButton());
      return user;
    }

    it("should show the summary and every field's sentence at once, and save nothing", async () => {
      await pressSaveOnAnInvalidRecipe();

      expect(screen.getByText("Check the fields marked below and try again.")).toBeOnTheScreen();
      expect(screen.getByText("Name is required")).toBeOnTheScreen();
      expect(screen.getByText("Enter servings above 0.")).toBeOnTheScreen();
      expect(
        screen.getByText("Enter a cooked weight above 0, or leave it blank."),
      ).toBeOnTheScreen();
      expect(screen.getByText("Add at least one ingredient.")).toBeOnTheScreen();
      expect(mockCreateRecipe).not.toHaveBeenCalled();
    });

    it("should show nothing before Save is pressed", async () => {
      await showEditor();
      await type(servingsField(), "0");

      expect(screen.queryByText("Enter servings above 0.")).not.toBeOnTheScreen();
    });

    it("should clear each sentence as its field is fixed, and the summary with the last", async () => {
      await pressSaveOnAnInvalidRecipe();

      await type(nameField(), "Veggie chilli");
      expect(screen.queryByText("Name is required")).not.toBeOnTheScreen();

      await type(servingsField(), "4");
      expect(screen.queryByText("Enter servings above 0.")).not.toBeOnTheScreen();

      await type(cookedWeightField(), "");
      expect(
        screen.queryByText("Enter a cooked weight above 0, or leave it blank."),
      ).not.toBeOnTheScreen();

      expect(screen.getByText("Add at least one ingredient.")).toBeOnTheScreen();
      expect(screen.getByText("Check the fields marked below and try again.")).toBeOnTheScreen();
    });

    it("should move focus to the first field that is wrong", async () => {
      const user = await showEditor();
      await type(servingsField(), "0");
      const focus = jest.spyOn(TextInput.prototype, "focus");
      focus.mockClear();

      await user.press(saveButton());

      expect(focus).toHaveBeenCalledTimes(1);
    });

    it("should take a screen reader to the Ingredients heading when that is the first thing wrong", async () => {
      const sendEvent = jest
        .spyOn(AccessibilityInfo, "sendAccessibilityEvent")
        .mockImplementation(() => undefined);
      const user = await showEditor();
      await type(nameField(), "Veggie chilli");
      sendEvent.mockClear();

      await user.press(saveButton());

      expect(screen.getByText("Add at least one ingredient.")).toBeOnTheScreen();
      expect(sendEvent).toHaveBeenCalledTimes(1);
      expect(sendEvent).toHaveBeenCalledWith(expect.anything(), "focus");
    });

    it("should say the servings are too many, in the same place", async () => {
      const user = await showEditor({ existing: chickenAndRice });
      await type(servingsField(), "1001");
      await user.press(saveButton());

      expect(screen.getByText("Enter 1,000 servings or fewer.")).toBeOnTheScreen();
    });
  });

  describe("saving a saved recipe", () => {
    it("should save once through the update hook and go back to the recipe with the toast", async () => {
      mockUpdateRecipe.mockImplementation((payload: SavePayload) =>
        Promise.resolve(storedOf(payload)),
      );
      const user = await showEditor({ existing: chickenAndRice });

      await type(nameField(), "Chicken and rice, again");
      await user.press(saveButton());

      expect(mockUpdateRecipe).toHaveBeenCalledTimes(1);
      expect(mockUpdateRecipe).toHaveBeenCalledWith(
        expect.objectContaining({
          id: RECIPE_ID,
          name: "Chicken and rice, again",
          servings: 4,
          yieldGrams: 1100,
          steps: ["Cook the rice.", "Fry the chicken."],
        }),
      );
      expect(routerMock.dismissTo).toHaveBeenCalledWith(recipePath(RECIPE_ID));
      expect(screen.getByText("Recipe saved")).toBeOnTheScreen();
    });

    it("should stay open on the saved recipe as the new starting point, so leaving asks nothing", async () => {
      mockUpdateRecipe.mockImplementation((payload: SavePayload) =>
        Promise.resolve(storedOf(payload)),
      );
      const user = await showEditor({ existing: chickenAndRice });
      await type(nameField(), "Chicken and rice, again");

      await user.press(saveButton());

      // The header follows the saved name, and nothing is left to lose.
      expect(screen.getByRole("heading", { name: "Chicken and rice, again" })).toBeOnTheScreen();
      expect(mockHold.isHeld).toBe(false);
      routerMock.dismissTo.mockReset();

      await user.press(screen.getByRole("button", { name: "Back" }));

      expect(routerMock.dismissTo).toHaveBeenCalledWith(recipePath(RECIPE_ID));
      expect(screen.queryByText(DISCARD_SHEET.editTitle)).not.toBeOnTheScreen();
    });

    it("should forget that Save was tried once it has saved, so the next edit is not marked at once", async () => {
      mockUpdateRecipe.mockImplementation((payload: SavePayload) =>
        Promise.resolve(storedOf(payload)),
      );
      const user = await showEditor({ existing: chickenAndRice });
      await type(nameField(), "");
      await user.press(saveButton());
      expect(screen.getByText("Name is required")).toBeOnTheScreen();
      await type(nameField(), "Chicken and rice, again");
      await user.press(saveButton());
      expect(mockUpdateRecipe).toHaveBeenCalledTimes(1);

      await type(nameField(), "");

      expect(screen.queryByText("Name is required")).not.toBeOnTheScreen();
      expect(
        screen.queryByText("Check the fields marked below and try again."),
      ).not.toBeOnTheScreen();
    });

    it("should open no discard sheet for the back button while the save is under way", async () => {
      mockUpdateRecipe.mockImplementation(() => new Promise<never>(() => undefined));
      const user = await showEditor({ existing: chickenAndRice });
      await type(nameField(), "Chicken and rice, again");
      await user.press(saveButton());
      expect(mockHold.isHeld).toBe(true);

      await act(() => {
        mockHold.onHeld({ data: { action: { type: "GO_BACK" } } });
      });

      expect(screen.queryByText(DISCARD_SHEET.editTitle)).not.toBeOnTheScreen();
      expect(routerMock.dismissTo).not.toHaveBeenCalled();
    });

    it("should make one request for a double press", async () => {
      let finish: (recipe: RecipeEditorExisting) => void = () => undefined;
      mockUpdateRecipe.mockImplementation(
        () =>
          new Promise<RecipeEditorExisting>((resolve) => {
            finish = resolve;
          }),
      );
      await showEditor({ existing: chickenAndRice });
      await type(nameField(), "Chicken and rice, again");

      // The button is found once: while it works its label is hidden, so it has no name to find it by.
      const save = saveButton();
      await fireEvent.press(save);
      await fireEvent.press(save);

      expect(mockUpdateRecipe).toHaveBeenCalledTimes(1);
      await act(() => {
        finish(chickenAndRice);
      });
    });

    it("should draw Save as working and take no typing while it is under way", async () => {
      mockUpdateRecipe.mockImplementation(() => new Promise<never>(() => undefined));
      const user = await showEditor({ existing: chickenAndRice });
      await type(nameField(), "Chicken and rice, again");

      await user.press(saveButton());

      expect(nameField()).toBeDisabled();
      expect(servingsField()).toBeDisabled();
      expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    });

    it("should keep everything typed and show the failure when the save fails", async () => {
      mockUpdateRecipe.mockRejectedValue(new Error("raw database text"));
      const user = await showEditor({ existing: chickenAndRice });
      await type(nameField(), "Chicken and rice, again");

      await user.press(saveButton());

      expect(screen.getByText(SAVE_FAILED_BANNER)).toBeOnTheScreen();
      expect(screen.queryByText(/raw database text/)).not.toBeOnTheScreen();
      expect(nameField()).toHaveDisplayValue("Chicken and rice, again");
      expect(nameField()).not.toBeDisabled();
      expect(routerMock.dismissTo).not.toHaveBeenCalled();
    });

    it("should save again after a failure", async () => {
      mockUpdateRecipe.mockRejectedValueOnce(new Error("down"));
      mockUpdateRecipe.mockImplementation((payload: SavePayload) =>
        Promise.resolve(storedOf(payload)),
      );
      const user = await showEditor({ existing: chickenAndRice });
      await type(nameField(), "Chicken and rice, again");

      await user.press(saveButton());
      await user.press(saveButton());

      expect(mockUpdateRecipe).toHaveBeenCalledTimes(2);
      expect(screen.queryByText(SAVE_FAILED_BANNER)).not.toBeOnTheScreen();
    });
  });

  describe("saving a new recipe", () => {
    it("should create it once and replace the editor with the saved recipe, with the toast", async () => {
      mockStartingDraft.current = {
        name: "",
        servings: "1",
        cookedWeight: "",
        ingredients: golden.ingredients,
        steps: [],
      };
      mockCreateRecipe.mockImplementation((payload: SavePayload) =>
        Promise.resolve(storedOf(payload)),
      );
      const user = await showEditor();

      await type(nameField(), "Chicken and rice");
      await user.press(saveButton());

      expect(mockCreateRecipe).toHaveBeenCalledTimes(1);
      expect(routerMock.replace).toHaveBeenCalledWith(recipePath(RECIPE_ID));
      expect(screen.getByText("Recipe saved")).toBeOnTheScreen();
    });
  });

  describe("leaving", () => {
    it("should go back to the recipe without asking when nothing has changed", async () => {
      const user = await showEditor({ existing: chickenAndRice });

      await user.press(screen.getByRole("button", { name: "Back" }));

      expect(routerMock.dismissTo).toHaveBeenCalledWith(recipePath(RECIPE_ID));
      expect(screen.queryByText(DISCARD_SHEET.editTitle)).not.toBeOnTheScreen();
    });

    it("should close a new recipe that is untouched to the library without asking", async () => {
      const user = await showEditor();

      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(routerMock.dismissTo).toHaveBeenCalledWith(recipesPath());
    });

    it("should hold the screen back only when there are changes", async () => {
      await showEditor({ existing: chickenAndRice });
      expect(mockHold.isHeld).toBe(false);

      await type(servingsField(), "5");

      expect(mockHold.isHeld).toBe(true);
    });

    it("should ask first when Back is pressed with a change, and stay put", async () => {
      const user = await showEditor({ existing: chickenAndRice });
      await type(servingsField(), "5");

      await user.press(screen.getByRole("button", { name: "Back" }));

      expect(screen.getByRole("heading", { name: DISCARD_SHEET.editTitle })).toBeOnTheScreen();
      expect(screen.getByText(DISCARD_SHEET.editBody)).toBeOnTheScreen();
      expect(routerMock.dismissTo).not.toHaveBeenCalled();
    });

    it("should ask the same way for the back button and the swipe back", async () => {
      await showEditor({ existing: chickenAndRice });
      await type(servingsField(), "5");

      await act(() => {
        mockHold.onHeld({ data: { action: { type: "GO_BACK" } } });
      });

      expect(screen.getByRole("heading", { name: DISCARD_SHEET.editTitle })).toBeOnTheScreen();
    });

    it("should ask 'Discard this recipe?' for a new recipe that has been typed into", async () => {
      const user = await showEditor();
      await type(nameField(), "Pasta");

      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(screen.getByRole("heading", { name: DISCARD_SHEET.newTitle })).toBeOnTheScreen();
      expect(screen.getByText(DISCARD_SHEET.newBody)).toBeOnTheScreen();
    });

    it("should keep the changes when Keep editing is pressed", async () => {
      const user = await showEditor({ existing: chickenAndRice });
      await type(servingsField(), "5");
      await user.press(screen.getByRole("button", { name: "Back" }));

      await user.press(screen.getByRole("button", { name: DISCARD_SHEET.keepEditing }));
      await act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(servingsField()).toHaveDisplayValue("5");
      expect(routerMock.dismissTo).not.toHaveBeenCalled();
    });

    it("should put the saved values back before it goes when Discard changes is pressed", async () => {
      const user = await showEditor({ existing: chickenAndRice });
      await type(servingsField(), "5");
      await type(nameField(), "Something else");
      await user.press(screen.getByRole("button", { name: "Back" }));

      await user.press(screen.getByRole("button", { name: DISCARD_SHEET.discard }));

      // Going to the page the editor is already on does not remount it, so what was typed must be gone.
      expect(servingsField()).toHaveDisplayValue("4");
      expect(nameField()).toHaveDisplayValue("Chicken and rice");
      expect(routerMock.dismissTo).toHaveBeenCalledWith(recipePath(RECIPE_ID));
      expect(mockHold.isHeld).toBe(false);
    });

    it("should clear a failed save when the changes are discarded", async () => {
      mockUpdateRecipe.mockRejectedValue(new Error("down"));
      const user = await showEditor({ existing: chickenAndRice });
      await type(nameField(), "Chicken and rice, again");
      await user.press(saveButton());
      expect(screen.getByText(SAVE_FAILED_BANNER)).toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: "Back" }));

      await user.press(screen.getByRole("button", { name: DISCARD_SHEET.discard }));

      expect(screen.queryByText(SAVE_FAILED_BANNER)).not.toBeOnTheScreen();
      expect(nameField()).toHaveDisplayValue("Chicken and rice");
    });

    it("should clear the problems shown when the changes are discarded", async () => {
      const user = await showEditor({ existing: chickenAndRice });
      await type(servingsField(), "0");
      await user.press(saveButton());
      expect(screen.getByText("Enter servings above 0.")).toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: "Back" }));

      await user.press(screen.getByRole("button", { name: DISCARD_SHEET.discard }));

      expect(screen.queryByText("Enter servings above 0.")).not.toBeOnTheScreen();
      expect(
        screen.queryByText("Check the fields marked below and try again."),
      ).not.toBeOnTheScreen();
      expect(servingsField()).toHaveDisplayValue("4");

      // Save counts as untried again, so a new mistake is not marked before Save is pressed.
      await type(servingsField(), "0");
      expect(screen.queryByText("Enter servings above 0.")).not.toBeOnTheScreen();
    });

    it("should not ask again on the next Back once the changes were discarded", async () => {
      const user = await showEditor({ existing: chickenAndRice });
      await type(servingsField(), "5");
      await user.press(screen.getByRole("button", { name: "Back" }));
      await user.press(screen.getByRole("button", { name: DISCARD_SHEET.discard }));
      routerMock.dismissTo.mockReset();

      await user.press(screen.getByRole("button", { name: "Back" }));

      expect(routerMock.dismissTo).toHaveBeenCalledWith(recipePath(RECIPE_ID));
    });

    it("should lead Back and Save to the recipe view, which is not the editor", () => {
      expect(recipePath(RECIPE_ID)).toBe(`/recipes/${RECIPE_ID}`);
      expect(recipePath(RECIPE_ID)).not.toBe(editRecipePath(RECIPE_ID));
    });
  });

  describe("while offline", () => {
    it("should say so and keep the fields editable, with Save dimmed and doing nothing", async () => {
      mockUpdateRecipe.mockImplementation((payload: SavePayload) =>
        Promise.resolve(storedOf(payload)),
      );
      await showEditor({ existing: chickenAndRice });

      await goOffline();

      expect(screen.getByText("You're offline")).toBeOnTheScreen();
      expect(screen.getByText(RECIPE_EDITOR.offlineEditingBody)).toBeOnTheScreen();
      expect(saveButton()).toBeDisabled();
      expect(nameField()).not.toBeDisabled();
      expect(servingsField()).not.toBeDisabled();

      await fireEvent.press(saveButton());
      expect(mockUpdateRecipe).not.toHaveBeenCalled();
    });

    it("should still ask before leaving with changes", async () => {
      const user = await showEditor({ existing: chickenAndRice });
      await type(servingsField(), "5");
      await goOffline();

      await user.press(screen.getByRole("button", { name: "Back" }));

      expect(screen.getByRole("heading", { name: DISCARD_SHEET.editTitle })).toBeOnTheScreen();
    });
  });
});
