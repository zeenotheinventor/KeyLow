import { controlHeight, touchTarget } from "@keylow/tokens";
import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { impactAsync } from "expo-haptics";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { IconButton } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { animatedScale } from "../support/animatedStyle";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";

import type { IconButtonProps } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";

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

    it("should need no extra reach at the medium size", async () => {
      await renderIconButton();

      expect(screen.getByRole("button", { name: "Close" })).toHaveProp("hitSlop", 0);
    });
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
