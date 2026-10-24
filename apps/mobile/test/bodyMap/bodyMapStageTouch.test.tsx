import "../support/gestureHandler";

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { State } from "react-native-gesture-handler";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";

import { BodyMapCard } from "../../components/BodyMapCard";
import { resetBody3DSupportForTests } from "../../components/BodyView/testing";
import { resetBodyMapRendererForTests } from "../../lib/bodyMapRenderer/testing";
import { ThemeProvider } from "../../lib/theme";
import { failBeforeTakingHold } from "../support/failedPan";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { wrappedByGestureDetector } from "../support/wrappedByGestureDetector";

import type { BodyMapCardProps } from "../../components/BodyMapCard";
import type { Body3DCanvasProps } from "../../components/ui/Body3D/types";

const mockStorageItems = new Map<string, string>();
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => Promise.resolve(mockStorageItems.get(key) ?? null),
    setItem: (key: string, value: string) => {
      mockStorageItems.set(key, value);
      return Promise.resolve();
    },
  },
}));

jest.mock("expo", () => ({
  ...jest.requireActual<typeof import("expo")>("expo"),
  requireOptionalNativeModule: () => ({}),
}));

// GL does not run in Jest. The real 3D body is drawn, with its canvas stood in for, so its own touch area and
// gestures are the ones under test, and the turn it hands the canvas is read from the canvas's props.
const mockCanvas = jest.fn<null, [Body3DCanvasProps]>(() => null);
jest.mock("../../components/ui/Body3D/Body3DCanvas", () => ({
  Body3DCanvas: (props: Body3DCanvasProps) => mockCanvas(props),
}));

const lastCanvasProps = (): Body3DCanvasProps => {
  const props = mockCanvas.mock.lastCall?.[0];
  if (props === undefined) {
    throw new Error("The canvas has not been drawn.");
  }
  return props;
};

const STAGE_WIDTH = 300;

// Whether a view above the element is the given width, which is the way a style can be read without a cast.
function hasAncestorOfWidth(element: ReturnType<typeof screen.getByRole>, width: number): boolean {
  for (let ancestor = element.parent; ancestor !== null; ancestor = ancestor.parent) {
    try {
      expect(ancestor).toHaveStyle({ width });
      return true;
    } catch {
      // Not this one, so the next view up.
    }
  }
  return false;
}
const BODY_WIDTH = 108;
const BODY_HEIGHT = (BODY_WIDTH * 440) / 200;

const cardProps: BodyMapCardProps = {
  scale: "heat",
  view: "actual",
  actualValues: { quads: 3 },
  projectedValues: { quads: 1 },
  viewLabel: "Actual",
  subLine: "Now",
  toggleLabel: "Show projected",
  isToggleEnabled: true,
  onToggle: () => undefined,
  note: null,
};

async function renderStage(props: Partial<BodyMapCardProps> = {}) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <BodyMapCard {...cardProps} {...props} />
    </ThemeProvider>,
  );
  // The stored preference is read a moment after the first render.
  await act(async () => {
    await Promise.resolve();
  });
}

const drawFirstFrame = () =>
  act(() => {
    lastCanvasProps().onFirstFrame?.();
  });

// The layout the phone gives the stage, which the image is in, so the event reaches the stage's own handler.
const layOutStage = (width: number) =>
  act(async () => {
    await fireEvent(screen.getByRole("img"), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width, height: 240 } },
    });
  });

describe("the touch surface of the 3D stage", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/BodyMapCard",
      "components/BodyMapFigures",
      "components/BodyView",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    mockStorageItems.clear();
    mockStorageItems.set("bodyMap.renderer", "3d");
    resetBodyMapRendererForTests();
    resetBody3DSupportForTests();
    mockCanvas.mockReset();
    mockCanvas.mockReturnValue(null);
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("what takes the drag and the tap", () => {
    it("should be as wide as the whole stage, not the 108 points of the body", async () => {
      await renderStage();
      await drawFirstFrame();
      await layOutStage(STAGE_WIDTH);

      expect(wrappedByGestureDetector()).toHaveStyle({ width: STAGE_WIDTH, height: BODY_HEIGHT });
      expect(screen.getByRole("img")).toHaveStyle({ width: BODY_WIDTH, height: BODY_HEIGHT });
    });

    it("should keep the body's own width until the stage has been laid out", async () => {
      await renderStage();
      await drawFirstFrame();

      expect(wrappedByGestureDetector()).toHaveStyle({ width: BODY_WIDTH, height: BODY_HEIGHT });
    });

    it("should make the box around the 2D figure, which the 3D body draws over, as wide as the stage", async () => {
      await renderStage();
      await layOutStage(STAGE_WIDTH);

      // While 3D loads the one image is the 2D figure, so the boxes above it are the 3D body's own.
      expect(hasAncestorOfWidth(screen.getByRole("img"), STAGE_WIDTH)).toBe(true);
    });
  });

  describe("a drag", () => {
    it("should turn half a turn for a drag across the width of the body, not of the stage", async () => {
      await renderStage();
      await drawFirstFrame();
      await layOutStage(STAGE_WIDTH);

      fireGestureHandler(getByGestureTestId("body-3d-pan"), [
        { state: State.BEGAN, translationX: 0 },
        { state: State.ACTIVE, translationX: BODY_WIDTH / 4 },
      ]);

      expect(lastCanvasProps().yaw.get()).toBeCloseTo(Math.PI / 4);
    });

    it("should settle on the back and move the Front and Back switch when released past a quarter turn", async () => {
      await renderStage();
      await drawFirstFrame();
      await layOutStage(STAGE_WIDTH);

      await act(() => {
        fireGestureHandler(getByGestureTestId("body-3d-pan"), [
          { state: State.BEGAN, translationX: 0 },
          { state: State.ACTIVE, translationX: BODY_WIDTH * 0.6 },
          { state: State.END, translationX: BODY_WIDTH * 0.6, velocityX: 4000 },
        ]);
      });

      expect(screen.getByRole("radio", { name: "Back", checked: true })).toBeOnTheScreen();
    });

    it("should leave a vertical move to the page", async () => {
      await renderStage();
      await drawFirstFrame();
      await layOutStage(STAGE_WIDTH);

      await failBeforeTakingHold("body-3d-pan");

      expect(lastCanvasProps().yaw.get()).toBe(0);
      expect(screen.getByRole("radio", { name: "Front", checked: true })).toBeOnTheScreen();
    });
  });

  describe("a tap", () => {
    it("should toggle Actual and Projected", async () => {
      const onToggle = jest.fn();
      await renderStage({ onToggle });
      await drawFirstFrame();
      await layOutStage(STAGE_WIDTH);

      fireGestureHandler(getByGestureTestId("body-3d-tap"), [
        { state: State.BEGAN, x: 20, y: 100 },
        { state: State.ACTIVE, x: 20, y: 100 },
        { state: State.END, x: 20, y: 100 },
      ]);

      expect(onToggle).toHaveBeenCalledTimes(1);
    });
  });
});
