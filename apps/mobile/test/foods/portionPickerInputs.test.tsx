import "react-native-gesture-handler/jestSetup";

import { buildFoodPortion } from "@keylow/core/testing";
import { render, screen, userEvent } from "@testing-library/react-native";
import { AccessibilityInfo, Text } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { foodFixture, savedFoodId } from "./support/apiClientMock";
import { PortionPicker } from "../../components/PortionPicker";
import { ThemeProvider } from "../../lib/theme";
import { trackFieldSelection } from "../support/amountFieldSelection";
import { breastEntry, chickenEntry } from "../support/entries";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { PortionPickerProps } from "../../components/PortionPicker";

// The picker as a component, the way the edit screen and Recent will use it: the amount, the unit and the time
// are its inputs, and Add is the one part that belongs to adding.

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
const box = buildFoodPortion({
  id: "44444444-4444-4444-8444-444444444444",
  food_id: savedFoodId,
  label: "Box of 6",
  grams: 270,
  position: 1,
});

type AddProps = Extract<PortionPickerProps, { mode: "add" }>;
type EditProps = Extract<PortionPickerProps, { mode: "edit" }>;

async function renderPicker(props: Partial<Omit<AddProps, "mode">> = {}) {
  const onSubmit = jest.fn();
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <PortionPicker
        food={foodFixture}
        hasSaveError={false}
        isNow
        isSaving={false}
        mode="add"
        portions={[bar, box]}
        time="12:40"
        onBack={() => undefined}
        onCopy={() => undefined}
        onSubmit={onSubmit}
        {...props}
      />
    </ThemeProvider>,
  );
  return { user, onSubmit };
}

async function renderEditPicker(props: Partial<Omit<EditProps, "mode">> = {}) {
  const onSubmit = jest.fn();
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <PortionPicker
        food={foodFixture}
        hasSaveError={false}
        isNow={false}
        isSaving={false}
        mode="edit"
        snapshot={chickenEntry().snapshot}
        time="12:40"
        onBack={() => undefined}
        onDelete={() => undefined}
        onSubmit={onSubmit}
        {...props}
      />
    </ThemeProvider>,
  );
  return { user, onSubmit };
}

describe("PortionPicker as a component", () => {
  const amountField = trackFieldSelection();
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  describe("an amount to start at", () => {
    it("should start at the amount it is given in place of the default serving", async () => {
      await renderPicker({ initialAmount: { unit: "g", quantity: 50 } });

      expect(screen.getByLabelText("Amount (g)")).toHaveDisplayValue("50");
      expect(screen.getByRole("radio", { name: "g", checked: true })).toBeOnTheScreen();
      expect(screen.getByLabelText("Energy and macros, For 50 g")).toBeOnTheScreen();
    });

    it("should start at a count of a portion", async () => {
      await renderPicker({
        initialAmount: { unit: "portion", quantity: 2, portion: box },
      });

      expect(screen.getByLabelText("Amount (box of 6)")).toHaveDisplayValue("2");
      expect(screen.getByRole("radio", { name: "Box of 6", checked: true })).toBeOnTheScreen();
    });
  });

  describe("a note", () => {
    it("should be drawn beside the food's source when given", async () => {
      await renderPicker({ note: "Last logged 50 g, yesterday" });

      expect(screen.getByText("Last logged 50 g, yesterday")).toBeOnTheScreen();
    });

    it("should leave the line out when there is none", async () => {
      await renderPicker();

      expect(screen.queryByText(/Last logged/)).not.toBeOnTheScreen();
    });
  });

  describe("choosing a unit puts the cursor in the amount", () => {
    it("should focus nothing when the picker is drawn", async () => {
      await renderPicker();

      expect(amountField.focus).not.toHaveBeenCalled();
      expect(amountField.setSelection).not.toHaveBeenCalled();
    });

    it("should focus the amount and select the whole of the new unit's starting amount when a chip is pressed", async () => {
      const { user } = await renderPicker();

      await user.press(screen.getByRole("radio", { name: "g" }));

      expect(screen.getByLabelText("Amount (g)")).toHaveDisplayValue("100");
      expect(amountField.focus).toHaveBeenCalledTimes(1);
      expect(amountField.setSelection).toHaveBeenCalledTimes(1);
      expect(amountField.setSelection).toHaveBeenCalledWith(0, "100".length);
      expect(amountField.focusedThenSelected()).toBe(true);
    });

    it("should select the one of a portion when a portion chip is pressed after grams", async () => {
      const { user } = await renderPicker({ initialAmount: { unit: "g", quantity: 250 } });

      await user.press(screen.getByRole("radio", { name: "Box of 6" }));

      expect(screen.getByLabelText("Amount (box of 6)")).toHaveDisplayValue("1");
      expect(amountField.setSelection).toHaveBeenLastCalledWith(0, 1);
    });

    it("should do the same when the chosen chip is pressed again, over the amount as it stands", async () => {
      const { user } = await renderPicker({ initialAmount: { unit: "g", quantity: 50 } });

      await user.press(screen.getByRole("radio", { name: "g" }));

      expect(screen.getByLabelText("Amount (g)")).toHaveDisplayValue("50");
      expect(amountField.focus).toHaveBeenCalledTimes(1);
      expect(amountField.setSelection).toHaveBeenCalledWith(0, "50".length);
    });

    it("should select again on each press of a chip", async () => {
      const { user } = await renderPicker();

      await user.press(screen.getByRole("radio", { name: "g" }));
      await user.press(screen.getByRole("radio", { name: "g" }));

      expect(amountField.focus).toHaveBeenCalledTimes(2);
      expect(amountField.setSelection).toHaveBeenCalledTimes(2);
    });

    it("should do the same for a logged entry", async () => {
      const { user } = await renderEditPicker({ snapshot: breastEntry().snapshot });

      await user.press(screen.getByRole("radio", { name: "g" }));

      expect(screen.getByLabelText("Amount (g)")).toHaveDisplayValue("100");
      expect(amountField.focus).toHaveBeenCalledTimes(1);
      expect(amountField.setSelection).toHaveBeenCalledWith(0, "100".length);
    });

    it("should do the same for a food that has to be copied before it can be logged", async () => {
      const { user } = await renderPicker({ food: { ...foodFixture, carbs_g: null } });

      expect(screen.getByRole("button", { name: "Copy to your foods" })).toBeOnTheScreen();
      await user.press(screen.getByRole("radio", { name: "g" }));

      expect(amountField.focus).toHaveBeenCalledTimes(1);
      expect(amountField.setSelection).toHaveBeenCalledWith(0, "100".length);
    });

    it("should not announce anything to a screen reader", async () => {
      const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
      const setFocus = jest.spyOn(AccessibilityInfo, "setAccessibilityFocus");
      const { user } = await renderPicker();

      await user.press(screen.getByRole("radio", { name: "g" }));

      expect(announce).not.toHaveBeenCalled();
      expect(setFocus).not.toHaveBeenCalled();
    });
  });

  describe("Add", () => {
    it("should hand over the amount, the unit and the time the row shows", async () => {
      const { user, onSubmit } = await renderPicker({ time: "12:00", isNow: false });

      await user.press(screen.getByRole("button", { name: "Add" }));

      expect(onSubmit).toHaveBeenCalledWith({
        unit: "portion",
        quantity: 1,
        portion: bar,
        time: "12:00",
        isNow: false,
      });
    });

    it("should say the time is still now when the row still reads Now", async () => {
      const { user, onSubmit } = await renderPicker();

      await user.press(screen.getByRole("button", { name: "Add" }));

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ time: "12:40", isNow: true }),
      );
    });

    it("should still be pressable while the notice for a failed save is up, to try again", async () => {
      const { user, onSubmit } = await renderPicker({ hasSaveError: true });

      await user.press(screen.getByRole("button", { name: "Add" }));

      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  describe("offline", () => {
    it("should turn Add off while the connection is lost", async () => {
      await renderPicker({ isOnline: false });

      expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    });

    it("should have Add on while it is not said to be lost", async () => {
      await renderPicker();

      expect(screen.getByRole("button", { name: "Add" })).toBeEnabled();
    });
  });

  describe("for a logged entry", () => {
    const onDelete = jest.fn();

    beforeEach(() => {
      onDelete.mockReset();
    });

    it("should offer Save with a Delete under it, in place of Add", async () => {
      await renderEditPicker({ onDelete });

      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Delete" })).toBeEnabled();
      expect(screen.queryByRole("button", { name: "Add" })).not.toBeOnTheScreen();
    });

    it("should hand over the amount, the unit and the entry's own time on Save", async () => {
      const { user, onSubmit } = await renderEditPicker({
        onDelete,
        time: "12:40",
      });

      await user.press(screen.getByRole("button", { name: "Save" }));

      expect(onSubmit).toHaveBeenCalledWith({
        unit: "g",
        quantity: 150,
        time: "12:40",
        isNow: false,
      });
    });

    it("should delete when Delete is pressed", async () => {
      const { user } = await renderEditPicker({ onDelete });

      await user.press(screen.getByRole("button", { name: "Delete" }));

      expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it("should keep Save off for an amount that is not above 0", async () => {
      const { user } = await renderEditPicker({ onDelete });

      await user.clear(screen.getByLabelText("Amount (g)"));

      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    });

    it("should turn Save and Delete off while the connection is lost", async () => {
      await renderEditPicker({ onDelete, isOnline: false });

      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    });

    it("should not ask for a review of a food with a value missing, which an entry keeps as saved", async () => {
      await renderEditPicker({
        onDelete,
        food: { ...foodFixture, carbs_g: null },
      });

      expect(screen.queryByText("Needs review")).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Copy to your foods" })).not.toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
      expect(screen.getByRole("button", { name: /^Time/ })).toBeOnTheScreen();
    });
  });

  describe("a notice and a caption", () => {
    it("should draw the banner it is given above the hero, and the caption under the note", async () => {
      await renderEditPicker({
        banner: <Text>Banner words</Text>,
        caption: "Caption words",
      });

      expect(screen.getByText("Banner words")).toBeOnTheScreen();
      expect(screen.getByText("Caption words")).toBeOnTheScreen();
    });

    it("should draw neither when there are none", async () => {
      await renderEditPicker();

      expect(screen.queryByText("Banner words")).not.toBeOnTheScreen();
    });
  });
});
