import { motionDuration } from "@keylow/tokens";
import { act, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { getAnimatedStyle, setUpTests } from "react-native-reanimated";

import { BodyView } from "../components/BodyView";
import { resetBody3DSupportForTests } from "../components/BodyView/testing";
import { resetBodyMapRendererForTests } from "../lib/bodyMapRenderer/testing";
import { ThemeProvider } from "../lib/theme";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";

import type { BodyViewProps } from "../components/BodyView";
import type { BodyMapRenderer } from "@keylow/core/training";
import type { ReactElement } from "react";

setUpTests();

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

// A build without expo-gl has no ExpoGL native module. Every other lookup is the real one.
const mockHasGlModule = jest.fn(() => true);
jest.mock("expo", () => {
  const actual = jest.requireActual<typeof import("expo")>("expo");
  return {
    ...actual,
    requireOptionalNativeModule: (name: string): unknown =>
      name === "ExpoGL" && !mockHasGlModule() ? null : actual.requireOptionalNativeModule(name),
  };
});

// GL does not run in Jest, and the canvas module brings in three, which Jest does not transform. Whether
// the 3D code is read at all is checked in BodyViewLazy.test.tsx.
const mockCanvas = jest.fn<null, [{ onFirstFrame?: () => void }]>(() => null);
jest.mock("../components/ui/Body3D/Body3DCanvas", () => ({
  Body3DCanvas: (props: { onFirstFrame?: () => void }) => mockCanvas(props),
}));

// How long the 3D body has to draw its first frame, so a slow first load on Hermes is not dropped to 2D.
const FIRST_FRAME_TIMEOUT_MILLISECONDS = 8000;

const label = "Body map, front";
const bodyProps: BodyViewProps = { side: "front", scale: "heat", values: {}, label, w: 120 };

function inTheme(element: ReactElement) {
  return <ThemeProvider fixedPreference="dark">{element}</ThemeProvider>;
}

async function renderBodyView(
  preference: BodyMapRenderer,
  props: Partial<BodyViewProps> = {},
): Promise<ReturnType<typeof render>> {
  mockStorageItems.set("bodyMap.renderer", preference);
  const rendered = await render(inTheme(<BodyView {...bodyProps} {...props} />));
  // The stored preference is read a moment after the first render.
  await advance(1);
  return rendered;
}

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds);
  });
}

// The canvas of the 3D body, which draws its first frame when the test says so.
async function drawFirstFrame() {
  const lastProps = mockCanvas.mock.calls.at(-1)?.[0];
  await act(() => {
    lastProps?.onFirstFrame?.();
  });
}

function setReduceMotion(isEnabled: boolean) {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(isEnabled);
}

type Instance = NonNullable<ReturnType<typeof screen.getByRole>["parent"]>;

// The animated layer a figure sits in, found by climbing from the figure.
function animatedLayerOf(image: ReturnType<typeof screen.getByRole>): Instance {
  for (let node = image.parent; node !== null; node = node.parent) {
    if (typeof getAnimatedStyle(node).opacity === "number") {
      return node;
    }
  }
  throw new Error("The figure is not in an animated layer.");
}

function layerOpacityOf(image: ReturnType<typeof screen.getByRole>): number {
  const { opacity } = getAnimatedStyle(animatedLayerOf(image));
  if (typeof opacity !== "number") {
    throw new Error("The layer has no opacity.");
  }
  return opacity;
}

function pointerEventsOf(node: Instance): unknown {
  const props: unknown = node.props;
  return typeof props === "object" && props !== null && "pointerEvents" in props
    ? props.pointerEvents
    : undefined;
}

describe("BodyView", () => {
  beforeAll(async () => {
    registerAppStyles(await compileKitStyles("", ["components/BodyView"]));
  });

  beforeEach(() => {
    jest.useFakeTimers();
    mockStorageItems.clear();
    resetBodyMapRendererForTests();
    resetBody3DSupportForTests();
    mockHasGlModule.mockReturnValue(true);
    mockCanvas.mockReset();
    mockCanvas.mockReturnValue(null);
    setReduceMotion(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("when 2D is chosen", () => {
    it("should draw the 2D figure with its label", async () => {
      await renderBodyView("2d");

      expect(screen.getByRole("img", { name: label })).toBeOnTheScreen();
    });

    it("should never draw the 3D body", async () => {
      await renderBodyView("2d");
      await advance(5000);

      expect(mockCanvas).not.toHaveBeenCalled();
    });
  });

  describe("when 3D is chosen but cannot be used", () => {
    it("should stay on 2D for the female figure and never draw the 3D body", async () => {
      await renderBodyView("3d", { body: "female" });
      await advance(5000);

      expect(screen.getByRole("img", { name: label })).toBeOnTheScreen();
      expect(mockCanvas).not.toHaveBeenCalled();
    });

    it("should stay on 2D in a build without the GL module and never draw the 3D body", async () => {
      mockHasGlModule.mockReturnValue(false);

      await renderBodyView("3d");
      await advance(5000);

      expect(screen.getByRole("img", { name: label })).toBeOnTheScreen();
      expect(mockCanvas).not.toHaveBeenCalled();
    });
  });

  describe("when 3D is chosen for the male figure", () => {
    it("should read the 3D code and show the 2D figure while it loads", async () => {
      await renderBodyView("3d");

      expect(mockCanvas).toHaveBeenCalled();
      expect(screen.getByRole("img", { name: label })).toBeOnTheScreen();
      expect(layerOpacityOf(screen.getByRole("img", { name: label }))).toBe(1);
    });

    it("should be read as one image with the label before, during and after the swap", async () => {
      await renderBodyView("3d");
      expect(screen.getAllByRole("img", { name: label })).toHaveLength(1);

      await drawFirstFrame();
      await advance(motionDuration.standard / 2);
      expect(screen.getAllByRole("img", { name: label })).toHaveLength(1);

      await advance(motionDuration.standard);
      expect(screen.getAllByRole("img", { name: label })).toHaveLength(1);
    });

    it("should hand the screen reader to the 3D body once it has drawn", async () => {
      await renderBodyView("3d");
      const [, body] = screen.getAllByRole("img", { name: label, hidden: true });

      await drawFirstFrame();

      expect(screen.getByRole("img", { name: label })).toBe(body);
    });

    it("should cross-fade to the 3D body over 220 ms", async () => {
      await renderBodyView("3d");
      const [figure, body] = screen.getAllByRole("img", { name: label, hidden: true });
      if (figure === undefined || body === undefined) {
        throw new Error("Both figures should be in the tree.");
      }

      await drawFirstFrame();
      await advance(motionDuration.standard / 2);

      expect(layerOpacityOf(figure)).toBeGreaterThan(0.2);
      expect(layerOpacityOf(figure)).toBeLessThan(0.8);
      expect(layerOpacityOf(body)).toBeGreaterThan(0.2);
      expect(layerOpacityOf(body)).toBeLessThan(0.8);

      await advance(motionDuration.standard);

      expect(layerOpacityOf(figure)).toBeCloseTo(0, 2);
      expect(layerOpacityOf(body)).toBeCloseTo(1, 2);
    });

    it("should swap at once with reduced motion", async () => {
      setReduceMotion(true);
      // The setting is read when the first component asks, and its answer comes a moment later.
      const probe = await render(inTheme(<BodyView {...bodyProps} />));
      await advance(1);
      await probe.unmount();
      resetBodyMapRendererForTests();
      await renderBodyView("3d");
      const [figure, body] = screen.getAllByRole("img", { name: label, hidden: true });
      if (figure === undefined || body === undefined) {
        throw new Error("Both figures should be in the tree.");
      }

      await drawFirstFrame();
      await advance(1);

      expect(layerOpacityOf(figure)).toBe(0);
      expect(layerOpacityOf(body)).toBe(1);
    });

    it("should keep the 3D layer just visible while it loads, so GL still draws", async () => {
      await renderBodyView("3d");
      const [, body] = screen.getAllByRole("img", { name: label, hidden: true });
      if (body === undefined) {
        throw new Error("The 3D body should be in the tree.");
      }

      expect(layerOpacityOf(body)).toBeGreaterThan(0);
      expect(layerOpacityOf(body)).toBeLessThan(0.05);
    });

    it("should let touches reach the 2D figure while the 3D body loads, then stop them once it has drawn", async () => {
      await renderBodyView("3d");
      const figure = screen.getByRole("img", { name: label });
      expect(pointerEventsOf(animatedLayerOf(figure))).toBe("auto");

      await drawFirstFrame();

      const [hiddenFigure] = screen.getAllByRole("img", { name: label, hidden: true });
      if (hiddenFigure === undefined) {
        throw new Error("The 2D figure should be in the tree.");
      }
      expect(pointerEventsOf(animatedLayerOf(hiddenFigure))).toBe("none");
    });

    it("should let the 3D layer take a touch only once it has drawn, so a drag reaches the body", async () => {
      await renderBodyView("3d");
      const [, body] = screen.getAllByRole("img", { name: label, hidden: true });
      if (body === undefined) {
        throw new Error("The 3D body should be in the tree.");
      }
      const holder = animatedLayerOf(body).parent;
      expect(holder && pointerEventsOf(holder)).toBe("none");

      await drawFirstFrame();

      expect(holder && pointerEventsOf(holder)).toBe("auto");
    });

    it("should keep the 2D figure when no first frame comes in time", async () => {
      await renderBodyView("3d");

      await advance(FIRST_FRAME_TIMEOUT_MILLISECONDS);

      expect(screen.getByRole("img", { name: label })).toBeOnTheScreen();
      expect(screen.getAllByRole("img", { name: label, hidden: true })).toHaveLength(1);
    });

    it("should keep waiting for the 3D body until the time is up", async () => {
      await renderBodyView("3d");

      await advance(FIRST_FRAME_TIMEOUT_MILLISECONDS - 2);

      expect(screen.getAllByRole("img", { name: label, hidden: true })).toHaveLength(2);
    });

    it("should not fall back when the first frame comes just before the time is up", async () => {
      await renderBodyView("3d");

      await advance(FIRST_FRAME_TIMEOUT_MILLISECONDS - 2);
      await drawFirstFrame();
      await advance(motionDuration.standard + FIRST_FRAME_TIMEOUT_MILLISECONDS);

      expect(screen.getAllByRole("img", { name: label, hidden: true })).toHaveLength(2);
    });

    it("should keep the 2D figure, and not throw, when the 3D tree throws", async () => {
      jest.spyOn(console, "error").mockImplementation(() => undefined);
      mockCanvas.mockImplementation(() => {
        throw new Error("The GL context could not start.");
      });

      await renderBodyView("3d");

      expect(screen.getByRole("img", { name: label })).toBeOnTheScreen();
      expect(screen.getAllByRole("img", { name: label, hidden: true })).toHaveLength(1);
    });

    it("should show no error text and no retry button when 3D fails", async () => {
      jest.spyOn(console, "error").mockImplementation(() => undefined);
      mockCanvas.mockImplementation(() => {
        throw new Error("The GL context could not start.");
      });

      await renderBodyView("3d");

      expect(screen.queryByRole("button")).not.toBeOnTheScreen();
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });

    it("should not try 3D again in a later mount after it timed out", async () => {
      const first = await renderBodyView("3d");
      await advance(FIRST_FRAME_TIMEOUT_MILLISECONDS);
      await first.unmount();
      mockCanvas.mockClear();

      await render(inTheme(<BodyView {...bodyProps} />));
      await advance(5000);

      expect(mockCanvas).not.toHaveBeenCalled();
      expect(screen.getByRole("img", { name: label })).toBeOnTheScreen();
    });

    it("should not try 3D again in a later mount after it threw", async () => {
      jest.spyOn(console, "error").mockImplementation(() => undefined);
      mockCanvas.mockImplementation(() => {
        throw new Error("The GL context could not start.");
      });
      const first = await renderBodyView("3d");
      await first.unmount();
      mockCanvas.mockClear();

      await render(inTheme(<BodyView {...bodyProps} />));

      expect(mockCanvas).not.toHaveBeenCalled();
    });

    it("should keep the saved preference when 3D fails", async () => {
      await renderBodyView("3d");
      await advance(FIRST_FRAME_TIMEOUT_MILLISECONDS);

      expect(mockStorageItems.get("bodyMap.renderer")).toBe("3d");
    });
  });
});
