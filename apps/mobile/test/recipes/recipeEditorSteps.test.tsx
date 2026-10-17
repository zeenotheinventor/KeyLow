import "react-native-gesture-handler/jestSetup";

import { KeyLowProvider } from "@keylow/api-client";
import { MAX_RECIPE_STEPS } from "@keylow/core/recipes";
import { themes } from "@keylow/tokens";
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
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { chickenAndRiceRecipe } from "./recipeViewFixtures";
import { RecipeEditor } from "../../components/RecipeEditor";
import { ToastProvider } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { createDiaryQueryClient, diaryClient, resetDiaryBackend } from "../support/diaryBackend";
import { resetRouterMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { viewsDrawn } from "../support/viewsDrawn";

import type { RecipeEditorExisting } from "../../components/RecipeEditor";
import type { QueryClient } from "@tanstack/react-query";

// The Instructions section of the recipe editor: the steps and their rows, the sheet that edits or adds one,
// Reorder with its move buttons, and a removal with an Undo. The steps are the editor's draft until Save.
// Chicken and rice is the brief's recipe, and its step 3 is the 201 character one the boards draw.

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
  [{ steps: RecipeEditorExisting["instructions"] }]
>();

jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<object>("@keylow/api-client"),
  useCreateRecipe: () => ({ mutateAsync: jest.fn() }),
  useUpdateRecipe: () => ({ mutateAsync: mockUpdateRecipe }),
}));

setUpTests();

const RECIPE_ID = "55555555-5555-4555-8555-555555555555";

const steps = [
  "Rinse the rice, then cook it in salted water for 12 minutes and drain.",
  "Cut the chicken into 2 cm pieces.",
  "Heat the oil in a large pan and fry the chicken over a medium-high heat for 6 to 8 minutes, turning it now and then, until it is golden on every side and cooked through with no pink left in the middle.",
  "Stir in the rice and heat it through for 2 minutes.",
  "Divide between 4 plates.",
];

const chickenAndRice: RecipeEditorExisting = {
  id: RECIPE_ID,
  name: "Chicken and rice",
  servings: 4,
  yield_grams: 1100,
  instructions: steps,
  ingredients: chickenAndRiceRecipe.ingredients,
};

let queryClient: QueryClient;

async function showEditor(instructions: string[] = steps) {
  queryClient = createDiaryQueryClient();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={diaryClient} queryClient={queryClient}>
        <ToastProvider>
          <RecipeEditor existing={{ ...chickenAndRice, instructions }} />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
  return user;
}

const rowOf = (position: number, text = steps[position - 1]) =>
  screen.getByRole("button", { name: `Step ${position}, ${text}, edit` });
const fieldOf = (position: number) => screen.getByLabelText(`Step ${position} text`);
const addRow = () => screen.getByRole("button", { name: "Add step" });
const headingOf = (name: string) => screen.getByRole("heading", { name });
// The sheet is a dialog named by its title, which a role query does not find on a view that is not accessible.
const sheet = (name: string) => screen.getByLabelText(name);
const noSheet = () => screen.queryByLabelText(/^Step \d+$/);
const letSheetClose = () =>
  act(() => {
    jest.advanceTimersByTime(300);
  });
const instructionsList = () => within(screen.getByLabelText("Instructions"));
// Every step of the brief starts with a different word, so the texts come back in the order they are drawn.
const expectOrder = (expected: (string | undefined)[]) => {
  const drawn = instructionsList().getAllByText(/^(Rinse|Cut|Heat|Stir|Divide)/);
  expect(drawn).toHaveLength(expected.length);
  drawn.forEach((node, index) => {
    expect(node).toHaveTextContent(expected[index] ?? "");
  });
};
// A ref reaches the host component itself, so its name is read off its props.
function accessibleNameOf(node: unknown): unknown {
  if (typeof node !== "object" || node === null || !("props" in node)) {
    return undefined;
  }
  const { props } = node;
  return typeof props === "object" && props !== null && "accessibilityLabel" in props
    ? props.accessibilityLabel
    : undefined;
}
const move = (position: number, direction: "up" | "down") =>
  screen.getByRole("button", { name: `Move step ${position} ${direction}` });

describe("the recipe editor's instructions", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/RecipeEditor",
      "components/RecipeDetailsFields",
      "components/RecipeIngredientsSection",
      "components/RecipeStepsSection",
      "components/StepRow",
      "components/StepSheet",
      "components/PerServingCard",
      "components/DiscardRecipeSheet",
    ]);
  });

  beforeEach(() => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetDiaryBackend();
    mockUpdateRecipe.mockReset();
    mockHold.isHeld = false;
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
    it("should list the five steps, counted in the heading, each a button that opens it", async () => {
      await showEditor();

      expect(headingOf("Instructions · 5")).toBeOnTheScreen();
      steps.forEach((_, index) => {
        expect(rowOf(index + 1)).toBeOnTheScreen();
      });
    });

    it("should write step 3 whole, never clamped", async () => {
      await showEditor();

      expect(instructionsList().getByText(steps[2] ?? "")).not.toHaveProp("numberOfLines");
    });

    it("should offer Reorder and an Add step row", async () => {
      await showEditor();

      expect(screen.getByRole("button", { name: "Reorder" })).toBeOnTheScreen();
      expect(addRow()).toBeOnTheScreen();
    });

    it("should offer no Reorder with a single step", async () => {
      await showEditor(["Boil the rice."]);

      expect(headingOf("Instructions · 1")).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Reorder" })).not.toBeOnTheScreen();
    });

    it("should say there are no steps yet, with no count and no Reorder, and offer Add step", async () => {
      await showEditor([]);

      expect(headingOf("Instructions")).toBeOnTheScreen();
      expect(
        screen.getByText("No steps yet. Add the method one step at a time."),
      ).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Reorder" })).not.toBeOnTheScreen();
      expect(addRow()).toBeOnTheScreen();
    });
  });

  describe("editing a step", () => {
    it("should open the step's sheet with its text and the count of its characters", async () => {
      const user = await showEditor();

      await user.press(rowOf(3));

      expect(sheet("Step 3")).toBeOnTheScreen();
      expect(fieldOf(3)).toHaveDisplayValue(steps[2] ?? "");
      expect(screen.getByText("201 / 1,000")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Done" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Remove step" })).toBeOnTheScreen();
    });

    it("should change the row, and close the sheet, on Done", async () => {
      const user = await showEditor();
      await user.press(rowOf(2));

      await fireEvent.changeText(fieldOf(2), "Dice the chicken.");
      await user.press(screen.getByRole("button", { name: "Done" }));
      await letSheetClose();

      expect(rowOf(2, "Dice the chicken.")).toBeOnTheScreen();
      expect(noSheet()).not.toBeOnTheScreen();
      expect(headingOf("Instructions · 5")).toBeOnTheScreen();
    });

    it("should send the changed step when the recipe is saved", async () => {
      mockUpdateRecipe.mockResolvedValue({ ...chickenAndRice });
      const user = await showEditor();
      await user.press(rowOf(2));
      await fireEvent.changeText(fieldOf(2), "Dice the chicken.");
      await user.press(screen.getByRole("button", { name: "Done" }));
      await letSheetClose();

      await user.press(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(mockUpdateRecipe).toHaveBeenCalledTimes(1);
      });
      expect(mockUpdateRecipe.mock.calls[0]?.[0].steps).toEqual([
        steps[0],
        "Dice the chicken.",
        steps[2],
        steps[3],
        steps[4],
      ]);
    });

    it("should keep the edit as typed when the sheet is dismissed", async () => {
      const user = await showEditor();
      await user.press(rowOf(2));
      await fireEvent.changeText(fieldOf(2), "Dice the chicken.");

      await fireEvent(sheet("Step 2"), "accessibilityEscape");
      await letSheetClose();

      expect(rowOf(2, "Dice the chicken.")).toBeOnTheScreen();
    });

    it("should keep the edit as typed when the way back is used with the sheet open, and not leave", async () => {
      const user = await showEditor();
      await user.press(rowOf(2));
      await fireEvent.changeText(fieldOf(2), "Dice the chicken.");
      expect(mockHold.isHeld).toBe(true);

      await act(() => {
        mockHold.onHeld({ data: { action: { type: "GO_BACK" } } });
      });
      await letSheetClose();

      expect(rowOf(2, "Dice the chicken.")).toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: "Discard changes?" })).not.toBeOnTheScreen();
    });

    it("should leave the step as it was when Done is pressed over a blank, since a blank step is never stored", async () => {
      const user = await showEditor();
      await user.press(rowOf(2));

      await fireEvent.changeText(fieldOf(2), "   ");
      await user.press(screen.getByRole("button", { name: "Done" }));
      await letSheetClose();

      expect(rowOf(2)).toBeOnTheScreen();
      expect(headingOf("Instructions · 5")).toBeOnTheScreen();
    });

    it("should close, and leave the step as it was, when it is dismissed over a blank", async () => {
      const user = await showEditor();
      await user.press(rowOf(2));

      await fireEvent.changeText(fieldOf(2), "   ");
      await fireEvent(sheet("Step 2"), "accessibilityEscape");
      await letSheetClose();

      expect(rowOf(2)).toBeOnTheScreen();
      expect(noSheet()).not.toBeOnTheScreen();
    });

    describe("over 1,000 characters", () => {
      const tooLong = "x".repeat(1001);

      it("should turn the counter and the field to danger, say what to do, and turn Done off", async () => {
        const user = await showEditor();
        await user.press(rowOf(2));

        await fireEvent.changeText(fieldOf(2), tooLong);

        expect(screen.getByText("1,001 / 1,000")).toBeOnTheScreen();
        expect(
          screen.getByRole("alert", { name: "Keep a step to 1,000 characters or fewer." }),
        ).toBeOnTheScreen();
        expect(screen.getByRole("button", { name: "Done" })).toBeDisabled();
      });

      it("should turn Done on again once the step fits", async () => {
        const user = await showEditor();
        await user.press(rowOf(2));
        await fireEvent.changeText(fieldOf(2), tooLong);

        await fireEvent.changeText(fieldOf(2), "x".repeat(1000));

        expect(screen.getByText("1,000 / 1,000")).toBeOnTheScreen();
        expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
        expect(screen.getByRole("button", { name: "Done" })).toBeEnabled();
      });

      it("should stay open when it is dismissed, with the text and the sentence still there, so a long paste is never dropped", async () => {
        const user = await showEditor();
        await user.press(rowOf(2));
        await fireEvent.changeText(fieldOf(2), tooLong);

        await fireEvent(sheet("Step 2"), "accessibilityEscape");
        await letSheetClose();

        expect(sheet("Step 2")).toBeOnTheScreen();
        expect(fieldOf(2)).toHaveDisplayValue(tooLong);
        expect(
          screen.getByRole("alert", { name: "Keep a step to 1,000 characters or fewer." }),
        ).toBeOnTheScreen();
      });

      it("should not let the way back leave the editor or reach Save with the step", async () => {
        const user = await showEditor();
        await user.press(rowOf(2));
        await fireEvent.changeText(fieldOf(2), tooLong);

        await act(() => {
          mockHold.onHeld({ data: { action: { type: "GO_BACK" } } });
        });
        await letSheetClose();

        expect(sheet("Step 2")).toBeOnTheScreen();
        expect(screen.queryByRole("heading", { name: "Discard changes?" })).not.toBeOnTheScreen();
      });

      it("should close with a fix, once the step fits", async () => {
        const user = await showEditor();
        await user.press(rowOf(2));
        await fireEvent.changeText(fieldOf(2), tooLong);
        await fireEvent.changeText(fieldOf(2), "Dice the chicken.");

        await fireEvent(sheet("Step 2"), "accessibilityEscape");
        await letSheetClose();

        expect(rowOf(2, "Dice the chicken.")).toBeOnTheScreen();
      });
    });
  });

  describe("adding a step", () => {
    it("should open the same sheet empty, as the next step, with Add step and no Remove step", async () => {
      const user = await showEditor();

      await user.press(addRow());

      expect(sheet("Step 6")).toBeOnTheScreen();
      expect(fieldOf(6)).toHaveDisplayValue("");
      expect(screen.getByPlaceholderText("Describe this step")).toBeOnTheScreen();
      expect(screen.getByText("0 / 1,000")).toBeOnTheScreen();
      expect(within(sheet("Step 6")).getByRole("button", { name: "Add step" })).toBeEnabled();
      expect(screen.queryByRole("button", { name: "Remove step" })).not.toBeOnTheScreen();
    });

    it("should add the step at the end, trimmed", async () => {
      const user = await showEditor();
      await user.press(addRow());

      await fireEvent.changeText(fieldOf(6), "  Serve with lime.  ");
      await user.press(within(sheet("Step 6")).getByRole("button", { name: "Add step" }));
      await letSheetClose();

      expect(headingOf("Instructions · 6")).toBeOnTheScreen();
      expect(rowOf(6, "Serve with lime.")).toBeOnTheScreen();
    });

    it("should keep reading Step 6 as the sheet leaves, though the method now has six steps", async () => {
      const user = await showEditor();
      await user.press(addRow());
      await fireEvent.changeText(fieldOf(6), "Serve with lime.");

      await user.press(within(sheet("Step 6")).getByRole("button", { name: "Add step" }));

      // The sheet is still leaving, and the method already has the new step.
      expect(headingOf("Instructions · 6")).toBeOnTheScreen();
      expect(sheet("Step 6")).toBeOnTheScreen();
      expect(screen.queryByLabelText("Step 7")).not.toBeOnTheScreen();
    });

    it("should add nothing for an empty step, and close", async () => {
      const user = await showEditor();
      await user.press(addRow());

      await user.press(within(sheet("Step 6")).getByRole("button", { name: "Add step" }));
      await letSheetClose();

      expect(headingOf("Instructions · 5")).toBeOnTheScreen();
      expect(noSheet()).not.toBeOnTheScreen();
    });

    it("should add nothing for a step of spaces", async () => {
      const user = await showEditor();
      await user.press(addRow());

      await fireEvent.changeText(fieldOf(6), "   ");
      await user.press(within(sheet("Step 6")).getByRole("button", { name: "Add step" }));
      await letSheetClose();

      expect(headingOf("Instructions · 5")).toBeOnTheScreen();
    });

    it("should add the first step to a recipe that has none, and then offer no Reorder until there are two", async () => {
      const user = await showEditor([]);
      await user.press(addRow());

      await fireEvent.changeText(fieldOf(1), "Boil the rice.");
      await user.press(within(sheet("Step 1")).getByRole("button", { name: "Add step" }));
      await letSheetClose();

      expect(headingOf("Instructions · 1")).toBeOnTheScreen();
      expect(
        screen.queryByText("No steps yet. Add the method one step at a time."),
      ).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Reorder" })).not.toBeOnTheScreen();
    });

    it("should turn Add step off at 50 steps, and say why", async () => {
      const full = Array.from({ length: MAX_RECIPE_STEPS }, (_, place) => `Step text ${place + 1}`);
      const user = await showEditor(full);

      expect(headingOf("Instructions · 50")).toBeOnTheScreen();
      expect(addRow()).toBeDisabled();
      expect(screen.getByText("Up to 50 steps")).toBeOnTheScreen();
      await user.press(addRow());
      expect(noSheet()).not.toBeOnTheScreen();
    });
  });

  describe("removing a step", () => {
    it("should remove it at once, close the sheet and say so with an Undo", async () => {
      const user = await showEditor();
      await user.press(rowOf(5));

      await user.press(screen.getByRole("button", { name: "Remove step" }));
      await letSheetClose();

      expect(headingOf("Instructions · 4")).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /^Step 5,/ })).not.toBeOnTheScreen();
      expect(screen.getByText("Step removed")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Undo" })).toBeOnTheScreen();
    });

    it("should put the same step back where it was on Undo", async () => {
      const user = await showEditor();
      await user.press(rowOf(2));
      await user.press(screen.getByRole("button", { name: "Remove step" }));
      await letSheetClose();

      await user.press(screen.getByRole("button", { name: "Undo" }));

      expect(headingOf("Instructions · 5")).toBeOnTheScreen();
      expect(rowOf(2)).toBeOnTheScreen();
      expect(rowOf(3)).toBeOnTheScreen();
    });

    it("should take the toast and its Undo down when another step opens, so neither changes the list behind the sheet", async () => {
      const user = await showEditor();
      await user.press(rowOf(5));
      await user.press(screen.getByRole("button", { name: "Remove step" }));
      await letSheetClose();
      expect(screen.getByText("Step removed")).toBeOnTheScreen();

      await user.press(rowOf(2));

      expect(screen.queryByText("Step removed")).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Undo" })).not.toBeOnTheScreen();
      expect(sheet("Step 2")).toBeOnTheScreen();
      expect(fieldOf(2)).toHaveDisplayValue(steps[1] ?? "");
    });

    it("should leave the empty state when the only step is removed", async () => {
      const user = await showEditor(["Boil the rice."]);
      await user.press(rowOf(1, "Boil the rice."));

      await user.press(screen.getByRole("button", { name: "Remove step" }));
      await letSheetClose();

      expect(headingOf("Instructions")).toBeOnTheScreen();
      expect(
        screen.getByText("No steps yet. Add the method one step at a time."),
      ).toBeOnTheScreen();
    });
  });

  describe("Reorder", () => {
    it("should read Done, take the chevron and the opening off every row and show the two moves", async () => {
      const user = await showEditor();

      await user.press(screen.getByRole("button", { name: "Reorder" }));

      expect(screen.getByRole("button", { name: "Done" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /, edit$/ })).not.toBeOnTheScreen();
      steps.forEach((_, index) => {
        expect(move(index + 1, "up")).toBeOnTheScreen();
        expect(move(index + 1, "down")).toBeOnTheScreen();
      });
    });

    it("should turn Move up off on the first step and Move down off on the last", async () => {
      const user = await showEditor();

      await user.press(screen.getByRole("button", { name: "Reorder" }));

      expect(move(1, "up")).toBeDisabled();
      expect(move(1, "down")).toBeEnabled();
      expect(move(5, "up")).toBeEnabled();
      expect(move(5, "down")).toBeDisabled();
    });

    it("should take a toast and its Undo down when Reorder starts, so the Undo cannot change the list being put in order", async () => {
      const user = await showEditor();
      await user.press(rowOf(5));
      await user.press(screen.getByRole("button", { name: "Remove step" }));
      await letSheetClose();
      expect(screen.getByText("Step removed")).toBeOnTheScreen();

      await user.press(screen.getByRole("button", { name: "Reorder" }));

      expect(screen.queryByText("Step removed")).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Undo" })).not.toBeOnTheScreen();
    });

    it("should hide Add step until Done", async () => {
      const user = await showEditor();

      await user.press(screen.getByRole("button", { name: "Reorder" }));
      expect(screen.queryByRole("button", { name: "Add step" })).not.toBeOnTheScreen();

      await user.press(screen.getByRole("button", { name: "Done" }));
      expect(addRow()).toBeOnTheScreen();
      expect(rowOf(1)).toBeOnTheScreen();
    });

    it("should move the step up and announce where it went", async () => {
      const user = await showEditor();
      await user.press(screen.getByRole("button", { name: "Reorder" }));

      await user.press(move(2, "up"));

      expectOrder([steps[1], steps[0], steps[2], steps[3], steps[4]]);
      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
        "Step moved to 1 of 5",
      );
    });

    it("should move the step down and announce where it went", async () => {
      const user = await showEditor();
      await user.press(screen.getByRole("button", { name: "Reorder" }));

      await user.press(move(1, "down"));

      expectOrder([steps[1], steps[0], steps[2], steps[3], steps[4]]);
      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
        "Step moved to 2 of 5",
      );
    });

    it("should keep a screen reader's focus on the move button of the step that moved", async () => {
      const user = await showEditor();
      await user.press(screen.getByRole("button", { name: "Reorder" }));

      await user.press(move(2, "up"));

      // Step 1 now, whose Move up is off, so the focus goes to the button that can still be pressed.
      const focused = jest.mocked(AccessibilityInfo.sendAccessibilityEvent).mock.lastCall;
      expect(accessibleNameOf(focused?.[0])).toBe("Move step 1 down");
      expect(focused?.[1]).toBe("focus");
    });

    it("should tint the step that moved for a moment, and no other", async () => {
      const user = await showEditor();
      await user.press(screen.getByRole("button", { name: "Reorder" }));

      await user.press(move(3, "up"));
      expect(viewsDrawn({ backgroundColor: themes.dark["accent-muted"] })).toHaveLength(1);

      await act(() => {
        jest.advanceTimersByTime(1500);
      });
      expect(viewsDrawn({ backgroundColor: themes.dark["accent-muted"] })).toHaveLength(0);
    });

    it("should send the new order when the recipe is saved", async () => {
      mockUpdateRecipe.mockResolvedValue({ ...chickenAndRice });
      const user = await showEditor();
      await user.press(screen.getByRole("button", { name: "Reorder" }));
      await user.press(move(2, "up"));
      await user.press(screen.getByRole("button", { name: "Done" }));

      await user.press(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(mockUpdateRecipe).toHaveBeenCalledTimes(1);
      });
      expect(mockUpdateRecipe.mock.calls[0]?.[0].steps).toEqual([
        steps[1],
        steps[0],
        steps[2],
        steps[3],
        steps[4],
      ]);
    });
  });

  describe("offline", () => {
    it("should still add, edit, move and remove, and leave only Save dimmed", async () => {
      const user = await showEditor();
      await act(() => {
        onlineManager.setOnline(false);
      });

      await user.press(addRow());
      await fireEvent.changeText(fieldOf(6), "Serve with lime.");
      await user.press(within(sheet("Step 6")).getByRole("button", { name: "Add step" }));
      await letSheetClose();
      await user.press(screen.getByRole("button", { name: "Reorder" }));
      await user.press(move(6, "up"));
      await user.press(screen.getByRole("button", { name: "Done" }));
      await user.press(rowOf(5, "Serve with lime."));
      await user.press(screen.getByRole("button", { name: "Remove step" }));
      await letSheetClose();

      expect(headingOf("Instructions · 5")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    });
  });

  describe("while the recipe is saving", () => {
    it("should not open a step, add one or start Reorder", async () => {
      let finishSave: (recipe: RecipeEditorExisting) => void = () => undefined;
      mockUpdateRecipe.mockReturnValue(
        new Promise<RecipeEditorExisting>((resolve) => {
          finishSave = resolve;
        }),
      );
      const user = await showEditor();
      await user.press(screen.getByRole("button", { name: "Save" }));

      await user.press(rowOf(2));
      await user.press(addRow());
      await user.press(screen.getByRole("button", { name: "Reorder" }));

      expect(noSheet()).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Move step 1 down" })).not.toBeOnTheScreen();
      await act(() => {
        finishSave({ ...chickenAndRice });
      });
    });
  });
});
