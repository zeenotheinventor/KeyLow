import { fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { GroupedList, PlateRow } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { viewsDrawn } from "../support/viewsDrawn";

import type { PlateRowProps } from "../../components/ui";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

// The milk row of the `plate · edit-amount` board, before the amount is changed.
const milk: PlateRowProps = {
  name: "Semi-skimmed milk",
  energy: "92",
  macros: { protein: "6.8", carbs: "9.6", fat: "3.2", description: "" },
  amountText: "200",
  unitWord: "ml",
  unitsWord: "ml",
  onAmountChange: () => undefined,
  onOpen: () => undefined,
  onRemove: () => undefined,
};

const chickenAndRice: PlateRowProps = {
  ...milk,
  name: "Chicken and rice",
  isRecipe: true,
  energy: "374",
  macros: { protein: "32", carbs: "43", fat: "8.1", description: "" },
  amountText: "1",
  unitWord: "serving",
  unitsWord: "servings",
};

// NativeWind hands the opacity over as a 32 bit float.
const dimmedTo40Percent = Math.fround(0.4);

const milkAmountName = "Amount of Semi-skimmed milk, ml";
const milkOpenName = "Semi-skimmed milk, 200 ml, 92 kilocalories, change amount or unit";
const milkRemoveName = "Remove Semi-skimmed milk from your plate";

async function renderRow(props: Partial<PlateRowProps> = {}) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <GroupedList hidesTitle title="Foods on your plate">
        <PlateRow {...milk} {...props} />
      </GroupedList>
    </ThemeProvider>,
  );
}

describe("PlateRow", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("what the row has", () => {
    it("should have a name button, an amount field and a remove button, each named as the boards name them", async () => {
      await renderRow();

      expect(screen.getByRole("button", { name: milkOpenName })).toBeOnTheScreen();
      expect(screen.getByLabelText(milkAmountName)).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: milkRemoveName })).toBeOnTheScreen();
    });

    it("should name the open button with the recipe's serving in the singular and the field with the plural", async () => {
      await renderRow(chickenAndRice);

      expect(
        screen.getByRole("button", {
          name: "Chicken and rice, 1 serving, 374 kilocalories, change amount or unit",
        }),
      ).toBeOnTheScreen();
      expect(screen.getByLabelText("Amount of Chicken and rice, servings")).toBeOnTheScreen();
    });

    it("should write the name in the strong weight and the stats line under it", async () => {
      await renderRow();

      expect(screen.getByText("Semi-skimmed milk")).toHaveStyle({ fontWeight: "600" });
      expect(screen.getByText("92")).toBeOnTheScreen();
      expect(screen.getByText("kcal")).toBeOnTheScreen();
      expect(screen.getByText("6.8 P")).toBeOnTheScreen();
      expect(screen.getByText("9.6 C")).toBeOnTheScreen();
      expect(screen.getByText("3.2 F")).toBeOnTheScreen();
    });

    it("should hold the name to two lines", async () => {
      await renderRow({ name: "Semi-skimmed milk" });

      expect(screen.getByText("Semi-skimmed milk")).toHaveProp("numberOfLines", 2);
    });

    it("should say Recipe under the name of a recipe and nothing under a food", async () => {
      await renderRow(chickenAndRice);

      expect(screen.getByText("Recipe")).toBeOnTheScreen();
    });

    it("should say nothing under the name of a food", async () => {
      await renderRow();

      expect(screen.queryByText("Recipe")).not.toBeOnTheScreen();
    });

    it("should leave the amount out of the open button's name while the field is empty", async () => {
      await renderRow({ amountText: "" });

      expect(
        screen.getByRole("button", {
          name: "Semi-skimmed milk, 92 kilocalories, change amount or unit",
        }),
      ).toBeOnTheScreen();
    });
  });

  describe("the amount field", () => {
    it("should read the amount with its unit after it, and take the decimal pad", async () => {
      await renderRow();

      const field = screen.getByLabelText(milkAmountName);
      expect(field).toHaveProp("value", "200");
      expect(field).toHaveProp("keyboardType", "decimal-pad");
      expect(screen.getByText("ml", { includeHiddenElements: true })).toBeOnTheScreen();
    });

    it("should write the unit as a caption, smaller than the digits, as the board draws it", async () => {
      await renderRow();

      expect(screen.getByText("ml", { includeHiddenElements: true })).toHaveStyle({
        fontSize: 12,
        lineHeight: 16,
      });
      expect(screen.getByLabelText(milkAmountName)).toHaveStyle({ fontSize: 16 });
    });

    it("should select the whole value when it gets focus, so the first keystroke replaces it", async () => {
      await renderRow();

      expect(screen.getByLabelText(milkAmountName).props.selectTextOnFocus).toBe(true);
    });

    it("should hand on what is typed", async () => {
      const onAmountChange = jest.fn();
      await renderRow({ onAmountChange });

      await fireEvent.changeText(screen.getByLabelText(milkAmountName), "300");

      expect(onAmountChange).toHaveBeenCalledTimes(1);
      expect(onAmountChange).toHaveBeenCalledWith("300");
    });

    it("should take the focus when the row appears, if asked to", async () => {
      await renderRow({ autoFocus: true });

      expect(screen.getByLabelText(milkAmountName)).toHaveProp("autoFocus", true);
    });

    it("should be 112 points wide and 36 high with 10 points across, as the board draws it", async () => {
      await renderRow();

      expect(viewsDrawn({ width: 112 })).toHaveLength(1);
      expect(viewsDrawn({ height: 36, paddingLeft: 10, paddingRight: 10 })).toHaveLength(1);
    });
  });

  describe("pressing", () => {
    it("should open the food when the name is pressed", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onOpen = jest.fn();
      const onRemove = jest.fn();
      await renderRow({ onOpen, onRemove });

      await user.press(screen.getByRole("button", { name: milkOpenName }));

      expect(onOpen).toHaveBeenCalledTimes(1);
      expect(onRemove).not.toHaveBeenCalled();
    });

    it("should remove the food when the X is pressed, and not open it", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onOpen = jest.fn();
      const onRemove = jest.fn();
      await renderRow({ onOpen, onRemove });

      await user.press(screen.getByRole("button", { name: milkRemoveName }));

      expect(onRemove).toHaveBeenCalledTimes(1);
      expect(onOpen).not.toHaveBeenCalled();
    });

    it("should give the X a 44 point target", async () => {
      await renderRow();

      expect(viewsDrawn({ height: 44, width: 44 }).length).toBeGreaterThan(0);
    });
  });

  describe("offline, when the unit cannot be changed", () => {
    it("should disable the name alone", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onOpen = jest.fn();
      const onRemove = jest.fn();
      const onAmountChange = jest.fn();
      await renderRow({ isOpenDisabled: true, onOpen, onRemove, onAmountChange });

      expect(screen.getByRole("button", { name: milkOpenName })).toBeDisabled();
      expect(screen.getByLabelText(milkAmountName)).toBeEnabled();
      expect(screen.getByRole("button", { name: milkRemoveName })).toBeEnabled();

      await user.press(screen.getByRole("button", { name: milkOpenName }));
      await fireEvent.changeText(screen.getByLabelText(milkAmountName), "300");
      await user.press(screen.getByRole("button", { name: milkRemoveName }));

      expect(onOpen).not.toHaveBeenCalled();
      expect(onAmountChange).toHaveBeenCalledWith("300");
      expect(onRemove).toHaveBeenCalledTimes(1);
    });

    it("should dim the name to 40 percent and nothing else", async () => {
      await renderRow({ isOpenDisabled: true });

      expect(viewsDrawn({ opacity: dimmedTo40Percent })).toHaveLength(1);
    });
  });

  describe("with no way to open the food", () => {
    it("should write the name and its stats as plain text, with no button for them", async () => {
      await renderRow({ onOpen: undefined });

      expect(screen.getByText("Semi-skimmed milk")).toBeOnTheScreen();
      expect(screen.getByText("92")).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: milkOpenName })).not.toBeOnTheScreen();
      expect(screen.getAllByRole("button")).toHaveLength(1);
    });

    it("should not dim the name, even when asked to dim it for being offline", async () => {
      await renderRow({ onOpen: undefined, isOpenDisabled: true });

      expect(viewsDrawn({ opacity: dimmedTo40Percent })).toHaveLength(0);
    });

    it("should keep the field and the X working", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onRemove = jest.fn();
      const onAmountChange = jest.fn();
      await renderRow({ onOpen: undefined, onRemove, onAmountChange });

      await fireEvent.changeText(screen.getByLabelText(milkAmountName), "300");
      await user.press(screen.getByRole("button", { name: milkRemoveName }));

      expect(onAmountChange).toHaveBeenCalledWith("300");
      expect(onRemove).toHaveBeenCalledTimes(1);
    });

    it("should keep the name's two lines and the Recipe caption", async () => {
      await renderRow({ ...chickenAndRice, onOpen: undefined });

      expect(screen.getByText("Chicken and rice")).toHaveProp("numberOfLines", 2);
      expect(screen.getByText("Recipe")).toBeOnTheScreen();
    });
  });

  describe("while the plate is being logged", () => {
    it("should disable the name, the field and the X, and press none of them", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onOpen = jest.fn();
      const onRemove = jest.fn();
      await renderRow({ disabled: true, onOpen, onRemove });

      expect(screen.getByRole("button", { name: milkOpenName })).toBeDisabled();
      expect(screen.getByLabelText(milkAmountName)).toBeDisabled();
      expect(screen.getByRole("button", { name: milkRemoveName })).toBeDisabled();

      await user.press(screen.getByRole("button", { name: milkOpenName }));
      await user.press(screen.getByRole("button", { name: milkRemoveName }));

      expect(onOpen).not.toHaveBeenCalled();
      expect(onRemove).not.toHaveBeenCalled();
    });

    it("should dim the whole row to 40 percent, once", async () => {
      await renderRow({ disabled: true });

      expect(viewsDrawn({ opacity: dimmedTo40Percent })).toHaveLength(1);
      expect(viewsDrawn({ opacity: 0.5 })).toHaveLength(0);
    });
  });

  describe("an amount that is not above 0", () => {
    it("should say so under the row, as an alert that describes the field", async () => {
      await renderRow({ amountText: "", error: "Enter an amount above 0." });

      expect(screen.getAllByRole("alert")).toHaveLength(1);
      expect(screen.getByRole("alert", { name: "Enter an amount above 0." })).toBeOnTheScreen();
      expect(screen.getByLabelText(milkAmountName)).toHaveProp(
        "accessibilityHint",
        "Enter an amount above 0.",
      );
    });

    it("should say nothing while the amount is fine", async () => {
      await renderRow();

      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });
  });

  describe("in a list", () => {
    it("should draw a divider above every row but the first", async () => {
      await render(
        <ThemeProvider fixedPreference="dark">
          <GroupedList hidesTitle title="Foods on your plate">
            <PlateRow {...chickenAndRice} />
            <PlateRow {...milk} />
          </GroupedList>
        </ThemeProvider>,
      );

      expect(viewsDrawn({ borderTopWidth: 1 })).toHaveLength(1);
    });
  });
});
