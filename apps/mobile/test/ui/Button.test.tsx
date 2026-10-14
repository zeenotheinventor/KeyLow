import { controlHeight, touchTarget } from "@keylow/tokens";
import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { impactAsync } from "expo-haptics";
import { AccessibilityInfo } from "react-native";
import { getAnimatedStyle, setUpTests } from "react-native-reanimated";

import { Button } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { animatedRotation, animatedScale } from "../support/animatedStyle";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";

import type { ButtonProps, ButtonVariant } from "../../components/ui";
import type { ColorName, ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const mockImpact = jest.mocked(impactAsync);

function renderButton(props: Partial<ButtonProps> = {}, scheme: ThemeScheme = "dark") {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <Button {...props}>{props.children ?? "Add entry"}</Button>
    </ThemeProvider>,
  );
}

function setReduceMotion(isEnabled: boolean): void {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(isEnabled);
}

// An icon in a button is decoration and has no role to query by, so its drawing is looked for.
function drawings() {
  return screen.root?.queryAll((node) => node.type === "RNSVGSvgView") ?? [];
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

function readSpinnerRotation(): string | undefined {
  return animatedRotation(screen.getByRole("progressbar", { name: "Loading" }));
}

// What NativeWind resolves a transparent class to.
const transparent = "#00000000";

const variants: {
  variant: ButtonVariant;
  background: ColorName | "transparent";
  border: ColorName | "transparent";
  label: ColorName;
}[] = [
  { variant: "primary", background: "accent", border: "accent", label: "accent-foreground" },
  { variant: "secondary", background: "surface-raised", border: "border", label: "text-primary" },
  { variant: "destructive", background: "danger", border: "danger", label: "text-on-status" },
  { variant: "ghost", background: "transparent", border: "transparent", label: "text-primary" },
];

const schemes: ThemeScheme[] = ["dark", "light"];

describe("Button", () => {
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

  describe("pressing", () => {
    it("should be a button named by its label", async () => {
      await renderButton({ children: "Add entry" });

      expect(screen.getByRole("button", { name: "Add entry" })).toBeOnTheScreen();
    });

    it("should call onPress when pressed", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onPress = jest.fn();
      await renderButton({ onPress });

      await user.press(screen.getByRole("button", { name: "Add entry" }));

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("should play no haptic unless the caller names one, because the design gives a button none", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      await renderButton();

      await user.press(screen.getByRole("button", { name: "Add entry" }));

      expect(mockImpact).not.toHaveBeenCalled();
    });

    it.each([
      { haptic: "select", style: "light" },
      { haptic: "confirm", style: "medium" },
    ] as const)(
      "should play the $haptic haptic token, a $style impact, when pressed",
      async ({ haptic, style }) => {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
        await renderButton({ haptic });

        await user.press(screen.getByRole("button", { name: "Add entry" }));

        expect(mockImpact).toHaveBeenCalledWith(style);
      },
    );

    it("should stay silent when the user has reduced motion on, because haptics follow that setting", async () => {
      setReduceMotion(true);
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      await renderButton({ haptic: "select" });

      await user.press(screen.getByRole("button", { name: "Add entry" }));

      expect(mockImpact).not.toHaveBeenCalled();
    });
  });

  describe("press feedback", () => {
    it("should show the press overlay while held and take it away on release", async () => {
      await renderButton();
      const button = screen.getByRole("button", { name: "Add entry" });
      expect(screen.queryByTestId("press-overlay")).not.toBeOnTheScreen();

      await fireEvent(button, "pressIn");
      expect(screen.getByTestId("press-overlay")).toBeOnTheScreen();

      await fireEvent(button, "pressOut");
      expect(screen.queryByTestId("press-overlay")).not.toBeOnTheScreen();
    });

    it("should compress while held and spring back on release", async () => {
      await renderButton();
      const button = screen.getByRole("button", { name: "Add entry" });

      await fireEvent(button, "pressIn");
      await advance(1000);
      expect(readScale()).toBeCloseTo(0.96, 3);

      await fireEvent(button, "pressOut");
      await advance(1000);
      expect(readScale()).toBeCloseTo(1, 3);
    });

    it("should not compress when the user has reduced motion on, and still show the overlay", async () => {
      setReduceMotion(true);
      await renderButton();
      await advance(100);
      const button = screen.getByRole("button", { name: "Add entry" });

      await fireEvent(button, "pressIn");
      await advance(1000);

      expect(readScale()).toBe(1);
      expect(screen.getByTestId("press-overlay")).toBeOnTheScreen();
    });
  });

  describe("disabled", () => {
    it("should be a disabled button at 40 percent opacity", async () => {
      await renderButton({ disabled: true });

      const button = screen.getByRole("button", { name: "Add entry" });
      expect(button).toBeDisabled();
      // NativeWind hands the opacity over as a 32 bit float.
      expect(button).toHaveStyle({ opacity: Math.fround(0.4) });
    });

    it("should do nothing when pressed: no onPress, no haptic, no motion, no overlay", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onPress = jest.fn();
      await renderButton({ disabled: true, haptic: "select", onPress });
      const button = screen.getByRole("button", { name: "Add entry" });

      await user.press(button);
      await advance(1000);

      expect(onPress).not.toHaveBeenCalled();
      expect(mockImpact).not.toHaveBeenCalled();
      expect(readScale()).toBe(1);
      expect(screen.queryByTestId("press-overlay")).not.toBeOnTheScreen();
    });
  });

  describe("going inert while pressed", () => {
    it("should let go of the press when it starts loading under the finger", async () => {
      const view = await renderButton();
      await fireEvent(screen.getByRole("button", { name: "Add entry" }), "pressIn");
      await advance(1000);
      expect(readScale()).toBeCloseTo(0.96, 3);

      await view.rerender(
        <ThemeProvider fixedPreference="dark">
          <Button loading>Add entry</Button>
        </ThemeProvider>,
      );
      await advance(1000);

      expect(readScale()).toBeCloseTo(1, 3);
      expect(screen.queryByTestId("press-overlay")).not.toBeOnTheScreen();
    });

    it("should let go of the press when it becomes disabled under the finger", async () => {
      const view = await renderButton();
      await fireEvent(screen.getByRole("button", { name: "Add entry" }), "pressIn");
      await advance(1000);

      await view.rerender(
        <ThemeProvider fixedPreference="dark">
          <Button disabled>Add entry</Button>
        </ThemeProvider>,
      );
      await advance(1000);

      expect(readScale()).toBeCloseTo(1, 3);
      expect(screen.queryByTestId("press-overlay")).not.toBeOnTheScreen();
    });
  });

  describe("loading", () => {
    it("should be a busy button still named by its label", async () => {
      await renderButton({ loading: true });

      expect(screen.getByRole("button", { name: /Add entry/, busy: true })).toBeOnTheScreen();
    });

    it("should stay at full opacity, because only disabled dims the button", async () => {
      await renderButton({ loading: true });

      expect(screen.getByRole("button", { name: /Add entry/ }).props.style).not.toHaveProperty(
        "opacity",
      );
    });

    it("should do nothing when pressed", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onPress = jest.fn();
      await renderButton({ loading: true, haptic: "select", onPress });

      await user.press(screen.getByRole("button", { name: /Add entry/ }));
      await advance(1000);

      expect(onPress).not.toHaveBeenCalled();
      expect(mockImpact).not.toHaveBeenCalled();
      expect(readScale()).toBe(1);
    });

    it("should show a spinner in place of the label, keeping the label's width", async () => {
      await renderButton({ loading: true });

      expect(screen.getByRole("progressbar", { name: "Loading" })).toBeOnTheScreen();
      expect(screen.getByText("Add entry")).not.toBeVisible();
    });

    it("should show no spinner when it is not loading, and the label in full", async () => {
      await renderButton();

      expect(screen.getByText("Add entry")).toBeVisible();
      expect(screen.queryByRole("progressbar")).not.toBeOnTheScreen();
    });

    it("should turn the spinner round", async () => {
      await renderButton({ loading: true });
      await advance(100);
      const early = readSpinnerRotation();

      await advance(250);

      expect(readSpinnerRotation()).not.toBe(early);
    });

    it("should fade the spinner instead of turning it when the user has reduced motion on", async () => {
      setReduceMotion(true);
      await renderButton({ loading: true });
      await advance(100);
      const spinner = screen.getByRole("progressbar", { name: "Loading" });
      const opacities = new Set<unknown>();

      for (let step = 0; step < 8; step += 1) {
        opacities.add(getAnimatedStyle(spinner).opacity);
        await advance(100);
      }

      expect(readSpinnerRotation()).toBe("0deg");
      expect(opacities.size).toBeGreaterThan(1);
    });
  });

  describe.each(schemes)("in the %s scheme", (scheme) => {
    it.each(variants)(
      "should draw the $variant variant from its tokens",
      async ({ variant, background, border, label }) => {
        await renderButton({ variant }, scheme);

        expect(await screen.findByRole("button", { name: "Add entry" })).toHaveStyle({
          backgroundColor:
            background === "transparent" ? transparent : resolvedColor(scheme, background),
          borderColor: border === "transparent" ? transparent : resolvedColor(scheme, border),
          borderWidth: 1,
          borderRadius: 12,
        });
        expect(screen.getByText("Add entry")).toHaveStyle({ color: resolvedColor(scheme, label) });
      },
    );

    it("should draw the press overlay from the press-overlay token", async () => {
      await renderButton({}, scheme);
      await fireEvent(await screen.findByRole("button", { name: "Add entry" }), "pressIn");

      expect(screen.getByTestId("press-overlay")).toHaveStyle({
        backgroundColor: scheme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(15,19,26,0.09)",
      });
    });
  });

  describe("layout", () => {
    it("should be the medium control height, 44 points, by default", async () => {
      await renderButton();

      expect(screen.getByRole("button", { name: "Add entry" })).toHaveStyle({
        height: controlHeight.md,
        minWidth: touchTarget,
      });
    });

    it("should be the large control height, 52 points, when large", async () => {
      await renderButton({ size: "lg" });

      expect(screen.getByRole("button", { name: "Add entry" })).toHaveStyle({
        height: controlHeight.lg,
      });
    });

    it("should fill its parent's width when fullWidth", async () => {
      await renderButton({ fullWidth: true });

      expect(screen.getByTestId("button-layout")).toHaveStyle({ width: "100%" });
    });

    it("should draw a leading icon, which is decoration and adds nothing to the name", async () => {
      await renderButton({ icon: "Plus" });

      expect(screen.getByRole("button", { name: "Add entry" })).toBeOnTheScreen();
      // Decoration has no role to query by, so the drawing itself is looked for.
      expect(drawings()).toHaveLength(1);
    });

    it("should draw no icon unless given one", async () => {
      await renderButton();

      expect(drawings()).toHaveLength(0);
    });
  });
});
