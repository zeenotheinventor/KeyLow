import "../support/gestureHandler";

import { render, screen } from "@testing-library/react-native";
import { State } from "react-native-gesture-handler";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";

import { Body3D } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { failBeforeTakingHold } from "../support/failedPan";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { wrappedByGestureDetector } from "../support/wrappedByGestureDetector";

import type { Body3DProps } from "../../components/ui";
import type { Body3DCanvasProps } from "../../components/ui/Body3D/types";
import type { ReactNode } from "react";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// GL does not run in Jest. The canvas is stood in for, and the turn it is given is read from its props.
const mockCanvas = jest.fn<null, [Body3DCanvasProps]>(() => null);
jest.mock("../../components/ui/Body3D/Body3DCanvas", () => ({
  Body3DCanvas: (props: Body3DCanvasProps) => mockCanvas(props),
}));
jest.mock("../../components/ui/Body3D/Body3DBoundary", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  const { createElement } = jest.requireActual<typeof import("react")>("react");
  // The boundary is stood in for by a view that can be found, since the GL view it holds draws nothing here.
  return {
    Body3DBoundary: ({ children }: { children: ReactNode }) =>
      createElement(View, { testID: "gl-view" }, children),
  };
});

const label = "Body, male, 3D";
const BODY_WIDTH = 108;
const TOUCH_WIDTH = 300;
const BODY_HEIGHT = (BODY_WIDTH * 440) / 200;

const yawNow = (): number => {
  const props = mockCanvas.mock.lastCall?.[0];
  if (props === undefined) {
    throw new Error("The canvas has not been drawn.");
  }
  return props.yaw.get();
};

function drag(distance: number) {
  fireGestureHandler(getByGestureTestId("body-3d-pan"), [
    { state: State.BEGAN, translationX: 0 },
    { state: State.ACTIVE, translationX: distance },
    { state: State.END, translationX: distance, velocityX: 4000 },
  ]);
}

function renderBody(props: Partial<Body3DProps> = {}) {
  return render(
    <ThemeProvider fixedPreference="dark">
      <Body3D label={label} w={BODY_WIDTH} {...props} />
    </ThemeProvider>,
  );
}

describe("Body3D touch area", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
    mockCanvas.mockReset();
    mockCanvas.mockReturnValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("what the gestures are attached to", () => {
    it("should attach them to a view as wide as the touch area, and draw the body at its own width inside", async () => {
      await renderBody({ touchWidth: TOUCH_WIDTH });

      expect(wrappedByGestureDetector()).toHaveStyle({ width: TOUCH_WIDTH, height: BODY_HEIGHT });
      expect(screen.getByRole("img", { name: label })).toHaveStyle({
        width: BODY_WIDTH,
        height: BODY_HEIGHT,
      });
    });

    it("should make the GL view as wide as the touch area, centred on the body, so a zoomed body is not cut off at the body's width", async () => {
      await renderBody({ touchWidth: TOUCH_WIDTH });

      const glView = screen.getByTestId("gl-view").parent;
      expect(glView).toHaveStyle({ width: TOUCH_WIDTH, left: (BODY_WIDTH - TOUCH_WIDTH) / 2 });
    });

    it("should have the GL view be the width of the body when the touch area is", async () => {
      await renderBody();

      expect(screen.getByTestId("gl-view").parent).toHaveStyle({ width: BODY_WIDTH, left: 0 });
    });

    it("should have the touch area be the width of the body when it is not given", async () => {
      await renderBody();

      expect(wrappedByGestureDetector()).toHaveStyle({ width: BODY_WIDTH, height: BODY_HEIGHT });
    });

    it("should never take a touch area narrower than the body", async () => {
      await renderBody({ touchWidth: 40 });

      expect(wrappedByGestureDetector()).toHaveStyle({ width: BODY_WIDTH, height: BODY_HEIGHT });
    });
  });

  describe("what a drag does", () => {
    it("should turn half a turn for a drag across the width of the body, as with no wider touch area", async () => {
      await renderBody({ touchWidth: TOUCH_WIDTH });

      drag(BODY_WIDTH);

      // The release settles on the nearer side, so a half turn is the back.
      expect(yawNow()).toBeCloseTo(Math.PI);
    });

    it("should turn a quarter for a drag across half of the body, wherever on the touch area it starts", async () => {
      await renderBody({ touchWidth: TOUCH_WIDTH });

      // Just short of the quarter turn, so the release settles back on the front and the turn can be read.
      fireGestureHandler(getByGestureTestId("body-3d-pan"), [
        { state: State.BEGAN, translationX: 0 },
        { state: State.ACTIVE, translationX: BODY_WIDTH / 2 - 1 },
      ]);

      expect(yawNow()).toBeCloseTo(((BODY_WIDTH / 2 - 1) / BODY_WIDTH) * Math.PI);
    });

    it("should leave a vertical move to the page, so the drag fails and turns nothing", async () => {
      const onSideChange = jest.fn();
      const onTap = jest.fn();
      await renderBody({ touchWidth: TOUCH_WIDTH, onSideChange, onTap });

      await failBeforeTakingHold("body-3d-pan");

      expect(yawNow()).toBe(0);
      expect(onSideChange).not.toHaveBeenCalled();
      expect(onTap).not.toHaveBeenCalled();
    });

    it("should fail the drag at 10 points up or down, as before", async () => {
      await renderBody({ touchWidth: TOUCH_WIDTH });

      expect(getByGestureTestId("body-3d-pan").config).toMatchObject({
        failOffsetYStart: -10,
        failOffsetYEnd: 10,
      });
    });
  });

  describe("what a tap does", () => {
    it("should call onTap for a tap on the touch area", async () => {
      const onTap = jest.fn();
      await renderBody({ touchWidth: TOUCH_WIDTH, onTap });

      fireGestureHandler(getByGestureTestId("body-3d-tap"), [
        { state: State.BEGAN, x: 20, y: 100 },
        { state: State.ACTIVE, x: 20, y: 100 },
        { state: State.END, x: 20, y: 100 },
      ]);

      expect(onTap).toHaveBeenCalledTimes(1);
    });
  });
});
