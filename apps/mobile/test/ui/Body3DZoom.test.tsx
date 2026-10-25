import "../support/gestureHandler";

import { motionDuration } from "@keylow/tokens";
import { act, render } from "@testing-library/react-native";
import { Profiler } from "react";
import { AccessibilityInfo, DeviceEventEmitter } from "react-native";
import { State } from "react-native-gesture-handler";
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

// The animation is the real one, with its calls counted, so a test can say how a reset was started.
jest.mock("react-native-reanimated", () => {
  const actual =
    jest.requireActual<typeof import("react-native-reanimated")>("react-native-reanimated");
  const withCountedTiming: unknown = Object.create(actual, {
    withTiming: { value: jest.fn(actual.withTiming) },
  });
  return withCountedTiming;
});

// GL does not run in Jest. The canvas is stood in for, and the view it is given is read from its props.
const mockCanvas = jest.fn<null, [Body3DCanvasProps]>(() => null);
jest.mock("../../components/ui/Body3D/Body3DCanvas", () => ({
  Body3DCanvas: (props: Body3DCanvasProps) => mockCanvas(props),
}));

const label = "Body, male, 3D";
const WIDTH = 120;
// The 200 by 440 drawing of the figure, so a body 120 wide is 264 high. A body of this width on a stage no wider is
// as wide as the stage, and a wider stage leaves room beside the body.
const HEIGHT = (WIDTH * 440) / 200;
const WIDE_STAGE = 400;
const HALF_TURN = Math.PI;
// The event type of the gesture handler's touch events that says a finger went down, which the library does not export.
const TOUCHES_DOWN = 1;

const canvasProps = (): Body3DCanvasProps => {
  const props = mockCanvas.mock.lastCall?.[0];
  if (props === undefined) {
    throw new Error("The canvas has not been drawn.");
  }
  return props;
};
const viewNow = () => canvasProps().view.get();
const yawNow = (): number => canvasProps().yaw.get();

const pinchGesture = () => getByGestureTestId("body-3d-pinch");
const zoomPanGesture = () => getByGestureTestId("body-3d-zoom-pan");
const rotationPanGesture = () => getByGestureTestId("body-3d-pan");
const tapGesture = () => getByGestureTestId("body-3d-tap");

type Focal = { focalX: number; focalY: number };
const MIDDLE: Focal = { focalX: WIDTH / 2, focalY: HEIGHT / 2 };

// Two fingers that go down, open or close to each scale in turn, and lift at the last one.
function pinch(focal: Focal, ...scales: number[]) {
  const last = scales.at(-1) ?? 1;
  fireGestureHandler(pinchGesture(), [
    { state: State.BEGAN, scale: 1, ...focal },
    { state: State.ACTIVE, scale: scales[0] ?? 1, ...focal },
    ...scales.slice(1).map((scale) => ({ scale, state: State.ACTIVE, ...focal })),
    { state: State.END, scale: last, ...focal },
  ]);
}

// Two fingers that go down together, move to each distance in turn and lift at the last one.
function twoFingerPan(...moves: { x: number; y: number }[]) {
  const last = moves.at(-1) ?? { x: 0, y: 0 };
  fireGestureHandler(zoomPanGesture(), [
    { state: State.BEGAN, translationX: 0, translationY: 0 },
    { state: State.ACTIVE, translationX: moves[0]?.x ?? 0, translationY: moves[0]?.y ?? 0 },
    ...moves
      .slice(1)
      .map(({ x, y }) => ({ translationX: x, translationY: y, state: State.ACTIVE })),
    { state: State.END, translationX: last.x, translationY: last.y },
  ]);
}

function drag(distance: number) {
  fireGestureHandler(rotationPanGesture(), [
    { state: State.BEGAN, translationX: 0 },
    { state: State.ACTIVE, translationX: distance },
    { state: State.END, translationX: distance, velocityX: 4000 },
  ]);
}

// Two fingers on the body, event by event, for the tests that read the view while the fingers are still down. The
// utility above always ends a gesture, so it cannot stop part way.
function fingersOn(testId: string) {
  const handlerTag = getByGestureTestId(testId).handlerTag;
  const send = (
    name: string,
    state: State,
    oldState: State | null,
    payload: Record<string, number>,
  ) =>
    act(() => {
      DeviceEventEmitter.emit(name, {
        handlerTag,
        state,
        ...(oldState === null ? {} : { oldState }),
        scale: 1,
        focalX: MIDDLE.focalX,
        focalY: MIDDLE.focalY,
        velocity: 0,
        translationX: 0,
        translationY: 0,
        velocityX: 0,
        velocityY: 0,
        x: 0,
        y: 0,
        absoluteX: 0,
        absoluteY: 0,
        numberOfPointers: 2,
        ...payload,
      });
    });
  return {
    takeHold: async (payload: Record<string, number> = {}) => {
      await send("onGestureHandlerStateChange", State.BEGAN, State.UNDETERMINED, {});
      await send("onGestureHandlerStateChange", State.ACTIVE, State.BEGAN, payload);
    },
    moveTo: (payload: Record<string, number>) =>
      send("onGestureHandlerEvent", State.ACTIVE, null, payload),
    lift: (payload: Record<string, number> = {}) =>
      send("onGestureHandlerStateChange", State.END, State.ACTIVE, payload),
  };
}

// A touch that goes down and lifts where it went down, with a second finger touching down on the way or not. The tap
// handler recognises it as a tap either way, so only the second finger tells the body that it is not one.
async function touchLifting({ secondFinger }: { secondFinger: boolean }) {
  const handlerTag = tapGesture().handlerTag;
  const stateChange = (state: State, oldState: State) =>
    act(() => {
      DeviceEventEmitter.emit("onGestureHandlerStateChange", {
        handlerTag,
        state,
        oldState,
        x: 50,
        y: 50,
        absoluteX: 50,
        absoluteY: 50,
        numberOfPointers: 1,
      });
    });
  const touchesDown = (numberOfTouches: number) =>
    act(() => {
      DeviceEventEmitter.emit("onGestureHandlerEvent", {
        handlerTag,
        eventType: TOUCHES_DOWN,
        numberOfTouches,
        state: State.BEGAN,
        allTouches: [],
        changedTouches: [],
      });
    });
  await stateChange(State.BEGAN, State.UNDETERMINED);
  await touchesDown(1);
  if (secondFinger) {
    await touchesDown(2);
  }
  await stateChange(State.ACTIVE, State.BEGAN);
  await stateChange(State.END, State.ACTIVE);
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

describe("Body3D zoom", () => {
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

  describe("a pinch", () => {
    it("should start at the whole body, centred", async () => {
      await render(<Body />);

      expect(viewNow()).toStrictEqual({ zoom: 1, x: 0, y: 0 });
    });

    it("should zoom by the scale of the pinch", async () => {
      await render(<Body />);

      pinch(MIDDLE, 1.5);

      expect(viewNow().zoom).toBeCloseTo(1.5);
    });

    it("should follow the fingers' scale through the pinch, not only at its end", async () => {
      await render(<Body />);
      const fingers = fingersOn("body-3d-pinch");

      await fingers.takeHold({ scale: 1.2 });
      expect(viewNow().zoom).toBeCloseTo(1.2);
      await fingers.moveTo({ scale: 1.6 });
      expect(viewNow().zoom).toBeCloseTo(1.6);
      await fingers.lift({ scale: 1.6 });
    });

    it("should stop at twice the size, however far the fingers open", async () => {
      await render(<Body />);

      pinch(MIDDLE, 1.5, 6);

      expect(viewNow().zoom).toBe(2);
    });

    it("should stop at the whole body, however far the fingers close", async () => {
      await render(<Body />);
      pinch(MIDDLE, 2);

      pinch(MIDDLE, 0.2);

      expect(viewNow()).toStrictEqual({ zoom: 1, x: 0, y: 0 });
    });

    it("should zoom the legs for a pinch over the legs, the head for a pinch over the head", async () => {
      await render(<Body />);

      pinch({ focalX: WIDTH / 2, focalY: HEIGHT }, 2);
      // The feet are at the bottom of the stage, so the body is moved up by as much as the stage is high.
      expect(viewNow().y).toBeCloseTo(-HEIGHT / 2);

      pinch({ focalX: WIDTH / 2, focalY: HEIGHT }, 0.5);
      pinch({ focalX: WIDTH / 2, focalY: 0 }, 2);
      expect(viewNow().y).toBeCloseTo(HEIGHT / 2);
    });

    it("should keep the chest under the fingers for a pinch over the chest", async () => {
      await render(<Body />);
      const chest = { focalX: WIDTH / 2, focalY: HEIGHT / 4 };

      pinch(chest, 2);

      // The chest was a quarter of the height down, so a quarter of the height above the middle, and it stays there.
      expect(viewNow().y).toBeCloseTo(HEIGHT / 4);
    });

    it("should follow the fingers sideways too", async () => {
      await render(<Body />);

      pinch({ focalX: WIDTH, focalY: HEIGHT / 2 }, 2);

      expect(viewNow().x).toBeCloseTo(-WIDTH / 2);
    });

    it("should follow the fingers sideways on a wide stage, up to the limit", async () => {
      await render(<Body props={{ touchWidth: WIDE_STAGE }} />);

      pinch({ focalX: WIDE_STAGE / 2 + 20, focalY: HEIGHT / 2 }, 2);

      expect(viewNow().x).toBeCloseTo(-20);
    });

    it("should stop a pinch at the side of a wide stage with the body moved half its width, no further", async () => {
      await render(<Body props={{ touchWidth: WIDE_STAGE }} />);

      pinch({ focalX: WIDE_STAGE, focalY: HEIGHT / 2 }, 2);

      expect(viewNow().x).toBeCloseTo(-WIDTH / 2);
    });

    it("should report the zoom to one decimal place when the fingers lift, and not while they move", async () => {
      const onZoomChange = jest.fn();
      await render(<Body props={{ onZoomChange }} />);
      const fingers = fingersOn("body-3d-pinch");

      await fingers.takeHold({ scale: 1.2 });
      await fingers.moveTo({ scale: 1.46 });
      expect(onZoomChange).not.toHaveBeenCalled();
      await fingers.lift({ scale: 1.46 });

      expect(onZoomChange).toHaveBeenCalledTimes(1);
      expect(onZoomChange).toHaveBeenCalledWith(1.5);
    });

    it("should settle a pinch that ends hardly past the whole body on the whole body, and report nothing", async () => {
      const onZoomChange = jest.fn();
      await render(<Body props={{ onZoomChange }} />);

      pinch({ focalX: WIDTH / 2, focalY: HEIGHT }, 1.04);

      expect(viewNow()).toStrictEqual({ zoom: 1, x: 0, y: 0 });
      expect(onZoomChange).not.toHaveBeenCalled();
    });

    it("should report the whole body again when a pinch brings the zoom back to it", async () => {
      const onZoomChange = jest.fn();
      await render(<Body props={{ onZoomChange }} />);
      pinch(MIDDLE, 2);

      pinch(MIDDLE, 0.4);

      expect(onZoomChange.mock.calls).toStrictEqual([[2], [1]]);
    });

    it("should render nothing in React while the fingers move", async () => {
      const onRender = jest.fn();
      await render(
        <Profiler id="body" onRender={onRender}>
          <Body />
        </Profiler>,
      );
      const fingers = fingersOn("body-3d-pinch");
      await fingers.takeHold({ scale: 1.1 });
      const rendersBefore = onRender.mock.calls.length;

      await fingers.moveTo({ scale: 1.3 });
      await fingers.moveTo({ scale: 1.5 });
      await fingers.moveTo({ scale: 1.8 });

      expect(viewNow().zoom).toBeCloseTo(1.8);
      expect(onRender).toHaveBeenCalledTimes(rendersBefore);
    });
  });

  describe("two fingers moving together", () => {
    it("should pan the zoomed body with the fingers", async () => {
      await render(<Body />);
      pinch(MIDDLE, 2);

      twoFingerPan({ x: 0, y: -40 });

      expect(viewNow().y).toBeCloseTo(-40);
    });

    it("should follow the fingers through the move, and add each move to the last", async () => {
      await render(<Body />);
      pinch(MIDDLE, 2);

      twoFingerPan({ x: 0, y: -40 }, { x: 0, y: -90 });

      expect(viewNow().y).toBeCloseTo(-90);
    });

    it("should stop with the feet at the bottom of the stage", async () => {
      await render(<Body />);
      pinch(MIDDLE, 2);

      twoFingerPan({ x: 0, y: -1000 });

      expect(viewNow().y).toBeCloseTo(-HEIGHT / 2);
    });

    it("should stop with the head at the top of the stage", async () => {
      await render(<Body />);
      pinch(MIDDLE, 2);

      twoFingerPan({ x: 0, y: 1000 });

      expect(viewNow().y).toBeCloseTo(HEIGHT / 2);
    });

    it("should pan sideways at twice the size, and stop at half the body's width each way", async () => {
      await render(<Body />);
      pinch(MIDDLE, 2);

      twoFingerPan({ x: 30, y: 0 });
      expect(viewNow().x).toBeCloseTo(30);

      twoFingerPan({ x: 1000, y: 0 });
      expect(viewNow().x).toBeCloseTo(WIDTH / 2);

      twoFingerPan({ x: -2000, y: 0 });
      expect(viewNow().x).toBeCloseTo(-WIDTH / 2);
    });

    it("should pan sideways just as far on a stage wider than the body", async () => {
      await render(<Body props={{ touchWidth: WIDE_STAGE }} />);
      pinch({ focalX: WIDE_STAGE / 2, focalY: HEIGHT / 2 }, 2);

      twoFingerPan({ x: 1000, y: 0 });
      expect(viewNow().x).toBeCloseTo(WIDTH / 2);

      twoFingerPan({ x: -2000, y: 0 });
      expect(viewNow().x).toBeCloseTo(-WIDTH / 2);
    });

    it("should pan both ways together, each axis stopping at its own limit", async () => {
      await render(<Body props={{ touchWidth: WIDE_STAGE }} />);
      pinch({ focalX: WIDE_STAGE / 2, focalY: HEIGHT / 2 }, 2);

      twoFingerPan({ x: -500, y: -500 });

      expect(viewNow().x).toBeCloseTo(-WIDTH / 2);
      expect(viewNow().y).toBeCloseTo(-HEIGHT / 2);
    });

    it("should stop sooner at a smaller zoom", async () => {
      await render(<Body props={{ touchWidth: WIDE_STAGE }} />);
      pinch({ focalX: WIDE_STAGE / 2, focalY: HEIGHT / 2 }, 1.5);

      twoFingerPan({ x: 1000, y: 1000 });

      expect(viewNow().x).toBeCloseTo(WIDTH / 4);
      expect(viewNow().y).toBeCloseTo(HEIGHT / 4);
    });

    it("should move nothing at the whole body, because there is nothing to pan", async () => {
      await render(<Body />);

      twoFingerPan({ x: 80, y: -80 });

      expect(viewNow()).toStrictEqual({ zoom: 1, x: 0, y: 0 });
    });

    it("should keep the body inside the stage when the zoom then falls", async () => {
      await render(<Body />);
      pinch(MIDDLE, 2);
      twoFingerPan({ x: 0, y: -1000 });

      pinch(MIDDLE, 0.6);

      expect(Math.abs(viewNow().y)).toBeLessThanOrEqual(((viewNow().zoom - 1) * HEIGHT) / 2 + 1e-9);
    });

    it("should run together with the pinch, so a pinch that also moves zooms and pans", async () => {
      await render(<Body />);
      const pinching = fingersOn("body-3d-pinch");
      const panning = fingersOn("body-3d-zoom-pan");

      await pinching.takeHold({ scale: 1.5 });
      await panning.takeHold({ translationY: 0 });
      await panning.moveTo({ translationY: -30 });
      await pinching.moveTo({ scale: 2 });
      await panning.moveTo({ translationY: -50 });
      await pinching.lift({ scale: 2 });
      await panning.lift({ translationY: -50 });

      expect(viewNow().zoom).toBe(2);
      // The pan had moved the view 30 points up when the pinch took the zoom from 1.5 to 2, which scales the move about
      // the middle to 40, and the pan then moved it 20 more.
      expect(viewNow().y).toBeCloseTo(-60);
    });

    it("should take hold at the fingers' first move, at every zoom, with the fingers' middle as its place", async () => {
      await render(<Body />);

      expect(zoomPanGesture().config).toMatchObject({
        minPointers: 2,
        minDist: 0,
        avgTouches: true,
      });
      expect(zoomPanGesture().config.enabled).not.toBe(false);
    });
  });

  describe("one finger and two", () => {
    it("should take one finger only for the turn, so two fingers never turn the body", async () => {
      await render(<Body />);

      expect(rotationPanGesture().config.maxPointers).toBe(1);
    });

    it("should still turn the body with one finger while zoomed, and leave the zoom alone", async () => {
      await render(<Body />);
      pinch(MIDDLE, 2);
      const zoomed = viewNow();

      drag(WIDTH);

      expect(yawNow()).toBeCloseTo(HALF_TURN);
      expect(viewNow()).toStrictEqual(zoomed);
    });

    it("should neither tap nor turn to the other side for a pinch or a two-finger pan", async () => {
      const onTap = jest.fn();
      const onSideChange = jest.fn();
      await render(<Body props={{ onTap, onSideChange }} />);

      pinch(MIDDLE, 1.6);
      twoFingerPan({ x: 0, y: -30 });

      expect(onTap).not.toHaveBeenCalled();
      expect(onSideChange).not.toHaveBeenCalled();
      expect(yawNow()).toBe(0);
    });

    it("should not count a touch with a second finger down as a tap, even when it lifts where it went down", async () => {
      const onTap = jest.fn();
      await render(<Body props={{ onTap }} />);

      await touchLifting({ secondFinger: true });

      expect(onTap).not.toHaveBeenCalled();
    });

    it("should count the next touch of one finger as a tap again", async () => {
      const onTap = jest.fn();
      await render(<Body props={{ onTap }} />);
      await touchLifting({ secondFinger: true });

      await touchLifting({ secondFinger: false });

      expect(onTap).toHaveBeenCalledTimes(1);
    });

    it("should keep the zoom when the body snaps to the other side, by a control and by a drag", async () => {
      const onSideChange = jest.fn();
      const { rerender } = await render(<Body props={{ onSideChange }} />);
      pinch(MIDDLE, 1.6);
      twoFingerPan({ x: 0, y: -20 });
      const zoomed = viewNow();

      await rerender(<Body props={{ side: "back", onSideChange }} />);
      await advance(motionDuration.standard);
      expect(yawNow()).toBeCloseTo(HALF_TURN);
      expect(viewNow()).toStrictEqual(zoomed);

      drag(-WIDTH);
      await advance(motionDuration.standard);
      expect(yawNow()).toBeCloseTo(0);
      expect(viewNow()).toStrictEqual(zoomed);
    });
  });

  describe("reset", () => {
    it("should ease the zoom and the pan back over the standard duration", async () => {
      const { rerender } = await render(<Body props={{ zoomResetCount: 0 }} />);
      pinch({ focalX: WIDTH / 2, focalY: HEIGHT }, 2);
      expect(viewNow().y).toBeCloseTo(-HEIGHT / 2);

      await rerender(<Body props={{ zoomResetCount: 1 }} />);

      expect(withTiming).toHaveBeenCalledTimes(1);
      expect(withTiming).toHaveBeenCalledWith(
        { zoom: 1, x: 0, y: 0 },
        { duration: motionDuration.standard },
      );
      await advance(motionDuration.standard / 2);
      expect(viewNow().zoom).toBeGreaterThan(1);
      expect(viewNow().zoom).toBeLessThan(2);
      // The pan eases with the zoom, not apart from it.
      expect(viewNow().y).toBeGreaterThan(-HEIGHT / 2);
      expect(viewNow().y).toBeLessThan(0);
      await advance(motionDuration.standard);
      expect(viewNow()).toStrictEqual({ zoom: 1, x: 0, y: 0 });
    });

    it("should return at once with reduced motion, with nothing animated", async () => {
      await setReduceMotion(true);
      const { rerender } = await render(<Body props={{ zoomResetCount: 0 }} />);
      pinch({ focalX: WIDTH / 2, focalY: HEIGHT }, 2);

      await rerender(<Body props={{ zoomResetCount: 1 }} />);

      expect(withTiming).not.toHaveBeenCalled();
      expect(viewNow()).toStrictEqual({ zoom: 1, x: 0, y: 0 });
    });

    it("should report the whole body as the reset starts", async () => {
      const onZoomChange = jest.fn();
      const { rerender } = await render(<Body props={{ zoomResetCount: 0, onZoomChange }} />);
      pinch(MIDDLE, 2);
      onZoomChange.mockClear();

      await rerender(<Body props={{ zoomResetCount: 1, onZoomChange }} />);

      expect(onZoomChange.mock.calls).toStrictEqual([[1]]);
    });

    it("should not reset for the count the body starts with, nor for a count that did not rise", async () => {
      const { rerender } = await render(<Body props={{ zoomResetCount: 3 }} />);
      pinch(MIDDLE, 1.8);

      await rerender(<Body props={{ zoomResetCount: 3 }} />);

      expect(withTiming).not.toHaveBeenCalled();
      expect(viewNow().zoom).toBeCloseTo(1.8);
    });

    it("should let a pinch take hold of a reset part way and carry on from where the view is", async () => {
      const { rerender } = await render(<Body props={{ zoomResetCount: 0 }} />);
      pinch(MIDDLE, 2);
      await rerender(<Body props={{ zoomResetCount: 1 }} />);
      await advance(motionDuration.standard / 2);
      const halfWay = viewNow().zoom;

      const fingers = fingersOn("body-3d-pinch");
      await fingers.takeHold({ scale: 1 });
      await fingers.lift({ scale: 1 });
      await advance(motionDuration.standard * 2);

      // The pinch ended where the reset had got to, and the reset it took hold of does not go on.
      expect(halfWay).toBeGreaterThan(1);
      expect(viewNow().zoom).toBeCloseTo(halfWay, 1);
    });
  });
});
