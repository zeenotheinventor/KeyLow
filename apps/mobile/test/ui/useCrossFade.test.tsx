import { motionDuration } from "@keylow/tokens";
import { act, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import Animated, { getAnimatedStyle, setUpTests } from "react-native-reanimated";

import { useCrossFade } from "../../lib/motion";

setUpTests();

type Word = { key: string; text: string };

const first: Word = { key: "first", text: "First" };
const second: Word = { key: "second", text: "Second" };

function Probe({ word }: { word: Word }) {
  const { outgoing, incomingStyle, outgoingStyle } = useCrossFade(word, word.key);

  return (
    <>
      {outgoing === null ? null : (
        <Animated.View accessibilityLabel={`Leaving ${outgoing.text}`} style={outgoingStyle} />
      )}
      <Animated.View
        accessibilityLabel={`Arriving ${word.text}`}
        style={outgoing === null ? undefined : incomingStyle}
      />
    </>
  );
}

async function setReduceMotion(isEnabled: boolean) {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(isEnabled);
  // The first component to read the setting starts the read, and its answer comes a moment later.
  const { unmount } = await render(<Probe word={first} />);
  await act(() => {
    jest.advanceTimersByTime(1);
  });
  await unmount();
}

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds);
  });
}

function opacityOf(name: string): unknown {
  return getAnimatedStyle(screen.getByLabelText(name)).opacity;
}

describe("useCrossFade", () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    await setReduceMotion(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("should leave nothing fading on the first value", async () => {
    await render(<Probe word={first} />);

    expect(screen.queryByLabelText(/Leaving/)).not.toBeOnTheScreen();
  });

  it("should hold the value that was shown before, fading out as the new one fades in", async () => {
    const { rerender } = await render(<Probe word={first} />);

    await rerender(<Probe word={second} />);
    // The animated styles take the shared value on the next frame.
    await advance(1);

    expect(screen.getByLabelText("Leaving First")).toBeOnTheScreen();
    expect(opacityOf("Leaving First")).toBeCloseTo(1, 1);
    expect(opacityOf("Arriving Second")).toBeCloseTo(0, 1);
  });

  it("should be half way across at half the standard duration", async () => {
    const { rerender } = await render(<Probe word={first} />);
    await rerender(<Probe word={second} />);

    await advance(motionDuration.standard / 2);

    expect(opacityOf("Leaving First")).toBeGreaterThan(0.2);
    expect(opacityOf("Leaving First")).toBeLessThan(0.8);
    expect(opacityOf("Arriving Second")).toBeGreaterThan(0.2);
    expect(opacityOf("Arriving Second")).toBeLessThan(0.8);
  });

  it("should still be fading one millisecond before the standard duration of 220 ms is up", async () => {
    expect(motionDuration.standard).toBe(220);
    const { rerender } = await render(<Probe word={first} />);
    await rerender(<Probe word={second} />);

    await advance(motionDuration.standard - 1);

    expect(screen.getByLabelText("Leaving First")).toBeOnTheScreen();
  });

  it("should be done when the standard duration is up, with the old value gone", async () => {
    const { rerender } = await render(<Probe word={first} />);
    await rerender(<Probe word={second} />);

    await advance(motionDuration.standard + 50);

    expect(screen.queryByLabelText(/Leaving/)).not.toBeOnTheScreen();
  });

  it("should turn about from where it was, with no jump, when the value changes again part way", async () => {
    const { rerender } = await render(<Probe word={first} />);
    await rerender(<Probe word={second} />);
    await advance(motionDuration.standard / 2);
    const arrivingBefore = opacityOf("Arriving Second");

    await rerender(<Probe word={first} />);

    // Second was arriving at this much, and now it leaves from there, as First comes back to the rest.
    expect(screen.getByLabelText("Leaving Second")).toBeOnTheScreen();
    expect(opacityOf("Leaving Second")).toBeCloseTo(Number(arrivingBefore), 1);
    expect(opacityOf("Arriving First")).toBeCloseTo(1 - Number(arrivingBefore), 1);
    await advance(motionDuration.standard + 50);
    expect(screen.queryByLabelText(/Leaving/)).not.toBeOnTheScreen();
  });

  it("should swap at once, with nothing fading, when the user has asked to reduce motion", async () => {
    await setReduceMotion(true);
    const { rerender } = await render(<Probe word={first} />);

    await rerender(<Probe word={second} />);

    expect(screen.queryByLabelText(/Leaving/)).not.toBeOnTheScreen();
    expect(screen.getByLabelText("Arriving Second")).toBeOnTheScreen();
  });
});
