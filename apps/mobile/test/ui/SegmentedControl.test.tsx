import { render, screen, userEvent } from "@testing-library/react-native";
import { impactAsync } from "expo-haptics";
import { useState } from "react";
import { Dimensions, Platform, StyleSheet } from "react-native";
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

type Basis = "per-100-g" | "per-100-ml";

const basisOptions = [
  { value: "per-100-g", label: "Per 100 g" },
  { value: "per-100-ml", label: "Per 100 ml" },
] as const;

type Appearance = "dark" | "light" | "system";

const appearanceOptions = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "Match device" },
] as const;

function renderBasis(
  { value, onChange }: { value: Basis; onChange?: (value: Basis) => void },
  scheme: ThemeScheme = "dark",
) {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <SegmentedControl
        label="Nutrition basis"
        options={basisOptions}
        value={value}
        onChange={onChange ?? (() => undefined)}
      />
    </ThemeProvider>,
  );
}

// A screen that keeps the choice, as More does for the appearance.
function AppearanceChoice() {
  const [value, setValue] = useState<Appearance>("dark");
  return (
    <ThemeProvider fixedPreference="dark">
      <SegmentedControl
        label="Appearance"
        options={appearanceOptions}
        value={value}
        onChange={setValue}
      />
    </ThemeProvider>
  );
}

const schemes: ThemeScheme[] = ["dark", "light"];

describe("SegmentedControl", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    mockImpact.mockClear();
  });

  describe("what it says", () => {
    it("should be a radio group named by its label", async () => {
      await renderBasis({ value: "per-100-g" });

      expect(screen.getByLabelText("Nutrition basis")).toHaveProp("role", "radiogroup");
    });

    it("should hold one radio for each option, named by the option", async () => {
      await renderBasis({ value: "per-100-g" });

      expect(screen.getAllByRole("radio")).toHaveLength(2);
      expect(screen.getByRole("radio", { name: "Per 100 g" })).toBeOnTheScreen();
      expect(screen.getByRole("radio", { name: "Per 100 ml" })).toBeOnTheScreen();
    });

    it("should say which option is chosen, and only that one", async () => {
      await renderBasis({ value: "per-100-ml" });

      expect(screen.getByRole("radio", { name: "Per 100 ml" })).toBeChecked();
      expect(screen.getByRole("radio", { name: "Per 100 g" })).not.toBeChecked();
    });

    it("should hold three options as the appearance choice does", async () => {
      await render(<AppearanceChoice />);

      const [dark, light, system] = screen.getAllByRole("radio");
      expect(dark).toHaveAccessibleName("Dark");
      expect(light).toHaveAccessibleName("Light");
      expect(system).toHaveAccessibleName("Match device");
    });

    it("should reach the 44 point touch target past its 36 point segments", async () => {
      await renderBasis({ value: "per-100-g" });

      expect(screen.getByRole("radio", { name: "Per 100 g" })).toHaveProp("hitSlop", {
        top: 4,
        bottom: 4,
      });
    });

    it("should keep each label to one line however large the text is", async () => {
      await render(<AppearanceChoice />);

      const label = screen.getByText("Match device");
      expect(label).toHaveProp("numberOfLines", 1);
      expect(label).toHaveProp("maxFontSizeMultiplier", 1.2);
    });
  });

  // Android multiplies a line height by the whole font scale even where it caps the font size, so the line
  // is given divided by the scale, and iOS caps both itself. The 36 point segment holds the capped 24.
  describe("the line height at large text", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it.each([
      { os: "ios", fontScale: 1, lineHeight: 20 },
      { os: "ios", fontScale: 2, lineHeight: 20 },
      { os: "android", fontScale: 1, lineHeight: 20 },
      { os: "android", fontScale: 1.2, lineHeight: 20 },
      { os: "android", fontScale: 2, lineHeight: 12 },
    ] as const)(
      "should give the label a $lineHeight point line height on $os at font scale $fontScale",
      async ({ os, fontScale, lineHeight }) => {
        jest.replaceProperty(Platform, "OS", os);
        jest
          .spyOn(Dimensions, "get")
          .mockReturnValue({ width: 411, height: 914, scale: 2.625, fontScale });
        await renderBasis({ value: "per-100-g" });

        const label = await screen.findByText("Per 100 g");
        const style: unknown = StyleSheet.flatten(label.props.style);
        const drawn: unknown =
          typeof style === "object" && style !== null
            ? Object.getOwnPropertyDescriptor(style, "lineHeight")?.value
            : undefined;
        expect(drawn).toBeCloseTo(lineHeight, 5);
      },
    );
  });

  describe("choosing", () => {
    it("should hand on the value of the option that is pressed", async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      await renderBasis({ value: "per-100-g", onChange });

      await user.press(screen.getByRole("radio", { name: "Per 100 ml" }));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith("per-100-ml");
    });

    it("should play the selection haptic when the choice changes", async () => {
      const user = userEvent.setup();
      await renderBasis({ value: "per-100-g" });

      await user.press(screen.getByRole("radio", { name: "Per 100 ml" }));

      expect(mockImpact).toHaveBeenCalledTimes(1);
      expect(mockImpact).toHaveBeenCalledWith("light");
    });

    it("should do nothing when the chosen option is pressed again", async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      await renderBasis({ value: "per-100-g", onChange });

      await user.press(screen.getByRole("radio", { name: "Per 100 g" }));

      expect(onChange).not.toHaveBeenCalled();
      expect(mockImpact).not.toHaveBeenCalled();
    });

    it("should move the choice at once when a screen keeps it", async () => {
      const user = userEvent.setup();
      await render(<AppearanceChoice />);

      await user.press(screen.getByRole("radio", { name: "Match device" }));

      expect(screen.getByRole("radio", { name: "Match device" })).toBeChecked();
      expect(screen.getByRole("radio", { name: "Dark" })).not.toBeChecked();
    });
  });

  describe.each(schemes)("in the %s scheme", (scheme) => {
    const colorOf = (name: Parameters<typeof resolvedColor>[1]) => resolvedColor(scheme, name);

    it("should be a 44 point track on the raised surface with a hairline border, padded 3 inside it", async () => {
      await renderBasis({ value: "per-100-g" }, scheme);
      await screen.findByLabelText("Nutrition basis");

      const [track] = viewsDrawn({
        height: 44,
        backgroundColor: colorOf("surface-raised"),
        borderColor: colorOf("border"),
        borderWidth: 1,
        borderRadius: 12,
      });
      expect(track).toHaveStyle({ flexDirection: "row", padding: 3 });
    });

    it("should fill the chosen segment with the primary text colour and write on it in the background colour", async () => {
      await renderBasis({ value: "per-100-g" }, scheme);
      await screen.findByLabelText("Nutrition basis");

      expect(
        viewsDrawn({ height: 36, backgroundColor: colorOf("text-primary"), borderRadius: 9 }),
      ).toHaveLength(1);
      expect(screen.getByText("Per 100 g")).toHaveStyle({ color: colorOf("background") });
    });

    it("should leave the other segment clear and write on it in secondary text", async () => {
      await renderBasis({ value: "per-100-g" }, scheme);
      await screen.findByLabelText("Nutrition basis");

      expect(viewsDrawn({ height: 36, borderRadius: 9 })).toHaveLength(2);
      expect(screen.getByText("Per 100 ml")).toHaveStyle({ color: colorOf("text-secondary") });
    });

    it("should set each label in Geist semibold at 14 over 20", async () => {
      await renderBasis({ value: "per-100-g" }, scheme);

      expect(await screen.findByText("Per 100 g")).toHaveStyle({
        fontFamily: "Geist-SemiBold",
        fontSize: 14,
        lineHeight: 20,
      });
    });

    it("should share the track equally between its segments", async () => {
      await render(
        <ThemeProvider fixedPreference={scheme}>
          <SegmentedControl
            label="Appearance"
            options={appearanceOptions}
            value="dark"
            onChange={() => undefined}
          />
        </ThemeProvider>,
      );
      await screen.findByLabelText("Appearance");

      expect(viewsDrawn({ flexGrow: 1, flexShrink: 1, flexBasis: "0%" })).toHaveLength(3);
    });
  });
});
