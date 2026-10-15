import { themes } from "@keylow/tokens";
import { act, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { getAnimatedStyle, setUpTests } from "react-native-reanimated";

import { MacroBars } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";

import type { MacroBarsProps } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// Skia draws nothing in Jest. The warning cap's stripes are Skia, so this stands in for it.
jest.mock("@shopify/react-native-skia", () => ({
  __esModule: true,
  Canvas: ({ children }: { children: unknown }) => children,
  Path: () => null,
}));

setUpTests();

const under: MacroBarsProps = {
  protein: { eaten: 86, target: 160 },
  carbs: { eaten: 129.1, target: 220 },
  fat: { eaten: 19, target: 70 },
};
const over: MacroBarsProps = {
  protein: { eaten: 150, target: 160 },
  carbs: { eaten: 257, target: 220 },
  fat: { eaten: 81, target: 70 },
};
const noTarget: MacroBarsProps = {
  protein: { eaten: 86, target: 0 },
  carbs: { eaten: 129.1, target: 0 },
  fat: { eaten: 19, target: 0 },
};

function renderBars(props: MacroBarsProps = under, scheme: ThemeScheme = "dark") {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <MacroBars {...props} />
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

// The bar of a row has no role or name of its own, because the row says the same in words. It is found
// by the ids that exist for this and nothing else.
const hidden = { includeHiddenElements: true };
const fillOf = (row: string) => {
  const [fill] = screen.getAllByTestId(`${row}-fill`, hidden);
  if (fill === undefined) {
    throw new Error(`The ${row} row drew no fill`);
  }
  return fill;
};

// How full a bar is drawn right now, as a per cent of its track.
function fillPercent(row: string): number {
  const { width }: { width?: unknown } = getAnimatedStyle(fillOf(row));
  return typeof width === "string" ? parseFloat(width) : Number.NaN;
}

const schemes: ThemeScheme[] = ["dark", "light"];

describe("MacroBars", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
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
    it("should name each row by the macro, the grams eaten and the target", async () => {
      await renderBars();

      expect(screen.getByRole("group", { name: "Protein: 86 of 160 grams" })).toBeOnTheScreen();
      expect(screen.getByRole("group", { name: "Carbs: 129 of 220 grams" })).toBeOnTheScreen();
      expect(screen.getByRole("group", { name: "Fat: 19 of 70 grams" })).toBeOnTheScreen();
    });

    it("should label every row in words, and print grams against the target", async () => {
      await renderBars();

      expect(screen.getByText("Protein")).toBeOnTheScreen();
      expect(screen.getByText("Carbs")).toBeOnTheScreen();
      expect(screen.getByText("Fat")).toBeOnTheScreen();
      expect(screen.getByText("86")).toBeOnTheScreen();
      expect(screen.getByText("/ 160 g")).toBeOnTheScreen();
      expect(screen.getByText("129")).toBeOnTheScreen();
      expect(screen.getByText("/ 220 g")).toBeOnTheScreen();
    });

    it("should keep one decimal under 10 grams only", async () => {
      await renderBars({ ...under, fat: { eaten: 4.5, target: 70 } });

      expect(screen.getByText("4.5")).toBeOnTheScreen();
    });

    it("should print no delta under the target", async () => {
      await renderBars();

      expect(screen.queryByText(/^\+/)).not.toBeOnTheScreen();
    });

    it("should print the delta in grams, and name it, for each row over the target", async () => {
      await renderBars(over);

      expect(screen.getByRole("group", { name: "Protein: 150 of 160 grams" })).toBeOnTheScreen();
      expect(
        screen.getByRole("group", { name: "Carbs: 257 of 220 grams, 37 over" }),
      ).toBeOnTheScreen();
      expect(screen.getByRole("group", { name: "Fat: 81 of 70 grams, 11 over" })).toBeOnTheScreen();
      expect(screen.getByText("+37 g")).toBeOnTheScreen();
      expect(screen.getByText("+11 g")).toBeOnTheScreen();
    });

    it("should print the grams and a bare g when there is no target, with no delta", async () => {
      await renderBars(noTarget);

      expect(screen.getByRole("group", { name: "Protein: 86 grams" })).toBeOnTheScreen();
      expect(screen.getAllByText("g")).toHaveLength(3);
      expect(screen.queryByText(/\//)).not.toBeOnTheScreen();
      expect(screen.queryByText(/^\+/)).not.toBeOnTheScreen();
    });

    it("should draw a compact row with the same words", async () => {
      await renderBars({ ...under, compact: true });

      expect(screen.getByRole("group", { name: "Protein: 86 of 160 grams" })).toBeOnTheScreen();
    });
  });

  describe.each(schemes)("its colours in %s", (scheme) => {
    it("should fill each bar in its macro colour", async () => {
      await renderBars(under, scheme);
      await advance(1500);

      expect(getAnimatedStyle(fillOf("protein"))).toMatchObject({
        backgroundColor: themes[scheme].protein,
      });
      expect(getAnimatedStyle(fillOf("carbs"))).toMatchObject({
        backgroundColor: themes[scheme].carbs,
      });
      expect(getAnimatedStyle(fillOf("fat"))).toMatchObject({
        backgroundColor: themes[scheme].fat,
      });
    });

    it("should set the delta in the warning ink", async () => {
      await renderBars(over, scheme);
      const ink = resolvedColor(scheme, "warning-ink");

      expect(screen.getByText("+11 g")).toHaveStyle({ color: ink });
    });

    it("should set the grams eaten in the primary text colour, over or not", async () => {
      await renderBars(over, scheme);

      expect(screen.getByText("81")).toHaveStyle({ color: resolvedColor(scheme, "text-primary") });
    });
  });

  describe("how far each bar fills", () => {
    it("should fill each bar to eaten over target", async () => {
      await renderBars();
      await advance(1500);

      expect(getAnimatedStyle(fillOf("protein"))).toMatchObject({ width: "53.75%" });
      expect(getAnimatedStyle(fillOf("fat"))).toMatchObject({ width: `${(19 / 70) * 100}%` });
    });

    it("should complete the fill of a bar that is over the target", async () => {
      await renderBars(over);
      await advance(1500);

      expect(getAnimatedStyle(fillOf("carbs"))).toMatchObject({ width: "100%" });
    });

    it("should draw the warning cap only on a bar that is over the target", async () => {
      await renderBars(over);
      await advance(1500);

      expect(screen.getAllByTestId("carbs-cap", hidden)).toHaveLength(1);
      expect(screen.getAllByTestId("fat-cap", hidden)).toHaveLength(1);
      expect(screen.queryByTestId("protein-cap", hidden)).not.toBeOnTheScreen();
    });

    it("should size the cap by the overflow, up to 35 per cent of the bar", async () => {
      await renderBars({ ...over, carbs: { eaten: 440, target: 220 } });
      await advance(1500);

      expect(getAnimatedStyle(screen.getByTestId("carbs-cap", hidden))).toMatchObject({
        width: "35%",
      });
      expect(getAnimatedStyle(screen.getByTestId("fat-cap", hidden))).toMatchObject({
        width: `${(81 / 70 - 1) * 100}%`,
      });
    });

    it("should leave the bar empty when there is no target", async () => {
      await renderBars(noTarget);
      await advance(1500);

      expect(getAnimatedStyle(fillOf("protein"))).toMatchObject({ width: "0%" });
      expect(screen.queryByTestId("protein-cap", hidden)).not.toBeOnTheScreen();
    });
  });

  describe("how it moves", () => {
    it("should whip each bar in from nothing, one after another", async () => {
      await renderBars();

      expect(getAnimatedStyle(fillOf("protein"))).toMatchObject({ width: "0%" });

      // 36 ms after the first, the second has started and the first is already ahead of it.
      await advance(120);
      const protein = fillPercent("protein") / (86 / 160);
      const carbs = fillPercent("carbs") / (129.1 / 220);
      const fat = fillPercent("fat") / (19 / 70);
      expect(fillPercent("protein")).toBeGreaterThan(0);
      expect(carbs).toBeLessThan(protein);
      expect(fat).toBeLessThan(carbs);
    });

    it("should land every bar on its fill", async () => {
      await renderBars();
      await advance(1500);

      expect(getAnimatedStyle(fillOf("carbs")).width).toBe(`${(129.1 / 220) * 100}%`);
    });

    it("should draw every bar at once with reduced motion", async () => {
      await setReduceMotion(true);
      await renderBars(over);
      await advance(20);

      expect(getAnimatedStyle(fillOf("protein"))).toMatchObject({ width: "93.75%" });
      expect(getAnimatedStyle(fillOf("fat"))).toMatchObject({ width: "100%" });
      await setReduceMotion(false);
    });
  });
});
