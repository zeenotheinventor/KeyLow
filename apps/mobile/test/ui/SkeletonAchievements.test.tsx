import { skeletonDelay } from "@keylow/tokens";
import { act, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { getAnimatedStyle, setUpTests } from "react-native-reanimated";

import { Skeleton } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { viewsDrawn } from "../support/viewsDrawn";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

async function renderAchievementsSkeleton() {
  await render(
    <ThemeProvider fixedPreference="dark">
      <Skeleton variant="achievements" />
    </ThemeProvider>,
  );
}

// A skeleton is hidden from screen readers, because the screen says what is loading in words, so its
// drawing is found by ids, and a query has to ask for hidden elements.
const hidden = { includeHiddenElements: true };
const bones = () => screen.getAllByTestId("skeleton-bone", hidden);

describe("Skeleton shaped like the Achievements screen", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("should be the level card, three tiles, a heading bar and eight badges, as the loading board draws them", async () => {
    await renderAchievementsSkeleton();

    expect(bones()).toHaveLength(1 + 3 + 1 + 8);
  });

  it("should draw the level card as a 118 tall block with the large corners", async () => {
    await renderAchievementsSkeleton();

    expect(bones()[0]).toHaveStyle({ height: 118, borderRadius: 20 });
  });

  it("should draw each stat tile as a 68 tall block with the medium corners", async () => {
    await renderAchievementsSkeleton();

    for (const tile of bones().slice(1, 4)) {
      expect(tile).toHaveStyle({ height: 68, borderRadius: 12 });
    }
  });

  it("should draw the heading as a 160 wide and 20 tall bar", async () => {
    await renderAchievementsSkeleton();

    expect(bones()[4]).toHaveStyle({ width: 160, height: 20 });
  });

  it("should draw each badge as a 56 point circle", async () => {
    await renderAchievementsSkeleton();

    for (const badge of bones().slice(5)) {
      expect(badge).toHaveStyle({ width: 56, height: 56, borderRadius: 9999 });
    }
  });

  it("should lay the badges out in four columns like the category grid", async () => {
    await renderAchievementsSkeleton();

    const cells = screen.getAllByTestId("skeleton-badge-cell", hidden);
    expect(cells).toHaveLength(8);
    for (const cell of cells) {
      expect(cell).toHaveStyle({ width: "25%", alignItems: "center" });
    }
    expect(viewsDrawn({ flexWrap: "wrap", flexDirection: "row" })).toHaveLength(1);
  });

  it("should draw nothing for the first 200 ms and stay hidden from screen readers like the others", async () => {
    await renderAchievementsSkeleton();

    await act(() => {
      jest.advanceTimersByTime(skeletonDelay - 1);
    });

    expect(getAnimatedStyle(screen.getByTestId("skeleton", hidden)).opacity).toBe(0);
    expect(screen.getByTestId("skeleton", hidden)).toHaveProp("aria-hidden", true);
  });
});
