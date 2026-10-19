import { fireEvent, render, screen } from "@testing-library/react-native";

import { NumericInput } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";
import { viewsDrawn } from "../support/viewsDrawn";

import type { NumericInputProps } from "../../components/ui";
import type { ColorName, ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

function renderNumericInput(props: Partial<NumericInputProps> = {}, scheme: ThemeScheme = "dark") {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <NumericInput label="Energy" unit="kcal" value="" onChangeText={() => undefined} {...props} />
    </ThemeProvider>,
  );
}

const schemes: ThemeScheme[] = ["dark", "light"];

describe("NumericInput", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  describe("the field", () => {
    it("should ask for the decimal keyboard", async () => {
      await renderNumericInput();

      expect(screen.getByLabelText("Energy (kcal)")).toHaveProp("keyboardType", "decimal-pad");
    });

    it("should be named by its label and its unit, because the suffix is drawn for the eye only", async () => {
      await renderNumericInput();

      expect(screen.getByLabelText("Energy (kcal)")).toBeOnTheScreen();
      expect(screen.getByText("Energy")).toBeOnTheScreen();
    });

    it("should be named by its label alone when it has no unit", async () => {
      await renderNumericInput({ unit: undefined });

      expect(screen.getByLabelText("Energy")).toBeOnTheScreen();
    });

    it("should be named by an accessible label of its own, whole, instead of its label and unit", async () => {
      await renderNumericInput({ accessibilityLabel: "Amount for portion 1 (g)", unit: "g" });

      expect(screen.getByLabelText("Amount for portion 1 (g)")).toBeOnTheScreen();
      expect(screen.queryByLabelText("Energy (g)")).not.toBeOnTheScreen();
      expect(screen.getByText("Energy")).toBeOnTheScreen();
    });

    it("should draw no message for an error the screen shows itself, and still describe the field by it", async () => {
      await renderNumericInput({ error: "Energy is required", errorShownElsewhere: true });

      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
      expect(screen.getByLabelText("Energy (kcal)")).toHaveProp(
        "accessibilityHint",
        "Energy is required",
      );
    });

    it("should show the unit after the value and hide it from a screen reader", async () => {
      await renderNumericInput({ value: "165" });

      // A screen reader never sees it, so it is only found when hidden elements are asked for.
      expect(screen.queryByText("kcal")).not.toBeOnTheScreen();
      expect(screen.getByText("kcal", { includeHiddenElements: true })).toBeOnTheScreen();
    });

    it("should show a 0 as its placeholder unless it is given another", async () => {
      await renderNumericInput();

      expect(screen.getByPlaceholderText("0")).toBeOnTheScreen();
    });

    it("should hand on what is typed", async () => {
      const onChangeText = jest.fn();
      await renderNumericInput({ onChangeText });

      await fireEvent.changeText(screen.getByLabelText("Energy (kcal)"), "165");

      expect(onChangeText).toHaveBeenCalledWith("165");
    });

    it("should keep the unit and the digits inside the box at large text", async () => {
      await renderNumericInput();

      expect(screen.getByLabelText("Energy (kcal)")).toHaveProp("maxFontSizeMultiplier", 1.5);
      expect(screen.getByText("kcal", { includeHiddenElements: true })).toHaveProp(
        "maxFontSizeMultiplier",
        1.5,
      );
    });
  });

  describe("the same messages as Input", () => {
    it("should show an error as an alert that describes the field", async () => {
      await renderNumericInput({ error: "Energy is required" });

      expect(screen.getByRole("alert", { name: "Energy is required" })).toBeOnTheScreen();
      expect(screen.getByLabelText("Energy (kcal)")).toHaveProp(
        "accessibilityHint",
        "Energy is required",
      );
    });

    it("should show a helper under the field", async () => {
      await renderNumericInput({ helper: "Per 100 g" });

      expect(screen.getByText("Per 100 g")).toBeOnTheScreen();
    });

    it("should show a note that the value is not given", async () => {
      await renderNumericInput({ missingNote: "Not given" });

      expect(screen.getByText("Not given")).toBeOnTheScreen();
    });

    it("should not take typing when it is disabled", async () => {
      await renderNumericInput({ disabled: true });

      expect(screen.getByLabelText("Energy (kcal)")).toBeDisabled();
    });
  });

  describe("a field that stands beside its label, as the servings stepper's does", () => {
    it("should ask for the number pad, which has no decimal key, when it takes whole numbers", async () => {
      await renderNumericInput({ keyboardType: "number-pad" });

      expect(screen.getByLabelText("Energy (kcal)")).toHaveProp("keyboardType", "number-pad");
    });

    it("should centre its digits when asked", async () => {
      await renderNumericInput({ value: "6", align: "center" });

      expect(await screen.findByLabelText("Energy (kcal)")).toHaveProp("textAlign", "center");
    });

    it("should set its digits in strong body text when asked", async () => {
      await renderNumericInput({ value: "6", strongValue: true });

      expect(await screen.findByLabelText("Energy (kcal)")).toHaveStyle({
        fontFamily: "Geist-SemiBold",
        fontSize: 16,
      });
    });

    it("should draw no label when it is hidden, and still be named by it", async () => {
      await renderNumericInput({ labelHidden: true });

      expect(screen.queryByText("Energy")).not.toBeOnTheScreen();
      expect(screen.getByLabelText("Energy (kcal)")).toBeOnTheScreen();
    });

    it("should be an adjustable that reads its value aloud as the text it is given", async () => {
      await renderNumericInput({
        unit: undefined,
        value: "6",
        adjustable: { valueText: "6 servings", onStep: () => undefined },
      });

      const field = screen.getByRole("adjustable", { name: "Energy" });
      expect(field).toHaveAccessibilityValue({ text: "6 servings" });
    });

    it.each([
      { actionName: "increment", direction: 1 },
      { actionName: "decrement", direction: -1 },
    ])(
      "should step $direction on an accessibility $actionName",
      async ({ actionName, direction }) => {
        const onStep = jest.fn();
        await renderNumericInput({
          unit: undefined,
          value: "6",
          adjustable: { valueText: "6 servings", onStep },
        });

        await fireEvent(screen.getByRole("adjustable", { name: "Energy" }), "accessibilityAction", {
          nativeEvent: { actionName },
        });

        expect(onStep).toHaveBeenCalledTimes(1);
        expect(onStep).toHaveBeenCalledWith(direction);
      },
    );

    it("should not step on an accessibility action it does not know", async () => {
      const onStep = jest.fn();
      await renderNumericInput({
        unit: undefined,
        adjustable: { valueText: "6 servings", onStep },
      });

      await fireEvent(screen.getByRole("adjustable", { name: "Energy" }), "accessibilityAction", {
        nativeEvent: { actionName: "activate" },
      });

      expect(onStep).not.toHaveBeenCalled();
    });

    it("should be a plain field, with no role of its own, when it is not adjustable", async () => {
      await renderNumericInput();

      expect(screen.queryByRole("adjustable")).not.toBeOnTheScreen();
    });
  });

  // At large text a long label such as Carbohydrate wraps inside its column of the three across macro row. A
  // label that cannot shrink ran past its column and over the next field's mark (measured at font scale 2).
  describe("a long label at large text", () => {
    it("should be allowed to shrink to its column, with the row around it", async () => {
      await renderNumericInput({ label: "Carbohydrate", macro: "carbs" });

      expect(await screen.findByText("Carbohydrate")).toHaveStyle({ flexShrink: 1 });
      expect(viewsDrawn({ minWidth: 0, flexShrink: 1, flexDirection: "row" })).toHaveLength(1);
    });
  });

  describe("the macro mark", () => {
    it.each([
      { macro: "protein", color: "protein" },
      { macro: "carbs", color: "carbs" },
      { macro: "fat", color: "fat" },
    ] as const)("should put the $macro colour beside the label", async ({ macro, color }) => {
      await renderNumericInput({ label: "Macro", macro });
      await screen.findByText("Macro");

      expect(
        viewsDrawn({
          width: 8,
          height: 8,
          borderRadius: 2,
          backgroundColor: resolvedColor("dark", color),
        }),
      ).toHaveLength(1);
    });

    it("should hide the mark from a screen reader, because the label is the name", async () => {
      await renderNumericInput({ macro: "protein" });
      await screen.findByText("Energy");

      const [mark] = viewsDrawn({ width: 8, height: 8, borderRadius: 2 });
      expect(mark).toHaveProp("aria-hidden", true);
    });

    it("should draw no mark by default", async () => {
      await renderNumericInput();
      await screen.findByText("Energy");

      expect(viewsDrawn({ width: 8, height: 8, borderRadius: 2 })).toHaveLength(0);
    });
  });

  describe.each(schemes)("in the %s scheme", (scheme) => {
    const colorOf = (name: ColorName) => resolvedColor(scheme, name);

    it("should be the food form boards' 44 point box by default: 12 across, with 6 between the digits and the unit", async () => {
      await renderNumericInput({}, scheme);
      await screen.findByLabelText("Energy (kcal)");

      const [box] = viewsDrawn({
        minHeight: 44,
        backgroundColor: colorOf("surface-raised"),
        borderColor: colorOf("border"),
        borderRadius: 12,
      });
      expect(box).toHaveStyle({ paddingLeft: 12, paddingRight: 12, columnGap: 6 });
    });

    it("should be padded 16 with 8 between the digits and the unit in the comfortable density", async () => {
      await renderNumericInput({ density: "comfortable" }, scheme);
      await screen.findByLabelText("Energy (kcal)");

      const [box] = viewsDrawn({ minHeight: 44, paddingLeft: 16, paddingRight: 16 });
      expect(box).toHaveStyle({ columnGap: 8 });
    });

    it("should right align its digits, in tabular figures", async () => {
      await renderNumericInput({ value: "165" }, scheme);

      const field = await screen.findByLabelText("Energy (kcal)");
      // NativeWind hands a text input's alignment over as a prop, not a style.
      expect(field).toHaveProp("textAlign", "right");
      expect(field).toHaveStyle({
        color: colorOf("text-primary"),
        fontFamily: "Geist-Regular",
        fontSize: 16,
      });
      expect(field.props.style).toMatchObject({ fontVariant: "tabular-nums" });
    });

    it("should set the unit in muted body text", async () => {
      await renderNumericInput({}, scheme);

      expect(await screen.findByText("kcal", { includeHiddenElements: true })).toHaveStyle({
        color: colorOf("text-muted"),
        fontSize: 16,
        lineHeight: 24,
      });
    });

    it("should turn its border to the accent while it has focus, and to danger with an error", async () => {
      await renderNumericInput({}, scheme);
      const field = await screen.findByLabelText("Energy (kcal)");

      await fireEvent(field, "focus");
      expect(viewsDrawn({ minHeight: 44, borderColor: colorOf("accent") })).toHaveLength(1);

      await screen.unmount();
      await renderNumericInput({ error: "Energy is required" }, scheme);
      expect(viewsDrawn({ minHeight: 44, borderColor: colorOf("danger") })).toHaveLength(1);
    });
  });
  describe("the display size", () => {
    it("should draw the number at 32 over 40 in a box 64 points high, as the set entry boards do", async () => {
      await renderNumericInput({
        label: "Load, kg",
        unit: undefined,
        value: "180",
        size: "display",
        align: "center",
      });

      expect(screen.getByLabelText("Load, kg")).toHaveStyle({
        fontSize: 32,
        lineHeight: 40,
        fontWeight: "600",
      });
      expect(viewsDrawn({ height: 64 })).toHaveLength(1);
    });

    it("should let large text grow only so far, so the number stays inside its 40 point line and 64 point box", async () => {
      await renderNumericInput({
        label: "Load, kg",
        unit: undefined,
        value: "180",
        size: "display",
      });

      expect(screen.getByLabelText("Load, kg")).toHaveProp("maxFontSizeMultiplier", 1.25);
    });

    it("should leave the default size as it was: 44 points at least, in body type", async () => {
      await renderNumericInput({ label: "Load, kg", unit: undefined, value: "180" });

      expect(screen.getByLabelText("Load, kg")).toHaveStyle({ fontSize: 16, lineHeight: 24 });
      expect(viewsDrawn({ height: 64 })).toHaveLength(0);
      expect(viewsDrawn({ minHeight: 44 }).length).toBeGreaterThan(0);
    });
  });
});
