import "react-native-gesture-handler/jestSetup";

import { buildFoodPortion } from "@keylow/core/testing";
import { fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { foodFixture, savedFoodId } from "./support/apiClientMock";
import { goldenRecipe } from "./support/recipeFixtures";
import { PortionPicker } from "../../components/PortionPicker";
import { ThemeProvider } from "../../lib/theme";
import { trackFieldSelection } from "../support/amountFieldSelection";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { PortionPickerProps } from "../../components/PortionPicker";

// The portion picker in its two plate modes, as a component: "Add to plate" in place of Add, no Time row, and
// the amount handed over on its own. The plate modes write nothing, so they have no saving state and no
// connection to wait for. The board is portion · add-to-plate.

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

const bar = buildFoodPortion({
  id: "33333333-3333-4333-8333-333333333333",
  food_id: savedFoodId,
  label: "1 bar",
  grams: 45,
  is_default: true,
});

type FoodPlateProps = Extract<PortionPickerProps, { mode: "add-to-plate" }>;
type RecipePlateProps = Extract<PortionPickerProps, { mode: "recipe-to-plate" }>;

async function renderFoodPicker(props: Partial<Omit<FoodPlateProps, "mode">> = {}) {
  const onSubmit = jest.fn();
  const onCopy = jest.fn();
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <PortionPicker
        food={foodFixture}
        mode="add-to-plate"
        portions={[bar]}
        onBack={() => undefined}
        onCopy={onCopy}
        onSubmit={onSubmit}
        {...props}
      />
    </ThemeProvider>,
  );
  return { user, onSubmit, onCopy };
}

async function renderRecipePicker(props: Partial<Omit<RecipePlateProps, "mode">> = {}) {
  const onSubmit = jest.fn();
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <PortionPicker
        mode="recipe-to-plate"
        recipe={goldenRecipe(1100)}
        onBack={() => undefined}
        onSubmit={onSubmit}
        {...props}
      />
    </ThemeProvider>,
  );
  return { user, onSubmit };
}

const amountField = () => screen.getByLabelText(/^Amount \(/);

describe("PortionPicker in its plate modes", () => {
  trackFieldSelection();
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  describe("a food", () => {
    it("should offer Add to plate and no Add, Save or Delete", async () => {
      await renderFoodPicker();

      expect(screen.getByRole("button", { name: "Add to plate" })).toBeEnabled();
      expect(screen.queryByRole("button", { name: "Add" })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Save" })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Delete" })).not.toBeOnTheScreen();
    });

    it("should have no Time row, because the time belongs to the plate", async () => {
      await renderFoodPicker();

      expect(screen.queryByRole("button", { name: /^Time/ })).not.toBeOnTheScreen();
    });

    it("should hand over the amount alone, with no time", async () => {
      const { user, onSubmit } = await renderFoodPicker();

      await user.press(screen.getByRole("button", { name: "Add to plate" }));

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith({ quantity: 1, unit: "portion", portion: bar });
    });

    it("should hand over the unit and the amount that were chosen", async () => {
      const { user, onSubmit } = await renderFoodPicker();
      await user.press(screen.getByRole("radio", { name: "g" }));
      await fireEvent.changeText(amountField(), "150");

      await user.press(screen.getByRole("button", { name: "Add to plate" }));

      expect(onSubmit).toHaveBeenCalledWith({ quantity: 150, unit: "g" });
    });

    it("should start at the amount it is given and say where the food came from", async () => {
      await renderFoodPicker({
        initialAmount: { quantity: 50, unit: "g" },
        note: "Scanned 5201054013410",
      });

      expect(amountField()).toHaveDisplayValue("50");
      expect(screen.getByText("Scanned 5201054013410")).toBeOnTheScreen();
    });

    it("should dim Add to plate and not hand anything over while the amount is not above 0", async () => {
      const { user, onSubmit } = await renderFoodPicker();
      await fireEvent.changeText(amountField(), "");

      expect(screen.getByText("Enter an amount above 0.")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Add to plate" })).toBeDisabled();
      await user.press(screen.getByRole("button", { name: "Add to plate" }));
      expect(onSubmit).not.toHaveBeenCalled();
    });

    describe("a food that must be reviewed first", () => {
      const reviewFirst = { ...foodFixture, carbs_g: null, quality: { suspect: true } };

      it("should offer Copy to your foods in place of Add to plate, with the review notice", async () => {
        const { user, onCopy } = await renderFoodPicker({ food: reviewFirst });

        expect(screen.getByText("Needs review")).toBeOnTheScreen();
        expect(screen.queryByRole("button", { name: "Add to plate" })).not.toBeOnTheScreen();
        await user.press(screen.getByRole("button", { name: "Copy to your foods" }));
        expect(onCopy).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("a recipe", () => {
    it("should offer Add to plate and no Add, Save or Delete, with no Time row", async () => {
      await renderRecipePicker();

      expect(screen.getByRole("button", { name: "Add to plate" })).toBeEnabled();
      expect(screen.queryByRole("button", { name: "Add" })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Save" })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Delete" })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /^Time/ })).not.toBeOnTheScreen();
    });

    it("should hand over one serving, with no time, as it opens", async () => {
      const { user, onSubmit } = await renderRecipePicker();

      await user.press(screen.getByRole("button", { name: "Add to plate" }));

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith({ quantity: 1, unit: "serving" });
    });

    it("should hand over the grams that were chosen", async () => {
      const { user, onSubmit } = await renderRecipePicker();
      await user.press(screen.getByRole("radio", { name: "g" }));
      await fireEvent.changeText(amountField(), "300");

      await user.press(screen.getByRole("button", { name: "Add to plate" }));

      expect(onSubmit).toHaveBeenCalledWith({ quantity: 300, unit: "g" });
    });

    it("should dim Add to plate while the amount is not above 0", async () => {
      await renderRecipePicker();
      await fireEvent.changeText(amountField(), "");

      expect(screen.getByRole("button", { name: "Add to plate" })).toBeDisabled();
    });
  });
});
