import { render, screen, userEvent } from "@testing-library/react-native";
import { impactAsync } from "expo-haptics";
import { setUpTests } from "react-native-reanimated";

import { ChipGroup } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { viewsDrawn } from "../support/viewsDrawn";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const mockImpact = jest.mocked(impactAsync);

type Equipment = "barbell" | "dumbbell" | "cable" | "machine" | "bodyweight" | "other";

const equipmentOptions = [
  { value: "barbell", label: "Barbell" },
  { value: "dumbbell", label: "Dumbbell" },
  { value: "cable", label: "Cable" },
  { value: "machine", label: "Machine" },
  { value: "bodyweight", label: "Bodyweight" },
  { value: "other", label: "Other" },
] as const;

function renderEquipment({
  value,
  onChange,
  layout = "wrap",
}: {
  value: Equipment | null;
  onChange?: (value: Equipment) => void;
  layout?: "scroll" | "wrap";
}) {
  return render(
    <ThemeProvider fixedPreference="dark">
      <ChipGroup
        label="Equipment"
        layout={layout}
        options={equipmentOptions}
        value={value}
        onChange={onChange ?? (() => undefined)}
      />
    </ThemeProvider>,
  );
}

describe("ChipGroup in the wrap layout", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    mockImpact.mockClear();
  });

  describe("what it says", () => {
    it("should still be a radio group named by its label", async () => {
      await renderEquipment({ value: "cable" });

      expect(screen.getByLabelText("Equipment")).toHaveProp("role", "radiogroup");
    });

    it("should hold one radio for each option, named by the option", async () => {
      await renderEquipment({ value: "cable" });

      expect(screen.getAllByRole("radio")).toHaveLength(6);
      expect(screen.getByRole("radio", { name: "Barbell" })).toBeOnTheScreen();
      expect(screen.getByRole("radio", { name: "Bodyweight" })).toBeOnTheScreen();
    });

    it("should say which option is checked, and only that one", async () => {
      await renderEquipment({ value: "cable" });

      expect(screen.getByRole("radio", { name: "Cable" })).toBeChecked();
      expect(screen.getByRole("radio", { name: "Barbell" })).not.toBeChecked();
    });
  });

  describe("how it is laid out", () => {
    it("should wrap onto further lines instead of scrolling sideways", async () => {
      await renderEquipment({ value: "cable" });

      const group = screen.getByLabelText("Equipment");
      expect(group).not.toHaveProp("horizontal");
      expect(group).toHaveStyle({ flexDirection: "row", flexWrap: "wrap" });
    });

    it("should leave 8 points between the chips and between the lines", async () => {
      await renderEquipment({ value: "cable" });

      expect(await screen.findByLabelText("Equipment")).toHaveStyle({ rowGap: 8, columnGap: 8 });
    });

    it("should scroll sideways when the scroll layout is asked for by name", async () => {
      await renderEquipment({ value: "cable", layout: "scroll" });

      expect(screen.getByLabelText("Equipment")).toHaveProp("horizontal", true);
    });

    it("should keep the 36 point chip as it is drawn in the scroll layout", async () => {
      await renderEquipment({ value: "cable" });
      await screen.findByLabelText("Equipment");

      expect(viewsDrawn({ height: 36, borderRadius: 999, borderWidth: 1 })).toHaveLength(6);
    });

    it("should reach the 44 point touch target past each 36 point chip", async () => {
      await renderEquipment({ value: "cable" });

      // The lines are 8 points apart, so 4 points above and below each chip meet and never overlap.
      for (const chip of screen.getAllByRole("radio")) {
        expect(chip).toHaveProp("hitSlop", { top: 4, bottom: 4 });
      }
    });

    it("should not clip the touch target with padding, as the scroll layout does", async () => {
      await renderEquipment({ value: "cable" });

      expect(screen.getByLabelText("Equipment")).not.toHaveProp("contentContainerStyle");
    });
  });

  describe("choosing", () => {
    it("should hand on the value of the chip that is pressed and play the selection haptic", async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      await renderEquipment({ value: "cable", onChange });

      await user.press(screen.getByRole("radio", { name: "Machine" }));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith("machine");
      expect(mockImpact).toHaveBeenCalledWith("light");
    });

    it("should do nothing when the checked chip is pressed again", async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      await renderEquipment({ value: "cable", onChange });

      await user.press(screen.getByRole("radio", { name: "Cable" }));

      expect(onChange).not.toHaveBeenCalled();
      expect(mockImpact).not.toHaveBeenCalled();
    });
  });
});
