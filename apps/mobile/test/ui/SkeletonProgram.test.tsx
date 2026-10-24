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

async function renderProgramSkeleton() {
  await render(
    <ThemeProvider fixedPreference="dark">
      <Skeleton variant="program" />
    </ThemeProvider>,
  );
}

// A skeleton is hidden from screen readers, because the screen says what is loading in words.
const hidden = { includeHiddenElements: true };
const bones = () => screen.getAllByTestId("skeleton-bone", hidden);

describe("Skeleton shaped like the Programme screen", () => {
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

  it("should be four bones, as the loading board draws them", async () => {
    await renderProgramSkeleton();

    expect(bones()).toHaveLength(4);
  });

  it("should draw the expenditure card as a 164 tall block with the large corners", async () => {
    await renderProgramSkeleton();

    expect(bones()[0]).toHaveStyle({ height: 164, borderRadius: 20 });
  });

  it("should draw the targets card as a 248 tall block with the large corners", async () => {
    await renderProgramSkeleton();

    expect(bones()[1]).toHaveStyle({ height: 248, borderRadius: 20 });
  });

  it("should draw the Your programme heading as a 140 wide and 18 tall bone with the small corners", async () => {
    await renderProgramSkeleton();

    expect(bones()[2]).toHaveStyle({ width: 140, height: 18, borderRadius: 6 });
  });

  it("should draw the rows as a 176 tall block with the large corners", async () => {
    await renderProgramSkeleton();

    expect(bones()[3]).toHaveStyle({ height: 176, borderRadius: 20 });
  });

  it("should keep 12 points between the bones", async () => {
    await renderProgramSkeleton();

    expect(viewsDrawn({ rowGap: 12 })).toHaveLength(1);
  });

  it("should draw nothing for the first 200 ms and stay hidden from screen readers", async () => {
    await renderProgramSkeleton();

    await act(() => {
      jest.advanceTimersByTime(skeletonDelay - 1);
    });

    expect(getAnimatedStyle(screen.getByTestId("skeleton", hidden)).opacity).toBe(0);
    expect(screen.getByTestId("skeleton", hidden)).toHaveProp("aria-hidden", true);
  });

  it("should fade in once the delay has passed", async () => {
    await renderProgramSkeleton();

    await act(() => {
      jest.advanceTimersByTime(skeletonDelay + 500);
    });

    expect(getAnimatedStyle(screen.getByTestId("skeleton", hidden)).opacity).toBe(1);
  });
});
