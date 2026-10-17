import { controlHeight, iconSize, touchTarget } from "@keylow/tokens";
import { fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { impactAsync } from "expo-haptics";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { ServingsStepper } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";
import { viewsDrawn } from "../support/viewsDrawn";

import type { ServingsStepperProps } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const mockImpact = jest.mocked(impactAsync);

const sixServings: ServingsStepperProps = {
  label: "Servings",
  decreaseLabel: "Fewer servings",
  increaseLabel: "More servings",
  text: "6",
  valueText: "6 servings",
  canDecrease: true,
  canIncrease: true,
  onChangeText: () => undefined,
  onStep: () => undefined,
};

function renderStepper(props: Partial<ServingsStepperProps> = {}, scheme: ThemeScheme = "dark") {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <ServingsStepper {...sixServings} {...props} />
    </ThemeProvider>,
  );
}

// An icon in a button is decoration and has no role to query by, so its drawing is looked for.
function drawings() {
  return screen.root?.queryAll((node) => node.type === "RNSVGSvgView") ?? [];
}

const field = () => screen.getByRole("adjustable", { name: "Servings" });

const schemes: ThemeScheme[] = ["dark", "light"];

describe("ServingsStepper", () => {
  let kitStyles: string;

  beforeAll(async () => {
    // The caller's layout class is not in the kit's source, so it is compiled by name.
    kitStyles = await compileKitStyles("mt-[13px]");
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    mockImpact.mockClear();
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("the field", () => {
    it("should be found by its label, with the number and the spoken value", async () => {
      await renderStepper();

      expect(field()).toHaveDisplayValue("6");
      expect(field()).toHaveAccessibilityValue({ text: "6 servings" });
    });

    it("should say the label on the left, for the eye, and leave the field to speak it", async () => {
      await renderStepper();

      // The field is named by it, so a screen reader is not told it twice.
      expect(screen.getByText("Servings", { includeHiddenElements: true })).toBeOnTheScreen();
      expect(screen.queryByText("Servings")).not.toBeOnTheScreen();
    });

    it("should ask for the number pad, which has no decimal key", async () => {
      await renderStepper();

      expect(field()).toHaveProp("keyboardType", "number-pad");
    });

    it("should centre its number in strong body text", async () => {
      await renderStepper();

      expect(field()).toHaveProp("textAlign", "center");
      expect(field()).toHaveStyle({ fontFamily: "Geist-SemiBold", fontSize: 16 });
    });

    it("should draw no suffix after the number", async () => {
      await renderStepper();

      expect(screen.queryByText("servings", { includeHiddenElements: true })).not.toBeOnTheScreen();
    });

    it("should hand on what is typed", async () => {
      const onChangeText = jest.fn();
      await renderStepper({ onChangeText });

      await fireEvent.changeText(field(), "12");

      expect(onChangeText).toHaveBeenCalledTimes(1);
      expect(onChangeText).toHaveBeenCalledWith("12");
    });

    it("should say when the field is left", async () => {
      const onBlur = jest.fn();
      await renderStepper({ onBlur });

      await fireEvent(field(), "blur");

      expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it("should do nothing about a number it is given, because it holds no rules", async () => {
      const onChangeText = jest.fn();
      const onStep = jest.fn();
      await renderStepper({ text: "0", valueText: "0 servings", onChangeText, onStep });

      expect(field()).toHaveDisplayValue("0");
      expect(onChangeText).not.toHaveBeenCalled();
      expect(onStep).not.toHaveBeenCalled();
    });
  });

  describe("the buttons", () => {
    it("should step down from the first and up from the second, once each", async () => {
      const user = userEvent.setup();
      const onStep = jest.fn();
      await renderStepper({ onStep });

      await user.press(screen.getByRole("button", { name: "Fewer servings" }));
      expect(onStep).toHaveBeenCalledTimes(1);
      expect(onStep).toHaveBeenLastCalledWith(-1);

      await user.press(screen.getByRole("button", { name: "More servings" }));
      expect(onStep).toHaveBeenCalledTimes(2);
      expect(onStep).toHaveBeenLastCalledWith(1);
    });

    it("should play the selection haptic for each step", async () => {
      const user = userEvent.setup();
      await renderStepper();

      await user.press(screen.getByRole("button", { name: "Fewer servings" }));
      await user.press(screen.getByRole("button", { name: "More servings" }));

      expect(mockImpact).toHaveBeenCalledTimes(2);
      expect(mockImpact).toHaveBeenCalledWith("light");
    });

    it("should draw a minus and a plus in 44 point secondary buttons", async () => {
      await renderStepper();

      expect(drawings()).toHaveLength(2);
      for (const drawing of drawings()) {
        expect(drawing).toHaveProp("width", iconSize.md);
      }
      for (const name of ["Fewer servings", "More servings"]) {
        expect(screen.getByRole("button", { name })).toHaveStyle({
          height: controlHeight.md,
          width: touchTarget,
          borderWidth: 1,
        });
      }
    });

    it("should say a button that cannot act is disabled, dim it to 40 percent and not step", async () => {
      const user = userEvent.setup();
      const onStep = jest.fn();
      await renderStepper({ canDecrease: false, onStep });
      const fewer = screen.getByRole("button", { name: "Fewer servings" });

      await user.press(fewer);

      expect(fewer).toBeDisabled();
      // NativeWind hands the opacity over as a 32 bit float.
      expect(fewer).toHaveStyle({ opacity: Math.fround(0.4) });
      expect(screen.getByRole("button", { name: "More servings" })).toBeEnabled();
      expect(onStep).not.toHaveBeenCalled();
      expect(mockImpact).not.toHaveBeenCalled();
    });

    it("should disable the second button when it cannot act", async () => {
      const user = userEvent.setup();
      const onStep = jest.fn();
      await renderStepper({ canIncrease: false, onStep });
      const more = screen.getByRole("button", { name: "More servings" });

      await user.press(more);

      expect(more).toBeDisabled();
      expect(screen.getByRole("button", { name: "Fewer servings" })).toBeEnabled();
      expect(onStep).not.toHaveBeenCalled();
    });
  });

  describe("the accessibility actions", () => {
    it.each([
      { actionName: "increment", direction: 1 },
      { actionName: "decrement", direction: -1 },
    ])(
      "should step $direction on a swipe for $actionName, once",
      async ({ actionName, direction }) => {
        const onStep = jest.fn();
        await renderStepper({ onStep });

        await fireEvent(field(), "accessibilityAction", { nativeEvent: { actionName } });

        expect(onStep).toHaveBeenCalledTimes(1);
        expect(onStep).toHaveBeenCalledWith(direction);
      },
    );

    it("should not step down by a swipe where the button cannot", async () => {
      const onStep = jest.fn();
      await renderStepper({ canDecrease: false, onStep });

      await fireEvent(field(), "accessibilityAction", {
        nativeEvent: { actionName: "decrement" },
      });

      expect(onStep).not.toHaveBeenCalled();
    });

    it("should not step up by a swipe where the button cannot", async () => {
      const onStep = jest.fn();
      await renderStepper({ canIncrease: false, onStep });

      await fireEvent(field(), "accessibilityAction", {
        nativeEvent: { actionName: "increment" },
      });

      expect(onStep).not.toHaveBeenCalled();
    });
  });

  describe("the error", () => {
    it("should draw no message while there is none", async () => {
      await renderStepper();

      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
      expect(field()).not.toHaveProp("accessibilityHint");
    });

    it("should show the sentence as an alert under the row, and describe the field by it", async () => {
      await renderStepper({ text: "0", error: "Enter whole servings from 1 to 1,000." });

      expect(
        screen.getByRole("alert", { name: "Enter whole servings from 1 to 1,000." }),
      ).toBeOnTheScreen();
      expect(field()).toHaveProp("accessibilityHint", "Enter whole servings from 1 to 1,000.");
    });

    it("should draw the sentence once, across the row and not in the half the field takes", async () => {
      await renderStepper({ error: "Enter whole servings from 1 to 1,000." });

      expect(screen.getAllByRole("alert")).toHaveLength(1);
      expect(screen.getByRole("alert")).toHaveStyle({ alignSelf: "flex-end", textAlign: "right" });
    });

    describe.each(schemes)("in the %s scheme", (scheme) => {
      it("should turn the field's border to danger", async () => {
        await renderStepper({ error: "Enter whole servings from 1 to 1,000." }, scheme);
        await screen.findByRole("adjustable", { name: "Servings" });

        expect(viewsDrawn({ borderColor: resolvedColor(scheme, "danger") })).toHaveLength(1);
      });
    });
  });

  describe("disabled as a whole", () => {
    it("should disable both buttons and the field, and step nowhere", async () => {
      const user = userEvent.setup();
      const onStep = jest.fn();
      await renderStepper({ disabled: true, onStep });

      expect(screen.getByRole("button", { name: "Fewer servings" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "More servings" })).toBeDisabled();
      expect(field()).toBeDisabled();

      await user.press(screen.getByRole("button", { name: "More servings" }));
      await fireEvent(field(), "accessibilityAction", { nativeEvent: { actionName: "increment" } });

      expect(onStep).not.toHaveBeenCalled();
    });
  });

  describe("the layout", () => {
    it("should put the label on the left and the buttons round the field on the right, 8 points apart", async () => {
      await renderStepper();
      await screen.findByRole("adjustable", { name: "Servings" });

      expect(viewsDrawn({ flexDirection: "row", justifyContent: "space-between" })).toHaveLength(1);
      expect(viewsDrawn({ flexDirection: "row", columnGap: 8 }).length).toBeGreaterThan(0);
    });

    it("should make the field 72 points wide", async () => {
      await renderStepper();
      await screen.findByRole("adjustable", { name: "Servings" });

      expect(viewsDrawn({ width: 72 })).toHaveLength(1);
    });

    it("should leave layout to the caller through its class name", async () => {
      await renderStepper({ className: "mt-[13px]" });
      await screen.findByRole("adjustable", { name: "Servings" });

      expect(viewsDrawn({ marginTop: 13 })).toHaveLength(1);
    });
  });
});
