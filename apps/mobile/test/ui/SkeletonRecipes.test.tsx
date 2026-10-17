import { render, screen } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { Skeleton } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { viewsDrawn } from "../support/viewsDrawn";

import type { SkeletonProps } from "../../components/ui";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

async function renderSkeleton(props: SkeletonProps) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <Skeleton {...props} />
    </ThemeProvider>,
  );
}

// A skeleton is hidden from screen readers, because the screen says what is loading in words, so its
// drawing is found by ids, and a query has to ask for hidden elements.
const hidden = { includeHiddenElements: true };
const rows = () => screen.getAllByTestId("skeleton-recipe-row", hidden);
const bones = () => screen.getAllByTestId("skeleton-bone", hidden);

describe("Skeleton shaped like the recipe library", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should be a card of as many rows as it is asked for", async () => {
    await renderSkeleton({ variant: "recipeGroup", rows: 4 });

    expect(screen.getByTestId("skeleton-card", hidden)).toBeOnTheScreen();
    expect(rows()).toHaveLength(4);
  });

  it("should draw a tile, a title and a caption on each row, and no value at the end", async () => {
    await renderSkeleton({ variant: "recipeGroup", rows: 4 });

    expect(bones()).toHaveLength(12);
  });

  it("should make each row 80 points tall at least, as the loading board draws it", async () => {
    await renderSkeleton({ variant: "recipeGroup", rows: 4 });

    expect(viewsDrawn({ minHeight: 80 })).toHaveLength(4);
  });

  it("should vary the width of the titles, and keep the captions at 55 percent", async () => {
    await renderSkeleton({ variant: "recipeGroup", rows: 4 });

    const titles = bones().filter((_, index) => index % 3 === 1);
    const captions = bones().filter((_, index) => index % 3 === 2);
    expect(titles[0]).toHaveStyle({ width: "70%" });
    expect(titles[1]).toHaveStyle({ width: "55%" });
    expect(titles[2]).toHaveStyle({ width: "80%" });
    expect(titles[3]).toHaveStyle({ width: "62%" });
    for (const caption of captions) {
      expect(caption).toHaveStyle({ width: "55%" });
    }
  });

  it("should part the rows with a hairline, and draw none above the first", async () => {
    await renderSkeleton({ variant: "recipeGroup", rows: 4 });

    expect(rows()[0]).not.toHaveStyle({ borderTopWidth: 1 });
    expect(rows()[1]).toHaveStyle({ borderTopWidth: 1 });
  });
});

describe("Skeleton shaped like the recipe view", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should draw the two cards as blocks, then a card of three rows", async () => {
    await renderSkeleton({ variant: "recipeView" });

    expect(screen.getByTestId("skeleton-recipe-view", hidden)).toBeOnTheScreen();
    expect(screen.getByTestId("skeleton-card", hidden)).toBeOnTheScreen();
    // Per serving: 2 + 3 tiles + 1. Servings: 2 + 1. Rows: 3 tiles + 3 titles + 3 captions.
    expect(bones()).toHaveLength(6 + 3 + 9);
  });

  it("should pad the Servings block 12 above and below and 16 at the sides, as the board does", async () => {
    await renderSkeleton({ variant: "recipeView" });

    expect(
      viewsDrawn({ paddingTop: 12, paddingBottom: 12, paddingLeft: 16, paddingRight: 16 }),
    ).toHaveLength(1);
  });

  it("should vary the row names' widths as the board does", async () => {
    await renderSkeleton({ variant: "recipeView" });

    // After the Per serving block (6 bones) and the Servings block (3), each row is a tile, a name and a caption.
    const names = [bones()[10], bones()[13], bones()[16]];
    expect(names[0]).toHaveStyle({ width: "68%" });
    expect(names[1]).toHaveStyle({ width: "52%" });
    expect(names[2]).toHaveStyle({ width: "74%" });
  });

  it("should be hidden from screen readers, because the screen says what is loading", async () => {
    await renderSkeleton({ variant: "recipeView" });

    expect(screen.queryByTestId("skeleton-recipe-view")).not.toBeOnTheScreen();
  });
});

describe("Skeleton shaped like the refresh screen", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should draw the intro line, a Per serving block of four lines, and two cards", async () => {
    await renderSkeleton({ variant: "recipeRefresh" });

    expect(screen.getByTestId("skeleton-recipe-refresh", hidden)).toBeOnTheScreen();
    // Intro 1. Per serving: a heading and four lines of two. Cards: 3 and 2.
    expect(bones()).toHaveLength(1 + (1 + 8) + 3 + 2);
  });

  it("should vary the widths of the four values as the board does", async () => {
    await renderSkeleton({ variant: "recipeRefresh" });

    const values = [bones()[3], bones()[5], bones()[7], bones()[9]];
    expect(values[0]).toHaveStyle({ width: 84 });
    expect(values[1]).toHaveStyle({ width: 64 });
    expect(values[2]).toHaveStyle({ width: 48 });
    expect(values[3]).toHaveStyle({ width: 64 });
  });

  it("should be hidden from screen readers, because the screen says what is loading", async () => {
    await renderSkeleton({ variant: "recipeRefresh" });

    expect(screen.queryByTestId("skeleton-recipe-refresh")).not.toBeOnTheScreen();
  });
});
