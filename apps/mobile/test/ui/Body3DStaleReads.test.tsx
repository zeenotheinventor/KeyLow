import "../support/gestureHandler";

import { act, render } from "@testing-library/react-native";
import { AccessibilityInfo, DeviceEventEmitter } from "react-native";
import { State } from "react-native-gesture-handler";
import { getByGestureTestId } from "react-native-gesture-handler/jest-utils";

import { Body3D } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { laggingWrites } from "../support/laggingSharedValue";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { Body3DProps } from "../../components/ui";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// The shared value lags a number set on the JavaScript thread by one write, as it can on a device. See the stand-in.
jest.mock("react-native-reanimated", () => {
  const withLaggingValues: unknown = Object.create(
    jest.requireActual<object>("react-native-reanimated"),
    {
      useSharedValue: {
        value: jest.requireActual<typeof import("../support/laggingSharedValue")>(
          "../support/laggingSharedValue",
        ).useLaggingSharedValue,
      },
    },
  );
  return withLaggingValues;
});

jest.mock("../../components/ui/Body3D/Body3DCanvas", () => ({ Body3DCanvas: () => null }));

const WIDTH = 120;
const HALF_TURN = Math.PI;

function Body(props: Partial<Body3DProps>) {
  return (
    <ThemeProvider fixedPreference="dark">
      <Body3D label="Body, male, 3D" w={WIDTH} {...props} />
    </ThemeProvider>
  );
}

// One finger event by event, as the pan reports it.
function fingerOnBody() {
  const handlerTag = getByGestureTestId("body-3d-pan").handlerTag;
  const send = async (name: string, state: State, oldState: State | null, translationX: number) => {
    await act(() => {
      DeviceEventEmitter.emit(name, {
        handlerTag,
        state,
        ...(oldState === null ? {} : { oldState }),
        translationX,
        translationY: 0,
        velocityX: 0,
        velocityY: 0,
        x: 0,
        y: 0,
        absoluteX: 0,
        absoluteY: 0,
        numberOfPointers: 1,
      });
    });
  };
  return {
    takeHold: async (translationX: number) => {
      await send("onGestureHandlerStateChange", State.BEGAN, State.UNDETERMINED, 0);
      await send("onGestureHandlerStateChange", State.ACTIVE, State.BEGAN, translationX);
    },
    moveTo: (translationX: number) =>
      send("onGestureHandlerEvent", State.ACTIVE, null, translationX),
    lift: (translationX: number) =>
      send("onGestureHandlerStateChange", State.END, State.ACTIVE, translationX),
  };
}

async function reduceMotion() {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
  // The first component to read the setting starts the read, and its answer comes a moment later.
  const { unmount } = await render(<Body />);
  await act(() => {
    jest.advanceTimersByTime(1);
  });
  await unmount();
}

describe("Body3D when a read of the turn lags the write before it", () => {
  beforeAll(async () => {
    registerAppStyles(await compileKitStyles());
  });

  beforeEach(() => {
    jest.useFakeTimers();
    laggingWrites.length = 0;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("should carry on from the back when a drag starts there, without flicking to the front", async () => {
    await render(<Body side="back" />);
    const finger = fingerOnBody();

    await finger.takeHold(-WIDTH * 0.1);
    await finger.moveTo(-WIDTH * 0.15);
    await finger.moveTo(-WIDTH * 0.2);

    // The drag turns the body from half a turn, and every turn written stays near it.
    expect(laggingWrites.length).toBeGreaterThanOrEqual(3);
    for (const turn of laggingWrites) {
      expect(turn).toBeGreaterThan(0.7 * HALF_TURN);
      expect(turn).toBeLessThanOrEqual(HALF_TURN);
    }
  });

  it("should settle on the side of the last move, not the one before it", async () => {
    const onSideChange = jest.fn();
    await render(<Body onSideChange={onSideChange} />);
    const finger = fingerOnBody();

    await finger.takeHold(WIDTH * 0.2);
    await finger.moveTo(WIDTH * 0.6);
    await finger.lift(WIDTH * 0.6);

    expect(onSideChange).toHaveBeenCalledTimes(1);
    expect(onSideChange).toHaveBeenCalledWith("back");
  });

  it("should settle on the front, not the back, when the last move comes back to it", async () => {
    const onSideChange = jest.fn();
    await render(<Body onSideChange={onSideChange} />);
    const finger = fingerOnBody();

    await finger.takeHold(WIDTH * 0.2);
    await finger.moveTo(WIDTH * 0.6);
    await finger.moveTo(WIDTH * 0.3);
    await finger.lift(WIDTH * 0.3);

    expect(onSideChange).not.toHaveBeenCalled();
  });

  it("should start a second drag from where the first settled, when the settle was a plain write", async () => {
    await reduceMotion();
    await render(<Body />);
    const finger = fingerOnBody();
    await finger.takeHold(WIDTH * 0.6);
    await finger.lift(WIDTH * 0.6);
    laggingWrites.length = 0;

    await finger.takeHold(-WIDTH * 0.1);
    await finger.moveTo(-WIDTH * 0.15);

    // It settled on the back at half a turn, and the second drag turns it from there.
    expect(laggingWrites.length).toBeGreaterThanOrEqual(2);
    for (const turn of laggingWrites) {
      expect(turn).toBeGreaterThan(0.7 * HALF_TURN);
    }
  });
});
