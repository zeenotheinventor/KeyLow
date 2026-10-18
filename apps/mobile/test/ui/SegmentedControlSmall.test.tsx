import { render, screen, userEvent } from "@testing-library/react-native";
import { impactAsync } from "expo-haptics";
import { useState } from "react";
import { setUpTests } from "react-native-reanimated";

import { SegmentedControl } from "../../components/ui";
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

type MuscleRole = "primary" | "second" | "assist";

const roleOptions = [
  { value: "primary", label: "Primary" },
  { value: "second", label: "Second" },
  { value: "assist", label: "Assist" },
] as const;

type Side = "front" | "back";

const sideOptions = [
  { value: "front", label: "Front" },
  { value: "back", label: "Back" },
] as const;

const scaleOptions = [
  { value: "heat", label: "Heat" },
  { value: "volume", label: "Volume" },
  { value: "gap", label: "Gap" },
  { value: "load", label: "Load" },
] as const;

function renderRoles(
  {
    value,
    onChange,
    size = "sm",
  }: { value: MuscleRole; onChange?: (value: MuscleRole) => void; size?: "md" | "sm" },
  scheme: ThemeScheme = "dark",
) {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <SegmentedControl
        label="Role for Side delts"
        options={roleOptions}
        size={size}
        value={value}
        onChange={onChange ?? (() => undefined)}
      />
    </ThemeProvider>,
  );
}

function KeptSide() {
  const [value, setValue] = useState<Side>("front");
  return (
    <ThemeProvider fixedPreference="dark">
      <SegmentedControl
        label="Side shown"
        options={sideOptions}
        size="sm"
        value={value}
        onChange={setValue}
      />
    </ThemeProvider>
  );
}

const schemes: ThemeScheme[] = ["dark", "light"];

describe("SegmentedControl in the small size", () => {
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
      await renderRoles({ value: "primary" });

      expect(screen.getByLabelText("Role for Side delts")).toHaveProp("role", "radiogroup");
    });

    it("should hold three options, each a radio named by its words", async () => {
      await renderRoles({ value: "primary" });

      const [primary, second, assist] = screen.getAllByRole("radio");
      expect(primary).toHaveAccessibleName("Primary");
      expect(second).toHaveAccessibleName("Second");
      expect(assist).toHaveAccessibleName("Assist");
    });

    it("should hold two options", async () => {
      await render(<KeptSide />);

      expect(screen.getAllByRole("radio")).toHaveLength(2);
      expect(screen.getByRole("radio", { name: "Front" })).toBeChecked();
      expect(screen.getByRole("radio", { name: "Back" })).not.toBeChecked();
    });

    it("should hold four options", async () => {
      await render(
        <ThemeProvider fixedPreference="dark">
          <SegmentedControl
            label="Scale"
            options={scaleOptions}
            size="sm"
            value="gap"
            onChange={() => undefined}
          />
        </ThemeProvider>,
      );

      expect(screen.getAllByRole("radio")).toHaveLength(4);
      expect(screen.getByRole("radio", { name: "Gap" })).toBeChecked();
      expect(screen.getByRole("radio", { name: "Load" })).not.toBeChecked();
    });

    it("should reach the 44 point touch target past its 30 point segments", async () => {
      await renderRoles({ value: "primary" });

      for (const segment of screen.getAllByRole("radio")) {
        expect(segment).toHaveProp("hitSlop", { top: 7, bottom: 7 });
      }
    });
  });

  describe("choosing", () => {
    it("should hand on the value of the option that is pressed", async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      await renderRoles({ value: "primary", onChange });

      await user.press(screen.getByRole("radio", { name: "Assist" }));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith("assist");
      expect(mockImpact).toHaveBeenCalledWith("light");
    });

    it("should do nothing when the chosen option is pressed again", async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      await renderRoles({ value: "primary", onChange });

      await user.press(screen.getByRole("radio", { name: "Primary" }));

      expect(onChange).not.toHaveBeenCalled();
      expect(mockImpact).not.toHaveBeenCalled();
    });

    it("should move the choice at once when a screen keeps it", async () => {
      const user = userEvent.setup();
      await render(<KeptSide />);

      await user.press(screen.getByRole("radio", { name: "Back" }));

      expect(screen.getByRole("radio", { name: "Back" })).toBeChecked();
      expect(screen.getByRole("radio", { name: "Front" })).not.toBeChecked();
    });
  });

  describe.each(schemes)("in the %s scheme", (scheme) => {
    it("should be a 36 point track, the small control height, with a hairline border padded 2 inside it", async () => {
      await renderRoles({ value: "primary" }, scheme);
      await screen.findByLabelText("Role for Side delts");

      const [track] = viewsDrawn({
        height: 36,
        backgroundColor: resolvedColor(scheme, "surface-raised"),
        borderColor: resolvedColor(scheme, "border"),
        borderWidth: 1,
        borderRadius: 12,
      });
      expect(track).toHaveStyle({ flexDirection: "row", padding: 2 });
    });

    it("should draw each segment 30 points high, the chosen one filled as the medium size is", async () => {
      await renderRoles({ value: "primary" }, scheme);
      await screen.findByLabelText("Role for Side delts");

      expect(viewsDrawn({ height: 30, borderRadius: 9 })).toHaveLength(3);
      expect(
        viewsDrawn({
          height: 30,
          backgroundColor: resolvedColor(scheme, "text-primary"),
          borderRadius: 9,
        }),
      ).toHaveLength(1);
      expect(screen.getByText("Primary")).toHaveStyle({
        color: resolvedColor(scheme, "background"),
      });
      expect(screen.getByText("Second")).toHaveStyle({
        color: resolvedColor(scheme, "text-secondary"),
      });
    });

    it("should set each label in Geist semibold at 12 over 20 with 4 points either side", async () => {
      await renderRoles({ value: "primary" }, scheme);

      expect(await screen.findByText("Second")).toHaveStyle({
        fontFamily: "Geist-SemiBold",
        fontSize: 12,
        lineHeight: 20,
      });
      expect(viewsDrawn({ height: 30 })[0]).toHaveStyle({ paddingLeft: 4, paddingRight: 4 });
    });

    it("should keep the medium size as it was when the size is asked for by name", async () => {
      await renderRoles({ value: "primary", size: "md" }, scheme);
      await screen.findByLabelText("Role for Side delts");

      expect(viewsDrawn({ height: 44, borderRadius: 12, borderWidth: 1 })).toHaveLength(1);
      expect(viewsDrawn({ height: 36, borderRadius: 9 })).toHaveLength(3);
      expect(screen.getByText("Second")).toHaveStyle({ fontSize: 14 });
      expect(screen.getByRole("radio", { name: "Second" })).toHaveProp("hitSlop", {
        top: 4,
        bottom: 4,
      });
    });
  });
});
