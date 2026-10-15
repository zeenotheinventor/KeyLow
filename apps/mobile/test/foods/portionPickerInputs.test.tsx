import "react-native-gesture-handler/jestSetup";

import { buildFoodPortion } from "@keylow/core/testing";
import { render, screen, userEvent } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { foodFixture, savedFoodId } from "./support/apiClientMock";
import { PortionPicker } from "../../components/PortionPicker";
import { ThemeProvider } from "../../lib/theme";
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

async function renderPicker(props: Partial<PortionPickerProps> = {}) {
  const onSubmit = jest.fn();
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <PortionPicker
        food={foodFixture}
        hasSaveError={false}
        isNow
        isSaving={false}
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

describe("PortionPicker as a component", () => {
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

      expect(screen.getByLabelText("Amount (portions)")).toHaveDisplayValue("2");
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
});
