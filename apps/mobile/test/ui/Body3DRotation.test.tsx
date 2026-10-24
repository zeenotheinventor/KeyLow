import "../support/gestureHandler";

import { BODY_TAP_SLOP } from "@keylow/body-3d/touch";
import { motionDuration } from "@keylow/tokens";
import { act, render, screen } from "@testing-library/react-native";
import { Profiler } from "react";
import { AccessibilityInfo, DeviceEventEmitter } from "react-native";
import { Gesture, State } from "react-native-gesture-handler";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";
import { withTiming } from "react-native-reanimated";

import { Body3D } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { Body3DProps } from "../../components/ui";
import type { Body3DCanvasProps } from "../../components/ui/Body3D/types";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// The animation is the real one, with its calls counted, so a test can say how often a settle was started.
jest.mock("react-native-reanimated", () => {
  const actual =
    jest.requireActual<typeof import("react-native-reanimated")>("react-native-reanimated");
  const withCountedTiming: unknown = Object.create(actual, {
    withTiming: { value: jest.fn(actual.withTiming) },
  });
  return withCountedTiming;
});

// GL does not run in Jest. The canvas is stood in for, and the turn it is given is read from its props.
const mockCanvas = jest.fn<null, [Body3DCanvasProps]>(() => null);
jest.mock("../../components/ui/Body3D/Body3DCanvas", () => ({
  Body3DCanvas: (props: Body3DCanvasProps) => mockCanvas(props),
}));

const label = "Body, male, 3D";
const WIDTH = 120;
const HALF_TURN = Math.PI;
const QUARTER_TURN = Math.PI / 2;

const currentYaw = (): Body3DCanvasProps["yaw"] => {
  const props = mockCanvas.mock.lastCall?.[0];
  if (props === undefined) {
    throw new Error("The canvas has not been drawn.");
  }
  return props.yaw;
};
const yawNow = (): number => currentYaw().get();

const panGesture = () => getByGestureTestId("body-3d-pan");
const tapGesture = () => getByGestureTestId("body-3d-tap");

// A finger that goes down, moves to each distance in turn and lifts at the last one, in points across.
function drag(...distances: number[]) {
  const last = distances.at(-1) ?? 0;
  fireGestureHandler(panGesture(), [
    { state: State.BEGAN, translationX: 0 },
    { state: State.ACTIVE, translationX: distances[0] ?? 0 },
    ...distances.slice(1).map((translationX) => ({ translationX, state: State.ACTIVE })),
    { state: State.END, translationX: last, velocityX: 4000 },
  ]);
}

function tapAt(down: { x: number; y: number }, up: { x: number; y: number }) {
  fireGestureHandler(tapGesture(), [
    { state: State.BEGAN, ...down },
    { state: State.ACTIVE, ...up },
    { state: State.END, ...up },
  ]);
}

// One finger on the body, event by event, for the tests that read the turn while the finger is still down. The
// utility above always ends a gesture, so it cannot stop part way.
function fingerOnBody() {
  const handlerTag = panGesture().handlerTag;
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
    // The pan takes hold once the finger has moved past the slop, at this distance.
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

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds);
  });
}

async function setReduceMotion(isEnabled: boolean) {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(isEnabled);
  // The first component to read the setting starts the read, and its answer comes a moment later.
  const { unmount } = await render(<Body />);
  await advance(1);
  await unmount();
}

function Body({ props = {} }: { props?: Partial<Body3DProps> }) {
  return (
    <ThemeProvider fixedPreference="dark">
      <Body3D label={label} w={WIDTH} {...props} />
    </ThemeProvider>
  );
}

describe("Body3D turning", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(async () => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
    await setReduceMotion(false);
    mockCanvas.mockReset();
    mockCanvas.mockReturnValue(null);
    jest.mocked(withTiming).mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("the touch rule", () => {
    it("should detect a drag only after 10 points sideways, and leave a vertical or diagonal swipe to the page", async () => {
      await render(<Body />);

      // No minimum distance: it is OR-ed with the offsets, so a diagonal first sample would take the scroll.
      expect(panGesture().config.minDist).toBeUndefined();
      expect(panGesture().config).toMatchObject({
        activeOffsetXStart: -BODY_TAP_SLOP,
        activeOffsetXEnd: BODY_TAP_SLOP,
        failOffsetYStart: -BODY_TAP_SLOP,
        failOffsetYEnd: BODY_TAP_SLOP,
      });
    });

    it("should detect a tap only within 10 points", async () => {
      await render(<Body />);

      expect(tapGesture().config).toMatchObject({ maxDist: BODY_TAP_SLOP });
    });

    it("should make the tap wait for the drag to fail, so one touch is never both", async () => {
      await render(<Body />);

      expect(tapGesture().config.requireToFail).toEqual([panGesture().handlerTag]);
    });

    it("should call onTap once for a tap", async () => {
      const onTap = jest.fn();
      await render(<Body props={{ onTap }} />);

      tapAt({ x: 50, y: 50 }, { x: 50, y: 50 });

      expect(onTap).toHaveBeenCalledTimes(1);
    });

    it("should call onTap for a lift exactly 10 points from where the finger went down", async () => {
      const onTap = jest.fn();
      await render(<Body props={{ onTap }} />);

      tapAt({ x: 50, y: 50 }, { x: 60, y: 50 });

      expect(onTap).toHaveBeenCalledTimes(1);
    });

    it("should not call onTap for a lift 11 points from where the finger went down", async () => {
      const onTap = jest.fn();
      await render(<Body props={{ onTap }} />);

      tapAt({ x: 50, y: 50 }, { x: 61, y: 50 });

      expect(onTap).not.toHaveBeenCalled();
    });

    it("should never call onTap for a drag", async () => {
      const onTap = jest.fn();
      await render(<Body props={{ onTap }} />);

      drag(20, 60, 100);

      expect(onTap).not.toHaveBeenCalled();
    });

    it("should not call onSideChange for a tap", async () => {
      const onSideChange = jest.fn();
      await render(<Body props={{ onSideChange }} />);

      tapAt({ x: 50, y: 50 }, { x: 50, y: 50 });

      expect(onSideChange).not.toHaveBeenCalled();
    });

    it("should still be one image named by its label, around the detector", async () => {
      await render(<Body />);

      expect(screen.getByRole("img", { name: label })).toBeOnTheScreen();
    });
  });

  describe("the turn under the finger", () => {
    it("should face the front when it is given no side", async () => {
      await render(<Body />);

      expect(yawNow()).toBe(0);
    });

    it("should face the back when it is given the back", async () => {
      await render(<Body props={{ side: "back" }} />);

      expect(yawNow()).toBeCloseTo(HALF_TURN);
    });

    it("should follow the finger exactly, half a turn for a drag of its width", async () => {
      await render(<Body />);
      const finger = fingerOnBody();

      await finger.takeHold(WIDTH / 4);
      expect(yawNow()).toBeCloseTo(QUARTER_TURN / 2);
      await finger.moveTo(WIDTH / 2);
      expect(yawNow()).toBeCloseTo(QUARTER_TURN);
      await finger.moveTo(WIDTH);
      expect(yawNow()).toBeCloseTo(HALF_TURN);
    });

    it("should turn the other way for a drag to the left", async () => {
      await render(<Body />);
      const finger = fingerOnBody();

      await finger.takeHold(-WIDTH / 2);

      expect(yawNow()).toBeCloseTo(-QUARTER_TURN);
    });

    it("should carry on from where the body faces, not from the front", async () => {
      await render(<Body props={{ side: "back" }} />);
      const finger = fingerOnBody();

      await finger.takeHold(-WIDTH / 2);

      expect(yawNow()).toBeCloseTo(QUARTER_TURN);
    });

    it("should take over from where a settle had got to when a finger goes down again", async () => {
      await render(<Body />);
      drag(WIDTH * 0.6);
      await advance(motionDuration.standard / 2);
      const midSettle = yawNow();
      const finger = fingerOnBody();

      await finger.takeHold(0);

      expect(midSettle).toBeGreaterThan(0.6 * HALF_TURN);
      expect(midSettle).toBeLessThan(HALF_TURN);
      expect(yawNow()).toBeCloseTo(midSettle, 5);
      // The settle was stopped, so it does not carry on to the back under the finger.
      await advance(motionDuration.standard);
      expect(yawNow()).toBeCloseTo(midSettle, 5);
    });

    it("should cause no render of the body per frame of a drag", async () => {
      const onRender = jest.fn();
      await render(
        <Profiler id="body" onRender={onRender}>
          <Body />
        </Profiler>,
      );
      const rendersBeforeTheDrag = onRender.mock.calls.length;
      const canvasDrawsBeforeTheDrag = mockCanvas.mock.calls.length;

      drag(...Array.from({ length: 30 }, (_, step) => (step + 1) * 2));
      await advance(motionDuration.standard * 2);

      expect(onRender).toHaveBeenCalledTimes(rendersBeforeTheDrag);
      expect(mockCanvas).toHaveBeenCalledTimes(canvasDrawsBeforeTheDrag);
    });
  });

  describe("the settle on release", () => {
    it("should settle on the back over the motion duration when released nearer the back", async () => {
      await render(<Body />);

      drag(WIDTH * 0.6);
      expect(yawNow()).toBeLessThan(HALF_TURN);
      await advance(motionDuration.standard);

      expect(yawNow()).toBeCloseTo(HALF_TURN);
    });

    it("should be part way settled half way through the motion duration", async () => {
      await render(<Body />);

      drag(WIDTH * 0.6);
      const releasedAt = yawNow();
      await advance(motionDuration.standard / 2);

      expect(yawNow()).toBeGreaterThan(releasedAt);
      expect(yawNow()).toBeLessThan(HALF_TURN);
    });

    it("should settle back on the front when released nearer the front", async () => {
      await render(<Body />);

      drag(WIDTH * 0.4);
      await advance(motionDuration.standard);

      expect(yawNow()).toBeCloseTo(0);
    });

    it("should settle on the nearer side whatever the speed of the release, with no inertia", async () => {
      await render(<Body />);

      drag(WIDTH * 0.4);
      await advance(motionDuration.standard * 5);

      expect(yawNow()).toBeCloseTo(0);
    });

    it("should settle on the back by the short way from a drag past it", async () => {
      await render(<Body />);

      drag(WIDTH * 1.2);
      await advance(motionDuration.standard);

      expect(yawNow()).toBeCloseTo(HALF_TURN);
    });

    it("should settle on the front after a whole turn", async () => {
      await render(<Body />);

      drag(WIDTH * 2.1);
      await advance(motionDuration.standard);

      expect(yawNow()).toBeCloseTo(2 * HALF_TURN);
    });

    it("should settle exactly between the sides on the front", async () => {
      await render(<Body />);

      drag(WIDTH / 2);
      await advance(motionDuration.standard);

      expect(yawNow()).toBeCloseTo(0);
    });

    it("should settle at once with reduced motion, with nothing animated", async () => {
      await setReduceMotion(true);
      await render(<Body />);

      drag(WIDTH * 0.6);

      // No time has passed, and the turn is already on the back.
      expect(yawNow()).toBeCloseTo(HALF_TURN);
    });
  });

  describe("onSideChange", () => {
    it("should be called with the back when a drag is released nearer the back", async () => {
      const onSideChange = jest.fn();
      await render(<Body props={{ onSideChange }} />);

      drag(WIDTH * 0.6);

      expect(onSideChange).toHaveBeenCalledTimes(1);
      expect(onSideChange).toHaveBeenCalledWith("back");
    });

    it("should be called with the front when a drag from the back is released nearer the front", async () => {
      const onSideChange = jest.fn();
      await render(<Body props={{ side: "back", onSideChange }} />);

      drag(WIDTH * 0.6);

      expect(onSideChange).toHaveBeenCalledTimes(1);
      expect(onSideChange).toHaveBeenCalledWith("front");
    });

    it("should not be called when a drag is released nearer the side it was on", async () => {
      const onSideChange = jest.fn();
      await render(<Body props={{ onSideChange }} />);

      drag(WIDTH * 0.4);

      expect(onSideChange).not.toHaveBeenCalled();
    });

    it("should not be called when a drag goes a whole turn and settles on the side it was on", async () => {
      const onSideChange = jest.fn();
      await render(<Body props={{ onSideChange }} />);

      drag(WIDTH * 0.7, WIDTH * 2);

      expect(onSideChange).not.toHaveBeenCalled();
    });

    it("should not be called per frame, only once the drag is released", async () => {
      const onSideChange = jest.fn();
      await render(<Body props={{ onSideChange }} />);
      const finger = fingerOnBody();

      await finger.takeHold(WIDTH * 0.2);
      await finger.moveTo(WIDTH * 0.4);
      await finger.moveTo(WIDTH * 0.6);
      await finger.moveTo(WIDTH * 0.8);
      expect(onSideChange).not.toHaveBeenCalled();
      await finger.lift(WIDTH * 0.8);

      expect(onSideChange).toHaveBeenCalledTimes(1);
    });

    it("should not be called again when the screen follows it and sets the side it was told", async () => {
      const onSideChange = jest.fn();
      const { rerender } = await render(<Body props={{ onSideChange }} />);

      drag(WIDTH * 0.6);
      await rerender(<Body props={{ side: "back", onSideChange }} />);
      await advance(motionDuration.standard * 2);

      expect(onSideChange).toHaveBeenCalledTimes(1);
      expect(yawNow()).toBeCloseTo(HALF_TURN);
    });

    it("should not start the settle again when the screen follows it part way through", async () => {
      const onSideChange = jest.fn();
      const { rerender } = await render(<Body props={{ onSideChange }} />);

      drag(WIDTH * 0.6);
      await advance(motionDuration.standard / 2);
      await rerender(<Body props={{ side: "back", onSideChange }} />);
      await advance(motionDuration.standard / 2);

      expect(yawNow()).toBeCloseTo(HALF_TURN);
      // The settle that the drag started is the only one: following it with the same side starts nothing.
      expect(withTiming).toHaveBeenCalledTimes(1);
    });

    it("should build its gestures once, however often the screen gives it new callbacks and a new side", async () => {
      const buildPan = jest.spyOn(Gesture, "Pan");
      const buildTap = jest.spyOn(Gesture, "Tap");
      const { rerender } = await render(
        <Body props={{ onSideChange: jest.fn(), onTap: jest.fn() }} />,
      );

      await rerender(<Body props={{ side: "back", onSideChange: jest.fn(), onTap: jest.fn() }} />);
      await rerender(<Body props={{ side: "front", onSideChange: jest.fn(), onTap: jest.fn() }} />);

      expect(buildPan).toHaveBeenCalledTimes(1);
      expect(buildTap).toHaveBeenCalledTimes(1);
    });

    it("should call the latest callbacks, not the ones from when the drag began", async () => {
      const firstOnSideChange = jest.fn();
      const latestOnSideChange = jest.fn();
      const latestOnTap = jest.fn();
      const { rerender } = await render(<Body props={{ onSideChange: firstOnSideChange }} />);
      const finger = fingerOnBody();

      await finger.takeHold(WIDTH * 0.6);
      await rerender(<Body props={{ onSideChange: latestOnSideChange, onTap: latestOnTap }} />);
      await finger.lift(WIDTH * 0.6);
      tapAt({ x: 1, y: 1 }, { x: 1, y: 1 });

      expect(latestOnSideChange).toHaveBeenCalledWith("back");
      expect(firstOnSideChange).not.toHaveBeenCalled();
      expect(latestOnTap).toHaveBeenCalledTimes(1);
    });

    it("should read the side as of the latest render when a drag is released", async () => {
      const onSideChange = jest.fn();
      const { rerender } = await render(<Body props={{ onSideChange }} />);
      const finger = fingerOnBody();

      await finger.takeHold(WIDTH * 0.6);
      await rerender(<Body props={{ side: "back", onSideChange }} />);
      await finger.lift(WIDTH * 0.6);

      // The screen already shows the back, so a release on the back tells it nothing.
      expect(onSideChange).not.toHaveBeenCalled();
    });

    it("should not be called when the side prop changes", async () => {
      const onSideChange = jest.fn();
      const { rerender } = await render(<Body props={{ onSideChange }} />);

      await rerender(<Body props={{ side: "back", onSideChange }} />);
      await advance(motionDuration.standard * 2);

      expect(onSideChange).not.toHaveBeenCalled();
    });

    it("should do no harm without a handler", async () => {
      await render(<Body />);

      expect(() => {
        drag(WIDTH * 0.6);
        tapAt({ x: 1, y: 1 }, { x: 1, y: 1 });
      }).not.toThrow();
    });
  });

  describe("a change of side", () => {
    it("should turn the body to the back over the motion duration", async () => {
      const { rerender } = await render(<Body />);

      await rerender(<Body props={{ side: "back" }} />);
      expect(yawNow()).toBeLessThan(HALF_TURN);
      await advance(motionDuration.standard / 2);
      expect(yawNow()).toBeGreaterThan(0);
      expect(yawNow()).toBeLessThan(HALF_TURN);
      await advance(motionDuration.standard);

      expect(yawNow()).toBeCloseTo(HALF_TURN);
    });

    it("should turn the body there at once with reduced motion", async () => {
      await setReduceMotion(true);
      const { rerender } = await render(<Body />);

      await rerender(<Body props={{ side: "back" }} />);

      expect(yawNow()).toBeCloseTo(HALF_TURN);
    });

    it("should turn by the shorter arc to the back from a little left of the front, which is the other way", async () => {
      const { rerender } = await render(<Body />);
      // A finger holds the body a little left of the front, then the screen asks for the back.
      await fingerOnBody().takeHold(-WIDTH * 0.1);

      await rerender(<Body props={{ side: "back" }} />);
      await advance(motionDuration.standard * 2);

      expect(yawNow()).toBeCloseTo(-HALF_TURN);
    });

    it("should turn by the shorter arc to the front from a little past the back", async () => {
      const { rerender } = await render(<Body props={{ side: "back" }} />);
      await fingerOnBody().takeHold(WIDTH * 0.1);

      await rerender(<Body props={{ side: "front" }} />);
      await advance(motionDuration.standard * 2);

      expect(yawNow()).toBeCloseTo(2 * HALF_TURN);
    });

    it("should not turn when the same side is set again", async () => {
      const { rerender } = await render(<Body props={{ side: "back" }} />);

      await rerender(<Body props={{ side: "back" }} />);
      await advance(motionDuration.standard * 2);

      expect(withTiming).not.toHaveBeenCalled();
      expect(yawNow()).toBeCloseTo(HALF_TURN);
    });
  });
});
