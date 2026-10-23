import { cleanup, render, screen, userEvent, within } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { SetTypeSheet } from "../components/SetTypeSheet";
import { ThemeProvider } from "../lib/theme";
import { compileKitStyles } from "./support/kitStyles";
import { expectAccessibleNamesInOrder } from "./support/namesInOrder";
import { registerAppStyles } from "./support/nativeWindStyles";
import { resolvedColor } from "./support/themeColor";

import type { SetTypeSheetProps } from "../components/SetTypeSheet";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const frame = { x: 0, y: 0, width: 390, height: 844 };
const insets = { top: 47, right: 0, bottom: 34, left: 0 };

// The `session · set-types` board: Barbell squat, set 1, working.
const boardProps: SetTypeSheetProps = {
  open: true,
  exerciseName: "Barbell squat",
  setType: "working",
  setNumber: 1,
  onChoose: jest.fn(),
  onClose: jest.fn(),
};

async function renderSheet(props: Partial<SetTypeSheetProps> = {}) {
  const onChoose = props.onChoose ?? jest.fn();
  const onClose = props.onClose ?? jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={{ frame, insets }}>
      <ThemeProvider fixedPreference="dark">
        <SetTypeSheet {...boardProps} {...props} onChoose={onChoose} onClose={onClose} />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  return { onChoose, onClose };
}

// The role query does not resolve a radiogroup, so the group is found by its name and checked for its role.
const choices = () => within(screen.getByLabelText("Set type"));

describe("the set types sheet", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/SetTypeSheet"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanup();
  });

  describe("opened on the board's working set", () => {
    it("should be a dialog named for the exercise and the set, with the Set type heading and line", async () => {
      await renderSheet();

      expect(screen.getByLabelText("Set type, barbell squat set 1")).toHaveProp("role", "dialog");
      expect(screen.getByRole("heading", { name: "Set type" })).toBeOnTheScreen();
      expect(
        screen.getByText("Barbell squat · set 1 · tap the set number to change it"),
      ).toBeOnTheScreen();
    });

    it("should hold the four types as radios in a radiogroup named Set type", async () => {
      await renderSheet();

      expect(screen.getByLabelText("Set type")).toHaveProp("role", "radiogroup");
      expectAccessibleNamesInOrder(choices().getAllByRole("radio"), [
        "Warm-up. Never counts toward heat or weekly sets.",
        "Working. Counts by its effort. Left without RIR, it counts as hard.",
        "Drop. A lighter set straight after. Counts like a working set.",
        "Failure. Taken to failure. Counts like a working set.",
      ]);
    });

    it("should check the current type and no other", async () => {
      await renderSheet();

      expect(choices().getByRole("radio", { name: /^Working\./ })).toBeChecked();
      expect(choices().getByRole("radio", { name: /^Warm-up\./ })).not.toBeChecked();
      expect(choices().getByRole("radio", { name: /^Drop\./ })).not.toBeChecked();
      expect(choices().getByRole("radio", { name: /^Failure\./ })).not.toBeChecked();
    });

    it("should draw the chosen row with the accent border and the other rows with the plain border, 60 points high at least", async () => {
      await renderSheet();

      const chosen = choices().getByRole("radio", { name: /^Working\./ });
      const other = choices().getByRole("radio", { name: /^Drop\./ });
      expect(chosen).toHaveStyle({
        borderColor: resolvedColor("dark", "accent"),
        minHeight: 60,
        borderWidth: 1,
      });
      expect(other).toHaveStyle({ borderColor: resolvedColor("dark", "border") });
    });

    it("should draw each row's mark: W, the number the set has as a working set, D and F", async () => {
      await renderSheet({ setNumber: 3 });

      expect(
        within(choices().getByRole("radio", { name: /^Warm-up\./ })).getByText("W"),
      ).toBeOnTheScreen();
      expect(
        within(choices().getByRole("radio", { name: /^Working\./ })).getByText("3"),
      ).toBeOnTheScreen();
      expect(
        within(choices().getByRole("radio", { name: /^Drop\./ })).getByText("D"),
      ).toBeOnTheScreen();
      expect(
        within(choices().getByRole("radio", { name: /^Failure\./ })).getByText("F"),
      ).toBeOnTheScreen();
    });
  });

  describe("opened on a warm-up", () => {
    it("should check Warm-up and name the sheet by the warm-up", async () => {
      await renderSheet({ setType: "warmup", setNumber: 1 });

      expect(screen.getByLabelText("Set type, barbell squat warm-up set")).toHaveProp(
        "role",
        "dialog",
      );
      expect(choices().getByRole("radio", { name: /^Warm-up\./ })).toBeChecked();
      expect(choices().getByRole("radio", { name: /^Working\./ })).not.toBeChecked();
    });
  });

  describe("choosing", () => {
    it("should hand the chosen type to the screen", async () => {
      const user = userEvent.setup();
      const { onChoose } = await renderSheet();

      await user.press(choices().getByRole("radio", { name: /^Warm-up\./ }));

      expect(onChoose).toHaveBeenCalledTimes(1);
      expect(onChoose).toHaveBeenCalledWith("warmup");
    });

    it("should hand over the checked type too, so the screen decides that nothing changed", async () => {
      const user = userEvent.setup();
      const { onChoose } = await renderSheet();

      await user.press(choices().getByRole("radio", { name: /^Working\./ }));

      expect(onChoose).toHaveBeenCalledWith("working");
    });
  });
});
