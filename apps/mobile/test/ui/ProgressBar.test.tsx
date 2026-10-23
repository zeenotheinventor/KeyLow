import { render, screen } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { getAnimatedStyle, setUpTests } from "react-native-reanimated";

import { ProgressBar } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { animatedOpacity, animatedTranslateX } from "../support/animatedStyle";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";

import type { ProgressBarProps } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const label = "Updating";

async function renderBar(props: Partial<ProgressBarProps> = {}, scheme: ThemeScheme = "dark") {
  await render(
    <ThemeProvider fixedPreference={scheme}>
      <ProgressBar label={label} {...props} />
    </ThemeProvider>,
  );
}

const bar = () => screen.getByRole("progressbar", { name: label });

// The fill and the sweep are decoration inside a bar whose value is said in words by its role, so they have
// no role to query by and carry ids instead.
const hidden = { includeHiddenElements: true };
const fill = () => screen.getByTestId("progress-bar-fill", hidden);
const sweep = () => screen.getByTestId("progress-bar-sweep", hidden);

function setReduceMotion(isEnabled: boolean): void {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(isEnabled);
}

describe("ProgressBar", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
    setReduceMotion(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("for a screen reader", () => {
    it("should be one progress bar with the name it is given", async () => {
      await renderBar({ value: 40 });

      expect(screen.getAllByRole("progressbar")).toHaveLength(1);
      expect(bar()).toBeOnTheScreen();
    });

    it("should say its value as a percentage from 0 to 100", async () => {
      await renderBar({ value: 40 });

      expect(bar()).toHaveAccessibilityValue({ min: 0, max: 100, now: 40 });
    });

    it("should say a whole percentage", async () => {
      await renderBar({ value: 37.6 });

      expect(bar()).toHaveAccessibilityValue({ now: 38 });
    });

    it.each([
      [-5, 0],
      [0, 0],
      [100, 100],
      [150, 100],
    ])("should say %s as %s", async (value, expected) => {
      await renderBar({ value });

      expect(bar()).toHaveAccessibilityValue({ now: expected });
    });

    it("should say no value while it is indeterminate", async () => {
      await renderBar();

      expect(bar()).toHaveAccessibilityValue({ min: 0, max: 100 });
      expect(bar()).not.toHaveProp("aria-valuenow");
    });

    it("should show no text", async () => {
      await renderBar({ value: 40 });

      expect(screen.queryByText(/./)).not.toBeOnTheScreen();
    });
  });

  describe("when it has a value", () => {
    it("should fill that share of the track", async () => {
      await renderBar({ value: 40 });

      expect(fill()).toHaveStyle({ width: "40%" });
    });

    it.each<[number, `${number}%`]>([
      [-5, "0%"],
      [150, "100%"],
    ])("should fill %s as %s of the track", async (value, width) => {
      await renderBar({ value });

      expect(fill()).toHaveStyle({ width });
    });

    it("should fill in the accent colour, 4 points tall with the pill radius", async () => {
      await renderBar({ value: 40 });

      expect(fill()).toHaveStyle({
        backgroundColor: resolvedColor("dark", "accent"),
        height: "100%",
      });
      expect(bar()).toHaveStyle({ height: 4, borderRadius: 999 });
    });

    it("should not draw the sweep", async () => {
      await renderBar({ value: 40 });

      expect(screen.queryByTestId("progress-bar-sweep", hidden)).not.toBeOnTheScreen();
    });
  });

  describe("when it is indeterminate", () => {
    it("should draw a sweep and no fill", async () => {
      await renderBar();

      expect(sweep()).toBeOnTheScreen();
      expect(screen.queryByTestId("progress-bar-fill", hidden)).not.toBeOnTheScreen();
    });

    it("should move the sweep across the track", async () => {
      await renderBar();
      const before = animatedTranslateX(sweep());

      await jest.advanceTimersByTimeAsync(600);

      expect(before).toBeDefined();
      expect(animatedTranslateX(sweep())).not.toBe(before);
    });

    it("should dim and return instead of moving when the system asks for reduced motion", async () => {
      setReduceMotion(true);
      await renderBar();
      await jest.advanceTimersByTimeAsync(600);

      expect(animatedTranslateX(sweep())).toBeUndefined();
      expect(getAnimatedStyle(sweep()).width).toBe("100%");
      expect(animatedOpacity(sweep())).toBeLessThan(1);
    });
  });

  describe.each<ThemeScheme>(["dark", "light"])("in the %s theme", (scheme) => {
    it("should be a track on the border colour", async () => {
      await renderBar({ value: 40 }, scheme);

      expect(bar()).toHaveStyle({ backgroundColor: resolvedColor(scheme, "border") });
    });
  });
});
