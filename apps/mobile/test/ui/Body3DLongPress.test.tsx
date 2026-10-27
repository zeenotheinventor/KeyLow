import "../support/gestureHandler";

import { BODY_LONG_PRESS_DELAY_MILLISECONDS, BODY_TAP_SLOP } from "@keylow/body-3d/touch";
import { act, render } from "@testing-library/react-native";
import { DeviceEventEmitter } from "react-native";
import { State } from "react-native-gesture-handler";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";

import { Body3D } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { Body3DProps } from "../../components/ui";
import type { Body3DCanvasProps, MusclePicker } from "../../components/ui/Body3D/types";
import type { MuscleId } from "@keylow/core/training";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// GL does not run in Jest. The canvas is stood in for, and a test plays the canvas by handing the body its picker.
const mockCanvas = jest.fn<null, [Body3DCanvasProps]>(() => null);
jest.mock("../../components/ui/Body3D/Body3DCanvas", () => ({
  Body3DCanvas: (props: Body3DCanvasProps) => mockCanvas(props),
}));

const label = "Body, male, 3D";

const panGesture = () => getByGestureTestId("body-3d-pan");
const tapGesture = () => getByGestureTestId("body-3d-tap");
const longPressGesture = () => getByGestureTestId("body-3d-long-press");

// What the canvas does once its camera and body are in the scene: it hands the body the function that picks.
async function canvasPicks(pick: MusclePicker | null) {
  const props = mockCanvas.mock.lastCall?.[0];
  if (props?.onPickerChange === undefined) {
    throw new Error("The canvas was not given a way to hand over its picker.");
  }
  const { onPickerChange } = props;
  await act(() => {
    onPickerChange(pick);
  });
}

// The finger goes down, stays within the slop for the delay, and lifts. Only the long press is told.
function holdAt(point: { x: number; y: number }) {
  fireGestureHandler(longPressGesture(), [
    { state: State.BEGAN, ...point },
    { state: State.ACTIVE, ...point },
    { state: State.END, ...point },
  ]);
}

// The long press as far as the finger gets before it ends without firing: it begins, and then the gesture handler
// fails it (a second finger, a move past the slop) or cancels it (a drag took the touch). The utility above always
// runs a gesture through to ACTIVE, so this one sends the two events itself.
async function longPressThatEnds(endState: State) {
  const handlerTag = longPressGesture().handlerTag;
  const send = async (state: State, oldState: State) => {
    await act(() => {
      DeviceEventEmitter.emit("onGestureHandlerStateChange", {
        handlerTag,
        state,
        oldState,
        x: 10,
        y: 10,
        absoluteX: 10,
        absoluteY: 10,
        numberOfPointers: 1,
      });
    });
  };
  await send(State.BEGAN, State.UNDETERMINED);
  await send(endState, State.BEGAN);
}

// A finger that went down and lifted before the delay, which the long press fails for and the tap takes.
function tapAt(point: { x: number; y: number }) {
  fireGestureHandler(tapGesture(), [
    { state: State.BEGAN, ...point },
    { state: State.ACTIVE, ...point },
    { state: State.END, ...point },
  ]);
}

function dragAcross(distance: number) {
  fireGestureHandler(panGesture(), [
    { state: State.BEGAN, translationX: 0 },
    { state: State.ACTIVE, translationX: distance },
    { state: State.END, translationX: distance, velocityX: 0 },
  ]);
}

function Rendered({ props = {} }: { props?: Partial<Body3DProps> }) {
  return (
    <ThemeProvider fixedPreference="dark">
      <Body3D label={label} w={120} {...props} />
    </ThemeProvider>
  );
}

describe("Body3D long press", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    mockCanvas.mockReset();
    mockCanvas.mockReturnValue(null);
  });

  describe("what a long press opens", () => {
    it("should call onLongPressMuscle once with the muscle under the finger", async () => {
      const onLongPressMuscle = jest.fn();
      await render(<Rendered props={{ onLongPressMuscle }} />);
      await canvasPicks(() => "chest_upper");

      holdAt({ x: 60, y: 90 });

      expect(onLongPressMuscle.mock.calls).toEqual([["chest_upper"]]);
    });

    it("should ask the canvas to pick at the point the finger is on, in points on the touch area", async () => {
      const pick = jest.fn<MuscleId | null, [{ x: number; y: number }]>(() => "calves");
      await render(<Rendered props={{ onLongPressMuscle: jest.fn() }} />);
      await canvasPicks(pick);

      holdAt({ x: 61, y: 202 });

      expect(pick.mock.calls).toEqual([[{ x: 61, y: 202 }]]);
    });

    it("should call it when the long press fires, with the finger still down, and not on the lift", async () => {
      const onLongPressMuscle = jest.fn();
      await render(<Rendered props={{ onLongPressMuscle }} />);
      await canvasPicks(() => "lats");

      fireGestureHandler(longPressGesture(), [
        { state: State.BEGAN, x: 10, y: 10 },
        { state: State.ACTIVE, x: 10, y: 10 },
      ]);

      expect(onLongPressMuscle).toHaveBeenCalledTimes(1);
    });

    it("should do nothing when the point is on empty space or a muscle with no id", async () => {
      const onLongPressMuscle = jest.fn();
      await render(<Rendered props={{ onLongPressMuscle }} />);
      await canvasPicks(() => null);

      holdAt({ x: 5, y: 5 });

      expect(onLongPressMuscle).not.toHaveBeenCalled();
    });

    it("should do nothing before the canvas has handed over a picker", async () => {
      const onLongPressMuscle = jest.fn();
      await render(<Rendered props={{ onLongPressMuscle }} />);

      expect(() => {
        holdAt({ x: 60, y: 90 });
      }).not.toThrow();

      expect(onLongPressMuscle).not.toHaveBeenCalled();
    });

    it("should do nothing once the canvas has taken its picker back", async () => {
      const onLongPressMuscle = jest.fn();
      await render(<Rendered props={{ onLongPressMuscle }} />);
      await canvasPicks(() => "chest_upper");
      await canvasPicks(null);

      holdAt({ x: 60, y: 90 });

      expect(onLongPressMuscle).not.toHaveBeenCalled();
    });

    it("should call it again with the new muscle for a second long press, as when a sheet is open", async () => {
      const onLongPressMuscle = jest.fn();
      const pick = jest.fn<MuscleId | null, []>();
      pick.mockReturnValueOnce("chest_upper").mockReturnValueOnce("calves");
      await render(<Rendered props={{ onLongPressMuscle }} />);
      await canvasPicks(pick);

      holdAt({ x: 60, y: 90 });
      holdAt({ x: 60, y: 200 });

      expect(onLongPressMuscle.mock.calls).toEqual([["chest_upper"], ["calves"]]);
    });

    it("should call the latest handler, without being built again", async () => {
      const first = jest.fn();
      const second = jest.fn();
      const { rerender } = await render(<Rendered props={{ onLongPressMuscle: first }} />);
      await canvasPicks(() => "abs");
      const before = longPressGesture();

      await rerender(<Rendered props={{ onLongPressMuscle: second }} />);
      holdAt({ x: 60, y: 120 });

      expect(longPressGesture()).toBe(before);
      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledTimes(1);
    });
  });

  describe("what is not a long press", () => {
    it.each([
      ["failed", State.FAILED],
      ["cancelled", State.CANCELLED],
    ] as const)(
      "should not call it when the long press is %s before it fires, as when the finger drags off, a second lands or the drag takes the touch",
      async (_name, endState) => {
        const onLongPressMuscle = jest.fn();
        await render(<Rendered props={{ onLongPressMuscle }} />);
        await canvasPicks(() => "chest_upper");

        await longPressThatEnds(endState);

        expect(onLongPressMuscle).not.toHaveBeenCalled();
      },
    );

    it("should not call it for a drag", async () => {
      const onLongPressMuscle = jest.fn();
      await render(<Rendered props={{ onLongPressMuscle }} />);
      await canvasPicks(() => "chest_upper");

      dragAcross(60);

      expect(onLongPressMuscle).not.toHaveBeenCalled();
    });

    it("should toggle for a tap and not open a sheet", async () => {
      const onLongPressMuscle = jest.fn();
      const onTap = jest.fn();
      const pick = jest.fn<MuscleId | null, []>(() => "chest_upper");
      await render(<Rendered props={{ onLongPressMuscle, onTap }} />);
      await canvasPicks(pick);

      tapAt({ x: 60, y: 90 });

      expect(onTap).toHaveBeenCalledTimes(1);
      expect(onLongPressMuscle).not.toHaveBeenCalled();
      expect(pick).not.toHaveBeenCalled();
    });

    it("should not also toggle when the finger that long pressed lifts", async () => {
      const onLongPressMuscle = jest.fn();
      const onTap = jest.fn();
      await render(<Rendered props={{ onLongPressMuscle, onTap }} />);
      await canvasPicks(() => "chest_upper");

      holdAt({ x: 60, y: 90 });
      tapAt({ x: 60, y: 90 });

      expect(onLongPressMuscle).toHaveBeenCalledTimes(1);
      expect(onTap).not.toHaveBeenCalled();
    });

    it("should not toggle when a long press on empty space lifts either, because the hold is not a tap", async () => {
      const onTap = jest.fn();
      await render(<Rendered props={{ onLongPressMuscle: jest.fn(), onTap }} />);
      await canvasPicks(() => null);

      holdAt({ x: 5, y: 5 });
      tapAt({ x: 5, y: 5 });

      expect(onTap).not.toHaveBeenCalled();
    });

    it("should toggle for a tap once the handler is taken away, though a long press had fired", async () => {
      const onTap = jest.fn();
      const { rerender } = await render(
        <Rendered props={{ onLongPressMuscle: jest.fn(), onTap }} />,
      );
      await canvasPicks(() => "chest_upper");
      holdAt({ x: 60, y: 90 });

      await rerender(<Rendered props={{ onTap }} />);
      tapAt({ x: 60, y: 90 });

      expect(onTap).toHaveBeenCalledTimes(1);
    });

    it("should toggle for a tap that follows a long press, a touch later", async () => {
      const onTap = jest.fn();
      await render(<Rendered props={{ onLongPressMuscle: jest.fn(), onTap }} />);
      await canvasPicks(() => "chest_upper");
      holdAt({ x: 60, y: 90 });
      // The next touch begins, which is the long press beginning again, and it does not fire.
      await longPressThatEnds(State.FAILED);

      tapAt({ x: 60, y: 90 });

      expect(onTap).toHaveBeenCalledTimes(1);
    });
  });

  describe("how it is told from the other touches", () => {
    it("should fire after the 2D figure's delay, which is read from the one constant", async () => {
      await render(<Rendered props={{ onLongPressMuscle: jest.fn() }} />);

      expect(longPressGesture().config.minDurationMs).toBe(BODY_LONG_PRESS_DELAY_MILLISECONDS);
    });

    it("should be given up by a finger that moves more than the tap slop", async () => {
      await render(<Rendered props={{ onLongPressMuscle: jest.fn() }} />);

      expect(longPressGesture().config.maxDist).toBe(BODY_TAP_SLOP);
    });

    it("should be of one finger", async () => {
      await render(<Rendered props={{ onLongPressMuscle: jest.fn() }} />);

      expect(longPressGesture().config.numberOfPointers ?? 1).toBe(1);
    });

    it("should leave the tap to fail at the delay too, so a touch is a tap or a long press and never both", async () => {
      await render(<Rendered props={{ onLongPressMuscle: jest.fn() }} />);

      expect(tapGesture().config.maxDurationMs).toBe(BODY_LONG_PRESS_DELAY_MILLISECONDS);
    });

    it("should be left to nobody's failure, because it fires while the finger is down and the drag has not failed", async () => {
      await render(<Rendered props={{ onLongPressMuscle: jest.fn() }} />);

      expect(longPressGesture().config.requireToFail ?? []).toEqual([]);
      expect(longPressGesture().config.simultaneousWith ?? []).toEqual([]);
      expect(panGesture().config.requireToFail ?? []).toEqual([]);
    });

    it("should not take touches at all without a handler, so a still finger can still drag", async () => {
      await render(<Rendered />);

      expect(longPressGesture().config.enabled).toBe(false);
    });
  });
});
