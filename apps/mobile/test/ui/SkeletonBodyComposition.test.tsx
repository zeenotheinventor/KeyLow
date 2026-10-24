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

async function renderBodyCompositionSkeleton() {
  await render(
    <ThemeProvider fixedPreference="dark">
      <Skeleton variant="bodyComposition" />
    </ThemeProvider>,
  );
}

// A skeleton is hidden from screen readers, because the screen says what is loading in words, so its
// drawing is found by ids, and a query has to ask for hidden elements.
const hidden = { includeHiddenElements: true };
const bones = () => screen.getAllByTestId("skeleton-bone", hidden);

describe("Skeleton shaped like the Body composition section", () => {
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

  it("should be two bones, one for each card", async () => {
    await renderBodyCompositionSkeleton();

    expect(bones()).toHaveLength(2);
  });

  it("should draw each card as a 104 tall block with the large corners", async () => {
    await renderBodyCompositionSkeleton();

    for (const bone of bones()) {
      expect(bone).toHaveStyle({ height: 104, borderRadius: 20 });
    }
  });

  it("should keep 8 points between the blocks", async () => {
    await renderBodyCompositionSkeleton();

    expect(viewsDrawn({ rowGap: 8 })).toHaveLength(1);
  });

  it("should draw nothing for the first 200 ms and stay hidden from screen readers like the others", async () => {
    await renderBodyCompositionSkeleton();

    await act(() => {
      jest.advanceTimersByTime(skeletonDelay - 1);
    });

    expect(getAnimatedStyle(screen.getByTestId("skeleton", hidden)).opacity).toBe(0);
    expect(screen.getByTestId("skeleton", hidden)).toHaveProp("aria-hidden", true);
  });
});
