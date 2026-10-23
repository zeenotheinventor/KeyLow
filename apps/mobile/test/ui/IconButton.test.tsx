import { controlHeight, iconSize, themes, touchTarget } from "@keylow/tokens";
import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { impactAsync } from "expo-haptics";
import { createRef } from "react";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { IconButton } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { animatedScale } from "../support/animatedStyle";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";
import { viewsDrawn } from "../support/viewsDrawn";

import type { IconButtonProps } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";
import type { View } from "react-native";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const mockImpact = jest.mocked(impactAsync);

function renderIconButton(props: Partial<IconButtonProps> = {}, scheme: ThemeScheme = "dark") {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <IconButton icon="X" label="Close" {...props} />
    </ThemeProvider>,
  );
}

function setReduceMotion(isEnabled: boolean): void {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(isEnabled);
}

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds);
  });
}

// A spring stops a hair short of its target, so the scale is read as a number and compared close.
function readScale(): number | undefined {
  return animatedScale(screen.getByTestId("press-scale"));
}

// The icon is decoration, so its drawing is looked for.
function drawings() {
  return screen.root?.queryAll((node) => node.type === "RNSVGSvgView") ?? [];
}

// What NativeWind resolves a transparent class to.
const transparent = "#00000000";

const schemes: ThemeScheme[] = ["dark", "light"];

describe("IconButton", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
    setReduceMotion(false);
    mockImpact.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("should be a button named by its label, because it has no text of its own", async () => {
    await renderIconButton({ label: "Create a food", icon: "Plus" });

    expect(screen.getByRole("button", { name: "Create a food" })).toBeOnTheScreen();
  });

  it("should hand its button to a ref, so a screen reader's focus can be sent to it", async () => {
    const ref = createRef<View>();
    await renderIconButton({ ref });

    expect(ref.current).not.toBeNull();
  });

  it("should call onPress when pressed", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const onPress = jest.fn();
    await renderIconButton({ onPress });

    await user.press(screen.getByRole("button", { name: "Close" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("should play no haptic unless the caller names one", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await renderIconButton();

    await user.press(screen.getByRole("button", { name: "Close" }));

    expect(mockImpact).not.toHaveBeenCalled();
  });

  it("should play the haptic the caller names when pressed", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await renderIconButton({ haptic: "select" });

    await user.press(screen.getByRole("button", { name: "Close" }));

    expect(mockImpact).toHaveBeenCalledWith("light");
  });

  it("should stay silent when the user has reduced motion on", async () => {
    setReduceMotion(true);
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await renderIconButton({ haptic: "select" });

    await user.press(screen.getByRole("button", { name: "Close" }));

    expect(mockImpact).not.toHaveBeenCalled();
  });

  describe("press feedback", () => {
    it("should compress while held, show the overlay, and spring back on release", async () => {
      await renderIconButton();
      const button = screen.getByRole("button", { name: "Close" });

      await fireEvent(button, "pressIn");
      await advance(1000);
      expect(readScale()).toBeCloseTo(0.96, 3);
      expect(screen.getByTestId("press-overlay")).toBeOnTheScreen();

      await fireEvent(button, "pressOut");
      await advance(1000);
      expect(readScale()).toBeCloseTo(1, 3);
      expect(screen.queryByTestId("press-overlay")).not.toBeOnTheScreen();
    });

    it("should not compress when the user has reduced motion on, and still show the overlay", async () => {
      setReduceMotion(true);
      await renderIconButton();
      await advance(100);

      await fireEvent(screen.getByRole("button", { name: "Close" }), "pressIn");
      await advance(1000);

      expect(readScale()).toBe(1);
      expect(screen.getByTestId("press-overlay")).toBeOnTheScreen();
    });
  });

  describe("going inert while pressed", () => {
    it("should let go of the press when it becomes disabled under the finger", async () => {
      const view = await renderIconButton();
      await fireEvent(screen.getByRole("button", { name: "Close" }), "pressIn");
      await advance(1000);
      expect(readScale()).toBeCloseTo(0.96, 3);

      await view.rerender(
        <ThemeProvider fixedPreference="dark">
          <IconButton disabled icon="X" label="Close" />
        </ThemeProvider>,
      );
      await advance(1000);

      expect(readScale()).toBeCloseTo(1, 3);
      expect(screen.queryByTestId("press-overlay")).not.toBeOnTheScreen();
    });
  });

  describe("disabled", () => {
    it("should be a disabled button at 40 percent opacity that does nothing when pressed", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onPress = jest.fn();
      await renderIconButton({ disabled: true, haptic: "select", onPress });
      const button = screen.getByRole("button", { name: "Close" });

      await user.press(button);
      await advance(1000);

      expect(button).toBeDisabled();
      // NativeWind hands the opacity over as a 32 bit float.
      expect(button).toHaveStyle({ opacity: Math.fround(0.4) });
      expect(onPress).not.toHaveBeenCalled();
      expect(mockImpact).not.toHaveBeenCalled();
      expect(readScale()).toBe(1);
      expect(screen.queryByTestId("press-overlay")).not.toBeOnTheScreen();
    });

    it("should stay disabled but not dim itself when the caller dims it as a whole", async () => {
      await renderIconButton({ disabled: true, dimsWhenDisabled: false });
      const button = screen.getByRole("button", { name: "Close" });

      expect(button).toBeDisabled();
      expect(button).not.toHaveStyle({ opacity: Math.fround(0.4) });
    });
  });

  describe("layout", () => {
    it("should be a 44 point square with the medium radius by default, so it is a full touch target", async () => {
      await renderIconButton();

      expect(screen.getByRole("button", { name: "Close" })).toHaveStyle({
        height: controlHeight.md,
        width: touchTarget,
        borderRadius: 12,
      });
    });

    it("should be a 36 point square with the small radius when small", async () => {
      await renderIconButton({ size: "sm", variant: "ghost" });

      expect(screen.getByRole("button", { name: "Close" })).toHaveStyle({
        height: controlHeight.sm,
        width: controlHeight.sm,
        borderRadius: 6,
      });
    });

    it("should reach a 44 point touch target when small, with the extra reach outside its edge", async () => {
      await renderIconButton({ size: "sm", variant: "ghost" });

      const reach = (touchTarget - controlHeight.sm) / 2;
      expect(screen.getByRole("button", { name: "Close" })).toHaveProp("hitSlop", reach);
    });

    it("should draw a 20 point icon by default", async () => {
      await renderIconButton();

      expect(drawings()[0]).toHaveProp("width", iconSize.md);
    });

    it("should draw the icon at the size it is given, which the stack header's back control asks for", async () => {
      await renderIconButton({ iconSize: "lg" });

      expect(drawings()[0]).toHaveProp("width", iconSize.lg);
    });

    it("should draw the icon at a size in points when given a number", async () => {
      await renderIconButton({ iconSize: 22 });

      expect(drawings()[0]).toHaveProp("width", 22);
    });

    it("should need no extra reach at the medium size", async () => {
      await renderIconButton();

      expect(screen.getByRole("button", { name: "Close" })).toHaveProp("hitSlop", 0);
    });
  });

  describe("ring", () => {
    // The circle is a view with no role of its own, so it is found by the look it was drawn with.
    function ringCircle() {
      return viewsDrawn({ height: 32, width: 32, borderRadius: 999 });
    }

    it("should be a 44 point touch target itself, because a touch outside its parent is never delivered", async () => {
      await renderIconButton({ variant: "ring", icon: "Plus" });

      expect(screen.getByRole("button", { name: "Close" })).toHaveStyle({
        height: touchTarget,
        width: touchTarget,
        borderRadius: 999,
      });
    });

    it("should hold a 32 point circle, so the plus sits in a mild ring", async () => {
      await renderIconButton({ variant: "ring", icon: "Plus" });

      const button = screen.getByRole("button", { name: "Close" });
      const [circle] = ringCircle();
      expect(ringCircle()).toHaveLength(1);
      let ancestor = circle?.parent;
      while (ancestor && ancestor !== button) {
        ancestor = ancestor.parent;
      }
      expect(ancestor).toBe(button);
    });

    it("should rely on no hit slop, which could not reach past its 32 point parent", async () => {
      await renderIconButton({ variant: "ring", icon: "Plus" });

      expect(screen.getByRole("button", { name: "Close" }).props.hitSlop).toBeUndefined();
    });

    it("should draw the icon at 20 points, whatever size the button is given", async () => {
      await renderIconButton({ variant: "ring", icon: "Plus", size: "sm" });

      expect(drawings()[0]).toHaveProp("width", iconSize.md);
    });

    it("should be dimmed to 40 percent and disabled when disabled, and do nothing when pressed", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onPress = jest.fn();
      await renderIconButton({ variant: "ring", icon: "Plus", disabled: true, onPress });
      const button = screen.getByRole("button", { name: "Close" });

      await user.press(button);

      expect(button).toBeDisabled();
      expect(button).toHaveStyle({ opacity: Math.fround(0.4) });
      expect(onPress).not.toHaveBeenCalled();
    });

    it.each(schemes)(
      "should draw a border and no fill on the circle, with the plus in secondary text, in the %s scheme",
      async (scheme) => {
        await renderIconButton({ variant: "ring", icon: "Plus" }, scheme);

        await screen.findByRole("button", { name: "Close" });
        expect(
          viewsDrawn({
            height: 32,
            borderColor: resolvedColor(scheme, "border"),
            borderWidth: 1,
            backgroundColor: transparent,
          }),
        ).toHaveLength(1);
        expect(drawings()[0]).toHaveProp("stroke", themes[scheme]["text-secondary"]);
      },
    );
  });

  describe("primary", () => {
    // The circle is a view with no role of its own, so it is found by the look it was drawn with.
    function primaryCircle() {
      return viewsDrawn({ height: 36, width: 36, borderRadius: 999 });
    }

    it("should be a 44 point touch target itself, with no hit slop", async () => {
      await renderIconButton({ variant: "primary", icon: "Plus" });

      const button = screen.getByRole("button", { name: "Close" });
      expect(button).toHaveStyle({ height: touchTarget, width: touchTarget });
      expect(button.props.hitSlop).toBeUndefined();
    });

    it.each(schemes)(
      "should hold a 36 point accent circle inside the target, with the plus in accent-foreground at 20 points and a 2.25 stroke, in the %s scheme",
      async (scheme) => {
        await renderIconButton({ variant: "primary", icon: "Plus" }, scheme);

        await screen.findByRole("button", { name: "Close" });
        expect(primaryCircle()).toHaveLength(1);
        expect(primaryCircle()[0]).toHaveStyle({
          backgroundColor: resolvedColor(scheme, "accent"),
        });
        expect(drawings()[0]).toHaveProp("stroke", themes[scheme]["accent-foreground"]);
        expect(drawings()[0]).toHaveProp("width", iconSize.md);
        expect(drawings()[0]).toHaveProp("strokeWidth", 2.25);
      },
    );

    it("should keep the accent-foreground plus whatever tone is asked for", async () => {
      await renderIconButton({ variant: "primary", icon: "Plus", tone: "secondary" });

      expect(drawings()[0]).toHaveProp("stroke", themes.dark["accent-foreground"]);
    });

    it("should be dimmed to 40 percent and disabled when disabled, and do nothing when pressed", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onPress = jest.fn();
      await renderIconButton({ variant: "primary", icon: "Plus", disabled: true, onPress });
      const button = screen.getByRole("button", { name: "Close" });

      await user.press(button);

      expect(button).toBeDisabled();
      expect(button).toHaveStyle({ opacity: Math.fround(0.4) });
      expect(onPress).not.toHaveBeenCalled();
    });

    it("should leave the other variants without the accent circle", async () => {
      await renderIconButton({ variant: "ring", icon: "Plus" });

      expect(primaryCircle()).toHaveLength(0);
    });
  });

  describe("card size", () => {
    it("should be a 40 point square with the medium radius, as the body map card's side by side board draws it", async () => {
      await renderIconButton({ size: "card" });

      expect(screen.getByRole("button", { name: "Close" })).toHaveStyle({
        height: 40,
        width: 40,
        borderRadius: 12,
      });
    });

    it("should reach a 44 point touch target with the extra reach outside its edge", async () => {
      await renderIconButton({ size: "card" });

      expect(screen.getByRole("button", { name: "Close" })).toHaveProp("hitSlop", 2);
    });
  });

  describe("selected", () => {
    it("should not be announced as selected unless it is", async () => {
      await renderIconButton();

      expect(screen.getByRole("button", { name: "Close", selected: false })).toBeOnTheScreen();
    });

    it("should be announced as selected when it is", async () => {
      await renderIconButton({ isSelected: true });

      expect(screen.getByRole("button", { name: "Close", selected: true })).toBeOnTheScreen();
    });

    it.each(schemes)(
      "should draw an accent muted fill, an accent border and an accent ink glyph, in the %s scheme",
      async (scheme) => {
        await renderIconButton({ isSelected: true }, scheme);

        expect(await screen.findByRole("button", { name: "Close", selected: true })).toHaveStyle({
          backgroundColor: themes[scheme]["accent-muted"],
          borderColor: resolvedColor(scheme, "accent"),
          borderWidth: 1,
        });
        expect(drawings()[0]).toHaveProp("stroke", themes[scheme]["accent-ink"]);
      },
    );

    it.each(schemes)(
      "should keep the raised surface, the border and the primary text glyph when not selected, in the %s scheme",
      async (scheme) => {
        await renderIconButton({ isSelected: false }, scheme);

        expect(await screen.findByRole("button", { name: "Close" })).toHaveStyle({
          backgroundColor: resolvedColor(scheme, "surface-raised"),
          borderColor: resolvedColor(scheme, "border"),
        });
        expect(drawings()[0]).toHaveProp("stroke", themes[scheme]["text-primary"]);
      },
    );
  });

  describe("tone", () => {
    it.each(schemes)(
      "should draw the glyph in primary text unless asked for secondary, in the %s scheme",
      async (scheme) => {
        await renderIconButton({ variant: "ghost" }, scheme);

        await screen.findByRole("button", { name: "Close" });
        expect(drawings()[0]).toHaveProp("stroke", themes[scheme]["text-primary"]);
      },
    );

    it.each(schemes)(
      "should draw the glyph in secondary text when asked, on any variant, in the %s scheme",
      async (scheme) => {
        await renderIconButton({ variant: "ghost", tone: "secondary" }, scheme);

        await screen.findByRole("button", { name: "Close" });
        expect(drawings()[0]).toHaveProp("stroke", themes[scheme]["text-secondary"]);
      },
    );
  });

  describe.each(schemes)("in the %s scheme", (scheme) => {
    it("should draw the secondary variant on a raised surface with a border", async () => {
      await renderIconButton({ variant: "secondary" }, scheme);

      expect(await screen.findByRole("button", { name: "Close" })).toHaveStyle({
        backgroundColor: resolvedColor(scheme, "surface-raised"),
        borderColor: resolvedColor(scheme, "border"),
        borderWidth: 1,
      });
    });

    it("should draw the ghost variant with no fill and no border", async () => {
      await renderIconButton({ variant: "ghost" }, scheme);

      const button = await screen.findByRole("button", { name: "Close" });
      expect(button).toHaveStyle({ backgroundColor: transparent });
      expect(button.props.style).not.toHaveProperty("borderWidth", 1);
    });
  });
});
