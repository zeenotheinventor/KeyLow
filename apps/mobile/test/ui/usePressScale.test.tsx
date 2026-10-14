import { pressScale, reducedMotion } from "@keylow/tokens";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo, Pressable, Text } from "react-native";
import Animated, { setUpTests } from "react-native-reanimated";

import { usePressScale } from "../../lib/motion";
import { animatedScale } from "../support/animatedStyle";

setUpTests();

function Probe() {
  const { animatedStyle, isPressed, pressHandlers } = usePressScale();

  return (
    <Pressable accessibilityRole="button" {...pressHandlers}>
      <Animated.View accessibilityLabel="Pressable surface" style={animatedStyle}>
        <Text>{isPressed ? "Pressed" : "Resting"}</Text>
      </Animated.View>
    </Pressable>
  );
}

const settleTime = 1000;

// A spring stops a hair short of its target, so the scale is read as a number and compared close.
function readScale(): number | undefined {
  return animatedScale(screen.getByLabelText("Pressable surface"));
}

async function pressIn() {
  await fireEvent(screen.getByRole("button"), "pressIn");
  await act(() => {
    jest.advanceTimersByTime(settleTime);
  });
}

async function pressOut() {
  await fireEvent(screen.getByRole("button"), "pressOut");
  await act(() => {
    jest.advanceTimersByTime(settleTime);
  });
}

describe("usePressScale", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("should rest at full size", async () => {
    await render(<Probe />);

    expect(screen.getByLabelText("Pressable surface")).toHaveAnimatedStyle({
      transform: [{ scale: 1 }],
    });
  });

  it("should report whether the surface is pressed, for the press overlay", async () => {
    await render(<Probe />);
    expect(screen.getByText("Resting")).toBeOnTheScreen();

    await pressIn();
    expect(screen.getByText("Pressed")).toBeOnTheScreen();

    await pressOut();
    expect(screen.getByText("Resting")).toBeOnTheScreen();
  });

  it("should compress to the design's press scale while pressed", async () => {
    await render(<Probe />);

    await pressIn();

    expect(screen.getByLabelText("Pressable surface")).toHaveAnimatedStyle({
      transform: [{ scale: pressScale }],
    });
  });

  it("should spring back to full size on release", async () => {
    await render(<Probe />);
    await pressIn();

    await pressOut();

    expect(readScale()).toBeCloseTo(1, 3);
  });

  it("should not compress when the user has asked for reduced motion", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    await render(<Probe />);
    await act(() => {
      jest.advanceTimersByTime(settleTime);
    });

    await pressIn();

    expect(screen.getByLabelText("Pressable surface")).toHaveAnimatedStyle({
      transform: [{ scale: reducedMotion.pressScale }],
    });
  });
});
