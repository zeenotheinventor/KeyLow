import { easingCurve, iconSize, motionDuration, themes } from "@keylow/tokens";
import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { impactAsync } from "expo-haptics";
import { AccessibilityInfo, Dimensions, Platform, StyleSheet } from "react-native";
import { Easing, setUpTests } from "react-native-reanimated";

import { TabBar } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { animatedOpacity, animatedTranslateXPoints } from "../support/animatedStyle";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";
import { viewsDrawn } from "../support/viewsDrawn";

import type { TabBarProps } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const mockImpact = jest.mocked(impactAsync);

const tabs = [
  { key: "dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { key: "diary", label: "Diary", icon: "BookOpen" },
  { key: "recipes", label: "Recipes", icon: "ChefHat" },
  { key: "more", label: "More", icon: "Ellipsis" },
] as const;

async function renderTabBar(props: Partial<TabBarProps> = {}, scheme: ThemeScheme = "dark") {
  const tree = (extra: Partial<TabBarProps>) => (
    <ThemeProvider fixedPreference={scheme}>
      <TabBar
        activeKey="dashboard"
        addLabel="Find food"
        label="Main"
        tabs={tabs}
        onAddPress={() => undefined}
        onSelect={() => undefined}
        platform="ios"
        {...props}
        {...extra}
      />
    </ThemeProvider>
  );
  const result = await render(tree({}));
  return { ...result, rerenderWith: (extra: Partial<TabBarProps>) => result.rerender(tree(extra)) };
}

function setReduceMotion(isEnabled: boolean): void {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(isEnabled);
}

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds);
  });
}

// The bar is as wide as the 390 point frame, so each of the five slots is 78.
async function layOut(width = 390) {
  await fireEvent(screen.getByLabelText("Main"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width, height: 83 } },
  });
  await advance(50);
}

// The slant is one entry of the line's transform, among the ones NativeWind writes out at rest.
function skewOf(element: ReturnType<typeof underline>): unknown {
  const style: unknown = StyleSheet.flatten(element.props.style);
  const transform: unknown =
    typeof style === "object" && style !== null
      ? Object.getOwnPropertyDescriptor(style, "transform")?.value
      : undefined;
  if (!Array.isArray(transform)) {
    return undefined;
  }
  for (const entry of transform) {
    const candidate: unknown = entry;
    if (typeof candidate === "object" && candidate !== null) {
      const value: unknown = Object.getOwnPropertyDescriptor(candidate, "skewX")?.value;
      if (value !== undefined) {
        return value;
      }
    }
  }
  return undefined;
}

type Control = { role: "tab" | "button"; name: string };

// The five slots left to right, as the frames draw them.
const slotOrder: Control[] = [
  { role: "tab", name: "Dashboard" },
  { role: "tab", name: "Diary" },
  { role: "button", name: "Find food" },
  { role: "tab", name: "Recipes" },
  { role: "tab", name: "More" },
];

// Where each named control sits among the bar's tabs and buttons, in the order a screen reader meets them.
function positionsOf(controls: Control[]): number[] {
  const all = screen.getAllByRole(/^(tab|button)$/);
  return controls.map(({ role, name }) => all.indexOf(screen.getByRole(role, { name })));
}

// The opacity of each destination's pill fill, left to right. The selected one is shown.
const pillOpacities = () =>
  screen.getAllByTestId("tab-pill-fade").map((fade) => animatedOpacity(fade));

const slide = () => screen.getByTestId("tab-bar-underline-slide");
const underline = () => screen.getByTestId("tab-bar-underline");

const schemes: ThemeScheme[] = ["dark", "light"];

describe("TabBar", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
    setReduceMotion(false);
    mockImpact.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("structure", () => {
    it("should be a tab list named by its label, holding the four destinations and the add button", async () => {
      await renderTabBar();

      expect(screen.getByLabelText("Main")).toHaveProp("role", "tablist");
      expect(screen.getAllByRole("tab")).toHaveLength(4);
      expect(screen.getAllByRole("button")).toHaveLength(1);
      expect(positionsOf(slotOrder)).toEqual([0, 1, 2, 3, 4]);
    });

    it("should put the add button in the middle, between the second and third destinations", async () => {
      await renderTabBar();

      expect(positionsOf(slotOrder)).toEqual([0, 1, 2, 3, 4]);
    });

    it("should say which destination is selected", async () => {
      await renderTabBar({ activeKey: "recipes" });

      expect(screen.getByRole("tab", { name: "Recipes", selected: true })).toBeOnTheScreen();
      expect(screen.getAllByRole("tab", { selected: true })).toHaveLength(1);
    });

    it("should select nothing when the active route is not one of the destinations", async () => {
      await renderTabBar({ activeKey: undefined });

      expect(screen.queryByRole("tab", { selected: true })).not.toBeOnTheScreen();
      expect(screen.queryByTestId("tab-bar-underline")).not.toBeOnTheScreen();
    });

    it("should never show the add button as selected, because it is an action", async () => {
      await renderTabBar();

      expect(screen.getByRole("button", { name: "Find food" })).not.toHaveProp(
        "aria-selected",
        true,
      );
    });
  });

  describe("pressing", () => {
    it("should select the destination that is pressed", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onSelect = jest.fn();
      await renderTabBar({ onSelect });

      await user.press(screen.getByRole("tab", { name: "Recipes" }));

      expect(onSelect).toHaveBeenCalledWith("recipes");
    });

    it("should play the selection haptic when the selection changes", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      await renderTabBar();

      await user.press(screen.getByRole("tab", { name: "Diary" }));

      expect(mockImpact).toHaveBeenCalledTimes(1);
      expect(mockImpact).toHaveBeenCalledWith("light");
    });

    it("should play no haptic for the destination that is already selected", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onSelect = jest.fn();
      await renderTabBar({ onSelect });

      await user.press(screen.getByRole("tab", { name: "Dashboard" }));

      expect(mockImpact).not.toHaveBeenCalled();
      expect(onSelect).toHaveBeenCalledWith("dashboard");
    });

    it("should call the add callback when the add button is pressed, and select nothing", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onAddPress = jest.fn();
      const onSelect = jest.fn();
      await renderTabBar({ onAddPress, onSelect });

      await user.press(screen.getByRole("button", { name: "Find food" }));

      expect(onAddPress).toHaveBeenCalledTimes(1);
      expect(onSelect).not.toHaveBeenCalled();
      expect(screen.getByRole("tab", { name: "Dashboard", selected: true })).toBeOnTheScreen();
    });
  });

  describe("the add button when disabled", () => {
    it("should be disabled, dimmed to 40 percent and not call the add callback", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onAddPress = jest.fn();
      await renderTabBar({ addDisabled: true, onAddPress });
      const add = screen.getByRole("button", { name: "Find food" });

      await user.press(add);

      expect(add).toBeDisabled();
      expect(add).toHaveStyle({ opacity: Math.fround(0.4) });
      expect(onAddPress).not.toHaveBeenCalled();
    });

    it("should leave the destinations pressable", async () => {
      await renderTabBar({ addDisabled: true });

      expect(screen.getByRole("tab", { name: "Diary" })).toBeEnabled();
    });

    it("should be enabled and at full strength by default", async () => {
      await renderTabBar();
      const add = screen.getByRole("button", { name: "Find food" });

      expect(add).toBeEnabled();
      expect(add).not.toHaveStyle({ opacity: Math.fround(0.4) });
    });
  });

  describe.each(schemes)("the iOS idiom in the %s scheme", (scheme) => {
    it("should be the surface with a hairline above it, 49 points tall counting the hairline", async () => {
      await renderTabBar({}, scheme);

      expect(await screen.findByLabelText("Main")).toHaveStyle({
        backgroundColor: resolvedColor(scheme, "surface"),
        borderTopWidth: 1,
        borderColor: resolvedColor(scheme, "border"),
      });
      expect(screen.getByRole("tab", { name: "Diary" })).toHaveStyle({ height: 48 });
    });

    it("should add the bottom inset under the 49 points", async () => {
      await renderTabBar({ bottomInset: 34 }, scheme);

      expect(await screen.findByLabelText("Main")).toHaveStyle({ paddingBottom: 34 });
    });

    it("should draw the selected destination as accent ink, lime in dark and the primary text in light", async () => {
      await renderTabBar({ activeKey: "diary" }, scheme);
      const colorName = scheme === "dark" ? "accent" : "text-primary";

      expect(await screen.findByText("Diary")).toHaveStyle({
        color: resolvedColor(scheme, colorName),
        fontFamily: "Geist-SemiBold",
        fontSize: 10,
      });
    });

    it("should draw the other destinations muted, medium weight", async () => {
      await renderTabBar({ activeKey: "diary" }, scheme);

      expect(await screen.findByText("More")).toHaveStyle({
        color: resolvedColor(scheme, "text-muted"),
        fontFamily: "Geist-Medium",
        fontSize: 10,
      });
    });

    it("should draw the add button as a 48 point accent circle with the accent foreground plus", async () => {
      await renderTabBar({}, scheme);

      expect(await screen.findByRole("button", { name: "Find food" })).toHaveStyle({
        width: 48,
        height: 48,
        borderRadius: 999,
        backgroundColor: resolvedColor(scheme, "accent"),
      });
      expect(viewsDrawn({ width: 48, height: 48 }).length).toBeGreaterThan(0);
    });

    it("should draw the underline in the accent colour, 28 by 2, slanted 20 degrees", async () => {
      await renderTabBar({}, scheme);

      expect(await screen.findByTestId("tab-bar-underline")).toHaveStyle({
        width: 28,
        height: 2,
        backgroundColor: resolvedColor(scheme, "accent"),
      });
      expect(skewOf(underline())).toBe("-20deg");
    });
  });

  describe("the icons", () => {
    it("should draw each destination's icon at 24 points", async () => {
      await renderTabBar();

      // Four destinations and the plus, each a drawing with no role of its own.
      const drawings = screen.root?.queryAll((node) => node.type === "RNSVGSvgView") ?? [];
      expect(drawings).toHaveLength(5);
      drawings.forEach((drawing) => {
        expect(drawing).toHaveProp("width", iconSize.lg);
      });
    });
  });

  describe.each(schemes)("the Android idiom in the %s scheme", (scheme) => {
    it("should be a 64 point bar on the raised surface, with no hairline and no underline", async () => {
      await renderTabBar({ platform: "android" }, scheme);

      expect(await screen.findByLabelText("Main")).toHaveStyle({
        backgroundColor: resolvedColor(scheme, "surface-raised"),
      });
      expect(screen.getByLabelText("Main")).not.toHaveStyle({ borderTopWidth: 1 });
      expect(screen.getByRole("tab", { name: "Diary" })).toHaveStyle({ height: 64 });
      expect(screen.queryByTestId("tab-bar-underline")).not.toBeOnTheScreen();
    });

    it("should hold each icon in a 56 by 28 pill of the accent muted fill, shown only behind the selected one", async () => {
      await renderTabBar({ platform: "android", activeKey: "diary" }, scheme);
      await screen.findByLabelText("Main");

      expect(
        viewsDrawn({
          width: 56,
          height: 28,
          borderRadius: 999,
          backgroundColor: themes[scheme]["accent-muted"],
        }),
      ).toHaveLength(4);
      expect(pillOpacities()).toEqual([0, 1, 0, 0]);
    });

    it("should draw the selected label in the primary text colour, at 12", async () => {
      await renderTabBar({ platform: "android", activeKey: "diary" }, scheme);

      expect(await screen.findByText("Diary")).toHaveStyle({
        color: resolvedColor(scheme, "text-primary"),
        fontFamily: "Geist-SemiBold",
        fontSize: 12,
      });
    });

    it("should keep the same five slots and the same centre add button", async () => {
      await renderTabBar({ platform: "android" }, scheme);

      expect(screen.getAllByRole(/^(tab|button)$/)).toHaveLength(5);
      expect(positionsOf(slotOrder)).toEqual([0, 1, 2, 3, 4]);
      expect(await screen.findByRole("button", { name: "Find food" })).toHaveStyle({
        width: 48,
        height: 48,
      });
    });
  });

  describe("the platform", () => {
    it("should follow the device's platform when none is given: iOS idiom on iOS", async () => {
      await renderTabBar({ platform: undefined });

      expect(screen.getByTestId("tab-bar-underline")).toBeOnTheScreen();
    });

    it("should follow the device's platform when none is given: Android idiom on Android", async () => {
      jest.replaceProperty(Platform, "OS", "android");
      await renderTabBar({ platform: undefined });

      expect(screen.queryByTestId("tab-bar-underline")).not.toBeOnTheScreen();
    });
  });

  describe("the underline", () => {
    it("should sit under the selected destination to begin with", async () => {
      await renderTabBar({ activeKey: "recipes" });
      await layOut();

      // Recipes is the fourth slot, after the add button, so its left edge is 3 slots in.
      expect(animatedTranslateXPoints(slide())).toBeCloseTo(3 * 78, 3);
    });

    it("should slide to the destination that becomes selected, with the design's spring", async () => {
      const { rerenderWith } = await renderTabBar({ activeKey: "dashboard" });
      await layOut();
      expect(animatedTranslateXPoints(slide())).toBeCloseTo(0, 3);

      await rerenderWith({ activeKey: "more" });
      await advance(50);
      const partway = animatedTranslateXPoints(slide());
      await advance(2000);

      expect(partway).toBeGreaterThan(0);
      expect(partway).not.toBeCloseTo(4 * 78, 0);
      expect(animatedTranslateXPoints(slide())).toBeCloseTo(4 * 78, 1);
    });

    it("should jump to the new destination, with no slide and no slant, when the user has reduced motion on", async () => {
      setReduceMotion(true);
      const { rerenderWith } = await renderTabBar({ activeKey: "dashboard" });
      await advance(100);
      await layOut();

      await rerenderWith({ activeKey: "more" });
      await advance(1);

      expect(animatedTranslateXPoints(slide())).toBeCloseTo(4 * 78, 3);
      expect(skewOf(underline())).not.toBe("-20deg");
    });
  });

  describe("the underline's slant when the reduce motion setting changes", () => {
    it("should keep the slant's CSS variables in both states, so the line is never remounted", async () => {
      const log = jest.spyOn(console, "log").mockImplementation(() => undefined);
      setReduceMotion(true);
      const first = await renderTabBar();
      await advance(100);
      await first.unmount();

      // The setting is read again, and has changed, while the line is drawn with the answer it kept.
      setReduceMotion(false);
      await renderTabBar();
      await advance(100);

      expect(log).not.toHaveBeenCalledWith(expect.stringContaining("CssInterop upgrade warning"));
    });
  });

  describe("the pill fade on Android", () => {
    // Where a fade that is a fraction of the way through its duration should stand on a curve.
    const curveAt = (fraction: number, curve: [number, number, number, number]) =>
      Easing.bezier(...curve).factory()(fraction);

    async function fadeTo(activeKey: string) {
      const { rerenderWith } = await renderTabBar({ platform: "android", activeKey: "diary" });
      await advance(motionDuration.quick * 2);
      await rerenderWith({ activeKey });
    }

    it("should fade the pill in and out over the quick duration on the enter curve", async () => {
      await fadeTo("more");
      await advance(motionDuration.quick / 2);

      const [, diary, , more] = pillOpacities();
      expect(more).toBeCloseTo(curveAt(0.5, easingCurve.enter), 1);
      expect(diary).toBeCloseTo(1 - curveAt(0.5, easingCurve.enter), 1);

      await advance(motionDuration.quick);
      expect(pillOpacities()).toEqual([0, 0, 0, 1]);
    });

    it("should still fade when the user has reduced motion on, on the ease-out curve", async () => {
      setReduceMotion(true);
      await fadeTo("more");
      await advance(motionDuration.quick / 2);

      const [, , , more] = pillOpacities();
      // ease-out is the design's `cubic-bezier(0, 0, 0.58, 1)`, which is not the enter curve.
      expect(more).toBeCloseTo(curveAt(0.5, [0, 0, 0.58, 1]), 1);
      expect(more).not.toBeCloseTo(curveAt(0.5, easingCurve.enter), 1);

      await advance(motionDuration.quick);
      expect(pillOpacities()).toEqual([0, 0, 0, 1]);
    });
  });

  describe("the label", () => {
    it("should stay on one line and grow no more than 1.2 times at large text, so it never breaks or leaves its slot", async () => {
      await renderTabBar();

      const label = screen.getByText("Dashboard");
      expect(label).toHaveProp("numberOfLines", 1);
      expect(label).toHaveProp("maxFontSizeMultiplier", 1.2);
    });

    // Android multiplies a line height by the whole font scale where it caps the font size, so it is given
    // divided by the scale, and iOS caps both itself. What each ends up as on the device is the label's
    // own 12 points times the scale up to 1.2.
    it.each([
      { os: "ios", fontScale: 1, lineHeight: 12 },
      { os: "ios", fontScale: 2, lineHeight: 12 },
      { os: "android", fontScale: 0.85, lineHeight: 12 },
      { os: "android", fontScale: 1, lineHeight: 12 },
      { os: "android", fontScale: 1.2, lineHeight: 12 },
      { os: "android", fontScale: 2, lineHeight: 7.2 },
    ] as const)(
      "should give the label a $lineHeight point line height on $os at font scale $fontScale",
      async ({ os, fontScale, lineHeight }) => {
        jest.replaceProperty(Platform, "OS", os);
        jest
          .spyOn(Dimensions, "get")
          .mockReturnValue({ width: 411, height: 914, scale: 2.625, fontScale });
        await renderTabBar();

        const label = await screen.findByText("Dashboard");
        const style: unknown = StyleSheet.flatten(label.props.style);
        const drawn: unknown =
          typeof style === "object" && style !== null
            ? Object.getOwnPropertyDescriptor(style, "lineHeight")?.value
            : undefined;
        expect(drawn).toBeCloseTo(lineHeight, 5);
      },
    );

    it("should not set tabular figures, which the frames do not draw on a label", async () => {
      await renderTabBar();

      const style: unknown = StyleSheet.flatten(screen.getByText("Dashboard").props.style);
      expect(style).not.toHaveProperty("fontVariant");
    });
  });

  describe("the slot count", () => {
    it("should divide the bar by its real slots: two destinations and the plus make three", async () => {
      await renderTabBar({
        tabs: [
          { key: "dashboard", label: "Dashboard", icon: "LayoutDashboard" },
          { key: "diary", label: "Diary", icon: "BookOpen" },
        ],
        activeKey: "diary",
      });
      await layOut(300);

      // Diary is after the plus, so it is the third slot, 200 points in, and each slot is 100 wide.
      expect(animatedTranslateXPoints(slide())).toBeCloseTo(200, 3);
      expect(viewsDrawn({ width: 100 }).length).toBeGreaterThan(0);
    });
  });
});
