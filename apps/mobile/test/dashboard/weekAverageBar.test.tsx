import { themes } from "@keylow/tokens";
import { act, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { getAnimatedStyle, setUpTests } from "react-native-reanimated";

import { WeekAverageBar } from "../../components/DashboardScreen/WeekAverageBar";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";

import type { WeekAverageBarProps } from "../../components/DashboardScreen/WeekAverageBar";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

// The sample week: 1,681.25 over 2,200.
const under: WeekAverageBarProps = {
  averageKcal: 1681.25,
  targetKcal: 2200,
  barFill: 1681.25 / 2200,
  kcalOverTarget: null,
  daysLogged: 4,
};
const over: WeekAverageBarProps = {
  averageKcal: 2450,
  targetKcal: 2200,
  barFill: 1,
  kcalOverTarget: 250,
  daysLogged: 4,
};
const noTarget: WeekAverageBarProps = {
  averageKcal: 1681.25,
  targetKcal: null,
  barFill: null,
  kcalOverTarget: null,
  daysLogged: 4,
};

async function renderBar(props: WeekAverageBarProps = under, scheme: ThemeScheme = "dark") {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <WeekAverageBar {...props} />
    </ThemeProvider>,
  );
}

async function setReduceMotion(isEnabled: boolean) {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(isEnabled);
  await act(() => Promise.resolve());
}

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds);
  });
}

// The bar has no role or name of its own, because the card it sits in says the same in words. It is found
// by the ids that exist for this and nothing else.
const hidden = { includeHiddenElements: true };
const fill = () => screen.getByTestId("calories-fill", hidden);

// The ruling's ring, worked out here from the token itself: 55 per cent of each channel plus 45 per
// cent of white, so the expected colour is never copied from the code under test.
function ringColourOf(scheme: ThemeScheme): string {
  const [red, green, blue] = [1, 3, 5].map((start) => {
    const channel = parseInt(themes[scheme].calories.slice(start, start + 2), 16);
    return Math.round(channel * 0.55 + 255 * 0.45);
  });
  return `rgb(${red}, ${green}, ${blue})`;
}

const schemes: ThemeScheme[] = ["dark", "light"];

describe("WeekAverageBar", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/DashboardScreen"]);
  });

  beforeEach(async () => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
    await setReduceMotion(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("what it says", () => {
    it("should label the row Average, with what it is taken over after it", async () => {
      await renderBar();

      expect(screen.getByText(/^Average/)).toHaveTextContent("Average · Mon to today");
    });

    it("should print the value, then the target and the unit", async () => {
      await renderBar();

      expect(screen.getByText("1,681")).toBeOnTheScreen();
      expect(screen.getByText("/ 2,200 kcal")).toBeOnTheScreen();
    });

    it("should say how many days the average is taken over", async () => {
      await renderBar();

      expect(screen.getByText("From 4 days with food logged")).toBeOnTheScreen();
    });

    it("should say 1 day, not 1 days", async () => {
      await renderBar({ ...under, daysLogged: 1 });

      expect(screen.getByText("From 1 day with food logged")).toBeOnTheScreen();
    });

    it("should print no overshoot under the target", async () => {
      await renderBar();

      expect(screen.queryByText(/^\+/)).not.toBeOnTheScreen();
    });

    it("should print the overshoot in whole kcal after the target when over", async () => {
      await renderBar(over);

      expect(screen.getByText("2,450")).toBeOnTheScreen();
      expect(screen.getByText("/ 2,200 kcal")).toBeOnTheScreen();
      expect(screen.getByText("+250 kcal")).toBeOnTheScreen();
    });

    it("should print the value and the unit alone, with no bar, when there is no target", async () => {
      await renderBar(noTarget);

      expect(screen.getByText("1,681")).toBeOnTheScreen();
      expect(screen.getByText("kcal")).toBeOnTheScreen();
      expect(screen.queryByText(/\//)).not.toBeOnTheScreen();
      expect(screen.queryByTestId("calories-fill", hidden)).not.toBeOnTheScreen();
      expect(screen.queryByTestId("calories-outline", hidden)).not.toBeOnTheScreen();
    });
  });

  describe("when the row is tight", () => {
    it("should let the label shrink and wrap, so a wide value is not pushed past the card", async () => {
      await renderBar(over);

      expect(screen.getByText(/^Average/)).toHaveStyle({ flexShrink: 1 });
    });

    it("should keep the value, the target and the overshoot at their own width", async () => {
      await renderBar(over);

      expect(screen.getByText("+250 kcal").parent).toHaveStyle({ flexShrink: 0 });
    });
  });

  describe.each(schemes)("its colours in %s", (scheme) => {
    it("should fill the bar in the calories colour", async () => {
      await renderBar(under, scheme);
      await advance(1500);

      expect(getAnimatedStyle(fill())).toMatchObject({
        backgroundColor: themes[scheme].calories,
      });
    });

    it("should print the overshoot in the primary text colour, never the warning ink", async () => {
      await renderBar(over, scheme);

      expect(screen.getByText("+250 kcal")).toHaveStyle({
        color: resolvedColor(scheme, "text-primary"),
      });
    });

    it("should draw the outline as the calories colour mixed with 45 per cent white, outside a 1 point gap in the card surface colour", async () => {
      await renderBar(over, scheme);

      expect(screen.getByTestId("calories-outline-colour", hidden)).toHaveStyle({
        backgroundColor: ringColourOf(scheme),
        inset: -2.5,
      });
      expect(screen.getByTestId("calories-outline-gap", hidden)).toHaveStyle({
        backgroundColor: resolvedColor(scheme, "surface"),
        inset: -1,
      });
    });

    it("should draw no warning or danger colour when over", async () => {
      const { toJSON } = await renderBar(over, scheme);
      const drawn = JSON.stringify(toJSON()).toLowerCase();

      expect(drawn).not.toMatch(/warning|danger/);
      for (const name of ["warning", "warning-muted", "danger", "danger-muted"] as const) {
        expect(drawn).not.toContain(themes[scheme][name].toLowerCase());
      }
    });
  });

  describe("how far it fills", () => {
    it("should fill 76.4 per cent in the sample week", async () => {
      await renderBar();
      await advance(1500);

      expect(getAnimatedStyle(fill())).toMatchObject({ width: `${(1681.25 / 2200) * 100}%` });
    });

    it("should complete the fill when over, with the outline", async () => {
      await renderBar(over);
      await advance(1500);

      expect(getAnimatedStyle(fill())).toMatchObject({ width: "100%" });
      expect(screen.getByTestId("calories-outline", hidden)).toBeOnTheScreen();
    });

    it("should draw no outline exactly at the target", async () => {
      await renderBar({ ...under, averageKcal: 2200, barFill: 1 });
      await advance(1500);

      expect(getAnimatedStyle(fill())).toMatchObject({ width: "100%" });
      expect(screen.queryByTestId("calories-outline", hidden)).not.toBeOnTheScreen();
    });

    it("should whip in from nothing", async () => {
      await renderBar();

      expect(getAnimatedStyle(fill())).toMatchObject({ width: "0%" });
      await advance(120);
      const { width }: { width?: unknown } = getAnimatedStyle(fill());
      expect(typeof width === "string" ? parseFloat(width) : Number.NaN).toBeGreaterThan(0);
    });

    it("should draw the bar at once with reduced motion", async () => {
      await setReduceMotion(true);
      await renderBar();
      await advance(20);

      expect(getAnimatedStyle(fill())).toMatchObject({ width: `${(1681.25 / 2200) * 100}%` });
      await setReduceMotion(false);
    });
  });
});
