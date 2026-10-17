import { KeyLowProvider } from "@keylow/api-client";
import { OFFLINE_BANNER, RECIPE_VIEW } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { AccessibilityInfo, TextInput } from "react-native";
import { setUpTests } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CHICKEN_AND_RICE_ID, chickenAndRiceRecipe, frittataRecipe } from "./recipeViewFixtures";
import { RecipeView } from "../../components/RecipeView";
import { ToastProvider } from "../../components/ui";
import { editRecipePath } from "../../lib/recipeRoutes";
import { ThemeProvider } from "../../lib/theme";
import {
  createDiaryQueryClient,
  diaryBackend,
  diaryClient,
  resetDiaryBackend,
} from "../support/diaryBackend";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { RecipeViewRecipe } from "../../components/RecipeView";
import type { QueryClient } from "@tanstack/react-query";

// The recipe view with a recipe in hand: what changing the servings does to the screen, and that it does
// nothing else. The reading of the recipe and the screen's other states are in recipeViewScreen.test.tsx.

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

setUpTests();

let queryClient: QueryClient;
const onBack = jest.fn();

function viewOf(recipe: RecipeViewRecipe) {
  return (
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={diaryClient} queryClient={queryClient}>
        <ToastProvider>
          <RecipeView recipe={recipe} onBack={onBack} />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>
  );
}

async function showView(recipe: RecipeViewRecipe) {
  queryClient = createDiaryQueryClient();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  const rendered = await render(viewOf(recipe));
  return { user, rerenderWith: (next: RecipeViewRecipe) => rendered.rerender(viewOf(next)) };
}

const field = () => screen.getByRole("adjustable", { name: "Servings" });
const morePressed = (user: ReturnType<typeof userEvent.setup>) =>
  user.press(screen.getByRole("button", { name: RECIPE_VIEW.moreServings }));
const lessPressed = (user: ReturnType<typeof userEvent.setup>) =>
  user.press(screen.getByRole("button", { name: RECIPE_VIEW.fewerServings }));
const row = (name: string) => screen.getByLabelText(name);
const editButton = (recipeName: string) =>
  screen.getByRole("button", { name: `Edit ${recipeName}` });
const letTypingStop = () =>
  act(() => {
    jest.advanceTimersByTime(500);
  });

describe("the recipe view", () => {
  let kitStyles: string;
  let announce: jest.SpyInstance;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/RecipeView",
      "components/ServingsCard",
      "components/RecipeViewIngredientsSection",
      "components/RecipeViewStepsSection",
      "components/StepRow",
      "components/PerServingCard",
      "components/FoodDetail",
    ]);
  });

  beforeEach(() => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetDiaryBackend();
    onBack.mockReset();
    jest.mocked(useSafeAreaInsets).mockReturnValue({ top: 0, right: 0, bottom: 0, left: 0 });
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    announce.mockClear();
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

  describe("the list", () => {
    const scrollView = () => screen.root?.queryAll((node) => node.type === "RCTScrollView")[0];

    it("should end 24 points under the last row and 34 clear of the system bar, as the board does", async () => {
      jest.mocked(useSafeAreaInsets).mockReturnValue({ top: 0, right: 0, bottom: 0, left: 0 });
      await showView(chickenAndRiceRecipe);

      expect(scrollView()?.props.contentContainerStyle).toMatchObject({
        rowGap: 24,
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 4,
        paddingBottom: 58,
      });
    });

    it("should keep the last step off a system bar taller than the board's 34", async () => {
      jest.mocked(useSafeAreaInsets).mockReturnValue({ top: 0, right: 0, bottom: 48, left: 0 });
      await showView(chickenAndRiceRecipe);

      expect(scrollView()?.props.contentContainerStyle).toMatchObject({ paddingBottom: 72 });
    });

    it("should put the number pad away when the list is dragged, since iOS gives it no Done key", async () => {
      await showView(chickenAndRiceRecipe);

      expect(scrollView()).toHaveProp("keyboardDismissMode", "on-drag");
    });
  });

  describe("chicken and rice at its own servings", () => {
    beforeEach(async () => {
      await showView(chickenAndRiceRecipe);
    });

    it("should have Back, the recipe's name and Edit named for the recipe, then More", () => {
      expect(screen.getByRole("button", { name: "Back" })).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Chicken and rice" })).toBeOnTheScreen();
      expect(editButton("Chicken and rice")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "More" })).toBeEnabled();
    });

    it("should go back when Back is pressed", async () => {
      await userEvent.press(screen.getByRole("button", { name: "Back" }));

      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it("should show what one serving gives", () => {
      const card = screen.getByLabelText("Per serving");

      expect(card).toHaveTextContent(/^374kcal/);
      expect(screen.getByText("Per serving (275 g)")).toBeOnTheScreen();
      expect(screen.getByText("Per 100 g cooked: 136 kcal")).toBeOnTheScreen();
    });

    it("should start the stepper at the recipe's own servings, with the yield and no way back", () => {
      expect(field()).toHaveDisplayValue("4");
      expect(field()).toHaveAccessibilityValue({ text: "4 servings" });
      expect(screen.getByText("Makes 4 · 1,100 g cooked")).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /^Back to/ })).not.toBeOnTheScreen();
      expect(screen.getByText("For 4 servings")).toBeOnTheScreen();
    });

    it("should list the ingredients in the recipe's amounts, each row named by its words", () => {
      expect(screen.getByRole("heading", { name: "Ingredients · 3" })).toBeOnTheScreen();
      expect(row("Chicken breast fillets, 500 g")).toBeOnTheScreen();
      expect(row("Long grain rice, 200 g")).toBeOnTheScreen();
      expect(row("Olive oil, 20 g")).toBeOnTheScreen();
    });

    it("should give an ingredient only its name and amount, and nothing to press", () => {
      expect(row("Chicken breast fillets, 500 g")).toHaveTextContent(
        /^Chicken breast fillets500 g$/,
      );
      expect(
        screen.queryByRole("button", { name: /Chicken breast fillets/ }),
      ).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /^Remove/ })).not.toBeOnTheScreen();
    });

    it("should list the steps in full, and not say they are written for other servings", () => {
      expect(screen.getByRole("heading", { name: "Instructions · 5" })).toBeOnTheScreen();
      expect(screen.getByText("Cover and simmer for 18 minutes.")).toBeOnTheScreen();
      expect(screen.queryByText(/The steps are written for/)).not.toBeOnTheScreen();
    });
  });

  describe("scaling by the buttons", () => {
    it("should move the amounts, the yield and the headings, and leave the Per serving card alone", async () => {
      const { user } = await showView(chickenAndRiceRecipe);

      await morePressed(user);
      await morePressed(user);

      expect(field()).toHaveDisplayValue("6");
      expect(field()).toHaveAccessibilityValue({ text: "6 servings" });
      expect(row("Chicken breast fillets, 750 g")).toBeOnTheScreen();
      expect(row("Long grain rice, 300 g")).toBeOnTheScreen();
      expect(row("Olive oil, 30 g")).toBeOnTheScreen();
      expect(screen.getByText("Makes 6 · 1,650 g cooked")).toBeOnTheScreen();
      expect(screen.getByText("For 6 servings")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Back to 4 servings" })).toBeOnTheScreen();
      expect(screen.getByText("The steps are written for 4 servings.")).toBeOnTheScreen();
      expect(screen.getByLabelText("Per serving")).toHaveTextContent(/^374kcal/);
      expect(screen.getByText("Per serving (275 g)")).toBeOnTheScreen();
    });

    it("should tell a screen reader once for each press, and say nothing about the rows", async () => {
      const { user } = await showView(chickenAndRiceRecipe);

      await morePressed(user);
      await morePressed(user);

      expect(announce).toHaveBeenCalledTimes(2);
      expect(announce).toHaveBeenLastCalledWith("Ingredients for 6 servings, 1,650 grams cooked");
    });

    it("should step up and down by the field's own swipe, as the buttons do", async () => {
      await showView(chickenAndRiceRecipe);

      await fireEvent(field(), "accessibilityAction", { nativeEvent: { actionName: "increment" } });

      expect(field()).toHaveDisplayValue("5");
    });

    it("should disable Fewer servings at 1 and keep the frittata's amounts in their own units", async () => {
      const { user } = await showView(frittataRecipe);

      await lessPressed(user);
      await lessPressed(user);

      expect(row("Eggs, chicken, whole, raw, 3 × 1 large (150 g)")).toBeOnTheScreen();
      expect(row("Milk, semi-skimmed, pasteurised, average, 50 ml")).toBeOnTheScreen();
      expect(row("Oil, olive, 0.5 tbsp (7.5 ml)")).toBeOnTheScreen();
      expect(row("Onions, raw, 0.5 × 1 medium (55 g)")).toBeOnTheScreen();
      expect(row("Spinach, baby, raw, 50 g")).toBeOnTheScreen();
      expect(row("Cheese, Cheddar, English, 30 g")).toBeOnTheScreen();
      expect(screen.getByText("Makes 2 · 310 g cooked")).toBeOnTheScreen();

      await lessPressed(user);

      expect(field()).toHaveDisplayValue("1");
      expect(row("Oil, olive, 0.25 tbsp (3.8 ml)")).toBeOnTheScreen();
      expect(row("Onions, raw, 0.25 × 1 medium (28 g)")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: RECIPE_VIEW.fewerServings })).toBeDisabled();
    });
  });

  describe("Back to the recipe's servings", () => {
    it("should put the amounts back, tell a screen reader, and move focus to the field", async () => {
      const { user } = await showView(chickenAndRiceRecipe);
      await morePressed(user);
      await morePressed(user);
      announce.mockClear();
      const focus = jest.spyOn(TextInput.prototype, "focus");

      await user.press(screen.getByRole("button", { name: "Back to 4 servings" }));

      expect(row("Chicken breast fillets, 500 g")).toBeOnTheScreen();
      expect(row("Long grain rice, 200 g")).toBeOnTheScreen();
      expect(row("Olive oil, 20 g")).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /^Back to/ })).not.toBeOnTheScreen();
      expect(announce).toHaveBeenCalledWith("Ingredients for 4 servings, 1,100 grams cooked");
      expect(focus).toHaveBeenCalledTimes(1);
    });
  });

  describe("typing the servings", () => {
    it("should move the amounts at once, and tell a screen reader once typing has stopped", async () => {
      await showView(chickenAndRiceRecipe);

      await fireEvent.changeText(field(), "6");

      expect(row("Chicken breast fillets, 750 g")).toBeOnTheScreen();
      expect(announce).not.toHaveBeenCalled();

      await act(() => {
        jest.advanceTimersByTime(499);
      });
      expect(announce).not.toHaveBeenCalled();

      await letTypingStop();
      expect(announce).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenCalledWith("Ingredients for 6 servings, 1,650 grams cooked");
    });

    it("should tell it only for the number typing came to rest on", async () => {
      await showView(chickenAndRiceRecipe);

      await fireEvent.changeText(field(), "1");
      await fireEvent.changeText(field(), "12");
      await letTypingStop();

      expect(announce).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenCalledWith("Ingredients for 12 servings, 3,300 grams cooked");
    });

    it("should say what is wrong under the stepper, keep the amounts at the last number, and put it back on leaving", async () => {
      const { user } = await showView(chickenAndRiceRecipe);
      await morePressed(user);
      await morePressed(user);

      await fireEvent.changeText(field(), "0");

      expect(screen.getByText("Enter whole servings from 1 to 1,000.")).toBeOnTheScreen();
      expect(field()).toHaveDisplayValue("0");
      expect(row("Chicken breast fillets, 750 g")).toBeOnTheScreen();
      expect(row("Long grain rice, 300 g")).toBeOnTheScreen();
      expect(row("Olive oil, 30 g")).toBeOnTheScreen();
      expect(screen.getByText("Makes 6 · 1,650 g cooked")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Back to 4 servings" })).toBeOnTheScreen();
      await letTypingStop();
      expect(announce).toHaveBeenCalledTimes(2);

      await fireEvent(field(), "blur");

      expect(field()).toHaveDisplayValue("6");
      expect(screen.queryByText("Enter whole servings from 1 to 1,000.")).not.toBeOnTheScreen();
    });

    it.each(["", "1001", "2.5", "abc"])("should not accept %j", async (typed) => {
      await showView(chickenAndRiceRecipe);

      await fireEvent.changeText(field(), typed);

      expect(screen.getByText("Enter whole servings from 1 to 1,000.")).toBeOnTheScreen();
      expect(row("Chicken breast fillets, 500 g")).toBeOnTheScreen();
    });

    it("should say nothing if the screen is left before typing has stopped", async () => {
      await showView(chickenAndRiceRecipe);
      await fireEvent.changeText(field(), "6");

      await cleanup();
      await letTypingStop();

      expect(announce).not.toHaveBeenCalled();
    });

    it("should not announce a problem, nor the number before it", async () => {
      await showView(chickenAndRiceRecipe);

      await fireEvent.changeText(field(), "6");
      await fireEvent.changeText(field(), "");
      await letTypingStop();

      expect(announce).not.toHaveBeenCalled();
    });

    it("should let a step take over from what was typed", async () => {
      const { user } = await showView(chickenAndRiceRecipe);

      await fireEvent.changeText(field(), "0");
      await morePressed(user);

      expect(field()).toHaveDisplayValue("5");
      expect(screen.queryByText("Enter whole servings from 1 to 1,000.")).not.toBeOnTheScreen();
    });
  });

  describe("a recipe saved at a fraction of a serving", () => {
    const fractionalRecipe: RecipeViewRecipe = { ...chickenAndRiceRecipe, servings: 2.5 };

    it("should start at the fraction, step to the whole numbers either side, and read the way back as it is", async () => {
      const { user } = await showView(fractionalRecipe);
      expect(field()).toHaveDisplayValue("2.5");

      await lessPressed(user);
      expect(field()).toHaveDisplayValue("2");
      expect(screen.getByRole("button", { name: "Back to 2.5 servings" })).toBeOnTheScreen();

      await user.press(screen.getByRole("button", { name: "Back to 2.5 servings" }));
      await morePressed(user);
      expect(field()).toHaveDisplayValue("3");
    });

    it("should take the recipe's own servings typed back as its own, with nothing scaled", async () => {
      await showView(fractionalRecipe);

      await fireEvent.changeText(field(), "2.5");

      expect(screen.queryByText("Enter whole servings from 1 to 1,000.")).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /^Back to/ })).not.toBeOnTheScreen();
      expect(row("Chicken breast fillets, 500 g")).toBeOnTheScreen();
    });

    it("should follow the recipe when it is read again with other servings after the own servings were typed", async () => {
      const { rerenderWith } = await showView(fractionalRecipe);
      await fireEvent.changeText(field(), "2.5");
      await fireEvent(field(), "blur");

      await rerenderWith({ ...chickenAndRiceRecipe, servings: 4 });

      expect(field()).toHaveDisplayValue("4");
      expect(field()).toHaveAccessibilityValue({ text: "4 servings" });
      expect(screen.getByText("Makes 4 · 1,100 g cooked")).toBeOnTheScreen();
      expect(row("Chicken breast fillets, 500 g")).toBeOnTheScreen();
    });

    it("should tell the screen as it is when the recipe changes before the announcement is due", async () => {
      const { rerenderWith } = await showView(fractionalRecipe);
      await fireEvent.changeText(field(), "2.5");

      await rerenderWith({ ...chickenAndRiceRecipe, servings: 4 });
      announce.mockClear();
      await letTypingStop();

      expect(announce).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenCalledWith("Ingredients for 4 servings, 1,100 grams cooked");
    });
  });

  describe("a recipe with no steps", () => {
    it("should draw no Instructions section, scaled or not", async () => {
      const { user } = await showView({ ...chickenAndRiceRecipe, instructions: [] });
      await morePressed(user);

      expect(screen.queryByRole("heading", { name: /^Instructions/ })).not.toBeOnTheScreen();
      expect(screen.queryByText(/The steps are written for/)).not.toBeOnTheScreen();
    });
  });

  describe("nothing is saved", () => {
    it("should make no request and start no mutation however the servings change", async () => {
      const { user } = await showView(chickenAndRiceRecipe);

      await morePressed(user);
      await lessPressed(user);
      await lessPressed(user);
      await fireEvent.changeText(field(), "9");
      await letTypingStop();
      await fireEvent(field(), "blur");
      await user.press(screen.getByRole("button", { name: "Back to 4 servings" }));

      expect(diaryBackend.requests).toHaveLength(0);
      expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
    });
  });

  describe("Edit", () => {
    it("should open the editor, and start the view again at the recipe's own servings", async () => {
      const { user } = await showView(chickenAndRiceRecipe);
      await morePressed(user);

      await user.press(editButton("Chicken and rice"));

      expect(routerMock.push).toHaveBeenCalledTimes(1);
      expect(routerMock.push).toHaveBeenCalledWith(editRecipePath(CHICKEN_AND_RICE_ID));
      expect(field()).toHaveDisplayValue("4");
      expect(row("Chicken breast fillets, 500 g")).toBeOnTheScreen();
    });

    it("should not tell a screen reader about a number typed just before it", async () => {
      const { user } = await showView(chickenAndRiceRecipe);
      await fireEvent.changeText(field(), "6");

      await user.press(editButton("Chicken and rice"));
      await letTypingStop();

      expect(announce).not.toHaveBeenCalled();
    });
  });

  describe("while offline", () => {
    beforeEach(async () => {
      await showView(chickenAndRiceRecipe);
      await act(() => {
        onlineManager.setOnline(false);
      });
    });

    it("should say what still works, and what needs a connection", () => {
      expect(screen.getByText(OFFLINE_BANNER.title)).toBeOnTheScreen();
      expect(screen.getByText(RECIPE_VIEW.offlineBody)).toBeOnTheScreen();
    });

    it("should leave Edit in the order, dimmed and disabled, with no response and no pressed look", async () => {
      const edit = editButton("Chicken and rice");

      expect(edit).toBeDisabled();
      await fireEvent(edit, "pressIn");
      expect(screen.queryByTestId("press-overlay")).not.toBeOnTheScreen();
      await userEvent.press(edit);
      expect(routerMock.push).not.toHaveBeenCalled();
    });

    it("should leave More beside it, dimmed and disabled too, and open no menu", async () => {
      const more = screen.getByRole("button", { name: "More" });

      expect(more).toBeDisabled();
      await fireEvent(more, "pressIn");
      expect(screen.queryByTestId("press-overlay")).not.toBeOnTheScreen();
      await userEvent.press(more);
      expect(screen.queryByRole("button", { name: /^Duplicate, / })).not.toBeOnTheScreen();
    });

    it("should still scale, reset and read every row", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      await morePressed(user);
      await morePressed(user);
      expect(row("Chicken breast fillets, 750 g")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: RECIPE_VIEW.moreServings })).toBeEnabled();

      await user.press(screen.getByRole("button", { name: "Back to 4 servings" }));
      expect(row("Chicken breast fillets, 500 g")).toBeOnTheScreen();
    });
  });
});
