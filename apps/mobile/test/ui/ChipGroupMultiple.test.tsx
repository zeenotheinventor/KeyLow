import { render, screen, userEvent } from "@testing-library/react-native";
import { impactAsync } from "expo-haptics";
import { useState } from "react";
import { setUpTests } from "react-native-reanimated";

import { ChipGroup } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";
import { viewsDrawn } from "../support/viewsDrawn";

import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const mockImpact = jest.mocked(impactAsync);

type Equipment = "barbell" | "dumbbell" | "cable" | "machine";

const equipmentOptions = [
  { value: "barbell", label: "Barbell" },
  { value: "dumbbell", label: "Dumbbell" },
  { value: "cable", label: "Cable" },
  { value: "machine", label: "Machine" },
] as const;

function renderEquipment(
  {
    value,
    onChange,
    layout,
  }: {
    value: readonly Equipment[];
    onChange?: (next: Equipment[]) => void;
    layout?: "scroll" | "wrap";
  },
  scheme: ThemeScheme = "dark",
) {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <ChipGroup
        label="Equipment"
        layout={layout}
        options={equipmentOptions}
        selection="multiple"
        value={value}
        onChange={onChange ?? (() => undefined)}
      />
    </ThemeProvider>,
  );
}

// A screen that keeps the choices, as the equipment question does.
function KeptEquipment() {
  const [value, setValue] = useState<Equipment[]>(["barbell", "cable"]);
  return (
    <ThemeProvider fixedPreference="dark">
      <ChipGroup
        label="Equipment"
        options={equipmentOptions}
        selection="multiple"
        value={value}
        onChange={setValue}
      />
    </ThemeProvider>
  );
}

const schemes: ThemeScheme[] = ["dark", "light"];

describe("ChipGroup with several chosen", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    mockImpact.mockClear();
  });

  describe("what it says", () => {
    it("should be a group named by its label, not a radio group", async () => {
      await renderEquipment({ value: [] });

      expect(screen.getByLabelText("Equipment")).toHaveProp("role", "group");
    });

    it("should hold one checkbox for each option, named by the option, and no radios", async () => {
      await renderEquipment({ value: [] });

      expect(screen.getAllByRole("checkbox")).toHaveLength(4);
      expect(screen.queryAllByRole("radio")).toHaveLength(0);
      expect(screen.getByRole("checkbox", { name: "Barbell" })).toBeOnTheScreen();
      expect(screen.getByRole("checkbox", { name: "Machine" })).toBeOnTheScreen();
    });

    it("should check each chosen option and no other", async () => {
      await renderEquipment({ value: ["barbell", "cable"] });

      expect(screen.getByRole("checkbox", { name: "Barbell" })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: "Cable" })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: "Dumbbell" })).not.toBeChecked();
      expect(screen.getByRole("checkbox", { name: "Machine" })).not.toBeChecked();
    });

    it("should check none of them when nothing is chosen", async () => {
      await renderEquipment({ value: [] });

      for (const chip of screen.getAllByRole("checkbox")) {
        expect(chip).not.toBeChecked();
      }
    });

    it("should be checkboxes in the wrap layout too, in a group that wraps", async () => {
      await renderEquipment({ value: ["cable"], layout: "wrap" });

      expect(screen.getByLabelText("Equipment")).toHaveProp("role", "group");
      expect(screen.getByLabelText("Equipment")).not.toHaveProp("horizontal");
      expect(screen.getByRole("checkbox", { name: "Cable" })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: "Cable" })).toHaveProp("hitSlop", {
        top: 4,
        bottom: 4,
      });
    });

    it("should scroll sideways by default, as a single choice does", async () => {
      await renderEquipment({ value: [] });

      expect(screen.getByLabelText("Equipment")).toHaveProp("horizontal", true);
    });
  });

  describe("choosing", () => {
    it("should add a pressed chip to the chosen ones and leave the others as they were", async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      await renderEquipment({ value: ["barbell", "cable"], onChange });

      await user.press(screen.getByRole("checkbox", { name: "Machine" }));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(["barbell", "cable", "machine"]);
    });

    it("should take only the pressed chip out when it is chosen, keeping the others in order", async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      await renderEquipment({ value: ["barbell", "dumbbell", "cable"], onChange });

      await user.press(screen.getByRole("checkbox", { name: "Dumbbell" }));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(["barbell", "cable"]);
    });

    it("should allow the last chosen chip to be taken out, leaving none", async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      await renderEquipment({ value: ["cable"], onChange });

      await user.press(screen.getByRole("checkbox", { name: "Cable" }));

      expect(onChange).toHaveBeenCalledWith([]);
    });

    it("should play the selection haptic both when a chip is added and when it is taken out", async () => {
      const user = userEvent.setup();
      await renderEquipment({ value: ["cable"] });

      await user.press(screen.getByRole("checkbox", { name: "Machine" }));
      await user.press(screen.getByRole("checkbox", { name: "Cable" }));

      expect(mockImpact).toHaveBeenCalledTimes(2);
      expect(mockImpact).toHaveBeenCalledWith("light");
    });

    it("should move only the pressed check when a screen keeps the choices", async () => {
      const user = userEvent.setup();
      await render(<KeptEquipment />);

      await user.press(screen.getByRole("checkbox", { name: "Machine" }));
      await user.press(screen.getByRole("checkbox", { name: "Barbell" }));

      expect(screen.getByRole("checkbox", { name: "Machine" })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: "Cable" })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: "Barbell" })).not.toBeChecked();
      expect(screen.getByRole("checkbox", { name: "Dumbbell" })).not.toBeChecked();
    });
  });

  describe.each(schemes)("in the %s scheme", (scheme) => {
    it("should draw each chosen chip filled with the accent, as a single choice does", async () => {
      await renderEquipment({ value: ["barbell", "cable"] }, scheme);
      await screen.findByLabelText("Equipment");

      expect(
        viewsDrawn({
          height: 36,
          backgroundColor: resolvedColor(scheme, "accent"),
          borderColor: resolvedColor(scheme, "accent"),
        }),
      ).toHaveLength(2);
      expect(screen.getByText("Cable")).toHaveStyle({
        color: resolvedColor(scheme, "accent-foreground"),
        fontFamily: "Geist-SemiBold",
      });
    });
  });
});
