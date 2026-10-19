import { skeletonDelay, themes } from "@keylow/tokens";
import { act, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { getAnimatedStyle, setUpTests } from "react-native-reanimated";

import { Skeleton } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { animatedTranslateX } from "../support/animatedStyle";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";

import type { SkeletonProps } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

function renderSkeleton(props: SkeletonProps = {}, scheme: ThemeScheme = "dark") {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <Skeleton {...props} />
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

// A skeleton is hidden from screen readers, because the screen says what is loading in words, so it has
// no role or name to query by. Its drawing is found by these ids, which exist for this and nothing else,
// and a query has to ask for hidden elements because that is what it is.
const hidden = { includeHiddenElements: true };
const skeleton = () => screen.getByTestId("skeleton", hidden);
const bones = () => screen.getAllByTestId("skeleton-bone", hidden);
const rows = () => screen.getAllByTestId("skeleton-row", hidden);
const shines = () => screen.queryAllByTestId("skeleton-shine-sweep", hidden);

function firstShine() {
  const [shine] = shines();
  if (shine === undefined) {
    throw new Error("The skeleton drew no shine");
  }
  return shine;
}

const schemes: ThemeScheme[] = ["dark", "light"];

describe("Skeleton", () => {
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

  describe("the skeleton delay", () => {
    it("should draw nothing until the 200 ms skeleton delay has passed, so a quick load never flickers", async () => {
      await renderSkeleton();

      await advance(skeletonDelay - 1);

      expect(getAnimatedStyle(skeleton()).opacity).toBe(0);
    });

    it("should fade in once the delay has passed", async () => {
      await renderSkeleton();

      await advance(skeletonDelay + 500);

      expect(getAnimatedStyle(skeleton()).opacity).toBe(1);
    });
  });

  it("should be hidden from screen readers, because the screen says what is loading", async () => {
    await renderSkeleton();

    expect(screen.queryByRole("progressbar")).not.toBeOnTheScreen();
    expect(skeleton()).toHaveProp("aria-hidden", true);
  });

  describe("shaped like a food row", () => {
    it("should be one row with four bones: the icon tile, the name, the macro line and the energy", async () => {
      await renderSkeleton({ variant: "row" });

      expect(rows()).toHaveLength(1);
      expect(bones()).toHaveLength(4);
    });

    it("should be at least 60 points tall, as a food row is", async () => {
      await renderSkeleton({ variant: "row" });

      expect(rows()[0]).toHaveStyle({ minHeight: 60 });
    });

    it("should draw the tile 36 points square, the name 12 tall, the macro line 10 tall and the energy 44 by 16", async () => {
      await renderSkeleton({ variant: "row" });

      const [tile, name, macros, energy] = bones();
      expect(tile).toHaveStyle({ width: 36, height: 36, borderRadius: 6 });
      expect(name).toHaveStyle({ width: "70%", height: 12, borderRadius: 6 });
      expect(macros).toHaveStyle({ width: "35%", height: 10, borderRadius: 6 });
      expect(energy).toHaveStyle({ width: 44, height: 16, borderRadius: 6 });
    });

    it("should be a row by default", async () => {
      await renderSkeleton();

      expect(rows()).toHaveLength(1);
    });
  });

  describe("shaped like a group", () => {
    it("should be a card of three rows by default, as the loading board draws it", async () => {
      await renderSkeleton({ variant: "group" });

      expect(rows()).toHaveLength(3);
      expect(bones()).toHaveLength(12);
    });

    it("should take as many rows as it is asked for", async () => {
      await renderSkeleton({ variant: "group", rows: 5 });

      expect(rows()).toHaveLength(5);
    });

    it("should vary the width of the names, so the rows do not look stamped", async () => {
      await renderSkeleton({ variant: "group" });

      const names = bones().filter((_, index) => index % 4 === 1);
      expect(names[0]).toHaveStyle({ width: "70%" });
      expect(names[1]).toHaveStyle({ width: "52%" });
      expect(names[2]).toHaveStyle({ width: "64%" });
    });

    it("should part the rows with a hairline, and draw none above the first", async () => {
      await renderSkeleton({ variant: "group" });

      expect(rows()[0]).not.toHaveStyle({ borderTopWidth: 1 });
      expect(rows()[1]).toHaveStyle({ borderTopWidth: 1 });
      expect(rows()[2]).toHaveStyle({ borderTopWidth: 1 });
    });
  });

  describe("shaped like the food log", () => {
    it("should be seven day pills, four bars, five hour chips with their plus and two foods", async () => {
      await renderSkeleton({ variant: "diary" });

      // 7 pills, 4 bars with a label and a track each, 5 hours with a chip and a plus, and 2 foods.
      expect(bones()).toHaveLength(7 + 4 * 2 + 5 * 2 + 2);
    });

    it("should draw the day pills 56 points tall with the pill radius", async () => {
      await renderSkeleton({ variant: "diary" });

      expect(bones()[0]).toHaveStyle({ height: 56, borderRadius: 999 });
      expect(bones()[6]).toHaveStyle({ height: 56, borderRadius: 999 });
    });

    it("should draw each bar as a 12 point label over a 4 point track", async () => {
      await renderSkeleton({ variant: "diary" });

      expect(bones()[7]).toHaveStyle({ height: 12 });
      expect(bones()[8]).toHaveStyle({ height: 4 });
    });

    it("should draw an hour as a 64 by 28 chip and a 32 point circle, and a food as a 64 point card", async () => {
      await renderSkeleton({ variant: "diary" });

      expect(bones()[15]).toHaveStyle({ width: 64, height: 28, borderRadius: 999 });
      expect(bones()[16]).toHaveStyle({ width: 32, height: 32, borderRadius: 999 });
      expect(bones()[19]).toHaveStyle({ height: 64, borderRadius: 20 });
    });

    it("should keep the 200 ms delay and stay hidden from screen readers like the others", async () => {
      await renderSkeleton({ variant: "diary" });

      await advance(skeletonDelay - 1);

      expect(getAnimatedStyle(skeleton()).opacity).toBe(0);
      expect(skeleton()).toHaveProp("aria-hidden", true);
    });
  });

  describe("shaped like the food log under a week strip", () => {
    it("should be the bars and the hours without the seven day pills", async () => {
      await renderSkeleton({ variant: "diaryDay" });

      expect(bones()).toHaveLength(4 * 2 + 5 * 2 + 2);
      expect(bones()[0]).toHaveStyle({ height: 12 });
    });
  });

  describe("shaped like the dashboard's nutrition card", () => {
    it("should be a title, three bar rows of a label, a track and the grams, and a caption", async () => {
      await renderSkeleton({ variant: "nutritionCard" });

      expect(bones()).toHaveLength(1 + 3 * 3 + 1);
    });

    it("should draw the title as a bone 72 wide and 20 tall", async () => {
      await renderSkeleton({ variant: "nutritionCard" });

      expect(bones()[0]).toHaveStyle({ width: 72, height: 20 });
    });

    it("should draw the ring as a 200 point circle with a 14 point stroke, and no shine", async () => {
      await renderSkeleton({ variant: "nutritionCard" });

      expect(screen.getByTestId("skeleton-ring", hidden)).toHaveStyle({
        width: 200,
        height: 200,
        borderWidth: 14,
        borderRadius: 9999,
      });
    });

    it("should draw each bar row as a 56 by 12 label, an 8 point pill track and a 12 point grams bone", async () => {
      await renderSkeleton({ variant: "nutritionCard" });

      for (const first of [1, 4, 7]) {
        expect(bones()[first]).toHaveStyle({ width: 56, height: 12 });
        expect(bones()[first + 1]).toHaveStyle({ height: 8, borderRadius: 999 });
        expect(bones()[first + 2]).toHaveStyle({ height: 12 });
      }
    });

    it("should end with a caption bone 140 wide and 12 tall", async () => {
      await renderSkeleton({ variant: "nutritionCard" });

      expect(bones()[10]).toHaveStyle({ width: 140, height: 12 });
    });

    it("should keep the 200 ms delay and stay hidden from screen readers like the others", async () => {
      await renderSkeleton({ variant: "nutritionCard" });

      await advance(skeletonDelay - 1);

      expect(getAnimatedStyle(skeleton()).opacity).toBe(0);
      expect(skeleton()).toHaveProp("aria-hidden", true);
    });
  });

  describe("shaped like the dashboard's This week card", () => {
    it("should be a title, a value line, the bar, a caption and seven circles", async () => {
      await renderSkeleton({ variant: "thisWeekCard" });

      expect(bones()).toHaveLength(4 + 7);
    });

    it("should draw the title as a bone 104 wide and 20 tall, and the value line 12 tall", async () => {
      await renderSkeleton({ variant: "thisWeekCard" });

      expect(bones()[0]).toHaveStyle({ width: 104, height: 20 });
      expect(bones()[1]).toHaveStyle({ height: 12 });
    });

    it("should draw the bar as an 8 point pill and the caption line 12 tall", async () => {
      await renderSkeleton({ variant: "thisWeekCard" });

      expect(bones()[2]).toHaveStyle({ height: 8, borderRadius: 999 });
      expect(bones()[3]).toHaveStyle({ height: 12 });
    });

    it("should draw each of the seven circles 20 points across", async () => {
      await renderSkeleton({ variant: "thisWeekCard" });

      for (const circle of bones().slice(4)) {
        expect(circle).toHaveStyle({ width: 20, height: 20, borderRadius: 9999 });
      }
    });

    it("should keep the 200 ms delay and stay hidden from screen readers like the others", async () => {
      await renderSkeleton({ variant: "thisWeekCard" });

      await advance(skeletonDelay - 1);

      expect(getAnimatedStyle(skeleton()).opacity).toBe(0);
      expect(skeleton()).toHaveProp("aria-hidden", true);
    });
  });

  describe("shaped like the dashboard's body map card", () => {
    it("should be the title, the view, two figures, the legend and two lines", async () => {
      await renderSkeleton({ variant: "bodyMapCard" });

      expect(bones()).toHaveLength(7);
    });

    it("should draw the title 72 wide and 12 tall and the view 104 wide and 14 tall", async () => {
      await renderSkeleton({ variant: "bodyMapCard" });

      expect(bones()[0]).toHaveStyle({ width: 72, height: 12 });
      expect(bones()[1]).toHaveStyle({ width: 104, height: 14 });
    });

    it("should draw each figure 100 wide and 220 tall, the size of the figures it stands in for", async () => {
      await renderSkeleton({ variant: "bodyMapCard" });

      for (const figure of bones().slice(2, 4)) {
        expect(figure).toHaveStyle({ width: 100, height: 220, borderRadius: 12 });
      }
    });

    it("should draw the legend 32 wide and 120 tall, and the two lines 12 tall", async () => {
      await renderSkeleton({ variant: "bodyMapCard" });

      expect(bones()[4]).toHaveStyle({ width: 32, height: 120 });
      expect(bones()[5]).toHaveStyle({ width: "60%", height: 12 });
      expect(bones()[6]).toHaveStyle({ width: 56, height: 12 });
    });

    it("should keep the 200 ms delay and stay hidden from screen readers like the others", async () => {
      await renderSkeleton({ variant: "bodyMapCard" });

      await advance(skeletonDelay - 1);

      expect(getAnimatedStyle(skeleton()).opacity).toBe(0);
      expect(skeleton()).toHaveProp("aria-hidden", true);
    });
  });

  describe("shaped like the Train home", () => {
    it("should be the Today card's four bones, two figures and seven days", async () => {
      await renderSkeleton({ variant: "trainHome" });

      expect(bones()).toHaveLength(4 + 2 + 7);
    });

    it("should draw the Today card as a 140 and a 90 wide title and caption, a 200 wide line and a 44 tall button", async () => {
      await renderSkeleton({ variant: "trainHome" });

      expect(bones()[0]).toHaveStyle({ width: 140, height: 12 });
      expect(bones()[1]).toHaveStyle({ width: 90, height: 22 });
      expect(bones()[2]).toHaveStyle({ width: 200, height: 12 });
      expect(bones()[3]).toHaveStyle({ height: 44, borderRadius: 12 });
    });

    it("should draw the body map as two figures 90 wide and 198 tall, round at the top", async () => {
      await renderSkeleton({ variant: "trainHome" });

      for (const figure of bones().slice(4, 6)) {
        expect(figure).toHaveStyle({
          width: 90,
          height: 198,
          borderTopLeftRadius: 45,
          borderTopRightRadius: 45,
          borderBottomLeftRadius: 20,
          borderBottomRightRadius: 20,
        });
      }
    });

    it("should draw the week as seven cells 56 tall", async () => {
      await renderSkeleton({ variant: "trainHome" });

      for (const cell of bones().slice(6)) {
        expect(cell).toHaveStyle({ height: 56 });
      }
    });

    it("should keep the 200 ms delay and stay hidden from screen readers like the others", async () => {
      await renderSkeleton({ variant: "trainHome" });

      await advance(skeletonDelay - 1);

      expect(getAnimatedStyle(skeleton()).opacity).toBe(0);
      expect(skeleton()).toHaveProp("aria-hidden", true);
    });
  });

  describe("shaped like the history list", () => {
    it("should be a week heading and a card of three rows of a date block, a name and a line", async () => {
      await renderSkeleton({ variant: "historyList" });

      expect(bones()).toHaveLength(1 + 3 * 3);
    });

    it("should draw the week heading as a 160 wide and 12 tall bone", async () => {
      await renderSkeleton({ variant: "historyList" });

      expect(bones()[0]).toHaveStyle({ width: 160, height: 12 });
    });

    it("should draw each row as a 40 by 44 date block over a name 14 tall and a line 12 tall", async () => {
      await renderSkeleton({ variant: "historyList" });

      const [, ...rowBones] = bones();
      const names = [90, 70, 80];
      const lines = [170, 150, 180];
      names.forEach((nameWidth, row) => {
        expect(rowBones[row * 3]).toHaveStyle({ width: 40, height: 44 });
        expect(rowBones[row * 3 + 1]).toHaveStyle({ width: nameWidth, height: 14 });
        expect(rowBones[row * 3 + 2]).toHaveStyle({ width: lines[row], height: 12 });
      });
    });

    it("should keep the 200 ms delay and stay hidden from screen readers like the others", async () => {
      await renderSkeleton({ variant: "historyList" });

      await advance(skeletonDelay - 1);

      expect(getAnimatedStyle(skeleton()).opacity).toBe(0);
      expect(skeleton()).toHaveProp("aria-hidden", true);
    });
  });

  describe("shaped like the body map screen", () => {
    it("should be the view label and its line, two figures, the legend bar and its caption", async () => {
      await renderSkeleton({ variant: "bodyMap" });

      expect(bones()).toHaveLength(6);
    });

    it("should draw the view label 104 wide and 14 tall and its line 168 wide and 12 tall", async () => {
      await renderSkeleton({ variant: "bodyMap" });

      expect(bones()[0]).toHaveStyle({ width: 104, height: 14 });
      expect(bones()[1]).toHaveStyle({ width: 168, height: 12 });
    });

    it("should draw each figure at most 140 wide and 2.2 times as tall as it is wide, so it is the size of the figure whatever the phone", async () => {
      await renderSkeleton({ variant: "bodyMap" });

      for (const figure of bones().slice(2, 4)) {
        expect(figure).toHaveStyle({
          flexGrow: 1,
          maxWidth: 140,
          aspectRatio: "200 / 440",
          borderRadius: 12,
        });
      }
    });

    it("should draw the legend bar 10 tall and its caption 12 tall", async () => {
      await renderSkeleton({ variant: "bodyMap" });

      expect(bones()[4]).toHaveStyle({ height: 10 });
      expect(bones()[5]).toHaveStyle({ width: "60%", height: 12 });
    });

    it("should keep the 200 ms delay and stay hidden from screen readers like the others", async () => {
      await renderSkeleton({ variant: "bodyMap" });

      await advance(skeletonDelay - 1);

      expect(getAnimatedStyle(skeleton()).opacity).toBe(0);
      expect(skeleton()).toHaveProp("aria-hidden", true);
    });
  });

  describe("shaped like a food's page", () => {
    it("should be five bones: two lines of a name, a source pill, and the two cards under them", async () => {
      await renderSkeleton({ variant: "detail" });

      expect(bones()).toHaveLength(5);
    });

    it("should draw the name as an 80 percent and a 45 percent line, each 24 points tall", async () => {
      await renderSkeleton({ variant: "detail" });

      const [firstLine, secondLine] = bones();
      expect(firstLine).toHaveStyle({ width: "80%", height: 24, borderRadius: 6 });
      expect(secondLine).toHaveStyle({ width: "45%", height: 24, borderRadius: 6 });
    });

    it("should draw the source as a pill 90 points wide and 20 tall", async () => {
      await renderSkeleton({ variant: "detail" });

      expect(bones()[2]).toHaveStyle({ width: 90, height: 20, borderRadius: 999 });
    });

    it("should draw the two cards 140 and 236 points tall with the large radius", async () => {
      await renderSkeleton({ variant: "detail" });

      expect(bones()[3]).toHaveStyle({ height: 140, borderRadius: 20 });
      expect(bones()[4]).toHaveStyle({ height: 236, borderRadius: 20 });
    });

    it("should keep the 200 ms delay and stay hidden from screen readers like the others", async () => {
      await renderSkeleton({ variant: "detail" });

      await advance(skeletonDelay - 1);

      expect(getAnimatedStyle(skeleton()).opacity).toBe(0);
      expect(skeleton()).toHaveProp("aria-hidden", true);
    });
  });

  describe.each(schemes)("in the %s scheme", (scheme) => {
    it("should draw every bone in the skeleton base colour", async () => {
      await renderSkeleton({ variant: "row" }, scheme);

      for (const bone of bones()) {
        expect(bone).toHaveStyle({ backgroundColor: resolvedColor(scheme, "skeleton-base") });
      }
    });

    it("should shine in the skeleton shine token, fading to clear at both edges", async () => {
      await renderSkeleton({ variant: "row" }, scheme);

      const [band] = screen.getAllByTestId("skeleton-shine-band", hidden);
      expect(band).toHaveStyle({
        experimental_backgroundImage: `linear-gradient(100deg, transparent, ${themes[scheme]["skeleton-shine"]}, transparent)`,
      });
    });

    it("should draw the nutrition card's ring in the skeleton base colour", async () => {
      await renderSkeleton({ variant: "nutritionCard" }, scheme);

      expect(screen.getByTestId("skeleton-ring", hidden)).toHaveStyle({
        borderColor: resolvedColor(scheme, "skeleton-base"),
      });
    });

    it("should draw the group on a card: the surface, a hairline border and the large radius", async () => {
      await renderSkeleton({ variant: "group" }, scheme);

      expect(screen.getByTestId("skeleton-card", hidden)).toHaveStyle({
        backgroundColor: resolvedColor(scheme, "surface"),
        borderColor: resolvedColor(scheme, "border"),
        borderWidth: 1,
        borderRadius: 20,
      });
    });
  });

  describe("the shine", () => {
    // The design's kl-shimmer is a gradient 40 percent of a 200 percent wide image, so a band 0.8 of a bone
    // wide, whose peak travels 4 bone widths in 1400 ms linear with the band clear of the bone for the rest.
    it("should be as tall as its bone, so it does not float on a tall card", async () => {
      await renderSkeleton({ variant: "detail" });

      const [band] = screen.getAllByTestId("skeleton-shine-band", hidden);
      expect(band).toHaveStyle({ height: "100%" });
    });

    it("should grow its sweep to the bone's height, or the full height band collapses to nothing", async () => {
      await renderSkeleton({ variant: "detail" });

      expect(getAnimatedStyle(firstShine()).flexGrow).toBe(1);
    });

    it("should be a band 80 percent of a bone wide", async () => {
      await renderSkeleton({ variant: "row" });

      const [band] = screen.getAllByTestId("skeleton-shine-band", hidden);
      expect(band).toHaveStyle({ width: "80%" });
    });

    it("should travel from 140 percent left of the bone to 260 percent right of it, over 1400 ms", async () => {
      await renderSkeleton({ variant: "row" });
      await advance(1);
      const start = parseFloat(animatedTranslateX(firstShine()) ?? "");

      await advance(699);
      const middle = parseFloat(animatedTranslateX(firstShine()) ?? "");

      expect(start).toBeCloseTo(-140, 0);
      expect(middle).toBeCloseTo(60, 0);
    });

    it("should sweep across each bone, which the design draws as a shimmer", async () => {
      await renderSkeleton({ variant: "row" });
      await advance(100);
      const early = animatedTranslateX(firstShine());

      await advance(500);

      expect(animatedTranslateX(firstShine())).not.toBe(early);
    });

    it("should draw no shine when the user has reduced motion on, and keep the bones", async () => {
      setReduceMotion(true);
      await renderSkeleton({ variant: "row" });
      await advance(skeletonDelay + 500);

      expect(shines()).toHaveLength(0);
      expect(bones()).toHaveLength(4);
      expect(getAnimatedStyle(skeleton()).opacity).toBe(1);
    });
  });
});
