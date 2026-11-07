import { themes } from "@keylow/tokens";
import { act, render, screen } from "@testing-library/react-native";
import { Profiler } from "react";
import { AccessibilityInfo, Text } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { LoadingMark } from "../../components/LoadingMark";
import { loadingMarkPose } from "../../components/LoadingMark/loadingMarkPose";
import { ThemeProvider } from "../../lib/theme";

import type { ReactNode } from "react";
import type { View, ViewProps } from "react-native";
import type { TestInstance } from "test-renderer";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
// Reanimated hands an animated prop to the library's component, which draws it natively and shows a test
// nothing. So the lines and circles are plain views that keep every prop they are given, and the
// numbers the animation writes can be read back. The Svg around them is the library's own. This
// proves the numbers and the cleanup. It does not prove that react-native-svg draws them, which only a
// phone can.
jest.mock("react-native-svg", () => {
  const actual = jest.requireActual<{ default: unknown }>("react-native-svg");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  const { createElement, forwardRef } = jest.requireActual<typeof import("react")>("react");
  const standIn = (testID: string) =>
    forwardRef<View, ViewProps>(function StandIn(props, ref) {
      return createElement(View, { ...props, ref, testID });
    });
  return { ...actual, __esModule: true, Circle: standIn("arc"), Line: standIn("line") };
});

setUpTests();

const LOOP_MILLISECONDS = 2200;

type ReduceMotionListener = (isEnabled: boolean) => void;
let announceReduceMotionChange: ReduceMotionListener | undefined;

function reduceMotion(isEnabled: boolean) {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(isEnabled);
}

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds);
  });
}

const inTheme = (children: ReactNode) => (
  <ThemeProvider fixedPreference="dark">{children}</ThemeProvider>
);

// The decoration is hidden from a screen reader and has no role, so its parts are found by test ID, and
// the hidden ones are asked for.
const lines = () => screen.getAllByTestId("line", { includeHiddenElements: true });
const arcs = () => screen.getAllByTestId("arc", { includeHiddenElements: true });

// Jest's fake clock always holds a timer or two of its own. The count with nothing animated is what an
// animation that has stopped must come back to, once its last frame has been and gone.
async function idleTimerCount() {
  const { unmount } = await render(inTheme(<Text>Nothing moves</Text>));
  await unmount();
  await advance(100);
  return jest.getTimerCount();
}

// A host node's props are loosely typed, so a prop is read with a descriptor.
function propOf(element: TestInstance, name: string): unknown {
  return Object.getOwnPropertyDescriptor(element.props, name)?.value;
}

// What the animation has written to the element so far, which Reanimated keeps for Jest in jestAnimatedProps.
function animatedValuesOf(element: TestInstance): object {
  const holder = propOf(element, "jestAnimatedProps");
  const values: unknown =
    typeof holder === "object" && holder !== null
      ? Object.getOwnPropertyDescriptor(holder, "value")?.value
      : undefined;
  return typeof values === "object" && values !== null ? values : {};
}

// The loop's position when this long has passed, as the first frame is 0.72 of the way through the pose.
const loopPosition = (milliseconds: number) => (milliseconds / LOOP_MILLISECONDS + 0.72) % 1;

// What the UI thread writes to an arc at that moment, as the animated props of the arc.
function arcAnimatedProps(arc: "arcOne" | "arcTwo", milliseconds: number) {
  const { length, offset, opacity } = loadingMarkPose(loopPosition(milliseconds))[arc];
  return { strokeDasharray: [length, 1000], strokeDashoffset: offset, opacity };
}

describe("LoadingMark", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    announceReduceMotionChange = undefined;
    // addEventListener is overloaded by event name and a spy sees only the last overload, so this
    // stand-in is typed by hand. The subscription it returns has the one method the hook calls.
    const addEventListener = (eventName: string, listener: ReduceMotionListener) => {
      if (eventName === "reduceMotionChanged") {
        announceReduceMotionChange = listener;
      }
      return { remove: jest.fn() };
    };
    jest
      .spyOn(AccessibilityInfo, "addEventListener")
      .mockImplementation(addEventListener as unknown as typeof AccessibilityInfo.addEventListener);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("with motion", () => {
    beforeEach(() => {
      reduceMotion(false);
    });

    it("should draw the bar, two plates and two arcs, hidden from a screen reader at the size given", async () => {
      await render(inTheme(<LoadingMark size={20} />));

      expect(lines()).toHaveLength(3);
      expect(arcs()).toHaveLength(2);
      expect(screen.queryByRole("img")).toBeNull();
      expect(screen.queryByLabelText(/./)).toBeNull();
    });

    it("should draw the arcs in the accent and the bar and plates in the primary text", async () => {
      await render(inTheme(<LoadingMark size={20} />));

      const { accent, "text-primary": textPrimary } = themes.dark;
      expect(arcs().map((arc) => propOf(arc, "stroke"))).toEqual([accent, accent]);
      expect(lines().map((line) => propOf(line, "stroke"))).toEqual([
        textPrimary,
        textPrimary,
        textPrimary,
      ]);
    });

    it("should start on the complete logo before the UI thread has written a frame", async () => {
      await render(inTheme(<LoadingMark size={20} />));

      expect(arcs()[0]).toHaveAnimatedProps(arcAnimatedProps("arcOne", 0));
      expect(arcs()[1]).toHaveAnimatedProps({
        strokeDasharray: [205, 1000],
        strokeDashoffset: 0,
        opacity: 1,
      });
    });

    it("should hold the arcs' turn as a plain prop, never an animated one", async () => {
      await render(inTheme(<LoadingMark size={20} />));
      await advance(1166);

      for (const arc of arcs()) {
        expect(propOf(arc, "transform")).toMatch(/^rotate\(/);
        expect(animatedValuesOf(arc)).not.toHaveProperty("transform");
      }
      for (const line of lines()) {
        expect(animatedValuesOf(line)).not.toHaveProperty("transform");
      }
    });

    it.each([
      { milliseconds: 1166, note: "arc one drawing, t 0.25" },
      { milliseconds: 1430, note: "arc one just complete, t 0.37" },
      { milliseconds: 1716, note: "arc two drawing, t 0.5" },
    ])("should match the pose function's numbers with $note", async ({ milliseconds }) => {
      await render(inTheme(<LoadingMark size={20} />));

      await advance(milliseconds);

      expect(arcs()[0]).toHaveAnimatedProps(arcAnimatedProps("arcOne", milliseconds));
      expect(arcs()[1]).toHaveAnimatedProps(arcAnimatedProps("arcTwo", milliseconds));
    });

    it("should move the bar and the plates by their end points at t 0.25", async () => {
      await render(inTheme(<LoadingMark size={20} />));

      await advance(1166);

      const { bar, plateOne, plateTwo } = loadingMarkPose(loopPosition(1166));
      expect(lines()[0]).toHaveAnimatedProps(bar);
      expect(lines()[1]).toHaveAnimatedProps(plateOne);
      expect(lines()[2]).toHaveAnimatedProps(plateTwo);
    });

    it("should give a dash as two numbers and never a negative offset through a whole loop", async () => {
      await render(inTheme(<LoadingMark size={20} />));

      for (let elapsed = 0; elapsed < LOOP_MILLISECONDS; elapsed += 100) {
        await advance(100);
        for (const arc of arcs()) {
          const written = animatedValuesOf(arc);
          expect(Object.getOwnPropertyDescriptor(written, "strokeDasharray")?.value).toEqual([
            expect.any(Number),
            1000,
          ]);
          expect(
            Object.getOwnPropertyDescriptor(written, "strokeDashoffset")?.value,
          ).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it("should go on from where it was when it is rendered again with the same props", async () => {
      const { rerender } = await render(inTheme(<LoadingMark size={20} />));
      await advance(1166);

      await rerender(inTheme(<LoadingMark size={20} />));

      expect(arcs()[0]).toHaveAnimatedProps(arcAnimatedProps("arcOne", 1166));
      await advance(550);
      expect(arcs()[1]).toHaveAnimatedProps(arcAnimatedProps("arcTwo", 1716));
    });

    it("should leave no animation frame running once it is unmounted", async () => {
      const idleTimers = await idleTimerCount();
      const { unmount } = await render(inTheme(<LoadingMark size={20} />));
      await advance(500);
      expect(jest.getTimerCount()).toBeGreaterThan(idleTimers);

      await unmount();
      await advance(LOOP_MILLISECONDS);

      expect(jest.getTimerCount()).toBe(idleTimers);
    });

    it("should commit nothing to React over a whole loop of frames", async () => {
      const commits: string[] = [];
      await render(
        inTheme(
          <Profiler id="mark" onRender={(id) => commits.push(id)}>
            <LoadingMark size={20} />
          </Profiler>,
        ),
      );
      const commitsAfterMounting = commits.length;

      await advance(LOOP_MILLISECONDS);

      expect(commits).toHaveLength(commitsAfterMounting);
    });
  });

  describe("with reduced motion", () => {
    it("should draw the still logo, with nothing animated and no frame pending", async () => {
      reduceMotion(true);
      const idleTimers = await idleTimerCount();

      await render(inTheme(<LoadingMark size={20} />));
      await advance(LOOP_MILLISECONDS);

      const [stillArc, ...otherArcs] = arcs();
      expect(otherArcs).toHaveLength(0);
      expect(stillArc).toHaveProp("strokeDasharray", "205 122");
      expect(stillArc?.props).not.toHaveProperty("jestAnimatedProps");
      expect(jest.getTimerCount()).toBe(idleTimers);
    });

    it("should stop the loop when the setting is turned on, and start it when it is turned off", async () => {
      reduceMotion(false);
      const idleTimers = await idleTimerCount();
      await render(inTheme(<LoadingMark size={20} />));
      await advance(500);
      expect(arcs()).toHaveLength(2);

      await act(() => {
        announceReduceMotionChange?.(true);
      });
      await advance(LOOP_MILLISECONDS);
      expect(arcs()).toHaveLength(1);
      expect(jest.getTimerCount()).toBe(idleTimers);

      await act(() => {
        announceReduceMotionChange?.(false);
      });
      expect(arcs()).toHaveLength(2);
      await advance(1166);
      expect(arcs()[0]).toHaveAnimatedProps(arcAnimatedProps("arcOne", 1166));
    });
  });
});
