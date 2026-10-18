import { motionDuration } from "@keylow/tokens";
import { act, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import Animated, { setUpTests } from "react-native-reanimated";

import { useCrossFade } from "../../lib/motion";

// The end of a fade is told to the screen by `scheduleOnRN`. Here the telling is held back, so a test can
// let it arrive late, after a newer fade has begun.
const mockHeldTellings: (() => void)[] = [];
jest.mock("react-native-worklets", () => ({
  ...jest.requireActual<object>("react-native-worklets/lib/module/mock"),
  scheduleOnRN: (tell: (...args: number[]) => void, ...args: number[]) => {
    mockHeldTellings.push(() => {
      tell(...args);
    });
  },
}));

setUpTests();

function Probe({ word }: { word: string }) {
  const { outgoing, outgoingStyle } = useCrossFade(word, word);

  return outgoing === null ? null : (
    <Animated.View accessibilityLabel={`Leaving ${outgoing}`} style={outgoingStyle} />
  );
}

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds);
  });
}

describe("useCrossFade, when the end of a fade that was turned about arrives late", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    mockHeldTellings.length = 0;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("should leave the newer fade running, and end it only when its own end arrives", async () => {
    const { rerender } = await render(<Probe word="first" />);
    await rerender(<Probe word="second" />);
    await advance(motionDuration.standard + 10);
    expect(mockHeldTellings).toHaveLength(1);
    await rerender(<Probe word="first" />);

    await act(() => {
      mockHeldTellings[0]?.();
    });

    expect(screen.getByLabelText("Leaving second")).toBeOnTheScreen();
    await advance(motionDuration.standard + 10);
    await act(() => {
      mockHeldTellings.at(-1)?.();
    });
    expect(screen.queryByLabelText(/Leaving/)).not.toBeOnTheScreen();
  });
});
