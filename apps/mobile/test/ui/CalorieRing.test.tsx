import { themes } from "@keylow/tokens";
import { act, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { getAnimatedStyle, setUpTests } from "react-native-reanimated";

import { CalorieRing } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";
import { viewsDrawn } from "../support/viewsDrawn";

import type { CalorieRingProps } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// Skia draws nothing in Jest, so this stands in for it and keeps what each arc was given.
type DrawnArc = { color: string; start: unknown; end: unknown; strokeWidth: number };
const mockArcs: DrawnArc[] = [];
jest.mock("@shopify/react-native-skia", () => ({
  __esModule: true,
  Canvas: ({ children }: { children: unknown }) => children,
  Path: (arc: DrawnArc) => {
    mockArcs.push(arc);
    return null;
  },
}));

setUpTests();

const defaultProps: CalorieRingProps = { eaten: 1039, target: 2200 };

function renderRing(props: Partial<CalorieRingProps> = {}, scheme: ThemeScheme = "dark") {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <CalorieRing {...defaultProps} {...props} />
    </ThemeProvider>,
  );
}

async function setReduceMotion(isEnabled: boolean) {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(isEnabled);
  // The first render starts the system read, so one render lets the answer in before the test acts.
  await act(() => Promise.resolve());
}

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds);
  });
}

// The newest draw of each arc, found by the colour it is drawn in. A track and a fill have different colours.
function latestArcs(color: string): DrawnArc | undefined {
  return mockArcs.findLast((arc) => arc.color === color);
}

// A shared value is read the way Skia reads it, and a plain number is itself.
function fractionOf(value: unknown): number | undefined {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "object" && value !== null && "get" in value) {
    const read: unknown = value.get;
    if (typeof read === "function") {
      const result: unknown = read.call(value);
      return typeof result === "number" ? result : undefined;
    }
  }
  return undefined;
}

const schemes: ThemeScheme[] = ["dark", "light"];

describe("CalorieRing", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(async () => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
    mockArcs.length = 0;
    await setReduceMotion(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("what it says", () => {
    it("should be one image named by what was eaten, the target and what is left", async () => {
      await renderRing();

      expect(
        screen.getByRole("img", { name: "1,039 eaten of 2,200 target, 1,161 remaining" }),
      ).toBeOnTheScreen();
    });

    it("should print the calories left under the target, with the label under it", async () => {
      await renderRing();

      expect(screen.getByText("1,161")).toBeOnTheScreen();
      expect(screen.getByText("remaining")).toBeOnTheScreen();
    });

    it("should print the eaten line and the target line with (est.) by default", async () => {
      await renderRing();

      expect(screen.getByText("1,039 eaten")).toBeOnTheScreen();
      expect(screen.getByText("2,200 target (est.)")).toBeOnTheScreen();
    });

    it("should leave (est.) off the target line when the target is not an estimate", async () => {
      await renderRing({ estimate: false });

      expect(screen.getByText("2,200 target")).toBeOnTheScreen();
      expect(screen.queryByText(/\(est\.\)/)).not.toBeOnTheScreen();
    });

    it("should take another label for the caption", async () => {
      await renderRing({ label: "left today" });

      expect(screen.getByText("left today")).toBeOnTheScreen();
      expect(screen.queryByText("remaining")).not.toBeOnTheScreen();
    });

    it("should read nothing remaining at the target, and not call it over", async () => {
      await renderRing({ eaten: 2200 });

      expect(screen.getByText("0")).toBeOnTheScreen();
      expect(screen.getByText("remaining")).toBeOnTheScreen();
      expect(screen.queryByText("over target")).not.toBeOnTheScreen();
    });

    it("should read the amount over the target and say over target when it is passed", async () => {
      await renderRing({ eaten: 2412 });

      expect(
        screen.getByRole("img", { name: "2,412 eaten of 2,200 target, 212 over" }),
      ).toBeOnTheScreen();
      expect(screen.getByText("212")).toBeOnTheScreen();
      expect(screen.getByText("over target")).toBeOnTheScreen();
      expect(screen.queryByText("remaining")).not.toBeOnTheScreen();
    });

    it("should draw no eaten or target lines when it is compact", async () => {
      await renderRing({ size: 160 });

      expect(screen.getByText("1,161")).toBeOnTheScreen();
      expect(screen.queryByText("1,039 eaten")).not.toBeOnTheScreen();
      expect(screen.queryByText(/target/)).not.toBeOnTheScreen();
    });

    it("should draw the lines at 180, the first size that is not compact", async () => {
      await renderRing({ size: 180 });

      expect(screen.getByText("1,039 eaten")).toBeOnTheScreen();
    });

    // The diary canvas draws the ring at 200 with a 44 point numeral (board diary.today). These are
    // literals, so changing a constant alone turns this red.
    it("should be 200 points square by default, with a 14 point stroke and a 44 point numeral", async () => {
      await renderRing();

      expect(viewsDrawn({ width: 200, height: 200 })).toHaveLength(1);
      expect(latestArcs(themes.dark.border)?.strokeWidth).toBe(14);
      expect(screen.getByText("1,161").parent).toHaveStyle({ fontSize: 44 });
    });

    it("should keep its centre 28 points in from the edge, so the text never touches the stroke", async () => {
      await renderRing();

      expect(screen.getByText("1,161").parent?.parent).toHaveStyle({
        position: "absolute",
        inset: 28,
      });
    });

    it("should draw the numeral at the canvas size, and at the heading size when compact", async () => {
      const { rerender } = await renderRing();
      // The count is a nested span that carries only the colour, so the size is on the numeral around it.
      expect(screen.getByText("1,161").parent).toHaveStyle({ fontSize: 44, lineHeight: 48 });

      await rerender(
        <ThemeProvider fixedPreference="dark">
          <CalorieRing {...defaultProps} size={160} />
        </ThemeProvider>,
      );

      expect(screen.getByText("1,161").parent).toHaveStyle({ fontSize: 28 });
    });
  });

  describe.each(schemes)("its colours in %s", (scheme) => {
    it("should set the numeral and the caption in the primary text colour under the target", async () => {
      await renderRing({}, scheme);

      expect(screen.getByText("1,161")).toHaveStyle({
        color: resolvedColor(scheme, "text-primary"),
      });
      expect(screen.getByText("remaining")).toHaveStyle({
        color: resolvedColor(scheme, "text-secondary"),
      });
    });

    it("should set the numeral and the caption in the warning ink over the target", async () => {
      await renderRing({ eaten: 2412 }, scheme);
      const ink = resolvedColor(scheme, "warning-ink");

      expect(screen.getByText("212")).toHaveStyle({ color: ink });
      expect(screen.getByText("over target")).toHaveStyle({ color: ink });
    });

    it("should draw the track in border and the fill in calories under the target", async () => {
      await renderRing({}, scheme);
      await advance(1000);

      expect(fractionOf(latestArcs(themes[scheme].border)?.end)).toBe(1);
      expect(fractionOf(latestArcs(themes[scheme].calories)?.end)).toBeCloseTo(1039 / 2200, 5);
      expect(latestArcs(themes[scheme].warning)).toBeUndefined();
    });

    it("should fill the calories to the end and keep filling in warning on top over the target", async () => {
      await renderRing({ eaten: 2412 }, scheme);
      await advance(1000);

      expect(fractionOf(latestArcs(themes[scheme].calories)?.end)).toBe(1);
      expect(fractionOf(latestArcs(themes[scheme].warning)?.end)).toBeCloseTo(212 / 2200, 5);
    });

    it("should never draw the ring in danger", async () => {
      await renderRing({ eaten: 9000 }, scheme);
      await advance(1000);

      expect(mockArcs.map((arc) => arc.color)).not.toContain(themes[scheme].danger);
    });
  });

  describe("how far it fills", () => {
    it("should stop the warning at a full lap, so it never resets", async () => {
      await renderRing({ eaten: 9000 });
      await advance(1000);

      expect(fractionOf(latestArcs(themes.dark.warning)?.end)).toBe(1);
    });

    it("should draw no fill when nothing is eaten", async () => {
      await renderRing({ eaten: 0 });
      await advance(1000);

      expect(latestArcs(themes.dark.calories)).toBeUndefined();
    });

    it("should draw no fill when there is no target", async () => {
      await renderRing({ eaten: 500, target: 0 });
      await advance(1000);

      expect(latestArcs(themes.dark.calories)).toBeUndefined();
    });

    it("should draw the notch between the fill and the warning in the background colour", async () => {
      await renderRing({ eaten: 2412 });
      await advance(1000);

      const notch = latestArcs(themes.dark.background);
      expect(fractionOf(notch?.start)).toBeCloseTo(212 / 2200 - 1 / (Math.PI * (200 - 14)), 4);
      expect(notch?.strokeWidth).toBe(18);
    });

    it("should draw the stroke at the width given", async () => {
      await renderRing({ stroke: 10 });

      expect(latestArcs(themes.dark.border)?.strokeWidth).toBe(10);
    });
  });

  describe("how it moves", () => {
    it("should whip the fill in from nothing", async () => {
      await renderRing();

      expect(fractionOf(latestArcs(themes.dark.calories)?.end)).toBe(0);

      await advance(300);
      const partway = fractionOf(latestArcs(themes.dark.calories)?.end) ?? 0;
      expect(partway).toBeGreaterThan(0);
      expect(partway).toBeLessThan(1039 / 2200);

      await advance(400);
      expect(fractionOf(latestArcs(themes.dark.calories)?.end)).toBeCloseTo(1039 / 2200, 5);
    });

    it("should count the numeral up to a new value, then show it", async () => {
      const { rerender } = await renderRing();

      await rerender(
        <ThemeProvider fixedPreference="dark">
          <CalorieRing {...defaultProps} eaten={1639} />
        </ThemeProvider>,
      );
      await advance(100);
      expect(screen.queryByText("1,161")).not.toBeOnTheScreen();
      expect(screen.queryByText("561")).not.toBeOnTheScreen();

      await advance(500);
      expect(screen.getByText("561")).toBeOnTheScreen();
    });

    it("should flash the accent on the numeral when the count arrives, then settle", async () => {
      const { rerender } = await renderRing();

      await rerender(
        <ThemeProvider fixedPreference="dark">
          <CalorieRing {...defaultProps} eaten={1639} />
        </ThemeProvider>,
      );
      await advance(450);
      expect(getAnimatedStyle(screen.getByText("561"))).toMatchObject({
        color: expect.stringContaining("204, 242, 73") as unknown,
      });

      await advance(600);
      expect(getAnimatedStyle(screen.getByText("561"))).toMatchObject({
        color: resolvedColor("dark", "text-primary"),
      });
    });

    describe("with reduced motion", () => {
      beforeEach(async () => {
        await setReduceMotion(true);
      });

      afterEach(async () => {
        await setReduceMotion(false);
      });

      it("should draw the fill at once", async () => {
        await renderRing();

        expect(fractionOf(latestArcs(themes.dark.calories)?.end)).toBeCloseTo(1039 / 2200, 5);
      });

      it("should jump the numeral to a new value, with no flash", async () => {
        const { rerender } = await renderRing();

        await rerender(
          <ThemeProvider fixedPreference="dark">
            <CalorieRing {...defaultProps} eaten={1639} />
          </ThemeProvider>,
        );
        await advance(10);

        expect(screen.getByText("561")).toBeOnTheScreen();
        expect(getAnimatedStyle(screen.getByText("561"))).toMatchObject({
          color: resolvedColor("dark", "text-primary"),
        });
      });
    });
  });
});
