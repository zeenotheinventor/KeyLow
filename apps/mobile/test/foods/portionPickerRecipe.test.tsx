import "react-native-gesture-handler/jestSetup";

import { buildRecipeLogEntry } from "@keylow/core/diary";
import { formatCalories, formatGrams } from "@keylow/core/format";
import { fireEvent, render, screen, userEvent, within } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { goldenRecipe } from "./support/recipeFixtures";
import { PortionPicker } from "../../components/PortionPicker";
import { ThemeProvider } from "../../lib/theme";
import { trackFieldSelection } from "../support/amountFieldSelection";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { PortionPickerProps } from "../../components/PortionPicker";

// The portion picker in its recipe mode, as a component: the amount step of a recipe, as the boards
// portion · recipe-serving, recipe-grams and recipe-grams-no-cooked-weight draw it. The amount rules are
// core's, so these tests pin the figures the boards show and that the hero is what is stored.

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

type RecipeProps = Extract<PortionPickerProps, { mode: "recipe" }>;

async function renderPicker(props: Partial<Omit<RecipeProps, "mode">> = {}) {
  const onSubmit = jest.fn();
  const onBack = jest.fn();
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <PortionPicker
        hasSaveError={false}
        isNow={false}
        isSaving={false}
        mode="recipe"
        recipe={goldenRecipe(1100)}
        time="18:00"
        onBack={onBack}
        onSubmit={onSubmit}
        {...props}
      />
    </ThemeProvider>,
  );
  return { user, onSubmit, onBack };
}

const amountField = () => screen.getByLabelText(/^Amount \(/);

async function typeAmount(text: string) {
  await fireEvent.changeText(amountField(), text);
}

describe("PortionPicker in recipe mode", () => {
  const amountSelection = trackFieldSelection();
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  describe("one serving, as portion · recipe-serving draws it", () => {
    it("should be headed by the recipe's name, with Back", async () => {
      const { user, onBack } = await renderPicker();

      expect(screen.getByRole("heading", { name: "Chicken and rice" })).toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: "Back" }));
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it("should say it is a recipe and what it makes", async () => {
      await renderPicker();

      expect(screen.getByText("Recipe")).toBeOnTheScreen();
      expect(screen.getByText("Makes 4 · 1,100 g cooked")).toBeOnTheScreen();
    });

    it("should show 374 kcal for 1 serving (275 g) with the macros and their shares", async () => {
      await renderPicker();

      const hero = screen.getByLabelText("Energy and macros, For 1 serving (275 g)");
      expect(within(hero).getByText("374")).toBeOnTheScreen();
      expect(within(hero).getByText("For 1 serving (275 g)")).toBeOnTheScreen();
      expect(within(hero).getByLabelText("Protein, 32 g, 34 % of energy")).toBeOnTheScreen();
      expect(within(hero).getByLabelText("Carbs, 43 g, 45 % of energy")).toBeOnTheScreen();
      expect(within(hero).getByLabelText("Fat, 8.1 g, 20 % of energy")).toBeOnTheScreen();
      expect(within(hero).getByText("Shares of energy are estimates")).toBeOnTheScreen();
    });

    it("should list the values per 100 g of the cooked dish", async () => {
      await renderPicker();

      const card = screen.getByLabelText("Per 100 g cooked");
      expect(within(card).getByText("136")).toBeOnTheScreen();
      expect(within(card).getByText("12")).toBeOnTheScreen();
      expect(within(card).getByText("15")).toBeOnTheScreen();
      expect(within(card).getByText("3")).toBeOnTheScreen();
    });

    it("should open on 1 serving: the amount, its suffix, the chips and the time", async () => {
      await renderPicker();

      expect(screen.getByLabelText("Amount (serving)")).toHaveDisplayValue("1");
      expect(screen.getByRole("radio", { name: "1 serving", checked: true })).toBeOnTheScreen();
      expect(screen.getByRole("radio", { name: "g", checked: false })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Time, 18:00, change" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Add" })).toBeEnabled();
    });

    it("should read the time as now until a time is chosen", async () => {
      await renderPicker({ isNow: true, time: "12:40" });

      expect(screen.getByRole("button", { name: "Time, now, 12:40, change" })).toBeOnTheScreen();
    });
  });

  describe("an amount of servings", () => {
    it("should show 561 kcal for 1.5 servings (413 g), the suffix in the plural", async () => {
      await renderPicker();
      await typeAmount("1.5");

      expect(
        screen.getByLabelText("Energy and macros, For 1.5 servings (413 g)"),
      ).toBeOnTheScreen();
      expect(screen.getByText("561")).toBeOnTheScreen();
      expect(screen.getByLabelText("Amount (servings)")).toBeOnTheScreen();
    });

    it("should take a decimal comma", async () => {
      await renderPicker();
      await typeAmount("1,5");

      expect(screen.getByText("561")).toBeOnTheScreen();
    });
  });

  describe("grams, as portion · recipe-grams draws it", () => {
    it("should reset the amount to 100 when g is chosen", async () => {
      const { user } = await renderPicker();
      await typeAmount("2");

      await user.press(screen.getByRole("radio", { name: "g" }));

      expect(screen.getByLabelText("Amount (g)")).toHaveDisplayValue("100");
      expect(screen.getByRole("radio", { name: "g", checked: true })).toBeOnTheScreen();
    });

    it("should show 408 kcal for 300 g, with the macros of that amount", async () => {
      const { user } = await renderPicker();
      await user.press(screen.getByRole("radio", { name: "g" }));
      await typeAmount("300");

      const hero = screen.getByLabelText("Energy and macros, For 300 g");
      expect(within(hero).getByText("408")).toBeOnTheScreen();
      expect(within(hero).getByLabelText(/^Protein, 35 g,/)).toBeOnTheScreen();
      expect(within(hero).getByLabelText(/^Carbs, 46 g,/)).toBeOnTheScreen();
      expect(within(hero).getByLabelText(/^Fat, 8\.9 g,/)).toBeOnTheScreen();
    });

    it("should reset the amount to 1 when 1 serving is chosen again", async () => {
      const { user } = await renderPicker();
      await user.press(screen.getByRole("radio", { name: "g" }));
      await typeAmount("300");

      await user.press(screen.getByRole("radio", { name: "1 serving" }));

      expect(screen.getByLabelText("Amount (serving)")).toHaveDisplayValue("1");
    });

    it("should keep the amount when the chosen chip is pressed again", async () => {
      const { user } = await renderPicker();
      await user.press(screen.getByRole("radio", { name: "g" }));
      await typeAmount("300");

      await user.press(screen.getByRole("radio", { name: "g" }));

      expect(screen.getByLabelText("Amount (g)")).toHaveDisplayValue("300");
    });

    it("should not note the raw ingredients when the recipe has a cooked weight", async () => {
      const { user } = await renderPicker();
      await user.press(screen.getByRole("radio", { name: "g" }));

      expect(screen.queryByText(/No cooked weight is set/)).not.toBeOnTheScreen();
    });
  });

  describe("tapping into the amount", () => {
    it("should select the whole amount when the person taps into it", async () => {
      const { user } = await renderPicker();
      await user.press(screen.getByRole("radio", { name: "g" }));

      expect(screen.getByLabelText("Amount (g)").props.selectTextOnFocus).toBe(true);
    });
  });

  describe("choosing a unit puts the cursor in the amount", () => {
    it("should focus nothing when the picker is drawn", async () => {
      await renderPicker();

      expect(amountSelection.focus).not.toHaveBeenCalled();
      expect(amountSelection.setSelection).not.toHaveBeenCalled();
    });

    it("should focus the amount and select the whole of 100 when g is chosen", async () => {
      const { user } = await renderPicker();
      await typeAmount("2");

      await user.press(screen.getByRole("radio", { name: "g" }));

      expect(screen.getByLabelText("Amount (g)")).toHaveDisplayValue("100");
      expect(amountSelection.focus).toHaveBeenCalledTimes(1);
      expect(amountSelection.setSelection).toHaveBeenCalledWith(0, "100".length);
      expect(amountSelection.focusedThenSelected()).toBe(true);
    });

    it("should select the 1 when 1 serving is chosen again", async () => {
      const { user } = await renderPicker();
      await user.press(screen.getByRole("radio", { name: "g" }));

      await user.press(screen.getByRole("radio", { name: "1 serving" }));

      expect(screen.getByLabelText("Amount (serving)")).toHaveDisplayValue("1");
      expect(amountSelection.setSelection).toHaveBeenLastCalledWith(0, 1);
    });

    it("should select the typed amount when the chosen chip is pressed again", async () => {
      const { user } = await renderPicker();
      await user.press(screen.getByRole("radio", { name: "g" }));
      await typeAmount("300");

      await user.press(screen.getByRole("radio", { name: "g" }));

      expect(screen.getByLabelText("Amount (g)")).toHaveDisplayValue("300");
      expect(amountSelection.focus).toHaveBeenCalledTimes(2);
      expect(amountSelection.setSelection).toHaveBeenLastCalledWith(0, "300".length);
    });
  });

  describe("a recipe with no cooked weight, as portion · recipe-grams-no-cooked-weight draws it", () => {
    const rawRecipe = goldenRecipe(null);

    it("should say it has no cooked weight, and headed the values per 100 g raw", async () => {
      await renderPicker({ recipe: rawRecipe });

      expect(screen.getByText("Makes 4 · no cooked weight")).toBeOnTheScreen();
      const card = screen.getByLabelText("Per 100 g raw");
      expect(within(card).getByText("208")).toBeOnTheScreen();
      expect(within(card).getByText("18")).toBeOnTheScreen();
      expect(within(card).getByText("24")).toBeOnTheScreen();
      expect(within(card).getByText("4.5")).toBeOnTheScreen();
    });

    it("should show 572 kcal for 275 g, with the note that the grams are of the raw ingredients", async () => {
      const { user } = await renderPicker({ recipe: rawRecipe });
      await user.press(screen.getByRole("radio", { name: "g" }));
      await typeAmount("275");

      expect(screen.getByText("572")).toBeOnTheScreen();
      // Found without asking for hidden elements: a screen reader reads the line, once, in its place.
      expect(
        screen.getByText(
          "No cooked weight is set, so these grams are of the raw ingredients (720 g in total).",
        ),
      ).toBeOnTheScreen();
    });

    it("should name the hero by the grams alone, since the note is read as its own line", async () => {
      const { user } = await renderPicker({ recipe: rawRecipe });
      await user.press(screen.getByRole("radio", { name: "g" }));
      await typeAmount("275");

      expect(screen.getByLabelText("Energy and macros, For 275 g")).toBeOnTheScreen();
    });

    it("should not make the note while servings are chosen", async () => {
      await renderPicker({ recipe: rawRecipe });

      expect(screen.queryByText(/No cooked weight is set/)).not.toBeOnTheScreen();
      expect(screen.getByLabelText("Energy and macros, For 1 serving (180 g)")).toBeOnTheScreen();
    });
  });

  describe("an amount that is not above 0", () => {
    it.each([
      ["empty", ""],
      ["zero", "0"],
      ["not a number", "abc"],
      ["too large to work out", "9".repeat(400)],
    ])("should say so and turn Add off when it is %s", async (_name, text) => {
      const { user, onSubmit } = await renderPicker();
      await typeAmount(text);

      expect(screen.getByText("Enter an amount above 0.")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
      await user.press(screen.getByRole("button", { name: "Add" }));
      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByLabelText("Energy and macros, For this amount")).toBeOnTheScreen();
    });
  });

  describe("Add", () => {
    it("should hand over one serving and the time the row shows", async () => {
      const { user, onSubmit } = await renderPicker();

      await user.press(screen.getByRole("button", { name: "Add" }));

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith({
        quantity: 1,
        unit: "serving",
        time: "18:00",
        isNow: false,
      });
    });

    it("should hand over grams of cooked weight", async () => {
      const { user, onSubmit } = await renderPicker();
      await user.press(screen.getByRole("radio", { name: "g" }));
      await typeAmount("300");

      await user.press(screen.getByRole("button", { name: "Add" }));

      expect(onSubmit).toHaveBeenCalledWith({
        quantity: 300,
        unit: "g",
        time: "18:00",
        isNow: false,
      });
    });

    it("should say the time is still now when the row still reads Now", async () => {
      const { user, onSubmit } = await renderPicker({ isNow: true, time: "12:40" });

      await user.press(screen.getByRole("button", { name: "Add" }));

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ time: "12:40", isNow: true }),
      );
    });

    it("should hand over the time chosen in the time picker, which is no longer now", async () => {
      const { user, onSubmit } = await renderPicker({ isNow: true, time: "12:40" });

      await user.press(screen.getByRole("button", { name: "Time, now, 12:40, change" }));
      await user.press(
        within(screen.getByRole("spinbutton", { name: "Hours" })).getByRole("option", {
          name: "17",
        }),
      );
      await user.press(
        within(screen.getByRole("spinbutton", { name: "Minutes" })).getByRole("option", {
          name: "25",
        }),
      );
      await user.press(screen.getByRole("button", { name: "Done" }));

      expect(screen.getByRole("button", { name: "Time, 17:25, change" })).toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: "Add" }));
      expect(onSubmit).toHaveBeenCalledWith({
        quantity: 1,
        unit: "serving",
        time: "17:25",
        isNow: false,
      });
    });

    it("should be inert while the connection is lost", async () => {
      const { user, onSubmit } = await renderPicker({ isOnline: false });

      expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
      await user.press(screen.getByRole("button", { name: "Add" }));
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("should be busy and inert while it saves", async () => {
      const { user, onSubmit } = await renderPicker({ isSaving: true });

      await user.press(screen.getByRole("button", { name: /Add/, busy: true }));

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("should say the last Add was not saved, and still be pressable to try again", async () => {
      const { user, onSubmit } = await renderPicker({ hasSaveError: true });

      expect(
        screen.getByRole("alert", { name: /Not saved\. Check your connection and try again\./ }),
      ).toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: "Add" }));
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  describe("what is shown is what is stored", () => {
    it.each([
      ["1 serving", null, "1", { quantity: 1, unit: "serving" }],
      ["1.5 servings", null, "1.5", { quantity: 1.5, unit: "serving" }],
      ["300 g", "g", "300", { quantity: 300, unit: "g" }],
    ] as const)(
      "should show the energy and macros the entry for %s is built with",
      async (_name, chip, text, expected) => {
        const recipe = goldenRecipe(1100);
        const { user, onSubmit } = await renderPicker({ recipe });
        if (chip !== null) {
          await user.press(screen.getByRole("radio", { name: chip }));
        }
        await typeAmount(text);
        await user.press(screen.getByRole("button", { name: "Add" }));

        expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining(expected));
        const stored = buildRecipeLogEntry({
          recipe,
          ...expected,
          loggedAt: "2026-10-15T17:00:00.000Z",
          localDate: "2026-10-15",
        });
        const hero = screen.getByLabelText(/^Energy and macros, For /);
        const { kcal, protein_g, carbs_g, fat_g } = stored.nutrients;
        expect(within(hero).getByText(formatCalories(kcal ?? 0))).toBeOnTheScreen();
        expect(
          within(hero).getByLabelText(`Protein, ${formatGrams(protein_g ?? 0)} g`, {
            exact: false,
          }),
        ).toBeOnTheScreen();
        expect(
          within(hero).getByLabelText(`Carbs, ${formatGrams(carbs_g ?? 0)} g`, { exact: false }),
        ).toBeOnTheScreen();
        expect(
          within(hero).getByLabelText(`Fat, ${formatGrams(fat_g ?? 0)} g`, { exact: false }),
        ).toBeOnTheScreen();
      },
    );
  });
});
