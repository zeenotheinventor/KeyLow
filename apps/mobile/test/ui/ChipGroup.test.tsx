import { render, screen, userEvent } from "@testing-library/react-native";
import { impactAsync } from "expo-haptics";
import { useState } from "react";
import { Dimensions, Platform, StyleSheet } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { ChipGroup } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";
import { viewsDrawn } from "../support/viewsDrawn";

import type { ChipGroupProps } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const mockImpact = jest.mocked(impactAsync);

type Unit = "banana" | "g" | "ml";

const unitOptions = [
  { value: "banana", label: "1 medium (100 g)" },
  { value: "g", label: "g" },
  { value: "ml", label: "ml" },
] as const;

function renderUnits(
  { value, onChange }: { value: Unit | null; onChange?: ChipGroupProps<Unit>["onChange"] },
  scheme: ThemeScheme = "dark",
) {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <ChipGroup
        label="Unit"
        options={unitOptions}
        value={value}
        onChange={onChange ?? (() => undefined)}
      />
    </ThemeProvider>,
  );
}

// A screen that keeps the choice, as the portion picker does for the unit.
function KeptUnit() {
  const [value, setValue] = useState<Unit>("g");
  return (
    <ThemeProvider fixedPreference="dark">
      <ChipGroup label="Unit" options={unitOptions} value={value} onChange={setValue} />
    </ThemeProvider>
  );
}

const schemes: ThemeScheme[] = ["dark", "light"];

describe("ChipGroup", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("mt-[13px]");
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    mockImpact.mockClear();
  });

  describe("what it says", () => {
    it("should be a radio group named by its label", async () => {
      await renderUnits({ value: "g" });

      expect(screen.getByLabelText("Unit")).toHaveProp("role", "radiogroup");
    });

    it("should hold one radio for each option, named by the option", async () => {
      await renderUnits({ value: "g" });

      expect(screen.getAllByRole("radio")).toHaveLength(3);
      expect(screen.getByRole("radio", { name: "1 medium (100 g)" })).toBeOnTheScreen();
      expect(screen.getByRole("radio", { name: "g" })).toBeOnTheScreen();
      expect(screen.getByRole("radio", { name: "ml" })).toBeOnTheScreen();
    });

    it("should say which option is checked, and only that one", async () => {
      await renderUnits({ value: "ml" });

      expect(screen.getByRole("radio", { name: "ml" })).toBeChecked();
      expect(screen.getByRole("radio", { name: "g" })).not.toBeChecked();
      expect(screen.getByRole("radio", { name: "1 medium (100 g)" })).not.toBeChecked();
    });

    it("should check none of them when no option is chosen", async () => {
      await renderUnits({ value: null });

      for (const chip of screen.getAllByRole("radio")) {
        expect(chip).not.toBeChecked();
      }
    });

    it("should scroll sideways so a long label is never cut", async () => {
      await renderUnits({ value: "g" });

      const group = screen.getByLabelText("Unit");
      expect(group).toHaveProp("horizontal", true);
      expect(group).toHaveProp("showsHorizontalScrollIndicator", false);
    });

    it("should be 44 points tall with the 36 point chips centred, so no touch is clipped away", async () => {
      await renderUnits({ value: "g" });

      // The row clips what is outside it, so the room to reach 44 is padding inside it, not hit slop.
      const group = screen.getByLabelText("Unit");
      expect(group).toHaveProp("contentContainerStyle", expect.objectContaining({ paddingTop: 4 }));
      expect(group).toHaveProp(
        "contentContainerStyle",
        expect.objectContaining({ paddingBottom: 4 }),
      );
      expect(screen.getByRole("radio", { name: "g" })).not.toHaveProp("hitSlop");
    });

    it("should not grow to fill a column, so it stays as tall as its chips", async () => {
      await renderUnits({ value: "g" });

      expect(screen.getByLabelText("Unit")).toHaveStyle({ flexGrow: 0 });
    });

    it("should take the screen's layout classes on the row", async () => {
      await render(
        <ThemeProvider fixedPreference="dark">
          <ChipGroup
            className="mt-[13px]"
            label="Unit"
            options={unitOptions}
            value="g"
            onChange={() => undefined}
          />
        </ThemeProvider>,
      );

      expect(await screen.findByLabelText("Unit")).toHaveStyle({ flexGrow: 0, marginTop: 13 });
    });

    it("should keep each label to one line however large the text is", async () => {
      await renderUnits({ value: "g" });

      const label = screen.getByText("1 medium (100 g)");
      expect(label).toHaveProp("numberOfLines", 1);
      expect(label).toHaveProp("maxFontSizeMultiplier", 1.2);
    });
  });

  // Android multiplies a line height by the whole font scale even where it caps the font size, so the line
  // is given divided by the scale, and iOS caps both itself. The 36 point chip holds the capped 24.
  describe("the line height at large text", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it.each([
      { os: "ios", fontScale: 1, lineHeight: 24 },
      { os: "ios", fontScale: 2, lineHeight: 24 },
      { os: "android", fontScale: 1, lineHeight: 24 },
      { os: "android", fontScale: 1.2, lineHeight: 24 },
      { os: "android", fontScale: 2, lineHeight: 14.4 },
    ] as const)(
      "should give the label a $lineHeight point line height on $os at font scale $fontScale",
      async ({ os, fontScale, lineHeight }) => {
        jest.replaceProperty(Platform, "OS", os);
        jest
          .spyOn(Dimensions, "get")
          .mockReturnValue({ width: 411, height: 914, scale: 2.625, fontScale });
        await renderUnits({ value: "g" });

        const label = await screen.findByText("g");
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
    it("should hand on the value of the chip that is pressed", async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      await renderUnits({ value: "g", onChange });

      await user.press(screen.getByRole("radio", { name: "1 medium (100 g)" }));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith("banana");
    });

    it("should play the selection haptic when the choice changes", async () => {
      const user = userEvent.setup();
      await renderUnits({ value: "g" });

      await user.press(screen.getByRole("radio", { name: "ml" }));

      expect(mockImpact).toHaveBeenCalledTimes(1);
      expect(mockImpact).toHaveBeenCalledWith("light");
    });

    it("should do nothing when the checked chip is pressed again", async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      await renderUnits({ value: "g", onChange });

      await user.press(screen.getByRole("radio", { name: "g" }));

      expect(onChange).not.toHaveBeenCalled();
      expect(mockImpact).not.toHaveBeenCalled();
    });

    it("should hand on a value when none is chosen yet", async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      await renderUnits({ value: null, onChange });

      await user.press(screen.getByRole("radio", { name: "g" }));

      expect(onChange).toHaveBeenCalledWith("g");
    });

    it("should move the check at once when a screen keeps the choice", async () => {
      const user = userEvent.setup();
      await render(<KeptUnit />);

      await user.press(screen.getByRole("radio", { name: "ml" }));

      expect(screen.getByRole("radio", { name: "ml" })).toBeChecked();
      expect(screen.getByRole("radio", { name: "g" })).not.toBeChecked();
    });
  });

  describe.each(schemes)("in the %s scheme", (scheme) => {
    const colorOf = (name: Parameters<typeof resolvedColor>[1]) => resolvedColor(scheme, name);

    it("should draw an unchosen chip 36 points high as a pill on the raised surface with a hairline border, padded 12 across", async () => {
      await renderUnits({ value: "ml" }, scheme);
      await screen.findByLabelText("Unit");

      const chips = viewsDrawn({
        height: 36,
        backgroundColor: colorOf("surface-raised"),
        borderColor: colorOf("border"),
        borderWidth: 1,
        borderRadius: 999,
      });
      expect(chips).toHaveLength(2);
      expect(chips[0]).toHaveStyle({ paddingLeft: 12, paddingRight: 12 });
    });

    it("should fill the chosen chip with the accent and write on it in the accent foreground", async () => {
      await renderUnits({ value: "ml" }, scheme);
      await screen.findByLabelText("Unit");

      expect(
        viewsDrawn({
          height: 36,
          backgroundColor: colorOf("accent"),
          borderColor: colorOf("accent"),
          borderRadius: 999,
        }),
      ).toHaveLength(1);
      expect(screen.getByText("ml")).toHaveStyle({
        color: colorOf("accent-foreground"),
        fontFamily: "Geist-SemiBold",
      });
    });

    it("should write on an unchosen chip in primary text at regular weight", async () => {
      await renderUnits({ value: "ml" }, scheme);
      await screen.findByLabelText("Unit");

      expect(screen.getByText("g")).toHaveStyle({
        color: colorOf("text-primary"),
        fontFamily: "Geist-Regular",
        fontSize: 16,
        lineHeight: 24,
      });
    });

    it("should leave 8 points between the chips", async () => {
      await renderUnits({ value: "ml" }, scheme);
      await screen.findByLabelText("Unit");

      expect(screen.getByLabelText("Unit")).toHaveProp(
        "contentContainerStyle",
        expect.objectContaining({ rowGap: 8, columnGap: 8 }),
      );
    });
  });
});
