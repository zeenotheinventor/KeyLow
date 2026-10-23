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

async function renderWeightSkeleton() {
  await render(
    <ThemeProvider fixedPreference="dark">
      <Skeleton variant="weight" />
    </ThemeProvider>,
  );
}

// A skeleton is hidden from screen readers, because the screen says what is loading in words, so its
// drawing is found by ids, and a query has to ask for hidden elements.
const hidden = { includeHiddenElements: true };
const bones = () => screen.getAllByTestId("skeleton-bone", hidden);

describe("Skeleton shaped like the Weight screen", () => {
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

  it("should be five bones, as the loading board draws them", async () => {
    await renderWeightSkeleton();

    expect(bones()).toHaveLength(5);
  });

  it("should draw the Trend weight card as a 112 tall block with the large corners", async () => {
    await renderWeightSkeleton();

    expect(bones()[0]).toHaveStyle({ height: 112, borderRadius: 20 });
  });

  it("should draw the range control as a 44 tall block with the medium corners", async () => {
    await renderWeightSkeleton();

    expect(bones()[1]).toHaveStyle({ height: 44, borderRadius: 12 });
  });

  it("should draw the chart as a 220 tall block with the large corners", async () => {
    await renderWeightSkeleton();

    expect(bones()[2]).toHaveStyle({ height: 220, borderRadius: 20 });
  });

  it("should draw the Weigh-ins heading as a 120 wide and 18 tall bone with the small corners", async () => {
    await renderWeightSkeleton();

    expect(bones()[3]).toHaveStyle({ width: 120, height: 18, borderRadius: 6 });
  });

  it("should draw the list as a 168 tall block with the large corners", async () => {
    await renderWeightSkeleton();

    expect(bones()[4]).toHaveStyle({ height: 168, borderRadius: 20 });
  });

  it("should keep 12 points between the bones", async () => {
    await renderWeightSkeleton();

    expect(viewsDrawn({ rowGap: 12 })).toHaveLength(1);
  });

  it("should draw nothing for the first 200 ms and stay hidden from screen readers like the others", async () => {
    await renderWeightSkeleton();

    await act(() => {
      jest.advanceTimersByTime(skeletonDelay - 1);
    });

    expect(getAnimatedStyle(screen.getByTestId("skeleton", hidden)).opacity).toBe(0);
    expect(screen.getByTestId("skeleton", hidden)).toHaveProp("aria-hidden", true);
  });

  it("should fade in once the delay has passed", async () => {
    await renderWeightSkeleton();

    await act(() => {
      jest.advanceTimersByTime(skeletonDelay + 500);
    });

    expect(getAnimatedStyle(screen.getByTestId("skeleton", hidden)).opacity).toBe(1);
  });
});
