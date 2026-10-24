import { act, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo, Text } from "react-native";
import { getAnimatedStyle, setUpTests } from "react-native-reanimated";

import { CutIn } from "../../components/SetupScreen/steps/EstimateStep/CutIn";
import {
  animatedOpacity,
  animatedSkewXDegrees,
  animatedTranslateXPoints,
} from "../support/animatedStyle";

setUpTests();

function reduceMotion(isEnabled: boolean) {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(isEnabled);
}

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds);
  });
}

async function renderCutIn(delay: number) {
  await render(
    <CutIn delay={delay}>
      <Text>A tile</Text>
    </CutIn>,
  );
  return screen.getByTestId("estimate-tile-cut-in");
}

describe("CutIn", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("with motion", () => {
    beforeEach(() => {
      reduceMotion(false);
    });

    it("should wait clear, 28 points to the right and leaning back 8 degrees until its delay is over", async () => {
      const cutIn = await renderCutIn(160);

      await advance(100);

      expect(getAnimatedStyle(cutIn)).toMatchObject({
        opacity: 0,
        transform: [{ translateX: 28 }, { skewX: "-8deg" }],
      });
    });

    it("should be fully drawn and past its place, to the left, once the 65 percent keyframe is passed", async () => {
      const cutIn = await renderCutIn(0);

      await advance(150);

      expect(animatedOpacity(cutIn)).toBe(1);
      expect(animatedTranslateXPoints(cutIn)).toBeLessThan(0);
    });

    // The 65 percent keyframe of 220 ms is 143 ms in, and the delay comes first.
    it("should be 3 points past its place and leaning forward 2 degrees at the 65 percent keyframe", async () => {
      const cutIn = await renderCutIn(100);

      await advance(100 + 143);

      expect(animatedTranslateXPoints(cutIn)).toBeCloseTo(-3, 1);
      expect(animatedSkewXDegrees(cutIn)).toBeCloseTo(2, 1);
    });

    it("should settle on its place, upright and drawn", async () => {
      const cutIn = await renderCutIn(0);

      await advance(300);

      expect(getAnimatedStyle(cutIn)).toMatchObject({
        opacity: 1,
        transform: [{ translateX: 0 }, { skewX: "0deg" }],
      });
    });
  });

  describe("with reduced motion", () => {
    beforeEach(() => {
      reduceMotion(true);
    });

    it("should fade to fully drawn with no translate and no skew", async () => {
      const cutIn = await renderCutIn(160);
      await advance(300);

      expect(animatedOpacity(cutIn)).toBe(1);
      expect(getAnimatedStyle(cutIn)).toMatchObject({ opacity: 1, transform: [] });
    });
  });
});
