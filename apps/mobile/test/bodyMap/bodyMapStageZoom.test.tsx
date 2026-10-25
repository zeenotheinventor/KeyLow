import "../support/gestureHandler";

import { motionDuration } from "@keylow/tokens";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { State } from "react-native-gesture-handler";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";

import { BodyMapCard } from "../../components/BodyMapCard";
import { resetBody3DSupportForTests } from "../../components/BodyView/testing";
import { resetBodyMapRendererForTests } from "../../lib/bodyMapRenderer/testing";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

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

async function renderStage() {
  await render(
    <ThemeProvider fixedPreference="dark">
      <BodyMapCard {...cardProps} />
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

const viewNow = () => lastCanvasProps().view.get();

// Two fingers that open or close to this scale about the middle of the stage, and lift.
const pinchTo = (scale: number) => {
  const focal = { focalX: 0, focalY: 0 };
  fireGestureHandler(getByGestureTestId("body-3d-pinch"), [
    { state: State.BEGAN, scale: 1, ...focal },
    { state: State.ACTIVE, scale, ...focal },
    { state: State.END, scale, ...focal },
  ]);
};

const advance = (milliseconds: number) =>
  act(() => {
    jest.advanceTimersByTime(milliseconds);
  });

describe("the zoom controls of the 3D stage", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/BodyMapCard",
      "components/BodyMapFigures",
      "components/BodyView",
    ]);
  });

  beforeEach(() => {
    jest.useFakeTimers();
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
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("should show neither the zoom nor Reset while the body is the whole body", async () => {
    await renderStage();
    await drawFirstFrame();

    expect(screen.queryByText(/×/)).not.toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Reset zoom" })).not.toBeOnTheScreen();
  });

  it("should show the zoom as a pill, and Reset, once a pinch has zoomed the body", async () => {
    await renderStage();
    await drawFirstFrame();

    await act(() => {
      pinchTo(2);
    });

    expect(screen.getByText("2×")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Reset zoom" })).toBeOnTheScreen();
    expect(screen.getByText("Reset")).toBeOnTheScreen();
  });

  it("should write the zoom to one decimal place, with no trailing .0", async () => {
    await renderStage();
    await drawFirstFrame();

    await act(() => {
      pinchTo(1.5);
    });

    expect(screen.getByText("1.5×")).toBeOnTheScreen();
  });

  it("should take the pill and Reset away when a pinch brings the body back to the whole body", async () => {
    await renderStage();
    await drawFirstFrame();
    await act(() => {
      pinchTo(2);
    });

    await act(() => {
      pinchTo(0.3);
    });

    expect(screen.queryByText(/×/)).not.toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Reset zoom" })).not.toBeOnTheScreen();
  });

  it("should ease the body back to the whole body when Reset is pressed, and take the pill and Reset away", async () => {
    await renderStage();
    await drawFirstFrame();
    await act(() => {
      pinchTo(2);
    });

    await fireEvent.press(screen.getByRole("button", { name: "Reset zoom" }));
    await advance(motionDuration.standard);

    expect(viewNow()).toStrictEqual({ zoom: 1, x: 0, y: 0 });
    expect(screen.queryByText(/×/)).not.toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Reset zoom" })).not.toBeOnTheScreen();
  });

  it("should bring the body back at once with reduced motion", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    await renderStage();
    await advance(1);
    await drawFirstFrame();
    await act(() => {
      pinchTo(2);
    });

    await fireEvent.press(screen.getByRole("button", { name: "Reset zoom" }));

    expect(viewNow()).toStrictEqual({ zoom: 1, x: 0, y: 0 });
  });

  it("should zoom again after a reset", async () => {
    await renderStage();
    await drawFirstFrame();
    await act(() => {
      pinchTo(2);
    });
    await fireEvent.press(screen.getByRole("button", { name: "Reset zoom" }));
    await advance(motionDuration.standard);

    await act(() => {
      pinchTo(1.6);
    });

    expect(screen.getByText("1.6×")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Reset zoom" })).toBeOnTheScreen();
  });
});
