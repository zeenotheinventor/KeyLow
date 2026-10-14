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
