import { motionDuration } from "@keylow/tokens";
import { act, render, screen } from "@testing-library/react-native";
import Animated, { getAnimatedStyle, setUpTests } from "react-native-reanimated";

import { useFadeInStyle } from "../../lib/motion";

setUpTests();

function Probe({ delay }: { delay?: number }) {
  const animatedStyle = useFadeInStyle(delay);

  return <Animated.View accessibilityLabel="Fading surface" style={animatedStyle} />;
}

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds);
  });
}

function readOpacity(): unknown {
  return getAnimatedStyle(screen.getByLabelText("Fading surface")).opacity;
}

describe("useFadeInStyle", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should start clear, so the surface is not drawn for a frame before it fades in", async () => {
    await render(<Probe />);

    expect(readOpacity()).toBe(0);
  });

  it("should reach full opacity over the quick duration and move nothing", async () => {
    await render(<Probe />);
    await advance(motionDuration.quick / 2);
    const halfway = readOpacity();
    await advance(motionDuration.quick);

    expect(halfway).toBeGreaterThan(0);
    expect(halfway).toBeLessThan(1);
    expect(readOpacity()).toBe(1);
    expect(getAnimatedStyle(screen.getByLabelText("Fading surface"))).not.toHaveProperty(
      "transform",
    );
  });

  it("should hold clear until the delay has passed, then fade in", async () => {
    await render(<Probe delay={200} />);

    await advance(199);
    expect(readOpacity()).toBe(0);

    await advance(1 + motionDuration.quick + 50);
    expect(readOpacity()).toBe(1);
  });
});
